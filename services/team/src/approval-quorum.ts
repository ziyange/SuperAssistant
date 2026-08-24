/* eslint-disable no-unused-vars -- TypeScript approval contract parameters are public vocabulary. */
interface ApprovalPolicy { proposalDigest: string; policyVersion: string; requester: string; eligibleApprovers: readonly string[]; quorum: number }
interface ApprovalState { policy: ApprovalPolicy; approvers: Set<string>; grantRef?: string }
export class ApprovalQuorum {
  private readonly states = new Map<string, ApprovalState>();
  constructor(private readonly nextGrantRef: () => string) {}
  open(policy: ApprovalPolicy): void {
    if (this.states.has(policy.proposalDigest) || policy.quorum < 1) throw new Error('APPROVAL_POLICY_INVALID');
    this.states.set(policy.proposalDigest, { policy: Object.freeze({ ...policy, eligibleApprovers: Object.freeze([...new Set(policy.eligibleApprovers)]) }), approvers: new Set() });
  }
  async approve(proposalDigest: string, approver: string): Promise<Readonly<{ state: 'DENIED'; reason: 'APPROVER_INELIGIBLE' } | { state: 'PENDING'; approvals: number } | { state: 'GRANTED'; grantRef: string; approvals: number }>> {
    const state = this.states.get(proposalDigest);
    if (!state || approver === state.policy.requester || !state.policy.eligibleApprovers.includes(approver)) return { state: 'DENIED', reason: 'APPROVER_INELIGIBLE' };
    if (state.grantRef !== undefined) return { state: 'GRANTED', grantRef: state.grantRef, approvals: state.approvers.size };
    state.approvers.add(approver);
    if (state.approvers.size < state.policy.quorum) return { state: 'PENDING', approvals: state.approvers.size };
    state.grantRef = this.nextGrantRef();
    return { state: 'GRANTED', grantRef: state.grantRef, approvals: state.approvers.size };
  }
}
