/* global Buffer, process */
/* eslint-disable no-unused-vars -- callback parameter names document test-only contracts. */
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { createAppServerDiscoverySupervisor, terminateProcessTree } from '@super-assistant/codex-adapter';
import { expect, test, vi } from 'vitest';
import * as discovery from '../../src/main/codex-discovery-ipc.js';

function factory() {
  const create = Reflect.get(discovery, 'createCodexDiscoveryCheck');
  expect(typeof create).toBe('function');
  return create as (choose: () => Promise<string | null>, probe: (path: string) => Promise<unknown>) => () => Promise<unknown>;
}

test('cancelled selection never starts a probe', async () => {
  const probe = vi.fn();
  const check = factory()(async () => null, probe);
  await expect(check()).resolves.toEqual({ state: 'CANCELLED' });
  expect(probe).not.toHaveBeenCalled();
});

test('concurrent checks use one selection and one probe and sanitize output', async () => {
  let release!: (value: unknown) => void;
  const probe = vi.fn(() => new Promise<unknown>(resolve => { release = resolve; }));
  const choose = vi.fn(async () => 'C:/private/codex.exe');
  const check = factory()(choose, probe);
  const first = check(); const second = check();
  await vi.waitFor(() => expect(probe).toHaveBeenCalledTimes(1));
  release({ state: 'CHECKED', connection: 'VERSION_UNSUPPORTED', availability: 'UNAVAILABLE', version: '0.157.1', observedAt: '2026-11-09T00:00:00.000Z', privatePath: 'C:/private/codex.exe' });
  const [a, b] = await Promise.all([first, second]);
  expect(choose).toHaveBeenCalledTimes(1);
  expect(a).toEqual(b);
  expect(JSON.stringify(a)).not.toContain('private');
  expect(a).toMatchObject({ state: 'CHECKED', connection: 'VERSION_UNSUPPORTED' });
});

test('probe failures do not expose paths or secret-bearing errors', async () => {
  const check = factory()(async () => 'C:/private/codex.exe', async () => { throw new Error('private-secret'); });
  const result = await check();
  expect(result).toEqual({ state: 'UNAVAILABLE' });
  expect(JSON.stringify(result)).not.toContain('private');
});

test('discovery shuts down its supervisor before returning a projected observation', async () => {
  const create = Reflect.get(discovery, 'createCodexProbe');
  expect(typeof create).toBe('function');
  const calls: string[] = [];
  const supervisor = {
    async initialize() {
      calls.push('initialize');
      return {
        async health() { return { connection: 'AUTH_REQUIRED', availability: 'PAUSED', observedAt: '2026-11-09T00:00:00.000Z' }; },
        async describe() { return { adapterVersion: '0.121.0', functions: ['private'] }; }
      };
    },
    async shutdown() { calls.push('shutdown'); }
  };
  const probe = create(async () => '0.121.0', () => supervisor);
  await expect(probe('C:/codex.exe')).resolves.toEqual({ state: 'CHECKED', connection: 'AUTH_REQUIRED', availability: 'PAUSED', version: '0.121.0', observedAt: '2026-11-09T00:00:00.000Z' });
  expect(calls).toEqual(['initialize', 'shutdown']);
});

test('shutdown is awaited and failure never returns a successful check', async () => {
  const create = Reflect.get(discovery, 'createCodexProbe');
  expect(typeof create).toBe('function');
  const shutdown = vi.fn(async () => { throw new Error('private detail'); });
  const probe = create(async () => '0.121.0', () => ({ initialize: async () => ({ health: async () => ({ connection: 'CONNECTED', availability: 'AVAILABLE', observedAt: '2026-11-09T00:00:00.000Z' }), describe: async () => ({ adapterVersion: '0.121.0' }) }), shutdown }));
  await expect(probe('C:/codex.exe')).rejects.toThrow();
  expect(shutdown).toHaveBeenCalledOnce();
});

test('unexpected health states fail closed after shutdown', async () => {
  const create = Reflect.get(discovery, 'createCodexProbe');
  const shutdown = vi.fn(async () => undefined);
  const probe = create(async () => '0.121.0', () => ({
    initialize: async () => ({
      health: async () => ({ connection: 'FORGED', availability: 'AVAILABLE', observedAt: '2026-11-09T00:00:00.000Z' }),
      describe: async () => ({ adapterVersion: '0.121.0' })
    }), shutdown
  }));
  await expect(probe('C:/codex.exe')).rejects.toThrow();
  expect(shutdown).toHaveBeenCalledOnce();
});

test('desktop probe integrates with a real supervised fake App Server child', async () => {
  let child: ChildProcess | undefined;
  const fixture = resolve(process.cwd(), 'packages/codex-adapter/tests/fixtures/fake-app-server-rpc.mjs');
  const probe = discovery.createCodexProbe(async () => '0.121.0', (_path, version) =>
    createAppServerDiscoverySupervisor(() => {
      child = spawn(process.execPath, [fixture, 'success'], { stdio: ['pipe', 'pipe', 'ignore'] });
      return child;
    }, version, 5000, async (current) => {
      if (current.exitCode !== null || current.signalCode !== null) return;
      const closed = once(current, 'close');
      current.kill();
      await closed;
    }));
  try {
    const result = await probe('C:/fixture.exe');
    expect(result).toMatchObject({ state: 'CHECKED', connection: 'CONNECTED', version: '0.121.0' });
    expect(child?.exitCode !== null || child?.signalCode !== null).toBe(true);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
  }
});

test('version timeout terminates the process tree and waits for confirmed close', async () => {
  vi.useFakeTimers();
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), pid: 42 });
  let finishTermination!: () => void;
  const terminate = vi.fn(() => new Promise<void>(resolve => { finishTermination = resolve; }));
  const make = Reflect.get(discovery, 'createVersionProbe');
  expect(typeof make).toBe('function');
  const read = make(() => child as unknown as ChildProcess, terminate, 50);
  const pending = read('C:/codex.exe');
  const rejected = expect(pending).rejects.toThrow();
  try {
    await vi.advanceTimersByTimeAsync(50);
    expect(terminate).toHaveBeenCalledOnce();
    let settled = false;
    void pending.finally(() => { settled = true; }).catch(() => undefined);
    child.emit('close', null);
    await Promise.resolve();
    expect(settled).toBe(false);
    finishTermination();
    await rejected;
  } finally { vi.useRealTimers(); }
});

test('version check rejects oversized output and terminates its process', async () => {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), pid: 42 });
  const terminate = vi.fn(async () => { child.emit('close', null); });
  const make = Reflect.get(discovery, 'createVersionProbe');
  expect(typeof make).toBe('function');
  const pending = make(() => child as unknown as ChildProcess, terminate, 5000)('C:/codex.exe');
  const rejected = expect(pending).rejects.toThrow();
  child.stdout.write('x'.repeat(4097));
  await rejected;
  expect(terminate).toHaveBeenCalledOnce();
});

test('version check accepts only the bounded Codex version line and a clean exit', async () => {
  const make = Reflect.get(discovery, 'createVersionProbe');
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), pid: 42 });
  const terminate = vi.fn(async () => undefined);
  const pending = make(() => child as unknown as ChildProcess, terminate, 5000)('C:/codex.exe');
  child.stdout.write('codex-cli 0.121.0\n');
  child.emit('close', 0);
  await expect(pending).resolves.toBe('0.121.0');
  expect(terminate).not.toHaveBeenCalled();
});

test('version check rejects forged output even after a clean exit', async () => {
  const make = Reflect.get(discovery, 'createVersionProbe');
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), pid: 42 });
  const pending = make(() => child as unknown as ChildProcess, async () => undefined, 5000)('C:/codex.exe');
  const rejected = expect(pending).rejects.toThrow();
  child.stdout.write('codex-cli 0.121.0 private-data');
  child.emit('close', 0);
  await rejected;
});

test.skipIf(process.platform !== 'win32')('version timeout kills a real fake process tree before returning', async () => {
  const fixture = resolve(process.cwd(), 'packages/codex-adapter/tests/fixtures/fake-app-server.mjs');
  let child: ChildProcess | undefined;
  let descendant = 0;
  const probe = discovery.createVersionProbe(() => {
    child = spawn(process.execPath, [fixture], { env: { ...process.env, FAKE_APP_SERVER_MODE: 'tree' }, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    child.stdout?.on('data', (chunk: Buffer) => { descendant = Number(chunk.toString().trim().replace('child:', '')); });
    return child;
  }, async current => {
    if (!current.pid) throw new Error('Missing fixture PID.');
    await terminateProcessTree(current.pid);
  }, 1500);
  try {
    await expect(probe('C:/fixture.exe')).rejects.toThrow();
    expect(descendant).toBeGreaterThan(0);
    expect(child && (child.exitCode !== null || child.signalCode !== null)).toBe(true);
    await vi.waitFor(() => {
      let alive = true;
      try { process.kill(descendant, 0); } catch { alive = false; }
      expect(alive).toBe(false);
    }, { timeout: 5000 });
  } finally {
    if (child && child.exitCode === null && child.signalCode === null && child.pid) await terminateProcessTree(child.pid);
    if (descendant > 0) {
      try { process.kill(descendant, 0); await terminateProcessTree(descendant); } catch { /* fixture already exited */ }
    }
  }
}, 15000);
