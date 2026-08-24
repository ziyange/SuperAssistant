import { expect, test } from 'vitest';
import { DshAdapterService } from '../../src/main/dsh-adapter-service.js';

test('cancellation releases the lease only after termination proof', async () => {
  const releases: string[] = [];
  const service = new DshAdapterService({ cancel: async (_attempt, terminate) => ({ cancelled: await terminate() }) }, { release: (lease) => { releases.push(lease); return true; } });
  expect(await service.cancel({ attemptId: 'a', leaseId: 'l', fencingToken: 1, now: 'now' }, async () => false)).toEqual({ cancelled: false, leaseReleased: false });
  expect(releases).toEqual([]);
  expect(await service.cancel({ attemptId: 'a', leaseId: 'l', fencingToken: 1, now: 'now' }, async () => true)).toEqual({ cancelled: true, leaseReleased: true });
  expect(releases).toEqual(['l']);
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
