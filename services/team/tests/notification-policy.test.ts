import { expect, test } from 'vitest';
import { decideNotificationDelivery, resolveNotificationDeepLink } from '../src/notification-policy.js';

test('suppresses normal notifications during principal-scoped quiet hours and allows audited Emergency bypass', () => {
  const quiet = { workspaceId: 'workspace-1', principal: 'user-1', startHour: 22, endHour: 7 };
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'NORMAL', hour: 23, quietHours: quiet })).toEqual({ deliver: false, reason: 'QUIET_HOURS' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'EMERGENCY', hour: 23, quietHours: quiet })).toEqual({ deliver: true, audit: 'EMERGENCY_BYPASS' });
});

test('suppresses uncertain authorization and aggregates matching notifications', () => {
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: false, priority: 'NORMAL', hour: 12 })).toEqual({ deliver: false, reason: 'AUTHORIZATION_DENIED' });
  expect(decideNotificationDelivery({ workspaceId: 'workspace-1', principal: 'user-1', authorized: true, priority: 'NORMAL', hour: 12, aggregateKey: 'task-1', pendingAggregateCount: 3 })).toEqual({ deliver: true, aggregateCount: 4 });
});

test('deep links are resolved only after target authorization', () => {
  expect(resolveNotificationDeepLink({ authorized: false, taskId: 'task-1' })).toBeUndefined();
  expect(resolveNotificationDeepLink({ authorized: true, taskId: 'task-1', decisionId: 'decision-1' })).toBeUndefined();
  expect(resolveNotificationDeepLink({ authorized: true, decisionId: 'decision-1' })).toEqual({ kind: 'DECISION', id: 'decision-1' });
});
