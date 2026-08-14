/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';

export class SqliteOutboxRepository {
  constructor(private readonly database: Database.Database) {}
  enqueue(input: { messageId: string; attemptId: string; requestId: string; idempotencyKey: string; messageType: string; payload: string; createdAt: string }): void { this.database.prepare('INSERT INTO outbox VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(input.messageId, input.attemptId, input.requestId, input.idempotencyKey, input.messageType, input.payload, 'PENDING', input.createdAt); }
  claimNext(): { messageId: string } | null { const row = this.database.prepare("SELECT message_id FROM outbox WHERE state = 'PENDING' ORDER BY created_at LIMIT 1").get() as { message_id: string } | undefined; if (!row) return null; this.database.prepare("UPDATE outbox SET state = 'DISPATCHING' WHERE message_id = ? AND state = 'PENDING'").run(row.message_id); return { messageId: row.message_id }; }
  acknowledge(messageId: string): void { this.database.prepare("UPDATE outbox SET state = 'ACKNOWLEDGED' WHERE message_id = ? AND state = 'DISPATCHING'").run(messageId); }
}
