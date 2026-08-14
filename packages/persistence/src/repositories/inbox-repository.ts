/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';

export class SqliteInboxRepository {
  constructor(private readonly database: Database.Database) {}
  record(consumerId: string, messageId: string, payloadDigest: string): 'APPLIED' | 'DUPLICATE' {
    const existing = this.database.prepare('SELECT payload_digest FROM inbox WHERE consumer_id = ? AND message_id = ?').get(consumerId, messageId) as { payload_digest: string } | undefined;
    if (existing) { if (existing.payload_digest !== payloadDigest) throw new Error('IDEMPOTENCY_CONFLICT'); return 'DUPLICATE'; }
    this.database.prepare('INSERT INTO inbox VALUES (?, ?, ?, ?)').run(consumerId, messageId, payloadDigest, new Date().toISOString()); return 'APPLIED';
  }
}
