import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { expect, test } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { builtinCodexFunctionId, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from '../../src/main/reserved-payload-service.js';
import { EncryptedProposalStore } from '../../src/main/encrypted-proposal-store.js';
import { ProtectedProposalRegistry } from '../../src/main/protected-proposal-registry.js';

const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'proposal-1' };
class Vault implements ReservedVault {
  values = new Map<string, Buffer>();
  onRead: (() => void) | undefined;
  async create(ref: string) { const key = randomBytes(32); this.values.set(ref, Buffer.from(key)); return key; }
  async read(ref: string) { this.onRead?.(); const key = this.values.get(ref); return key ? Buffer.from(key) : null; }
}
async function setup() {
  const db = new Database(':memory:');
  applyMigrations(db);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO agents VALUES ('agent','w','Codex','0.121.0','CONNECTED','AVAILABLE',NULL,1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/fixture','e:/fixture','ACTIVE','agent',1,'2026','2026',1)").run();
  db.prepare("INSERT INTO local_codex_registrations VALUES ('w','agent','E:/fixture/codex.exe','0.121.0','2026')").run();
  provisionBuiltinCodexFunction(db, 'w', 'agent', '0.121.0');
  const functionId = builtinCodexFunctionId('agent');
  const proposal = createH1ReviewedProposal(scope.proposalVersionId, {
    objective: 'private objective', workspaceId: 'w', projectId: 'p', agentId: 'agent', functionId,
    projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1',
    baselineCommit: 'a'.repeat(40), createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
    budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'codex-file-write', version: '1' }],
    workItems: [{ id: 'work', projectId: 'p', agentId: 'agent', functionId, objective: 'private objective', required: true, dependencies: [] }],
    resources: [{ key: 'project:p', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: [],
    reconfirmationTriggers: ['change'], risk: 'HIGH', acceptanceCriteria: [{ criterion: 'private criterion', evidence: 'review' }]
  });
  const vault = new Vault();
  await new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault)).save(scope, proposal);
  return { db, vault, proposal, registry: new ProtectedProposalRegistry(db, vault, () => '2026-08-01T00:00:00.000Z') };
}

test('registers one authenticated binding idempotently without plaintext or authorization', async () => {
  const { db, registry } = await setup();
  try {
    expect((await Promise.all([registry.register(scope), registry.register(scope)])).sort()).toEqual(['EXISTING', 'REGISTERED']);
    expect(db.prepare('SELECT source_kind,workspace_id,project_id FROM proposal_authority_refs').all()).toEqual([{ source_kind: 'PROTECTED', workspace_id: 'w', project_id: 'p' }]);
    expect(db.prepare('SELECT proposal_version_id,payload_record_id FROM protected_proposal_bindings').all()).toEqual([{ proposal_version_id: 'proposal-1', payload_record_id: 'proposal-1' }]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    expect(db.serialize().includes(Buffer.from('private objective'))).toBe(false);
    expect(db.serialize().includes(Buffer.from('private criterion'))).toBe(false);
  } finally { db.close(); }
});

test.each([
  ['Project snapshot', "UPDATE projects SET snapshot_version=2 WHERE project_id='p'"],
  ['Project row version', "UPDATE projects SET row_version=row_version+1 WHERE project_id='p'"],
  ['Agent version', "UPDATE agents SET agent_version='0.122.0' WHERE agent_id='agent'"],
  ['Agent row version', "UPDATE agents SET row_version=row_version+1 WHERE agent_id='agent'"],
  ['Agent permission', "UPDATE agents SET connection='DISABLED',availability='PAUSED' WHERE agent_id='agent'"],
  ['Function lifecycle', "UPDATE functions SET lifecycle='DISABLED' WHERE agent_id='agent'"],
  ['Workspace owner', "UPDATE workspaces SET owner_id='other' WHERE workspace_id='w'"]
])('rejects a changed %s after vault access without leaving a binding', async (_label, mutation) => {
  const { db, vault, registry } = await setup();
  try {
    vault.onRead = () => { vault.onRead = undefined; db.exec(mutation); };
    await expect(registry.register(scope)).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM protected_proposal_bindings').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('rejects ciphertext replacement during vault access', async () => {
  const { db, vault, registry } = await setup();
  try {
    db.exec('DROP TRIGGER protected_payloads_no_update');
    vault.onRead = () => { vault.onRead = undefined; db.exec('UPDATE protected_payloads SET ciphertext=zeroblob(length(ciphertext))'); };
    await expect(registry.register(scope)).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('rolls back authority registration if binding insertion fails', async () => {
  const { db, registry } = await setup();
  try {
    db.exec("CREATE TRIGGER fail_fixture_binding BEFORE INSERT ON protected_proposal_bindings BEGIN SELECT RAISE(ABORT,'fixture'); END");
    await expect(registry.register(scope)).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM protected_proposal_bindings').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('rejects foreign scope and expired registration without changing authority', async () => {
  const { db, vault, registry } = await setup();
  try {
    await expect(registry.register({ ...scope, workspaceId: 'foreign' })).rejects.toThrow();
    await expect(new ProtectedProposalRegistry(db, vault, () => '2027-01-01T00:00:00.000Z').register(scope)).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('cannot register after the clock rolls back during vault authentication', async () => {
  const { db, vault } = await setup();
  try {
    let now = '2026-08-01T00:00:00.000Z';
    vault.onRead = () => { vault.onRead = undefined; now = '2026-07-01T00:00:00.000Z'; };
    await expect(new ProtectedProposalRegistry(db, vault, () => now).register(scope)).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('does not repair or replace an existing partial authority record', async () => {
  const { db, proposal, registry } = await setup();
  try {
    db.prepare("INSERT INTO proposal_authority_refs VALUES (?, ?, ?, 'PROTECTED', 1, ?)").run(scope.proposalVersionId, 'w', 'p', proposal.createdAt);
    await expect(registry.register(scope)).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM protected_proposal_bindings').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('does not accept or rewrite a conflicting existing protected binding', async () => {
  const { db, registry } = await setup();
  try {
    expect(await registry.register(scope)).toBe('REGISTERED');
    db.exec("DROP TRIGGER protected_proposal_bindings_immutable_update; UPDATE protected_proposal_bindings SET key_ref='pkey-' || printf('%064d',1)");
    await expect(registry.register(scope)).rejects.toThrow();
    expect(db.prepare('SELECT key_ref FROM protected_proposal_bindings').get()).toEqual({ key_ref: 'pkey-' + '0'.repeat(63) + '1' });
  } finally { db.close(); }
});

test('rejects extra scope fields before accessing vault material', async () => {
  const { db, vault, registry } = await setup();
  try {
    let accessed = false;
    vault.onRead = () => { accessed = true; };
    await expect(registry.register({ ...scope, unexpected: true } as typeof scope)).rejects.toThrow();
    expect(accessed).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('rejects an array disguised as a scope before accessing vault material', async () => {
  const { db, vault, registry } = await setup();
  try {
    let accessed = false;
    vault.onRead = () => { accessed = true; };
    const disguised = Object.assign([], scope);
    await expect(registry.register(disguised)).rejects.toThrow();
    expect(accessed).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM proposal_authority_refs').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
