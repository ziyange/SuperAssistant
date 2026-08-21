export interface Activity {
  activityId: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  attemptId: string;
  sequence: number;
  eventType: string;
  occurredAt: string;
  actorId?: never;
}

export interface HumanHistory {
  historyId: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  decisionId?: string;
  actorId: string;
  action: 'PROPOSAL_CONFIRMED' | 'DECISION_RESOLVED';
  sourceVersion: string;
  occurredAt: string;
  attemptId?: never;
}

export function createActivity(input: Activity): Readonly<Activity> {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) throw new Error('ACTIVITY_SEQUENCE_INVALID');
  if (!input.eventType.trim()) throw new Error('ACTIVITY_EVENT_INVALID');
  return Object.freeze({ ...input });
}

export function createHumanHistory(input: HumanHistory): Readonly<HumanHistory> {
  if (!input.actorId.trim() || !input.sourceVersion.trim()) throw new Error('HUMAN_HISTORY_ATTRIBUTION_INVALID');
  return Object.freeze({ ...input });
}
