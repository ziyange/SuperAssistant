/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { OperationsAnalysis } from '../../src/renderer/operations-analysis.js';

test('renders analysis lineage and labels correlation without claiming causation', () => {
  render(<OperationsAnalysis analysis={{ kind: 'CORRELATION', value: 0.8, metric: 'deployments', datasetVersion: 'dataset-1', observedAt: '2026-08-22T00:00:00.000Z' }} />);
  expect(screen.getByText('Dataset version: dataset-1')).toBeTruthy();
  expect(screen.getByText('Correlation is not causation')).toBeTruthy();
});
