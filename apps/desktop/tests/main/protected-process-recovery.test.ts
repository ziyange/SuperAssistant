/* eslint-disable no-unused-vars -- type-only native port parameters document exact cleanup. */
import { Buffer } from 'node:buffer';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';
import Database from 'better-sqlite3';
import { expect, test } from 'vitest';

const runner = fileURLToPath(new URL('../fixtures/protected-process-runner.mjs', import.meta.url));
const loader = new URL('../fixtures/protected-process-loader.mjs', import.meta.url).href;
const run = promisify(execFile);
type NativeVault = { create(ref: string): Promise<Buffer>; read(ref: string): Promise<Buffer | null>; cleanup(ref: string, expected: Buffer): Promise<boolean> };
type OwnedKey = { ref: string; digest: string };
type Producer = { producerPid: number; attemptId: string; cwd: string; project: string; head: string; methods: string[] };
type Result = {
  pid: number; created: number; methods: string[]; result: { attemptId: string; observation: string } | null;
  repeated: { attemptId: string; observation: string } | null;
  attempts: { attempt_id: string; state: string }[];
  grants: { grant_id: string; status: string }[];
  leases: { lease_id: string; attempt_id: string; fencing_token: number; state: string }[];
  outbox: { state: string; claim_token: string | null }[];
};
function environment(): Record<string, string | undefined> {
  const names = new Set(['SYSTEMROOT','WINDIR','COMSPEC','PATH','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA',
    'SYSTEMDRIVE','PROGRAMDATA','PROGRAMFILES','PROGRAMFILES(X86)','OS','PATHEXT']);
  return { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => names.has(key.toUpperCase()))), SA_PROTECTED_PROCESS_FIXTURE: '1' };
}
function ownedKeys(folder: string): OwnedKey[] {
  const value: unknown = JSON.parse(readFileSync(join(folder, 'owned-keys.json'), 'utf8'));
  if (!Array.isArray(value) || value.length !== 1 || !value.every(row => row && typeof row === 'object'
    && Object.keys(row).sort().join(',') === 'digest,ref' && /^pkey-[a-f0-9]{64}$/.test(row.ref)
    && typeof row.digest === 'string' && /^[a-f0-9]{64}$/.test(row.digest))) throw new Error('Uncertain fixture key ownership; preserve directory');
  return value as OwnedKey[];
}
async function cleanKey(addon: NativeVault, entry: OwnedKey): Promise<void> {
  const value = await addon.read(entry.ref);
  if (!value) return;
  try {
    if (!Buffer.isBuffer(value) || value.length !== 32 || createHash('sha256').update(value).digest('hex') !== entry.digest) {
      throw new Error('Fixture key changed; refusing cleanup');
    }
    if (await addon.cleanup(entry.ref, value) !== true) throw new Error('Exact fixture key cleanup failed');
  } finally { value.fill(0); }
}
type FolderOwner = { folder: string; parent: string; dev: bigint; ino: bigint };
function captureFolder(folder: string): FolderOwner {
  const identity = lstatSync(folder, { bigint: true });
  return Object.freeze({ folder, parent: dirname(realpathSync(folder)), dev: identity.dev, ino: identity.ino });
}
function verifyFolder(owner: FolderOwner): void {
  const current = lstatSync(owner.folder, { bigint: true });
  if (current.isSymbolicLink() || current.dev !== owner.dev || current.ino !== owner.ino || dirname(realpathSync(owner.folder)) !== owner.parent) {
    throw new Error('Fixture directory ownership changed; preserve evidence');
  }
}
async function cleanupOwned(owner: FolderOwner, addon: NativeVault, captured: readonly OwnedKey[], passed: boolean): Promise<void> {
  verifyFolder(owner);
  if (!captured.length && !existsSync(join(owner.folder, 'owned-keys.json'))) return;
  if (captured.length !== 1 || !isDeepStrictEqual(ownedKeys(owner.folder), captured)) {
    throw new Error('Fixture manifest changed; preserve credentials and evidence');
  }
  for (const key of captured) { verifyFolder(owner); await cleanKey(addon, key); }
  if (passed) { verifyFolder(owner); rmSync(owner.folder, { recursive: true }); }
}

test.skipIf(process.platform !== 'win32').each(['manifest', 'directory'] as const)(
  'fixture cleanup rejects replaced %s before touching credentials', async mode => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'sa-recovery-cleanup-'));
    const rootOwner = captureFolder(root), folder = join(root, 'producer');
    mkdirSync(folder);
    const owner = captureFolder(folder);
    const addon = createRequire(import.meta.url)(fileURLToPath(new URL('../../native/build/Release/wincred_test.node', import.meta.url))) as NativeVault;
    const captured: OwnedKey[] = [];
    try {
      for (let i = 0; i < 2; i++) {
        const ref = 'pkey-' + randomBytes(32).toString('hex'), value = await addon.create(ref);
        try { captured.push(Object.freeze({ ref, digest: createHash('sha256').update(value).digest('hex') })); }
        finally { value.fill(0); }
      }
      writeFileSync(join(folder, 'owned-keys.json'), JSON.stringify([captured[0]]));
      if (mode === 'directory') {
        renameSync(folder, join(root, 'retained'));
        mkdirSync(folder);
      }
      writeFileSync(join(folder, 'owned-keys.json'), JSON.stringify([captured[1]]));
      await expect(cleanupOwned(owner, addon, [captured[0]!], true)).rejects.toThrow();
      for (const key of captured) {
        const remaining = await addon.read(key.ref);
        try { expect(remaining).not.toBeNull(); } finally { remaining?.fill(0); }
      }
    } finally {
      // Both exact keys were created and captured by this parent, never loaded as cleanup authority from disk.
      for (const key of captured) await cleanKey(addon, key);
      verifyFolder(rootOwner);
      rmSync(root, { recursive: true });
    }
  }, 30000
);

async function verifyStopped(pid: number): Promise<void> {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    try { process.kill(pid, 0); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') return;
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Owned fixture descendant did not terminate within 15 seconds');
}

async function produce(folder: string, phase: string, keys: OwnedKey[]): Promise<Producer> {
  const child = spawn(process.execPath, ['--experimental-loader', loader, runner, phase, folder], {
    env: environment(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  const closed = once(child, 'close');
  let output = '', errors = '';
  child.stderr.on('data', chunk => { errors = (errors + String(chunk)).slice(-8192); });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const manifest = await new Promise<Producer>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Producer readiness timeout: ' + errors)), 45000);
      child.once('error', reject);
      child.once('exit', () => reject(new Error('Producer exited before forced termination: ' + errors)));
      child.stdout.on('data', chunk => {
        output += String(chunk);
        if (output.length > 1048576) { reject(new Error('Producer output limit')); return; }
        let end: number;
        while ((end = output.indexOf('\n')) >= 0) {
          const line = output.slice(0, end); output = output.slice(end + 1);
          try {
            if (line.startsWith('FIXTURE_KEY ')) {
              const key = JSON.parse(line.slice('FIXTURE_KEY '.length)) as OwnedKey;
              if (keys.length || !/^pkey-[a-f0-9]{64}$/.test(key.ref) || !/^[a-f0-9]{64}$/.test(key.digest)
                || Object.keys(key).sort().join(',') !== 'digest,ref') throw new Error('Invalid owned fixture key');
              keys.push(Object.freeze({ ref: key.ref, digest: key.digest }));
            } else if (line.startsWith('PRODUCER_READY ')) {
              if (keys.length !== 1) throw new Error('Missing owned fixture key');
              resolve(JSON.parse(line.slice('PRODUCER_READY '.length)) as Producer);
            } else throw new Error('Unexpected fixture output');
          } catch (error) { reject(error); }
        }
      });
    });
    expect(JSON.parse(readFileSync(join(folder, 'producer.json'), 'utf8'))).toEqual(manifest);
    expect(manifest.producerPid).toBe(child.pid);
    expect(child.kill('SIGKILL')).toBe(true);
    await closed;
    expect(child.signalCode === 'SIGKILL' || (child.exitCode !== null && child.exitCode !== 0)).toBe(true);
    for (const file of ['parent.pid', 'child.pid']) {
      if (phase === 'produce-ack') expect(existsSync(join(folder, file))).toBe(true);
      if (existsSync(join(folder, file))) {
        const pid = Number(readFileSync(join(folder, file), 'utf8'));
        expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
        await verifyStopped(pid);
      }
    }
    return manifest;
  } finally {
    if (timer) clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  }
}

test.skipIf(process.platform !== 'win32').each(['claimed', 'ack', 'other-account', 'missing-key', 'tampered-approval', 'offline-claimed', 'closed-ack'] as const)(
  'fresh process recovery after forced producer termination: %s', async mode => {
    const parent = realpathSync(tmpdir()), folder = mkdtempSync(join(parent, 'sa-protected-process-'));
    const owner = captureFolder(folder), keys: OwnedKey[] = [];
    const addon = createRequire(import.meta.url)(fileURLToPath(new URL('../../native/build/Release/wincred_test.node', import.meta.url))) as NativeVault;
    let passed = false;
    try {
      const claimed = mode === 'claimed' || mode === 'offline-claimed';
      const producer = await produce(folder, claimed ? 'produce-claimed' : 'produce-ack', keys);
      verifyFolder(owner);
      expect(ownedKeys(folder)).toEqual(keys);
      const db = new Database(join(folder, 'control.sqlite'));
      let beforeGrants: unknown[], beforeLeases: unknown[];
      const retained = ['tasks', 'work_items', 'protected_start_receipts'];
      let beforeRetained: unknown[];
      try {
        expect(db.prepare('SELECT state FROM execution_attempts').get()).toEqual({ state: claimed ? 'DISPATCH_PENDING' : 'RUNNING' });
        beforeGrants = db.prepare('SELECT * FROM authorization_grants').all();
        beforeLeases = db.prepare('SELECT * FROM resource_leases').all();
        beforeRetained = retained.map(table => db.prepare('SELECT * FROM ' + table).all());
        expect(db.serialize().includes(Buffer.from('Write the approved change'))).toBe(false);
        if (mode === 'tampered-approval') {
          db.exec('DROP TRIGGER protected_execution_context_no_update');
          db.prepare('UPDATE protected_execution_context SET approval_tag=?').run('hmac-sha256:' + '0'.repeat(64));
        }
      } finally { db.close(); }
      expect(producer.methods.filter(method => method === 'turn/start')).toHaveLength(claimed ? 0 : 1);
      if (mode === 'missing-key') await cleanKey(addon, keys[0]!);
      const response = await run(process.execPath, ['--experimental-loader', loader, runner,
        mode === 'other-account' ? 'observe-other' : mode === 'offline-claimed' ? 'observe-offline' : mode === 'closed-ack' ? 'observe-closed' : 'observe', folder], {
        env: environment(), encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1048576
      });
      const line = response.stdout.split(/\r?\n/).find(value => value.startsWith('RECOVERY_RESULT '));
      expect(line).toBeDefined();
      const result = JSON.parse(line!.slice('RECOVERY_RESULT '.length)) as Result;
      expect(result.pid).not.toBe(producer.producerPid);
      expect(result.created).toBe(0);
      if (mode === 'offline-claimed' || mode === 'closed-ack') expect(result.methods).toEqual([]);
      expect(result.methods.filter(method => ['thread/start','turn/start','thread/resume','turn/interrupt'].includes(method))).toEqual([]);
      expect(result.grants).toEqual(beforeGrants);
      expect(result.leases).toEqual(beforeLeases);
      expect(result.leases).toEqual([expect.objectContaining({ lease_id: expect.any(String), attempt_id: producer.attemptId, fencing_token: 1, state: 'ACTIVE' })]);
      const state = mode === 'ack' ? 'RECONCILING' : ['missing-key', 'tampered-approval'].includes(mode) ? 'RUNNING' : 'UNKNOWN';
      expect(result.attempts).toEqual([{ attempt_id: producer.attemptId, state }]);
      expect(result.result).toEqual(mode === 'ack' ? { attemptId: producer.attemptId, observation: 'OBSERVED_COMPLETED' } : null);
      expect(result.repeated).toEqual(result.result);
      expect(result.outbox).toEqual([{ state: claimed ? 'RECONCILING' : 'ACKNOWLEDGED', claim_token: null }]);
      const after = new Database(join(folder, 'control.sqlite'), { readonly: true });
      try {
        expect(retained.map(table => after.prepare('SELECT * FROM ' + table).all())).toEqual(beforeRetained);
        expect(after.pragma('integrity_check', { simple: true })).toBe('ok');
        expect(after.pragma('foreign_key_check')).toEqual([]);
      } finally { after.close(); }
      passed = true;
    } finally {
      // A failed scenario retains its non-secret database and protocol evidence.
      await cleanupOwned(owner, addon, keys, passed);
    }
  }, 120000
);
