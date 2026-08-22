import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteMonitoringEventRepository } from '../src/repositories/monitoring-event-repository.js';

const raw = {
  eventId: 'raw-1', workspaceId: 'workspace-1', projectId: 'project-1', sourceId: 'source-1',
  sourceKey: 'delivery-1', eventType: 'BUILD_FAILED', occurredAt: '2026-08-22T00:00:00.000Z',
  payload: '{"status":"failed"}', payloadDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  createdAt: '2026-08-22T00:00:01.000Z'
} as const;

test('persists one immutable raw event for a duplicate source key and retains normalized lineage', () => {
  const database = createFoundationDatabase(':memory:');
  const repository = new SqliteMonitoringEventRepository(database);
  expect(repository.appendRaw(raw)).toEqual(raw);
  expect(repository.appendRaw({ ...raw, eventId: 'raw-2' })).toEqual(raw);
  const normalized = repository.appendNormalized({
    normalizedEventId: 'normalized-1', rawEventId: raw.eventId, schemaVersion: 1,
    workspaceId: raw.workspaceId, projectId: raw.projectId, eventType: raw.eventType,
    occurredAt: raw.occurredAt, payload: '{"kind":"build"}', payloadDigest: raw.payloadDigest,
    createdAt: raw.createdAt
  });
  expect(normalized.rawEventId).toBe(raw.eventId);
  expect(repository.listRaw(raw.workspaceId, raw.projectId)).toEqual([raw]);
  expect(repository.listNormalized(raw.eventId)).toEqual([normalized]);
  expect(() => database.prepare("UPDATE raw_monitoring_events SET event_type = 'CHANGED'").run()).toThrow(/immutable/);
  expect(() => database.prepare('DELETE FROM normalized_monitoring_events').run()).toThrow(/immutable/);
  database.close();
});
