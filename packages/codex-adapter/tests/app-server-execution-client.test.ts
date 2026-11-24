/* global URL, Buffer */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { expect, test, vi } from 'vitest';
import { AppServerExecutionClient } from '../src/app-server-execution-client.js';

const fixturePrincipal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');

// eslint-disable-next-line no-unused-vars -- callback parameter documents the proof check count.
function fixture(mode: string, version = '0.121.0', scopeProven: boolean | ((count: number) => boolean) = true, notifyOkay = true, expectedPrincipal = fixturePrincipal, receiptOkay = true) {
  const path = fileURLToPath(new URL('./fixtures/execution-app-server.mjs', import.meta.url));
  const child = spawn(process.execPath, [path, mode], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const closed = once(child, 'close');
  const writes = vi.spyOn(child.stdin, 'write');
  let checks = 0;
  let uncertain = 0;
  const receipts: unknown[] = [];
  const client = new AppServerExecutionClient(child, version, expectedPrincipal, async (actual: ChildProcess) => {
    checks += 1;
    return actual === child && (typeof scopeProven === 'function' ? scopeProven(checks) : scopeProven);
  }, () => { uncertain += 1; return notifyOkay; }, start => { receipts.push(start); return receiptOkay; });
  return { child, client, writes, receipts, uncertain: () => uncertain, async close() { client.dispose(); if (!child.stdin.destroyed) child.stdin.end(); await closed; } };
}

test.each(['normal', 'fragmented'])('uses pinned App Server shapes and correlates one Attempt (%s)', async mode => {
  const f = fixture(mode);
  try {
    await f.client.initialize();
    const result = await f.client.start(process.cwd(), 'Write the approved change');
    expect(result).toMatchObject({ threadId: 'thread-1', turnId: 'turn-1', cwd: process.cwd() });
    expect(result.principalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(f.receipts).toEqual([result]);
    // Bypassing TypeScript visibility must not reset the one-shot state.
    Reflect.set(f.client, 'state', 'READY');
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(f.writes.mock.calls.filter(call => String(call[0]).includes('"thread/start"'))).toHaveLength(1);
    expect(await f.client.interrupt()).toBe(true);
    expect(f.client.status()).not.toBe('CANCELLED');
    const wire = f.writes.mock.calls.map(call => String(call[0])).join('');
    expect(wire).toContain('"text_elements":[]');
    expect(wire).toContain('"turn/interrupt"');
    expect(wire).not.toContain('fixture@example.invalid');
  } finally { await f.close(); }
}, 15000);

test.each(['wrong-cwd', 'wrong-thread-cwd', 'wrong-reviewer', 'loose-sandbox', 'unknown-policy', 'account-switch', 'account-switch-after-thread', 'server-request'])('never sends a Turn after failed authority: %s', async mode => {
  const f = fixture(mode);
  try {
    await f.client.initialize();
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(f.writes.mock.calls.map(call => String(call[0])).join('')).not.toContain('"turn/start"');
    expect(f.client.status()).toBe('UNKNOWN');
  } finally { await f.close(); }
}, 15000);

test('retains UNKNOWN when a turn response is lost and cannot dispatch again', async () => {
  const f = fixture('lost-turn');
  try {
    await f.client.initialize();
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(f.client.status()).toBe('UNKNOWN');
    expect(f.uncertain()).toBe(1);
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(f.writes.mock.calls.filter(call => String(call[0]).includes('"turn/start"'))).toHaveLength(1);
  } finally { await f.close(); }
}, 15000);

test('exposes failure to persist an UNKNOWN transition instead of treating it as success', async () => {
  const f = fixture('lost-turn', '0.121.0', true, false);
  try {
    await f.client.initialize();
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(f.client.status()).toBe('UNKNOWN');
    expect(f.uncertain()).toBe(1);
    expect(f.client.unknownNotificationFailed()).toBe(true);
  } finally { await f.close(); }
}, 15000);

test('does not expose RUNNING if durable receipt persistence fails', async () => {
  const f = fixture('normal', '0.121.0', true, true, fixturePrincipal, false);
  try {
    await f.client.initialize();
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(f.receipts).toHaveLength(1);
    expect(f.client.status()).toBe('UNKNOWN');
    expect(f.uncertain()).toBe(1);
  } finally { await f.close(); }
}, 15000);

test('does not return a stale RUNNING receipt when completion arrives with the start response', async () => {
  const f = fixture('early-completed');
  try {
    await f.client.initialize();
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(f.client.status()).toBe('UNKNOWN');
    expect(f.receipts).toEqual([expect.objectContaining({ threadId: 'thread-1', turnId: 'turn-1' })]);
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
  } finally { await f.close(); }
}, 15000);

test('refuses an unpinned protocol before any request', async () => {
  const f = fixture('normal', '0.120.0');
  try {
    await expect(f.client.initialize()).rejects.toThrow();
    expect(f.writes).not.toHaveBeenCalled();
  } finally { await f.close(); }
}, 15000);

test('refuses an account that differs from the previously pinned principal', async () => {
  const f = fixture('normal', '0.121.0', true, true, '0'.repeat(64));
  try {
    await expect(f.client.initialize()).rejects.toThrow();
    const wire = f.writes.mock.calls.map(call => String(call[0])).join('');
    expect(wire).not.toContain('"thread/start"');
    expect(wire).not.toContain('"turn/start"');
    expect(f.client.status()).toBe('CLOSED');
  } finally { await f.close(); }
}, 15000);

test('requires independent process confinement proof before any thread or turn starts', async () => {
  const f = fixture('normal', '0.121.0', false);
  try {
    await f.client.initialize();
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    const wire = f.writes.mock.calls.map(call => String(call[0])).join('');
    expect(wire).not.toContain('"thread/start"');
    expect(wire).not.toContain('"turn/start"');
    expect(f.client.status()).toBe('UNKNOWN');
  } finally { await f.close(); }
}, 15000);

test('refuses Turn dispatch when confinement proof is lost after thread preparation', async () => {
  const f = fixture('normal', '0.121.0', count => count === 1);
  try {
    await f.client.initialize();
    await expect(f.client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    const wire = f.writes.mock.calls.map(call => String(call[0])).join('');
    expect(wire).toContain('"thread/start"');
    expect(wire).not.toContain('"turn/start"');
    expect(f.client.status()).toBe('UNKNOWN');
  } finally { await f.close(); }
}, 15000);

test('does not expose a raw arbitrary JSON-RPC request method', async () => {
  const f = fixture('normal');
  try {
    await f.client.initialize();
    expect(Reflect.get(f.client, 'request')).toBeUndefined();
    expect(Reflect.get(f.client, 'write')).toBeUndefined();
  } finally { await f.close(); }
}, 15000);

test('accepts multiple individually bounded frames in a single transport chunk', async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const child = Object.assign(new EventEmitter(), { stdin, stdout }) as unknown as ChildProcess;
  const client = new AppServerExecutionClient(child, '0.121.0', fixturePrincipal, async () => true, () => true, () => true);
  stdin.on('data', chunk => {
    const request = JSON.parse(String(chunk)) as { id?: number; method: string };
    if (request.method === 'initialize') {
      const notification = JSON.stringify({ method: 'item/agentMessage/delta', params: { delta: 'x'.repeat(600000) } });
      stdout.write(notification + '\n' + notification + '\n' + JSON.stringify({ id: request.id, result: { userAgent: 'fixture' } }) + '\n');
    } else if (request.method === 'account/read') {
      stdout.write(JSON.stringify({ id: request.id, result: { requiresOpenaiAuth: true,
        account: { type: 'chatgpt', email: 'fixture@example.invalid', planType: 'plus' } } }) + '\n');
    }
  });
  try {
    await expect(client.initialize()).resolves.toBeUndefined();
    expect(client.status()).toBe('READY');
  } finally { client.dispose(); stdin.destroy(); stdout.destroy(); }
});

test('rejects an oversized individual frame without exposing its content', async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const child = Object.assign(new EventEmitter(), { stdin, stdout }) as unknown as ChildProcess;
  const client = new AppServerExecutionClient(child, '0.121.0', fixturePrincipal, async () => true, () => true, () => true);
  stdin.on('data', () => {
    stdout.write(JSON.stringify({ method: 'item/agentMessage/delta', params: { delta: 'x'.repeat(1_048_576) } }) + '\n');
  });
  try {
    await expect(client.initialize()).rejects.toThrow(/^Codex execution outcome unavailable\.$/);
    expect(client.status()).toBe('CLOSED');
  } finally { client.dispose(); stdin.destroy(); stdout.destroy(); }
});

test('processes an enormous incoming chunk in bounded segments', async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const child = Object.assign(new EventEmitter(), { stdin, stdout }) as unknown as ChildProcess;
  const client = new AppServerExecutionClient(child, '0.121.0', fixturePrincipal, async () => true, () => true, () => true);
  const observed: number[] = [];
  const original = Buffer.byteLength.bind(Buffer);
  const spy = vi.spyOn(Buffer, 'byteLength').mockImplementation((value, ...args) => {
    if (typeof value === 'string') observed.push(value.length);
    return original(value, ...args);
  });
  stdin.on('data', () => stdout.write('x'.repeat(4_194_304)));
  try {
    await expect(client.initialize()).rejects.toThrow();
    expect(Math.max(...observed)).toBeLessThanOrEqual(1_114_112);
  } finally { spy.mockRestore(); client.dispose(); stdin.destroy(); stdout.destroy(); }
});

test('disposing a transport does not leave late child or stream errors unhandled', () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const emitter = new EventEmitter();
  const child = Object.assign(emitter, { stdin, stdout }) as unknown as ChildProcess;
  const client = new AppServerExecutionClient(child, '0.121.0', fixturePrincipal, async () => true, () => true, () => true);
  client.dispose();
  expect(() => emitter.emit('error', new Error('late child error'))).not.toThrow();
  expect(() => stdin.emit('error', new Error('late stdin error'))).not.toThrow();
  expect(() => stdout.emit('error', new Error('late stdout error'))).not.toThrow();
  stdin.destroy(); stdout.destroy();
});
