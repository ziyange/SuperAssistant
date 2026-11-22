/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { classifyGoalActions, createH1ReviewedProposal, createProposalVersion, resolveDecision, type Decision, type DecisionResolution, type GoalAction } from '@super-assistant/domain';
import { SqliteProposalRepository } from './proposal-repository.js';
import { SqliteResourceLeaseRepository } from './resource-lease-repository.js';

function toDecision(row: Record<string, unknown>): Decision {
  const resolution = row.status === 'RESOLVED' ? { resolutionId: String(row.resolution_id), idempotencyKey: String(row.resolution_key), actorId: String(row.resolution_actor_id), option: String(row.resolution_option) as 'ALLOW' | 'DENY', resolvedAt: String(row.resolved_at) } : undefined;
  return { decisionId: String(row.decision_id), workspaceId: String(row.workspace_id), projectId: String(row.project_id), taskId: String(row.task_id), workItemId: String(row.work_item_id), question: String(row.question), level: String(row.level) as 'L3' | 'L4', fingerprint: String(row.fingerprint), status: String(row.status) as 'OPEN' | 'RESOLVED', createdAt: String(row.created_at), ...(resolution ? { resolution } : {}) };
}

export class SqliteDecisionRepository {
  constructor(private readonly database: Database.Database, private readonly principal: () => string | undefined = () => undefined,
    private readonly clock: () => string = () => new Date().toISOString()) {}

  create(decision: Decision): void {
    this.database.prepare('INSERT INTO decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(decision.decisionId, decision.workspaceId, decision.projectId, decision.taskId, decision.workItemId, decision.question, decision.level, decision.fingerprint, decision.status, null, null, null, null, null, decision.createdAt);
  }

  get(decisionId: string): Decision | null {
    const row = this.database.prepare('SELECT * FROM decisions WHERE decision_id = ?').get(decisionId) as Record<string, unknown> | undefined;
    return row ? toDecision(row) : null;
  }

  findOpenByFingerprint(fingerprint: string): Decision | null {
    const row = this.database.prepare("SELECT * FROM decisions WHERE fingerprint = ? AND status = 'OPEN'").get(fingerprint) as Record<string, unknown> | undefined;
    return row ? toDecision(row) : null;
  }

  listForTask(taskId: string): readonly Decision[] {
    return (this.database.prepare('SELECT * FROM decisions WHERE task_id = ? ORDER BY created_at, decision_id').all(taskId) as Array<Record<string, unknown>>).map(toDecision);
  }

  resolve(decision: Decision): void {
    void decision;
    throw new Error('ATOMIC_DECISION_RESOLUTION_REQUIRED');
  }

  resolveAndEnqueueResume(decisionId: string, resolution: DecisionResolution): { decision: Decision; resumeEnqueued: boolean } {
    if (this.database.inTransaction) throw new Error('DECISION_NESTED_TRANSACTION_DENIED');
    const valid = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128
      && value.trim() === value && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      && !/[\u202a-\u202e\u2066-\u2069]/u.test(value);
    if (!valid(decisionId) || !resolution || !valid(resolution.resolutionId) || !valid(resolution.idempotencyKey)
      || !valid(resolution.actorId) || (resolution.option !== 'ALLOW' && resolution.option !== 'DENY')
      || typeof resolution.resolvedAt !== 'string' || !Number.isFinite(Date.parse(resolution.resolvedAt))
      || new Date(resolution.resolvedAt).toISOString() !== resolution.resolvedAt) throw new Error('INVALID_DECISION_RESOLUTION');
    const transaction = this.database.transaction((): { decision: Decision; resumeEnqueued: boolean } | { failure: string } => {
      const existing = this.get(decisionId);
      if (!existing) throw new Error('DECISION_NOT_FOUND');
      const principal = this.principal();
      if (!valid(principal) || principal !== resolution.actorId) throw new Error('DECISION_AUTHORITY_DENIED');
      const scope = this.database.prepare(`
        SELECT t.state AS task_state,p.proposal_version_id,g.actions_json,g.issued_at,g.expires_at,
          p.project_snapshot_version,p.agent_version AS approved_agent_version,p.function_version AS approved_function_version,
          pr.snapshot_version,a.agent_version,a.connection,a.availability,f.function_version,f.lifecycle
        FROM work_items w
        JOIN tasks t ON t.task_id=w.task_id
        JOIN projects pr ON pr.project_id=t.project_id AND pr.workspace_id=t.workspace_id AND pr.status='ACTIVE'
        JOIN workspaces ws ON ws.workspace_id=t.workspace_id AND ws.status='ACTIVE'
        JOIN proposal_versions p ON p.proposal_version_id=t.proposal_version_id
          AND p.workspace_id=t.workspace_id AND p.project_id=t.project_id
          AND p.agent_id=w.agent_id AND p.function_id=w.function_id
        JOIN authorization_grants g ON g.grant_id=t.authorization_grant_id
          AND g.proposal_version_id=p.proposal_version_id AND g.proposal_digest=p.digest
          AND g.actor_id=ws.owner_id AND g.status='CONSUMED'
        JOIN agents a ON a.agent_id=w.agent_id AND a.workspace_id=t.workspace_id
        JOIN functions f ON f.function_id=w.function_id AND f.agent_id=a.agent_id
        WHERE w.work_item_id=? AND t.task_id=? AND t.workspace_id=? AND t.project_id=? AND ws.owner_id=?
      `).get(existing.workItemId, existing.taskId, existing.workspaceId, existing.projectId, principal) as { task_state: string; proposal_version_id: string; actions_json: string; issued_at: string; expires_at: string;
        project_snapshot_version: string; approved_agent_version: string; approved_function_version: string; snapshot_version: number;
        agent_version: string; connection: string; availability: string; function_version: string; lifecycle: string } | undefined;
      if (!scope) throw new Error('DECISION_AUTHORITY_DENIED');
      const other = this.database.prepare(`
        SELECT o.payload_json,o.attempt_id,o.idempotency_key,o.request_id,a.request_id AS attempt_request
        FROM outbox o JOIN execution_attempts a ON a.attempt_id=o.attempt_id
        WHERE a.work_item_id=? AND o.message_type='resume' AND o.message_id<>?
      `).all(existing.workItemId, `resume:${decisionId}`) as { payload_json: string; attempt_id: string; idempotency_key: string; request_id: string; attempt_request: string }[];
      for (const row of other) {
        let value: unknown;
        try { value = JSON.parse(row.payload_json); } catch { throw new Error('DECISION_EVIDENCE_MISSING'); }
        if (!value || typeof value !== 'object' || Array.isArray(value)
          || Object.keys(value).sort().join(',') !== 'attempt_id,decision_id,resolution_id'
          || !valid(row.attempt_id) || !valid(row.request_id) || row.request_id !== row.attempt_request || !valid(row.idempotency_key)
          || (value as Record<string, unknown>).attempt_id !== row.attempt_id
          || !valid((value as Record<string, unknown>).decision_id) || !valid((value as Record<string, unknown>).resolution_id)
          || (value as Record<string, unknown>).decision_id === decisionId) throw new Error('DECISION_EVIDENCE_MISSING');
        const linked = this.database.prepare(`
          SELECT resolution_actor_id,resolution_option,resolved_at FROM decisions WHERE decision_id=? AND work_item_id=? AND task_id=? AND workspace_id=? AND project_id=?
            AND status='RESOLVED' AND resolution_id=? AND resolution_key=?
        `).get((value as Record<string, unknown>).decision_id, existing.workItemId, existing.taskId, existing.workspaceId,
          existing.projectId, (value as Record<string, unknown>).resolution_id, row.idempotency_key) as { resolution_actor_id: string; resolution_option: string; resolved_at: string } | undefined;
        if (!linked || !valid(linked.resolution_actor_id) || (linked.resolution_option !== 'ALLOW' && linked.resolution_option !== 'DENY')
          || typeof linked.resolved_at !== 'string' || !Number.isFinite(Date.parse(linked.resolved_at))
          || new Date(linked.resolved_at).toISOString() !== linked.resolved_at) throw new Error('DECISION_EVIDENCE_MISSING');
      }
      if (existing.status === 'RESOLVED') {
        const decision = resolveDecision(existing, resolution);
        const saved = decision.resolution;
        const message = this.database.prepare(`
          SELECT o.attempt_id,o.request_id,o.idempotency_key,o.message_type,o.payload_json,a.request_id AS attempt_request
          FROM outbox o JOIN execution_attempts a ON a.attempt_id=o.attempt_id
          WHERE o.message_id=? AND a.work_item_id=?
        `).get(`resume:${decisionId}`, existing.workItemId) as { attempt_id: string; request_id: string; idempotency_key: string; message_type: string; payload_json: string; attempt_request: string } | undefined;
        let payload: unknown;
        try { payload = message && JSON.parse(message.payload_json); } catch { throw new Error('DECISION_EVIDENCE_MISSING'); }
        if (!saved || !valid(saved.resolutionId) || !valid(saved.idempotencyKey) || !valid(saved.actorId)
          || (saved.option !== 'ALLOW' && saved.option !== 'DENY') || !Number.isFinite(Date.parse(saved.resolvedAt))
          || new Date(saved.resolvedAt).toISOString() !== saved.resolvedAt
          || !message || !valid(message.attempt_id) || !valid(message.request_id)
          || message.message_type !== 'resume' || message.idempotency_key !== saved.idempotencyKey
          || message.request_id !== message.attempt_request || !payload || typeof payload !== 'object' || Array.isArray(payload)
          || Object.keys(payload).sort().join(',') !== 'attempt_id,decision_id,resolution_id'
          || (payload as Record<string, unknown>).attempt_id !== message.attempt_id
          || (payload as Record<string, unknown>).decision_id !== decisionId
          || (payload as Record<string, unknown>).resolution_id !== saved.resolutionId) throw new Error('DECISION_EVIDENCE_MISSING');
        return { decision, resumeEnqueued: false };
      }
      if (scope.task_state !== 'QUEUED' && scope.task_state !== 'RUNNING') throw new Error('DECISION_TASK_NOT_ACTIVE');
      const attempts = this.database.prepare('SELECT attempt_id, request_id, state FROM execution_attempts WHERE work_item_id = ? LIMIT 2').all(existing.workItemId) as { attempt_id: string; request_id: string; state: string }[];
      if (attempts.length === 0) throw new Error('DECISION_ATTEMPT_NOT_FOUND');
      if (attempts.length !== 1) throw new Error('DECISION_ATTEMPT_AMBIGUOUS');
      const attempt = attempts[0]!;
      if (!valid(attempt.attempt_id) || !valid(attempt.request_id)) throw new Error('DECISION_ATTEMPT_INVALID');
      if (attempt.state === 'UNKNOWN' || attempt.state === 'RECONCILING') throw new Error('ATTEMPT_RECONCILIATION_REQUIRED');
      if (attempt.state !== 'WAITING_USER' && attempt.state !== 'WAITING_INPUT') throw new Error('ATTEMPT_NOT_WAITING');
      const now = this.clock();
      const instant = (value: unknown): number | null => {
        if (typeof value !== 'string') return null;
        const time = Date.parse(value);
        return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null;
      };
      const current = instant(now), issued = instant(scope.issued_at), expires = instant(scope.expires_at);
      if (current === null) throw new Error('DECISION_AUTHORITY_STALE');
      const resource = `project:${existing.projectId}`, legacy = `worktree:${existing.projectId}`;
      const leases = this.database.prepare('SELECT lease_id,attempt_id,fencing_token,state,resource_key FROM resource_leases WHERE resource_key IN (?, ?)').all(resource, legacy) as { lease_id: string; attempt_id: string; fencing_token: number; state: string; resource_key: string }[];
      const active = leases.filter(lease => lease.state !== 'RELEASED');
      const lease = active[0];
      if (leases.some(item => !Number.isSafeInteger(item.fencing_token) || item.fencing_token <= 0 || !['ACTIVE', 'RELEASING', 'RELEASED'].includes(item.state))
        || active.length !== 1 || !lease || lease.state !== 'ACTIVE' || lease.resource_key !== resource
        || lease.attempt_id !== attempt.attempt_id
        || leases.some(otherLease => otherLease.lease_id !== lease.lease_id && otherLease.fencing_token >= lease.fencing_token)) throw new Error('DECISION_LEASE_STALE');
      // Persist the Lease time observation even when it establishes expiry;
      // throwing inside the transaction would roll it back and permit clock rollback.
      if (!new SqliteResourceLeaseRepository(this.database, () => now).canWrite({ leaseId: lease.lease_id, attemptId: attempt.attempt_id, fencingToken: lease.fencing_token })) return { failure: 'DECISION_LEASE_STALE' };
      if (issued === null || expires === null || current < issued || current >= expires) return { failure: 'DECISION_AUTHORITY_STALE' };
      try {
      return this.database.transaction((): { decision: Decision; resumeEnqueued: boolean } => {
      if (scope.project_snapshot_version !== String(scope.snapshot_version)
        || scope.approved_agent_version !== scope.agent_version || scope.connection !== 'CONNECTED' || scope.availability !== 'AVAILABLE'
        || scope.approved_function_version !== scope.function_version || scope.lifecycle !== 'ACTIVE') throw new Error('DECISION_AUTHORITY_STALE');
      const proposal = new SqliteProposalRepository(this.database).get(scope.proposal_version_id);
      if (!proposal || proposal.expiresAt !== scope.expires_at) throw new Error('DECISION_AUTHORITY_STALE');
      const { digest, ...fields } = proposal;
      if (createProposalVersion(fields).digest !== digest || (proposal.fullReview && createH1ReviewedProposal(proposal.proposalVersionId, proposal.fullReview).digest !== digest)) throw new Error('DECISION_AUTHORITY_STALE');
      const actions: unknown = JSON.parse(scope.actions_json);
      if (!Array.isArray(actions) || classifyGoalActions(proposal.actions).kind !== 'SIDE_EFFECTING'
        || classifyGoalActions(actions as GoalAction[]).kind !== 'SIDE_EFFECTING'
        || JSON.stringify(proposal.actions) !== JSON.stringify(actions)) throw new Error('DECISION_AUTHORITY_STALE');
      const committed = { ...resolution, resolvedAt: now };
      const decision = resolveDecision(existing, committed);
      const resolved = this.database.prepare("UPDATE decisions SET status = 'RESOLVED', resolution_id = ?, resolution_key = ?, resolution_actor_id = ?, resolution_option = ?, resolved_at = ? WHERE decision_id = ? AND status = 'OPEN'").run(committed.resolutionId, committed.idempotencyKey, committed.actorId, committed.option, committed.resolvedAt, decisionId);
      if (resolved.changes !== 1) throw new Error('DECISION_RESOLUTION_CONFLICT');
      this.database.prepare('INSERT INTO outbox (message_id, attempt_id, request_id, idempotency_key, message_type, payload_json, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`resume:${decisionId}`, attempt.attempt_id, attempt.request_id, committed.idempotencyKey, 'resume', JSON.stringify({ attempt_id: attempt.attempt_id, decision_id: decisionId, resolution_id: committed.resolutionId }), 'PENDING', committed.resolvedAt);
      return { decision, resumeEnqueued: true };
      })();
      } catch {
        // Roll back the Decision/Outbox savepoint but retain the Lease watermark.
        return { failure: 'DECISION_AUTHORITY_STALE' };
      }
    });
    const result = transaction.immediate();
    if ('failure' in result) throw new Error(result.failure);
    return result;
  }
}
