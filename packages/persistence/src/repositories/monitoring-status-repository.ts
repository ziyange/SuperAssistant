/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createMonitoringStatus, type MonitoringStatus } from '@super-assistant/domain';

export class SqliteMonitoringStatusRepository {
  public constructor(private readonly database: Database.Database) {}

  public get(projectId: string): Readonly<MonitoringStatus> {
    const rawEventCount = Number((this.database.prepare('SELECT COUNT(*) AS count FROM raw_monitoring_events WHERE project_id = ?').get(projectId) as { count: number }).count);
    const aggregateCount = Number((this.database.prepare('SELECT COUNT(*) AS count FROM event_aggregation_groups WHERE project_id = ?').get(projectId) as { count: number }).count);
    const blockedFollowUpCount = Number((this.database.prepare("SELECT COUNT(*) AS count FROM follow_up_budget_decisions WHERE correlation_key LIKE ?").get(`${projectId}:%`) as { count: number }).count);
    return createMonitoringStatus({ rawEventCount, aggregateCount, blockedFollowUpCount, collector: 'UNAVAILABLE' });
  }
}
