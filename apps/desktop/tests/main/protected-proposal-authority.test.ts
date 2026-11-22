import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { expect, test, vi } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from '../../src/main/reserved-payload-service.js';
import { EncryptedProposalStore } from '../../src/main/encrypted-proposal-store.js';
import { ProtectedProposalAuthority } from '../../src/main/protected-proposal-authority.js';

const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'proposal-1' };
const candidate = {
  objective: 'confidential objective', workspaceId: 'w', projectId: 'p', agentId: 'agent', functionId: 'function',
  projectSnapshotVersion: '1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1',
  baselineCommit: 'a'.repeat(40), createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
  budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'code', version: '1' }],
  workItems: [{ id: 'work', projectId: 'p', agentId: 'agent', functionId: 'function', objective: 'confidential objective', required: true as const, dependencies: [] }],
  resources: [{ key: 'project:p', intent: 'WRITE' as const }], allowedActions: ['FILE_WRITE' as const], forbiddenActions: [],
  reconfirmationTriggers: ['change'], risk: 'HIGH' as const, acceptanceCriteria: [{ criterion: 'private criterion', evidence: 'test log' }]
};
class Vault implements ReservedVault {
  values = new Map<string, Buffer>();
  async create(ref: string) { const key = randomBytes(32); this.values.set(ref, Buffer.from(key)); return key; }
  async read(ref: string) { const key = this.values.get(ref); return key ? Buffer.from(key) : null; }
}
async function fixture() {
  const db = new Database(':memory:'); applyMigrations(db);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO agents VALUES ('agent','w','Codex','1','CONNECTED','AVAILABLE',NULL,1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/fixture','e:/fixture','ACTIVE','agent',1,'2026','2026',1)").run();
  db.prepare("INSERT INTO functions VALUES ('function','agent','implement','1','ACTIVE')").run();
  db.exec('CREATE TABLE marker (value TEXT NOT NULL)');
  const vault = new Vault();
  const store = new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault));
  const proposal = createH1ReviewedProposal(scope.proposalVersionId, candidate);
  await store.save(scope, proposal);
  const authority = new ProtectedProposalAuthority(db, vault, () => '2026-08-01T00:00:00.000Z');
  return { db, vault, proposal, authority };
}

test('checks the exact decrypted Proposal without exposing it or writing a Grant', async () => {
  const { db, authority } = await fixture();
  try {
    expect(await authority.check(scope)).toBe('CURRENT');
    expect(db.prepare('SELECT * FROM marker').all()).toEqual([]);
    expect(db.serialize().includes(Buffer.from(candidate.objective))).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM proposal_versions').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test.each([
  ['project', "UPDATE projects SET snapshot_version=2 WHERE project_id='p'"],
  ['project Agent assignment', "UPDATE projects SET default_agent_id=NULL WHERE project_id='p'"],
  ['agent', "UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'"],
  ['function', "UPDATE functions SET function_version='2' WHERE function_id='function'"],
  ['reservation', "UPDATE protected_key_reservations SET state='UNCERTAIN' WHERE record_id='proposal-1'"],
  ['envelope', "DROP TRIGGER protected_payloads_no_update; UPDATE protected_payloads SET ciphertext=x'00' WHERE record_id='proposal-1'"]
])('rejects %s changes made while decrypting', async (_name, sql) => {
  const { db, vault, authority } = await fixture();
  try {
    const original = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async input => { const result = await original(input); db.exec(sql); return result; });
    await expect(authority.check(scope)).rejects.toThrow();
    expect(db.prepare('SELECT * FROM marker').all()).toEqual([]);
  } finally { db.close(); }
});

test('rejects a caller-owned transaction without writes', async () => {
  const { db, authority } = await fixture();
  try {
    db.exec('BEGIN');
    await expect(authority.check(scope)).rejects.toThrow();
    db.exec('ROLLBACK');
    expect(db.prepare('SELECT * FROM marker').all()).toEqual([]);
  } finally { if (db.inTransaction) db.exec('ROLLBACK'); db.close(); }
});

test('fails closed for expired or mismatched scope', async () => {
  const { db, vault } = await fixture();
  try {
    const authority = new ProtectedProposalAuthority(db, vault, () => '2027-01-01T00:00:00.000Z');
    await expect(authority.check(scope)).rejects.toThrow();
    await expect(authority.check({ ...scope, projectId: 'other' })).rejects.toThrow();
  } finally { db.close(); }
});

test('a vault from another SQLite fixture cannot authenticate this envelope', async () => {
  const first = await fixture();
  const second = await fixture();
  try {
    const wrongVault = new ProtectedProposalAuthority(first.db, second.vault, () => '2026-08-01T00:00:00.000Z');
    await expect(wrongVault.check(scope)).rejects.toThrow();
    expect(first.db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 0 });
  } finally { second.db.close(); first.db.close(); }
});

test('captures the requested scope before awaiting the vault', async () => {
  const { db, vault, authority } = await fixture();
  try {
    let proceed!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>(resolve => { proceed = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const original = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async input => { entered(); await waiting; return original(input); });
    const mutable = { ...scope };
    const pending = authority.check(mutable);
    await started;
    mutable.projectId = 'other';
    proceed();
    expect(await pending).toBe('CURRENT');
  } finally { db.close(); }
});
