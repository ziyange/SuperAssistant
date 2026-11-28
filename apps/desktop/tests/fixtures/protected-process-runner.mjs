import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { setInterval } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { createFoundationDatabaseAsync } from '@super-assistant/persistence';
import { ReadOnlyAppServerClient } from '@super-assistant/codex-adapter';
import { AppServerExecutionClient } from '../../../../packages/codex-adapter/dist/app-server-execution-client.js';
import { ProtectedKeyReservations } from '../../dist/main/protected-key-reservations.js';
import { ReservedPayloadService } from '../../dist/main/reserved-payload-service.js';
import { EncryptedProposalStore } from '../../dist/main/encrypted-proposal-store.js';
import { ProtectedProposalRegistry } from '../../dist/main/protected-proposal-registry.js';
import { ProtectedProposalAuthority } from '../../dist/main/protected-proposal-authority.js';
import { ProtectedAttemptObserver } from '../../dist/main/protected-attempt-observer.js';
import { WindowsNativeVault } from '../../dist/main/windows-native-vault.js';
import { InProcessOwnerTransport } from '../../dist/main/inprocess-owner-transport.js';
import { FixtureProtectedDispatch } from '../../dist/main/fixture-protected-dispatch.js';
import { provisionBuiltinCodexFunction, builtinCodexFunctionId } from '../../dist/main/local-codex-function.js';
import { projectGitEnvironment } from '../../dist/main/project-git-baseline.js';

if (process.env.SA_PROTECTED_PROCESS_FIXTURE !== '1' || process.platform !== 'win32') throw new Error('Windows fixture only');
const [phase, folder] = process.argv.slice(2);
if (!folder || !['produce-claimed', 'produce-ack', 'observe', 'observe-other', 'observe-offline', 'observe-closed'].includes(phase)) throw new Error('Invalid fixture invocation');
const addon = createRequire(import.meta.url)(fileURLToPath(new URL('../../native/build/Release/wincred_test.node', import.meta.url)));
const clock = () => '2026-08-01T00:00:00.000Z';
const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
const path = join(folder, 'control.sqlite');
const ownerPath = join(folder, 'owned-keys.json');
const producing = phase.startsWith('produce-');
let created = 0;
const owned = [];
const vault = new WindowsNativeVault({
  async create(ref) {
    created++;
    if (!producing) throw new Error('Recovery cannot create a key');
    const entry = { ref, digest: null }; owned.push(entry);
    writeFileSync(ownerPath, JSON.stringify(owned), { mode: 0o600 });
    const key = await addon.create(ref);
    entry.digest = createHash('sha256').update(key).digest('hex');
    writeFileSync(ownerPath, JSON.stringify(owned), { mode: 0o600 });
    process.stdout.write('FIXTURE_KEY ' + JSON.stringify(entry) + '\n');
    return key;
  },
  async read(ref) { return await addon.read(ref); }
});

function monitorWrites(stream) {
  const methods = [], original = stream.write.bind(stream);
  let pending = '';
  stream.write = function (chunk, ...args) {
    pending += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (pending.length > 1048576) throw new Error('Fixture frame limit');
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      const frame = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1);
      if (typeof frame.method === 'string') methods.push(frame.method);
    }
    return original(chunk, ...args);
  };
  return methods;
}

const db = await createFoundationDatabaseAsync(path);
if (producing) {
  const project = join(folder, 'project'), env = projectGitEnvironment();
  execFileSync('git', ['init', '--quiet', project], { env, windowsHide: true });
  execFileSync('git', ['-C', project, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'initial'], { env, windowsHide: true });
  const head = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { env, windowsHide: true, encoding: 'utf8' }).trim();
  db.exec("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1); INSERT INTO agents VALUES ('agent','w','Codex','0.121.0','CONNECTED','AVAILABLE',NULL,1)");
  db.prepare("INSERT INTO projects VALUES ('p','w','Project',?,?,'ACTIVE','agent',1,'2026','2026',1)").run(realpathSync(project), realpathSync(project).toLowerCase());
  db.prepare("INSERT INTO local_codex_registrations VALUES ('w','agent',?,'0.121.0','2026')").run(realpathSync(process.execPath));
  provisionBuiltinCodexFunction(db, 'w', 'agent', '0.121.0');
  const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'process-' + randomUUID() };
  const functionId = builtinCodexFunctionId('agent'), objective = 'Write the approved change';
  const proposal = createH1ReviewedProposal(scope.proposalVersionId, {
    objective, workspaceId: 'w', projectId: 'p', agentId: 'agent', functionId,
    projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1', baselineCommit: head,
    createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
    budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'codex-file-write', version: '1' }],
    workItems: [{ id: 'review-work', projectId: 'p', agentId: 'agent', functionId, objective, required: true, dependencies: [] }],
    resources: [{ key: 'project:p', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: [],
    reconfirmationTriggers: ['change'], risk: 'HIGH', acceptanceCriteria: [{ criterion: 'Fixture result', evidence: 'Test evidence' }]
  });
  await new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault)).save(scope, proposal);
  await new ProtectedProposalRegistry(db, vault, clock).register(scope);
  const authority = new ProtectedProposalAuthority(db, vault, clock);
  const original = await authority.confirmAndQueue(scope);
  let cwd = project, methods = [], keepAlive = authority;
  if (phase === 'produce-claimed') await authority.claimQueued(scope);
  else {
    const ownerAddon = createRequire(import.meta.url)(fileURLToPath(new URL('../../native/build/Release/process_owner.node', import.meta.url)));
    const wrapper = fileURLToPath(new URL('../native/owned-execution-wrapper.mjs', import.meta.url));
    const dispatch = new FixtureProtectedDispatch(authority, join(folder, 'worktrees'), principal, (version, unknown, record, worktree) => {
      const transport = new InProcessOwnerTransport(ownerAddon.start(process.execPath, [wrapper, 'normal', folder], worktree));
      methods = monitorWrites(transport.stdin);
      return new AppServerExecutionClient(transport, version, principal, async () => true, unknown, record, 15000);
    });
    keepAlive = dispatch;
    cwd = (await dispatch.start(scope)).cwd;
  }
  const summary = { producerPid: process.pid, scope, attemptId: original.attemptId, cwd, project, head, methods };
  writeFileSync(join(folder, 'producer.json'), JSON.stringify(summary), { flag: 'wx', mode: 0o600 });
  process.stdout.write('PRODUCER_READY ' + JSON.stringify(summary) + '\n');
  // Parent forcibly terminates this process; no disposal or UNKNOWN callback runs.
  setInterval(() => { if (!keepAlive) throw new Error('Fixture owner lost'); }, 1000);
} else {
  const prior = JSON.parse(readFileSync(join(folder, 'producer.json'), 'utf8'));
  const authority = new ProtectedProposalAuthority(db, vault, clock);
  const server = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
  const ownerAddon = createRequire(import.meta.url)(fileURLToPath(new URL('../../native/build/Release/process_owner.node', import.meta.url)));
  const transport = new InProcessOwnerTransport(ownerAddon.start(process.execPath, [server, phase === 'observe-other' ? 'account-switch' : 'reconcile'], prior.cwd));
  const methods = monitorWrites(transport.stdin);
  const client = new ReadOnlyAppServerClient(transport, 15000);
  try {
    if (phase !== 'observe-offline' && phase !== 'observe-closed') await client.discover('0.121.0');
    if (phase === 'observe-closed') client.dispose();
    const observer = new ProtectedAttemptObserver(authority);
    const result = await observer.observe(prior.scope, client);
    const repeated = await observer.observe(prior.scope, client);
    process.stdout.write('RECOVERY_RESULT ' + JSON.stringify({ pid: process.pid, result, repeated, created, methods,
      attempts: db.prepare('SELECT attempt_id,state FROM execution_attempts').all(),
      grants: db.prepare('SELECT * FROM authorization_grants').all(),
      leases: db.prepare('SELECT * FROM resource_leases').all(),
      outbox: db.prepare('SELECT state,claim_token FROM outbox').all() }) + '\n');
  } finally {
    try { client.dispose(); await transport.stop(); } finally { db.close(); }
  }
}
