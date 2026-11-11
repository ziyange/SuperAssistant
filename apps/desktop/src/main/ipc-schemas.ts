/* global Buffer */
import type { IpcRequest } from '../shared/ipc-contract.js';
import { isGoalAction } from '@super-assistant/domain';

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
  if ((value.channel === 'project:list' || value.channel === 'project:choose') && Object.keys(value.payload).length === 0) {
    return { channel: value.channel, payload: {} };
  }
  if (value.channel === 'project:assign-codex' && hasOnlyKeys(value.payload, ['projectId']) && typeof value.payload.projectId === 'string' && /^[a-z0-9_-]{1,128}$/i.test(value.payload.projectId)) {
    return { channel: 'project:assign-codex', payload: { projectId: value.payload.projectId } };
  }
  if (value.channel === 'codex:check' && Object.keys(value.payload).length === 0) {
    return { channel: 'codex:check', payload: {} };
  }
  if (value.channel === 'codex:registration' && Object.keys(value.payload).length === 0) {
    return { channel: 'codex:registration', payload: {} };
  }
  if (value.channel === 'onboarding:set' && hasOnlyKeys(value.payload, ['completed']) && typeof value.payload.completed === 'boolean') {
    return { channel: 'onboarding:set', payload: { completed: value.payload.completed } };
  }
  if (value.channel === 'proposal:classify' && hasOnlyKeys(value.payload, ['actions']) && Array.isArray(value.payload.actions) && value.payload.actions.length > 0 && Array.from(value.payload.actions).every(isGoalAction)) {
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
  if (value.channel === 'decision:get' && hasOnlyKeys(value.payload, ['decisionId']) && typeof value.payload.decisionId === 'string' && value.payload.decisionId.length > 0 && value.payload.decisionId.length <= 128) {
    return { channel: 'decision:get', payload: { decisionId: value.payload.decisionId } };
  }
  if (value.channel === 'decision:list' && hasOnlyKeys(value.payload, ['taskId']) && typeof value.payload.taskId === 'string' && value.payload.taskId.length > 0 && value.payload.taskId.length <= 128) {
    return { channel: 'decision:list', payload: { taskId: value.payload.taskId } };
  }
  if (value.channel === 'history:list' && hasOnlyKeys(value.payload, ['workspaceId', 'projectId', 'taskId']) && typeof value.payload.workspaceId === 'string' && typeof value.payload.projectId === 'string' && typeof value.payload.taskId === 'string' && value.payload.workspaceId.length > 0 && value.payload.workspaceId.length <= 128 && value.payload.projectId.length > 0 && value.payload.projectId.length <= 128 && value.payload.taskId.length > 0 && value.payload.taskId.length <= 128) {
    return { channel: 'history:list', payload: { workspaceId: String(value.payload.workspaceId), projectId: String(value.payload.projectId), taskId: String(value.payload.taskId) } };
  }
  if (value.channel === 'project-change:list' && hasOnlyKeys(value.payload, ['workspaceId', 'projectId']) && typeof value.payload.workspaceId === 'string' && typeof value.payload.projectId === 'string' && value.payload.workspaceId.length > 0 && value.payload.workspaceId.length <= 128 && value.payload.projectId.length > 0 && value.payload.projectId.length <= 128) {
    return { channel: 'project-change:list', payload: { workspaceId: String(value.payload.workspaceId), projectId: String(value.payload.projectId) } };
  }
  if (value.channel === 'acceptance:list' && hasOnlyKeys(value.payload, ['taskId']) && typeof value.payload.taskId === 'string' && value.payload.taskId.length > 0 && value.payload.taskId.length <= 128) return { channel: 'acceptance:list', payload: { taskId: value.payload.taskId } };
  if (value.channel === 'audit-export:create' && hasOnlyKeys(value.payload, ['workspaceId', 'projectId']) && typeof value.payload.workspaceId === 'string' && value.payload.workspaceId.length > 0 && value.payload.workspaceId.length <= 128 && typeof value.payload.projectId === 'string' && value.payload.projectId.length > 0 && value.payload.projectId.length <= 128) return { channel: 'audit-export:create', payload: { workspaceId: value.payload.workspaceId, projectId: value.payload.projectId } };
  if (value.channel === 'monitoring:status' && hasOnlyKeys(value.payload, ['projectId']) && typeof value.payload.projectId === 'string' && value.payload.projectId.length > 0 && value.payload.projectId.length <= 128) return { channel: 'monitoring:status', payload: { projectId: value.payload.projectId } };
  if (value.channel === 'team:workspace' && hasOnlyKeys(value.payload, ['workspaceId']) && typeof value.payload.workspaceId === 'string' && value.payload.workspaceId.length > 0 && value.payload.workspaceId.length <= 128) return { channel: 'team:workspace', payload: { workspaceId: value.payload.workspaceId } };
  throw new Error('IPC channel or payload is not allowed.');
}
