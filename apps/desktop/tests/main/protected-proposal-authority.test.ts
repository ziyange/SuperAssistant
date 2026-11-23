/* eslint-disable no-unused-vars -- callback parameter names document test boundary types. */
import { Buffer } from 'node:buffer';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import Database from 'better-sqlite3';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { beforeEach, expect, test, vi } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { SqliteOutboxRepository, SqliteResourceLeaseRepository } from '@super-assistant/persistence';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from '../../src/main/reserved-payload-service.js';
import { EncryptedProposalStore } from '../../src/main/encrypted-proposal-store.js';
import { ProtectedProposalAuthority } from '../../src/main/protected-proposal-authority.js';
import { builtinCodexFunctionId, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';
import { presentProtectedConsent } from '../../src/main/protected-native-consent.js';
import { readProjectHeadAsync } from '../../src/main/async-project-baseline.js';
import { sharedPromptGate } from '../../src/main/prompt-gate.js';
import { fingerprintExecutable } from '../../src/main/local-goal-draft.js';

vi.mock('../../src/main/protected-native-consent.js', () => ({ presentProtectedConsent: vi.fn() }));
vi.mock('../../src/main/async-project-baseline.js', () => ({ readProjectHeadAsync: vi.fn() }));
vi.mock('../../src/main/local-goal-draft.js', () => ({ fingerprintExecutable: vi.fn() }));

const binaryIdentity = { hash: 'a'.repeat(64), dev: '1', ino: '2', size: '10', modified: '3', changed: '4' };
beforeEach(() => { vi.mocked(fingerprintExecutable).mockResolvedValue(binaryIdentity); });

function confirm(authority: ProtectedProposalAuthority, target: typeof scope,
  present: (review: string) => Promise<boolean>, baseline: () => Promise<string>) {
  vi.mocked(presentProtectedConsent).mockImplementation(present);
  vi.mocked(readProjectHeadAsync).mockImplementation(baseline);
  return authority.confirmAndQueue(target);
}

const scope = { workspaceId: 'w', projectId: 'p', proposalVersionId: 'proposal-1' };
const candidate = {
  objective: 'confidential objective', workspaceId: 'w', projectId: 'p', agentId: 'agent', functionId: builtinCodexFunctionId('agent'),
  projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1',
  baselineCommit: 'a'.repeat(40), createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
  budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'codex-file-write', version: '1' }],
  workItems: [{ id: 'work', projectId: 'p', agentId: 'agent', functionId: builtinCodexFunctionId('agent'), objective: 'confidential objective', required: true as const, dependencies: [] }],
  resources: [{ key: 'project:p', intent: 'WRITE' as const }], allowedActions: ['FILE_WRITE' as const], forbiddenActions: [],
  reconfirmationTriggers: ['change'], risk: 'HIGH' as const, acceptanceCriteria: [{ criterion: 'private criterion', evidence: 'test log' }]
};
class Vault implements ReservedVault {
  values = new Map<string, Buffer>();
  async create(ref: string) { const key = randomBytes(32); this.values.set(ref, Buffer.from(key)); return key; }
  async read(ref: string) { const key = this.values.get(ref); return key ? Buffer.from(key) : null; }
}
async function fixture(proposalCandidate = candidate) {
  const db = new Database(':memory:'); applyMigrations(db);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO agents VALUES ('agent','w','Codex','0.121.0','CONNECTED','AVAILABLE',NULL,1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/fixture','e:/fixture','ACTIVE','agent',1,'2026','2026',1)").run();
  db.prepare("INSERT INTO local_codex_registrations VALUES ('w','agent','E:/fixture/codex.exe','0.121.0','2026')").run();
  provisionBuiltinCodexFunction(db, 'w', 'agent', '0.121.0');
  db.exec('CREATE TABLE marker (value TEXT NOT NULL)');
  const vault = new Vault();
  const store = new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault));
  const proposal = createH1ReviewedProposal(scope.proposalVersionId, proposalCandidate);
  await store.save(scope, proposal);
  const authority = new ProtectedProposalAuthority(db, vault, () => '2026-08-01T00:00:00.000Z');
  return { db, vault, proposal, authority };
}

function bindProtected(db: Database.Database, proposal: ReturnType<typeof createH1ReviewedProposal>): void {
  db.exec(readFileSync(new URL('../../../../packages/persistence/src/sqlite/migrations/033-protected-execution.sql', import.meta.url), 'utf8'));
  db.prepare("INSERT INTO proposal_authority_refs VALUES (?, ?, ?, 'PROTECTED', 1, ?)")
    .run(scope.proposalVersionId, scope.workspaceId, scope.projectId, proposal.createdAt);
  db.prepare(`INSERT INTO protected_proposal_bindings
    SELECT ?, 'PROTECTED', ?, ?, record_id, key_ref, 'PROPOSAL', 1, 'SAI_PROPOSAL_SHA256_V1'
    FROM protected_payloads WHERE record_id=?`).run(scope.proposalVersionId, scope.workspaceId, scope.projectId, scope.proposalVersionId);
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
  ['unknown Attempt', "UPDATE execution_attempts SET state='UNKNOWN'"],
  ['unavailable Agent', "UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'"],
  ['forged approval', "DROP TRIGGER protected_execution_context_no_update; UPDATE protected_execution_context SET approval_tag='hmac-sha256:' || printf('%064d',0)"]
])('protected claim rejects %s without claiming the outbox', async (_name, sql) => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec(sql);
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state, claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('a Project change during the final key read prevents protected claim', async () => {
  const { db, vault, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    const original = vault.read.bind(vault);
    let reads = 0;
    vi.spyOn(vault, 'read').mockImplementation(async ref => {
      const key = await original(ref);
      if (++reads === 2) db.exec("UPDATE projects SET snapshot_version=2 WHERE project_id='p'");
      return key;
    });
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(reads).toBe(2);
    expect(db.prepare('SELECT state, claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('an already expired Proposal is rejected before native confirmation', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const authority = new ProtectedProposalAuthority(db, vault, () => '2027-01-02T00:00:00.000Z');
    vi.mocked(presentProtectedConsent).mockClear();
    vi.mocked(readProjectHeadAsync).mockResolvedValue('a'.repeat(40));
    await expect(authority.confirmAndQueue(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(presentProtectedConsent).not.toHaveBeenCalled();
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('authorization issuance cannot ignore a Proposal expiry observed in its commit transaction', async () => {
  const shortCandidate = { ...candidate, expiresAt: '2026-08-01T00:00:20.000Z', deadlineAt: '2026-08-01T00:00:20.000Z' };
  const { db, vault, proposal } = await fixture(shortCandidate);
  try {
    bindProtected(db, proposal);
    let afterKeyRead = false;
    let finalReads = 0;
    const clock = () => !afterKeyRead ? '2026-08-01T00:00:00.000Z'
      : ++finalReads === 2 ? '2026-08-01T00:00:21.000Z' : '2026-08-01T00:00:01.000Z';
    const original = vault.read.bind(vault);
    let reads = 0;
    vi.spyOn(vault, 'read').mockImplementation(async ref => {
      const key = await original(ref);
      if (++reads === 2) afterKeyRead = true;
      return key;
    });
    const authority = new ProtectedProposalAuthority(db, vault, clock);
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40)))
      .rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('a forged approval cannot advance a Lease when Git preflight fails', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("DROP TRIGGER protected_execution_context_no_update; UPDATE protected_execution_context SET approval_tag='hmac-sha256:' || printf('%064d',0)");
    vi.mocked(readProjectHeadAsync).mockResolvedValue('b'.repeat(40));
    now = '2026-08-01T00:00:31.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT last_observed_at FROM resource_leases').get()).toEqual({ last_observed_at: '2026-08-01T00:00:00.000Z' });
  } finally { db.close(); }
});

test('a late Project change cannot erase the latest authenticated lease expiry observation', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    const original = vault.read.bind(vault);
    let reads = 0;
    vi.spyOn(vault, 'read').mockImplementation(async ref => {
      const key = await original(ref);
      if (++reads === 2) {
        db.exec("UPDATE projects SET row_version=row_version+1 WHERE project_id='p'");
        now = '2026-08-01T00:00:31.000Z';
      }
      return key;
    });
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    db.exec("UPDATE projects SET row_version=row_version-1 WHERE project_id='p'");
    now = '2026-08-01T00:00:01.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('a temporary runtime registration change cannot erase an authenticated lease expiry observation', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("UPDATE local_codex_registrations SET observed_version='other' WHERE agent_id='agent'");
    now = '2026-08-01T00:00:31.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    db.exec("UPDATE local_codex_registrations SET observed_version='0.121.0' WHERE agent_id='agent'");
    now = '2026-08-01T00:00:01.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('a temporarily changed Git baseline cannot erase an authenticated lease expiry observation', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    vi.mocked(readProjectHeadAsync).mockResolvedValue('b'.repeat(40));
    now = '2026-08-01T00:00:31.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    vi.mocked(readProjectHeadAsync).mockResolvedValue('a'.repeat(40));
    now = '2026-08-01T00:00:01.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('temporary WorkItem state changes cannot erase an authenticated lease expiry observation', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("UPDATE work_items SET state='RUNNING'");
    now = '2026-08-01T00:00:31.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    db.exec("UPDATE work_items SET state='WAITING'");
    now = '2026-08-01T00:00:01.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('temporary Agent unavailability cannot erase an authenticated lease expiry observation', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'");
    now = '2026-08-01T00:00:31.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    db.exec("UPDATE agents SET availability='AVAILABLE' WHERE agent_id='agent'");
    now = '2026-08-01T00:00:01.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('expiry observed at the start of a claim cannot be erased by a later clock rollback', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    now = '2027-01-02T00:00:00.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    now = '2026-08-01T00:00:01.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('an observed Proposal expiry cannot be erased by a later clock rollback', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let afterFingerprint = false;
    let laterReads = 0;
    const clock = () => !afterFingerprint ? '2026-08-01T00:00:00.000Z'
      : ++laterReads === 1 ? '2027-01-02T00:00:00.000Z' : '2026-08-01T00:00:01.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, clock);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    let fingerprints = 0;
    vi.mocked(fingerprintExecutable).mockImplementation(async () => {
      if (++fingerprints === 2) afterFingerprint = true;
      return binaryIdentity;
    });
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('an observed expiry before key authentication cannot be erased by a later clock rollback', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let afterFingerprint = false;
    let laterReads = 0;
    const clock = () => !afterFingerprint ? '2026-08-01T00:00:00.000Z'
      : ++laterReads === 1 ? '2026-08-01T00:00:31.000Z' : '2026-08-01T00:00:01.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, clock);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    let fingerprints = 0;
    vi.mocked(fingerprintExecutable).mockImplementation(async () => {
      if (++fingerprints === 2) afterFingerprint = true;
      return binaryIdentity;
    });
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(fingerprints).toBe(2);
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
  } finally { db.close(); }
});

test('a clock rollback inside the final claim transaction cannot revive an expired lease', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let afterKeyRead = false;
    let finalReads = 0;
    const clock = () => !afterKeyRead ? '2026-08-01T00:00:00.000Z'
      : ++finalReads === 1 ? '2026-08-01T00:00:31.000Z' : '2026-08-01T00:00:01.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, clock);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    let reads = 0;
    const original = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async ref => {
      const key = await original(ref);
      if (++reads === 2) afterKeyRead = true;
      return key;
    });
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('a conflicting lease cannot erase the observed clock watermark and permit rollback', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO resource_leases (lease_id,resource_key,attempt_id,fencing_token,state,created_at) VALUES ('other','worktree:p','other-attempt',0,'EXPIRED','2026')").run();
    db.pragma('foreign_keys = ON');
    now = '2026-08-01T00:00:29.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare("SELECT last_observed_at FROM resource_leases WHERE lease_id<>'other'").get())
      .toEqual({ last_observed_at: '2026-08-01T00:00:29.000Z' });
    db.exec("UPDATE resource_leases SET state='RELEASED' WHERE lease_id='other'");
    now = '2026-08-01T00:00:01.000Z';
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('an unreleased expired overlapping lease blocks a protected claim', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO resource_leases (lease_id,resource_key,attempt_id,fencing_token,state,created_at) VALUES ('other','worktree:p','other-attempt',0,'EXPIRED','2026')").run();
    db.pragma('foreign_keys = ON');
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT state, claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('a protected queue head does not starve a later legacy message', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const protectedAttempt = await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('legacy-proposal', 'w', 'p', 'agent', builtinCodexFunctionId('agent'), 'legacy', '["FILE_WRITE"]',
        '1', '0.121.0', '1', '1', 'a'.repeat(40), '2027-01-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', 'sha256:' + 'b'.repeat(64));
    db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('legacy-grant', 'legacy-proposal', 'sha256:' + 'b'.repeat(64), 'local-owner', 'legacy-key', '["FILE_WRITE"]', 'CONSUMED',
        '2026-08-02T00:00:00.000Z', '2027-01-01T00:00:00.000Z');
    db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('legacy-task', 'w', 'p', 'legacy-proposal', 'legacy-grant', 'QUEUED', '2026-08-02T00:00:00.000Z');
    db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run('legacy-work', 'legacy-task', 'agent', builtinCodexFunctionId('agent'), 'WAITING');
    db.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('legacy-attempt', 'legacy-work', 'legacy-request', 'legacy-key', 'DISPATCH_PENDING', 0, '2026-08-02T00:00:00.000Z');
    db.prepare('INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('outbox:legacy-attempt', 'legacy-attempt', 'legacy-request', 'legacy-key', 'start', '{"attempt_id":"legacy-attempt"}', 'PENDING', '2026-08-02T00:00:00.000Z');
    db.pragma('foreign_keys = OFF');
    db.exec('DROP TRIGGER proposal_authority_refs_immutable_update');
    const changedScope = {
      prepare(sql: string) {
        const statement = db.prepare(sql);
        if (!sql.startsWith('SELECT message_id FROM outbox')) return statement;
        return { get() {
          const row = statement.get();
          db.exec("UPDATE proposal_authority_refs SET source_kind='PROTECTED' WHERE proposal_version_id='legacy-proposal'");
          return row;
        } };
      }
    } as unknown as Database.Database;
    expect(new SqliteOutboxRepository(changedScope).claimNext()).toBeNull();
    expect(db.prepare("SELECT state,claim_token FROM outbox WHERE attempt_id='legacy-attempt'").get())
      .toEqual({ state: 'PENDING', claim_token: null });
    db.exec("UPDATE proposal_authority_refs SET source_kind='LEGACY' WHERE proposal_version_id='legacy-proposal'");
    db.pragma('foreign_keys = ON');
    expect(new SqliteOutboxRepository(db).claimNext()).toMatchObject({ attemptId: 'legacy-attempt' });
    expect(db.prepare('SELECT state,claim_token FROM outbox WHERE attempt_id=?').get(protectedAttempt.attemptId))
      .toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('generic outbox claim cannot consume a protected pending Attempt', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    expect(new SqliteOutboxRepository(db).claimNext()).toBeNull();
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'PENDING', claim_token: null });
  } finally { db.close(); }
});

test('only the matching protected claim can quarantine an uncertain original Attempt without releasing its lease', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const original = await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    const claim = await authority.claimQueued(scope);
    const quarantine = Reflect.get(authority, 'quarantineClaim');
    expect(typeof quarantine).toBe('function');
    expect(Reflect.apply(quarantine, authority, [scope, '00000000-0000-4000-8000-000000000000'])).toBe(false);
    expect(db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'DISPATCH_PENDING' });
    expect(Reflect.apply(quarantine, authority, [scope, claim.claimToken])).toBe(true);
    expect(db.prepare('SELECT attempt_id,state FROM execution_attempts').get()).toEqual({ attempt_id: original.attemptId, state: 'UNKNOWN' });
    expect(db.prepare('SELECT state,claim_token FROM outbox').get()).toEqual({ state: 'RECONCILING', claim_token: null });
    expect(db.prepare('SELECT state FROM resource_leases').get()).toEqual({ state: 'ACTIVE' });
    expect(Reflect.apply(quarantine, authority, [scope, claim.claimToken])).toBe(false);
    await expect(authority.claimQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
  } finally { db.close(); }
});

test('only one concurrent protected claimant obtains the original pending Attempt', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const original = await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    const claim = Reflect.get(authority, 'claimQueued');
    expect(typeof claim).toBe('function');
    const results = await Promise.allSettled([
      Reflect.apply(claim, authority, [scope]),
      Reflect.apply(claim, authority, [scope])
    ]);
    const winners = results.filter(result => result.status === 'fulfilled');
    expect(winners).toHaveLength(1);
    const value = (winners[0] as PromiseFulfilledResult<{ attemptId: string; claimToken: string }>).value;
    expect(value.attemptId).toBe(original.attemptId);
    expect(value.claimToken).toMatch(/^[a-f0-9-]{36}$/);
    expect(db.prepare('SELECT state, claim_token FROM outbox').get())
      .toEqual({ state: 'DISPATCHING', claim_token: value.claimToken });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test.each([
  ['project', "UPDATE projects SET snapshot_version=2 WHERE project_id='p'"],
  ['project Agent assignment', "UPDATE projects SET default_agent_id=NULL WHERE project_id='p'"],
  ['agent', "UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'"],
  ['function', "UPDATE functions SET function_version='2' WHERE agent_id='agent'"],
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

test('an ambiguous start cannot return to dispatch through an intermediate state', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("UPDATE outbox SET state='RECONCILING'");
    expect(() => db.exec("UPDATE outbox SET state='FAILED'")).toThrow();
    expect(() => db.exec("UPDATE outbox SET state='UNRECOGNIZED'")).toThrow();
    expect(() => db.exec("UPDATE outbox SET state='DISPATCHING'")).toThrow();
    expect(db.prepare('SELECT state FROM outbox').get()).toEqual({ state: 'RECONCILING' });
  } finally { db.close(); }
});

test('unknown protected Attempt cannot be resolved without durable reconciliation evidence', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("UPDATE execution_attempts SET state='UNKNOWN'");
    for (const state of ['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNRECOGNIZED']) {
      expect(() => db.prepare('UPDATE execution_attempts SET state=?').run(state)).toThrow();
    }
    expect(db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: 'UNKNOWN' });
  } finally { db.close(); }
});

test.each([
  ["UPDATE execution_attempts SET state='UNKNOWN'", "UPDATE execution_attempts SET state='DISPATCH_PENDING'"],
  ["UPDATE outbox SET state='RECONCILING'", "UPDATE outbox SET state='PENDING'"],
  ["UPDATE resource_leases SET state='RELEASED'", "UPDATE resource_leases SET state='ACTIVE'"],
  ["UPDATE authorization_grants SET status='REVOKED'", "UPDATE authorization_grants SET status='CONSUMED'"],
  ["UPDATE authorization_grants SET status='EXPIRED'", "UPDATE authorization_grants SET status='CONSUMED'"]
])('protected terminal or ambiguous state cannot be reset: %s', async (advance, rewind) => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec(advance);
    expect(() => db.exec(rewind)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a legacy WorkItem cannot be moved into a protected Task', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.prepare('INSERT INTO proposal_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run('legacy','w','p','agent',candidate.functionId,'legacy goal','["FILE_WRITE"]','1','0.121.0','1','1','a'.repeat(40),proposal.expiresAt,proposal.createdAt,'sha256:' + 'b'.repeat(64));
    db.prepare('INSERT INTO authorization_grants VALUES (?,?,?,?,?,?,?,?,?)')
      .run('legacy-grant','legacy','sha256:' + 'b'.repeat(64),'local-owner','legacy-key','["FILE_WRITE"]','CONSUMED',proposal.createdAt,proposal.expiresAt);
    db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?)')
      .run('legacy-task','w','p','legacy','legacy-grant','QUEUED',proposal.createdAt);
    db.prepare('INSERT INTO work_items VALUES (?,?,?,?,?)').run('legacy-work','legacy-task','agent',candidate.functionId,'WAITING');
    const target = db.prepare('SELECT task_id FROM protected_execution_bindings').get() as { task_id: string };
    expect(() => db.prepare('UPDATE work_items SET task_id=? WHERE work_item_id=?').run(target.task_id, 'legacy-work')).toThrow();
    expect(db.prepare("SELECT task_id FROM work_items WHERE work_item_id='legacy-work'").get()).toEqual({ task_id: 'legacy-task' });
  } finally { db.close(); }
});

test('a protected WorkItem cannot be replaced into a legacy Task', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.prepare('INSERT INTO proposal_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run('legacy','w','p','agent',candidate.functionId,'legacy goal','["FILE_WRITE"]','1','0.121.0','1','1','a'.repeat(40),proposal.expiresAt,proposal.createdAt,'sha256:' + 'b'.repeat(64));
    db.prepare('INSERT INTO authorization_grants VALUES (?,?,?,?,?,?,?,?,?)')
      .run('legacy-grant','legacy','sha256:' + 'b'.repeat(64),'local-owner','legacy-key','["FILE_WRITE"]','CONSUMED',proposal.createdAt,proposal.expiresAt);
    db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?)')
      .run('legacy-task','w','p','legacy','legacy-grant','QUEUED',proposal.createdAt);
    const binding = db.prepare('SELECT work_item_id FROM protected_execution_bindings').get() as { work_item_id: string };
    const original = db.prepare('SELECT task_id FROM work_items WHERE work_item_id=?').get(binding.work_item_id);
    expect(() => db.prepare('INSERT OR REPLACE INTO work_items VALUES (?,?,?,?,?)')
      .run(binding.work_item_id,'legacy-task','agent',candidate.functionId,'WAITING')).toThrow();
    expect(db.prepare('SELECT task_id FROM work_items WHERE work_item_id=?').get(binding.work_item_id)).toEqual(original);
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

test('an exact approved protected Proposal creates one original Attempt without plaintext persistence', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    db.exec(readFileSync(new URL('../../../../packages/persistence/src/sqlite/migrations/033-protected-execution.sql', import.meta.url), 'utf8'));
    db.prepare("INSERT INTO proposal_authority_refs VALUES (?, ?, ?, 'PROTECTED', 1, ?)")
      .run(scope.proposalVersionId, scope.workspaceId, scope.projectId, proposal.createdAt);
    db.prepare(`INSERT INTO protected_proposal_bindings
      SELECT ?, 'PROTECTED', ?, ?, record_id, key_ref, 'PROPOSAL', 1, 'SAI_PROPOSAL_SHA256_V1'
      FROM protected_payloads WHERE record_id=?`).run(scope.proposalVersionId, scope.workspaceId, scope.projectId, scope.proposalVersionId);
    const approve = Reflect.get(authority, 'confirmAndQueue');
    expect(typeof approve).toBe('function');
    const nativeReviews: string[] = [];
    const present = async (fullReview: string) => { nativeReviews.push(fullReview); return true; };
    const baseline = async () => 'a'.repeat(40);
    const first = await confirm(authority, scope, present, baseline);
    const second = await confirm(authority, scope, present, baseline);
    expect(first).toEqual(expect.objectContaining({ attemptId: expect.any(String) }));
    expect(second).toEqual(first);
    expect(nativeReviews).toHaveLength(1);
    expect(nativeReviews[0]).toContain(candidate.objective);
    const displayed = JSON.parse(nativeReviews[0]!) as { executionIdentity?: { executableSha256?: string; projectPath?: string; executablePath?: string } };
    expect(displayed.executionIdentity).toEqual(expect.objectContaining({ executableSha256: 'a'.repeat(64), projectPath: 'E:/fixture', executablePath: 'E:/fixture/codex.exe' }));
    expect(db.prepare('SELECT work_item_id FROM work_items').get()).toEqual({ work_item_id: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    for (const table of ['authorization_grants', 'tasks', 'work_items', 'execution_attempts', 'resource_leases', 'outbox']) {
      expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 1 });
    }
    expect(db.serialize().includes(Buffer.from(candidate.objective))).toBe(false);
    expect(db.serialize().includes(Buffer.from(candidate.acceptanceCriteria[0]!.criterion))).toBe(false);
  } finally { db.close(); }
});

test('a sensitive Proposal WorkItem id never enters the control database', async () => {
  const secretId = 'private_customer_case_329174';
  const { db, authority, proposal } = await fixture({ ...candidate, workItems: [{ ...candidate.workItems[0]!, id: secretId }] });
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    expect(db.serialize().includes(Buffer.from(secretId))).toBe(false);
  } finally { db.close(); }
});

test('invisible Unicode format characters cannot appear in the native authorization review', async () => {
  const objective = 'invoice\u200bapproved';
  const { db, authority, proposal } = await fixture({ ...candidate, objective, workItems: [{ ...candidate.workItems[0]!, objective }] });
  try {
    bindProtected(db, proposal);
    const present = vi.fn(async () => true);
    await expect(confirm(authority, scope, present, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(present).not.toHaveBeenCalled();
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('protected Proposal text and WorkItem id do not appear in the database or live WAL', async () => {
  const secretId = 'private_case_disk_947165';
  const { db, vault, proposal } = await fixture({ ...candidate, workItems: [{ ...candidate.workItems[0]!, id: secretId }] });
  const folder = mkdtempSync(join(tmpdir(), 'sa-protected-wal-'));
  const path = join(folder, 'fixture.sqlite');
  let disk: Database.Database | undefined;
  try {
    bindProtected(db, proposal);
    await db.backup(path);
    disk = new Database(path);
    disk.pragma('foreign_keys=ON');
    expect(disk.pragma('journal_mode=WAL', { simple: true })).toBe('wal');
    const authority = new ProtectedProposalAuthority(disk, vault, () => '2026-08-01T00:00:00.000Z');
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    expect(existsSync(path + '-wal')).toBe(true);
    for (const file of [path, path + '-wal']) {
      const bytes = readFileSync(file);
      for (const secret of [secretId, candidate.objective, candidate.acceptanceCriteria[0]!.criterion]) {
        expect(bytes.includes(Buffer.from(secret))).toBe(false);
      }
    }
  } finally { disk?.close(); db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('a caller cannot supply approval and Git baseline callbacks to authorize execution', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const confirm = Reflect.get(authority, 'confirmAndQueue');
    await expect(Reflect.apply(confirm, authority, [scope, async () => true, async () => 'a'.repeat(40)]))
      .rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('pre-dispatch verification never prompts or creates missing authorization', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const verify = Reflect.get(authority, 'verifyQueued');
    expect(typeof verify).toBe('function');
    vi.mocked(presentProtectedConsent).mockClear();
    vi.mocked(readProjectHeadAsync).mockResolvedValue('a'.repeat(40));
    await expect(Reflect.apply(verify, authority, [scope])).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(presentProtectedConsent).not.toHaveBeenCalled();
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('pre-dispatch verification authenticates the original pending Attempt without prompting', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const expected = await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    vi.mocked(presentProtectedConsent).mockClear();
    expect(await authority.verifyQueued(scope)).toEqual(expected);
    expect(presentProtectedConsent).not.toHaveBeenCalled();
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    db.exec("UPDATE execution_attempts SET state='UNKNOWN'");
    await expect(authority.verifyQueued(scope)).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(presentProtectedConsent).not.toHaveBeenCalled();
  } finally { db.close(); }
});

test.each([
  ['dismissal', async (db: Database.Database) => { void db; return false; }],
  ['changed Project', async (db: Database.Database) => { db.exec("UPDATE projects SET snapshot_version=2 WHERE project_id='p'"); return true; }],
  ['changed Project path', async (db: Database.Database) => { db.exec("UPDATE projects SET canonical_path='E:/other' WHERE project_id='p'"); return true; }],
  ['changed Agent', async (db: Database.Database) => { db.exec("UPDATE agents SET availability='PAUSED' WHERE agent_id='agent'"); return true; }],
  ['changed Agent generation', async (db: Database.Database) => { db.exec("UPDATE agents SET row_version=row_version+1 WHERE agent_id='agent'"); return true; }],
  ['changed executable registration', async (db: Database.Database) => { db.exec("UPDATE local_codex_registrations SET executable_path='E:/other/codex.exe' WHERE agent_id='agent'"); return true; }],
  ['changed Function', async (db: Database.Database) => { db.exec("UPDATE functions SET function_version='2' WHERE agent_id='agent'"); return true; }],
  ['changed ciphertext', async (db: Database.Database) => { db.exec("DROP TRIGGER protected_payloads_no_update; UPDATE protected_payloads SET ciphertext=x'00' WHERE record_id='proposal-1'"); return true; }]
])('rejects %s during native review without creating an Attempt', async (_label, operation) => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await expect(confirm(authority, scope, () => operation(db), async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    for (const table of ['authorization_grants', 'tasks', 'work_items', 'execution_attempts', 'resource_leases', 'outbox']) {
      expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  } finally { db.close(); }
});

test('a Project change while checking the baseline cannot expose an earlier Attempt', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const baseline = async () => 'a'.repeat(40);
    await confirm(authority, scope, async () => true, baseline);
    await expect(confirm(authority, scope, async () => { throw new Error('unexpected review'); }, async () => {
      db.exec("UPDATE workspaces SET status='LOCKED' WHERE workspace_id='w'");
      return 'a'.repeat(40);
    })).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a clock rollback while native review is open cannot create an Attempt', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T12:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await expect(confirm(authority, scope, async () => {
      now = '2026-08-01T11:00:00.000Z';
      return true;
    }, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('replacing the registered executable during review prevents authorization', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await expect(confirm(authority, scope, async () => {
      vi.mocked(fingerprintExecutable).mockResolvedValue({ ...binaryIdentity, hash: 'b'.repeat(64) });
      return true;
    }, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('an unknown original Attempt cannot be reported as a successful queued confirmation', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("UPDATE execution_attempts SET state='UNKNOWN'");
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a changed executable registration cannot reuse an earlier protected confirmation', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("UPDATE local_codex_registrations SET executable_path='E:/other/codex.exe' WHERE agent_id='agent'");
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('altering matching persisted approval timestamps cannot forge an approved replay', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec(`DROP TRIGGER protected_execution_binding_no_update;
      DROP TRIGGER protected_grant_immutable;
      UPDATE protected_execution_bindings SET created_at='2026-07-01T00:00:00.000Z';
      UPDATE authorization_grants SET issued_at='2026-07-01T00:00:00.000Z'`);
    await expect(confirm(authority, scope, async () => { throw new Error('unexpected review'); }, async () => 'a'.repeat(40)))
      .rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('rewriting the registered executable and matching context digest cannot forge a replay', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let displayed = '';
    await confirm(authority, scope, async review => { displayed = review; return true; }, async () => 'a'.repeat(40));
    const value = JSON.parse(displayed) as { executionIdentity: { executablePath: string } };
    value.executionIdentity.executablePath = 'E:/other/codex.exe';
    const forged = 'sha256:' + createHash('sha256').update(JSON.stringify(value.executionIdentity)).digest('hex');
    db.exec("DROP TRIGGER protected_execution_context_no_update; UPDATE local_codex_registrations SET executable_path='E:/other/codex.exe'");
    db.prepare('UPDATE protected_execution_context SET context_digest=?').run(forged);
    await expect(confirm(authority, scope, async () => { throw new Error('unexpected review'); }, async () => 'a'.repeat(40)))
      .rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('changing the protected fencing token cannot forge an approved replay', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec('DROP TRIGGER protected_lease_update; UPDATE resource_leases SET fencing_token=99');
    await expect(confirm(authority, scope, async () => { throw new Error('unexpected review'); }, async () => 'a'.repeat(40)))
      .rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a missing Proposal key cannot authenticate an existing protected approval', async () => {
  const { db, vault, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    vault.values.clear();
    await expect(confirm(authority, scope, async () => { throw new Error('unexpected review'); }, async () => 'a'.repeat(40)))
      .rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('an invalid approval tag cannot advance the Lease watermark', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    db.exec("DROP TRIGGER protected_execution_context_no_update; UPDATE protected_execution_context SET approval_tag='hmac-sha256:' || printf('%064d',0)");
    now = '2026-08-01T00:00:31.000Z';
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT last_observed_at FROM resource_leases').get()).toEqual({ last_observed_at: '2026-08-01T00:00:00.000Z' });
  } finally { db.close(); }
});

test('a vault failure during approval-tag verification cannot advance the Lease watermark', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    const original = vault.read.bind(vault);
    let calls = 0;
    vi.spyOn(vault, 'read').mockImplementation(async ref => {
      if (++calls === 2) throw new Error('synthetic vault failure');
      return original(ref);
    });
    now = '2026-08-01T00:00:31.000Z';
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT last_observed_at FROM resource_leases').get()).toEqual({ last_observed_at: '2026-08-01T00:00:00.000Z' });
  } finally { db.close(); }
});

test('authorization cannot commit with a Lease already expired while reading its key', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    let reads = 0;
    const original = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async ref => {
      const result = await original(ref);
      if (++reads === 2) now = '2026-08-01T00:00:31.000Z';
      return result;
    });
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM resource_leases').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('approval tag binds the message supplied before an asynchronous vault read', async () => {
  const { db, vault } = await fixture();
  try {
    const service = new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault);
    const target = { workspaceId: scope.workspaceId, projectId: scope.projectId, recordId: scope.proposalVersionId, kind: 'PROPOSAL' as const };
    const expected = await service.approvalTag(target, Buffer.from('original'));
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const original = vault.read.bind(vault);
    vi.spyOn(vault, 'read').mockImplementation(async ref => { entered(); await waiting; return original(ref); });
    const input = Buffer.from('original');
    const pending = service.approvalTag(target, input);
    await started;
    input.fill(0);
    release();
    expect(await pending).toBe(expected);
  } finally { db.close(); }
});

test.each(['RELEASED', 'EXPIRED'])('a %s lease cannot be reported as a queued confirmation', async state => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    if (state === 'RELEASED') db.exec("UPDATE resource_leases SET state='RELEASED'");
    else now = '2026-08-01T00:00:31.000Z';
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    if (state === 'EXPIRED') {
      now = '2026-08-01T00:00:10.000Z';
      await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    }
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('an observed expired protected Lease cannot have its watermark or lifetime reset', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    now = '2026-08-01T00:00:31.000Z';
    await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    expect(() => db.exec("UPDATE resource_leases SET last_observed_at='2026-08-01T00:00:10.000Z'")).toThrow();
    expect(() => db.exec("UPDATE resource_leases SET renewed_at='2026-08-01T00:00:31.000Z', expires_at='2026-08-01T00:01:01.000Z', last_observed_at='2026-08-01T00:00:31.000Z'")).toThrow();
    expect(db.prepare('SELECT last_observed_at FROM resource_leases').get()).toEqual({ last_observed_at: now });
  } finally { db.close(); }
});

test('a current protected Lease permits a monotonic repository renewal', async () => {
  const { db, vault, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let now = '2026-08-01T00:00:00.000Z';
    const authority = new ProtectedProposalAuthority(db, vault, () => now);
    const { attemptId } = await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    const row = db.prepare('SELECT lease_id,fencing_token FROM resource_leases WHERE attempt_id=?').get(attemptId) as { lease_id: string; fencing_token: number };
    now = '2026-08-01T00:00:10.000Z';
    expect(new SqliteResourceLeaseRepository(db, () => now).renew({ leaseId: row.lease_id, attemptId, fencingToken: row.fencing_token })).toBe(true);
    expect(db.prepare('SELECT renewed_at,expires_at,last_observed_at FROM resource_leases').get()).toEqual({
      renewed_at: now, expires_at: '2026-08-01T00:00:40.000Z', last_observed_at: now
    });
  } finally { db.close(); }
});

test('a protected Lease cannot renew beyond its previous expiry without an observation', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    expect(() => db.exec("UPDATE resource_leases SET renewed_at='2026-08-01T00:00:31.000Z', expires_at='2026-08-01T00:01:01.000Z', last_observed_at='2026-08-01T00:00:31.000Z'")).toThrow();
    expect(db.prepare('SELECT expires_at FROM resource_leases').get()).toEqual({ expires_at: '2026-08-01T00:00:30.000Z' });
  } finally { db.close(); }
});

test('a protected WorkItem cannot acquire a second initial Attempt', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    const work = db.prepare('SELECT work_item_id FROM protected_execution_bindings').get() as { work_item_id: string };
    expect(() => db.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('other-attempt', work.work_item_id, 'other-request', 'other-key', 'DISPATCH_PENDING', 0, proposal.createdAt)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a protected Attempt cannot acquire an unbound second lease or start message', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const { attemptId } = await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    expect(() => db.prepare(`INSERT INTO resource_leases
      (lease_id,resource_key,attempt_id,fencing_token,state,created_at) VALUES (?,?,?,?,?,?)`)
      .run('other-lease', 'project:other', attemptId, 1, 'ACTIVE', proposal.createdAt)).toThrow();
    expect(() => db.prepare(`INSERT INTO outbox
      (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run('other-message', attemptId, 'other-request', 'other-key', 'start', '{}', 'PENDING', proposal.createdAt)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM resource_leases').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM outbox').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test.each([
  'INSERT OR REPLACE INTO tasks SELECT * FROM tasks',
  "INSERT OR REPLACE INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) SELECT message_id,attempt_id,request_id,idempotency_key,'cancel',payload_json,state,created_at FROM outbox"
])('protected task and start records cannot be replaced: %s', async sql => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    expect(() => db.exec(sql)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT message_type FROM outbox").get()).toEqual({ message_type: 'start' });
  } finally { db.close(); }
});

test('concurrent confirmations share one native review and one original Attempt', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let reviews = 0;
    const present = async () => { reviews++; await Promise.resolve(); return true; };
    const results = await Promise.all(Array.from({ length: 100 }, () => confirm(authority, scope, present, async () => 'a'.repeat(40))));
    expect(new Set(results.map(result => result.attemptId)).size).toBe(1);
    expect(reviews).toBe(1);
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM outbox').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('scope property order does not create a second native confirmation', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let reviews = 0;
    let release!: () => void;
    let enter!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const present = async () => { reviews++; enter(); await gate; return true; };
    const first = confirm(authority, scope, present, async () => 'a'.repeat(40));
    await entered;
    const reversed = { proposalVersionId: scope.proposalVersionId, projectId: scope.projectId, workspaceId: scope.workspaceId };
    const second = confirm(authority, reversed, present, async () => 'a'.repeat(40));
    release();
    expect(await first).toEqual(await second);
    expect(reviews).toBe(1);
  } finally { db.close(); }
});

test('protected approval is refused while another sensitive main-process prompt is active', async () => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const held = sharedPromptGate.run(async () => { await gate; return true; }, false);
    try {
      await expect(confirm(authority, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
      expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    } finally { release(); await held; }
  } finally { db.close(); }
});

test('separate authority instances cannot display overlapping authorization prompts', async () => {
  const { db, vault, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const other = new ProtectedProposalAuthority(db, vault, () => '2026-08-01T00:00:00.000Z');
    let release!: () => void;
    let enter!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const first = confirm(authority, scope, async () => { enter(); await gate; return true; }, async () => 'a'.repeat(40));
    await entered;
    try {
      await expect(confirm(other, scope, async () => true, async () => 'a'.repeat(40))).rejects.toThrow('PROTECTED_AUTHORITY_UNAVAILABLE');
    } finally { release(); }
    await first;
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM outbox').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('reopening a durable protected confirmation returns the original Attempt without another review', async () => {
  const { db, vault, authority, proposal } = await fixture();
  const folder = mkdtempSync(join(tmpdir(), 'sa-protected-approval-'));
  const path = join(folder, 'fixture.sqlite');
  let reopened: Database.Database | undefined;
  try {
    bindProtected(db, proposal);
    const first = await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    await db.backup(path);
    reopened = new Database(path);
    const recovered = new ProtectedProposalAuthority(reopened, vault, () => '2026-08-01T00:00:00.000Z');
    const result = await confirm(recovered, scope, async () => { throw new Error('duplicate review'); }, async () => 'a'.repeat(40));
    expect(result).toEqual(first);
    expect(reopened.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    expect(reopened.serialize().includes(Buffer.from(candidate.objective))).toBe(false);
  } finally { reopened?.close(); db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('a protected Task cannot receive a WorkItem different from its frozen binding', async () => {
  const { db, proposal } = await fixture();
  try {
    db.exec(readFileSync(new URL('../../../../packages/persistence/src/sqlite/migrations/033-protected-execution.sql', import.meta.url), 'utf8'));
    db.prepare("INSERT INTO proposal_authority_refs VALUES (?, ?, ?, 'PROTECTED', 1, ?)")
      .run(scope.proposalVersionId, scope.workspaceId, scope.projectId, proposal.createdAt);
    db.prepare(`INSERT INTO protected_proposal_bindings
      SELECT ?, 'PROTECTED', ?, ?, record_id, key_ref, 'PROPOSAL', 1, 'SAI_PROPOSAL_SHA256_V1'
      FROM protected_payloads WHERE record_id=?`).run(scope.proposalVersionId, scope.workspaceId, scope.projectId, scope.proposalVersionId);
    const digest = 'sha256:' + 'a'.repeat(64);
    db.prepare('INSERT INTO protected_execution_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(scope.proposalVersionId, 'w', 'p', 'agent', candidate.functionId, digest, 'grant', 'task', 'work', 'attempt', 'lease', 'request', proposal.createdAt);
    db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('grant', scope.proposalVersionId, digest, 'local-owner', 'key', '["FILE_WRITE"]', 'CONSUMED', proposal.createdAt, proposal.expiresAt);
    db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('task', 'w', 'p', scope.proposalVersionId, 'grant', 'QUEUED', proposal.createdAt);
    expect(() => db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)')
      .run('wrong-work', 'task', 'agent', candidate.functionId, 'WAITING')).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM work_items').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('a protected WorkItem cannot be bound to a different Agent or Function', async () => {
  const { db, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    const digest = 'sha256:' + 'a'.repeat(64);
    db.prepare('INSERT INTO protected_execution_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(scope.proposalVersionId, 'w', 'p', 'agent', candidate.functionId, digest, 'grant', 'task', 'work', 'attempt', 'lease', 'request', proposal.createdAt);
    db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('grant', scope.proposalVersionId, digest, 'local-owner', 'key', '["FILE_WRITE"]', 'CONSUMED', proposal.createdAt, proposal.expiresAt);
    db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('task', 'w', 'p', scope.proposalVersionId, 'grant', 'QUEUED', proposal.createdAt);
    expect(() => db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)')
      .run('work', 'task', 'unexpected-agent', 'unexpected-function', 'WAITING')).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM work_items').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test.each([
  "UPDATE authorization_grants SET actor_id='intruder'",
  "UPDATE authorization_grants SET actions_json='[\"NETWORK\"]'",
  "UPDATE authorization_grants SET expires_at='2099-01-01T00:00:00.000Z'",
  "UPDATE authorization_grants SET issued_at='2025-01-01T00:00:00.000Z'",
  "UPDATE authorization_grants SET idempotency_key='changed'"
])('protected Grant scope and provenance are immutable: %s', async sql => {
  const { db, authority, proposal } = await fixture();
  try {
    bindProtected(db, proposal);
    await confirm(authority, scope, async () => true, async () => 'a'.repeat(40));
    expect(() => db.exec(sql)).toThrow();
  } finally { db.close(); }
});
