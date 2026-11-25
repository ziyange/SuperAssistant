import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { AppServerExecutionClient } from '../../../../packages/codex-adapter/src/app-server-execution-client.js';
import { InProcessOwnerTransport } from '../../src/main/inprocess-owner-transport.js';

describe.skipIf(process.platform !== 'win32')('in-process owner transport', () => {
  it('stops the owned process when the client rejects a malformed protocol response', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sa-owner-malformed-'));
    const addon = createRequire(import.meta.url)(resolve('apps/desktop/native/build/Release/process_owner.node'));
    const owner = addon.start(process.execPath, ['-e', "process.stdin.once('data', () => { process.stdout.write('invalid\\n'); setInterval(() => {}, 1000); });"], folder);
    let stops = 0;
    const transport = new InProcessOwnerTransport({
      write: (bytes: Buffer) => owner.write(bytes), read: () => owner.read(),
      stop: () => { stops++; return owner.stop(); }
    });
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const client = new AppServerExecutionClient(transport, '0.121.0', principal,
      async () => true, () => true, () => true, 10000);
    try {
      await expect(client.initialize()).rejects.toThrow();
      for (let i = 0; i < 100 && stops === 0; i++) await setTimeout(20);
      expect(stops).toBe(1);
      expect(await transport.stop()).toBe('TERMINATED_UNVERIFIED');
      expect(client.status()).toBe('CLOSED');
    } finally {
      client.dispose();
      await transport.stop();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 30000);

  it('stops its owner if the output consumer closes unexpectedly', async () => {
    let stopped = 0;
    const transport = new InProcessOwnerTransport({
      async write() {},
      read: () => new Promise(() => {}),
      async stop() { stopped++; return 'TERMINATED'; }
    });
    transport.stdout.destroy();
    await setTimeout(50);
    expect(stopped).toBe(1);
    expect(await transport.stop()).toBe('TERMINATED_UNVERIFIED');
  });

  it('records UNKNOWN before stopping the owner after a running turn loses its durable event', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sa-owner-unknown-'));
    const addon = createRequire(import.meta.url)(resolve('apps/desktop/native/build/Release/process_owner.node'));
    const fixture = resolve('packages/codex-adapter/tests/fixtures/execution-app-server.mjs');
    const owner = addon.start(process.execPath, [fixture, 'early-completed'], folder);
    const order: string[] = [];
    const transport = new InProcessOwnerTransport({
      write: (bytes: Buffer) => owner.write(bytes), read: () => owner.read(),
      stop: () => { order.push('stop'); return owner.stop(); }
    });
    const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
    const client = new AppServerExecutionClient(transport, '0.121.0', principal, async () => true,
      () => { order.push('unknown'); return true; }, () => true, 10000);
    try {
      await client.initialize();
      await client.start(folder, 'Write the approved change').catch(() => undefined);
      for (let i = 0; i < 200 && order.length < 2; i++) await setTimeout(20);
      expect(order).toEqual(['unknown', 'stop']);
      expect(client.status()).toBe('UNKNOWN');
      expect(await transport.stop()).toBe('TERMINATED_UNVERIFIED');
    } finally {
      client.dispose();
      await transport.stop();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 30000);

  it('waits for a just-started owned process to exit before reporting termination', async () => {
    const addon = createRequire(import.meta.url)(resolve('apps/desktop/native/build/Release/process_owner.node'));
    for (let iteration = 0; iteration < 10; iteration++) {
      const folder = mkdtempSync(join(tmpdir(), 'sa-owner-immediate-'));
      const owner = addon.start(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], folder);
      expect(await owner.stop()).toBe('TERMINATED');
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60000);

  it('runs the existing App Server client and quarantines its original result after owned stop', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sa-inprocess-owner-'));
    const addon = createRequire(import.meta.url)(resolve('apps/desktop/native/build/Release/process_owner.node'));
    const fixture = resolve('packages/codex-adapter/tests/fixtures/execution-app-server.mjs');
    const owner = addon.start(process.execPath, [fixture, 'normal'], folder);
    let transport: InProcessOwnerTransport | undefined;
    let client: AppServerExecutionClient<InProcessOwnerTransport> | undefined;
    try {
      transport = new InProcessOwnerTransport(owner);
      const principal = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
      const receipts: unknown[] = [];
      let unknown = 0;
      client = new AppServerExecutionClient(transport, '0.121.0', principal,
        async () => true, () => { unknown++; return true; }, receipt => { receipts.push(receipt); return true; }, 15000);
      await client.initialize();
      const receipt = await client.start(folder, 'Write the approved change');
      expect(receipts).toEqual([receipt]);
      expect(await client.interrupt()).toBe(true);
      expect(await transport.stop()).toBe('TERMINATED_UNVERIFIED');
      expect(client.status()).toBe('UNKNOWN');
      expect(unknown).toBe(1);
    } catch (error) {
      console.error('fixture protocol failure', error);
      throw error;
    } finally {
      client?.dispose();
      if (transport) await transport.stop();
      else await owner.stop().catch(() => {});
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60000);
});
