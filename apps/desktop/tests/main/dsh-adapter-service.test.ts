import { expect, test } from 'vitest';
import { DshAdapterService } from '../../src/main/dsh-adapter-service.js';

test('a fabricated termination boolean cannot release a lease or claim cancellation', async () => {
  const releases: string[] = [];
  let hostCalls = 0, callbackCalls = 0;
  const service = new DshAdapterService({ cancel: async (_attempt, terminate) => { hostCalls += 1; return { cancelled: await terminate() }; } }, { release: (lease) => { releases.push(lease); return true; } });
  const result = await service.cancel({ attemptId: 'a', leaseId: 'l', fencingToken: 1, now: 'now' }, async () => { callbackCalls += 1; return true; });
  expect(result).toEqual({ cancelled: false, leaseReleased: false });
  expect(releases).toEqual([]);
  expect(hostCalls).toBe(0);
  expect(callbackCalls).toBe(0);
});

test('repeated cancellation never invokes false, rejected, or forged callbacks', async () => {
  let calls = 0;
  const service = new DshAdapterService({ cancel: async () => { calls += 1; return { cancelled: true }; } }, { release: () => { calls += 1; return true; } });
  const input = { attemptId: 'a', leaseId: 'l', fencingToken: 1, now: 'now' };
  const callbacks = [async () => { calls += 1; return false; }, async () => { calls += 1; throw new Error('should not run'); }, async () => { calls += 1; return true; }];
  const results = await Promise.all(callbacks.map(callback => service.cancel(input, callback)));
  expect(results).toEqual(callbacks.map(() => ({ cancelled: false, leaseReleased: false })));
  expect(calls).toBe(0);
});

test('capability effects execute only after broker approval', async () => {
  let calls = 0;
  const denied = new DshAdapterService({ cancel: async () => ({ cancelled: false }) }, { release: () => false }, { authorize: () => ({ allowed: false, reason: 'STALE_GRANT' }) });
  expect(await denied.executeCapability({ capability: 'shell', grant: 'old', snapshot: 's', fence: 1, target: 'fixture' }, async () => { calls += 1; })).toEqual({ executed: false, reason: 'STALE_GRANT' });
  expect(calls).toBe(0);
  const allowed = new DshAdapterService({ cancel: async () => ({ cancelled: false }) }, { release: () => false }, { authorize: () => ({ allowed: true }) });
  expect(await allowed.executeCapability({ capability: 'network', grant: 'g', snapshot: 's', fence: 1, target: 'fixture' }, async () => { calls += 1; })).toEqual({ executed: true });
  expect(calls).toBe(1);
});

test.each(['shell', 'filesystem', 'network', 'plugin'] as const)('%s remains available when the broker approves', async capability => {
  let effects = 0;
  const service = new DshAdapterService({ cancel: async () => ({ cancelled: false }) }, { release: () => false }, { authorize: () => ({ allowed: true }) });
  expect(await service.executeCapability({ capability, grant: 'g', snapshot: 's', fence: 1, target: 'fixture', pluginDigest: 'digest' }, async () => { effects += 1; })).toEqual({ executed: true });
  expect(effects).toBe(1);
});
