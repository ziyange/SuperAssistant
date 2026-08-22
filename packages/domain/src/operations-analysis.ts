export interface OperationsAnalysis {
  readonly kind: 'CURRENT' | 'TREND' | 'COMPARISON' | 'ANOMALY' | 'RANKING' | 'CORRELATION';
  readonly value: number;
  readonly metric: string;
  readonly datasetVersion: string;
  readonly observedAt: string;
}

export function createOperationsAnalysis(input: OperationsAnalysis): Readonly<OperationsAnalysis> {
  if (!Number.isFinite(input.value) || input.metric.trim().length === 0 || input.datasetVersion.trim().length === 0 || Number.isNaN(Date.parse(input.observedAt))) throw new Error('OPERATIONS_ANALYSIS_INVALID');
  return Object.freeze({ ...input });
}
