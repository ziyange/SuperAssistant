/* global NodeJS, clearTimeout, setTimeout */
import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { PassThrough, Writable } from 'node:stream';
import process from 'node:process';
import { expect, test } from 'vitest';

async function waitForFiles(paths: string[]): Promise<void> {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (paths.every(path => existsSync(path))) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Owned fixture did not create both process records');
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}

async function waitForExit(pids: number[]): Promise<void> {
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    if (pids.every(pid => !isAlive(pid))) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Owned fixture process tree did not terminate');
}

test.skipIf(process.platform !== 'win32')('the native owner stops its real child and grandchild before reporting termination', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  expect(existsSync(source), 'native owner implementation is required').toBe(true);
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-test-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'parent', root] }) + '\n');
    const ready = await lines.next();
    expect(JSON.parse(ready.value ?? '{}')).toEqual({ type: 'ready' });
    const parentFile = join(root, 'parent.pid'), childFile = join(root, 'child.pid');
    await waitForFiles([parentFile, childFile]);
    const parent = Number(readFileSync(parentFile, 'utf8'));
    const child = Number(readFileSync(childFile, 'utf8'));
    expect(Number.isSafeInteger(parent) && Number.isSafeInteger(child) && parent > 0 && child > 0 && parent !== child).toBe(true);
    expect(isAlive(parent)).toBe(true);
    expect(isAlive(child)).toBe(true);
    owner.stdin.end('{"type":"stop"}\n');
    const stopped = await lines.next();
    expect(JSON.parse(stopped.value ?? '{}')).toEqual({ type: 'terminated', active: 0 });
    expect(isAlive(parent)).toBe(false);
    expect(isAlive(child)).toBe(false);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('closing the owner terminates its Job without touching an unrelated fixture', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-exit-'));
  const unrelatedRoot = mkdtempSync(join(tmpdir(), 'sa-owner-unrelated-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const unrelated = spawn(process.execPath, [fixture, 'child', unrelatedRoot], { windowsHide: true, stdio: 'ignore' });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'parent', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const parentFile = join(root, 'parent.pid'), childFile = join(root, 'child.pid');
    await waitForFiles([parentFile, childFile, join(unrelatedRoot, 'child.pid')]);
    const parent = Number(readFileSync(parentFile, 'utf8'));
    const child = Number(readFileSync(childFile, 'utf8'));
    expect(unrelated.pid).toBeTypeOf('number');
    expect(isAlive(unrelated.pid!)).toBe(true);
    owner.kill();
    await waitForExit([parent, child]);
    expect(isAlive(unrelated.pid!)).toBe(true);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
    if (unrelated.exitCode === null && unrelated.signalCode === null) unrelated.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('rejects a root-relative working directory before creating any child', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-relative-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  expect(root).toMatch(/^[A-Za-z]:\\/);
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root.slice(2), args: [fixture, 'child', root] }) + '\n');
    const response = await lines.next();
    expect(response.done).toBe(true);
    expect(existsSync(join(root, 'child.pid'))).toBe(false);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('owner death at the pre-resume checkpoint cannot strand an unowned suspended child', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-crash-'));
  const binary = join(root, 'owner-test.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  const startup = join(root, 'startup.json'), checkpoint = join(root, 'checkpoint.json');
  writeFileSync(startup, JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }), { flag: 'wx' });
  execFileSync(compiler, ['/nologo', '/define:SA_OWNER_TEST', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const guardian = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: guardian.stdout })[Symbol.asyncIterator]();
  try {
    guardian.stdin.write(JSON.stringify({ type: 'start', executable: binary, cwd: root, args: ['--test-start', startup, checkpoint] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    await waitForFiles([checkpoint]);
    const child = Number(readFileSync(checkpoint, 'utf8'));
    expect(Number.isSafeInteger(child) && child > 0).toBe(true);
    guardian.stdin.write('{"type":"test-stop-root"}\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'root-stopped' });
    await waitForExit([child]);
    expect(existsSync(join(root, 'child.pid'))).toBe(false);
  } finally {
    if (guardian.exitCode === null && guardian.signalCode === null) {
      guardian.stdin.end('{"type":"stop"}\n');
      await lines.next();
    }
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('malformed control closes the owner and kills its owned process without reporting success', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-invalid-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    owner.stdin.write('{"type":"stop","extra":true}\n');
    expect((await lines.next()).done).toBe(true);
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('a failed Job-handle release never reports completed termination', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-closefail-'));
  const binary = join(root, 'owner-test.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/define:SA_OWNER_TEST', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, ['--test-fail-close'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    owner.stdin.end('{"type":"stop"}\n');
    expect((await lines.next()).done).toBe(true);
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('failure to configure atomic Job assignment never starts a child', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-jobfail-'));
  const binary = join(root, 'owner-test.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/define:SA_OWNER_TEST', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, ['--test-fail-job-attribute'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect((await lines.next()).done).toBe(true);
    expect(existsSync(join(root, 'child.pid'))).toBe(false);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('duplicate control keys are rejected without reporting a status or termination', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-duplicate-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    owner.stdin.write('{"type":"stop","type":"status"}\n');
    expect((await lines.next()).done).toBe(true);
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32').each([
  '{"type":"status",type:"stop"}',
  "{'type':'status','type':'stop'}",
  '{"type":"status","\\u0074ype":"stop"}'
])('nonstandard or escaped duplicate control is rejected: %s', async (control) => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-control-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    owner.stdin.write(control + '\n');
    expect((await lines.next()).done).toBe(true);
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('a naturally exited child stays distinct from a closed owner until explicit stop', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-natural-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'finish', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const marker = join(root, 'finish.pid');
    await waitForFiles([marker]);
    await waitForExit([Number(readFileSync(marker, 'utf8'))]);
    let status: { type: string } = { type: 'running' };
    const statusDeadline = Date.now() + 5000;
    while (status.type === 'running' && Date.now() < statusDeadline) {
      owner.stdin.write('{"type":"status"}\n');
      status = JSON.parse((await lines.next()).value ?? '{}') as { type: string };
      if (status.type === 'running') await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(status).toEqual({ type: 'idle' });
    owner.stdin.end('{"type":"stop"}\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'terminated', active: 0 });
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32').each(['oversized', 'abandoned'])('%s control input closes the Job without reporting a terminal result', async (kind) => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-input-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  owner.stdin.on('error', () => { /* The owner may close the control pipe while rejecting excess input. */ });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    if (kind === 'oversized') owner.stdin.write('x'.repeat(65537) + '\n');
    else owner.stdin.end('{"type":');
    expect((await lines.next()).done).toBe(true);
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('does not leak an unrelated inherited environment secret to its child', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-env-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, SA_OWNER_SYNTHETIC_SECRET: 'synthetic-value' } });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid'), observation = join(root, 'child.env');
    await waitForFiles([childFile, observation]);
    const child = Number(readFileSync(childFile, 'utf8'));
    expect(readFileSync(observation, 'utf8')).toBe('absent');
    owner.stdin.end('{"type":"stop"}\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'terminated', active: 0 });
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('forwards fragmented binary input and framed child output without mixing control', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-stdio-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'echo', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    await waitForFiles([join(root, 'echo.pid')]);
    const payload = Buffer.from('data: 雪 ❄\n', 'utf8');
    for (const part of [payload.subarray(0, 8), payload.subarray(8)]) {
      owner.stdin.write(JSON.stringify({ type: 'input', data: part.toString('base64') }) + '\n');
    }
    const received: Buffer[] = [];
    let size = 0;
    while (size < payload.length) {
      const line = await lines.next();
      expect(line.done).toBe(false);
      const frame = JSON.parse(line.value ?? '{}') as { type: string; stream: string; data: string };
      expect(frame.type).toBe('output');
      expect(frame.stream).toBe('stdout');
      const bytes = Buffer.from(frame.data, 'base64');
      received.push(bytes); size += bytes.length;
    }
    expect(Buffer.concat(received)).toEqual(payload);
    owner.stdin.end('{"type":"stop"}\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'terminated', active: 0 });
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('the owned process exchanges discovery frames with the fake App Server', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-appserver-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'packages/codex-adapter/tests/fixtures/fake-app-server-rpc.mjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  let received = '';
  const send = (message: unknown) => owner.stdin.write(JSON.stringify({ type: 'input', data: Buffer.from(JSON.stringify(message) + '\n').toString('base64') }) + '\n');
  const receive = async () => {
    while (!received.includes('\n')) {
      const line = await lines.next();
      expect(line.done).toBe(false);
      const frame = JSON.parse(line.value ?? '{}') as { type: string; stream: string; data: string };
      expect(frame.type).toBe('output'); expect(frame.stream).toBe('stdout');
      received += Buffer.from(frame.data, 'base64').toString('utf8');
    }
    const end = received.indexOf('\n');
    const message = JSON.parse(received.slice(0, end)) as unknown;
    received = received.slice(end + 1);
    return message;
  };
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'success'] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    send({ id: 1, method: 'initialize', params: {} });
    expect(await receive()).toEqual({ id: 1, result: { userAgent: 'fixture' } });
    send({ method: 'initialized' });
    send({ id: 2, method: 'account/read', params: {} });
    expect(await receive()).toEqual({ id: 2, result: { account: { type: 'chatgpt' }, requiresOpenaiAuth: true } });
    owner.stdin.end('{"type":"stop"}\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'terminated', active: 0 });
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('output backpressure cannot prevent a later stop from terminating the owned child', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-backpressure-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  try {
    const ready = new Promise<string>(resolve => owner.stdout.once('data', chunk => { owner.stdout.pause(); resolve(String(chunk)); }));
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'flood', root] }) + '\n');
    expect(JSON.parse((await ready).trim())).toEqual({ type: 'ready' });
    const childFile = join(root, 'flood.pid'), blockedFile = join(root, 'flood.blocked');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    owner.stdin.write(JSON.stringify({ type: 'input', data: Buffer.from('go').toString('base64') }) + '\n');
    await waitForFiles([blockedFile]);
    const deadline = Date.now() + 15000;
    while (owner.stdout.readableLength < owner.stdout.readableHighWaterMark && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(owner.stdout.readableLength).toBeGreaterThanOrEqual(owner.stdout.readableHighWaterMark);
    owner.stdin.end('{"type":"status"}\n{"type":"stop"}\n');
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('input after the owner reports an idle Job fails closed without another request', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-input-failure-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'finish', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'finish.pid');
    await waitForFiles([childFile]);
    await waitForExit([Number(readFileSync(childFile, 'utf8'))]);
    let status: { type: string } = { type: 'running' };
    const statusDeadline = Date.now() + 5000;
    while (status.type === 'running' && Date.now() < statusDeadline) {
      owner.stdin.write('{"type":"status"}\n');
      status = JSON.parse((await lines.next()).value ?? '{}') as { type: string };
      if (status.type === 'running') await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(status).toEqual({ type: 'idle' });
    const closed = new Promise<boolean>(resolve => {
      owner.once('close', () => resolve(true));
      timer = setTimeout(() => resolve(false), 5000);
    });
    owner.stdin.write(JSON.stringify({ type: 'input', data: Buffer.from('late').toString('base64') }) + '\n');
    const completed = await closed;
    expect(completed, `owner exit=${String(owner.exitCode)} stdoutEnded=${String(owner.stdout.readableEnded)} stderrEnded=${String(owner.stderr.readableEnded)}`).toBe(true);
  } finally {
    if (timer) clearTimeout(timer);
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('an injected input write failure wakes the owner and terminates its child', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-write-failure-'));
  const binary = join(root, 'owner-test.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/define:SA_OWNER_TEST', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, ['--test-fail-input'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    const closed = new Promise<boolean>(resolve => {
      owner.once('close', () => resolve(true));
      timer = setTimeout(() => resolve(false), 5000);
    });
    owner.stdin.write(JSON.stringify({ type: 'input', data: Buffer.from('synthetic').toString('base64') }) + '\n');
    expect(await closed).toBe(true);
    await waitForExit([child]);
  } finally {
    if (timer) clearTimeout(timer);
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('a control-reader failure racing stop cannot report successful termination', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-stop-race-'));
  const binary = join(root, 'owner-test.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  const stopped = join(root, 'stop-checkpoint'), fault = join(root, 'control-fault'), release = join(root, 'release');
  execFileSync(compiler, ['/nologo', '/define:SA_OWNER_TEST', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, ['--test-control-race', stopped, fault, release], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  owner.stdin.on('error', () => { /* The malformed input can close the control pipe. */ });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    owner.stdin.write('{"type":"stop"}\n');
    await waitForFiles([stopped]);
    owner.stdin.write('x'.repeat(65537) + '\n');
    await waitForFiles([fault]);
    writeFileSync(release, 'release', { flag: 'wx' });
    expect((await lines.next()).done).toBe(true);
    await waitForExit([child]);
  } finally {
    if (!existsSync(release)) writeFileSync(release, 'release', { flag: 'wx' });
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.skipIf(process.platform !== 'win32')('stop without control EOF kills its child but does not report completed termination', async () => {
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-stop-open-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'apps/desktop/tests/native/process-owner-fixture.cjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: owner.stdout })[Symbol.asyncIterator]();
  try {
    owner.stdin.write(JSON.stringify({ type: 'start', executable: process.execPath, cwd: root, args: [fixture, 'child', root] }) + '\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'ready' });
    const childFile = join(root, 'child.pid');
    await waitForFiles([childFile]);
    const child = Number(readFileSync(childFile, 'utf8'));
    owner.stdin.write('{"type":"stop"}\n');
    await waitForExit([child]);
    expect((await lines.next()).done).toBe(true);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test('untrusted protocol rejects a terminal frame arriving after its stop deadline', async () => {
  const source = join(process.cwd(), 'apps/desktop/src/main/windows-process-owner.ts');
  expect(existsSync(source), 'deadline-aware protocol client is required').toBe(true);
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  const input = new PassThrough(), output = new PassThrough();
  input.resume();
  const session = new UntrustedOwnerProtocol(input, output, () => undefined);
  const ready = session.start({ executable: 'C:/fixture.exe', cwd: 'C:/fixture', args: [] }, 1000);
  output.write('{"type":"ready"}\n');
  expect(await ready).toBe('READY_UNTRUSTED');
  const stop = session.stop(30);
  expect(await stop).toBe('UNKNOWN');
  output.write('{"type":"terminated","active":0}\n');
  expect(session.state).toBe('UNKNOWN');
  input.destroy(); output.destroy();
});

test('untrusted protocol checks the monotonic deadline even before a delayed timer fires', async () => {
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  const input = new PassThrough(), output = new PassThrough(); input.resume();
  const session = new UntrustedOwnerProtocol(input, output, () => undefined);
  const ready = session.start({ executable: 'C:/fixture.exe', cwd: 'C:/fixture', args: [] }, 1000);
  output.write('{"type":"ready"}\n');
  expect(await ready).toBe('READY_UNTRUSTED');
  const stop = session.stop(20);
  const until = performance.now() + 30;
  while (performance.now() < until) { /* Simulate a stalled event loop. */ }
  output.write('{"type":"terminated","active":0}\n');
  expect(await stop).toBe('UNKNOWN');
  expect(session.state).toBe('UNKNOWN');
  output.destroy();
});

test('untrusted protocol parses fragmented output but never certifies termination', async () => {
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  const input = new PassThrough(), output = new PassThrough();
  const received: string[] = [];
  input.resume();
  const session = new UntrustedOwnerProtocol(input, output, (stream, bytes) => received.push(`${stream}:${bytes.toString()}`));
  const ready = session.start({ executable: 'C:/fixture.exe', cwd: 'C:/fixture', args: [] }, 1000);
  output.write('{"type":"rea'); output.write('dy"}\r\n');
  expect(await ready).toBe('READY_UNTRUSTED');
  output.write('{"type":"output","stream":"stdout","data":"aGk="}\r\n');
  expect(received).toEqual(['stdout:hi']);
  const stop = session.stop(1000);
  if (!input.writableFinished) await new Promise<void>(resolve => input.once('finish', resolve));
  output.write('{"type":"terminated","active":0}\n');
  expect(await stop).toBe('UNVERIFIED_TERMINATION');
  expect(session.state).toBe('TERMINATED_UNVERIFIED');
  input.destroy(); output.destroy();
});

test('untrusted protocol becomes UNKNOWN if its output closes unexpectedly', async () => {
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  const input = new PassThrough(), output = new PassThrough(); input.resume();
  const session = new UntrustedOwnerProtocol(input, output, () => undefined);
  const ready = session.start({ executable: 'C:/fixture.exe', cwd: 'C:/fixture', args: [] }, 1000);
  output.write('{"type":"ready"}\n');
  expect(await ready).toBe('READY_UNTRUSTED');
  output.destroy();
  await new Promise<void>((resolve) => output.once('close', resolve));
  expect(session.state).toBe('UNKNOWN');
  expect(session.sendInput(Buffer.from('x')).accepted).toBe(false);
  expect(Reflect.set(session, 'state', 'READY')).toBe(false);
  expect(await session.stop(50)).toBe('UNKNOWN');
});

test('untrusted protocol becomes UNKNOWN if its input closes unexpectedly', async () => {
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  const input = new PassThrough(), output = new PassThrough(); input.resume();
  const session = new UntrustedOwnerProtocol(input, output, () => undefined);
  const ready = session.start({ executable: 'C:/fixture.exe', cwd: 'C:/fixture', args: [] }, 1000);
  output.write('{"type":"ready"}\n');
  expect(await ready).toBe('READY_UNTRUSTED');
  input.destroy();
  await new Promise<void>((resolve) => input.once('close', resolve));
  expect(session.state).toBe('UNKNOWN');
  expect(await session.stop(50)).toBe('UNKNOWN');
  output.destroy();
});

test('untrusted protocol rejects termination before STOP has finished writing', async () => {
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  let writes = 0;
  const input = new Writable({ write(_chunk, _encoding, callback) { if (++writes === 1) callback(); } });
  const output = new PassThrough();
  const session = new UntrustedOwnerProtocol(input, output, () => undefined);
  const ready = session.start({ executable: 'C:/fixture.exe', cwd: 'C:/fixture', args: [] }, 1000);
  output.write('{"type":"ready"}\n');
  expect(await ready).toBe('READY_UNTRUSTED');
  const stop = session.stop(1000);
  output.write('{"type":"terminated","active":0}\n');
  expect(await stop).toBe('UNKNOWN');
  expect(session.state).toBe('UNKNOWN');
  input.destroy(); output.destroy();
});

test.skipIf(process.platform !== 'win32')('untrusted protocol exchanges fake App Server frames with a real owner', async () => {
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  const source = join(process.cwd(), 'apps/desktop/native/ProcessOwner.cs');
  const compiler = join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const root = mkdtempSync(join(tmpdir(), 'sa-owner-client-'));
  const binary = join(root, 'owner.exe');
  const fixture = join(process.cwd(), 'packages/codex-adapter/tests/fixtures/fake-app-server-rpc.mjs');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + binary, source],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const owner = spawn(binary, [], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  // eslint-disable-next-line no-unused-vars -- the callback parameter documents the delivered frame.
  let resolveFrame: ((value: string) => void) | undefined;
  let received = '';
  const session = new UntrustedOwnerProtocol(owner.stdin, owner.stdout, (stream, bytes) => {
    if (stream !== 'stdout') return;
    received += bytes.toString('utf8');
    if (received.includes('\n')) resolveFrame?.(received);
  });
  try {
    expect(await session.start({ executable: process.execPath, cwd: root, args: [fixture, 'success'] }, 10000)).toBe('READY_UNTRUSTED');
    const response = new Promise<string>(resolve => { resolveFrame = resolve; });
    expect(session.sendInput(Buffer.from(JSON.stringify({ id: 1, method: 'initialize', params: {} }) + '\n')).accepted).toBe(true);
    const result = await Promise.race([response, new Promise<string>((_, reject) => setTimeout(() => reject(new Error('response timed out')), 5000))]);
    expect(JSON.parse(result)).toEqual({ id: 1, result: { userAgent: 'fixture' } });
    expect(await session.stop(10000)).toBe('UNVERIFIED_TERMINATION');
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);

test.each([
  '{"type":"ready","type":"ready"}',
  '{"type":"ready", "extra":true}',
  '{"type":"terminated","active":0}',
])('untrusted protocol fails closed on malformed or out-of-order frame %s', async (frame) => {
  const { UntrustedOwnerProtocol } = await import('../../src/main/windows-process-owner.js');
  const input = new PassThrough(), output = new PassThrough(); input.resume();
  const session = new UntrustedOwnerProtocol(input, output, () => undefined);
  const ready = session.start({ executable: 'C:/fixture.exe', cwd: 'C:/fixture', args: [] }, 1000);
  output.write(`${frame}\n`);
  expect(await ready).toBe('UNKNOWN');
  expect(session.state).toBe('UNKNOWN');
  output.write('{"type":"ready"}\n');
  expect(session.state).toBe('UNKNOWN');
  output.destroy();
});
