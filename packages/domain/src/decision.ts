import type { QuestionLevel } from './question-router.js';

export type DecisionOption = 'ALLOW' | 'DENY';
export interface DecisionInput {
  decisionId: string; workspaceId: string; projectId: string; taskId: string; workItemId: string;
  question: string; level: Extract<QuestionLevel, 'L3' | 'L4'>; createdAt: string;
}
export interface DecisionResolution { resolutionId: string; idempotencyKey: string; actorId: string; option: DecisionOption; resolvedAt: string; }
export interface Decision extends DecisionInput { fingerprint: string; status: 'OPEN' | 'RESOLVED'; resolution?: DecisionResolution; }

export function createDecision(input: DecisionInput): Decision {
  if (!input.question.trim()) throw new Error('Decision question must not be empty.');
  return { ...input, question: input.question.trim(), fingerprint: fingerprintFor(input), status: 'OPEN' };
}

export function resolveDecision(decision: Decision, resolution: DecisionResolution): Decision {
  if (decision.status === 'RESOLVED') {
    if (decision.resolution?.idempotencyKey === resolution.idempotencyKey) return decision;
    throw new Error('Decision is already resolved');
  }
  return { ...decision, status: 'RESOLVED', resolution: { ...resolution } };
}

function fingerprintFor(input: DecisionInput): string {
  return [input.workspaceId, input.projectId, input.taskId, input.workItemId, input.level, input.question.trim().toLocaleLowerCase()].join('|');
}
