/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
type GroupRow = { group_id: string; correlation_key: string; window_started_at: string };
type LineageRow = { raw_event_id: string };
export interface PersistedEventGroup { groupId: string; correlationKey: string; windowStartedAt: string; rawEventIds: readonly string[]; count: number; }
export class SqliteEventAggregationRepository {
  constructor(private readonly database: Database.Database) {}
  append(input: { groupId: string; correlationKey: string; windowStartedAt: string; rawEventIds: readonly string[] }): void { const projectId = input.correlationKey.split(':')[0] ?? ''; this.database.transaction(() => { this.database.prepare('INSERT INTO event_aggregation_groups VALUES (?, ?, ?, ?)').run(input.groupId, projectId, input.correlationKey, input.windowStartedAt); for (const id of input.rawEventIds) this.database.prepare('INSERT INTO event_aggregation_lineage VALUES (?, ?)').run(input.groupId, id); })(); }
  list(projectId: string): readonly PersistedEventGroup[] { return (this.database.prepare('SELECT * FROM event_aggregation_groups WHERE project_id=?').all(projectId) as GroupRow[]).map((group) => { const rawEventIds = (this.database.prepare('SELECT raw_event_id FROM event_aggregation_lineage WHERE group_id=? ORDER BY raw_event_id').all(group.group_id) as LineageRow[]).map((item) => item.raw_event_id); return { groupId: group.group_id, correlationKey: group.correlation_key, windowStartedAt: group.window_started_at, rawEventIds, count: rawEventIds.length }; }); }
}
