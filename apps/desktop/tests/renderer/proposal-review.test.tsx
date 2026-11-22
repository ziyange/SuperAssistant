// @vitest-environment jsdom
/* eslint-disable no-unused-vars -- test callback parameter names describe the promise contract. */
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

test('creates a review-only draft from user text and opens native review', async () => {
  const calls: unknown[] = [];
  render(<ProposalPreparation projects={[{ id: 'project-1', name: 'Project', status: 'ACTIVE' }]}
    readContext={async () => ({ proposalContext: { status: 'LIVE_VERIFICATION_REQUIRED' } })}
    createDraft={async input => { calls.push(input); return { proposalDraft: { status: 'CREATED', draftId: 'draft-1' } }; }}
    reviewDraft={async id => { calls.push(id); return { proposalReview: 'REVIEWED_ONLY' }; }} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Project for proposal' }), { target: { value: 'project-1' } });
  fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Write report' } });
  fireEvent.change(screen.getByLabelText('Acceptance criterion'), { target: { value: 'Report exists' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create and review draft' }));
  expect(await screen.findByText(/Reviewed only/)).toBeInTheDocument();
  expect(calls).toEqual([{ projectId: 'project-1', objective: 'Write report', criterion: 'Report exists' }, 'draft-1']);
  expect(screen.getByRole('button', { name: 'Confirm proposal' })).toBeDisabled();
});

test('suppresses duplicate draft submissions and does not expose backend errors', async () => {
  let rejectDraft: (error: Error) => void = () => { throw new Error('Missing callback'); };
  let calls = 0;
  render(<ProposalPreparation projects={[{ id: 'project-1', name: 'Project', status: 'ACTIVE' }]}
    createDraft={() => { calls += 1; return new Promise((_resolve, reject) => { rejectDraft = reject; }); }}
    reviewDraft={async () => ({ proposalReview: 'REVIEWED_ONLY' })} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Project for proposal' }), { target: { value: 'project-1' } });
  fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Write report' } });
  fireEvent.change(screen.getByLabelText('Acceptance criterion'), { target: { value: 'Report exists' } });
  const button = screen.getByRole('button', { name: 'Create and review draft' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(calls).toBe(1);
  expect(button).toBeDisabled();
  await act(async () => rejectDraft(new Error('C:/private/path')));
  expect(await screen.findByText(/Draft or review unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/C:\/private/)).not.toBeInTheDocument();
});

test('blocks confirmation when preflight is stale', () => {
  render(<ProposalReview objective="Write report" classification="SIDE_EFFECTING" preflight="STALE" onConfirm={() => undefined} />);
  expect(screen.getByRole('button', { name: 'Confirm proposal' })).toBeDisabled();
  expect(screen.getByText('Preflight must be refreshed')).toBeInTheDocument();
});
