import type { ExecutionAttemptState } from './execution-attempt.js';
import { resolveDecision, type Decision, type DecisionResolution } from './decision.js';

export interface DecisionResumeCommand {
  decisionId: string;
  workItemId: string;
  resolutionId: string;
}

export function resolveDecisionAndPrepareResume(
  decision: Decision,
  resolution: DecisionResolution,
  attemptState: ExecutionAttemptState | 'WAITING_USER',
  authorizationActive: boolean
): { decision: Decision; resume?: DecisionResumeCommand } {
  if (attemptState === 'UNKNOWN' || attemptState === 'RECONCILING') {
    throw new Error('Attempt must reconcile before a Decision can resume work');
  }

  const resolved = resolveDecision(decision, resolution);
  if (resolved === decision || !authorizationActive) return { decision: resolved };
  return {
    decision: resolved,
    resume: { decisionId: resolved.decisionId, workItemId: resolved.workItemId, resolutionId: resolution.resolutionId }
  };
}
