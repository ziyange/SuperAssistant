/* eslint-disable no-unused-vars -- test-double signatures describe event contracts. */
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  workers: [] as Array<{ emit(event: string, value: unknown): boolean; terminate(): Promise<number> }>
}));

vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  class FakeWorker extends EventEmitter {
    constructor() { super(); state.workers.push(this); }
    async terminate() { return 0; }
  }
  return { Worker: FakeWorker };
});

import { readProjectHeadAsync } from '../../src/main/async-project-baseline.js';

test('timeouts retain occupied slots until exit and ignore late worker results', async () => {
  vi.useFakeTimers();
  try {
    const path = resolve('fixture-project');
    const first = readProjectHeadAsync(path);
    const second = readProjectHeadAsync(path);
    expect(await readProjectHeadAsync(path)).toBeNull();
    expect(state.workers).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await first).toBeNull();
    expect(await second).toBeNull();
    expect(await readProjectHeadAsync(path)).toBeNull();
    state.workers[0]?.emit('message', 'a'.repeat(40));
    state.workers[0]?.emit('exit', 0);
    expect(await first).toBeNull();
    const next = readProjectHeadAsync(path);
    expect(state.workers).toHaveLength(3);
    state.workers[2]?.emit('message', 'b'.repeat(40));
    state.workers[2]?.emit('exit', 0);
    expect(await next).toBe('b'.repeat(40));
    state.workers[1]?.emit('exit', 1);
  } finally { vi.useRealTimers(); }
});
