import { expect, test } from 'vitest';
import { CodexExecutionAdapter } from '../src/execution.js';

test('does not report cancellation complete until termination and lease release both prove true', async () => {
  const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
  expect(await adapter.cancel({ attemptId: 'attempt-1', terminated: false, leaseReleased: true })).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  expect(await adapter.cancel({ attemptId: 'attempt-1', terminated: true, leaseReleased: true })).toEqual({ attemptId: 'attempt-1', complete: true });
});

test('interrupts first, terminates the registered process tree, then releases the lease', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return {}; } });
  const result = await adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async (pid) => { calls.push(`terminate:${pid}`); }, releaseLease: async () => { calls.push('release'); return true; } });
  expect(result).toEqual({ attemptId: 'attempt-1', complete: true });
  expect(calls).toEqual(['interrupt', 'terminate:42', 'release']);
});
