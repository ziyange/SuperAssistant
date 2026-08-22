import { expect, test } from 'vitest';
import { createNormalizedMonitoringEvent, createRawMonitoringEvent } from '../src/monitoring-event.js';

const raw = {
  eventId: 'raw-1', workspaceId: 'workspace-1', projectId: 'project-1',
  sourceId: 'source-1', sourceKey: 'delivery-1', eventType: 'BUILD_FAILED',
  occurredAt: '2026-08-22T00:00:00.000Z', payload: '{"status":"failed"}',
  payloadDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  createdAt: '2026-08-22T00:00:01.000Z'
} as const;

test('creates immutable raw monitoring evidence with stable source lineage', () => {
  const event = createRawMonitoringEvent(raw);
  expect(event).toEqual(raw);
  expect(Object.isFrozen(event)).toBe(true);
});

test('rejects a raw event without a source idempotency key or valid digest', () => {
  expect(() => createRawMonitoringEvent({ ...raw, sourceKey: '' })).toThrow('MONITORING_SOURCE_KEY_REQUIRED');
  expect(() => createRawMonitoringEvent({ ...raw, payloadDigest: 'sha256:uppercase' })).toThrow('MONITORING_PAYLOAD_DIGEST_INVALID');
});

test('creates a normalized event bound to its raw evidence and schema version', () => {
  const event = createNormalizedMonitoringEvent({
    normalizedEventId: 'normalized-1', rawEventId: raw.eventId, schemaVersion: 1,
    workspaceId: raw.workspaceId, projectId: raw.projectId, eventType: raw.eventType,
    occurredAt: raw.occurredAt, payload: '{"kind":"build"}', payloadDigest: raw.payloadDigest,
    createdAt: raw.createdAt
  });
  expect(event.rawEventId).toBe(raw.eventId);
  expect(Object.isFrozen(event)).toBe(true);
});
