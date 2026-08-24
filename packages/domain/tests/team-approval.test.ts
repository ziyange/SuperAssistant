import { expect, test } from 'vitest';
import { createTeamApprovalPolicy, isEligibleApprover } from '../src/team-approval.js';

test('freezes a proposal-version-bound quorum policy and excludes requester', () => {
  const policy = createTeamApprovalPolicy({ proposalDigest: 'sha256:abc', policyVersion: 'v1', requester: 'requester', eligibleApprovers: ['a', 'b', 'requester'], quorum: 2 });
  expect(Object.isFrozen(policy)).toBe(true);
  expect(isEligibleApprover(policy, 'a')).toBe(true);
  expect(isEligibleApprover(policy, 'requester')).toBe(false);
});
