export interface RawMonitoringEvent {
  eventId: string;
  workspaceId: string;
  projectId: string;
  sourceId: string;
  sourceKey: string;
  eventType: string;
  occurredAt: string;
  payload: string;
  payloadDigest: string;
  createdAt: string;
}

export interface NormalizedMonitoringEvent {
  normalizedEventId: string;
  rawEventId: string;
  schemaVersion: number;
  workspaceId: string;
  projectId: string;
  eventType: string;
  occurredAt: string;
  payload: string;
  payloadDigest: string;
  createdAt: string;
}

const sha256Digest = /^sha256:[a-f0-9]{64}$/;

function requireText(value: string, reason: string): void {
  if (!value.trim()) throw new Error(reason);
}

function validateDigest(value: string): void {
  if (!sha256Digest.test(value)) throw new Error('MONITORING_PAYLOAD_DIGEST_INVALID');
}

export function createRawMonitoringEvent(input: RawMonitoringEvent): Readonly<RawMonitoringEvent> {
  requireText(input.sourceId, 'MONITORING_SOURCE_ID_REQUIRED');
  requireText(input.sourceKey, 'MONITORING_SOURCE_KEY_REQUIRED');
  requireText(input.eventId, 'MONITORING_EVENT_ID_REQUIRED');
  requireText(input.workspaceId, 'MONITORING_WORKSPACE_REQUIRED');
  requireText(input.projectId, 'MONITORING_PROJECT_REQUIRED');
  requireText(input.eventType, 'MONITORING_EVENT_TYPE_REQUIRED');
  validateDigest(input.payloadDigest);
  return Object.freeze({ ...input });
}

export function createNormalizedMonitoringEvent(input: NormalizedMonitoringEvent): Readonly<NormalizedMonitoringEvent> {
  requireText(input.normalizedEventId, 'MONITORING_NORMALIZED_EVENT_ID_REQUIRED');
  requireText(input.rawEventId, 'MONITORING_RAW_EVENT_ID_REQUIRED');
  requireText(input.workspaceId, 'MONITORING_WORKSPACE_REQUIRED');
  requireText(input.projectId, 'MONITORING_PROJECT_REQUIRED');
  requireText(input.eventType, 'MONITORING_EVENT_TYPE_REQUIRED');
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) throw new Error('MONITORING_SCHEMA_VERSION_INVALID');
  validateDigest(input.payloadDigest);
  return Object.freeze({ ...input });
}
