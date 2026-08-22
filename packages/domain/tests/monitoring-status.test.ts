import { expect, test } from 'vitest';
import { createMonitoringStatus } from '../src/monitoring-status.js';
import { aggregateEvents } from '../src/event-aggregation.js';
import { evaluateFollowUp } from '../src/follow-up-budget.js';

test('creates a payload-free monitoring status with truthful collector availability', () => {
  expect(createMonitoringStatus({ rawEventCount: 3, aggregateCount: 1, blockedFollowUpCount: 2, collector: 'UNAVAILABLE' })).toEqual({ rawEventCount: 3, aggregateCount: 1, blockedFollowUpCount: 2, collector: 'UNAVAILABLE' });
  expect(() => createMonitoringStatus({ rawEventCount: -1, aggregateCount: 0, blockedFollowUpCount: 0, collector: 'IDLE' })).toThrow('MONITORING_STATUS_COUNT_INVALID');
});

test('bounds a same-key event storm before any follow-up authorization', () => {
  const events = Array.from({ length: 100 }, (_, index) => ({ rawEventId: `raw-${index}`, key: 'project-1:BUILD_FAILED', occurredAt: '2026-08-22T00:00:00.000Z' }));
  expect(aggregateEvents(events, 300_000)).toHaveLength(1);
  expect(evaluateFollowUp({ now: 1_000, lastFollowUpAt: 900, cooldownMs: 200, active: 0, concurrencyLimit: 2, used: 0, budget: 10 })).toEqual({ allowed: false, reason: 'COOLDOWN' });
  expect(evaluateFollowUp({ now: 1_000, lastFollowUpAt: 0, cooldownMs: 1, active: 2, concurrencyLimit: 2, used: 0, budget: 10 })).toEqual({ allowed: false, reason: 'CONCURRENCY' });
  expect(evaluateFollowUp({ now: 1_000, lastFollowUpAt: 0, cooldownMs: 1, active: 0, concurrencyLimit: 2, used: 10, budget: 10 })).toEqual({ allowed: false, reason: 'BUDGET' });
});
