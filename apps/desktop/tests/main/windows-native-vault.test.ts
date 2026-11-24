import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { WindowsNativeVault } from '../../src/main/windows-native-vault.js';

describe('in-process Windows credential vault', () => {
  const ref = 'pkey-' + 'a'.repeat(64);

  it('creates, reads and releases an owned key without exposing the binding buffer', async () => {
    const stored = Buffer.alloc(32, 17);
    const vault = new WindowsNativeVault({
      create: () => Buffer.from(stored),
      read: () => Buffer.from(stored)
    });
    const created = await vault.create(ref);
    expect(created).toEqual(stored);
    const read = await vault.read(ref);
    expect(read).toEqual(stored);
    vault.release(created);
    expect(created).toEqual(Buffer.alloc(32));
    expect(read).toEqual(stored);
    vault.release(read!);
    expect(read).toEqual(Buffer.alloc(32));
  });

  it('rejects invalid references before invoking the native binding', async () => {
    let calls = 0;
    const vault = new WindowsNativeVault({
      create: () => { calls++; return Buffer.alloc(32); },
      read: () => { calls++; return null; }
    });
    await expect(vault.create('pkey-' + 'A'.repeat(64))).rejects.toThrow();
    await expect(vault.read('other')).rejects.toThrow();
    await expect(vault.read(ref + '\\n')).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it('treats missing reads distinctly and rejects malformed or failed native results', async () => {
    const vault = new WindowsNativeVault({
      create: () => Buffer.alloc(31),
      read: () => null
    });
    expect(await vault.read(ref)).toBeNull();
    await expect(vault.create(ref)).rejects.toThrow('Windows credential operation failed');
    const failed = new WindowsNativeVault({
      create: () => { throw new Error('secret must not escape'); },
      read: () => { throw new Error('secret must not escape'); }
    });
    await expect(failed.read(ref)).rejects.toThrow('Windows credential operation failed');
  });

  it('does not zero buffers that were not returned by this vault', () => {
    const vault = new WindowsNativeVault({ create: () => Buffer.alloc(32), read: () => null });
    const borrowed = Buffer.alloc(32, 42);
    vault.release(borrowed);
    expect(borrowed).toEqual(Buffer.alloc(32, 42));
  });
});
