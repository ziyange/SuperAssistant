export function evaluateHrAction(input: Readonly<{ dataClassification: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'UNKNOWN'; intent: 'ANALYSIS' | 'EMPLOYMENT_ACTION'; hasHumanDecision: boolean }>): Readonly<{ allowed: boolean; reason?: 'DATA_CLASSIFICATION_REQUIRED' | 'HUMAN_DECISION_REQUIRED' }> {
  if (input.dataClassification === 'UNKNOWN') return { allowed: false, reason: 'DATA_CLASSIFICATION_REQUIRED' };
  if (input.intent === 'EMPLOYMENT_ACTION' && !input.hasHumanDecision) return { allowed: false, reason: 'HUMAN_DECISION_REQUIRED' };
  return { allowed: true };
}
