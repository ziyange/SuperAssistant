export type QuestionRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type QuestionLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface QuestionInput { question: string; risk: QuestionRisk; }
export interface QuestionRoute { level: QuestionLevel; requiresDecision: boolean; }

export function classifyQuestion(input: QuestionInput): QuestionRoute {
  if (input.question.trim().length === 0) throw new Error('Question must not be empty.');
  if (input.risk === 'LOW') return { level: 'L1', requiresDecision: false };
  if (input.risk === 'MEDIUM') return { level: 'L2', requiresDecision: false };
  return input.risk === 'HIGH' ? { level: 'L3', requiresDecision: true } : { level: 'L4', requiresDecision: true };
}
