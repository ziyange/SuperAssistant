export interface RequiredWorkItemAcceptance { workItemId: string; accepted: boolean; evidenceCount: number; }
export type AcceptanceResult = Readonly<{ state: 'ACCEPTED' }> | Readonly<{ state: 'PENDING'; reason: 'MISSING_EVIDENCE' | 'OPEN_DECISION' }> | Readonly<{ state: 'REJECTED'; remediationFor: string }>;

export function deriveAcceptance(input: { requiredWorkItems: readonly RequiredWorkItemAcceptance[]; openDecisionCount: number }): AcceptanceResult {
  if (input.openDecisionCount > 0) return { state: 'PENDING', reason: 'OPEN_DECISION' };
  const rejected = input.requiredWorkItems.find((item) => !item.accepted);
  if (rejected) return { state: 'REJECTED', remediationFor: rejected.workItemId };
  if (input.requiredWorkItems.some((item) => item.evidenceCount < 1)) return { state: 'PENDING', reason: 'MISSING_EVIDENCE' };
  return { state: 'ACCEPTED' };
}
