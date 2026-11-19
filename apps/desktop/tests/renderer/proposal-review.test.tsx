// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { IpcResponse } from '../../src/shared/ipc-contract.js';
import { ProposalPreparation, ProposalReview } from '../../src/renderer/proposal-review.js';

afterEach(cleanup);

test('preparation selects the exact Project and ignores a superseded response', async () => {
  const calls: string[] = [];
  let completeFirst: () => void = () => { throw new Error('Missing first request'); };
  const read = (projectId: string): Promise<IpcResponse> => {
    calls.push(projectId);
    if (projectId === 'alpha') return new Promise(resolve => {
      completeFirst = () => resolve({ proposalContext: { status: 'CODEX_REQUIRED' } });
    });
    if (projectId === 'gamma') return Promise.reject(new Error('Private database details'));
    return Promise.resolve({ proposalContext: { status: 'LIVE_VERIFICATION_REQUIRED' } });
  };
  render(<ProposalPreparation projects={[
    { id: 'alpha', name: 'Alpha', status: 'ACTIVE' },
    { id: 'beta', name: 'Beta', status: 'ACTIVE' },
    { id: 'gamma', name: 'Gamma', status: 'ACTIVE' },
    { id: 'paused', name: 'Paused Project', status: 'PAUSED' }
  ]} readContext={read} />);
  const selector = screen.getByRole('combobox', { name: 'Project for proposal' });
  expect(calls).toEqual([]);
  expect(screen.queryByRole('option', { name: 'Paused Project' })).not.toBeInTheDocument();
  fireEvent.change(selector, { target: { value: 'alpha' } });
  expect(screen.getByText('Checking Project prerequisites…')).toBeInTheDocument();
  fireEvent.change(selector, { target: { value: 'beta' } });
  expect(await screen.findByText(/Live verification is still required/)).toBeInTheDocument();
  await act(async () => { completeFirst(); });
  expect(screen.queryByText(/Assign a registered Codex/)).not.toBeInTheDocument();
  expect(screen.getByText(/Live verification is still required/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm proposal' })).toBeDisabled();
  fireEvent.change(selector, { target: { value: 'gamma' } });
  expect(await screen.findByText('Project prerequisites could not be checked.')).toBeInTheDocument();
  expect(screen.queryByText('Private database details')).not.toBeInTheDocument();
  expect(calls).toEqual(['alpha', 'beta', 'gamma']);
});

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
