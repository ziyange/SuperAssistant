/* global URL, process, Buffer, setTimeout, clearTimeout */
import { expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CodexExecutionAdapter } from '../src/execution.js';

const fakeAppServer = fileURLToPath(new URL('./fixtures/fake-app-server.mjs', import.meta.url));
const FIXTURE_RESPONSE_TIMEOUT_MS = 5_000;

async function executeFake(mode: string, operation: string): Promise<Record<string, unknown>> {
  const child = spawn(process.execPath, [fakeAppServer], { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, FAKE_APP_SERVER_MODE: mode } });
  return await new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => settle(() => {
      child.kill();
      reject(new Error('fake App Server response timed out.'));
    }), FIXTURE_RESPONSE_TIMEOUT_MS);
    let lines = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      lines += chunk.toString('utf8');
      const responses = lines.trim().split(/\r?\n/);
      if (responses.length >= 2) settle(() => { child.kill(); resolve(JSON.parse(responses[1] ?? '{}') as Record<string, unknown>); });
    });
    child.once('error', () => settle(() => reject(new Error('fake App Server failed.'))));
    child.once('exit', (code) => settle(() => reject(new Error(`fake App Server exited: ${String(code)}`))));
    child.stdin?.write(`${JSON.stringify({ operation })}\n`);
  });
}

test('maps a duplicate SAI start to one stable upstream execution receipt', async () => {
  let calls = 0;
  const adapter = new CodexExecutionAdapter({ request: async (operation, payload) => { calls += 1; return { operation, payload, execution: 'private-upstream-id' }; } });
  const command = { attemptId: 'attempt-1', requestId: 'request-1', idempotencyKey: 'key-1', proposalDigest: 'sha256:abc', authorizationGrantId: 'grant-1', projectSnapshotVersion: 'snapshot-1', resourceFences: [{ key: 'worktree:project-1', token: 1 }] };
  expect(await adapter.start(command)).toEqual({ attemptId: 'attempt-1', accepted: true });
  expect(await adapter.start(command)).toEqual({ attemptId: 'attempt-1', accepted: true });
  expect(calls).toBe(1);
});

test('fails closed after a lost start response instead of sending a second upstream start', async () => {
  let calls = 0;
  const adapter = new CodexExecutionAdapter({ request: async () => { calls += 1; throw new Error('socket closed after write'); } });
  const command = { attemptId: 'attempt-1', requestId: 'request-1', idempotencyKey: 'key-1', proposalDigest: 'sha256:abc', authorizationGrantId: 'grant-1', projectSnapshotVersion: 'snapshot-1', resourceFences: [{ key: 'worktree:project-1', token: 1 }] };
  await expect(adapter.start(command)).rejects.toThrow('START_OUTCOME_UNKNOWN');
  await expect(adapter.start(command)).rejects.toThrow('START_OUTCOME_UNKNOWN');
  expect(calls).toBe(1);
});

test('binds a start key to immutable authority before and after the upstream response', async () => {
  let release!: () => void; let calls = 0;
  const adapter = new CodexExecutionAdapter({ request: async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); return {}; } });
  const command = { attemptId: 'attempt-1', requestId: 'request-1', idempotencyKey: 'key-1', proposalDigest: 'sha256:abc', authorizationGrantId: 'grant-1', projectSnapshotVersion: 'snapshot-1', resourceFences: [{ key: 'project:one', token: 1 }] };
  const initial = adapter.start(command);
  for (const change of [{ attemptId: 'another' }, { proposalDigest: 'sha256:other' }, { authorizationGrantId: 'another' }, { projectSnapshotVersion: 'another' }, { resourceFences: [{ key: 'project:one', token: 2 }] }]) {
    await expect(adapter.start({ ...command, ...change })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  }
  const duplicate = adapter.start({ ...command, requestId: 'request-2' });
  release();
  expect(await initial).toEqual({ attemptId: 'attempt-1', accepted: true });
  expect(await duplicate).toEqual({ attemptId: 'attempt-1', accepted: true });
  await expect(adapter.start({ ...command, attemptId: 'another' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  expect(calls).toBe(1);
});

test('snapshots nested start authority before a caller mutates it', async () => {
  let observed: unknown;
  const adapter = new CodexExecutionAdapter({ request: async (_op, payload) => { await Promise.resolve(); observed = payload.resource_fences; return {}; } });
  const command = { attemptId: 'a', requestId: 'r', idempotencyKey: 'k', proposalDigest: 'd', authorizationGrantId: 'g', projectSnapshotVersion: 's', resourceFences: [{ key: 'project:one', token: 1 }] };
  const pending = adapter.start(command);
  command.resourceFences[0]!.token = 2;
  await pending;
  expect(observed).toEqual([{ key: 'project:one', token: 1 }]);
  await expect(adapter.start(command)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
});

test('a caller cannot mutate the receipt returned by a subsequent retry', async () => {
  const adapter = new CodexExecutionAdapter({ request: async () => ({}) });
  const command = { attemptId: 'a', requestId: 'r', idempotencyKey: 'k', proposalDigest: 'd', authorizationGrantId: 'g', projectSnapshotVersion: 's', resourceFences: [{ key: 'project:one', token: 1 }] };
  const receipt = await adapter.start(command);
  try { receipt.attemptId = 'different'; } catch { /* Frozen receipts are also acceptable. */ }
  expect(await adapter.start(command)).toEqual({ attemptId: 'a', accepted: true });
});

test('preserves the original binding after an uncertain start', async () => {
  let calls = 0;
  const adapter = new CodexExecutionAdapter({ request: async () => { calls++; throw new Error('lost'); } });
  const command = { attemptId: 'a', requestId: 'r', idempotencyKey: 'k', proposalDigest: 'd', authorizationGrantId: 'g', projectSnapshotVersion: 's', resourceFences: [{ key: 'project:one', token: 1 }] };
  await expect(adapter.start(command)).rejects.toThrow('START_OUTCOME_UNKNOWN');
  await expect(adapter.start({ ...command, attemptId: 'b' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  await expect(adapter.start({ ...command, requestId: 'r2' })).rejects.toThrow('START_OUTCOME_UNKNOWN');
  expect(calls).toBe(1);
});

test('coalesces concurrent resume input and refuses changed or uncertain retries', async () => {
  let release!: () => void; let calls = 0;
  const adapter = new CodexExecutionAdapter({ request: async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); return {}; } });
  const input = { attemptId: 'a', inputId: 'input', payloadDigest: 'digest' };
  const first = adapter.resume(input);
  const duplicate = adapter.resume(input);
  await expect(adapter.resume({ ...input, payloadDigest: 'different' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  release(); await Promise.all([first, duplicate]);
  expect(calls).toBe(1);
  let failedCalls = 0;
  const failed = new CodexExecutionAdapter({ request: async () => { failedCalls++; throw new Error('lost'); } });
  await expect(failed.resume(input)).rejects.toThrow('RESUME_OUTCOME_UNKNOWN');
  await expect(failed.resume(input)).rejects.toThrow('RESUME_OUTCOME_UNKNOWN');
  await expect(failed.resume({ ...input, payloadDigest: 'different' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  expect(failedCalls).toBe(1);
});

test('normalizes status, events and result without leaking upstream identifiers', async () => {
  const adapter = new CodexExecutionAdapter({ request: async (operation) => operation === 'turn/status' ? { state: 'RUNNING', thread_id: 'private' } : operation === 'turn/events' ? { events: [{ sequence: 1, type: 'ACTIVITY_RECORDED', turn_id: 'private' }] } : { state: 'SUCCEEDED', turn_id: 'private' } });
  expect(await adapter.status('attempt-1')).toEqual({ attemptId: 'attempt-1', state: 'RUNNING' });
  expect(await adapter.events('attempt-1', 0)).toEqual([{ sequence: 1, type: 'ACTIVITY_RECORDED' }]);
  expect(await adapter.result('attempt-1')).toEqual({ attemptId: 'attempt-1', state: 'SUCCEEDED' });
});

test('acknowledges a repeated resume input once and rejects altered reuse', async () => {
  let calls = 0; const adapter = new CodexExecutionAdapter({ request: async () => { calls += 1; return {}; } });
  await adapter.resume({ attemptId: 'attempt-1', inputId: 'input-1', payloadDigest: 'sha256:aaa' });
  await adapter.resume({ attemptId: 'attempt-1', inputId: 'input-1', payloadDigest: 'sha256:aaa' });
  await expect(adapter.resume({ attemptId: 'attempt-1', inputId: 'input-1', payloadDigest: 'sha256:bbb' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  expect(calls).toBe(1);
});

test('orders and deduplicates adapter events before exposing them to the control plane', async () => {
  const adapter = new CodexExecutionAdapter({ request: async () => ({ events: [{ sequence: 3, type: 'EXECUTION_SUCCEEDED' }, { sequence: 1, type: 'EXECUTION_STARTED' }, { sequence: 1, type: 'EXECUTION_STARTED' }] }) });
  expect(await adapter.events('attempt-1', 0)).toEqual([{ sequence: 1, type: 'EXECUTION_STARTED' }, { sequence: 3, type: 'EXECUTION_SUCCEEDED' }]);
});

test('exercises fake App Server success, failure, disconnect, and crash lifecycle frames', async () => {
  await expect(executeFake('execution_success', 'turn/start')).resolves.toMatchObject({ state: 'RUNNING' });
  await expect(executeFake('execution_failure', 'turn/result')).resolves.toMatchObject({ state: 'FAILED' });
  await expect(executeFake('execution_disconnect', 'turn/status')).resolves.toMatchObject({ state: 'INDETERMINATE' });
  await expect(executeFake('execution_crash', 'turn/status')).rejects.toThrow(/exited/i);
}, 20_000);
