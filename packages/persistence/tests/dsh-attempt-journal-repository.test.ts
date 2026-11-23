import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
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

test('a different event at an existing sequence is a conflict and preserves the first row', () => {
  const database = createFoundationDatabase(':memory:');
  try {
    const repository = new SqliteDshAttemptJournalRepository(database);
    const first = { attemptId: 'attempt-1', sequence: 1, eventType: 'event', evidenceJson: '{"safe":true}', createdAt: '2026-08-23T00:00:00.000Z' };
    expect(repository.append(first)).toBe(true);
    expect(() => repository.append({ ...first, evidenceJson: '{"safe":false}' })).toThrow('DSH_JOURNAL_SEQUENCE_CONFLICT');
    expect(repository.list(first.attemptId)).toEqual([{ sequence: 1, eventType: 'event', evidenceJson: '{"safe":true}' }]);
  } finally { database.close(); }
});

test('an invalid sequence is rejected rather than reported as a duplicate', () => {
  const database = createFoundationDatabase(':memory:');
  try {
    const repository = new SqliteDshAttemptJournalRepository(database);
    expect(() => repository.append({ attemptId: 'attempt-1', sequence: 0, eventType: 'event', evidenceJson: '{}', createdAt: '2026-08-23T00:00:00.000Z' })).toThrow('DSH_JOURNAL_INPUT_INVALID');
    expect(repository.list('attempt-1')).toEqual([]);
  } finally { database.close(); }
});

test.each([
  { eventType: 'different' },
  { evidenceJson: '{"different":true}' },
  { createdAt: '2026-08-23T00:00:01.000Z' }
])('conflicting replay never replaces the first stored row: %j', change => {
  const database = createFoundationDatabase(':memory:');
  try {
    const repository = new SqliteDshAttemptJournalRepository(database);
    const first = { attemptId: 'a', sequence: 1, eventType: 'event', evidenceJson: '{"safe":true}', createdAt: '2026-08-23T00:00:00.000Z' };
    expect(repository.append(first)).toBe(true);
    expect(() => repository.append({ ...first, ...change })).toThrow('DSH_JOURNAL_SEQUENCE_CONFLICT');
    expect(repository.list('a')).toEqual([{ sequence: 1, eventType: 'event', evidenceJson: '{"safe":true}' }]);
  } finally { database.close(); }
});

test.each([
  { attemptId: '' }, { attemptId: ' a ' }, { eventType: '' }, { eventType: '\n' },
  { sequence: -1 }, { sequence: 1.5 }, { sequence: Number.MAX_SAFE_INTEGER + 1 },
  { evidenceJson: '{' }, { evidenceJson: 'null' }, { evidenceJson: '[]' },
  { evidenceJson: '{"data":"' + 'x'.repeat(1_048_576) + '"}' },
  { createdAt: '2026-08-23' }
])('invalid input is rejected before any journal write', change => {
  const database = createFoundationDatabase(':memory:');
  try {
    const repository = new SqliteDshAttemptJournalRepository(database);
    const valid = { attemptId: 'a', sequence: 1, eventType: 'event', evidenceJson: '{}', createdAt: '2026-08-23T00:00:00.000Z' };
    expect(() => repository.append({ ...valid, ...change })).toThrow('DSH_JOURNAL_INPUT_INVALID');
    expect(database.prepare('SELECT count(*) AS n FROM dsh_attempt_journal').get()).toEqual({ n: 0 });
  } finally { database.close(); }
});

test('independent SQLite connections retain the first event and isolate Attempt sequences', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-dsh-journal-'));
  const path = join(root, 'journal.sqlite');
  const firstDatabase = createFoundationDatabase(path);
  const secondDatabase = new Database(path, { fileMustExist: true });
  try {
    const first = new SqliteDshAttemptJournalRepository(firstDatabase);
    const second = new SqliteDshAttemptJournalRepository(secondDatabase);
    const entry = { attemptId: 'a', sequence: 1, eventType: 'event', evidenceJson: '{}', createdAt: '2026-08-23T00:00:00.000Z' };
    expect(first.append(entry)).toBe(true);
    expect(second.append(entry)).toBe(false);
    expect(() => second.append({ ...entry, eventType: 'different' })).toThrow('DSH_JOURNAL_SEQUENCE_CONFLICT');
    expect(second.append({ ...entry, attemptId: 'b' })).toBe(true);
    expect(first.append({ ...entry, sequence: 3 })).toBe(true);
    expect(second.append({ ...entry, sequence: 2 })).toBe(true);
    expect(first.list('a').map(row => row.sequence)).toEqual([1, 2, 3]);
    expect(first.list('b')).toHaveLength(1);
  } finally { secondDatabase.close(); firstDatabase.close(); rmSync(root, { recursive: true, force: true }); }
});

test('rejects accessor and proxy input without invoking caller code or writing', () => {
  const database = createFoundationDatabase(':memory:');
  try {
    const repository = new SqliteDshAttemptJournalRepository(database);
    let calls = 0;
    const input = { attemptId: 'a', sequence: 1, eventType: 'event', evidenceJson: '{}', createdAt: '2026-08-23T00:00:00.000Z' };
    Object.defineProperty(input, 'sequence', { enumerable: true, get() { calls += 1; return 1; } });
    expect(() => repository.append(input)).toThrow('DSH_JOURNAL_INPUT_INVALID');
    const proxy = new Proxy({ ...input, sequence: 1 }, { getPrototypeOf(target) { calls += 1; return Reflect.getPrototypeOf(target); } });
    calls = 0;
    expect(() => repository.append(proxy)).toThrow('DSH_JOURNAL_INPUT_INVALID');
    expect(calls).toBe(0);
    expect(database.prepare('SELECT count(*) AS n FROM dsh_attempt_journal').get()).toEqual({ n: 0 });
  } finally { database.close(); }
});
