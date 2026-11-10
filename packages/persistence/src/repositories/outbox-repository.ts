/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

type ClaimedMessage =
  | { messageId: string; attemptId: string; claimToken: string; kind: 'start'; payload: { attemptId: string } }
  | { messageId: string; attemptId: string; claimToken: string; kind: 'resume'; payload: { attemptId: string; decisionId: string; resolutionId: string } };

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value;
}

export class SqliteOutboxRepository {
  constructor(private readonly database: Database.Database) {}
  enqueue(input: { messageId: string; attemptId: string; requestId: string; idempotencyKey: string; messageType: string; payload: string; createdAt: string }): void { this.database.prepare('INSERT INTO outbox (message_id, attempt_id, request_id, idempotency_key, message_type, payload_json, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(input.messageId, input.attemptId, input.requestId, input.idempotencyKey, input.messageType, input.payload, 'PENDING', input.createdAt); }
  claimNext(): ClaimedMessage | null {
    const row = this.database.prepare("SELECT message_id FROM outbox WHERE state = 'PENDING' ORDER BY created_at LIMIT 1").get() as { message_id: string } | undefined;
    if (!row) return null;
    const claimToken = randomUUID();
    const eligible = "SELECT 1 FROM execution_attempts a WHERE a.attempt_id = outbox.attempt_id AND a.state NOT IN ('UNKNOWN', 'RECONCILING') AND (outbox.message_type NOT IN ('start', 'resume') OR (outbox.message_type = 'start' AND a.state = 'DISPATCH_PENDING') OR (outbox.message_type = 'resume' AND a.state IN ('WAITING_USER', 'WAITING_INPUT')))";
    const claim = this.database.prepare(`UPDATE outbox SET state = 'DISPATCHING', claim_token = ? WHERE message_id = ? AND state = 'PENDING' AND EXISTS (${eligible})`).run(claimToken, row.message_id);
    if (claim.changes !== 1) {
      this.database.prepare(`UPDATE outbox SET state = 'RECONCILING', claim_token = NULL WHERE message_id = ? AND state = 'PENDING' AND NOT EXISTS (${eligible})`).run(row.message_id);
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
  recoverInterrupted(): number {
    return this.database.transaction(() => {
      this.database.prepare("UPDATE execution_attempts SET state = 'UNKNOWN' WHERE attempt_id IN (SELECT attempt_id FROM outbox WHERE state = 'DISPATCHING') AND state NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'NOT_STARTED')").run();
      return this.database.prepare("UPDATE outbox SET state = 'RECONCILING', claim_token = NULL WHERE state = 'DISPATCHING'").run().changes;
    })();
  }
}
