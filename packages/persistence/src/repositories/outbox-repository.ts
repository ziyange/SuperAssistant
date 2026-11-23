/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { classifyGoalActions, createH1ReviewedProposal, createProposalVersion, type GoalAction } from '@super-assistant/domain';
import { SqliteProposalRepository } from './proposal-repository.js';
import { SqliteResourceLeaseRepository } from './resource-lease-repository.js';

type ClaimedMessage =
  | { messageId: string; attemptId: string; claimToken: string; kind: 'start'; payload: { attemptId: string } }
  | { messageId: string; attemptId: string; claimToken: string; kind: 'resume'; payload: { attemptId: string; decisionId: string; resolutionId: string } };

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value;
}

export class SqliteOutboxRepository {
  constructor(private readonly database: Database.Database, private readonly clock: () => string = () => new Date().toISOString()) {}
  authorizeResume(message: Extract<ClaimedMessage, { kind: 'resume' }>): { option: 'ALLOW' | 'DENY' } | null {
    if (this.database.inTransaction || !message || message.kind !== 'resume'
      || ![message.attemptId, message.claimToken, message.payload?.attemptId,
        message.payload?.decisionId, message.payload?.resolutionId].every(validIdentifier)
      || message.attemptId !== message.payload.attemptId
      || message.messageId !== `resume:${message.payload.decisionId}`) return null;
    try {
      return this.database.transaction(() => {
        const row = this.database.prepare(`
          SELECT o.payload_json, o.request_id, o.idempotency_key, a.request_id AS attempt_request,
            d.resolution_option, d.resolution_actor_id, d.resolved_at, ws.owner_id,
            p.proposal_version_id, p.project_snapshot_version, p.agent_version AS approved_agent,
            p.function_version AS approved_function, g.actions_json, g.issued_at, g.expires_at,
            pr.snapshot_version, ag.agent_version, ag.connection, ag.availability,
            f.function_version, f.lifecycle, t.project_id, w.work_item_id
          FROM outbox o
          JOIN execution_attempts a ON a.attempt_id=o.attempt_id AND a.state IN ('WAITING_USER','WAITING_INPUT')
          JOIN work_items w ON w.work_item_id=a.work_item_id
          JOIN tasks t ON t.task_id=w.task_id AND t.state IN ('QUEUED','RUNNING')
          JOIN workspaces ws ON ws.workspace_id=t.workspace_id AND ws.status='ACTIVE'
          JOIN projects pr ON pr.project_id=t.project_id AND pr.workspace_id=t.workspace_id AND pr.status='ACTIVE'
          JOIN proposal_versions p ON p.proposal_version_id=t.proposal_version_id AND p.workspace_id=t.workspace_id
            AND p.project_id=t.project_id AND p.agent_id=w.agent_id AND p.function_id=w.function_id
          JOIN authorization_grants g ON g.grant_id=t.authorization_grant_id AND g.proposal_version_id=p.proposal_version_id
            AND g.proposal_digest=p.digest AND g.actor_id=ws.owner_id AND g.status='CONSUMED'
          JOIN agents ag ON ag.agent_id=w.agent_id AND ag.workspace_id=t.workspace_id
          JOIN functions f ON f.function_id=w.function_id AND f.agent_id=ag.agent_id
          JOIN decisions d ON d.decision_id=? AND d.work_item_id=w.work_item_id AND d.task_id=t.task_id
            AND d.workspace_id=t.workspace_id AND d.project_id=t.project_id AND d.status='RESOLVED'
            AND d.resolution_id=? AND d.resolution_key=o.idempotency_key AND d.resolution_actor_id=ws.owner_id
          WHERE o.message_id=? AND o.attempt_id=? AND o.message_type='resume'
            AND o.state='DISPATCHING' AND o.claim_token=?
        `).get(message.payload.decisionId, message.payload.resolutionId, message.messageId, message.attemptId, message.claimToken) as Record<string, unknown> | undefined;
        if (!row || row.request_id !== row.attempt_request || !validIdentifier(row.request_id)
          || !validIdentifier(row.idempotency_key) || (row.resolution_option !== 'ALLOW' && row.resolution_option !== 'DENY')) return null;
        const payload: unknown = JSON.parse(String(row.payload_json));
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || Object.keys(payload).sort().join(',') !== 'attempt_id,decision_id,resolution_id'
          || (payload as Record<string, unknown>).attempt_id !== message.attemptId
          || (payload as Record<string, unknown>).decision_id !== message.payload.decisionId
          || (payload as Record<string, unknown>).resolution_id !== message.payload.resolutionId) return null;
        const attempts = this.database.prepare('SELECT attempt_id FROM execution_attempts WHERE work_item_id=? LIMIT 2').all(row.work_item_id) as { attempt_id: string }[];
        if (attempts.length !== 1 || attempts[0]?.attempt_id !== message.attemptId) return null;
        if (this.database.prepare("SELECT 1 FROM decisions WHERE work_item_id=? AND status='OPEN' LIMIT 1").get(row.work_item_id)) return null;
        const other = this.database.prepare(`
          SELECT o.message_id,o.payload_json,o.attempt_id,o.idempotency_key,o.request_id,o.state,a.request_id AS attempt_request
          FROM outbox o JOIN execution_attempts a ON a.attempt_id=o.attempt_id
          WHERE a.work_item_id=? AND o.message_type='resume' AND o.message_id<>?
        `).all(row.work_item_id, message.messageId) as { message_id: string; payload_json: string; attempt_id: string; idempotency_key: string; request_id: string; attempt_request: string; state: string }[];
        for (const item of other) {
          if (item.state !== 'ACKNOWLEDGED') return null;
          const data: unknown = JSON.parse(item.payload_json);
          if (!data || typeof data !== 'object' || Array.isArray(data)
            || Object.keys(data).sort().join(',') !== 'attempt_id,decision_id,resolution_id'
            || !validIdentifier(item.attempt_id) || !validIdentifier(item.request_id) || item.request_id !== item.attempt_request
            || !validIdentifier(item.idempotency_key) || (data as Record<string, unknown>).attempt_id !== item.attempt_id
            || !validIdentifier((data as Record<string, unknown>).decision_id) || !validIdentifier((data as Record<string, unknown>).resolution_id)
            || item.message_id !== `resume:${String((data as Record<string, unknown>).decision_id)}`) return null;
          const linked = this.database.prepare(`
            SELECT d.resolved_at FROM decisions d JOIN work_items w ON w.work_item_id=d.work_item_id JOIN tasks t ON t.task_id=w.task_id
            WHERE d.decision_id=? AND d.work_item_id=? AND d.task_id=t.task_id AND d.workspace_id=t.workspace_id
              AND d.project_id=t.project_id AND d.status='RESOLVED' AND d.resolution_id=? AND d.resolution_key=?
              AND d.resolution_actor_id=? AND d.resolution_option IN ('ALLOW','DENY') AND d.resolved_at IS NOT NULL
          `).get((data as Record<string, unknown>).decision_id, row.work_item_id, (data as Record<string, unknown>).resolution_id, item.idempotency_key, row.owner_id) as { resolved_at: string } | undefined;
          const time = linked && Date.parse(linked.resolved_at);
          if (!linked || time === undefined || !Number.isFinite(time) || new Date(time).toISOString() !== linked.resolved_at) return null;
        }
        const now = this.clock();
        const instant = (v: unknown): number | null => {
          if (typeof v !== 'string') return null;
          const time = Date.parse(v);
          return Number.isFinite(time) && new Date(time).toISOString() === v ? time : null;
        };
        const current = instant(now), issued = instant(row.issued_at), expires = instant(row.expires_at), resolved = instant(row.resolved_at);
        if (current === null) return null;
        const resource = `project:${String(row.project_id)}`, legacy = `worktree:${String(row.project_id)}`;
        const leases = this.database.prepare('SELECT lease_id,attempt_id,fencing_token,state,resource_key FROM resource_leases WHERE resource_key IN (?, ?)').all(resource, legacy) as { lease_id: string; attempt_id: string; fencing_token: number; state: string; resource_key: string }[];
        const active = leases.filter(lease => lease.state !== 'RELEASED');
        const lease = active[0];
        if (leases.some(item => !Number.isSafeInteger(item.fencing_token) || item.fencing_token <= 0 || !['ACTIVE', 'RELEASING', 'RELEASED'].includes(item.state))
          || active.length !== 1 || !lease || lease.state !== 'ACTIVE' || lease.resource_key !== resource || lease.attempt_id !== message.attemptId
          || leases.some(other => other.lease_id !== lease.lease_id && other.fencing_token >= lease.fencing_token)) return null;
        if (!new SqliteResourceLeaseRepository(this.database, () => now).canWrite({ leaseId: lease.lease_id, attemptId: message.attemptId, fencingToken: lease.fencing_token })) return null;
        if (issued === null || expires === null || resolved === null || current < issued || current < resolved || resolved < issued || resolved >= expires || current >= expires
          || row.project_snapshot_version !== String(row.snapshot_version) || row.approved_agent !== row.agent_version
          || row.connection !== 'CONNECTED' || row.availability !== 'AVAILABLE' || row.approved_function !== row.function_version || row.lifecycle !== 'ACTIVE') return null;
        try {
          const proposal = new SqliteProposalRepository(this.database).get(String(row.proposal_version_id));
          if (!proposal || proposal.expiresAt !== row.expires_at) return null;
          const { digest, ...fields } = proposal;
          if (createProposalVersion(fields).digest !== digest || (proposal.fullReview && createH1ReviewedProposal(proposal.proposalVersionId, proposal.fullReview).digest !== digest)) return null;
          const actions: unknown = JSON.parse(String(row.actions_json));
          if (!Array.isArray(actions) || classifyGoalActions(proposal.actions).kind !== 'SIDE_EFFECTING'
            || classifyGoalActions(actions as GoalAction[]).kind !== 'SIDE_EFFECTING' || JSON.stringify(proposal.actions) !== JSON.stringify(actions)) return null;
          return { option: row.resolution_option as 'ALLOW' | 'DENY' };
        } catch { return null; }
      }).immediate();
    } catch { return null; }
  }
  enqueue(input: { messageId: string; attemptId: string; requestId: string; idempotencyKey: string; messageType: string; payload: string; createdAt: string }): void { this.database.prepare('INSERT INTO outbox (message_id, attempt_id, request_id, idempotency_key, message_type, payload_json, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(input.messageId, input.attemptId, input.requestId, input.idempotencyKey, input.messageType, input.payload, 'PENDING', input.createdAt); }
  claimNext(): ClaimedMessage | null {
    // Registry 031 is required at runtime; missing identity is never legacy authority.
    // Repeat this predicate on mutation so a concurrent scope change cannot bypass it.
    const legacy = `SELECT 1 FROM execution_attempts a JOIN work_items w ON w.work_item_id=a.work_item_id
      JOIN tasks t ON t.task_id=w.task_id JOIN proposal_authority_refs p ON p.proposal_version_id=t.proposal_version_id
        AND p.workspace_id=t.workspace_id AND p.project_id=t.project_id AND p.source_kind='LEGACY'
      WHERE a.attempt_id=outbox.attempt_id`;
    const row = this.database.prepare(`SELECT message_id FROM outbox WHERE state = 'PENDING' AND EXISTS (${legacy}) ORDER BY created_at LIMIT 1`).get() as { message_id: string } | undefined;
    if (!row) return null;
    const claimToken = randomUUID();
    const eligible = "SELECT 1 FROM execution_attempts a WHERE a.attempt_id = outbox.attempt_id AND a.state NOT IN ('UNKNOWN', 'RECONCILING') AND (outbox.message_type NOT IN ('start', 'resume') OR (outbox.message_type = 'start' AND a.state = 'DISPATCH_PENDING') OR (outbox.message_type = 'resume' AND a.state IN ('WAITING_USER', 'WAITING_INPUT')))";
    const claim = this.database.prepare(`UPDATE outbox SET state = 'DISPATCHING', claim_token = ? WHERE message_id = ? AND state = 'PENDING' AND EXISTS (${legacy}) AND EXISTS (${eligible})`).run(claimToken, row.message_id);
    if (claim.changes !== 1) {
      this.database.prepare(`UPDATE outbox SET state = 'RECONCILING', claim_token = NULL WHERE message_id = ? AND state = 'PENDING' AND EXISTS (${legacy}) AND NOT EXISTS (${eligible})`).run(row.message_id);
      return null;
    }
    const claimed = this.database.prepare("SELECT attempt_id, message_type, payload_json FROM outbox WHERE message_id = ? AND state = 'DISPATCHING' AND claim_token = ?").get(row.message_id, claimToken) as { attempt_id: string; message_type: string; payload_json: string } | undefined;
    try {
      if (!claimed || !validIdentifier(claimed.attempt_id)) throw new Error('invalid');
      const value: unknown = JSON.parse(claimed.payload_json);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
      const data = value as Record<string, unknown>;
      if (data.attempt_id !== claimed.attempt_id) throw new Error('invalid');
      const keys = Object.keys(data).sort().join(',');
      if (claimed.message_type === 'start' && keys === 'attempt_id') {
        return { messageId: row.message_id, attemptId: claimed.attempt_id, claimToken, kind: 'start', payload: { attemptId: claimed.attempt_id } };
      }
      if (claimed.message_type === 'resume' && keys === 'attempt_id,decision_id,resolution_id' && validIdentifier(data.decision_id) && validIdentifier(data.resolution_id)) {
        const decision = this.database.prepare("SELECT 1 FROM outbox o JOIN execution_attempts a ON a.attempt_id = o.attempt_id JOIN work_items w ON w.work_item_id = a.work_item_id JOIN tasks t ON t.task_id = w.task_id JOIN decisions d ON d.work_item_id = w.work_item_id AND d.task_id = t.task_id AND d.workspace_id = t.workspace_id AND d.project_id = t.project_id WHERE o.message_id = ? AND o.state = 'DISPATCHING' AND o.claim_token = ? AND d.decision_id = ? AND d.status = 'RESOLVED' AND d.resolution_id = ? AND d.resolution_key = o.idempotency_key").get(row.message_id, claimToken, data.decision_id, data.resolution_id);
        if (!decision) throw new Error('invalid');
        return { messageId: row.message_id, attemptId: claimed.attempt_id, claimToken, kind: 'resume', payload: { attemptId: claimed.attempt_id, decisionId: data.decision_id, resolutionId: data.resolution_id } };
      }
      throw new Error('invalid');
    } catch {
      this.markUncertain(row.message_id, claimToken);
      throw new Error('INVALID_OUTBOX_MESSAGE');
    }
  }
  acknowledge(messageId: string, claimToken: string): boolean {
    return this.database.prepare("UPDATE outbox SET state = 'ACKNOWLEDGED', claim_token = NULL WHERE message_id = ? AND state = 'DISPATCHING' AND claim_token = ?").run(messageId, claimToken).changes === 1;
  }
  markUncertain(messageId: string, claimToken: string): boolean {
    return this.database.transaction(() => {
      const row = this.database.prepare("SELECT attempt_id FROM outbox WHERE message_id = ? AND state = 'DISPATCHING' AND claim_token = ?").get(messageId, claimToken) as { attempt_id: string } | undefined;
      if (!row) return false;
      const changed = this.database.prepare("UPDATE outbox SET state = 'RECONCILING', claim_token = NULL WHERE message_id = ? AND state = 'DISPATCHING' AND claim_token = ?").run(messageId, claimToken);
      if (changed.changes !== 1) return false;
      this.database.prepare("UPDATE execution_attempts SET state = 'UNKNOWN' WHERE attempt_id = ? AND state NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'NOT_STARTED')").run(row.attempt_id);
      return true;
    })();
  }
  /** Caller must establish that prior worker ownership has ended. */
  recoverInterrupted(workspaceId?: string): number {
    const scope = workspaceId === undefined ? '' : ` AND attempt_id IN (
      SELECT a.attempt_id FROM execution_attempts a JOIN work_items w ON a.work_item_id = w.work_item_id
      JOIN tasks t ON w.task_id = t.task_id WHERE t.workspace_id = ?
    )`;
    const scopeParams = workspaceId === undefined ? [] : [workspaceId];
    return this.database.transaction(() => {
      this.database.prepare(`UPDATE execution_attempts SET state = 'UNKNOWN' WHERE attempt_id IN (SELECT attempt_id FROM outbox WHERE state = 'DISPATCHING'${scope}) AND state NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'NOT_STARTED')`).run(...scopeParams);
      return this.database.prepare(`UPDATE outbox SET state = 'RECONCILING', claim_token = NULL WHERE state = 'DISPATCHING'${scope}`).run(...scopeParams).changes;
    }).immediate();
  }
}
