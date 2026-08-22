import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteMonitoringStatusRepository } from '../src/repositories/monitoring-status-repository.js';

test('projects only aggregate monitoring counts for a Project', () => {
  const database = createFoundationDatabase(':memory:');
  database.prepare("INSERT INTO raw_monitoring_events VALUES ('raw-1','workspace-1','project-1','source-1','key-1','BUILD_FAILED','2026-08-22T00:00:00.000Z','{}','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','2026-08-22T00:00:00.000Z')").run();
  database.prepare("INSERT INTO event_aggregation_groups VALUES ('group-1','project-1','project-1:BUILD_FAILED','2026-08-22T00:00:00.000Z')").run();
  database.prepare("INSERT INTO follow_up_budget_decisions VALUES ('decision-1','project-1:BUILD_FAILED','COOLDOWN','2026-08-22T00:00:00.000Z')").run();
  expect(new SqliteMonitoringStatusRepository(database).get('project-1')).toEqual({ rawEventCount: 1, aggregateCount: 1, blockedFollowUpCount: 1, collector: 'UNAVAILABLE' });
  database.close();
});
