/* eslint-disable no-unused-vars -- constructor parameter property is a runtime repository dependency. */
import type Database from 'better-sqlite3';

export class SqliteDshAttemptJournalRepository {
  constructor(private readonly database: Database.Database) {}
  append(input: { attemptId: string; sequence: number; eventType: string; evidenceJson: string; createdAt: string }): boolean {
    return this.database.prepare('INSERT OR IGNORE INTO dsh_attempt_journal(attempt_id, sequence, event_type, evidence_json, created_at) VALUES (?, ?, ?, ?, ?)').run(input.attemptId, input.sequence, input.eventType, input.evidenceJson, input.createdAt).changes === 1;
  }
  list(attemptId: string): Array<{ sequence: number; eventType: string; evidenceJson: string }> {
    return this.database.prepare('SELECT sequence, event_type AS eventType, evidence_json AS evidenceJson FROM dsh_attempt_journal WHERE attempt_id = ? ORDER BY sequence').all(attemptId) as Array<{ sequence: number; eventType: string; evidenceJson: string }>;
  }
}
