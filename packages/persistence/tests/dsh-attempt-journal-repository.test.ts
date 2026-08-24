import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteDshAttemptJournalRepository } from '../src/dsh-attempt-journal-repository.js';

test('persists sequenced DSH evidence idempotently', () => {
  const database = createFoundationDatabase(':memory:');
  const repository = new SqliteDshAttemptJournalRepository(database);
  expect(repository.append({ attemptId: 'attempt-1', sequence: 1, eventType: 'session.event', evidenceJson: '{"safe":true}', createdAt: '2026-08-23T00:00:00.000Z' })).toBe(true);
  expect(repository.append({ attemptId: 'attempt-1', sequence: 1, eventType: 'session.event', evidenceJson: '{"safe":true}', createdAt: '2026-08-23T00:00:00.000Z' })).toBe(false);
  expect(repository.list('attempt-1')).toHaveLength(1);
  database.close();
});
