import { expect, test } from 'vitest';
import { createOperationsAnalysis } from '../src/operations-analysis.js';

test('creates an operations conclusion with metric and dataset-version lineage', () => {
  expect(createOperationsAnalysis({ kind: 'TREND', value: 12, metric: 'deployments', datasetVersion: 'dataset-2026-08', observedAt: '2026-08-22T00:00:00.000Z' })).toEqual({ kind: 'TREND', value: 12, metric: 'deployments', datasetVersion: 'dataset-2026-08', observedAt: '2026-08-22T00:00:00.000Z' });
});

test('rejects a conclusion without verifiable lineage', () => {
  expect(() => createOperationsAnalysis({ kind: 'CORRELATION', value: 1, metric: '', datasetVersion: '', observedAt: 'bad' })).toThrow('OPERATIONS_ANALYSIS_INVALID');
});
