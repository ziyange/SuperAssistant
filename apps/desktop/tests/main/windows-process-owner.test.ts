/* global NodeJS, setTimeout */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
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
    owner.stdin.write('{"type":"stop"}\n');
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
      guardian.stdin.write('{"type":"stop"}\n');
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
    owner.stdin.write('{"type":"stop"}\n');
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
    owner.stdin.write('{"type":"status"}\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'idle' });
    owner.stdin.write('{"type":"stop"}\n');
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
    owner.stdin.write('{"type":"stop"}\n');
    expect(JSON.parse((await lines.next()).value ?? '{}')).toEqual({ type: 'terminated', active: 0 });
    await waitForExit([child]);
  } finally {
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
  }
}, 60000);
