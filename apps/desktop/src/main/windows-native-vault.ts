/* eslint-disable no-unused-vars -- Native binding parameters document its boundary. */
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import process from 'node:process';
import type { ReservedVault } from './reserved-payload-service.js';

type NativeBinding = {
  create(reference: string): Promise<Buffer> | Buffer;
  read(reference: string): Promise<Buffer | null> | Buffer | null;
};

export class WindowsNativeVault implements ReservedVault {
  private readonly owned = new WeakSet<Buffer>();
  constructor(private readonly binding: NativeBinding) {}
  private async request(ref: string, operation: 'create' | 'read'): Promise<Buffer | null> {
    if (typeof ref !== 'string' || !/^pkey-[0-9a-f]{64}$/.test(ref)) throw new Error('Windows credential operation failed');
    let result: Buffer | null = null;
    try {
      result = await this.binding[operation](ref);
      if (result === null && operation === 'read') return null;
      if (!Buffer.isBuffer(result) || result.length !== 32) throw new Error('Invalid native result');
      const copy = Buffer.from(result);
      this.owned.add(copy);
      return copy;
    } catch {
      throw new Error('Windows credential operation failed');
    } finally {
      if (Buffer.isBuffer(result)) result.fill(0);
    }
  }
  async create(ref: string): Promise<Buffer> {
    const result = await this.request(ref, 'create');
    if (!result) throw new Error('Windows credential operation failed');
    return result;
  }
  async read(ref: string): Promise<Buffer | null> { return this.request(ref, 'read'); }
  release(value: Buffer): void {
    if (Buffer.isBuffer(value) && this.owned.delete(value)) value.fill(0);
  }
}

/** Loading this artifact does not by itself prove its installation is trusted. */
export function loadBundledWindowsNativeVault(): WindowsNativeVault {
  try {
    if (process.platform !== 'win32') throw new Error('Unsupported platform');
    const addon: unknown = createRequire(import.meta.url)('../native/wincred_native.node');
    if (!addon || typeof addon !== 'object' || !('create' in addon) || !('read' in addon)
      || typeof addon.create !== 'function' || typeof addon.read !== 'function') throw new Error('Invalid addon');
    return new WindowsNativeVault(addon as NativeBinding);
  } catch {
    throw new Error('Windows credential vault unavailable');
  }
}
