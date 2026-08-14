/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';

export class SqliteExecutionRepository {
  constructor(private readonly database: Database.Database) {}
  createAuthorizedExecution(input: { taskId: string; workItemId: string; attemptId: string; leaseId: string; requestId: string; idempotencyKey: string; workspaceId: string; projectId: string; agentId: string; functionId: string; proposalVersionId: string; authorizationGrantId: string; resourceKey: string; fencingToken: number; createdAt: string }): { attemptId: string; created: boolean } {
    const transaction = this.database.transaction((): { attemptId: string; created: boolean } => {
      const prior = this.database.prepare('SELECT attempt_id FROM execution_attempts WHERE idempotency_key = ?').get(input.idempotencyKey) as { attempt_id: string } | undefined;
      if (prior) return { attemptId: prior.attempt_id, created: false };
      const consumed = this.database.prepare("UPDATE authorization_grants SET status = 'CONSUMED' WHERE grant_id = ? AND proposal_version_id = ? AND status = 'ISSUED' AND expires_at > ?").run(input.authorizationGrantId, input.proposalVersionId, input.createdAt);
      if (consumed.changes !== 1) throw new Error('GRANT_NOT_CONSUMABLE');
      this.database.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run(input.taskId, input.workspaceId, input.projectId, input.proposalVersionId, input.authorizationGrantId, 'QUEUED', input.createdAt);
      this.database.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run(input.workItemId, input.taskId, input.agentId, input.functionId, 'WAITING');
      this.database.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)').run(input.attemptId, input.workItemId, input.requestId, input.idempotencyKey, 'DISPATCH_PENDING', 0, input.createdAt);
      this.database.prepare('INSERT INTO resource_leases VALUES (?, ?, ?, ?, ?, ?, ?)').run(input.leaseId, input.resourceKey, input.attemptId, input.fencingToken, 'ACTIVE', input.createdAt, null);
      this.database.prepare('INSERT INTO outbox VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`outbox:${input.attemptId}`, input.attemptId, input.requestId, input.idempotencyKey, 'start', JSON.stringify({ attempt_id: input.attemptId }), 'PENDING', input.createdAt);
      return { attemptId: input.attemptId, created: true };
    });
    return transaction();
  }
}
