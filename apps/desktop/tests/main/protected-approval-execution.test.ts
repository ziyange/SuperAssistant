import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import Database from 'better-sqlite3';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { expect, test, vi } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { builtinCodexFunctionId, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from '../../src/main/reserved-payload-service.js';
import { EncryptedProposalStore } from '../../src/main/encrypted-proposal-store.js';
import { ProtectedProposalAuthority } from '../../src/main/protected-proposal-authority.js';
import { presentProtectedConsent } from '../../src/main/protected-native-consent.js';
import { projectGitEnvironment } from '../../src/main/project-git-baseline.js';

vi.mock('../../src/main/protected-native-consent.js', () => ({ presentProtectedConsent: vi.fn() }));

class Vault implements ReservedVault {
  values = new Map<string, Buffer>();
  async create(ref: string) { const key = randomBytes(32); this.values.set(ref, Buffer.from(key)); return key; }
  async read(ref: string) { const key = this.values.get(ref); return key ? Buffer.from(key) : null; }
}

async function fixture() {
  const folder = mkdtempSync(join(tmpdir(), 'sa-protected-git-'));
  const project = join(folder, 'project');
  const executable = join(folder, 'fake-codex.exe');
  writeFileSync(executable, 'synthetic executable');
  const env = projectGitEnvironment();
  execFileSync('git', ['init', '--quiet', project], { env });
  const commit = (message: string) => execFileSync('git', ['-C', project, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', message], { env });
  commit('initial');
  const head = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { env, encoding: 'utf8' }).trim();
  const db = new Database(':memory:');
  applyMigrations(db);
  db.exec(readFileSync(new URL('../../../../packages/persistence/src/sqlite/migrations/033-protected-execution.sql', import.meta.url), 'utf8'));
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO agents VALUES ('agent','w','Codex','0.121.0','CONNECTED','AVAILABLE',NULL,1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P',?,?,'ACTIVE','agent',1,'2026','2026',1)").run(realpathSync(project), realpathSync(project).toLowerCase());
  db.prepare("INSERT INTO local_codex_registrations VALUES ('w','agent',?,'0.121.0','2026')").run(realpathSync(executable));
  provisionBuiltinCodexFunction(db, 'w', 'agent', '0.121.0');
  const functionId = builtinCodexFunctionId('agent');
  const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'proposal-git' };
  const proposal = createH1ReviewedProposal(scope.proposalVersionId, {
    objective: 'private integration goal', workspaceId: 'w', projectId: 'p', agentId: 'agent', functionId,
    projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1',
    baselineCommit: head, createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
    budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'codex-file-write', version: '1' }],
    workItems: [{ id: 'review-work', projectId: 'p', agentId: 'agent', functionId, objective: 'private integration goal', required: true, dependencies: [] }],
    resources: [{ key: 'project:p', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: [],
    reconfirmationTriggers: ['change'], risk: 'HIGH', acceptanceCriteria: [{ criterion: 'private evidence', evidence: 'review' }]
  });
  const vault = new Vault();
  await new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault)).save(scope, proposal);
  db.prepare("INSERT INTO proposal_authority_refs VALUES (?, ?, ?, 'PROTECTED', 1, ?)").run(scope.proposalVersionId, 'w', 'p', proposal.createdAt);
  db.prepare(`INSERT INTO protected_proposal_bindings
    SELECT ?, 'PROTECTED', ?, ?, record_id, key_ref, 'PROPOSAL', 1, 'SAI_PROPOSAL_SHA256_V1'
    FROM protected_payloads WHERE record_id=?`).run(scope.proposalVersionId, 'w', 'p', scope.proposalVersionId);
  const authority = new ProtectedProposalAuthority(db, vault, () => '2026-08-01T00:00:00.000Z');
  return { folder, db, scope, authority, commit, head, project, executable };
}

test('a real Git baseline and synthetic native consent queue one protected Attempt', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const result = await item.authority.confirmAndQueue(item.scope);
    expect(result.attemptId).toMatch(/^[a-f0-9-]{36}$/);
    expect(item.db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    expect(item.db.serialize().includes(Buffer.from('private integration goal'))).toBe(false);
    expect(execFileSync('git', ['-C', item.project, 'rev-parse', 'HEAD'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe(item.head);
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('a real Git commit during native review prevents authorization and leaves no Attempt', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockImplementation(async () => { item.commit('changed during review'); return true; });
    await expect(item.authority.confirmAndQueue(item.scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(item.db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT count(*) AS n FROM outbox').get()).toEqual({ n: 0 });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('replacing a real disposable executable during review prevents authorization', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockImplementation(async () => {
      writeFileSync(item.executable, 'a different synthetic executable');
      return true;
    });
    await expect(item.authority.confirmAndQueue(item.scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(item.db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);
