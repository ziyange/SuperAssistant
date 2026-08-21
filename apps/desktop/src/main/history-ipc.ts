/* eslint-disable no-unused-vars -- scope parameter names document the read boundary. */
import type { Activity, HumanHistory, ProjectChange } from '@super-assistant/domain';

export interface HistoryReadPort {
  listForTask(scope: { workspaceId: string; projectId: string; taskId: string }): { activity: readonly Activity[]; human: readonly HumanHistory[] };
}

export interface ProjectChangeReadPort {
  listForProject(scope: { workspaceId: string; projectId: string }): readonly ProjectChange[];
}

export function projectHistoryForRenderer(port: HistoryReadPort, scope: { workspaceId: string; projectId: string; taskId: string }) {
  const records = port.listForTask(scope);
  return { activity: records.activity.map(({ activityId, attemptId, sequence, eventType, occurredAt }) => ({ activityId, attemptId, sequence, eventType, occurredAt })), human: records.human.map(({ historyId, decisionId, actorId, action, occurredAt }) => ({ historyId, ...(decisionId ? { decisionId } : {}), actorId, action, occurredAt })) };
}

export function projectChangesForRenderer(port: ProjectChangeReadPort, scope: { workspaceId: string; projectId: string }) {
  return port.listForProject(scope).map(({ changeId, taskId, resourceKey, baselineRevision, resultRevision, status, originalChangeId, createdAt }) => ({ changeId, taskId, resourceKey, baselineRevision, resultRevision, status, ...(originalChangeId ? { originalChangeId } : {}), createdAt }));
}
