import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';
import Database from 'better-sqlite3';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { expect, test, vi } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { builtinCodexFunctionId, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from '../../src/main/reserved-payload-service.js';
import { EncryptedProposalStore } from '../../src/main/encrypted-proposal-store.js';
import { ProtectedProposalAuthority } from '../../src/main/protected-proposal-authority.js';
import { ProtectedProposalRegistry } from '../../src/main/protected-proposal-registry.js';
import { ProtectedProposalIntake } from '../../src/main/protected-proposal-intake.js';
import { LocalGoalDraft } from '../../src/main/local-goal-draft.js';
import { ProtectedGoalAuthorization } from '../../src/main/protected-goal-authorization.js';
import { OwnerAppServerTransport } from '../../src/main/owner-app-server-transport.js';
import { InProcessOwnerTransport } from '../../src/main/inprocess-owner-transport.js';
import { WindowsNativeVault } from '../../src/main/windows-native-vault.js';
import { ProtectedAttemptObserver } from '../../src/main/protected-attempt-observer.js';
import { presentProtectedCancellation, presentProtectedConsent } from '../../src/main/protected-native-consent.js';
import { projectGitEnvironment } from '../../src/main/project-git-baseline.js';
import { AppServerExecutionClient } from '../../../../packages/codex-adapter/src/app-server-execution-client.js';
import { ReadOnlyAppServerClient } from '@super-assistant/codex-adapter';

vi.mock('../../src/main/protected-native-consent.js', () => ({ presentProtectedConsent: vi.fn(), presentProtectedCancellation: vi.fn() }));

class Vault implements ReservedVault {
  values = new Map<string, Buffer>();
  async create(ref: string) { const key = randomBytes(32); this.values.set(ref, Buffer.from(key)); return key; }
  async read(ref: string) { const key = this.values.get(ref); return key ? Buffer.from(key) : null; }
}

async function fixture(objective = 'private integration goal') {
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
    objective, workspaceId: 'w', projectId: 'p', agentId: 'agent', functionId,
    projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1',
    baselineCommit: head, createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
    budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'codex-file-write', version: '1' }],
    workItems: [{ id: 'review-work', projectId: 'p', agentId: 'agent', functionId, objective, required: true, dependencies: [] }],
    resources: [{ key: 'project:p', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: [],
    reconfirmationTriggers: ['change'], risk: 'HIGH', acceptanceCriteria: [{ criterion: 'private evidence', evidence: 'review' }]
  });
  const vault = new Vault();
  await new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault)).save(scope, proposal);
  await new ProtectedProposalRegistry(db, vault, () => '2026-08-01T00:00:00.000Z').register(scope);
  const authority = new ProtectedProposalAuthority(db, vault, () => '2026-08-01T00:00:00.000Z');
  return { folder, db, vault, scope, authority, commit, head, project, executable, proposal };
}

test('one main-owned goal command stages and confirms exactly one original Attempt', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Change the fixture', criterion: 'Document the change' });
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    const results = await Promise.all([command.confirm(draftId), command.confirm(draftId)]);
    expect(results[0]).toEqual(results[1]);
    expect(vi.mocked(presentProtectedConsent)).toHaveBeenCalledOnce();
    expect(vi.mocked(presentProtectedConsent).mock.calls[0]?.[0]).toContain('Change the fixture');
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 1 });
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: results[0].attemptId, state: 'DISPATCH_PENDING' });
    expect(item.db.serialize().includes(Buffer.from('Change the fixture'))).toBe(false);
    expect(await command.confirm(draftId)).toEqual(results[0]);
    const another = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(another.confirm(draftId)).rejects.toThrow();
    drafts.discard(draftId);
    await expect(command.confirm(draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('a guarded draft request cannot reuse an unguarded pending confirmation', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  let release: (() => void) | undefined;
  let unguarded: Promise<{ attemptId: string }> | undefined;
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Change the fixture', criterion: 'Document the change' });
    const scope = await new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z').stage(draftId);
    let notifyReady: (() => void) | undefined;
    const ready = new Promise<void>(resolve => { notifyReady = resolve; });
    const paused = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(presentProtectedConsent).mockReset().mockImplementation(async () => { notifyReady?.(); await paused; return true; });
    unguarded = item.authority.confirmAndQueue(scope);
    await ready;
    await expect(item.authority.confirmDraftAndQueue(scope, drafts, draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    release?.();
    await unguarded;
  } finally { release?.(); await unguarded?.catch(() => undefined); drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('a guarded command rejects a completed unguarded approval', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Change the fixture', criterion: 'Document the change' });
    const scope = await new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z').stage(draftId);
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const unguarded = await item.authority.confirmAndQueue(scope);
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(command.confirm(draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT attempt_id FROM execution_attempts').get()).toEqual({ attempt_id: unguarded.attemptId });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 1 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('guarded replay rolls back if the draft is discarded during lease observation', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Change the fixture', criterion: 'Document the change' });
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    const original = await command.confirm(draftId);
    item.db.function('fixture_discard_replay', () => { drafts.discard(draftId); return 1; });
    item.db.exec('CREATE TRIGGER fixture_discard_replay AFTER UPDATE ON resource_leases BEGIN SELECT fixture_discard_replay(); END');
    await expect(command.confirm(draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT attempt_id FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 1 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('discarding a staged draft during native confirmation cannot create authorization', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Change the fixture', criterion: 'Document the change' });
    vi.mocked(presentProtectedConsent).mockReset().mockImplementation(async () => { drafts.discard(draftId); return true; });
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(command.confirm(draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('a draft invalidated reentrantly during the authorization transaction rolls back the Grant and Attempt', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Change the fixture', criterion: 'Document the change' });
    item.db.function('fixture_discard_draft', () => { drafts.discard(draftId); return 1; });
    item.db.exec('CREATE TRIGGER fixture_discard AFTER INSERT ON authorization_grants BEGIN SELECT fixture_discard_draft(); END');
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(command.confirm(draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('a dismissed native confirmation creates no Grant or Attempt', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Change the fixture', criterion: 'Document the change' });
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(false);
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(command.confirm(draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('a real local draft stages one protected Proposal and retains its original Attempt after a lost fake reply', async () => {
  const item = await fixture();
  let child: ReturnType<typeof spawn> | undefined;
  let client: AppServerExecutionClient | undefined;
  let closed: Promise<unknown> | undefined;
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const [original, repeated] = await Promise.all([command.confirm(draftId), command.confirm(draftId)]);
    expect(original).toEqual(repeated);
    const first = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'goal-review-' + draftId.slice(5) };
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM protected_proposal_bindings WHERE proposal_version_id=?').get(first.proposalVersionId)).toEqual({ n: 1 });
    expect(item.db.serialize().includes(Buffer.from('Write the approved change'))).toBe(false);
    expect(item.db.serialize().includes(Buffer.from('Document the fixture'))).toBe(false);
    const path = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (version, onUnknown, record) => {
      child = spawn(process.execPath, [path, 'lost-turn'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      closed = once(child, 'close');
      client = new AppServerExecutionClient(child, version, principal, async () => true, onUnknown, record);
      return client;
    });
    await expect(dispatcher.start(first)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(await Promise.race([closed, new Promise(resolve => setTimeout(() => resolve('timeout'), 3000))])).toEqual([0, null]);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 1 });
  } finally {
    drafts.discard(draftId);
    client?.dispose();
    if (child?.stdin && !child.stdin.destroyed) child.stdin.end();
    if (closed) await closed;
    item.db.close();
    rmSync(item.folder, { recursive: true, force: true });
  }
}, 60000);

test('a draft made stale during vault creation is not registered or authorized', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Update fixture documentation', criterion: 'Document the fixture' });
    const originalCreate = item.vault.create.bind(item.vault);
    const create = vi.spyOn(item.vault, 'create').mockImplementation(async ref => {
      const key = await originalCreate(ref);
      item.db.prepare("UPDATE projects SET row_version=row_version+1 WHERE project_id='p'").run();
      return key;
    });
    const intake = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(intake.stage(draftId)).rejects.toThrow();
    await expect(intake.stage(draftId)).rejects.toThrow();
    expect(create).toHaveBeenCalledOnce();
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM proposal_authority_refs WHERE proposal_version_id LIKE 'goal-review-%'").get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('an uncertain vault write is not automatically retried', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Update fixture documentation', criterion: 'Document the fixture' });
    const originalCreate = item.vault.create.bind(item.vault);
    const create = vi.spyOn(item.vault, 'create').mockImplementation(async ref => { await originalCreate(ref); throw new Error('ambiguous fixture'); });
    const intake = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(intake.stage(draftId)).rejects.toThrow();
    await expect(intake.stage(draftId)).rejects.toThrow();
    expect(create).toHaveBeenCalledOnce();
    expect(item.db.prepare("SELECT state FROM protected_key_reservations WHERE record_id LIKE 'goal-review-%'").get()).toEqual({ state: 'UNCERTAIN' });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('concurrent intake instances never create duplicate key material for one draft', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    const create = vi.spyOn(item.vault, 'create');
    const first = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    const second = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    const results = await Promise.allSettled([first.stage(draftId), second.stage(draftId)]);
    expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    const scope = await second.stage(draftId);
    expect(create).toHaveBeenCalledOnce();
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM protected_proposal_bindings WHERE proposal_version_id=?').get(scope.proposalVersionId)).toEqual({ n: 1 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('discarding a draft during registry authentication prevents protected registration', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    const read = item.vault.read.bind(item.vault);
    let reads = 0;
    vi.spyOn(item.vault, 'read').mockImplementation(async ref => {
      const result = await read(ref);
      // Two reads occur while saving; the third authenticates the registry envelope.
      if (++reads === 3) drafts.discard(draftId);
      return result;
    });
    const intake = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(intake.stage(draftId)).rejects.toThrow();
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM protected_payloads WHERE record_id LIKE 'goal-review-%'").get()).toEqual({ n: 1 });
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM protected_proposal_bindings WHERE proposal_version_id LIKE 'goal-review-%'").get()).toEqual({ n: 0 });
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM proposal_authority_refs WHERE proposal_version_id LIKE 'goal-review-%'").get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('a draft discarded reentrantly by its clock cannot be registered', async () => {
  const item = await fixture();
  let armed = false;
  let draftId = '';
  const drafts = new LocalGoalDraft(item.db, () => {
    if (armed) { armed = false; drafts.discard(draftId); }
    return new Date('2026-08-01T00:00:00.000Z');
  });
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    const read = item.vault.read.bind(item.vault);
    let reads = 0;
    vi.spyOn(item.vault, 'read').mockImplementation(async ref => {
      const result = await read(ref);
      if (++reads === 3) armed = true;
      return result;
    });
    const intake = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(intake.stage(draftId)).rejects.toThrow();
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM protected_proposal_bindings WHERE proposal_version_id LIKE 'goal-review-%'").get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('a draft expiring during registry authentication cannot be registered', async () => {
  const item = await fixture();
  let now = '2026-08-01T00:00:00.000Z';
  const drafts = new LocalGoalDraft(item.db, () => new Date(now));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    const read = item.vault.read.bind(item.vault);
    let reads = 0;
    vi.spyOn(item.vault, 'read').mockImplementation(async ref => {
      const result = await read(ref);
      if (++reads === 3) now = '2026-08-01T00:16:00.000Z';
      return result;
    });
    const intake = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(intake.stage(draftId)).rejects.toThrow();
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM protected_proposal_bindings WHERE proposal_version_id LIKE 'goal-review-%'").get()).toEqual({ n: 0 });
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM proposal_authority_refs WHERE proposal_version_id LIKE 'goal-review-%'").get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('rejects a different valid encrypted Proposal swapped between draft recheck and registry authentication', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  try {
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    const prepare = drafts.prepare.bind(drafts);
    let reads = 0;
    vi.spyOn(drafts, 'prepare').mockImplementation(async id => {
      const original = await prepare(id);
      if (++reads === 2 && original.fullReview) {
        const other = createH1ReviewedProposal(original.proposalVersionId, {
          ...original.fullReview, objective: 'Different objective',
          workItems: original.fullReview.workItems.map(work => ({ ...work, objective: 'Different objective' }))
        });
        const row = item.db.prepare('SELECT format_version,workspace_id,project_id,record_id,content_kind,key_ref,created_at FROM protected_payloads WHERE record_id=?')
          .get(original.proposalVersionId) as { format_version: number; workspace_id: string; project_id: string; record_id: string; content_kind: string; key_ref: string; created_at: string };
        const key = item.vault.values.get(row.key_ref);
        if (!key) throw new Error('missing synthetic fixture key');
        const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
        cipher.setAAD(Buffer.from(JSON.stringify([row.format_version, row.workspace_id, row.project_id, row.record_id, row.content_kind, row.key_ref, row.created_at])));
        const ciphertext = Buffer.concat([cipher.update(JSON.stringify(other), 'utf8'), cipher.final()]);
        item.db.exec('DROP TRIGGER protected_payloads_no_update');
        item.db.prepare('UPDATE protected_payloads SET nonce=?,ciphertext=?,auth_tag=? WHERE record_id=?').run(nonce, ciphertext, cipher.getAuthTag(), row.record_id);
      }
      return original;
    });
    const intake = new ProtectedProposalIntake(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    await expect(intake.stage(draftId)).rejects.toThrow();
    expect(item.db.prepare("SELECT COUNT(*) AS n FROM proposal_authority_refs WHERE proposal_version_id LIKE 'goal-review-%'").get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
  } finally { drafts.discard(draftId); item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 60000);

test('an accepted fake Turn with a lost reply quarantines the original Attempt in an isolated worktree', async () => {
  const item = await fixture('Write the approved change');
  let child: ReturnType<typeof spawn> | undefined;
  let client: AppServerExecutionClient | undefined;
  let closed: Promise<unknown> | undefined;
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const path = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let receiptCount = 0;
    let isolatedPath = '';
    let turnWrites = () => 0;
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (version, onUnknown, record, cwd) => {
      isolatedPath = cwd;
      child = spawn(process.execPath, [path, 'lost-turn'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      closed = once(child, 'close');
      if (!child.stdin) throw new Error('fixture stdin unavailable');
      const writes = vi.spyOn(child.stdin, 'write');
      turnWrites = () => writes.mock.calls.filter(call => String(call[0]).includes('"turn/start"')).length;
      client = new AppServerExecutionClient(child, version, principal, async () => true, onUnknown,
        receipt => { receiptCount += 1; return record(receipt); });
      return client;
    });
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(realpathSync(isolatedPath)).not.toBe(realpathSync(item.project));
    expect(execFileSync('git', ['-C', isolatedPath, 'rev-parse', 'HEAD'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe(item.head);
    // The fixture exits successfully only after accepting the exact Turn request
    // in lost-turn mode; a protocol rejection leaves stdin open and does not exit.
    const serverExit = await Promise.race([closed, new Promise(resolve => setTimeout(() => resolve('timeout'), 3000))]);
    expect(serverExit).toEqual([0, null]);
    expect(receiptCount).toBe(0);
    expect(turnWrites()).toBe(1);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all())
      .toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'RECONCILING', claim_token: null });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    await expect(item.authority.claimQueued(item.scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    await expect(dispatcher.start(item.scope)).rejects.toThrow();
    expect(turnWrites()).toBe(1);
    expect(execFileSync('git', ['-C', item.project, 'rev-parse', 'HEAD'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe(item.head);
    expect(execFileSync('git', ['-C', item.project, 'status', '--porcelain'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe('');
  } finally {
    client?.dispose();
    if (child?.stdin && !child.stdin.destroyed) child.stdin.end();
    if (closed) await closed;
    item.db.close();
    rmSync(item.folder, { recursive: true, force: true });
  }
}, 45000);

test.skipIf(process.platform !== 'win32')('protected goal cancellation stops the real fixture Job and retains the original uncertain Attempt', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  let owner: ReturnType<typeof spawn> | undefined;
  let transport: OwnerAppServerTransport | undefined;
  let client: AppServerExecutionClient<OwnerAppServerTransport> | undefined;
  let closed: Promise<unknown> | undefined;
  try {
    const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
    const binary = join(item.folder, 'owner.exe');
    const wrapper = join(process.cwd(), 'apps/desktop/tests/native/owned-execution-wrapper.mjs');
    execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    const original = await command.confirm(draftId);
    const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'goal-review-' + draftId.slice(5) };
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (version, onUnknown, recordStart, cwd) => {
      owner = spawn(binary, [], { cwd: item.folder, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      closed = once(owner, 'close');
      transport = new OwnerAppServerTransport(owner);
      client = new AppServerExecutionClient(transport, version, principal, async () => true, onUnknown, recordStart, 15000);
      return {
        async initialize() {
          if (await transport!.start({ executable: process.execPath, cwd, args: [wrapper, 'normal', item.folder] }, 15000) !== 'READY_UNTRUSTED') throw new Error('fixture owner unavailable');
          await client!.initialize();
        },
        start: (path, objective) => client!.start(path, objective),
        interrupt: () => client!.interrupt(),
        stop: (timeoutMs) => transport!.stop(timeoutMs),
        dispose: () => client!.dispose()
      };
    });
    const dispatched = await dispatcher.start(scope);
    expect(dispatched.attemptId).toBe(original.attemptId);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'RUNNING' });
    const parentFile = join(item.folder, 'parent.pid'), childFile = join(item.folder, 'child.pid');
    const deadline = Date.now() + 15000;
    while ((!existsSync(parentFile) || !existsSync(childFile)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    expect(existsSync(parentFile) && existsSync(childFile)).toBe(true);
    const pids = [Number(readFileSync(parentFile, 'utf8')), Number(readFileSync(childFile, 'utf8'))];
    expect(pids.every(pid => Number.isSafeInteger(pid) && pid > 0)).toBe(true);
    expect(pids[0]).not.toBe(pids[1]);
    for (const pid of pids) expect(() => process.kill(pid, 0)).not.toThrow();
    vi.mocked(presentProtectedCancellation).mockReset().mockResolvedValue(true);
    expect(await dispatcher.cancel(scope)).toBe('UNKNOWN');
    await closed;
    for (const pid of pids) {
      try { process.kill(pid, 0); throw new Error('fixture process still running'); }
      catch (error) { expect(error && typeof error === 'object' && 'code' in error ? error.code : null).toBe('ESRCH'); }
    }
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    expect(execFileSync('git', ['-C', item.project, 'status', '--porcelain'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe('');
  } finally {
    drafts.discard(draftId);
    client?.dispose();
    if (owner && owner.exitCode === null && owner.signalCode === null) owner.kill();
    if (closed) await closed;
    item.db.close();
    rmSync(item.folder, { recursive: true, force: true });
  }
}, 120000);

test.skipIf(process.platform !== 'win32')('protected original Attempt runs and cancels through the in-process Job owner', async () => {
  const item = await fixture();
  const drafts = new LocalGoalDraft(item.db, () => new Date('2026-08-01T00:00:00.000Z'));
  let draftId = '';
  let transport: InProcessOwnerTransport | undefined;
  let client: AppServerExecutionClient<InProcessOwnerTransport> | undefined;
  try {
    const addon = createRequire(import.meta.url)(join(process.cwd(), 'apps/desktop/native/build/Release/process_owner.node'));
    const wrapper = join(process.cwd(), 'apps/desktop/tests/native/owned-execution-wrapper.mjs');
    draftId = await drafts.create({ projectId: 'p', objective: 'Write the approved change', criterion: 'Document the fixture' });
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const command = new ProtectedGoalAuthorization(item.db, item.vault, drafts, () => '2026-08-01T00:00:00.000Z');
    const original = await command.confirm(draftId);
    const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'goal-review-' + draftId.slice(5) };
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (version, onUnknown, recordStart, cwd) => {
      const owner = addon.start(process.execPath, [wrapper, 'normal', item.folder], cwd);
      transport = new InProcessOwnerTransport(owner);
      client = new AppServerExecutionClient(transport, version, principal, async () => true, onUnknown, recordStart, 15000);
      return {
        initialize: () => client!.initialize(),
        start: (path, objective) => client!.start(path, objective),
        interrupt: () => client!.interrupt(),
        async stop() { return await transport!.stop() === 'TERMINATED_UNVERIFIED' ? 'UNVERIFIED_TERMINATION' as const : 'UNKNOWN' as const; },
        dispose: () => client!.dispose()
      };
    });
    expect((await dispatcher.start(scope)).attemptId).toBe(original.attemptId);
    const parentFile = join(item.folder, 'parent.pid'), childFile = join(item.folder, 'child.pid');
    const deadline = Date.now() + 15000;
    while ((!existsSync(parentFile) || !existsSync(childFile)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    expect(existsSync(parentFile) && existsSync(childFile)).toBe(true);
    const pids = [Number(readFileSync(parentFile, 'utf8')), Number(readFileSync(childFile, 'utf8'))];
    expect(pids.every(pid => Number.isSafeInteger(pid) && pid > 0)).toBe(true);
    expect(pids[0]).not.toBe(pids[1]);
    vi.mocked(presentProtectedCancellation).mockReset().mockResolvedValue(true);
    expect(await dispatcher.cancel(scope)).toBe('UNKNOWN');
    for (const pid of pids) {
      try { process.kill(pid, 0); throw new Error('fixture process still running'); }
      catch (error) { expect(error && typeof error === 'object' && 'code' in error ? error.code : null).toBe('ESRCH'); }
    }
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    const receipt = await item.authority.readReceipt(scope);
    expect(receipt?.attemptId).toBe(original.attemptId);
    const backup = join(item.folder, 'restart.sqlite');
    await item.db.backup(backup);
    const reopened = new Database(backup);
    try {
      const recovered = new ProtectedProposalAuthority(reopened, item.vault, () => '2026-08-01T00:00:00.000Z');
      expect(await recovered.readReceipt(scope)).toEqual(receipt);
      expect(await recovered.beginReconciliation(scope)).toBe(true);
      expect(reopened.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'RECONCILING' }]);
      expect(reopened.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    } finally { reopened.close(); }
    expect(execFileSync('git', ['-C', item.project, 'status', '--porcelain'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe('');
  } finally {
    drafts.discard(draftId);
    client?.dispose();
    if (transport) await transport.stop();
    item.db.close();
    rmSync(item.folder, { recursive: true, force: true });
  }
}, 120000);

test.skipIf(process.platform !== 'win32')('real test-namespace Windows credentials protect the same owned Attempt after database reopen', async () => {
  const addon = createRequire(import.meta.url)(join(process.cwd(), 'apps/desktop/native/build/Release/wincred_test.node'));
  const ownerAddon = createRequire(import.meta.url)(join(process.cwd(), 'apps/desktop/native/build/Release/process_owner.node'));
  const item = await fixture();
  const keys = new Map<string, Buffer>();
  const vault = new WindowsNativeVault({
    async create(ref) { const key: Buffer = await addon.create(ref); keys.set(ref, Buffer.from(key)); return key; },
    async read(ref) { return await addon.read(ref) as Buffer | null; }
  });
  const clock = () => '2026-08-01T00:00:00.000Z';
  const drafts = new LocalGoalDraft(item.db, () => new Date(clock()));
  let draftId = '';
  let transport: InProcessOwnerTransport | undefined;
  let client: AppServerExecutionClient<InProcessOwnerTransport> | undefined;
  try {
    const objective = 'Write the approved change';
    draftId = await drafts.create({ projectId: 'p', objective, criterion: 'Document the isolated fixture' });
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const original = await new ProtectedGoalAuthorization(item.db, vault, drafts, clock).confirm(draftId);
    const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'goal-review-' + draftId.slice(5) };
    const authority = new ProtectedProposalAuthority(item.db, vault, clock);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const wrapper = join(process.cwd(), 'apps/desktop/tests/native/owned-execution-wrapper.mjs');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(authority, join(item.folder, 'worktrees'), principal, (version, onUnknown, recordStart, cwd) => {
      transport = new InProcessOwnerTransport(ownerAddon.start(process.execPath, [wrapper, 'normal', item.folder], cwd));
      client = new AppServerExecutionClient(transport, version, principal, async () => true, onUnknown, recordStart, 15000);
      return {
        initialize: () => client!.initialize(), start: (path, goal) => client!.start(path, goal),
        interrupt: () => client!.interrupt(),
        async stop() { return await transport!.stop() === 'TERMINATED_UNVERIFIED' ? 'UNVERIFIED_TERMINATION' as const : 'UNKNOWN' as const; },
        dispose: () => client!.dispose()
      };
    });
    expect((await dispatcher.start(scope)).attemptId).toBe(original.attemptId);
    const pids = ['parent.pid', 'child.pid'].map(file => Number(readFileSync(join(item.folder, file), 'utf8')));
    expect(pids.every(pid => Number.isSafeInteger(pid) && pid > 0)).toBe(true);
    expect(pids[0]).not.toBe(pids[1]);
    for (const pid of pids) expect(() => process.kill(pid, 0)).not.toThrow();
    vi.mocked(presentProtectedCancellation).mockReset().mockResolvedValue(true);
    expect(await dispatcher.cancel(scope)).toBe('UNKNOWN');
    for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
    const receipt = await authority.readReceipt(scope);
    expect(receipt?.attemptId).toBe(original.attemptId);
    expect(keys.size).toBeGreaterThan(0);
    const serialized = item.db.serialize();
    expect(serialized.includes(Buffer.from(objective))).toBe(false);
    for (const key of keys.values()) expect(serialized.includes(key)).toBe(false);
    const backup = join(item.folder, 'credential-restart.sqlite');
    await item.db.backup(backup);
    const reopened = new Database(backup);
    try {
      const recovered = new ProtectedProposalAuthority(reopened, vault, clock);
      expect(await recovered.readReceipt(scope)).toEqual(receipt);
      expect(await recovered.beginReconciliation(scope)).toBe(true);
      expect(reopened.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'RECONCILING' }]);
      expect(reopened.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    } finally { reopened.close(); }
    expect(execFileSync('git', ['-C', item.project, 'status', '--porcelain'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe('');
  } finally {
    try {
      try { drafts.discard(draftId); }
      finally {
        try { client?.dispose(); }
        finally {
          try { if (transport) await transport.stop(); }
          finally { item.db.close(); }
        }
      }
    } finally {
      try {
        let cleanupFailed = false;
        for (const [ref, key] of keys) {
          try { if (await addon.cleanup(ref, key) !== true) cleanupFailed = true; }
          catch { cleanupFailed = true; }
          finally { key.fill(0); }
        }
        expect(cleanupFailed).toBe(false);
      } finally { rmSync(item.folder, { recursive: true, force: true }); }
    }
  }
}, 120000);

test('read-only observation uses the original protected Attempt and keeps its Lease', async () => {
  const item = await fixture('Write the approved change');
  const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
  let child: ReturnType<typeof spawn> | undefined;
  let changedAccountChild: ReturnType<typeof spawn> | undefined;
  let unsupportedChild: ReturnType<typeof spawn> | undefined;
  let reader: ReadOnlyAppServerClient | undefined;
  let changedAccountReader: ReadOnlyAppServerClient | undefined;
  let unsupportedReader: ReadOnlyAppServerClient | undefined;
  try {
    vi.mocked(presentProtectedConsent).mockReset().mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatch = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, _unknown, record) => ({
      async initialize() {},
      async start(cwd) { const receipt = { threadId: 'thread-1', turnId: 'turn-1', cwd, principalHash: principal }; if (!record(receipt)) throw new Error('receipt'); return receipt; },
      async interrupt() { return true; }, async stop() { return 'UNVERIFIED_TERMINATION' as const; }, dispose() {}
    }));
    const started = await dispatch.start(item.scope);
    vi.mocked(presentProtectedCancellation).mockReset().mockResolvedValue(true);
    expect(await dispatch.cancel(item.scope)).toBe('UNKNOWN');
    const fixturePath = join(process.cwd(), 'packages/codex-adapter/tests/fixtures/execution-app-server.mjs');
    changedAccountChild = spawn(process.execPath, [fixturePath, 'account-switch'], { cwd: started.cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    changedAccountReader = new ReadOnlyAppServerClient(changedAccountChild, 15000);
    await changedAccountReader.discover('0.121.0');
    const coordinator = new ProtectedAttemptObserver(item.authority);
    expect(await coordinator.observe(item.scope, changedAccountReader)).toBeNull();
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'UNKNOWN' });
    unsupportedChild = spawn(process.execPath, [fixturePath, 'normal'], { cwd: started.cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    unsupportedReader = new ReadOnlyAppServerClient(unsupportedChild, 15000);
    await unsupportedReader.discover('0.121.0');
    expect(await coordinator.observe(item.scope, unsupportedReader)).toBeNull();
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'RECONCILING' });
    child = spawn(process.execPath, [fixturePath, 'reconcile'], { cwd: started.cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    reader = new ReadOnlyAppServerClient(child, 15000);
    await reader.discover('0.121.0');
    const request = coordinator.observe(item.scope, reader);
    expect(coordinator.observe(item.scope, reader)).toBe(request);
    expect(await coordinator.observe(item.scope, changedAccountReader)).toBeNull();
    const result = await request;
    expect(result).toEqual({ attemptId: original.attemptId, observation: 'OBSERVED_COMPLETED' });
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'RECONCILING' }]);
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    expect(item.db.prepare('SELECT COUNT(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    expect(await coordinator.observe({ ...item.scope, extra: 'forbidden' } as typeof item.scope, reader)).toBeNull();
    const keysBeforeLoss = [...item.vault.values.entries()];
    const observeBeforeLoss = reader.observeTurn.bind(reader);
    const keyLossSpy = vi.spyOn(reader, 'observeTurn').mockImplementation(async (...args) => {
      const observed = await observeBeforeLoss(...args);
      item.vault.values.clear();
      return observed;
    });
    expect(await coordinator.observe(item.scope, reader)).toBeNull();
    keyLossSpy.mockRestore();
    for (const [ref, key] of keysBeforeLoss) item.vault.values.set(ref, key);
    const verify = reader.verifyRecoveryPrincipal.bind(reader);
    let checks = 0;
    const verifySpy = vi.spyOn(reader, 'verifyRecoveryPrincipal').mockImplementation(async () => ++checks === 2 ? false : verify());
    expect(await coordinator.observe(item.scope, reader)).toBeNull();
    verifySpy.mockRestore();
    checks = 0;
    const stateSpy = vi.spyOn(reader, 'verifyRecoveryPrincipal').mockImplementation(async () => {
      const valid = await verify();
      if (++checks === 2) item.db.prepare("UPDATE execution_attempts SET state='UNKNOWN' WHERE attempt_id=?").run(original.attemptId);
      return valid;
    });
    expect(await coordinator.observe(item.scope, reader)).toBeNull();
    stateSpy.mockRestore();
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'UNKNOWN' });
    expect(await item.authority.beginReconciliation(item.scope)).toBe(true);
    // Simulate a malicious writer bypassing Lease guards in this in-memory fixture only.
    item.db.exec('DROP TRIGGER protected_lease_no_unverified_release; DROP TRIGGER protected_lease_no_resurrection');
    checks = 0;
    const leaseSpy = vi.spyOn(reader, 'verifyRecoveryPrincipal').mockImplementation(async () => {
      const valid = await verify();
      if (++checks === 2) item.db.prepare("UPDATE resource_leases SET state='RELEASED' WHERE attempt_id=?").run(original.attemptId);
      return valid;
    });
    expect(await coordinator.observe(item.scope, reader)).toBeNull();
    leaseSpy.mockRestore();
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'RELEASED' });
    item.db.prepare("UPDATE resource_leases SET state='ACTIVE' WHERE attempt_id=?").run(original.attemptId);
    const originalTag = (item.db.prepare('SELECT auth_tag FROM protected_start_receipts WHERE attempt_id=?').get(original.attemptId) as { auth_tag: Buffer }).auth_tag;
    const tamperedTag = Buffer.from(originalTag); tamperedTag[0] = tamperedTag.readUInt8(0) ^ 1;
    // This in-memory fixture deliberately simulates a writer bypassing the immutable-row trigger.
    item.db.exec('DROP TRIGGER protected_start_receipt_no_update');
    const observe = reader.observeTurn.bind(reader);
    const observeSpy = vi.spyOn(reader, 'observeTurn').mockImplementation(async (...args) => {
      const observed = await observe(...args);
      item.db.prepare('UPDATE protected_start_receipts SET auth_tag=? WHERE attempt_id=?').run(tamperedTag, original.attemptId);
      return observed;
    });
    expect(await coordinator.observe(item.scope, reader)).toBeNull();
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'RECONCILING' }]);
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    observeSpy.mockRestore();
    item.db.prepare('UPDATE protected_start_receipts SET auth_tag=? WHERE attempt_id=?').run(originalTag, original.attemptId);
    expect(await item.authority.readReceipt(item.scope)).not.toBeNull();
    const savedKeys = [...item.vault.values.entries()];
    item.vault.values.clear();
    expect(await coordinator.observe(item.scope, reader)).toBeNull();
    for (const [ref, key] of savedKeys) item.vault.values.set(ref, key);
    checks = 0;
    const closedSpy = vi.spyOn(reader, 'verifyRecoveryPrincipal').mockImplementation(async () => {
      const valid = await verify();
      if (++checks === 2) reader!.dispose();
      return valid;
    });
    expect(await coordinator.observe(item.scope, reader)).toBeNull();
    closedSpy.mockRestore();
  } finally {
    unsupportedReader?.dispose();
    if (unsupportedChild && unsupportedChild.exitCode === null && unsupportedChild.signalCode === null) { const closed = once(unsupportedChild, 'exit'); unsupportedChild.kill(); await closed; }
    changedAccountReader?.dispose();
    if (changedAccountChild && changedAccountChild.exitCode === null && changedAccountChild.signalCode === null) { const closed = once(changedAccountChild, 'exit'); changedAccountChild.kill(); await closed; }
    reader?.dispose();
    if (child && child.exitCode === null && child.signalCode === null) { const closed = once(child, 'exit'); child.kill(); await closed; }
    item.db.close();
    rmSync(item.folder, { recursive: true, force: true });
  }
}, 60000);

test('fixture cancellation rejects a different scope and dismissed consent without signalling the original client', async () => {
  const item = await fixture('Write the approved change');
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let signals = 0;
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, _unknown, record) => ({
      async initialize() {},
      async start(cwd) { const receipt = { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal }; if (!record(receipt)) throw new Error('receipt'); return receipt; },
      async interrupt() { signals++; return true; },
      async stop() { signals++; return 'UNVERIFIED_TERMINATION' as const; },
      dispose() {}
    }));
    await dispatcher.start(item.scope);
    vi.mocked(presentProtectedCancellation).mockReset().mockResolvedValue(false);
    expect(await dispatcher.cancel({ ...item.scope, proposalVersionId: 'other' })).toBe('UNAVAILABLE');
    expect(vi.mocked(presentProtectedCancellation)).not.toHaveBeenCalled();
    expect(await dispatcher.cancel(item.scope)).toBe('DISMISSED');
    expect(signals).toBe(0);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'RUNNING' }]);
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('concurrent fixture cancellations prompt once and stop once even when interruption fails', async () => {
  const item = await fixture('Write the approved change');
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let interrupts = 0, stops = 0;
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, _unknown, record) => ({
      async initialize() {},
      async start(cwd) { const receipt = { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal }; if (!record(receipt)) throw new Error('receipt'); return receipt; },
      async interrupt() { interrupts++; throw new Error('lost interrupt'); },
      async stop() { stops++; return 'UNVERIFIED_TERMINATION' as const; },
      dispose() {}
    }));
    await dispatcher.start(item.scope);
    vi.mocked(presentProtectedCancellation).mockReset().mockResolvedValue(true);
    expect(await Promise.all([dispatcher.cancel(item.scope), dispatcher.cancel(item.scope)])).toEqual(['UNKNOWN', 'UNKNOWN']);
    expect(vi.mocked(presentProtectedCancellation)).toHaveBeenCalledTimes(1);
    expect([interrupts, stops]).toEqual([1, 1]);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('a nonresponsive fixture stop is bounded and cannot release the original Lease', async () => {
  const item = await fixture('Write the approved change');
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, _unknown, record) => ({
      async initialize() {},
      async start(cwd) { const receipt = { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal }; if (!record(receipt)) throw new Error('receipt'); return receipt; },
      async interrupt() { return true; },
      async stop() { return new Promise<'UNKNOWN'>(() => {}); },
      dispose() {}
    }));
    await dispatcher.start(item.scope);
    vi.mocked(presentProtectedCancellation).mockReset().mockResolvedValue(true);
    const started = Date.now();
    expect(await dispatcher.cancel(item.scope)).toBe('UNKNOWN');
    expect(Date.now() - started).toBeLessThan(20000);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 40000);

test('a fake acknowledged Turn persists encrypted receipt and quarantines the original Attempt when its process exits', async () => {
  const item = await fixture('Write the approved change');
  let child: ReturnType<typeof spawn> | undefined;
  let client: AppServerExecutionClient | undefined;
  let closed: Promise<unknown> | undefined;
  let reopened: Database.Database | undefined;
  let observerChild: ReturnType<typeof spawn> | undefined;
  let observerClosed: Promise<unknown> | undefined;
  let observer: ReadOnlyAppServerClient | undefined;
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principalHash = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const path = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principalHash, (version, onUnknown, recordStart) => {
      child = spawn(process.execPath, [path, 'normal'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      closed = once(child, 'close');
      client = new AppServerExecutionClient(child, version, principalHash, async () => true, onUnknown, recordStart);
      return client;
    });
    const dispatched = await dispatcher.start(item.scope);
    const isolated = { path: dispatched.cwd };
    const receipt = dispatched.receipt;
    expect(dispatched.attemptId).toBe(original.attemptId);
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'RUNNING' });
    expect(await item.authority.readReceipt(item.scope)).toEqual({ attemptId: original.attemptId, ...receipt });
    vi.mocked(presentProtectedCancellation).mockResolvedValue(true);
    expect(await item.authority.requestCancellation(item.scope)).toBe('STARTED');
    expect(await item.authority.requestCancellation(item.scope)).toBe('ALREADY_CANCELLING');
    expect(await client!.interrupt()).toBe(true);
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'CANCELLING' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    if (!child!.stdin) throw new Error('fixture stdin unavailable');
    child!.stdin!.end();
    await closed;
    expect(client!.status()).toBe('UNKNOWN');
    expect(client!.unknownNotificationFailed()).toBe(false);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all())
      .toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state FROM outbox').get()).toEqual({ state: 'ACKNOWLEDGED' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    expect(await item.authority.readReceipt(item.scope)).toEqual({ attemptId: original.attemptId, ...receipt });
    expect(execFileSync('git', ['-C', item.project, 'status', '--porcelain'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe('');
    const backup = join(item.folder, 'recovery.sqlite');
    await item.db.backup(backup);
    reopened = new Database(backup, { fileMustExist: true });
    const recovery = new ProtectedProposalAuthority(reopened, item.vault, () => '2026-08-01T00:00:00.000Z');
    expect(await recovery.beginReconciliation(item.scope)).toBe(true);
    const recovered = await recovery.readReceipt(item.scope);
    expect(recovered).toEqual({ attemptId: original.attemptId, ...receipt });
    if (!recovered) throw new Error('receipt unavailable');
    observerChild = spawn(process.execPath, [path, 'reconcile'], { cwd: isolated.path, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    observerClosed = once(observerChild, 'close');
    observer = new ReadOnlyAppServerClient(observerChild);
    await observer.discover('0.121.0');
    expect(observer.recoveryPrincipal()).toBe(recovered.principalHash);
    expect(await observer.observeTurn(recovered.threadId, recovered.turnId, recovered.cwd)).toBe('COMPLETED');
    expect(await observer.verifyRecoveryPrincipal()).toBe(true);
    expect(reopened.prepare('SELECT attempt_id,state FROM execution_attempts').all())
      .toEqual([{ attempt_id: original.attemptId, state: 'RECONCILING' }]);
    expect(reopened.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally {
    observer?.dispose();
    if (observerChild?.stdin && !observerChild.stdin.destroyed) observerChild.stdin.end();
    if (observerClosed) await observerClosed;
    reopened?.close();
    client?.dispose();
    if (child?.stdin && !child.stdin.destroyed) child.stdin.end();
    if (closed) await closed;
    item.db.close();
    rmSync(item.folder, { recursive: true, force: true });
  }
}, 45000);

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

test('a worktree failure after claim quarantines the original Attempt without releasing its Lease', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, item.executable, principal, () => { throw new Error('fixture must not launch'); });
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'RECONCILING', claim_token: null });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('caller scope mutation after claim cannot redirect quarantine from the original Attempt', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const supplied = { ...item.scope };
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { GitWorktreeService } = await import('../../src/main/worktree-service.js');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const worktree = vi.spyOn(GitWorktreeService.prototype, 'create').mockImplementation(() => {
      supplied.proposalVersionId = 'other-proposal';
      throw new Error('fixture worktree failed');
    });
    try {
      const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, () => { throw new Error('must not launch'); });
      await expect(dispatcher.start(supplied)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
      expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
      expect(item.db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'RECONCILING', claim_token: null });
      expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    } finally { worktree.mockRestore(); }
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('a fixture transport cannot report success without persisting its start receipt', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, () => ({
      async initialize() {},
      async start(cwd) { return { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal }; },
      dispose() {}
    }));
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT count(*) AS n FROM protected_start_receipts').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('an UNKNOWN notification during initialization prevents a later fake start', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let starts = 0;
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, onUnknown) => ({
      async initialize() { onUnknown(); },
      async start(cwd) { starts += 1; return { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal }; },
      dispose() {}
    }));
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(starts).toBe(0);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('Agent becoming unavailable during fixture initialization prevents fake start and preserves the original Attempt', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let starts = 0;
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, _onUnknown, record) => ({
      async initialize() { item.db.exec("UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'"); },
      async start(cwd) {
        starts += 1;
        const receipt = { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal };
        if (!record(receipt)) throw new Error('record failed');
        return receipt;
      },
      dispose() {}
    }));
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(starts).toBe(0);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('Agent becoming unavailable after worktree creation prevents even fake transport creation', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const prepare = item.authority.prepareReceipt.bind(item.authority);
    vi.spyOn(item.authority, 'prepareReceipt').mockImplementation(async (...args) => {
      const writer = await prepare(...args);
      item.db.exec("UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'");
      return writer;
    });
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let factories = 0;
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, () => {
      factories += 1;
      throw new Error('fixture must not launch');
    });
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(factories).toBe(0);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test.each([
  ['Agent', "UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'"],
  ['Project', "UPDATE projects SET row_version=row_version+1 WHERE project_id='p'"],
  ['Function', "UPDATE functions SET function_version='2' WHERE agent_id='agent'"],
  ['Grant', "UPDATE authorization_grants SET status='REVOKED'"]
])('%s change before fake receipt cannot mark the original Attempt RUNNING', async (_name, sql) => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, _onUnknown, record) => ({
      async initialize() {},
      async start(cwd) {
        item.db.exec(sql);
        const receipt = { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal };
        if (!record(receipt)) throw new Error('stale receipt');
        return receipt;
      },
      dispose() {}
    }));
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT count(*) AS n FROM protected_start_receipts').get()).toEqual({ n: 0 });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('Lease expiry before a fake receipt records the observed deadline and preserves UNKNOWN', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(item.db, item.vault, () => now);
    const original = await authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(authority, join(item.folder, 'worktrees'), principal, (_version, _onUnknown, record) => ({
      async initialize() {},
      async start(cwd) {
        now = '2026-08-01T00:00:31.000Z';
        const receipt = { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal };
        if (!record(receipt)) throw new Error('expired receipt');
        return receipt;
      },
      dispose() {}
    }));
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT state,last_observed_at FROM resource_leases').get()).toEqual({ state: 'ACTIVE', last_observed_at: '2026-08-01T00:00:31.000Z' });
    expect(item.db.prepare('SELECT count(*) AS n FROM protected_start_receipts').get()).toEqual({ n: 0 });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('a failure after receipt persistence quarantines the same running Attempt', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, _onUnknown, record) => ({
      async initialize() {},
      async start(cwd) {
        if (!record({ threadId: 'thread', turnId: 'turn', cwd, principalHash: principal })) throw new Error('record failed');
        throw new Error('lost response after receipt');
      },
      dispose() {}
    }));
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_OUTCOME_UNKNOWN');
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(item.db.prepare('SELECT state FROM outbox').get()).toEqual({ state: 'ACKNOWLEDGED' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    expect((await item.authority.readReceipt(item.scope))?.attemptId).toBe(original.attemptId);
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('a later UNKNOWN persistence failure remains observable after a saved receipt', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    await item.authority.confirmAndQueue(item.scope);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let notifyUnknown = () => false;
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, join(item.folder, 'worktrees'), principal, (_version, onUnknown, record) => {
      notifyUnknown = onUnknown;
      return {
        async initialize() {},
        async start(cwd) { const receipt = { threadId: 'thread', turnId: 'turn', cwd, principalHash: principal }; if (!record(receipt)) throw new Error('record failed'); return receipt; },
        dispose() {}
      };
    });
    await dispatcher.start(item.scope);
    item.db.exec('BEGIN IMMEDIATE');
    try { expect(notifyUnknown()).toBe(false); expect(dispatcher.state).toBe('PERSISTENCE_FAILED'); }
    finally { item.db.exec('ROLLBACK'); }
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'RUNNING' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
  } finally { item.db.close(); rmSync(item.folder, { recursive: true, force: true }); }
}, 30000);

test('a failed quarantine after claim is reported rather than declared safe', async () => {
  const item = await fixture();
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    await item.authority.confirmAndQueue(item.scope);
    vi.spyOn(item.authority, 'quarantineClaim').mockReturnValue(false);
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const { FixtureProtectedDispatch } = await import('../../src/main/fixture-protected-dispatch.js');
    const dispatcher = new FixtureProtectedDispatch(item.authority, item.executable, principal, () => { throw new Error('fixture must not launch'); });
    await expect(dispatcher.start(item.scope)).rejects.toThrow('FIXTURE_QUARANTINE_FAILED');
    expect(item.db.prepare('SELECT state FROM outbox').get()).toEqual({ state: 'DISPATCHING' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
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
