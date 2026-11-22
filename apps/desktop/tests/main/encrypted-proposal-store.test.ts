import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { expect, test, vi } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from '../../src/main/reserved-payload-service.js';
import { EncryptedProposalStore } from '../../src/main/encrypted-proposal-store.js';
import { ImmutableProposalConfirmation } from '../../src/main/immutable-proposal-confirmation.js';

const candidate = {
  objective: 'private business objective', workspaceId: 'w', projectId: 'p', agentId: 'agent', functionId: 'function',
  projectSnapshotVersion: '1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1',
  baselineCommit: 'a'.repeat(40), createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
  budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'code', version: '1' }],
  workItems: [{ id: 'work', projectId: 'p', agentId: 'agent', functionId: 'function', objective: 'private business objective', required: true as const, dependencies: [] }],
  resources: [{ key: 'project:p', intent: 'WRITE' as const }], allowedActions: ['FILE_WRITE' as const],
  forbiddenActions: [], reconfirmationTriggers: ['change'], risk: 'HIGH' as const,
  acceptanceCriteria: [{ criterion: 'private acceptance condition', evidence: 'test log' }]
};
const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'proposal-1' };
class Vault implements ReservedVault {
  values = new Map<string, Buffer>(); writes = 0;
  async create(ref: string): Promise<Buffer> {
    if (this.values.has(ref)) throw new Error('duplicate');
    this.writes++; const key = randomBytes(32); this.values.set(ref, Buffer.from(key)); return key;
  }
  async read(ref: string): Promise<Buffer | null> { const value = this.values.get(ref); return value ? Buffer.from(value) : null; }
}
function fixture() {
  const db = new Database(':memory:'); applyMigrations(db);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/fixture','e:/fixture','ACTIVE',NULL,1,'2026','2026',1)").run();
  const vault = new Vault(); const journal = new ProtectedKeyReservations(db);
  return { db, vault, journal, store: new EncryptedProposalStore(new ReservedPayloadService(db, journal, vault)) };
}
test('persists and reopens the exact full Proposal without plaintext legacy records', async () => {
  const { db, vault, store } = fixture(); let reopened: Database.Database | undefined;
  try {
    const proposal = createH1ReviewedProposal(scope.proposalVersionId, candidate);
    await store.save(scope, proposal);
    expect(db.serialize().includes(Buffer.from(candidate.objective))).toBe(false);
    expect(db.serialize().includes(Buffer.from(candidate.acceptanceCriteria[0]!.criterion))).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM proposal_versions').get()).toEqual({ n: 0 });
    reopened = new Database(db.serialize());
    const read = new EncryptedProposalStore(new ReservedPayloadService(reopened, new ProtectedKeyReservations(reopened), vault));
    expect(await read.read(scope)).toEqual(proposal);
    expect(vault.writes).toBe(1);
  } finally { reopened?.close(); db.close(); }
});
test('reopens an on-disk WAL database without storing Proposal text in the database or WAL', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-proposal-wal-'));
  const path = join(folder, 'control.sqlite');
  const db = createFoundationDatabase(path); let reopened: Database.Database | undefined;
  try {
    db.pragma('journal_mode = WAL'); db.pragma('wal_autocheckpoint = 0'); applyMigrations(db);
    db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
    db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/fixture','e:/fixture','ACTIVE',NULL,1,'2026','2026',1)").run();
    const vault = new Vault();
    const store = new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault));
    const proposal = createH1ReviewedProposal(scope.proposalVersionId, candidate);
    await store.save(scope, proposal);
    expect(existsSync(path + '-wal')).toBe(true);
    for (const file of [path, path + '-wal']) {
      const bytes = readFileSync(file);
      expect(bytes.includes(Buffer.from(candidate.objective))).toBe(false);
      expect(bytes.includes(Buffer.from(candidate.acceptanceCriteria[0]!.criterion))).toBe(false);
    }
    reopened = new Database(path);
    const reader = new EncryptedProposalStore(new ReservedPayloadService(reopened, new ProtectedKeyReservations(reopened), vault));
    expect(await reader.read(scope)).toEqual(proposal);
    expect(vault.writes).toBe(1);
  } finally { reopened?.close(); db.close(); rmSync(folder, { recursive: true, force: true }); }
});
test('rejects inconsistent Proposal, altered digest, extra fields and wrong scope before key creation', async () => {
  const { db, vault, store } = fixture();
  try {
    const proposal = createH1ReviewedProposal(scope.proposalVersionId, candidate);
    await expect(store.save(scope, { ...proposal, digest: 'sha256:' + '0'.repeat(64) })).rejects.toThrow();
    await expect(store.save(scope, { ...proposal, objective: 'different' })).rejects.toThrow();
    await expect(store.save(scope, { ...proposal, unexpected: 'field' })).rejects.toThrow();
    await expect(store.save(scope, { ...proposal, unexpected: undefined })).rejects.toThrow();
    await expect(store.save({ ...scope, workspaceId: 'other' }, proposal)).rejects.toThrow();
    expect(vault.writes).toBe(0);
  } finally { db.close(); }
});
test('captures a full immutable snapshot before awaiting vault work', async () => {
  const { db, vault, store } = fixture();
  const originalCreate = vault.create.bind(vault);
  let proceed: (() => void) | undefined;
  let signal: (() => void) | undefined;
  const started = new Promise<void>(resolve => { signal = resolve; });
  vault.create = async ref => { await new Promise<void>(resolve => { proceed = resolve; signal?.(); }); return originalCreate(ref); };
  try {
    const proposal = createH1ReviewedProposal(scope.proposalVersionId, candidate);
    const expected = JSON.parse(JSON.stringify(proposal));
    const pending = store.save(scope, proposal);
    await started;
    if (!proposal.fullReview) throw new Error('missing review');
    proposal.fullReview.acceptanceCriteria[0]!.criterion = 'changed after submission';
    proceed?.();
    await pending;
    expect(await store.read(scope)).toEqual(expected);
    expect(vault.writes).toBe(1);
  } finally { db.close(); }
});
test('duplicate identity and tampered ciphertext fail without creating a second key', async () => {
  const { db, vault, store } = fixture();
  try {
    const proposal = createH1ReviewedProposal(scope.proposalVersionId, candidate);
    await store.save(scope, proposal);
    await expect(store.save(scope, proposal)).rejects.toThrow();
    expect(vault.writes).toBe(1);
    expect(await store.read({ ...scope, projectId: 'other' })).toBeNull();
    db.exec('DROP TRIGGER protected_payloads_no_update');
    db.prepare("UPDATE protected_payloads SET ciphertext=x'00'").run();
    expect(await store.read(scope)).toBeNull();
  } finally { db.close(); }
});
test('reconciles an interrupted link without another key or a new Task', async () => {
  const { db, vault, journal, store } = fixture();
  vi.spyOn(journal, 'markLinked').mockImplementation(() => { throw new Error('simulated interruption'); });
  try {
    const proposal = createH1ReviewedProposal(scope.proposalVersionId, candidate);
    await expect(store.save(scope, proposal)).rejects.toThrow();
    vi.restoreAllMocks();
    expect(await store.reconcile(scope)).toBe('LINKED');
    expect(await store.read(scope)).toEqual(proposal);
    expect(vault.writes).toBe(1);
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 0 });
  } finally { vi.restoreAllMocks(); db.close(); }
});
test('does not return or semantically accept authenticated non-Proposal content', async () => {
  const { db, vault, journal, store } = fixture();
  vi.spyOn(journal, 'markLinked').mockImplementation(() => { throw new Error('simulated interruption'); });
  try {
    const payloads = new ReservedPayloadService(db, journal, vault);
    await expect(payloads.create({ workspaceId: 'w', projectId: 'p', recordId: scope.proposalVersionId, kind: 'PROPOSAL' }, '{}')).rejects.toThrow();
    vi.restoreAllMocks();
    expect(journal.inspect({ workspaceId: 'w', projectId: 'p', recordId: scope.proposalVersionId })).toBe('PAYLOAD_PRESENT_UNCONFIRMED');
    expect(await store.reconcile(scope)).toBe('UNRESOLVED');
    expect(journal.inspect({ workspaceId: 'w', projectId: 'p', recordId: scope.proposalVersionId })).toBe('LINKED');
    expect(await store.read(scope)).toBeNull();
    expect(vault.writes).toBe(1);
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
  } finally { vi.restoreAllMocks(); db.close(); }
});
test('confirmation displays the encrypted exact Proposal and rejects a changed envelope while open', async () => {
  const { db, store } = fixture();
  try {
    const now = Date.now();
    const timed = { ...candidate, createdAt: new Date(now - 1000).toISOString(),
      expiresAt: new Date(now + 60000).toISOString(), deadlineAt: new Date(now + 60000).toISOString() };
    const proposal = createH1ReviewedProposal(scope.proposalVersionId, timed);
    await store.save(scope, proposal);
    let shown = '';
    const confirm = new ImmutableProposalConfirmation(id => id === scope.proposalVersionId ? store.read(scope) : null,
      async text => { shown = text; return true; });
    expect(await confirm.confirm(scope.proposalVersionId, proposal.digest)).toBe(true);
    expect(JSON.parse(shown)).toEqual(proposal.fullReview);
    const changed = new ImmutableProposalConfirmation(id => id === scope.proposalVersionId ? store.read(scope) : null, async () => {
      db.exec('DROP TRIGGER protected_payloads_no_update');
      db.prepare("UPDATE protected_payloads SET ciphertext=x'00'").run();
      return true;
    });
    expect(await changed.confirm(scope.proposalVersionId, proposal.digest)).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
