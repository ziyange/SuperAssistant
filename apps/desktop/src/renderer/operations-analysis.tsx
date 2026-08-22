import type { OperationsAnalysis as OperationsAnalysisModel } from '@super-assistant/domain';

export function OperationsAnalysis({ analysis }: Readonly<{ analysis: OperationsAnalysisModel }>) {
  return <section aria-label="Operations analysis"><h2>{analysis.kind}</h2><p>{analysis.metric}: {analysis.value}</p><p>Dataset version: {analysis.datasetVersion}</p><p>Observed: {analysis.observedAt}</p>{analysis.kind === 'CORRELATION' ? <p>Correlation is not causation</p> : null}</section>;
}
