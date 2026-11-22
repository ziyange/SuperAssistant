import { expect, test } from 'vitest';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { ImmutableProposalConfirmation } from '../../src/main/immutable-proposal-confirmation.js';

const candidate = {
  objective: 'Update', workspaceId: 'workspace', projectId: 'project', agentId: 'agent', functionId: 'function',
  projectSnapshotVersion: '1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1',
  baselineCommit: 'a'.repeat(40), createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z', deadlineAt: '2027-01-01T00:00:00.000Z',
  budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'code', version: '1' }],
  workItems: [{ id: 'work', projectId: 'project', agentId: 'agent', functionId: 'function', objective: 'Update', required: true, dependencies: [] }],
  resources: [{ key: 'project:project', intent: 'WRITE' as const }], allowedActions: ['FILE_WRITE' as const],
  forbiddenActions: [], reconfirmationTriggers: ['change'], risk: 'HIGH' as const,
  acceptanceCriteria: [{ criterion: 'passes', evidence: 'test log' }]
};

test('confirms only an unchanged full persisted review and displays every field', async () => {
  let review = createH1ReviewedProposal('review-1', candidate);
  let displayed = '';
  const confirmation = new ImmutableProposalConfirmation(() => review, async text => { displayed = text; return true; });
  expect(await confirmation.confirm('review-1', review.digest)).toBe(true);
  expect(JSON.parse(displayed)).toEqual(review.fullReview);
  expect(await confirmation.confirm('review-1', 'sha256:' + '0'.repeat(64))).toBe(false);
  const changed = new ImmutableProposalConfirmation(() => review, async () => {
    review = createH1ReviewedProposal('review-1', { ...candidate, objective: 'Different' });
    return true;
  });
  const original = createH1ReviewedProposal('review-1', candidate);
  expect(await changed.confirm('review-1', original.digest)).toBe(false);
});

test('waits for asynchronous authority checks before and after native review', async () => {
  const review = createH1ReviewedProposal('review-async', candidate);
  let reads = 0;
  const confirmation = new ImmutableProposalConfirmation(async () => { reads += 1; return review; }, async () => true);
  expect(await confirmation.confirm('review-async', review.digest)).toBe(true);
  expect(reads).toBe(2);
});

test('rejects a second concurrent confirmation while a dialog is open', async () => {
  const review = createH1ReviewedProposal('review-2', candidate);
  const other = createH1ReviewedProposal('review-other', candidate);
  // eslint-disable-next-line no-unused-vars -- assigned by the pending Promise.
  let finish: (value: boolean) => void = () => {};
  const confirmation = new ImmutableProposalConfirmation(id => id === 'review-2' ? review : other, () => new Promise(resolve => { finish = resolve; }));
  const first = confirmation.confirm('review-2', review.digest);
  expect(await confirmation.confirm('review-2', review.digest)).toBe(false);
  expect(await confirmation.confirm('review-other', other.digest)).toBe(false);
  finish(true);
  expect(await first).toBe(true);
});

test('rejects altered persisted data, missing reviews, and dismissed dialogs', async () => {
  const valid = createH1ReviewedProposal('review-3', candidate);
  if (!valid.fullReview) throw new Error('Expected full review');
  const altered = { ...valid, fullReview: { ...valid.fullReview, objective: 'tampered' } };
  const corrupt = new ImmutableProposalConfirmation(() => altered, async () => true);
  expect(await corrupt.confirm('review-3', valid.digest)).toBe(false);
  const missing = new ImmutableProposalConfirmation(() => null, async () => true);
  expect(await missing.confirm('review-3', valid.digest)).toBe(false);
  const dismissed = new ImmutableProposalConfirmation(() => valid, async () => false);
  expect(await dismissed.confirm('review-3', valid.digest)).toBe(false);
});

test('rejects a review that cannot be displayed completely or contains bidi controls', async () => {
  for (const objective of ['x'.repeat(9000), 'safe\u202Eexe.txt']) {
    const proposal = createH1ReviewedProposal('review-4', { ...candidate, objective });
    let shown = false;
    const confirmation = new ImmutableProposalConfirmation(() => proposal, async () => { shown = true; return true; });
    expect(await confirmation.confirm('review-4', proposal.digest)).toBe(false);
    expect(shown).toBe(false);
  }
});

test('does not show or approve an expired review', async () => {
  const expired = createH1ReviewedProposal('review-5', { ...candidate,
    createdAt: '2000-01-01T00:00:00.000Z', expiresAt: '2000-01-02T00:00:00.000Z',
    deadlineAt: '2000-01-03T00:00:00.000Z' });
  let shown = false;
  const confirmation = new ImmutableProposalConfirmation(() => expired, async () => { shown = true; return true; });
  expect(await confirmation.confirm('review-5', expired.digest)).toBe(false);
  expect(shown).toBe(false);
});
