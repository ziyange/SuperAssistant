/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { resolveDecision, type Decision, type DecisionResolution } from '@super-assistant/domain';

function toDecision(row: Record<string, unknown>): Decision {
  const resolution = row.status === 'RESOLVED' ? { resolutionId: String(row.resolution_id), idempotencyKey: String(row.resolution_key), actorId: String(row.resolution_actor_id), option: String(row.resolution_option) as 'ALLOW' | 'DENY', resolvedAt: String(row.resolved_at) } : undefined;
  return { decisionId: String(row.decision_id), workspaceId: String(row.workspace_id), projectId: String(row.project_id), taskId: String(row.task_id), workItemId: String(row.work_item_id), question: String(row.question), level: String(row.level) as 'L3' | 'L4', fingerprint: String(row.fingerprint), status: String(row.status) as 'OPEN' | 'RESOLVED', createdAt: String(row.created_at), ...(resolution ? { resolution } : {}) };
}

export class SqliteDecisionRepository {
  constructor(private readonly database: Database.Database) {}

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
    if (decision.status !== 'RESOLVED' || !decision.resolution) throw new Error('Decision must be resolved before persistence.');
    const result = this.database.prepare("UPDATE decisions SET status = 'RESOLVED', resolution_id = ?, resolution_key = ?, resolution_actor_id = ?, resolution_option = ?, resolved_at = ? WHERE decision_id = ? AND status = 'OPEN'").run(decision.resolution.resolutionId, decision.resolution.idempotencyKey, decision.resolution.actorId, decision.resolution.option, decision.resolution.resolvedAt, decision.decisionId);
    if (result.changes !== 1) throw new Error('Decision is already resolved');
  }

  resolveAndEnqueueResume(decisionId: string, resolution: DecisionResolution): { decision: Decision; resumeEnqueued: boolean } {
    const transaction = this.database.transaction((): { decision: Decision; resumeEnqueued: boolean } => {
      const existing = this.get(decisionId);
      if (!existing) throw new Error('DECISION_NOT_FOUND');
      if (existing.status === 'RESOLVED') {
        if (existing.resolution?.idempotencyKey === resolution.idempotencyKey) return { decision: existing, resumeEnqueued: false };
        throw new Error('Decision is already resolved');
      }
      const attempt = this.database.prepare('SELECT attempt_id, request_id, state FROM execution_attempts WHERE work_item_id = ? ORDER BY created_at DESC LIMIT 1').get(existing.workItemId) as { attempt_id: string; request_id: string; state: string } | undefined;
      if (!attempt) throw new Error('DECISION_ATTEMPT_NOT_FOUND');
      if (attempt.state === 'UNKNOWN' || attempt.state === 'RECONCILING') throw new Error('ATTEMPT_RECONCILIATION_REQUIRED');
      const decision = resolveDecision(existing, resolution);
      const resolved = this.database.prepare("UPDATE decisions SET status = 'RESOLVED', resolution_id = ?, resolution_key = ?, resolution_actor_id = ?, resolution_option = ?, resolved_at = ? WHERE decision_id = ? AND status = 'OPEN'").run(resolution.resolutionId, resolution.idempotencyKey, resolution.actorId, resolution.option, resolution.resolvedAt, decisionId);
      if (resolved.changes !== 1) throw new Error('DECISION_RESOLUTION_CONFLICT');
      const outbox = this.database.prepare('INSERT OR IGNORE INTO outbox VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`resume:${decisionId}`, attempt.attempt_id, attempt.request_id, resolution.idempotencyKey, 'resume', JSON.stringify({ attempt_id: attempt.attempt_id, decision_id: decisionId, resolution_id: resolution.resolutionId }), 'PENDING', resolution.resolvedAt);
      return { decision, resumeEnqueued: outbox.changes === 1 };
    });
    return transaction();
  }
}
