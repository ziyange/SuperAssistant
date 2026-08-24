import { expect, test } from 'vitest';
import { ApprovalQuorum } from '../src/approval-quorum.js';

test('issues one Grant only after distinct qualified approvers reach quorum', async () => {
  const approvals = new ApprovalQuorum(() => 'grant-fixed');
  approvals.open({ proposalDigest: 'sha256:abc', policyVersion: 'v1', requester: 'requester', eligibleApprovers: ['a', 'b', 'requester'], quorum: 2 });
  expect(await approvals.approve('sha256:abc', 'requester')).toEqual({ state: 'DENIED', reason: 'APPROVER_INELIGIBLE' });
  expect(await approvals.approve('sha256:abc', 'a')).toEqual({ state: 'PENDING', approvals: 1 });
  expect(await approvals.approve('sha256:abc', 'a')).toEqual({ state: 'PENDING', approvals: 1 });
  expect(await approvals.approve('sha256:abc', 'b')).toEqual({ state: 'GRANTED', grantRef: 'grant-fixed', approvals: 2 });
});

test('concurrent replay resolves to one immutable Grant', async () => {
  const approvals = new ApprovalQuorum(() => 'grant-once');
  approvals.open({ proposalDigest: 'sha256:def', policyVersion: 'v1', requester: 'requester', eligibleApprovers: ['a', 'b'], quorum: 2 });
  await approvals.approve('sha256:def', 'a');
  const results = await Promise.all([approvals.approve('sha256:def', 'b'), approvals.approve('sha256:def', 'b')]);
  expect(results).toEqual([{ state: 'GRANTED', grantRef: 'grant-once', approvals: 2 }, { state: 'GRANTED', grantRef: 'grant-once', approvals: 2 }]);
});
