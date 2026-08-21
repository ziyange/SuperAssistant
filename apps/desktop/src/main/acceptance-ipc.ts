/* eslint-disable no-unused-vars -- taskId is the public scoped read contract. */
import type { AcceptanceEvidence } from '@super-assistant/persistence';

export interface AcceptanceReadPort { listForTask(taskId: string): readonly AcceptanceEvidence[]; }

export function projectAcceptanceForRenderer(port: AcceptanceReadPort, input: { taskId: string }) {
  return port.listForTask(input.taskId).map(({ evidenceId, workItemId, attemptId, artifactVersionId, evaluatorId, outcome, createdAt }) => ({ evidenceId, workItemId, attemptId, artifactVersionId, evaluatorId, outcome, createdAt }));
}
