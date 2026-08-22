/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createNormalizedMonitoringEvent, createRawMonitoringEvent, type NormalizedMonitoringEvent, type RawMonitoringEvent } from '@super-assistant/domain';

export class SqliteMonitoringEventRepository {
  constructor(private readonly database: Database.Database) {}

  appendRaw(input: RawMonitoringEvent): Readonly<RawMonitoringEvent> {
    const event = createRawMonitoringEvent(input);
    this.database.prepare('INSERT OR IGNORE INTO raw_monitoring_events(event_id, workspace_id, project_id, source_id, source_key, event_type, occurred_at, payload, payload_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(event.eventId, event.workspaceId, event.projectId, event.sourceId, event.sourceKey, event.eventType, event.occurredAt, event.payload, event.payloadDigest, event.createdAt);
    return this.rawFromRow(this.database.prepare('SELECT * FROM raw_monitoring_events WHERE source_id = ? AND source_key = ?').get(event.sourceId, event.sourceKey) as Record<string, unknown>);
  }

  appendNormalized(input: NormalizedMonitoringEvent): Readonly<NormalizedMonitoringEvent> {
    const event = createNormalizedMonitoringEvent(input);
    this.database.prepare('INSERT OR IGNORE INTO normalized_monitoring_events(normalized_event_id, raw_event_id, schema_version, workspace_id, project_id, event_type, occurred_at, payload, payload_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(event.normalizedEventId, event.rawEventId, event.schemaVersion, event.workspaceId, event.projectId, event.eventType, event.occurredAt, event.payload, event.payloadDigest, event.createdAt);
    return this.normalizedFromRow(this.database.prepare('SELECT * FROM normalized_monitoring_events WHERE raw_event_id = ? AND schema_version = ?').get(event.rawEventId, event.schemaVersion) as Record<string, unknown>);
  }

  listRaw(workspaceId: string, projectId: string): readonly RawMonitoringEvent[] {
    return (this.database.prepare('SELECT * FROM raw_monitoring_events WHERE workspace_id = ? AND project_id = ? ORDER BY created_at, event_id').all(workspaceId, projectId) as Array<Record<string, unknown>>).map((row) => this.rawFromRow(row));
  }

  listNormalized(rawEventId: string): readonly NormalizedMonitoringEvent[] {
    return (this.database.prepare('SELECT * FROM normalized_monitoring_events WHERE raw_event_id = ? ORDER BY schema_version').all(rawEventId) as Array<Record<string, unknown>>).map((row) => this.normalizedFromRow(row));
  }

  private rawFromRow(row: Record<string, unknown>): Readonly<RawMonitoringEvent> {
    return createRawMonitoringEvent({ eventId: String(row.event_id), workspaceId: String(row.workspace_id), projectId: String(row.project_id), sourceId: String(row.source_id), sourceKey: String(row.source_key), eventType: String(row.event_type), occurredAt: String(row.occurred_at), payload: String(row.payload), payloadDigest: String(row.payload_digest), createdAt: String(row.created_at) });
  }

  private normalizedFromRow(row: Record<string, unknown>): Readonly<NormalizedMonitoringEvent> {
    return createNormalizedMonitoringEvent({ normalizedEventId: String(row.normalized_event_id), rawEventId: String(row.raw_event_id), schemaVersion: Number(row.schema_version), workspaceId: String(row.workspace_id), projectId: String(row.project_id), eventType: String(row.event_type), occurredAt: String(row.occurred_at), payload: String(row.payload), payloadDigest: String(row.payload_digest), createdAt: String(row.created_at) });
  }
}
