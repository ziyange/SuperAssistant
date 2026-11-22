/* eslint-disable no-unused-vars -- callback arguments document the private worker contract. */
import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createH1ReviewedProposal, createProposalVersion } from '@super-assistant/domain';
import { SqliteOutboxRepository, SqliteProposalRepository } from '@super-assistant/persistence';
import { findLocalWorkspace } from './local-workspace.js';

interface Runtime { executable: string; binaryHash: string; version: string; principalHash: string }
interface Start { attemptId: string; claim: string; threadId: string; turnId: string; cwd: string }
type Observer = (thread: string, turn: string, cwd: string) => Promise<'COMPLETED' | 'FAILED' | 'INDETERMINATE'>;
interface Receipt { attempt_id: string; thread_id: string; turn_id: string; worktree_path: string; proposal_digest: string }
type Authority = { proposal_version_id: string; digest: string; last_sequence: number; claim_token: string | null; attempt_state: string; outbox_state: string };

const validRuntime = (runtime: Runtime) => runtime.version === '0.121.0' && isAbsolute(runtime.executable)
  && [runtime.binaryHash,runtime.principalHash].every(hash=>typeof hash==='string' && hash.length===64 && !/[^0-9a-f]/.test(hash));
const claimHash = (attemptId: string, claim: string) => createHash('sha256').update('codex-start-claim-v1:' + attemptId + ':' + claim).digest('hex');

export class CodexAttemptRecovery {
  constructor(private readonly db: Database.Database) {}

  /**
   * Called only by the private owner of this start claim. It persists an
   * uncertain outcome without replaying the operation or releasing its lease.
   */
  markUnknown(runtime: Runtime, input: { attemptId: string; claim: string }): boolean {
    try {
      if (!validRuntime(runtime) || !/^[a-z0-9_-]{1,128}$/i.test(input.attemptId)
        || !/^[a-z0-9_-]{1,128}$/i.test(input.claim)) return false;
      return this.db.transaction(() => {
        const row = this.db.prepare(`
          SELECT a.state AS attempt_state,o.state AS outbox_state,o.claim_token,
                 r.executable_path,r.binary_hash,r.principal_hash,r.claim_hash
          FROM execution_attempts a JOIN work_items w USING(work_item_id)
          JOIN tasks t USING(task_id) JOIN workspaces ws ON ws.workspace_id=t.workspace_id
          JOIN proposal_versions p ON p.proposal_version_id=t.proposal_version_id
            AND p.workspace_id=t.workspace_id AND p.project_id=t.project_id
            AND p.agent_id=w.agent_id AND p.function_id=w.function_id
          JOIN authorization_grants g ON g.grant_id=t.authorization_grant_id
            AND g.proposal_version_id=p.proposal_version_id AND g.proposal_digest=p.digest
            AND g.actor_id='local-owner' AND g.status='CONSUMED'
          JOIN outbox o ON o.attempt_id=a.attempt_id AND o.message_id='outbox:'||a.attempt_id
            AND o.message_type='start' AND o.request_id=a.request_id AND o.idempotency_key=a.idempotency_key
          LEFT JOIN codex_start_receipts r ON r.attempt_id=a.attempt_id AND r.proposal_digest=p.digest
          WHERE a.attempt_id=? AND ws.owner_id='local-owner' AND ws.status IN ('ACTIVE','LOCKED')
            AND p.agent_version=?
            AND NOT EXISTS (SELECT 1 FROM fixture_attempt_correlations f WHERE f.attempt_id=a.attempt_id)
        `).get(input.attemptId, runtime.version) as { attempt_state: string; outbox_state: string; claim_token: string | null;
          executable_path: string | null; binary_hash: string | null; principal_hash: string | null; claim_hash: string | null } | undefined;
        if (!row) return false;
        const quarantineOtherMessages = () => {
          this.db.prepare("UPDATE outbox SET state='RECONCILING',claim_token=NULL WHERE attempt_id=? AND message_id<>? AND state IN ('PENDING','DISPATCHING')")
            .run(input.attemptId, 'outbox:' + input.attemptId);
        };
        if (row.outbox_state === 'DISPATCHING' && row.claim_token === input.claim && row.executable_path === null
          && row.attempt_state === 'DISPATCH_PENDING') {
          if (!new SqliteOutboxRepository(this.db).markUncertain('outbox:' + input.attemptId, input.claim)) return false;
          quarantineOtherMessages();
          return true;
        }
        if (row.outbox_state !== 'ACKNOWLEDGED' || row.claim_token !== null || row.executable_path !== runtime.executable
          || row.binary_hash !== runtime.binaryHash || row.principal_hash !== runtime.principalHash
          || row.claim_hash !== claimHash(input.attemptId, input.claim)) return false;
        if (row.attempt_state === 'UNKNOWN') { quarantineOtherMessages(); return true; }
        if (!['RUNNING', 'CANCELLING', 'WAITING_USER', 'WAITING_INPUT'].includes(row.attempt_state)) return false;
        if (this.db.prepare('UPDATE execution_attempts SET state=? WHERE attempt_id=? AND state=?')
          .run('UNKNOWN', input.attemptId, row.attempt_state).changes !== 1) return false;
        quarantineOtherMessages();
        return true;
      }).immediate();
    } catch { return false; }
  }

  private authority(runtime: Runtime, attemptId: string): Authority | undefined {
    const workspace = findLocalWorkspace(this.db);
    if (!workspace || !validRuntime(runtime)) return;
    const row = this.db.prepare(`
      SELECT p.proposal_version_id,p.digest,a.last_sequence,a.state AS attempt_state,o.state AS outbox_state,o.claim_token
      FROM execution_attempts a JOIN work_items w USING(work_item_id) JOIN tasks t USING(task_id)
      JOIN proposal_versions p ON p.proposal_version_id=t.proposal_version_id AND p.workspace_id=t.workspace_id
        AND p.project_id=t.project_id AND p.agent_id=w.agent_id AND p.function_id=w.function_id
      JOIN authorization_grants g ON g.grant_id=t.authorization_grant_id AND g.proposal_version_id=p.proposal_version_id
        AND g.actor_id='local-owner' AND g.status='CONSUMED' AND g.proposal_digest=p.digest
      JOIN local_codex_registrations r ON r.agent_id=p.agent_id AND r.workspace_id=t.workspace_id AND r.observed_version=p.agent_version
      JOIN agents agent ON agent.agent_id=r.agent_id AND agent.workspace_id=r.workspace_id AND agent.connection<>'DISABLED'
      JOIN outbox o ON o.attempt_id=a.attempt_id AND o.message_id='outbox:'||a.attempt_id AND o.message_type='start'
        AND o.request_id=a.request_id AND o.idempotency_key=a.idempotency_key
      WHERE a.attempt_id=? AND t.workspace_id=? AND r.executable_path=? AND r.observed_version=?
        AND NOT EXISTS (SELECT 1 FROM fixture_attempt_correlations f WHERE f.attempt_id=a.attempt_id)
        AND NOT EXISTS (SELECT 1 FROM outbox other WHERE other.attempt_id=a.attempt_id AND other.message_id<>o.message_id)
    `).get(attemptId,workspace,runtime.executable,runtime.version) as Authority | undefined;
    if (!row) return;
    const stored=new SqliteProposalRepository(this.db).get(row.proposal_version_id);
    if (!stored?.fullReview) return;
    const { digest, ...fields }=stored;
    return createProposalVersion(fields).digest === digest && createH1ReviewedProposal(stored.proposalVersionId,stored.fullReview).digest === digest ? row : undefined;
  }

  /** Private dispatcher boundary: IDs/cwd from the owned launch, never from renderer or a discovery fixture. */
  recordStart(runtime: Runtime, receipt: Start): void {
    if (!isAbsolute(receipt.cwd) || !/^[a-z0-9_-]{1,128}$/i.test(receipt.claim) || [receipt.threadId,receipt.turnId].some(id=>!id || id.length>128 || /[^a-z0-9_-]/i.test(id))) throw new Error('INVALID_RECEIPT');
    this.db.transaction(()=>{
      const row=this.authority(runtime,receipt.attemptId);
      if (!row || row.attempt_state !== 'DISPATCH_PENDING' || row.last_sequence !== 0 || row.outbox_state !== 'DISPATCHING' || row.claim_token !== receipt.claim) throw new Error('START_CLAIM_LOST');
      this.db.prepare('INSERT INTO codex_start_receipts(attempt_id,proposal_digest,executable_path,binary_hash,thread_id,turn_id,worktree_path,principal_hash,claim_hash) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(receipt.attemptId,row.digest,runtime.executable,runtime.binaryHash,receipt.threadId,receipt.turnId,receipt.cwd,runtime.principalHash,claimHash(receipt.attemptId,receipt.claim));
      if (!new SqliteOutboxRepository(this.db).acknowledge('outbox:'+receipt.attemptId,receipt.claim)
        || this.db.prepare("UPDATE execution_attempts SET state='RUNNING' WHERE attempt_id=? AND state='DISPATCH_PENDING'").run(receipt.attemptId).changes!==1) throw new Error('START_CLAIM_LOST');
    }).immediate();
  }

  async reconcile(runtime: Runtime, observe: Observer): Promise<void> {
    const workspace=findLocalWorkspace(this.db);
    if (!workspace || !validRuntime(runtime)) return;
    const receipts=this.db.prepare(`SELECT r.attempt_id,r.thread_id,r.turn_id,r.worktree_path,r.proposal_digest FROM codex_start_receipts r
      JOIN execution_attempts a USING(attempt_id) JOIN work_items w USING(work_item_id) JOIN tasks t USING(task_id)
      WHERE r.executable_path=? AND r.binary_hash=? AND r.principal_hash=? AND t.workspace_id=? AND a.state IN ('UNKNOWN','RECONCILING') ORDER BY r.attempt_id`).all(runtime.executable,runtime.binaryHash,runtime.principalHash,workspace) as Receipt[];
    for (const r of receipts) {
      try {
        const eligible=() => {
          const a=this.authority(runtime,r.attempt_id);
          return a && (a.attempt_state==='UNKNOWN'||a.attempt_state==='RECONCILING') && a.outbox_state==='ACKNOWLEDGED'
            && a.claim_token===null && a.digest===r.proposal_digest ? a : undefined;
        };
        const before=eligible(); if (!before) continue;
        const outcome=await observe(r.thread_id,r.turn_id,r.worktree_path);
        if (outcome!=='COMPLETED' && outcome!=='FAILED') continue;
        this.db.transaction(()=>{
          const current=eligible(); if (!current || current.last_sequence!==before.last_sequence || current.attempt_state!==before.attempt_state) return;
          this.db.prepare("UPDATE execution_attempts SET state=? WHERE attempt_id=? AND state=? AND last_sequence=?").run(outcome==='COMPLETED'?'SUCCEEDED':'FAILED',r.attempt_id,current.attempt_state,current.last_sequence);
        }).immediate();
      } catch { /* No observation, malformed authority or concurrent change: retain uncertainty. */ }
    }
  }
}
