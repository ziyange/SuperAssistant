export interface DecisionCenterModel { decisionId: string; taskId: string; question: string; level: 'L3' | 'L4'; status: 'OPEN' | 'RESOLVED'; }

export function DecisionCenter({ decision }: Readonly<{ decision: DecisionCenterModel }>) {
  return <section aria-label="Decision"><h2>Decision</h2><p>{decision.question}</p><p>Risk: {decision.level}</p><p>{decision.status === 'OPEN' ? 'Waiting for your decision. AI recommendation is not authorization.' : 'Decision resolved.'}</p></section>;
}
