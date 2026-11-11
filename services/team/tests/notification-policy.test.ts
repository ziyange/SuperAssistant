import { expect, test } from 'vitest';
import { decideNotificationDelivery, resolveNotificationDeepLink } from '../src/notification-policy.js';

test('suppresses notifications during quiet hours unless Emergency bypass is explicitly enabled', () => {
  const quiet = { workspaceId: 'workspace-1', principal: 'user-1', startHour: 22, endHour: 7 };
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'NORMAL', hour: 23, quietHours: quiet })).toEqual({ deliver: false, reason: 'QUIET_HOURS' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'EMERGENCY', hour: 23, quietHours: quiet })).toEqual({ deliver: false, reason: 'QUIET_HOURS' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'EMERGENCY', hour: 23, quietHours: quiet, emergencyBypassAllowed: false })).toEqual({ deliver: false, reason: 'QUIET_HOURS' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'EMERGENCY', hour: 23, quietHours: quiet, emergencyBypassAllowed: 1 as unknown as boolean })).toEqual({ deliver: false, reason: 'QUIET_HOURS' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'EMERGENCY', hour: 23, quietHours: quiet, emergencyBypassAllowed: true })).toEqual({ deliver: true, audit: 'EMERGENCY_BYPASS' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: false, priority: 'EMERGENCY', hour: 23, quietHours: quiet, emergencyBypassAllowed: true })).toEqual({ deliver: false, reason: 'AUTHORIZATION_DENIED' });
});

test('suppresses uncertain authorization and aggregates matching notifications', () => {
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: false, priority: 'NORMAL', hour: 12 })).toEqual({ deliver: false, reason: 'AUTHORIZATION_DENIED' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: 'false' as unknown as boolean, priority: 'NORMAL', hour: 12 })).toEqual({ deliver: false, reason: 'AUTHORIZATION_DENIED' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'NORMAL', hour: 12, aggregateKey: 'task-1', pendingAggregateCount: 3 })).toEqual({ deliver: true, aggregateCount: 4 });
});

test('deep links resolve the authorized reference rather than a caller-selected object', async () => {
  const calls: string[] = [];
  const ports = {
    async authorize(workspaceId: string, principal: string, targetRef: string) {
      calls.push(`authorize:${workspaceId}:${principal}:${targetRef}`);
      return workspaceId === 'w1' && principal === 'user' && targetRef === 'target:opaque';
    },
    async resolve(workspaceId: string, targetRef: string) {
      calls.push(`resolve:${workspaceId}:${targetRef}`);
      return { kind: 'TASK' as const, id: 'actual-task' };
    }
  };
  const input = { workspaceId: 'w1', principal: 'user', targetRef: 'target:opaque' };
  expect(await resolveNotificationDeepLink(input, ports)).toEqual({ kind: 'TASK', id: 'actual-task' });
  expect(calls).toEqual(['authorize:w1:user:target:opaque', 'resolve:w1:target:opaque']);
  calls.length = 0;
  expect(await resolveNotificationDeepLink({ ...input, requested: { kind: 'TASK', id: 'other-task' } }, ports)).toBeUndefined();
  expect(await resolveNotificationDeepLink({ ...input, requested: { kind: 'DECISION', id: 'actual-task' } }, ports)).toBeUndefined();
  calls.length = 0;
  expect(await resolveNotificationDeepLink({ ...input, workspaceId: 'other' }, ports)).toBeUndefined();
  expect(calls).toEqual(['authorize:other:user:target:opaque']);
  calls.length = 0;
  expect(await resolveNotificationDeepLink({ ...input, targetRef: 'target:' }, ports)).toBeUndefined();
  expect(await resolveNotificationDeepLink({ ...input, targetRef: 'target:opaque\nforged' }, ports)).toBeUndefined();
  expect(await resolveNotificationDeepLink({ ...input, targetRef: 'target:opaque trailing' }, ports)).toBeUndefined();
  expect(calls).toEqual([]);
  expect(await resolveNotificationDeepLink(input, { ...ports, async authorize() { throw new Error('offline'); } })).toBeUndefined();
  calls.length = 0;
  expect(await resolveNotificationDeepLink(input, { ...ports, async authorize() { return 'false' as unknown as boolean; } })).toBeUndefined();
  expect(calls).toEqual([]);
  expect(await resolveNotificationDeepLink(input, { ...ports, async resolve() { throw new Error('offline'); } })).toBeUndefined();
  expect(await resolveNotificationDeepLink(input, { ...ports, async resolve() { return undefined; } })).toBeUndefined();
});
