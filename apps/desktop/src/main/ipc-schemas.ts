/* global Buffer */
import type { IpcRequest } from '../shared/ipc-contract.js';

const MAX_IPC_BYTES = 1_048_576;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function validateRequest(value: unknown): IpcRequest {
  if (!isRecord(value) || Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_IPC_BYTES) {
    throw new Error('IPC request is malformed or oversized.');
  }
  if (!hasOnlyKeys(value, ['channel', 'payload']) || typeof value.channel !== 'string' || !isRecord(value.payload)) {
    throw new Error('IPC request has an unsupported shape.');
  }
  if (value.channel === 'onboarding:get' && Object.keys(value.payload).length === 0) {
    return { channel: 'onboarding:get', payload: {} };
  }
  if (value.channel === 'onboarding:set' && hasOnlyKeys(value.payload, ['completed']) && typeof value.payload.completed === 'boolean') {
    return { channel: 'onboarding:set', payload: { completed: value.payload.completed } };
  }
  if (value.channel === 'proposal:classify' && hasOnlyKeys(value.payload, ['actions']) && Array.isArray(value.payload.actions) && value.payload.actions.every((action) => typeof action === 'string')) {
    return { channel: 'proposal:classify', payload: { actions: value.payload.actions } };
  }
  if (value.channel === 'proposal:preflight' && hasOnlyKeys(value.payload, ['approved', 'current']) && isRecord(value.payload.approved) && isRecord(value.payload.current)) {
    return { channel: 'proposal:preflight', payload: { approved: value.payload.approved, current: value.payload.current } };
  }
  if (value.channel === 'task:get' && hasOnlyKeys(value.payload, ['taskId']) && typeof value.payload.taskId === 'string' && value.payload.taskId.length > 0 && value.payload.taskId.length <= 128) {
    return { channel: 'task:get', payload: { taskId: value.payload.taskId } };
  }
  if (value.channel === 'task:list' && Object.keys(value.payload).length === 0) {
    return { channel: 'task:list', payload: {} };
  }
  if (value.channel === 'artifact:get' && hasOnlyKeys(value.payload, ['artifactVersionId', 'authorizationGrantId', 'checksum'])
    && typeof value.payload.artifactVersionId === 'string' && value.payload.artifactVersionId.length > 0 && value.payload.artifactVersionId.length <= 128
    && typeof value.payload.authorizationGrantId === 'string' && value.payload.authorizationGrantId.length > 0 && value.payload.authorizationGrantId.length <= 128
    && typeof value.payload.checksum === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.payload.checksum)) {
    return { channel: 'artifact:get', payload: { artifactVersionId: value.payload.artifactVersionId, authorizationGrantId: value.payload.authorizationGrantId, checksum: value.payload.checksum } };
  }
  throw new Error('IPC channel or payload is not allowed.');
}
