import { describe, expect, it } from 'vitest';
import { DshEventJournal } from '../src/dsh-event-journal.js';

describe('DshEventJournal', () => {
  it('deduplicates an event and marks a sequence gap ambiguous', () => {
    const journal = new DshEventJournal('attempt-1');
    expect(journal.append({ sequence: 1, type: 'session.event', payload: { safe: true } }).state).toBe('COVERED');
    expect(journal.append({ sequence: 1, type: 'session.event', payload: { safe: true } }).deduplicated).toBe(true);
    expect(journal.append({ sequence: 3, type: 'session.event', payload: {} }).state).toBe('AMBIGUOUS');
  });

  it('redacts credential-like evidence before retaining it', () => {
    const journal = new DshEventJournal('attempt-1');
    const result = journal.append({ sequence: 1, type: 'session.event', payload: { token: 'secret', nested: { password: 'secret' }, safe: 'ok' } });
    expect(result.entry.payload).toEqual({ token: '[REDACTED]', nested: { password: '[REDACTED]' }, safe: 'ok' });
  });
});
