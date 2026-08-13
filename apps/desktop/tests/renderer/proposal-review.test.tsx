// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProposalReview } from '../../src/renderer/proposal-review.js';

test('shows no confirmation affordance for a read-only query', () => {
  render(<ProposalReview objective="Inspect status" classification="READ_ONLY" preflight="READY" onConfirm={() => undefined} />);
  expect(screen.getByText('No authorization required')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm proposal' })).not.toBeInTheDocument();
});

test('blocks confirmation when preflight is stale', () => {
  render(<ProposalReview objective="Write report" classification="SIDE_EFFECTING" preflight="STALE" onConfirm={() => undefined} />);
  expect(screen.getByRole('button', { name: 'Confirm proposal' })).toBeDisabled();
  expect(screen.getByText('Preflight must be refreshed')).toBeInTheDocument();
});
