import { expect, test } from 'vitest';
import { applyDshSequence, canRedispatchDsh } from '../src/dsh-execution.js';

test('DSH sequence gaps reconcile and are never redispatchable', () => {
  const attempt = { attemptId: 'attempt-1', workItemId: 'work-item-1', requestId: 'request-1', idempotencyKey: 'key-1', state: 'RUNNING' as const, lastSequence: 1 };
  const reconciled = applyDshSequence(attempt, 3);
  expect(reconciled.state).toBe('RECONCILING');
  expect(canRedispatchDsh(reconciled)).toBe(false);
});
