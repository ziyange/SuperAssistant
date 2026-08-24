import { expect, test } from 'vitest';
import { ApprovalService } from '../src/approval-service.js';
import { PersistentApprovalService } from '../src/approval-service.js';

test('requires distinct eligible approvers and returns one Grant after quorum', async () => {
  const approvals = new ApprovalService(() => 'grant:sha256:quorum');
  approvals.open({ workspaceId: 'workspace-a', proposalDigest: 'sha256:proposal-a', policyVersion: 'v1', requester: 'requester', eligibleApprovers: ['a', 'b'], quorum: 2 });

  expect(await approvals.approve('sha256:proposal-a', 'requester')).toEqual({ state: 'DENIED', reason: 'APPROVER_INELIGIBLE' });
  expect(await approvals.approve('sha256:proposal-a', 'a')).toEqual({ state: 'PENDING', approvals: 1 });
  expect(await approvals.approve('sha256:proposal-a', 'a')).toEqual({ state: 'PENDING', approvals: 1 });
  expect(await approvals.approve('sha256:proposal-a', 'b')).toEqual({ state: 'GRANTED', grantRef: 'grant:sha256:quorum', approvals: 2 });
  expect(await approvals.approve('sha256:proposal-a', 'b')).toEqual({ state: 'GRANTED', grantRef: 'grant:sha256:quorum', approvals: 2 });
});

test('delegates quorum approval and Grant issuance to one durable transition', async () => {
  const approvals = new PersistentApprovalService({
    async openApproval() {},
    async approveAndIssue(input) { return input.approver === 'a' ? { state: 'PENDING' as const, approvals: 1 } : { state: 'GRANTED' as const, grantRef: 'grant:sha256:durable' as const, approvals: 2 }; }
  });
  await approvals.open({ workspaceId: 'workspace-a', proposalDigest: 'sha256:aaaaaaaa', policyVersion: 'v1', requester: 'requester', eligibleApprovers: ['a', 'b'], quorum: 2 });
  await expect(approvals.approve('sha256:aaaaaaaa', 'a')).resolves.toEqual({ state: 'PENDING', approvals: 1 });
  await expect(approvals.approve('sha256:aaaaaaaa', 'b')).resolves.toEqual({ state: 'GRANTED', grantRef: 'grant:sha256:durable', approvals: 2 });
});
