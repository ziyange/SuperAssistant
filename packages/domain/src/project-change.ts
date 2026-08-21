export type ProjectChangeStatus = 'APPLIED' | 'FAILED' | 'UNKNOWN';

export interface ProjectChange {
  changeId: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  workItemId: string;
  attemptId: string;
  agentId: string;
  authorizationGrantId: string;
  resourceKey: string;
  baselineRevision: string;
  resultRevision: string;
  status: ProjectChangeStatus;
  createdAt: string;
  originalChangeId?: string;
}

export function createProjectChange(input: ProjectChange): Readonly<ProjectChange> {
  if (!input.resourceKey.trim() || !input.baselineRevision.trim() || !input.resultRevision.trim()) throw new Error('PROJECT_CHANGE_LINEAGE_INVALID');
  return Object.freeze({ ...input });
}

export function createCompensatingProjectChange(original: ProjectChange, input: Pick<ProjectChange, 'changeId' | 'resultRevision' | 'createdAt'>): Readonly<ProjectChange> {
  if (original.status !== 'APPLIED') throw new Error('CHANGE_NOT_COMPENSABLE');
  return createProjectChange({ ...original, ...input, originalChangeId: original.changeId, baselineRevision: original.resultRevision, status: 'APPLIED' });
}
