export interface QualityEvidence { taskId: string; workItemId: string; executorAgentId: string; evaluatorAgentId: string; role: 'TESTER' | 'INSPECTOR'; outcome: 'ACCEPTED' | 'REJECTED'; }

export function createQualityEvidence(input: QualityEvidence): Readonly<QualityEvidence> {
  if (input.evaluatorAgentId === input.executorAgentId) throw new Error('QUALITY_EVIDENCE_NOT_INDEPENDENT');
  return Object.freeze({ ...input });
}

export function remediationFromRejection(input: QualityEvidence): Readonly<{ taskId: string; remediationFor: string }> {
  const evidence = createQualityEvidence(input);
  if (evidence.outcome !== 'REJECTED') throw new Error('QUALITY_EVIDENCE_NOT_REJECTED');
  return { taskId: evidence.taskId, remediationFor: evidence.workItemId };
}
