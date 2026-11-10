/* global Buffer, queueMicrotask, setTimeout */
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { expect, test, vi } from 'vitest';
import * as implementation from '../src/app-server-client.js';

// eslint-disable-next-line no-unused-vars -- parameter names describe the test-only interface.
type Client = { discover(version: string): Promise<{ version: string; authenticated: boolean; capabilities: string[] }>; threadStatus(threadId: string): Promise<string>; dispose(): void };
// eslint-disable-next-line no-unused-vars -- fixture callback names document the wire boundary.
function setup(onRequest: (request: Record<string, unknown>, stdout: PassThrough) => void, timeoutMs = 1000) {
  const Factory = Reflect.get(implementation, 'ReadOnlyAppServerClient');
  expect(typeof Factory).toBe('function');
  const stdin = new PassThrough(); const stdout = new PassThrough();
  const child = Object.assign(new EventEmitter(), { stdin, stdout });
  const requests: Record<string, unknown>[] = [];
  stdin.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split('\n').filter(Boolean)) {
      const request = JSON.parse(line) as Record<string, unknown>;
      requests.push(request); queueMicrotask(() => onRequest(request, stdout));
    }
  });
  const client = Reflect.construct(Factory, [child as unknown as ChildProcess, timeoutMs]) as Client;
  return { client, child, requests };
}
function handshake(request: Record<string, unknown>, stdout: PassThrough): void {
  if (request.method === 'initialize') stdout.write(JSON.stringify({ id: request.id, result: { userAgent: 'fixture', codexHome: 'private-home' } }) + '\n');
  if (request.method === 'account/read') stdout.write(JSON.stringify({ id: request.id, result: { account: { type: 'chatgpt', email: 'private@example.invalid' }, requiresOpenaiAuth: true } }) + '\n');
}

test('observes a thread without leaking identifiers or account data', async () => {
  const fake = setup((request, stdout) => {
    handshake(request, stdout);
    if (request.method === 'thread/read') {
      const id = (request.params as { threadId: string }).threadId;
      stdout.write(JSON.stringify({ id: request.id, result: { thread: { id, status: { type: 'active' }, turns: [{ private: 'private-content' }] } } }) + '\n');
    }
  });
  try {
    const discovery = await fake.client.discover('0.157.1');
    expect(discovery).toEqual({ version: '0.157.1', authenticated: true, capabilities: [] });
    expect(JSON.stringify(discovery)).not.toMatch(/private|example/);
    await expect(fake.client.threadStatus('thread-1')).resolves.toBe('ACTIVE');
    expect(fake.requests.map(item => item.method)).toEqual(['initialize', 'initialized', 'account/read', 'thread/read']);
  } finally { fake.client.dispose(); }
});

test('correlates concurrent observations when replies arrive out of order', async () => {
  const reads: Record<string, unknown>[] = [];
  const fake = setup((request, stdout) => {
    handshake(request, stdout);
    if (request.method !== 'thread/read') return;
    reads.push(request);
    if (reads.length !== 2) return;
    const first = reads[0]; const second = reads[1];
    if (!first || !second) throw new Error('missing fixture request');
    stdout.write(JSON.stringify({ id: second.id, result: { thread: { id: 'thread-2', status: { type: 'idle' } } } }) + '\n');
    stdout.write(JSON.stringify({ id: first.id, result: { thread: { id: 'thread-1', status: { type: 'active' } } } }) + '\n');
  });
  try {
    await fake.client.discover('0.157.1');
    await expect(Promise.all([fake.client.threadStatus('thread-1'), fake.client.threadStatus('thread-2')])).resolves.toEqual(['ACTIVE', 'IDLE']);
  } finally { fake.client.dispose(); }
});

test('unknown thread state is indeterminate and is never a terminal success', async () => {
  const fake = setup((request, stdout) => { handshake(request, stdout); if (request.method === 'thread/read') stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: 'thread-1', status: { type: 'notLoaded' } } } }) + '\n'); });
  try { await fake.client.discover('0.157.1'); await expect(fake.client.threadStatus('thread-1')).resolves.toBe('INDETERMINATE'); } finally { fake.client.dispose(); }
});

test('rejects mismatched thread identity and closes the observation client', async () => {
  const fake = setup((request, stdout) => { handshake(request, stdout); if (request.method === 'thread/read') stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: 'different-thread', status: { type: 'idle' } } } }) + '\n'); });
  try { await fake.client.discover('0.157.1'); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(); } finally { fake.client.dispose(); }
});

test('fails closed on a server approval request without returning private payload', async () => {
  const fake = setup((request, stdout) => { handshake(request, stdout); if (request.method === 'thread/read') stdout.write(JSON.stringify({ id: 900, method: 'item/commandExecution/requestApproval', params: { command: 'private-secret' } }) + '\n'); });
  try { await fake.client.discover('0.157.1'); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(/^Codex discovery failed\.$/); expect(JSON.stringify(fake.requests)).not.toContain('private-secret'); expect(fake.requests).toHaveLength(4); } finally { fake.client.dispose(); }
});

test('rejects invalid identifiers before writing and rejects calls after process exit', async () => {
  const fake = setup(handshake);
  try { await fake.client.discover('0.157.1'); await expect(fake.client.threadStatus('../escape')).rejects.toThrow(); expect(fake.requests).toHaveLength(3); fake.child.emit('exit', 0); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(); expect(fake.requests).toHaveLength(3); } finally { fake.client.dispose(); }
});

test('does not return an observation when a server request follows the response in the same chunk', async () => {
  const fake = setup((request, stdout) => {
    handshake(request, stdout);
    if (request.method === 'thread/read') stdout.write(JSON.stringify({ id: request.id, result: { thread: { id: 'thread-1', status: { type: 'active' } } } }) + '\n' + JSON.stringify({ id: 900, method: 'item/commandExecution/requestApproval', params: {} }) + '\n');
  });
  try { await fake.client.discover('0.157.1'); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(); } finally { fake.client.dispose(); }
});

test('process exit immediately after the account reply cannot resurrect discovery', async () => {
  let fake: ReturnType<typeof setup>;
  fake = setup((request, stdout) => { handshake(request, stdout); if (request.method === 'account/read') fake.child.emit('exit', 0); });
  try { await expect(fake.client.discover('0.157.1')).rejects.toThrow(); } finally { fake.client.dispose(); }
});

test('invalid version closes the client instead of permitting a later handshake', async () => {
  const fake = setup(handshake);
  try { await expect(fake.client.discover('bad-version')).rejects.toThrow(); await expect(fake.client.discover('0.157.1')).rejects.toThrow(); expect(fake.requests).toHaveLength(0); } finally { fake.client.dispose(); }
});

test('an unknown response ID closes the client without exposing upstream data', async () => {
  const fake = setup((request, stdout) => { handshake(request, stdout); if (request.method === 'thread/read') stdout.write(JSON.stringify({ id: 999, result: { private: 'secret-value' } }) + '\n'); });
  try { await fake.client.discover('0.157.1'); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(/^Codex discovery failed\.$/); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(); } finally { fake.client.dispose(); }
});

test('stdout closing while a read is pending rejects the read', async () => {
  const fake = setup((request, stdout) => { handshake(request, stdout); if (request.method === 'thread/read') stdout.destroy(); });
  try { await fake.client.discover('0.157.1'); await expect(fake.client.threadStatus('thread-1')).rejects.toThrow(/^Codex discovery failed\.$/); } finally { fake.client.dispose(); }
});

test('the handshake shares one total deadline across initialization and account read', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  try {
    const fake = setup((request, stdout) => {
      if (request.method === 'initialize') setTimeout(() => stdout.write(JSON.stringify({ id: request.id, result: { userAgent: 'fixture' } }) + '\n'), 30);
      if (request.method === 'account/read') setTimeout(() => stdout.write(JSON.stringify({ id: request.id, result: { account: null, requiresOpenaiAuth: true } }) + '\n'), 30);
    }, 50);
    const discovery = fake.client.discover('0.157.1');
    const rejected = expect(discovery).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    fake.client.dispose();
  } finally { vi.useRealTimers(); }
});

test('runtime method validation prevents an execution request even if types are bypassed', async () => {
  const fake = setup(handshake);
  try {
    await fake.client.discover('0.157.1');
    const unsafeRequest = Reflect.get(fake.client, 'request');
    expect(typeof unsafeRequest).toBe('function');
    await expect(unsafeRequest.call(fake.client, 'account/read', { refreshToken: true }, 10)).rejects.toThrow();
    await expect(unsafeRequest.call(fake.client, 'turn/start', {}, 10)).rejects.toThrow();
    expect(fake.requests.map(item => item.method)).toEqual(['initialize', 'initialized', 'account/read']);
  } finally { fake.client.dispose(); }
});
