/* global Buffer, queueMicrotask */
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { expect, test } from 'vitest';
import * as adapter from '../src/index.js';

// eslint-disable-next-line no-unused-vars -- names document the type-only callback.
function fakeChild(onRequest: (request: Record<string, unknown>, stdout: PassThrough) => void) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const child = Object.assign(new EventEmitter(), { stdin, stdout });
  const requests: Record<string, unknown>[] = [];
  stdin.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split('\n').filter(Boolean)) {
      const request = JSON.parse(line) as Record<string, unknown>;
      requests.push(request);
      queueMicrotask(() => onRequest(request, stdout));
    }
  });
  return { child: child as unknown as ChildProcess, requests };
}

function discovery() {
  const operation = Reflect.get(adapter, 'discoverAppServer');
  expect(typeof operation).toBe('function');
  return operation;
}

test('initializes and reads account status across fragmented frames without exposing private fields', async () => {
  const fake = fakeChild((request, stdout) => {
    if (request.method === 'initialize') {
      const reply = JSON.stringify({ id: request.id, result: { userAgent: 'codex/0.157.1', codexHome: 'private-home', platformFamily: 'windows', platformOs: 'windows' } }) + '\n';
      stdout.write(reply.slice(0, 11));
      stdout.write(reply.slice(11));
    }
    if (request.method === 'account/read') {
      stdout.write(JSON.stringify({ method: 'notice', params: {} }) + '\n' + JSON.stringify({ id: request.id, result: { account: { type: 'chatgpt', email: 'private@example.invalid' }, requiresOpenaiAuth: true } }) + '\n');
    }
  });
  const result = await discovery()(fake.child, '0.157.1', 1000);
  expect(result).toEqual({ version: '0.157.1', authenticated: true, capabilities: [] });
  expect(JSON.stringify(result)).not.toMatch(/private-home|private@example/);
  expect(fake.requests.map(item => item.method)).toEqual(['initialize', 'initialized', 'account/read']);
  expect(fake.requests[2]).toMatchObject({ params: { refreshToken: false } });
});

test('fails closed on malformed or oversized upstream frames', async () => {
  const malformed = fakeChild((request, stdout) => { if (request.method === 'initialize') stdout.write('{broken}\n'); });
  await expect(discovery()(malformed.child, '0.157.1', 1000)).rejects.toThrow();
  const oversized = fakeChild((request, stdout) => { if (request.method === 'initialize') stdout.write('x'.repeat(1_048_577)); });
  await expect(discovery()(oversized.child, '0.157.1', 1000)).rejects.toThrow();
});

test('fails closed on upstream error and bounded timeout', async () => {
  const failed = fakeChild((request, stdout) => { if (request.method === 'initialize') stdout.write(JSON.stringify({ id: request.id, error: { code: -1, message: 'private' } }) + '\n'); });
  await expect(discovery()(failed.child, '0.157.1', 1000)).rejects.toThrow();
  const silent = fakeChild(() => undefined);
  await expect(discovery()(silent.child, '0.157.1', 20)).rejects.toThrow();
});

test('rejects a mismatched response ID and never returns an upstream error message', async () => {
  const wrong = fakeChild((request, stdout) => { if (request.method === 'initialize') stdout.write(JSON.stringify({ id: 99, result: { userAgent: 'codex' } }) + '\n'); });
  await expect(discovery()(wrong.child, '0.157.1', 1000)).rejects.toThrow('Codex discovery failed.');
  const failed = fakeChild((request, stdout) => { if (request.method === 'initialize') stdout.write(JSON.stringify({ id: request.id, error: { code: -1, message: 'private-token' } }) + '\n'); });
  await expect(discovery()(failed.child, '0.157.1', 1000)).rejects.toThrow(/^Codex discovery failed\.$/);
});

test('treats a missing account as unauthenticated without inventing capabilities', async () => {
  const fake = fakeChild((request, stdout) => {
    if (request.method === 'initialize') stdout.write(JSON.stringify({ id: request.id, result: { userAgent: 'codex' } }) + '\n');
    if (request.method === 'account/read') stdout.write(JSON.stringify({ id: request.id, result: { account: null, requiresOpenaiAuth: true } }) + '\n');
  });
  await expect(discovery()(fake.child, '0.157.1', 1000)).resolves.toEqual({ version: '0.157.1', authenticated: false, capabilities: [] });
});
