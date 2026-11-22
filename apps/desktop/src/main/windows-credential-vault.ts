/* eslint-disable no-unused-vars -- port arguments and constructor properties define the process boundary. */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, normalize } from 'node:path';
import type { Readable } from 'node:stream';
import process from 'node:process';
import type { ReservedVault } from './reserved-payload-service.js';

export type WinCredOperation = 'create' | 'read';
export interface WinCredTransport {
  /** The result buffer is owned by the caller and must never be logged. */
  execute(operation: WinCredOperation, reference: string): Promise<{ status: number; output: Buffer }>;
}
const referencePattern = /^pkey-[0-9a-f]{64}$/;
function validate(reference: string): void {
  if (typeof reference !== 'string' || !referencePattern.test(reference)) throw new Error('Credential reference rejected');
}

/** Does not establish binary provenance; it is not wired into the desktop application. */
export class WindowsCredentialVault implements ReservedVault {
  constructor(private readonly transport: WinCredTransport) {}
  private async request(operation: WinCredOperation, ref: string): Promise<Buffer | null> {
    validate(ref);
    let output: Buffer | undefined;
    try {
      const result = await this.transport.execute(operation, ref);
      output = result.output;
      if (!Buffer.isBuffer(output)) throw new Error('Malformed output');
      if (result.status === 2 && operation === 'read' && output.length === 0) return null;
      if (result.status !== 0 || output.length !== 32) throw new Error('Credential helper failure');
      return Buffer.from(output);
    } catch {
      throw new Error('Windows credential operation failed');
    } finally {
      if (Buffer.isBuffer(output)) output.fill(0);
    }
  }
  async create(ref: string): Promise<Buffer> {
    const value = await this.request('create', ref);
    if (!value) throw new Error('Windows credential operation failed');
    return value;
  }
  async read(ref: string): Promise<Buffer | null> { return this.request('read', ref); }
}

type BridgeChild = {
  stdout: Readable;
  once(event: 'error', listener: (error: Error) => void): unknown;
  once(event: 'close', listener: (code: number | null) => void): unknown;
  kill(): boolean;
};
export function runWinCredChild(binary: string, operation: WinCredOperation, reference: string,
  launch: () => BridgeChild = () => spawn(binary, [operation, reference], {
    shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    env: { SystemRoot: process.env.SystemRoot ?? 'C:/Windows' }
  }) as BridgeChild): Promise<{ status: number; output: Buffer }> {
  return new Promise((resolve, reject) => {
    let child: BridgeChild;
    try { child = launch(); } catch { reject(new Error('Credential helper unavailable')); return; }
    let failed = false;
    let closed = false;
    let size = 0;
    const chunks: Buffer[] = [];
    const clear = () => { for (const chunk of chunks) chunk.fill(0); chunks.length = 0; };
    const stop = () => { failed = true; clear(); try { child.kill(); } catch { /* Wait for close. */ } };
    const timeout = globalThis.setTimeout(stop, 8_000);
    child.stdout.on('error', stop);
    child.stdout.on('data', (chunk: Buffer) => {
      if (failed || closed) { chunk.fill(0); return; }
      size += chunk.length;
      if (size > 32) { chunk.fill(0); stop(); }
      else chunks.push(chunk);
    });
    child.once('error', stop);
    child.once('close', code => {
      closed = true;
      globalThis.clearTimeout(timeout);
      if (failed || code === null) { clear(); reject(new Error('Credential helper unavailable')); return; }
      const output = Buffer.concat(chunks);
      clear();
      resolve({ status: code, output });
    });
  });
}

/** Read only through a fixed handle with a strict memory and file size bound. */
function requireBeforeDeadline(deadline: number): void {
  if (globalThis.performance.now() >= deadline) throw new Error('Credential helper preflight expired');
}
export async function hashWinCredFile(path: string, deadline = Number.POSITIVE_INFINITY): Promise<string> {
  requireBeforeDeadline(deadline);
  const handle = await open(path, 'r');
  const chunk = Buffer.alloc(64 * 1024);
  try {
    requireBeforeDeadline(deadline);
    const stat = await handle.stat();
    requireBeforeDeadline(deadline);
    if (!stat.isFile() || stat.size < 1 || stat.size > 8 * 1024 * 1024) throw new Error('Credential helper unavailable');
    const hash = createHash('sha256');
    let offset = 0;
    while (offset < stat.size) {
      requireBeforeDeadline(deadline);
      const { bytesRead } = await handle.read(chunk, 0, Math.min(chunk.length, stat.size - offset), offset);
      requireBeforeDeadline(deadline);
      if (bytesRead < 1) throw new Error('Credential helper unavailable');
      hash.update(chunk.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const extra = await handle.read(chunk, 0, 1, offset);
    requireBeforeDeadline(deadline);
    const final = await handle.stat();
    requireBeforeDeadline(deadline);
    if (extra.bytesRead !== 0 || final.size !== stat.size) throw new Error('Credential helper unavailable');
    return hash.digest('hex');
  } finally { chunk.fill(0); await handle.close(); }
}

/** A late preflight can never initiate a new helper after its deadline. */
export async function launchAfterWinCredPreflight<T>(preflight: () => Promise<T>, deadline: number,
  launch: (value: T) => Promise<{ status: number; output: Buffer }>): Promise<{ status: number; output: Buffer }> {
  requireBeforeDeadline(deadline);
  const result = await preflight();
  requireBeforeDeadline(deadline);
  return launch(result);
}

/** Checksum and canonical-path checks reduce accidental mismatch but are not provenance or TOCTOU protection. */
export class WinCredProcessTransport implements WinCredTransport {
  constructor(private readonly binaryPath: string, private readonly expectedSha256: string) {}

  async execute(operation: WinCredOperation, reference: string): Promise<{ status: number; output: Buffer }> {
    validate(reference);
    if (process.platform !== 'win32' || !isAbsolute(this.binaryPath) || !/^[0-9a-f]{64}$/.test(this.expectedSha256)
      || (operation !== 'create' && operation !== 'read')) throw new Error('Credential helper unavailable');
    const deadline = globalThis.performance.now() + 7_000;
    return launchAfterWinCredPreflight(async () => {
      const file = await lstat(this.binaryPath);
      requireBeforeDeadline(deadline);
      const canonical = await realpath(this.binaryPath);
      requireBeforeDeadline(deadline);
      if (!file.isFile() || file.isSymbolicLink() || file.size < 1 || file.size > 8 * 1024 * 1024
        || normalize(canonical).toLowerCase() !== normalize(this.binaryPath).toLowerCase()) {
        throw new Error('Credential helper unavailable');
      }
      if (await hashWinCredFile(canonical, deadline) !== this.expectedSha256) throw new Error('Credential helper unavailable');
      return canonical;
    }, deadline, canonical => runWinCredChild(canonical, operation, reference));
  }
}
