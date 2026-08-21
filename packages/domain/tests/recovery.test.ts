import { describe, expect, test } from 'vitest';
import { reconcileAttempt } from '../src/recovery.js';

describe('restart recovery', () => {
  test('keeps an unknown attempt reconciling when the adapter cannot supply a result', () => {
    const outcome = reconcileAttempt(
      { attemptId: 'attempt-1', state: 'UNKNOWN', lastSequence: 4 },
      { status: 'RUNNING', events: 'AVAILABLE', result: 'MISSING' }
    );

    expect(outcome).toEqual({ attemptId: 'attempt-1', state: 'RECONCILING', dispatchAllowed: false, mode: 'READ_ONLY' });
  });

  test('uses a durable terminal result without authorizing a second dispatch', () => {
    const outcome = reconcileAttempt(
      { attemptId: 'attempt-1', state: 'RECONCILING', lastSequence: 4 },
      { status: 'UNAVAILABLE', events: 'AVAILABLE', result: 'SUCCEEDED' }
    );

    expect(outcome).toEqual({ attemptId: 'attempt-1', state: 'SUCCEEDED', dispatchAllowed: false, mode: 'READ_ONLY' });
  });
});
