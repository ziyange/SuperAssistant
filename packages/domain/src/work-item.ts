export type WorkItemState = 'WAITING' | 'READY' | 'RUNNING' | 'BLOCKED' | 'ACCEPTANCE_PENDING' | 'ACCEPTED' | 'FAILED' | 'CANCELLED';

export interface WorkItem {
  workItemId: string;
  taskId: string;
  agentId: string;
  functionId: string;
  responsibilityVersion: string;
  state: WorkItemState;
  required: true;
}

export function createRequiredWorkItem(input: Omit<WorkItem, 'state' | 'required'>): WorkItem {
  return { ...input, required: true, state: 'WAITING' };
}

export function remediationWorkItem(input: Omit<WorkItem, 'state' | 'required'>): WorkItem {
  return { ...input, required: true, state: 'READY' };
}
