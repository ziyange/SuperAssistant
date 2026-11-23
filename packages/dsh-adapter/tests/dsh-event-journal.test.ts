import { describe, expect, it, vi } from 'vitest';
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

  it('redacts common API keys, private keys and cookies in event fields', () => {
    const journal = new DshEventJournal('attempt-1');
    const result = journal.append({ sequence: 1, type: 'event', payload: { api_key: 'key', nested: { privateKey: 'private', cookie: 'session' } } });
    expect(result.entry.payload).toEqual({ api_key: '[REDACTED]', nested: { privateKey: '[REDACTED]', cookie: '[REDACTED]' } });
  });

  it('marks conflicting duplicates ambiguous even when their secret fields redact identically', () => {
    const journal = new DshEventJournal('attempt-1');
    journal.append({ sequence: 1, type: 'session.event', payload: { token: 'first', safe: true } });
    const conflict = journal.append({ sequence: 1, type: 'session.event', payload: { token: 'second', safe: true } });
    expect(conflict.state).toBe('AMBIGUOUS');
    expect(conflict.deduplicated).toBe(false);
    expect(conflict.entry.payload).toEqual({ token: '[REDACTED]', safe: true });
  });

  it('does not let callers mutate retained evidence through input or output references', () => {
    const journal = new DshEventJournal('attempt-1');
    const payload = { nested: { value: 'original' } };
    const result = journal.append({ sequence: 1, type: 'session.event', payload });
    payload.nested.value = 'input-tamper';
    (result.entry.payload.nested as { value: string }).value = 'output-tamper';
    const replay = journal.append({ sequence: 1, type: 'session.event', payload: { nested: { value: 'original' } } });
    expect(replay.deduplicated).toBe(true);
    expect(replay.entry.payload).toEqual({ nested: { value: 'original' } });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('marks invalid sequence %s ambiguous', sequence => {
    const journal = new DshEventJournal('attempt-1');
    expect(journal.append({ sequence, type: 'event', payload: {} }).state).toBe('AMBIGUOUS');
  });

  it('fails closed for cyclic and oversized payloads without retaining their contents', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    for (const payload of [cyclic, { data: 'x'.repeat(1_048_577) }]) {
      const journal = new DshEventJournal('attempt-1');
      const result = journal.append({ sequence: 1, type: 'event', payload });
      expect(result.state).toBe('AMBIGUOUS');
      expect(result.entry.payload).toEqual({});
    }
  });

  it('rejects accessors without invoking them in an envelope or nested array', () => {
    let calls = 0;
    const envelope = { sequence: 1, type: 'event', payload: {} };
    Object.defineProperty(envelope, 'type', { enumerable: true, get() { calls += 1; return 'event'; } });
    expect(new DshEventJournal('a').append(envelope).state).toBe('AMBIGUOUS');
    const array = [0];
    Object.defineProperty(array, '0', { enumerable: true, get() { calls += 1; return 0; } });
    expect(new DshEventJournal('a').append({ sequence: 1, type: 'event', payload: { array } }).state).toBe('AMBIGUOUS');
    expect(calls).toBe(0);
  });

  it('rejects proxy inputs without invoking their traps', () => {
    let calls = 0;
    const proxy = new Proxy({ value: 1 }, { getPrototypeOf(target) { calls += 1; return Reflect.getPrototypeOf(target); } });
    const result = new DshEventJournal('a').append({ sequence: 1, type: 'event', payload: { proxy } });
    expect(result.state).toBe('AMBIGUOUS');
    expect(calls).toBe(0);
  });

  it('rejects sparse arrays with extra properties instead of equating them to null', () => {
    const sparse: unknown[] = new Array(1);
    Object.assign(sparse, { extra: 'unexpected' });
    const result = new DshEventJournal('a').append({ sequence: 1, type: 'event', payload: { sparse } });
    expect(result.state).toBe('AMBIGUOUS');
    expect(result.entry.payload).toEqual({});
  });

  it('rejects an aggregate byte-budget overflow before serializing the whole event', () => {
    const text = 'x'.repeat(65536);
    const stringify = vi.spyOn(JSON, 'stringify');
    try {
      const result = new DshEventJournal('a').append({ sequence: 1, type: 'event', payload: { repeated: Array(20).fill(text) } });
      const calls = stringify.mock.calls.length;
      expect(result.state).toBe('AMBIGUOUS');
      expect(result.entry.payload).toEqual({});
      expect(calls).toBe(0);
    } finally { stringify.mockRestore(); }
  });

  it('bounds nested depth and JSON escape expansion', () => {
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 35; index++) nested = { nested };
    for (const payload of [nested, { text: '\u0000'.repeat(200_000) }]) {
      const result = new DshEventJournal('a').append({ sequence: 1, type: 'event', payload });
      expect(result.state).toBe('AMBIGUOUS');
      expect(result.entry.payload).toEqual({});
    }
  });

  it('treats reordered object keys as the same event but a changed event type as a conflict', () => {
    const journal = new DshEventJournal('a');
    journal.append({ sequence: 1, type: 'event', payload: { a: 1, b: 2 } });
    expect(journal.append({ sequence: 1, type: 'event', payload: { b: 2, a: 1 } }).deduplicated).toBe(true);
    const conflict = journal.append({ sequence: 1, type: 'different', payload: { a: 1, b: 2 } });
    expect(conflict.state).toBe('AMBIGUOUS');
    expect(conflict.deduplicated).toBe(false);
  });
});
