export interface TeamApprovalPolicy { proposalDigest: string; policyVersion: string; requester: string; eligibleApprovers: readonly string[]; quorum: number }
export function createTeamApprovalPolicy(input: TeamApprovalPolicy): Readonly<TeamApprovalPolicy> {
  const eligibleApprovers = [...new Set(input.eligibleApprovers.filter(approver => approver !== input.requester))].sort();
  if (!/^sha256:[a-f0-9]+$/.test(input.proposalDigest) || input.policyVersion.length === 0 || !Number.isInteger(input.quorum) || input.quorum < 1 || input.quorum > eligibleApprovers.length) throw new Error('APPROVAL_POLICY_INVALID');
  return Object.freeze({ ...input, eligibleApprovers: Object.freeze(eligibleApprovers) });
}
export function isEligibleApprover(policy: Readonly<TeamApprovalPolicy>, principal: string): boolean { return principal !== policy.requester && policy.eligibleApprovers.includes(principal); }
