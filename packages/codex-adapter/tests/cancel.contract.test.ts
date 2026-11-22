import { expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { CodexExecutionAdapter } from '../src/execution.js';

test('legacy cancellation never interrupts, terminates or releases without an owned supervisor', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return {}; } });
  const result = await adapter.cancel({ attemptId: 'attempt-1', processId: 42,
    terminateTree: async () => { calls.push('terminate'); },
    releaseLease: async () => { calls.push('release'); return true; } });
  expect(result).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  expect(calls).toEqual([]);
});

test.each([0, -1, 42, 2147483647, Number.NaN])('untrusted PID %s cannot trigger a side effect', async processId => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return {}; } });
  const result = await adapter.cancel({ attemptId: 'attempt-1', processId,
    terminateTree: async () => { calls.push('terminate'); },
    releaseLease: async () => { calls.push('release'); return true; } });
  expect(result).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  expect(calls).toEqual([]);
});

test('concurrent and repeated calls cannot produce delayed termination or lease release', async () => {
  const calls: string[] = [];
  const adapter = new CodexExecutionAdapter({ request: async () => { calls.push('interrupt'); return {}; } });
  const input = { attemptId: 'attempt-1', processId: 42,
    terminateTree: async () => { calls.push('terminate'); },
    releaseLease: async () => { calls.push('release'); return true; } };
  const results = await Promise.all(Array.from({ length: 100 }, () => adapter.cancel(input)));
  expect(results.every(result => result.complete === false && result.code === 'CANCELLATION_INCOMPLETE')).toBe(true);
  expect(await adapter.cancel({ ...input, processId: 99 })).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
  await Promise.resolve();
  expect(calls).toEqual([]);
});

test('caller booleans and callbacks cannot forge termination evidence', async () => {
  const adapter = new CodexExecutionAdapter({ request: async () => { throw new Error('must not run'); } });
  const forged = { attemptId: 'attempt-1', processId: 42, terminated: true, leaseReleased: true,
    terminateTree: async () => { throw new Error('must not run'); },
    releaseLease: async () => { throw new Error('must not run'); } };
  expect(await adapter.cancel(forged)).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
});

test('a real unrelated child process remains alive after PID-only cancellation', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
  await once(child, 'spawn');
  try {
    const pid = child.pid;
    if (typeof pid !== 'number') throw new Error('Fixture PID unavailable');
    const adapter = new CodexExecutionAdapter({ request: async () => { throw new Error('must not run'); } });
    const result = await adapter.cancel({ attemptId: 'attempt-1', processId: pid });
    expect(result).toEqual({ attemptId: 'attempt-1', complete: false, code: 'CANCELLATION_INCOMPLETE' });
    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'exit');
      child.kill();
      await closed;
    }
  }
}, 10000);
