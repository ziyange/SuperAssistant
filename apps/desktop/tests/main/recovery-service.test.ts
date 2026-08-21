import { expect, test } from 'vitest';
import { reconcileAfterRestart } from '../../src/main/recovery-service.js';

test('keeps dispatch disabled when a restarted adapter has no durable attempt result', async () => {
  const recovery = await reconcileAfterRestart(
    [{ attemptId: 'attempt-1', state: 'UNKNOWN', lastSequence: 2 }],
    { status: async () => 'RUNNING', events: async () => 'AVAILABLE', result: async () => 'MISSING' }
  );

  expect(recovery).toEqual({ mode: 'DEGRADED_READ_ONLY', attempts: [{ attemptId: 'attempt-1', state: 'RECONCILING', dispatchAllowed: false, mode: 'READ_ONLY' }] });
});

test('reports normal read-only diagnostics after a durable terminal result', async () => {
  const recovery = await reconcileAfterRestart(
    [{ attemptId: 'attempt-1', state: 'RECONCILING', lastSequence: 2 }],
    { status: async () => 'UNAVAILABLE', events: async () => 'AVAILABLE', result: async () => 'CANCELLED' }
  );

  expect(recovery).toEqual({ mode: 'NORMAL', attempts: [{ attemptId: 'attempt-1', state: 'CANCELLED', dispatchAllowed: false, mode: 'READ_ONLY' }] });
});
