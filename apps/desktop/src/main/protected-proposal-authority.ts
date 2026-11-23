/* eslint-disable no-unused-vars -- callback parameter names describe the trusted internal boundary. */
import { Buffer } from 'node:buffer';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type Database from 'better-sqlite3';
import { createH1ReviewedProposal, type ProposalVersion } from '@super-assistant/domain';
import { SqliteResourceLeaseRepository } from '@super-assistant/persistence';
import { EncryptedProposalStore, type EncryptedProposalScope } from './encrypted-proposal-store.js';
import { ProtectedKeyReservations } from './protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from './reserved-payload-service.js';
import { isBuiltinCodexFunction } from './local-codex-function.js';
import { readProjectHeadAsync } from './async-project-baseline.js';
import { presentProtectedCancellation, presentProtectedConsent } from './protected-native-consent.js';
import { sharedPromptGate } from './prompt-gate.js';
import { fingerprintExecutable } from './local-goal-draft.js';

type Envelope = {
  record_id: string; workspace_id: string; project_id: string; content_kind: string; format_version: number;
  key_ref: string; nonce: Buffer; ciphertext: Buffer; auth_tag: Buffer; created_at: string;
  owner_hash: string; reservation_state: string; reservation_created: string; reservation_updated: string;
};
type ExistingResult = { attemptId: string; claimToken?: string } | { unavailable: true } | null;
type ProofSnapshot = { fields: string[]; tag: string };
type ProtectedReceipt = { threadId: string; turnId: string; cwd: string; principalHash: string };
type ReceiptEnvelope = { nonce: Buffer; ciphertext: Buffer; auth_tag: Buffer };
type AuthenticatedReceipt = { receipt: ProtectedReceipt & { attemptId: string }; snapshot: ProofSnapshot; captured: string; stored: ReceiptEnvelope };
function validReceipt(value: unknown): value is ProtectedReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(',') === 'cwd,principalHash,threadId,turnId'
    && [row.threadId, row.turnId].every(id => typeof id === 'string' && /^[a-z0-9_-]{1,128}$/i.test(id))
    && typeof row.cwd === 'string' && row.cwd.length <= 4096 && isAbsolute(row.cwd) && !/[\p{Cc}\p{Cf}]/u.test(row.cwd)
    && typeof row.principalHash === 'string' && /^[a-f0-9]{64}$/.test(row.principalHash);
}
function proofMessage(fields: readonly string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const field of ['super-assistant:protected-approval:v1', ...fields]) {
    if (typeof field !== 'string' || Buffer.byteLength(field, 'utf8') > 4096) throw new Error('unavailable');
    const data = Buffer.from(field, 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    chunks.push(length, data);
  }
  const result = Buffer.concat(chunks);
  if (result.length > 8192) throw new Error('unavailable');
  return result;
}
function sameTag(left: string, right: string): boolean {
  if (!/^hmac-sha256:[a-f0-9]{64}$/.test(left) || !/^hmac-sha256:[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left.slice(12), 'hex'), Buffer.from(right.slice(12), 'hex'));
}
function validScope(input: EncryptedProposalScope): boolean {
  return !!input && typeof input === 'object' && !Array.isArray(input)
    && Object.keys(input).sort().join(',') === 'projectId,proposalVersionId,workspaceId'
    && [input.workspaceId, input.projectId, input.proposalVersionId].every(value => typeof value === 'string' && /^[a-z0-9_-]{1,128}$/i.test(value));
}
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}
/** Informational only: a CURRENT result is not a Grant or permission to execute. */
export class ProtectedProposalAuthority {
  private readonly store: EncryptedProposalStore;
  private readonly payloads: ReservedPayloadService;
  private readonly pending = new Map<string, Promise<{ attemptId: string }>>();
  constructor(private readonly db: Database.Database, vault: ReservedVault,
    private readonly clock: () => string = () => new Date().toISOString()) {
    this.payloads = new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault);
    this.store = new EncryptedProposalStore(this.payloads);
  }

  async check(input: EncryptedProposalScope): Promise<'CURRENT'> {
    if (!validScope(input) || this.db.inTransaction) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    const scope = { ...input };
    const before = this.envelope(scope);
    if (!before) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    const proposal = await this.store.read(scope);
    if (!proposal?.fullReview || this.db.inTransaction) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    const rebuilt = createH1ReviewedProposal(scope.proposalVersionId, proposal.fullReview);
    if (!isDeepStrictEqual(rebuilt, proposal) || rebuilt.workspaceId !== scope.workspaceId || rebuilt.projectId !== scope.projectId) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    try {
      return this.db.transaction(() => {
        if (this.envelope(scope) !== before || !this.current(rebuilt)) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
        return 'CURRENT' as const;
      }).immediate();
    } catch { throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE'); }
  }

  /** Main-only boundary; no production caller is connected yet. */
  confirmAndQueue(input: EncryptedProposalScope): Promise<{ attemptId: string }> {
    if (arguments.length !== 1 || !validScope(input)) return Promise.reject(new Error('PROTECTED_AUTHORITY_UNAVAILABLE'));
    const scope = { ...input };
    const key = JSON.stringify([scope.workspaceId, scope.projectId, scope.proposalVersionId]);
    const prior = this.pending.get(key);
    if (prior) return prior;
    const work = sharedPromptGate.run(() => this.confirmAndQueueOnce(scope, true), null).then(result => {
      if (result === null) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
      return result;
    });
    this.pending.set(key, work);
    void work.finally(() => { if (this.pending.get(key) === work) this.pending.delete(key); }).catch(() => undefined);
    return work;
  }

  /** Verify an existing pending Attempt; never prompt, issue or dispatch. */
  verifyQueued(input: EncryptedProposalScope): Promise<{ attemptId: string }> {
    if (arguments.length !== 1 || !validScope(input)) return Promise.reject(new Error('PROTECTED_AUTHORITY_UNAVAILABLE'));
    return this.confirmAndQueueOnce({ ...input }, false);
  }

  /** Claim is an isolated database transition, not permission to launch a worker. */
  async claimQueued(input: EncryptedProposalScope): Promise<{ attemptId: string; claimToken: string }> {
    if (arguments.length !== 1 || !validScope(input)) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    const result = await this.confirmAndQueueOnce({ ...input }, false, true);
    if (!result.claimToken) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    return { attemptId: result.attemptId, claimToken: result.claimToken };
  }

  /** Preserve uncertainty, never release the Lease or infer an external outcome. */
  quarantineClaim(input: EncryptedProposalScope, claimToken: string): boolean {
    if (arguments.length !== 2 || !validScope(input) || typeof claimToken !== 'string'
      || !/^[a-f0-9-]{36}$/i.test(claimToken) || this.db.inTransaction) return false;
    try {
      return this.db.transaction(() => {
        const row = this.db.prepare(`SELECT b.attempt_id FROM protected_execution_bindings b
          JOIN execution_attempts a ON a.attempt_id=b.attempt_id AND a.state='DISPATCH_PENDING'
          JOIN outbox o ON o.message_id='outbox:' || b.attempt_id AND o.attempt_id=b.attempt_id
            AND o.state='DISPATCHING' AND o.claim_token=?
          WHERE b.workspace_id=? AND b.project_id=? AND b.proposal_version_id=?`)
          .get(claimToken, input.workspaceId, input.projectId, input.proposalVersionId) as { attempt_id: string } | undefined;
        if (!row) return false;
        const outbox = this.db.prepare("UPDATE outbox SET state='RECONCILING',claim_token=NULL WHERE message_id=? AND state='DISPATCHING' AND claim_token=?")
          .run('outbox:' + row.attempt_id, claimToken);
        const attempt = this.db.prepare("UPDATE execution_attempts SET state='UNKNOWN' WHERE attempt_id=? AND state='DISPATCH_PENDING'")
          .run(row.attempt_id);
        if (outbox.changes !== 1 || attempt.changes !== 1) throw new Error('unavailable');
        return true;
      }).immediate();
    } catch { return false; }
  }

  /** Fixture-only building block: it does not authorize or attest a process launch. */
  async prepareReceipt(input: EncryptedProposalScope, claimToken: string, expected: { cwd: string; principalHash: string }): Promise<{
    record: (receipt: ProtectedReceipt) => boolean; markUnknown: () => boolean; dispose: () => void;
  }> {
    if (arguments.length !== 3 || !validScope(input) || typeof claimToken !== 'string'
      || !/^[a-f0-9-]{36}$/i.test(claimToken) || !expected || Object.keys(expected).sort().join(',') !== 'cwd,principalHash'
      || !validReceipt({ ...expected, threadId: 'fixture', turnId: 'fixture' }) || this.db.inTransaction) throw new Error('PROTECTED_RECEIPT_UNAVAILABLE');
    const scope = { ...input }, expectedCwd = expected.cwd, expectedPrincipal = expected.principalHash;
    const snapshot = this.proofSnapshot(scope), captured = this.envelope(scope);
    if (!snapshot || !captured || snapshot.fields[5] !== 'sha256:' + createHash('sha256').update(captured).digest('hex')
      || !sameTag(await this.tag(scope, snapshot.fields), snapshot.tag)) throw new Error('PROTECTED_RECEIPT_UNAVAILABLE');
    const attemptId = snapshot.fields[10];
    const aad = proofMessage(['receipt-v1', ...snapshot.fields, snapshot.tag]);
    let codec: Awaited<ReturnType<ReservedPayloadService['receiptCodec']>>;
    try { codec = await this.payloads.receiptCodec({ workspaceId: scope.workspaceId, projectId: scope.projectId, recordId: scope.proposalVersionId, kind: 'PROPOSAL' }); }
    catch { aad.fill(0); throw new Error('PROTECTED_RECEIPT_UNAVAILABLE'); }
    let consumed = false, closed = false;
    let persisted: ReceiptEnvelope | undefined;
    const eraseKey = () => { consumed = true; aad.fill(0); codec.dispose(); };
    const dispose = () => { closed = true; eraseKey(); };
    const claimed = () => this.db.prepare(`SELECT 1 FROM execution_attempts a JOIN outbox o ON o.attempt_id=a.attempt_id
      WHERE a.attempt_id=? AND a.work_item_id=? AND a.request_id=? AND a.idempotency_key=? AND a.state='DISPATCH_PENDING'
        AND o.message_id='outbox:'||a.attempt_id AND o.request_id=a.request_id AND o.idempotency_key=a.idempotency_key
        AND o.payload_json=json_object('attempt_id',a.attempt_id)
        AND o.message_type='start' AND o.state='DISPATCHING' AND o.claim_token=?`)
      .get(attemptId, snapshot.fields[9], snapshot.fields[12], scope.proposalVersionId, claimToken);
    try {
      if (this.db.inTransaction || this.envelope(scope) !== captured || !isDeepStrictEqual(this.proofSnapshot(scope), snapshot) || !claimed()) throw new Error('unavailable');
    } catch { dispose(); throw new Error('PROTECTED_RECEIPT_UNAVAILABLE'); }
    return {
      record: receipt => {
        if (consumed || closed) return false;
        let plain: Buffer | undefined;
        try {
          if (!validReceipt(receipt) || receipt.cwd !== expectedCwd || receipt.principalHash !== expectedPrincipal || this.db.inTransaction) return false;
          plain = Buffer.from(JSON.stringify(receipt), 'utf8');
          const sealed = codec.seal(plain, aad);
          const success = this.db.transaction(() => {
            if (this.envelope(scope) !== captured || !isDeepStrictEqual(this.proofSnapshot(scope), snapshot) || !claimed()) throw new Error('unavailable');
            this.db.prepare('INSERT INTO protected_start_receipts VALUES (?, ?, ?, ?)').run(attemptId, sealed.nonce, sealed.ciphertext, sealed.authTag);
            const ack = this.db.prepare("UPDATE outbox SET state='ACKNOWLEDGED',claim_token=NULL WHERE message_id=? AND state='DISPATCHING' AND claim_token=?")
              .run('outbox:' + attemptId, claimToken);
            const running = this.db.prepare("UPDATE execution_attempts SET state='RUNNING' WHERE attempt_id=? AND state='DISPATCH_PENDING'").run(attemptId);
            if (ack.changes !== 1 || running.changes !== 1) throw new Error('unavailable');
            return true;
          }).immediate();
          if (success) persisted = { nonce: sealed.nonce, ciphertext: sealed.ciphertext, auth_tag: sealed.authTag };
          return success;
        } catch { return false; }
        finally { plain?.fill(0); eraseKey(); }
      },
      markUnknown: () => {
        if (closed) return false;
        try {
          if (this.db.inTransaction) return false;
          if (!persisted) return this.quarantineClaim(scope, claimToken);
          return this.db.transaction(() => {
            const stored = this.db.prepare('SELECT nonce,ciphertext,auth_tag FROM protected_start_receipts WHERE attempt_id=?').get(attemptId);
            if (this.envelope(scope) !== captured || !isDeepStrictEqual(this.proofSnapshot(scope), snapshot)
              || !isDeepStrictEqual(stored, persisted)) return false;
            const ack = this.db.prepare("SELECT 1 FROM outbox WHERE message_id=? AND attempt_id=? AND state='ACKNOWLEDGED' AND claim_token IS NULL")
              .get('outbox:' + attemptId, attemptId);
            if (!ack) return false;
            return this.db.prepare("UPDATE execution_attempts SET state='UNKNOWN' WHERE attempt_id=? AND state IN ('RUNNING','CANCELLING')").run(attemptId).changes === 1;
          }).immediate();
        } catch { return false; }
        finally { dispose(); }
      }, dispose
    };
  }

  /** Read encrypted receipt only; this does not infer or update execution state. */
  async readReceipt(input: EncryptedProposalScope): Promise<({ attemptId: string } & ProtectedReceipt) | null> {
    if (arguments.length !== 1 || !validScope(input) || this.db.inTransaction) return null;
    return (await this.authenticatedReceipt({ ...input }))?.receipt ?? null;
  }

  /** Begin read-only reconciliation; never infer a terminal outcome or release a Lease. */
  async beginReconciliation(input: EncryptedProposalScope): Promise<boolean> {
    if (arguments.length !== 1 || !validScope(input) || this.db.inTransaction) return false;
    const scope = { ...input }, authenticated = await this.authenticatedReceipt(scope);
    if (!authenticated || this.db.inTransaction) return false;
    const { receipt } = authenticated;
    try {
      return this.db.transaction(() => {
        const row = this.receiptState(scope, authenticated);
        if (row?.state === 'RECONCILING') return true;
        if (row?.state !== 'UNKNOWN') return false;
        return this.db.prepare("UPDATE execution_attempts SET state='RECONCILING' WHERE attempt_id=? AND state='UNKNOWN'").run(receipt.attemptId).changes === 1;
      }).immediate();
    } catch { return false; }
  }

  /** Fixture-only cancellation intent; interruption and process termination remain separate. */
  async requestCancellation(input: EncryptedProposalScope): Promise<'STARTED' | 'ALREADY_CANCELLING' | 'DISMISSED' | 'UNAVAILABLE'> {
    if (arguments.length !== 1 || !validScope(input) || this.db.inTransaction) return 'UNAVAILABLE';
    const scope = { ...input };
    return sharedPromptGate.run(async () => {
      try {
        const authenticated = await this.authenticatedReceipt(scope);
        if (!authenticated || this.db.inTransaction) return 'UNAVAILABLE' as const;
        const initial = this.db.transaction(() => this.receiptState(scope, authenticated)).immediate();
        if (initial?.state === 'CANCELLING') return 'ALREADY_CANCELLING' as const;
        if (initial?.state !== 'RUNNING') return 'UNAVAILABLE' as const;
        const proposal = await this.store.readBound(scope, authenticated.captured);
        if (!proposal?.fullReview || !isDeepStrictEqual(proposal, createH1ReviewedProposal(scope.proposalVersionId, proposal.fullReview))) return 'UNAVAILABLE' as const;
        const taskId = authenticated.snapshot.fields[8];
        if (!taskId) return 'UNAVAILABLE' as const;
        const review = JSON.stringify({ taskId, proposal: proposal.fullReview });
        if (review.length > 8192 || /[\p{Cc}\p{Cf}]/u.test(review)) return 'UNAVAILABLE' as const;
        if (!await presentProtectedCancellation(review, taskId)) return 'DISMISSED' as const;
        const confirmed = await this.authenticatedReceipt(scope);
        if (!confirmed || !isDeepStrictEqual(confirmed, authenticated)) return 'UNAVAILABLE' as const;
        if (this.db.inTransaction) return 'UNAVAILABLE' as const;
        return this.db.transaction(() => {
          if (this.receiptState(scope, authenticated)?.state !== 'RUNNING') return 'UNAVAILABLE' as const;
          const changed = this.db.prepare("UPDATE execution_attempts SET state='CANCELLING' WHERE attempt_id=? AND state='RUNNING'")
            .run(authenticated.receipt.attemptId);
          return changed.changes === 1 ? 'STARTED' as const : 'UNAVAILABLE' as const;
        }).immediate();
      } catch { return 'UNAVAILABLE' as const; }
    }, 'UNAVAILABLE' as const);
  }

  private receiptState(scope: EncryptedProposalScope, authenticated: AuthenticatedReceipt): { state: string } | undefined {
    const { receipt, snapshot, captured, stored } = authenticated;
    const currentReceipt = this.db.prepare('SELECT nonce,ciphertext,auth_tag FROM protected_start_receipts WHERE attempt_id=?').get(receipt.attemptId);
    if (this.envelope(scope) !== captured || !isDeepStrictEqual(this.proofSnapshot(scope), snapshot) || !isDeepStrictEqual(currentReceipt, stored)) return undefined;
    return this.db.prepare(`SELECT a.state FROM protected_execution_bindings b
      JOIN workspaces ws ON ws.workspace_id=b.workspace_id AND ws.owner_id='local-owner' AND ws.status='ACTIVE'
      JOIN projects p ON p.workspace_id=b.workspace_id AND p.project_id=b.project_id AND p.status='ACTIVE'
      JOIN execution_attempts a ON a.attempt_id=b.attempt_id AND a.work_item_id=b.work_item_id
        AND a.request_id=b.request_id AND a.idempotency_key=b.proposal_version_id
      JOIN work_items w ON w.work_item_id=b.work_item_id AND w.task_id=b.task_id AND w.agent_id=b.agent_id AND w.function_id=b.function_id
      JOIN tasks t ON t.task_id=b.task_id AND t.workspace_id=b.workspace_id AND t.project_id=b.project_id
        AND t.proposal_version_id=b.proposal_version_id AND t.authorization_grant_id=b.grant_id
      JOIN authorization_grants g ON g.grant_id=b.grant_id AND g.proposal_version_id=b.proposal_version_id
        AND g.proposal_digest=b.envelope_digest AND g.actor_id='local-owner' AND g.status='CONSUMED'
      JOIN resource_leases l ON l.lease_id=b.lease_id AND l.attempt_id=a.attempt_id AND l.resource_key='project:'||b.project_id
        AND l.state='ACTIVE' AND l.fencing_token=?
      JOIN outbox o ON o.message_id='outbox:'||a.attempt_id AND o.attempt_id=a.attempt_id
        AND o.request_id=a.request_id AND o.idempotency_key=a.idempotency_key AND o.message_type='start'
        AND o.payload_json=json_object('attempt_id',a.attempt_id) AND o.state='ACKNOWLEDGED' AND o.claim_token IS NULL
      WHERE b.workspace_id=? AND b.project_id=? AND b.proposal_version_id=? AND b.attempt_id=?`)
      .get(Number(snapshot.fields[13]), scope.workspaceId, scope.projectId, scope.proposalVersionId, receipt.attemptId) as { state: string } | undefined;
  }

  private async authenticatedReceipt(scope: EncryptedProposalScope): Promise<AuthenticatedReceipt | null> {
    let codec: Awaited<ReturnType<ReservedPayloadService['receiptCodec']>> | undefined;
    let plain: Buffer | undefined, aad: Buffer | undefined;
    try {
      const snapshot = this.proofSnapshot(scope), captured = this.envelope(scope);
      if (!snapshot || !captured || snapshot.fields[5] !== 'sha256:' + createHash('sha256').update(captured).digest('hex')) return null;
      const attemptId = snapshot.fields[10];
      const read = () => this.db.prepare('SELECT nonce,ciphertext,auth_tag FROM protected_start_receipts WHERE attempt_id=?').get(attemptId) as ReceiptEnvelope | undefined;
      const stored = read();
      if (!stored || !sameTag(await this.tag(scope, snapshot.fields), snapshot.tag)) return null;
      codec = await this.payloads.receiptCodec({ workspaceId: scope.workspaceId, projectId: scope.projectId, recordId: scope.proposalVersionId, kind: 'PROPOSAL' });
      if (this.db.inTransaction || this.envelope(scope) !== captured || !isDeepStrictEqual(this.proofSnapshot(scope), snapshot) || !isDeepStrictEqual(read(), stored)) return null;
      aad = proofMessage(['receipt-v1', ...snapshot.fields, snapshot.tag]);
      plain = codec.open({ nonce: stored.nonce, ciphertext: stored.ciphertext, authTag: stored.auth_tag }, aad);
      const receipt: unknown = JSON.parse(plain.toString('utf8'));
      return validReceipt(receipt) && attemptId ? { receipt: { attemptId, ...receipt }, snapshot, captured, stored } : null;
    } catch { return null; }
    finally { plain?.fill(0); aad?.fill(0); codec?.dispose(); }
  }

  private async confirmAndQueueOnce(scope: EncryptedProposalScope, allowCreate: boolean, claim = false): Promise<{ attemptId: string; claimToken?: string }> {
    try {
      if (this.db.inTransaction) throw new Error('unavailable');
      const observed = instant(this.clock());
      if (observed === null) throw new Error('unavailable');
      const project = this.project(scope);
      if (!project) {
        await this.preserveObservedLease(scope, observed);
        throw new Error('unavailable');
      }
      let executable: Awaited<ReturnType<typeof fingerprintExecutable>>;
      try { executable = await fingerprintExecutable(project.executable_path); }
      catch {
        await this.preserveObservedLease(scope, observed);
        throw new Error('unavailable');
      }
      const captured = this.envelope(scope);
      if (!captured) throw new Error('unavailable');
      const proposal = await this.store.read(scope);
      if (!proposal?.fullReview || !isDeepStrictEqual(proposal, createH1ReviewedProposal(scope.proposalVersionId, proposal.fullReview))
        || proposal.workspaceId !== scope.workspaceId || proposal.projectId !== scope.projectId) throw new Error('unavailable');
      try {
        if (await readProjectHeadAsync(project.canonical_path) !== proposal.baselineCommit
          || !isDeepStrictEqual(await fingerprintExecutable(project.executable_path), executable)) throw new Error('unavailable');
      } catch {
        await this.preserveObservedLease(scope, observed);
        throw new Error('unavailable');
      }
      const executionIdentity = {
        projectPath: project.canonical_path, projectVersion: project.row_version,
        agentGeneration: project.agent_row_version, executablePath: project.executable_path,
        executableVersion: project.observed_version, executableSha256: executable.hash,
        executableFile: { dev: executable.dev, ino: executable.ino, size: executable.size, modified: executable.modified, changed: executable.changed },
        registrationUpdated: project.updated_at, baselineCommit: proposal.baselineCommit
      };
      const contextDigest = 'sha256:' + createHash('sha256').update(JSON.stringify(executionIdentity)).digest('hex');
      const review = JSON.stringify({ proposal: proposal.fullReview, executionIdentity });
      if (review.length > 8192 || /[\p{Cc}\p{Cf}]/u.test(review)) throw new Error('unavailable');
      const fingerprint = 'sha256:' + createHash('sha256').update(captured).digest('hex');
      if (this.db.inTransaction) throw new Error('unavailable');
      let maxObserved = observed;
      let initial: { hasBinding: boolean; time: number; rolledBack: boolean };
      try { initial = this.db.transaction(() => {
        const transactionTime = this.clock();
        const time = instant(transactionTime);
        if (time !== null) maxObserved = Math.max(maxObserved, time);
        if (time === null || this.envelope(scope) !== captured
          || !isDeepStrictEqual(this.project(scope), project)) throw new Error('unavailable');
        const hasBinding = !!this.db.prepare('SELECT 1 FROM protected_execution_bindings WHERE proposal_version_id=?').get(scope.proposalVersionId);
        return { hasBinding, time: Math.max(time, observed), rolledBack: time < observed };
      }).immediate(); } catch {
        await this.preserveObservedLease(scope, maxObserved);
        throw new Error('unavailable');
      }
      if (initial.hasBinding) {
        const snapshot = this.proofSnapshot(scope);
        if (!snapshot || snapshot.fields[5] !== fingerprint || snapshot.fields[6] !== contextDigest) {
          await this.preserveObservedLease(scope, initial.time);
          throw new Error('unavailable');
        }
        const tag = await this.tag(scope, snapshot.fields);
        if (!sameTag(tag, snapshot.tag) || this.db.inTransaction) throw new Error('unavailable');
        let replay: ExistingResult;
        try { replay = this.db.transaction(() => {
          const transactionTime = this.clock();
          const time = instant(transactionTime);
          if (time === null) throw new Error('unavailable');
          maxObserved = Math.max(maxObserved, time);
          const effectiveTime = new Date(Math.max(time, initial.time)).toISOString();
          if (this.envelope(scope) !== captured || !isDeepStrictEqual(this.project(scope), project)
            || !isDeepStrictEqual(this.proofSnapshot(scope), snapshot)) throw new Error('unavailable');
          const leaseId = snapshot.fields[11], attemptId = snapshot.fields[10], token = Number(snapshot.fields[13]);
          if (!leaseId || !attemptId || !Number.isSafeInteger(token) || token <= 0) throw new Error('unavailable');
          const writable = new SqliteResourceLeaseRepository(this.db, () => effectiveTime).canWrite({ leaseId, attemptId, fencingToken: token });
          if (!writable || initial.rolledBack || time < initial.time || !this.executable(proposal, effectiveTime)) return { unavailable: true } as const;
          let checked: ExistingResult;
          try { checked = this.existing(scope, fingerprint, contextDigest, proposal); }
          catch { return { unavailable: true } as const; }
          if (!claim || !checked || 'unavailable' in checked) return checked;
          const lease = this.db.prepare(`SELECT l.lease_id,l.fencing_token FROM protected_execution_bindings b
            JOIN resource_leases l ON l.lease_id=b.lease_id WHERE b.attempt_id=?`).get(checked.attemptId) as { lease_id: string; fencing_token: number } | undefined;
          if (!lease) throw new Error('unavailable');
          const collision = this.db.prepare(`SELECT 1 FROM resource_leases WHERE resource_key IN (?, ?)
            AND lease_id<>? AND state<>'RELEASED' LIMIT 1`)
            .get('project:' + scope.projectId, 'worktree:' + scope.projectId, lease.lease_id);
          const highest = this.db.prepare('SELECT MAX(fencing_token) AS value FROM resource_leases WHERE resource_key IN (?, ?)')
            .get('project:' + scope.projectId, 'worktree:' + scope.projectId) as { value: number | null };
          if (collision || highest.value !== lease.fencing_token) return { unavailable: true } as const;
          const claimToken = randomUUID();
          const updated = this.db.prepare(`UPDATE outbox SET state='DISPATCHING',claim_token=?
            WHERE message_id=? AND attempt_id=? AND state='PENDING' AND claim_token IS NULL`)
            .run(claimToken, 'outbox:' + checked.attemptId, checked.attemptId);
          if (updated.changes !== 1) return { unavailable: true } as const;
          return { attemptId: checked.attemptId, claimToken };
        }).immediate(); } catch {
          await this.preserveObservedLease(scope, maxObserved);
          throw new Error('unavailable');
        }
        if (!replay || 'unavailable' in replay || replay.attemptId !== snapshot.fields[10]) throw new Error('unavailable');
        return replay;
      }
      if (!allowCreate || initial.rolledBack || !this.executable(proposal, new Date(initial.time).toISOString())) throw new Error('unavailable');
      if (await presentProtectedConsent(review) !== true || await readProjectHeadAsync(project.canonical_path) !== proposal.baselineCommit
        || !isDeepStrictEqual(await fingerprintExecutable(project.executable_path), executable)) throw new Error('unavailable');
      if (this.db.inTransaction) throw new Error('unavailable');
      const now = this.clock();
      const at = instant(now);
      if (at === null || at < initial.time || !this.current(proposal, now)) throw new Error('unavailable');
      const ids = { grant: randomUUID(), task: randomUUID(), work: randomUUID(), attempt: randomUUID(), lease: randomUUID(), request: randomUUID() };
      const resource = 'project:' + proposal.projectId;
      const latest = this.db.prepare('SELECT COALESCE(MAX(fencing_token),0) AS value FROM resource_leases WHERE resource_key IN (?, ?)')
        .get(resource, 'worktree:' + proposal.projectId) as { value: number };
      if (!Number.isSafeInteger(latest.value) || latest.value >= Number.MAX_SAFE_INTEGER) throw new Error('unavailable');
      const fields = [scope.workspaceId, scope.projectId, scope.proposalVersionId, proposal.agentId, proposal.functionId,
        fingerprint, contextDigest, ids.grant, ids.task, ids.work, ids.attempt, ids.lease, ids.request, String(latest.value + 1),
        'local-owner', scope.proposalVersionId, JSON.stringify(proposal.actions), now, now, proposal.expiresAt];
      const approvalTag = await this.tag(scope, fields);
      if (this.db.inTransaction) throw new Error('unavailable');
      const result = this.db.transaction((): Exclude<ExistingResult, null> => {
        const checkedAt = instant(this.clock());
        const committedTime = this.clock();
        const committedAt = instant(committedTime);
        if (checkedAt === null || committedAt === null || checkedAt < at || committedAt < checkedAt || committedAt >= at + 30_000
          || this.envelope(scope) !== captured || !this.executable(proposal, committedTime)
          || !isDeepStrictEqual(this.project(scope), project)) throw new Error('unavailable');
        const concurrent = this.existing(scope, fingerprint, contextDigest, proposal);
        if (concurrent) throw new Error('unavailable');
        const latestNow = this.db.prepare('SELECT COALESCE(MAX(fencing_token),0) AS value FROM resource_leases WHERE resource_key IN (?, ?)')
          .get(resource, 'worktree:' + proposal.projectId) as { value: number };
        if (latestNow.value !== latest.value) throw new Error('unavailable');
        this.db.prepare('INSERT INTO protected_execution_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(scope.proposalVersionId, scope.workspaceId, scope.projectId, proposal.agentId, proposal.functionId, fingerprint, ids.grant, ids.task, ids.work, ids.attempt, ids.lease, ids.request, now);
        this.db.prepare('INSERT INTO protected_execution_context VALUES (?, ?, ?)').run(scope.proposalVersionId, contextDigest, approvalTag);
        this.db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(ids.grant, scope.proposalVersionId, fingerprint, 'local-owner', scope.proposalVersionId, JSON.stringify(proposal.actions), 'CONSUMED', now, proposal.expiresAt);
        this.db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(ids.task, scope.workspaceId, scope.projectId, scope.proposalVersionId, ids.grant, 'QUEUED', now);
        this.db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run(ids.work, ids.task, proposal.agentId, proposal.functionId, 'WAITING');
        this.db.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(ids.attempt, ids.work, ids.request, scope.proposalVersionId, 'DISPATCH_PENDING', 0, now);
        new SqliteResourceLeaseRepository(this.db, this.clock).acquire({ leaseId: ids.lease, resourceKey: resource, attemptId: ids.attempt, fencingToken: latest.value + 1, createdAt: now });
        this.db.prepare('INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run('outbox:' + ids.attempt, ids.attempt, ids.request, scope.proposalVersionId, 'start', JSON.stringify({ attempt_id: ids.attempt }), 'PENDING', now);
        return { attemptId: ids.attempt };
      }).immediate();
      if ('unavailable' in result) throw new Error('unavailable');
      return result;
    } catch { throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE'); }
  }

  /** Preserve only a MAC-authenticated existing Lease; this never grants dispatch. */
  private async preserveObservedLease(scope: EncryptedProposalScope, observed: number): Promise<void> {
    try {
      if (this.db.inTransaction) return;
      const captured = this.envelope(scope), snapshot = this.proofSnapshot(scope);
      if (!captured || !snapshot || snapshot.fields[5] !== 'sha256:' + createHash('sha256').update(captured).digest('hex')) return;
      const tag = await this.tag(scope, snapshot.fields);
      if (!sameTag(tag, snapshot.tag) || this.db.inTransaction) return;
      this.db.transaction(() => {
        if (this.envelope(scope) !== captured || !isDeepStrictEqual(this.proofSnapshot(scope), snapshot)) return;
        const leaseId = snapshot.fields[11], attemptId = snapshot.fields[10], token = Number(snapshot.fields[13]);
        if (!leaseId || !attemptId || !Number.isSafeInteger(token) || token <= 0) return;
        new SqliteResourceLeaseRepository(this.db, () => new Date(observed).toISOString()).canWrite({ leaseId, attemptId, fencingToken: token });
      }).immediate();
    } catch { /* A failed verification cannot advance a lease or authorize execution. */ }
  }

  private executable(proposal: ProposalVersion, transactionTime?: string): boolean {
    const review = proposal.fullReview;
    return !!review && this.current(proposal, transactionTime)
      && isBuiltinCodexFunction(this.db, proposal.workspaceId, proposal.agentId, proposal.functionId, proposal.functionVersion)
      && review.capabilities.length === 1 && review.capabilities[0]?.id === 'codex-file-write' && review.capabilities[0].version === '1'
      && review.allowedActions.length === 1 && review.allowedActions[0] === 'FILE_WRITE'
      && review.resources.length === 1 && review.resources[0]?.key === 'project:' + proposal.projectId && review.resources[0].intent === 'WRITE'
      && review.workItems.length === 1 && review.workItems[0]?.required === true && review.workItems[0].dependencies.length === 0;
  }

  private project(scope: EncryptedProposalScope): { canonical_path: string; row_version: number; agent_row_version: number; executable_path: string; observed_version: string; updated_at: string } | undefined {
    return this.db.prepare(`SELECT p.canonical_path,p.row_version,a.row_version AS agent_row_version,
      r.executable_path,r.observed_version,r.updated_at
      FROM projects p JOIN agents a ON a.agent_id=p.default_agent_id AND a.workspace_id=p.workspace_id
      JOIN local_codex_registrations r ON r.agent_id=a.agent_id AND r.workspace_id=a.workspace_id
      WHERE p.workspace_id=? AND p.project_id=? AND p.status='ACTIVE'`)
      .get(scope.workspaceId, scope.projectId) as { canonical_path: string; row_version: number; agent_row_version: number; executable_path: string; observed_version: string; updated_at: string } | undefined;
  }

  private proofSnapshot(scope: EncryptedProposalScope): ProofSnapshot | null {
    const row = this.db.prepare(`SELECT b.workspace_id,b.project_id,b.proposal_version_id,b.agent_id,b.function_id,
      b.envelope_digest,c.context_digest,c.approval_tag,b.grant_id,b.task_id,b.work_item_id,b.attempt_id,b.lease_id,b.request_id,
      l.fencing_token,g.actor_id,g.idempotency_key,g.actions_json,b.created_at,g.issued_at,g.expires_at
      FROM protected_execution_bindings b JOIN protected_execution_context c ON c.proposal_version_id=b.proposal_version_id
      JOIN authorization_grants g ON g.grant_id=b.grant_id JOIN resource_leases l ON l.lease_id=b.lease_id
      WHERE b.proposal_version_id=? AND b.workspace_id=? AND b.project_id=?`).get(scope.proposalVersionId, scope.workspaceId, scope.projectId) as Record<string, unknown> | undefined;
    if (!row || typeof row.approval_tag !== 'string' || !Number.isSafeInteger(row.fencing_token) || (row.fencing_token as number) <= 0) return null;
    const keys = ['workspace_id','project_id','proposal_version_id','agent_id','function_id','envelope_digest','context_digest',
      'grant_id','task_id','work_item_id','attempt_id','lease_id','request_id','fencing_token','actor_id','idempotency_key','actions_json','created_at','issued_at','expires_at'];
    const fields = keys.map(key => key === 'fencing_token' ? String(row[key]) : row[key]);
    if (fields.some(value => typeof value !== 'string')) return null;
    return { fields: fields as string[], tag: row.approval_tag };
  }

  private async tag(scope: EncryptedProposalScope, fields: readonly string[]): Promise<string> {
    const message = proofMessage(fields);
    try {
      return await this.payloads.approvalTag({ workspaceId: scope.workspaceId, projectId: scope.projectId,
        recordId: scope.proposalVersionId, kind: 'PROPOSAL' }, message);
    } finally { message.fill(0); }
  }

  private existing(scope: EncryptedProposalScope, fingerprint: string, contextDigest: string, proposal: ProposalVersion): ExistingResult {
    const rows = this.db.prepare(`SELECT b.attempt_id,l.lease_id,l.fencing_token FROM protected_execution_bindings b
      JOIN protected_execution_context c ON c.proposal_version_id=b.proposal_version_id AND c.context_digest=?
      JOIN authorization_grants g ON g.grant_id=b.grant_id AND g.proposal_version_id=b.proposal_version_id AND g.proposal_digest=b.envelope_digest AND g.status='CONSUMED'
        AND g.actor_id='local-owner' AND g.idempotency_key=b.proposal_version_id AND g.actions_json=? AND g.issued_at=b.created_at AND g.expires_at=?
      JOIN tasks t ON t.task_id=b.task_id AND t.authorization_grant_id=b.grant_id AND t.proposal_version_id=b.proposal_version_id
        AND t.workspace_id=b.workspace_id AND t.project_id=b.project_id AND t.state='QUEUED'
      JOIN work_items w ON w.work_item_id=b.work_item_id AND w.task_id=t.task_id AND w.agent_id=b.agent_id AND w.function_id=b.function_id AND w.state='WAITING'
      JOIN execution_attempts a ON a.attempt_id=b.attempt_id AND a.work_item_id=w.work_item_id AND a.request_id=b.request_id AND a.idempotency_key=b.proposal_version_id AND a.state='DISPATCH_PENDING'
      JOIN resource_leases l ON l.lease_id=b.lease_id AND l.attempt_id=a.attempt_id AND l.resource_key='project:' || b.project_id AND l.state='ACTIVE'
      JOIN outbox o ON o.attempt_id=a.attempt_id AND o.request_id=b.request_id AND o.message_id='outbox:' || a.attempt_id
        AND o.idempotency_key=b.proposal_version_id AND o.message_type='start' AND o.state='PENDING' AND o.payload_json=json_object('attempt_id',a.attempt_id)
      WHERE b.proposal_version_id=? AND b.workspace_id=? AND b.project_id=? AND b.envelope_digest=? AND b.agent_id=? AND b.function_id=?`).all(contextDigest, JSON.stringify(proposal.actions), proposal.expiresAt, scope.proposalVersionId, scope.workspaceId, scope.projectId, fingerprint, proposal.agentId, proposal.functionId) as { attempt_id: string; lease_id: string; fencing_token: number }[];
    const binding = this.db.prepare('SELECT 1 FROM protected_execution_bindings WHERE proposal_version_id=?').get(scope.proposalVersionId);
    if (rows.length === 1 && rows[0]) {
      const row = rows[0];
      return { attemptId: row.attempt_id };
    }
    if (binding) throw new Error('unavailable');
    return null;
  }

  private envelope(scope: EncryptedProposalScope): string | null {
    const row = this.db.prepare(`
      SELECT p.record_id,p.workspace_id,p.project_id,p.content_kind,p.format_version,p.key_ref,p.nonce,p.ciphertext,p.auth_tag,p.created_at,
        r.owner_hash,r.state AS reservation_state,r.created_at AS reservation_created,r.updated_at AS reservation_updated
      FROM protected_payloads p JOIN protected_key_reservations r ON r.record_id=p.record_id AND r.workspace_id=p.workspace_id
        AND r.project_id=p.project_id AND r.key_ref=p.key_ref
      WHERE p.record_id=? AND p.workspace_id=? AND p.project_id=? AND p.content_kind='PROPOSAL' AND r.state='LINKED'
    `).get(scope.proposalVersionId, scope.workspaceId, scope.projectId) as Envelope | undefined;
    if (!row || row.format_version !== 1 || !Buffer.isBuffer(row.nonce) || row.nonce.length !== 12
      || !Buffer.isBuffer(row.auth_tag) || row.auth_tag.length !== 16 || !Buffer.isBuffer(row.ciphertext)
      || row.ciphertext.length < 1 || row.ciphertext.length > 65536 || !/^[a-f0-9]{64}$/.test(row.owner_hash)
      || !/^pkey-[a-f0-9]{64}$/.test(row.key_ref)) return null;
    return JSON.stringify([row.record_id, row.workspace_id, row.project_id, row.content_kind, row.format_version, row.key_ref,
      row.nonce.toString('base64'), row.ciphertext.toString('base64'), row.auth_tag.toString('base64'), row.created_at,
      row.owner_hash, row.reservation_state, row.reservation_created, row.reservation_updated]);
  }

  private current(proposal: ProposalVersion, transactionTime?: string): boolean {
    const now = instant(transactionTime ?? this.clock()), created = instant(proposal.createdAt), expires = instant(proposal.expiresAt);
    const deadline = instant(proposal.fullReview?.deadlineAt);
    if (now === null || created === null || expires === null || deadline === null || now < created || now >= expires || now >= deadline) return false;
    const row = this.db.prepare(`
      SELECT p.snapshot_version,a.agent_version,a.connection,a.availability,f.function_version,f.lifecycle
      FROM workspaces w JOIN projects p ON p.workspace_id=w.workspace_id
      JOIN agents a ON a.workspace_id=w.workspace_id AND a.agent_id=?
      JOIN functions f ON f.agent_id=a.agent_id AND f.function_id=?
      WHERE w.workspace_id=? AND w.owner_id='local-owner' AND w.status='ACTIVE'
        AND p.project_id=? AND p.status='ACTIVE' AND p.default_agent_id=a.agent_id
    `).get(proposal.agentId, proposal.functionId, proposal.workspaceId, proposal.projectId) as { snapshot_version: number; agent_version: string; connection: string; availability: string; function_version: string; lifecycle: string } | undefined;
    return !!row && String(row.snapshot_version) === proposal.projectSnapshotVersion && row.agent_version === proposal.agentVersion
      && row.connection === 'CONNECTED' && row.availability === 'AVAILABLE'
      && row.function_version === proposal.functionVersion && row.lifecycle === 'ACTIVE';
  }
}
