import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, promises, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { afterEach, expect, test, vi } from 'vitest';

const { captureFixtureDirectory } = createRequire(import.meta.url)('../native/package-fixture-cleanup.cjs') as {
  // eslint-disable-next-line no-unused-vars -- Parameter name documents a typed CJS test port.
  captureFixtureDirectory(directory: string): () => Promise<void>;
};
const folders: string[] = [];
function folder(prefix = 'sa-package-clone-'): string {
  const result = mkdtempSync(join(realpathSync.native(tmpdir()), prefix));
  folders.push(result);
  return result;
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true });
});

async function bounded<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Owned file-lock fixture timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function lockFile(path: string): Promise<() => Promise<void>> {
  const script = "$handle = [System.IO.File]::Open($env:SA_LOCK_PATH, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite); try { [Console]::Out.WriteLine('LOCKED'); [Console]::In.ReadLine() | Out-Null } finally { $handle.Dispose() }";
  const executable = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const child = spawn(executable, ['-NoProfile', '-Command', script], {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { SystemRoot: process.env.SystemRoot ?? 'C:/Windows', SA_LOCK_PATH: path }
  });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  child.on('error', () => {});
  const stop = async () => {
    child.stdin.end('\n');
    try { await bounded(closed, 2000); }
    catch { child.kill(); await bounded(closed, 2000); }
  };
  try {
    await bounded(new Promise<void>((resolve, reject) => {
      let output = '';
      child.stdout.on('data', chunk => { output += String(chunk); if (output.includes('LOCKED')) resolve(); });
      child.stderr.on('data', chunk => reject(new Error('File-lock fixture: ' + String(chunk))));
      child.once('error', reject);
      void closed.then(() => reject(new Error('File-lock fixture exited before readiness')));
    }), 3500);
    return stop;
  } catch (error) { await stop(); throw error; }
}

test.skipIf(process.platform !== 'win32')('cleans an owned fixture after a real Windows delete-sharing lock is released', async () => {
  const directory = folder();
  const file = join(directory, 'fixture.exe');
  writeFileSync(file, 'owned fixture');
  const cleanup = captureFixtureDirectory(directory);
  const release = await lockFile(file);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let released: Promise<void> | undefined;
  try {
    timer = setTimeout(() => { released = release(); }, 200);
    await cleanup();
    expect(existsSync(directory)).toBe(false);
  } finally { clearTimeout(timer); await (released ?? release()); }
});

test.skipIf(process.platform !== 'win32')('fails bounded cleanup for a persistent Windows lock without pretending the directory was removed', async () => {
  const directory = folder();
  const file = join(directory, 'fixture.exe');
  writeFileSync(file, 'retained evidence');
  const cleanup = captureFixtureDirectory(directory);
  const release = await lockFile(file);
  try {
    const started = performance.now();
    await expect(cleanup()).rejects.toMatchObject({ code: 'EBUSY' });
    expect(performance.now() - started).toBeLessThan(6500);
    expect(readFileSync(file, 'utf8')).toBe('retained evidence');
  } finally { await release(); }
}, 10000);

test('captures the exact fixture directory and removes its contents', async () => {
  const directory = folder('sa-package-profile-');
  writeFileSync(join(directory, 'owned.txt'), 'owned');
  await captureFixtureDirectory(directory)();
  expect(existsSync(directory)).toBe(false);
});

test('refuses a different prefix before touching an existing file', () => {
  const directory = folder('sa-package-guard-');
  writeFileSync(join(directory, 'keep.txt'), 'keep');
  expect(() => captureFixtureDirectory(directory)).toThrow('UNSAFE_FIXTURE_DIRECTORY');
  expect(readFileSync(join(directory, 'keep.txt'), 'utf8')).toBe('keep');
});

test('refuses a replaced directory and preserves both the old and replacement contents', async () => {
  const directory = folder();
  writeFileSync(join(directory, 'keep.txt'), 'original');
  const cleanup = captureFixtureDirectory(directory);
  const retained = directory + '-retained';
  renameSync(directory, retained);
  folders.push(retained);
  mkdirSync(directory);
  writeFileSync(join(directory, 'keep.txt'), 'replacement');
  await expect(cleanup()).rejects.toThrow('FIXTURE_DIRECTORY_CHANGED');
  expect(readFileSync(join(directory, 'keep.txt'), 'utf8')).toBe('replacement');
  expect(readFileSync(join(retained, 'keep.txt'), 'utf8')).toBe('original');
});

test('rejects a linked fixture without following or removing its target', () => {
  const directory = folder();
  const target = folder('sa-package-guard-');
  writeFileSync(join(target, 'keep.txt'), 'keep');
  rmSync(directory, { recursive: true });
  symlinkSync(target, directory, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    expect(() => captureFixtureDirectory(directory)).toThrow('UNSAFE_FIXTURE_DIRECTORY');
    expect(readFileSync(join(target, 'keep.txt'), 'utf8')).toBe('keep');
  } finally { unlinkSync(directory); }
});

test('does not accept another target through a captured cleanup function', async () => {
  const directory = folder();
  const other = folder();
  writeFileSync(join(directory, 'keep.txt'), 'original');
  writeFileSync(join(other, 'keep.txt'), 'other');
  const cleanup = captureFixtureDirectory(directory);
  await expect(Reflect.apply(cleanup, undefined, [other])).rejects.toThrow('UNSAFE_FIXTURE_DIRECTORY');
  expect(readFileSync(join(directory, 'keep.txt'), 'utf8')).toBe('original');
  expect(readFileSync(join(other, 'keep.txt'), 'utf8')).toBe('other');
});

test('does not retry an unknown I/O error and preserves the original file', async () => {
  const directory = folder();
  writeFileSync(join(directory, 'keep.txt'), 'evidence');
  const cleanup = captureFixtureDirectory(directory);
  const failure = Object.assign(new Error('Injected disk failure'), { code: 'EIO' });
  vi.spyOn(promises, 'rm').mockRejectedValueOnce(failure);
  await expect(cleanup()).rejects.toBe(failure);
  expect(readFileSync(join(directory, 'keep.txt'), 'utf8')).toBe('evidence');
});

test('rechecks directory ownership before retrying a transient failure', async () => {
  const directory = folder();
  writeFileSync(join(directory, 'keep.txt'), 'original');
  const cleanup = captureFixtureDirectory(directory);
  const retained = directory + '-retained';
  folders.push(retained);
  vi.spyOn(promises, 'rm').mockImplementationOnce(async () => {
    renameSync(directory, retained);
    mkdirSync(directory);
    writeFileSync(join(directory, 'keep.txt'), 'replacement');
    throw Object.assign(new Error('Injected transient lock'), { code: 'EBUSY' });
  });
  await expect(cleanup()).rejects.toThrow('FIXTURE_DIRECTORY_CHANGED');
  expect(readFileSync(join(directory, 'keep.txt'), 'utf8')).toBe('replacement');
  expect(readFileSync(join(retained, 'keep.txt'), 'utf8')).toBe('original');
});

test('removes an internal link without traversing its target', async () => {
  const directory = folder();
  const target = folder('sa-package-guard-');
  writeFileSync(join(target, 'keep.txt'), 'outside fixture');
  symlinkSync(target, join(directory, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await captureFixtureDirectory(directory)();
  expect(existsSync(directory)).toBe(false);
  expect(readFileSync(join(target, 'keep.txt'), 'utf8')).toBe('outside fixture');
});

test('concurrent and repeated cleanup cannot delete a later owner at the same path', async () => {
  const directory = folder();
  writeFileSync(join(directory, 'keep.txt'), 'first owner');
  const cleanup = captureFixtureDirectory(directory);
  await Promise.all([cleanup(), cleanup()]);
  mkdirSync(directory);
  writeFileSync(join(directory, 'keep.txt'), 'later owner');
  await cleanup();
  expect(readFileSync(join(directory, 'keep.txt'), 'utf8')).toBe('later owner');
});
