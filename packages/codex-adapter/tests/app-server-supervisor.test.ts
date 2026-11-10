/* global URL, process, setTimeout */
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';
import * as adapter from '../src/index.js';
import * as worker from '../src/worker.js';

const fixture = fileURLToPath(new URL('./fixtures/fake-app-server-rpc.mjs', import.meta.url));
function supervisor(mode: string, timeout = 5000) {
  const factory = Reflect.get(adapter, 'createAppServerDiscoverySupervisor');
  expect(typeof factory).toBe('function');
  let child: ChildProcess | undefined;
  const owner = factory(() => { child = spawn(process.execPath, [fixture, mode], { stdio: ['pipe', 'pipe', 'ignore'] }); return child; }, '0.157.1', timeout, async (current: ChildProcess) => {
    if (current.exitCode !== null || current.signalCode !== null) return;
    const closed = once(current, 'close'); current.kill(); await closed;
  }) as { initialize(): Promise<{ health(): Promise<unknown>; describe(): Promise<unknown>; start(): Promise<unknown> }>; shutdown(): Promise<void> };
  return { owner, getChild: () => child };
}

function expectExited(child: ChildProcess | undefined): void {
  if (!child) throw new Error('fixture did not start');
  expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
}

test('supervises the read-only handshake without enabling an unsupported version or execution', async () => {
  const { owner, getChild } = supervisor('success');
  try {
    const connection = await owner.initialize();
    await expect(connection.health()).resolves.toMatchObject({ connection: 'VERSION_UNSUPPORTED', availability: 'UNAVAILABLE' });
    await expect(connection.describe()).resolves.toMatchObject({ adapterVersion: '0.157.1', functions: [] });
    await expect(connection.start()).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    await expect(owner.initialize()).rejects.toThrow();
  } finally { await owner.shutdown(); }
  expectExited(getChild());
});

test('malformed handshake terminates the owned process', async () => {
  const { owner, getChild } = supervisor('malformed');
  await expect(owner.initialize()).rejects.toThrow();
  expectExited(getChild());
});

test('timeout terminates the owned process', async () => {
  const { owner, getChild } = supervisor('silent', 100);
  await expect(owner.initialize()).rejects.toThrow();
  expectExited(getChild());
});

test('shutdown during discovery rejects the pending initialization', async () => {
  const { owner, getChild } = supervisor('silent');
  const pending = owner.initialize();
  const rejected = expect(pending).rejects.toThrow();
  await owner.shutdown();
  await rejected;
  expectExited(getChild());
});

test('a terminated child cannot retain cached health or capabilities', async () => {
  const { owner, getChild } = supervisor('success');
  try {
    const connection = await owner.initialize();
    const child = getChild();
    if (!child) throw new Error('fixture did not start');
    const closed = once(child, 'close'); child.kill(); await closed;
    await expect(connection.health()).rejects.toThrow();
    await expect(connection.describe()).rejects.toThrow();
  } finally { await owner.shutdown(); }
});

test('default process-tree termination waits for the actual child to exit', async () => {
  const factory = Reflect.get(adapter, 'createAppServerDiscoverySupervisor');
  expect(typeof factory).toBe('function');
  let child: ChildProcess | undefined;
  const owner = factory(() => { child = spawn(process.execPath, [fixture, 'success'], { stdio: ['pipe', 'pipe', 'ignore'] }); return child; }, '0.157.1') as { initialize(): Promise<unknown>; shutdown(): Promise<void> };
  await owner.initialize();
  await owner.shutdown();
  expectExited(child);
});

test('supervisor observes a thread over its own child without exposing its identity', async () => {
  const { owner } = supervisor('success');
  try {
    await owner.initialize();
    const observe = Reflect.get(owner, 'observe');
    expect(typeof observe).toBe('function');
    await expect(observe.call(owner, 'thread-1')).resolves.toBe('IDLE');
  } finally { await owner.shutdown(); }
});

test('shutdown rejects a pending observation and invalidates discovery', async () => {
  const { owner, getChild } = supervisor('hold-read');
  const connection = await owner.initialize();
  const observe = Reflect.get(owner, 'observe');
  expect(typeof observe).toBe('function');
  const pending = observe.call(owner, 'thread-1');
  const rejected = expect(pending).rejects.toThrow();
  await owner.shutdown();
  await rejected;
  await expect(connection.health()).rejects.toThrow();
  expectExited(getChild());
});

test('invalid observation closes the child and invalidates cached health', async () => {
  const { owner, getChild } = supervisor('bad-read');
  try {
    const connection = await owner.initialize();
    const observe = Reflect.get(owner, 'observe');
    expect(typeof observe).toBe('function');
    await expect(observe.call(owner, 'thread-1')).rejects.toThrow();
    await expect(connection.health()).rejects.toThrow();
    expectExited(getChild());
  } finally { await owner.shutdown(); }
});

test('unsolicited malformed data invalidates idle cached health', async () => {
  const { owner, getChild } = supervisor('success');
  try {
    const connection = await owner.initialize();
    const stdout = getChild()?.stdout;
    if (!stdout) throw new Error('fixture stdout missing');
    stdout.emit('data', '{broken}\n');
    await expect(connection.health()).rejects.toThrow();
    await expect(connection.describe()).rejects.toThrow();
  } finally { await owner.shutdown(); }
});

test.skipIf(process.platform !== 'win32')('shutdown reports failure when the tree terminator hangs', async () => {
  const blockedTerminator = vi.spyOn(worker, 'terminateProcessTree').mockImplementation(() => new Promise(() => undefined));
  let child: ChildProcess | undefined;
  try {
    const owner = adapter.createAppServerDiscoverySupervisor(() => {
      child = spawn(process.execPath, [fixture, 'success'], { stdio: ['pipe', 'pipe', 'ignore'] });
      return child;
    }, '0.157.1');
    await owner.initialize();
    const outcome = await Promise.race([
      owner.shutdown().then(() => 'resolved', () => 'rejected'),
      new Promise<string>((resolve) => setTimeout(() => resolve('hung'), 6500))
    ]);
    expect(outcome).toBe('rejected');
  } finally {
    blockedTerminator.mockRestore();
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close'); child.kill(); await closed;
    }
  }
}, 10_000);
