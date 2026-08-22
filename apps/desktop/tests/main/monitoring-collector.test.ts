import { expect, test } from 'vitest';
import { recoverScheduledCollection } from '../../src/main/monitoring-collector.js';

test('restarts a due schedule once and marks it recovered', () => {
  expect(recoverScheduledCollection({ scheduleId: 'schedule-1', dueAt: '2026-08-22T00:00:00.000Z', lastRunId: null }, '2026-08-22T00:00:01.000Z')).toEqual({ scheduleId: 'schedule-1', action: 'COLLECT_ONCE' });
});
