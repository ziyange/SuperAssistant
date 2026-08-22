import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteEventAggregationRepository } from '../src/repositories/event-aggregation-repository.js';

test('persists one correlation group with immutable raw-event lineage', () => {
  const database = createFoundationDatabase(':memory:');
  database.prepare("INSERT INTO raw_monitoring_events VALUES ('raw-1','workspace-1','project-1','source-1','key-1','BUILD_FAILED','2026-08-22T00:00:00.000Z','{}','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','2026-08-22T00:00:00.000Z')").run();
  database.prepare("INSERT INTO raw_monitoring_events VALUES ('raw-2','workspace-1','project-1','source-1','key-2','BUILD_FAILED','2026-08-22T00:01:00.000Z','{}','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','2026-08-22T00:01:00.000Z')").run();
  const repository = new SqliteEventAggregationRepository(database);
  repository.append({ groupId: 'group-1', correlationKey: 'project-1:BUILD_FAILED', windowStartedAt: '2026-08-22T00:00:00.000Z', rawEventIds: ['raw-1', 'raw-2'] });
  expect(repository.list('project-1')).toEqual([{ groupId: 'group-1', correlationKey: 'project-1:BUILD_FAILED', windowStartedAt: '2026-08-22T00:00:00.000Z', rawEventIds: ['raw-1', 'raw-2'], count: 2 }]);
  database.close();
});
