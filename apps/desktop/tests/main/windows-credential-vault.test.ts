import { Buffer } from 'node:buffer';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { join } from 'node:path';
import process from 'node:process';
import { expect, test } from 'vitest';
import { WindowsCredentialVault, WinCredProcessTransport, hashWinCredFile, launchAfterWinCredPreflight, runWinCredChild, type WinCredTransport } from '../../src/main/windows-credential-vault.js';

const ref = 'pkey-' + 'a'.repeat(64);
class FixtureTransport implements WinCredTransport {
  calls = 0;
  status = 0;
  output: Buffer = Buffer.alloc(32, 42);
  failure: Error | null = null;
  async execute(): Promise<{ status: number; output: Buffer }> {
    this.calls++;
    if (this.failure) throw this.failure;
    return { status: this.status, output: this.output };
  }
}
test('rejects malformed references before invoking the native helper', async () => {
  const transport = new FixtureTransport(); const vault = new WindowsCredentialVault(transport);
  for (const invalid of ['', '../x', 'pkey-' + 'A'.repeat(64), 'pkey-' + 'a'.repeat(63)]) {
    await expect(vault.create(invalid)).rejects.toThrow();
    await expect(vault.read(invalid)).rejects.toThrow();
  }
  expect(transport.calls).toBe(0);
});
test('returns an owned 32-byte key and clears the transport output', async () => {
  const transport = new FixtureTransport(); const vault = new WindowsCredentialVault(transport);
  const key = await vault.create(ref);
  expect(key).toEqual(Buffer.alloc(32, 42));
  expect(transport.output).toEqual(Buffer.alloc(32));
});
test('only releases buffers created by this vault and makes release idempotent', async () => {
  const transport = new FixtureTransport(); const vault = new WindowsCredentialVault(transport);
  const key = await vault.create(ref); const foreign = Buffer.alloc(32, 17);
  vault.release(foreign);
  expect(foreign).toEqual(Buffer.alloc(32, 17));
  vault.release(key);
  expect(key).toEqual(Buffer.alloc(32));
  vault.release(key);
  expect(key).toEqual(Buffer.alloc(32));
});
test('distinguishes a missing read from duplicate creation', async () => {
  const transport = new FixtureTransport(); const vault = new WindowsCredentialVault(transport);
  transport.status = 2; transport.output = Buffer.alloc(0);
  expect(await vault.read(ref)).toBeNull();
  await expect(vault.create(ref)).rejects.toThrow();
  transport.status = 3;
  await expect(vault.create(ref)).rejects.toThrow();
});
test('rejects short or oversized key output and does not leak transport errors', async () => {
  const transport = new FixtureTransport(); const vault = new WindowsCredentialVault(transport);
  transport.output = Buffer.alloc(33, 71);
  await expect(vault.read(ref)).rejects.toThrow();
  expect(transport.output).toEqual(Buffer.alloc(33));
  transport.failure = new Error('sensitive fixture detail');
  await expect(vault.create(ref)).rejects.not.toThrow('sensitive fixture detail');
});
test('drains and zeroes late pipe data after an output error without exposing it', async () => {
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; kill: () => boolean };
  child.stdout = new PassThrough(); child.kill = () => true;
  const result = runWinCredChild('fixture.exe', 'create', ref, () => child);
  const rejected = expect(result).rejects.toThrow();
  child.stdout.emit('error', new Error('sensitive pipe failure'));
  const late = Buffer.alloc(32, 88);
  child.stdout.emit('data', late);
  child.emit('close', 0);
  await rejected;
  expect(late).toEqual(Buffer.alloc(32));
});
test('times out, requests termination and waits for the helper close event', async () => {
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; kill: () => boolean };
  child.stdout = new PassThrough(); let kills = 0; child.kill = () => { kills++; return true; };
  const timers = await import('vitest');
  timers.vi.useFakeTimers();
  try {
    const result = runWinCredChild('fixture.exe', 'read', ref, () => child);
    const rejected = expect(result).rejects.toThrow();
    await timers.vi.advanceTimersByTimeAsync(8_001);
    expect(kills).toBe(1);
    child.emit('close', null);
    await rejected;
  } finally { timers.vi.useRealTimers(); }
});
test('clears data emitted after the process has closed', async () => {
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; kill: () => boolean };
  child.stdout = new PassThrough(); child.kill = () => true;
  const result = runWinCredChild('fixture.exe', 'read', ref, () => child);
  child.emit('close', 0);
  const response = await result;
  expect(response.output.length).toBe(0);
  const late = Buffer.alloc(32, 71);
  child.stdout.emit('data', late);
  expect(late).toEqual(Buffer.alloc(32));
});
test('never launches a helper when preflight resolves after its deadline', async () => {
  const timers = await import('vitest');
  timers.vi.useFakeTimers();
  // eslint-disable-next-line no-unused-vars -- callback signature documents the deferred value.
  let finish: ((value: string) => void) | undefined;
  let launches = 0;
  try {
    const pending = launchAfterWinCredPreflight(() => new Promise<string>(resolve => { finish = resolve; }),
      globalThis.performance.now() + 7_000, async () => { launches++; return { status: 0, output: Buffer.alloc(32) }; });
    const rejected = expect(pending).rejects.toThrow();
    expect(finish).toBeTypeOf('function');
    timers.vi.setSystemTime(Date.now() - 3_600_000);
    await timers.vi.advanceTimersByTimeAsync(7_001);
    finish?.('fixture.exe');
    await rejected;
    expect(launches).toBe(0);
  } finally { timers.vi.useRealTimers(); }
});
test('hashes a bounded file and rejects an oversized helper without reading it into memory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-wincred-hash-'));
  const path = join(dir, 'fixture.bin');
  try {
    writeFileSync(path, 'abc');
    expect(await hashWinCredFile(path)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    await expect(hashWinCredFile(path, globalThis.performance.now() - 1)).rejects.toThrow();
    writeFileSync(path, Buffer.alloc(8 * 1024 * 1024 + 1));
    await expect(hashWinCredFile(path)).rejects.toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test.skipIf(process.platform !== 'win32' || process.env.SA_RUN_WINCRED_BRIDGE !== '1')(
  'native helper creates reads rejects duplicates and safely removes its own synthetic key', () => {
    const id = process.env.SA_WINCRED_BRIDGE_ID;
    if (!id || !/^[0-9a-f]{64}$/.test(id)) throw new Error('Explicit synthetic bridge identity required');
    const ps = join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = join(process.cwd(), 'apps/desktop/tests/native/wincred-bridge-integration.ps1');
    const output = execFileSync(ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, '-Reference', 'pkey-' + id],
      { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    expect(JSON.parse(output.trim())).toEqual({ created: true, readMatches: true, duplicateRejected: true,
      wrongProofPreserved: true, exactCleanup: true });
  });
test.skipIf(process.platform !== 'win32' || process.env.SA_RUN_WINCRED_BRIDGE !== '1')(
  'Node vault uses the real native helper and exactly cleans its synthetic credential', async () => {
    const id = process.env.SA_WINCRED_BRIDGE_ID2;
    if (!id || !/^[0-9a-f]{64}$/.test(id)) throw new Error('Second synthetic bridge identity required');
    const reference = 'pkey-' + id;
    const folder = mkdtempSync(join(tmpdir(), 'sa-native-vault-'));
    const binary = join(folder, 'bridge.exe');
    const compiler = join(process.env.WINDIR ?? 'C:/Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    const source = join(process.cwd(), 'apps/desktop/native/WinCredBridge.cs');
    let key: Buffer | undefined;
    let cleanupAttempted = false;
    let cleanupFailed = false;
    let failure: unknown;
    try {
      execFileSync(compiler, ['/nologo', '/define:SA_WINCRED_TEST', '/target:exe', '/out:' + binary, source],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const hash = createHash('sha256').update(readFileSync(binary)).digest('hex');
      const vault = new WindowsCredentialVault(new WinCredProcessTransport(binary, hash));
      key = await vault.create(reference);
      expect(key.length).toBe(32);
      const readback = await vault.read(reference);
      expect(readback).toEqual(key);
      if (readback) {
        vault.release(readback);
        expect(readback).toEqual(Buffer.alloc(32));
      }
      await expect(vault.create(reference)).rejects.toThrow();
      cleanupAttempted = true;
      const cleanup = spawnSync(binary, ['cleanup', reference], { input: key, windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'], timeout: 10000 });
      cleanupFailed = cleanup.status !== 0;
      expect(cleanup.status).toBe(0);
      expect(await vault.read(reference)).toBeNull();
    } catch (error) {
      failure = error;
    } finally {
      if (key && !cleanupAttempted) {
        cleanupAttempted = true;
        const cleanup = spawnSync(binary, ['cleanup', reference], { input: key, windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'], timeout: 10000 });
        cleanupFailed = cleanup.status !== 0;
      }
      key?.fill(0);
      rmSync(folder, { recursive: true, force: true });
    }
    if (cleanupFailed) throw new Error('Synthetic credential cleanup uncertain');
    if (failure) throw failure;
  });
