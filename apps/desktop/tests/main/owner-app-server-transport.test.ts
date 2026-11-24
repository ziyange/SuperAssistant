import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';
import { expect, test } from 'vitest';
import { AppServerExecutionClient } from '../../../../packages/codex-adapter/src/app-server-execution-client.js';
import { OwnerAppServerTransport } from '../../src/main/owner-app-server-transport.js';

function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') return false;
    throw error;
  }
}

test.skipIf(process.platform !== 'win32')('runs a fake App Server through the native owner and stops without claiming termination proof', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-appserver-'));
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/owned-execution-wrapper.mjs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const binary = join(root, 'owner.exe');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const closed = once(owner, 'close');
  const transport = new OwnerAppServerTransport(owner);
  let unknown = 0;
  let receiptCount = 0;
  let client: AppServerExecutionClient<OwnerAppServerTransport> | undefined;
  try {
    expect(await transport.start({ executable: process.execPath, cwd: root, args: [fixture, 'normal', root] }, 15000)).toBe('READY_UNTRUSTED');
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    client = new AppServerExecutionClient(transport, '0.121.0', principal, async () => true,
      () => { unknown += 1; return true; }, () => { receiptCount += 1; return true; }, 15000);
    await client.initialize();
    expect(await client.start(root, 'Write the approved change')).toMatchObject({ threadId: 'thread-1', turnId: 'turn-1', cwd: root });
    expect(receiptCount).toBe(1);
    const parentFile = join(root, 'parent.pid'), childFile = join(root, 'child.pid');
    const deadline = Date.now() + 15000;
    while ((!existsSync(parentFile) || !existsSync(childFile)) && Date.now() < deadline) await delay(50);
    expect(existsSync(parentFile) && existsSync(childFile)).toBe(true);
    const pids = [Number(readFileSync(parentFile, 'utf8')), Number(readFileSync(childFile, 'utf8'))];
    expect(pids.every(pid => Number.isSafeInteger(pid) && pid > 0)).toBe(true);
    expect(pids[0]).not.toBe(pids[1]);
    for (const pid of pids) expect(processExists(pid)).toBe(true);
    expect(await client.interrupt()).toBe(true);
    expect(await transport.stop(15000)).toBe('UNVERIFIED_TERMINATION');
    expect(await closed).toEqual([0, null]);
    for (const pid of pids) expect(processExists(pid)).toBe(false);
    expect(client.status()).toBe('UNKNOWN');
    expect(unknown).toBe(1);
  } finally {
    client?.dispose();
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
    await closed;
  }
}, 120000);

test.skipIf(process.platform !== 'win32')('owner stderr failure marks the same running client UNKNOWN', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-stderr-'));
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const fixture = join(process.cwd(), 'packages/codex-adapter/tests/fixtures/execution-app-server.mjs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const binary = join(root, 'owner.exe');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const closed = once(owner, 'close');
  const transport = new OwnerAppServerTransport(owner);
  let unknown = 0;
  let client: AppServerExecutionClient<OwnerAppServerTransport> | undefined;
  try {
    expect(await transport.start({ executable: process.execPath, cwd: root, args: [fixture, 'normal'] }, 15000)).toBe('READY_UNTRUSTED');
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    client = new AppServerExecutionClient(transport, '0.121.0', principal, async () => true,
      () => { unknown += 1; return true; }, () => true, 15000);
    await client.initialize();
    await client.start(root, 'Write the approved change');
    expect(client.status()).toBe('RUNNING');
    owner.stderr.on('error', () => { /* Keep the deliberately injected fixture error local to the test. */ });
    owner.stderr.emit('error', new Error('fixture stderr error'));
    expect(client.status()).toBe('UNKNOWN');
    expect(unknown).toBe(1);
  } finally {
    client?.dispose();
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
    await closed;
  }
}, 120000);

test('ready followed by a malformed frame in one chunk cannot report readiness', async () => {
  const input = new PassThrough(), output = new PassThrough(), error = new PassThrough();
  input.resume();
  const owner = Object.assign(new EventEmitter(), { stdin: input, stdout: output, stderr: error }) as unknown as ChildProcess;
  const transport = new OwnerAppServerTransport(owner);
  try {
    const ready = transport.start({ executable: 'C:/fake.exe', cwd: 'C:/fixture', args: [] }, 1000);
    output.write('{"type":"ready"}\nBAD\n');
    expect(await ready).toBe('UNKNOWN');
    expect(transport.stdin.destroyed).toBe(true);
  } finally { input.destroy(); output.destroy(); error.destroy(); }
});

test('owner output ending while the owner remains alive closes the transport immediately', async () => {
  const input = new PassThrough(), output = new PassThrough(), error = new PassThrough();
  input.resume();
  const owner = Object.assign(new EventEmitter(), { stdin: input, stdout: output, stderr: error }) as unknown as ChildProcess;
  const transport = new OwnerAppServerTransport(owner);
  try {
    const ready = transport.start({ executable: 'C:/fake.exe', cwd: 'C:/fixture', args: [] }, 1000);
    output.write('{"type":"ready"}\n');
    expect(await ready).toBe('READY_UNTRUSTED');
    let closed = false;
    transport.once('exit', () => { closed = true; });
    const ended = once(output, 'end');
    output.end();
    await ended;
    expect(closed).toBe(true);
    expect(transport.stdin.destroyed).toBe(true);
  } finally { input.destroy(); output.destroy(); error.destroy(); }
});

test('fragmented input survives owner backpressure without duplication or loss', async () => {
  const input = new PassThrough({ highWaterMark: 100 }), output = new PassThrough(), error = new PassThrough();
  let wire = '';
  input.on('data', chunk => { wire += chunk.toString(); });
  const owner = Object.assign(new EventEmitter(), { stdin: input, stdout: output, stderr: error }) as unknown as ChildProcess;
  const transport = new OwnerAppServerTransport(owner);
  try {
    const ready = transport.start({ executable: 'C:/fake.exe', cwd: 'C:/fixture', args: [] }, 1000);
    output.write('{"type":"ready"}\n');
    expect(await ready).toBe('READY_UNTRUSTED');
    input.pause();
    const payload = Buffer.alloc(25000, 97);
    const written = new Promise<Error | null | undefined>(resolve => transport.stdin.write(payload, resolve));
    expect(input.writableNeedDrain).toBe(true);
    input.resume();
    expect(await written).toBeFalsy();
    const frames = wire.trim().split('\n').map(line => JSON.parse(line) as { type: string; data?: string }).filter(frame => frame.type === 'input');
    const chunks = frames.map(frame => Buffer.from(frame.data ?? '', 'base64'));
    expect(chunks).toHaveLength(3);
    expect(chunks.every(chunk => chunk.length > 0 && chunk.length <= 12288)).toBe(true);
    expect(Buffer.concat(chunks).equals(payload)).toBe(true);
  } finally { input.destroy(); output.destroy(); error.destroy(); }
});

test('owner input closing unexpectedly closes the transport', async () => {
  const input = new PassThrough(), output = new PassThrough(), error = new PassThrough();
  input.resume();
  const owner = Object.assign(new EventEmitter(), { stdin: input, stdout: output, stderr: error }) as unknown as ChildProcess;
  const transport = new OwnerAppServerTransport(owner);
  try {
    const ready = transport.start({ executable: 'C:/fake.exe', cwd: 'C:/fixture', args: [] }, 1000);
    output.write('{"type":"ready"}\n');
    expect(await ready).toBe('READY_UNTRUSTED');
    let closed = false;
    transport.once('exit', () => { closed = true; });
    const closedInput = once(input, 'close');
    input.destroy();
    await closedInput;
    expect(closed).toBe(true);
  } finally { input.destroy(); output.destroy(); error.destroy(); }
});

test('malformed owner output closes the App Server channel without recording a receipt', async () => {
  const fakeOwner = "let first=true; process.stdin.on('data',()=>{if(first){first=false;process.stdout.write('{\\\"type\\\":\\\"ready\\\"}\\n')}else{process.stdout.write('{\\\"type\\\":\\\"output\\\",\\\"stream\\\":\\\"stdout\\\",\\\"data\\\":\\\"%%%\\\"}\\n')}});";
  const owner = spawn(process.execPath, ['-e', fakeOwner], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const closed = once(owner, 'close');
  const transport = new OwnerAppServerTransport(owner);
  let receipts = 0;
  let client: AppServerExecutionClient<OwnerAppServerTransport> | undefined;
  try {
    expect(await transport.start({ executable: 'C:/fake.exe', cwd: 'C:/fixture', args: [] }, 10000)).toBe('READY_UNTRUSTED');
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    client = new AppServerExecutionClient(transport, '0.121.0', principal, async () => true, () => true,
      () => { receipts += 1; return true; }, 10000);
    await expect(client.initialize()).rejects.toThrow();
    expect(receipts).toBe(0);
    expect(client.status()).toBe('CLOSED');
    expect(await transport.stop(10000)).toBe('UNKNOWN');
  } finally {
    client?.dispose();
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
    await closed;
  }
}, 30000);
