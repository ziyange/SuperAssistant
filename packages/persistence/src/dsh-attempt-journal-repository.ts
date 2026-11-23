/* eslint-disable no-unused-vars -- constructor parameter property is a runtime repository dependency. */
import { Buffer } from 'node:buffer';
import { types } from 'node:util';
import type Database from 'better-sqlite3';

function validName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value === value.trim() && !/[\p{Cc}\p{Cf}]/u.test(value);
}

export class SqliteDshAttemptJournalRepository {
  constructor(private readonly database: Database.Database) {}
  append(input: { attemptId: string; sequence: number; eventType: string; evidenceJson: string; createdAt: string }): boolean {
    if (!input || typeof input !== 'object' || types.isProxy(input) || Array.isArray(input) ||
        (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
        Object.getOwnPropertySymbols(input).length) throw new Error('DSH_JOURNAL_INPUT_INVALID');
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Object.keys(descriptors).sort().join(',') !== 'attemptId,createdAt,eventType,evidenceJson,sequence' ||
        Object.values(descriptors).some(descriptor => !descriptor.enumerable || !('value' in descriptor))) throw new Error('DSH_JOURNAL_INPUT_INVALID');
    const { attemptId, sequence, eventType, evidenceJson, createdAt } = Object.fromEntries(
      Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value])
    ) as typeof input;
    if (!validName(attemptId) || !validName(eventType) || !Number.isSafeInteger(sequence) || sequence <= 0 ||
        typeof evidenceJson !== 'string' || Buffer.byteLength(evidenceJson, 'utf8') > 1_048_576 ||
        typeof createdAt !== 'string') throw new Error('DSH_JOURNAL_INPUT_INVALID');
    try {
      const evidence: unknown = JSON.parse(evidenceJson);
      const timestamp = Date.parse(createdAt);
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) ||
          !Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) throw new Error('invalid');
    } catch { throw new Error('DSH_JOURNAL_INPUT_INVALID'); }
    return this.database.transaction(() => {
      const inserted = this.database.prepare(`INSERT INTO dsh_attempt_journal(attempt_id, sequence, event_type, evidence_json, created_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(attempt_id, sequence) DO NOTHING`).run(attemptId, sequence, eventType, evidenceJson, createdAt);
      if (inserted.changes === 1) return true;
      const previous = this.database.prepare(`SELECT event_type AS eventType, evidence_json AS evidenceJson, created_at AS createdAt
        FROM dsh_attempt_journal WHERE attempt_id=? AND sequence=?`).get(attemptId, sequence) as
        { eventType: string; evidenceJson: string; createdAt: string } | undefined;
      if (!previous) throw new Error('DSH_JOURNAL_INDETERMINATE');
      if (previous.eventType !== eventType || previous.evidenceJson !== evidenceJson || previous.createdAt !== createdAt) {
        throw new Error('DSH_JOURNAL_SEQUENCE_CONFLICT');
      }
      return false;
    }).immediate();
  }
  list(attemptId: string): Array<{ sequence: number; eventType: string; evidenceJson: string }> {
    return this.database.prepare('SELECT sequence, event_type AS eventType, evidence_json AS evidenceJson FROM dsh_attempt_journal WHERE attempt_id = ? ORDER BY sequence').all(attemptId) as Array<{ sequence: number; eventType: string; evidenceJson: string }>;
  }
}
