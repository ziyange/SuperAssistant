/* global setTimeout */
import { expect, test, vi } from 'vitest';
import { CodexExecutionAdapter } from '../src/execution.js';

test('does not report cancellation complete until termination and lease release both prove true', async () => {
  const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
  expect(await adapter.cancel({ attemptId: 'attempt-1' })).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  expect(await adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async () => undefined, releaseLease: async () => true })).toEqual({ attemptId: 'attempt-1', complete: true });
});

test('interrupts first, terminates the registered process tree, then releases the lease', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return {}; } });
  const result = await adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async (pid) => { calls.push(`terminate:${pid}`); }, releaseLease: async () => { calls.push('release'); return true; } });
  expect(result).toEqual({ attemptId: 'attempt-1', complete: true });
  expect(calls).toEqual(['interrupt', 'terminate:42', 'release']);
});

test('termination failure never calls release or reports completion', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
  const result = await adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async () => { throw new Error('still alive'); }, releaseLease: async () => { calls.push('release'); return true; } });
  expect(result).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  expect(calls).toEqual([]);
});

test('caller booleans cannot forge cancellation evidence', async () => {
  const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
  const forged = { attemptId: 'attempt-1', terminated: true, leaseReleased: true };
  await expect(adapter.cancel(forged)).resolves.toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
});

test('failed interrupt still attempts termination but does not release the lease', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); throw new Error('disconnected'); } });
  const result = await adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async () => { calls.push('terminate'); }, releaseLease: async () => { calls.push('release'); return true; } });
  expect(result).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  expect(calls).toEqual(['interrupt', 'terminate']);
});

test('invalid process identity or failed lease release cannot complete cancellation', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
  const incomplete = { attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' };
  expect(await adapter.cancel({ attemptId: 'attempt-1', processId: 0, terminateTree: async () => { calls.push('terminate'); }, releaseLease: async () => { calls.push('release'); return true; } })).toEqual(incomplete);
  expect(calls).toEqual([]);
  expect(await adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async () => undefined, releaseLease: async () => { throw new Error('release failed'); } })).toEqual(incomplete);
});

test.each(['interrupt', 'terminate', 'release'] as const)('a hung %s settles incomplete within the overall deadline', async (stage) => {
  vi.useFakeTimers();
  try {
    const calls: string[] = [];
    const never = new Promise<never>(() => undefined);
    const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return stage === 'interrupt' ? never : {}; } });
    const pending = adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async () => { calls.push('terminate'); if (stage === 'terminate') await never; }, releaseLease: async () => { calls.push('release'); return stage === 'release' ? never : true; } });
    const observed = Promise.race([pending, new Promise<string>((resolve) => setTimeout(() => resolve('hung'), 16_000))]);
    await vi.advanceTimersByTimeAsync(16_000);
    expect(await observed).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
    expect(calls).toEqual(stage === 'release' ? ['interrupt', 'terminate', 'release'] : ['interrupt', 'terminate']);
  } finally { vi.useRealTimers(); }
});

test('a stalled interrupt waits five seconds before terminating and retains the lease', async () => {
  vi.useFakeTimers();
  try {
    const calls: string[] = [];
    const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return new Promise(() => undefined); } });
    const pending = adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async () => { calls.push('terminate'); }, releaseLease: async () => { calls.push('release'); return true; } });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls).toEqual(['interrupt']);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
    expect(calls).toEqual(['interrupt', 'terminate']);
  } finally { vi.useRealTimers(); }
});

test('a release that completes after the deadline is not retried or reported as completed', async () => {
  vi.useFakeTimers();
  try {
    let releaseCount = 0;
    // eslint-disable-next-line no-unused-vars -- resolver parameter exists only in a type.
    let finishRelease: ((value: boolean) => void) | undefined;
    const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
    const pending = adapter.cancel({ attemptId: 'attempt-1', processId: 42, terminateTree: async () => undefined, releaseLease: () => { releaseCount += 1; return new Promise<boolean>((resolve) => { finishRelease = resolve; }); } });
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
    expect(releaseCount).toBe(1);
    finishRelease?.(true);
    await Promise.resolve();
    expect(releaseCount).toBe(1);
  } finally { vi.useRealTimers(); }
});

test('concurrent and repeated cancellation share one effect sequence', async () => {
  const calls: string[] = [];
  let unblock = () => {};
  const gate = new Promise<void>((resolve) => { unblock = resolve; });
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); await gate; return {}; } });
  const input = { attemptId: 'attempt-1', processId: 42, terminateTree: async () => { calls.push('terminate'); }, releaseLease: async () => { calls.push('release'); return true; } };
  const first = adapter.cancel(input);
  const second = adapter.cancel(input);
  unblock();
  expect(await Promise.all([first, second])).toEqual([{ attemptId: 'attempt-1', complete: true }, { attemptId: 'attempt-1', complete: true }]);
  expect(await adapter.cancel(input)).toEqual({ attemptId: 'attempt-1', complete: true });
  expect(calls).toEqual(['interrupt', 'terminate', 'release']);
});

test('a changed process identity cannot reuse a cancellation Attempt', async () => {
  const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
  const input = { attemptId: 'attempt-1', processId: 42, terminateTree: async () => undefined, releaseLease: async () => true };
  await adapter.cancel(input);
  await expect(adapter.cancel({ ...input, processId: 99 })).rejects.toThrow('CANCELLATION_IDEMPOTENCY_CONFLICT');
});

test('uncertain lease release is not repeated by another cancellation call', async () => {
  vi.useFakeTimers();
  try {
    const calls: string[] = [];
    const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return {}; } });
    const input = { attemptId: 'attempt-1', processId: 42, terminateTree: async () => { calls.push('terminate'); }, releaseLease: async () => { calls.push('release'); return new Promise<boolean>(() => undefined); } };
    const first = adapter.cancel(input);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(first).resolves.toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
    const replay = Promise.race([adapter.cancel(input), new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 1))]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await replay).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
    expect(calls).toEqual(['interrupt', 'terminate', 'release']);
  } finally { vi.useRealTimers(); }
});

test('invalid process identity fails before sending interrupt', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return {}; } });
  expect(await adapter.cancel({ attemptId: 'attempt-1', processId: 0 })).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  expect(calls).toEqual([]);
});
