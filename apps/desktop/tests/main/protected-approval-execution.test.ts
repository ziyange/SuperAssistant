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
import { ProtectedProposalRegistry } from '../../src/main/protected-proposal-registry.js';
import { presentProtectedCancellation, presentProtectedConsent } from '../../src/main/protected-native-consent.js';
import { projectGitEnvironment } from '../../src/main/project-git-baseline.js';
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
  await new ProtectedProposalRegistry(db, vault, () => '2026-08-01T00:00:00.000Z').register(scope);
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
