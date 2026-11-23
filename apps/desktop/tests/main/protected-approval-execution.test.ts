import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
import { presentProtectedCancellation, presentProtectedConsent } from '../../src/main/protected-native-consent.js';
import { projectGitEnvironment } from '../../src/main/project-git-baseline.js';
import { GitWorktreeService } from '../../src/main/worktree-service.js';
import { AppServerExecutionClient } from '../../../../packages/codex-adapter/src/app-server-execution-client.js';
import { ReadOnlyAppServerClient } from '../../../../packages/codex-adapter/src/app-server-client.js';

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
  db.prepare("INSERT INTO proposal_authority_refs VALUES (?, ?, ?, 'PROTECTED', 1, ?)").run(scope.proposalVersionId, 'w', 'p', proposal.createdAt);
  db.prepare(`INSERT INTO protected_proposal_bindings
    SELECT ?, 'PROTECTED', ?, ?, record_id, key_ref, 'PROPOSAL', 1, 'SAI_PROPOSAL_SHA256_V1'
    FROM protected_payloads WHERE record_id=?`).run(scope.proposalVersionId, 'w', 'p', scope.proposalVersionId);
  const authority = new ProtectedProposalAuthority(db, vault, () => '2026-08-01T00:00:00.000Z');
  return { folder, db, vault, scope, authority, commit, head, project, executable, proposal };
}

test('an accepted fake Turn with a lost reply quarantines the original Attempt in an isolated worktree', async () => {
  const item = await fixture('Write the approved change');
  let child: ReturnType<typeof spawn> | undefined;
  let client: AppServerExecutionClient | undefined;
  let closed: Promise<unknown> | undefined;
  try {
    vi.mocked(presentProtectedConsent).mockResolvedValue(true);
    const original = await item.authority.confirmAndQueue(item.scope);
    const task = item.db.prepare('SELECT task_id FROM tasks').get() as { task_id: string };
    const claimed = await item.authority.claimQueued(item.scope);
    expect(claimed.attemptId).toBe(original.attemptId);
    const input = { projectId: 'p', taskId: task.task_id, projectPath: item.project,
      worktreeRoot: join(item.folder, 'worktrees'), baselineCommit: item.head } as Parameters<GitWorktreeService['create']>[0];
    const isolated = new GitWorktreeService().create(input);
    expect(realpathSync(isolated.path)).not.toBe(realpathSync(item.project));
    expect(execFileSync('git', ['-C', isolated.path, 'rev-parse', 'HEAD'], { env: projectGitEnvironment(), encoding: 'utf8' }).trim()).toBe(item.head);
    const path = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
    child = spawn(process.execPath, [path, 'lost-turn'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    closed = once(child, 'close');
    if (!child.stdin) throw new Error('fixture stdin unavailable');
    const writes = vi.spyOn(child.stdin, 'write');
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    let receiptCount = 0;
    client = new AppServerExecutionClient(child, '0.121.0', principal, async () => true,
      () => item.authority.quarantineClaim(item.scope, claimed.claimToken),
      () => { receiptCount += 1; return false; });
    await client.initialize();
    await expect(client.start(isolated.path, item.proposal.objective)).rejects.toThrow();
    // The fixture exits successfully only after accepting the exact Turn request
    // in lost-turn mode; a protocol rejection leaves stdin open and does not exit.
    const serverExit = await Promise.race([closed, new Promise(resolve => setTimeout(() => resolve('timeout'), 3000))]);
    expect(serverExit).toEqual([0, null]);
    expect(client.status()).toBe('UNKNOWN');
    expect(client.unknownNotificationFailed()).toBe(false);
    expect(receiptCount).toBe(0);
    expect(writes.mock.calls.filter(call => String(call[0]).includes('"turn/start"'))).toHaveLength(1);
    expect(item.db.prepare('SELECT attempt_id,state FROM execution_attempts').all())
      .toEqual([{ attempt_id: original.attemptId, state: 'UNKNOWN' }]);
    expect(item.db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'RECONCILING', claim_token: null });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    await expect(item.authority.claimQueued(item.scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    await expect(client.start(isolated.path, item.proposal.objective)).rejects.toThrow();
    expect(writes.mock.calls.filter(call => String(call[0]).includes('"turn/start"'))).toHaveLength(1);
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
    const task = item.db.prepare('SELECT task_id FROM tasks').get() as { task_id: string };
    const claimed = await item.authority.claimQueued(item.scope);
    const input = { projectId: 'p', taskId: task.task_id, projectPath: item.project,
      worktreeRoot: join(item.folder, 'worktrees'), baselineCommit: item.head } as Parameters<GitWorktreeService['create']>[0];
    const isolated = new GitWorktreeService().create(input);
    const principalHash = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const writer = await item.authority.prepareReceipt(item.scope, claimed.claimToken, { cwd: isolated.path, principalHash });
    const path = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
    child = spawn(process.execPath, [path, 'normal'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    closed = once(child, 'close');
    client = new AppServerExecutionClient(child, '0.121.0', principalHash, async () => true,
      () => writer.markUnknown(), receipt => writer.record(receipt));
    await client.initialize();
    const receipt = await client.start(isolated.path, item.proposal.objective);
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'RUNNING' });
    expect(await item.authority.readReceipt(item.scope)).toEqual({ attemptId: original.attemptId, ...receipt });
    vi.mocked(presentProtectedCancellation).mockResolvedValue(true);
    expect(await item.authority.requestCancellation(item.scope)).toBe('STARTED');
    expect(await item.authority.requestCancellation(item.scope)).toBe('ALREADY_CANCELLING');
    expect(await client.interrupt()).toBe(true);
    expect(item.db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'CANCELLING' });
    expect(item.db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    if (!child.stdin) throw new Error('fixture stdin unavailable');
    child.stdin.end();
    await closed;
    expect(client.status()).toBe('UNKNOWN');
    expect(client.unknownNotificationFailed()).toBe(false);
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
    writer.dispose();
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
