export function QualityEvidence({ evidence }: Readonly<{ evidence: Readonly<{ role: 'TESTER' | 'INSPECTOR'; evaluator: string; outcome: 'ACCEPTED' | 'REJECTED'; remediationFor?: string }> }>) {
  return <section aria-label="Quality evidence"><p>{evidence.role} evidence by {evidence.evaluator}: {evidence.outcome}</p>{evidence.outcome === 'REJECTED' && evidence.remediationFor ? <p>Repair Work Item: {evidence.remediationFor}</p> : null}</section>;
}
