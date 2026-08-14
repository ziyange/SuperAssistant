import { describe, expect, test } from 'vitest';
import { applyAttemptEvent, canDispatchAttempt, createExecutionAttempt } from '../src/execution-attempt.js';

describe('ExecutionAttempt state machine', () => {
  test('deduplicates a repeated sequence and rejects a sequence gap', () => {
    const attempt = createExecutionAttempt({ attemptId: 'attempt-1', workItemId: 'work-1', requestId: 'request-1', idempotencyKey: 'key-1' });
    const started = applyAttemptEvent(attempt, { sequence: 1, type: 'EXECUTION_STARTED' });
    expect(applyAttemptEvent(started, { sequence: 1, type: 'EXECUTION_STARTED' })).toEqual(started);
    expect(applyAttemptEvent(started, { sequence: 3, type: 'ACTIVITY_RECORDED' })).toEqual(expect.objectContaining({ state: 'RECONCILING', lastSequence: 1 }));
  });

  test('permits dispatch only from an outbox-pending attempt and only after reconciliation proves no start', () => {
    const created = createExecutionAttempt({ attemptId: 'attempt-1', workItemId: 'work-1', requestId: 'request-1', idempotencyKey: 'key-1' });
    expect(canDispatchAttempt(created)).toBe(false);
    const pending = { ...created, state: 'DISPATCH_PENDING' as const };
    expect(canDispatchAttempt(pending)).toBe(true);
    const reconciling = applyAttemptEvent(pending, { sequence: 1, type: 'RECONCILIATION_STARTED' });
    const notStarted = applyAttemptEvent(reconciling, { sequence: 2, type: 'RECONCILIATION_NOT_STARTED' });
    expect(notStarted.state).toBe('NOT_STARTED');
    expect(canDispatchAttempt(notStarted)).toBe(false);
  });

  test('blocks redispatch while outcome is unknown or reconciling', () => {
    const attempt = createExecutionAttempt({ attemptId: 'attempt-1', workItemId: 'work-1', requestId: 'request-1', idempotencyKey: 'key-1' });
    const unknown = applyAttemptEvent(attempt, { sequence: 1, type: 'CONNECTION_LOST' });
    expect(unknown.state).toBe('UNKNOWN');
    expect(canDispatchAttempt(unknown)).toBe(false);
    expect(canDispatchAttempt({ ...unknown, state: 'RECONCILING' })).toBe(false);
  });
});
