/* eslint-disable no-unused-vars -- interface parameter names describe the public port contract. */
import type { Decision } from '@super-assistant/domain';

export interface DecisionReadPort { get(decisionId: string): Decision | null; listForTask?(taskId: string): readonly Decision[]; }

export function projectDecisionForRenderer(port: DecisionReadPort, input: { decisionId: string }): { decisionId: string; taskId: string; question: string; level: 'L3' | 'L4'; status: 'OPEN' | 'RESOLVED' } {
  const decision = port.get(input.decisionId);
  if (!decision) throw new Error('DECISION_NOT_FOUND');
  return { decisionId: decision.decisionId, taskId: decision.taskId, question: decision.question, level: decision.level, status: decision.status };
}

export function listDecisionsForRenderer(port: DecisionReadPort, input: { taskId: string }): readonly { decisionId: string; taskId: string; question: string; level: 'L3' | 'L4'; status: 'OPEN' | 'RESOLVED' }[] {
  if (!port.listForTask) throw new Error('Decision list is unavailable.');
  return port.listForTask(input.taskId).map((decision) => ({ decisionId: decision.decisionId, taskId: decision.taskId, question: decision.question, level: decision.level, status: decision.status }));
}
