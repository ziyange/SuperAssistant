import { expect, test } from 'vitest';
import { aggregateEvents } from '../src/event-aggregation.js';

test('groups equivalent events in one window while retaining every raw identifier', () => {
  expect(aggregateEvents([
    { rawEventId: 'raw-1', key: 'project-1:BUILD_FAILED', occurredAt: '2026-08-22T00:00:00.000Z' },
    { rawEventId: 'raw-2', key: 'project-1:BUILD_FAILED', occurredAt: '2026-08-22T00:04:59.000Z' }
  ], 300000)).toEqual([{ correlationKey: 'project-1:BUILD_FAILED', rawEventIds: ['raw-1', 'raw-2'], count: 2 }]);
});

test('does not merge events across correlation windows', () => {
  expect(aggregateEvents([{ rawEventId: 'raw-1', key: 'k', occurredAt: '2026-08-22T00:00:00.000Z' }, { rawEventId: 'raw-2', key: 'k', occurredAt: '2026-08-22T00:05:00.000Z' }], 300000)).toHaveLength(2);
});
