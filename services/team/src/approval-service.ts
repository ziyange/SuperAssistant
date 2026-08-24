/* eslint-disable no-unused-vars -- Team approval port parameters are public contract vocabulary. */
export interface TeamApprovalPolicy {
  workspaceId: string;
  proposalDigest: `sha256:${string}`;
  policyVersion: string;
  requester: string;
  eligibleApprovers: readonly string[];
  quorum: number;
}

type ApprovalState = { policy: TeamApprovalPolicy; approvers: Set<string>; grantRef?: `grant:${string}` };

export type TeamApprovalResult =
  | Readonly<{ state: 'DENIED'; reason: 'APPROVER_INELIGIBLE' }>
  | Readonly<{ state: 'PENDING'; approvals: number }>
  | Readonly<{ state: 'GRANTED'; grantRef: `grant:${string}`; approvals: number }>;

/** Enforces separation of duties and distinct quorum before a Grant reference exists. */
export class ApprovalService {
  private readonly states = new Map<string, ApprovalState>();

  constructor(private readonly nextGrantRef: () => `grant:${string}`) {}

  open(policy: TeamApprovalPolicy): void {
    const eligibleApprovers = [...new Set(policy.eligibleApprovers)];
    if (this.states.has(policy.proposalDigest) || policy.quorum < 1 || policy.quorum > eligibleApprovers.length || eligibleApprovers.includes(policy.requester)) {
      throw new Error('APPROVAL_POLICY_INVALID');
    }
    this.states.set(policy.proposalDigest, { policy: Object.freeze({ ...policy, eligibleApprovers: Object.freeze(eligibleApprovers) }), approvers: new Set() });
  }

  async approve(proposalDigest: string, approver: string): Promise<TeamApprovalResult> {
    const state = this.states.get(proposalDigest);
    if (state === undefined || approver === state.policy.requester || !state.policy.eligibleApprovers.includes(approver)) {
      return { state: 'DENIED', reason: 'APPROVER_INELIGIBLE' };
    }
    if (state.grantRef !== undefined) return { state: 'GRANTED', grantRef: state.grantRef, approvals: state.approvers.size };
    state.approvers.add(approver);
    if (state.approvers.size < state.policy.quorum) return { state: 'PENDING', approvals: state.approvers.size };
    state.grantRef = this.nextGrantRef();
    return { state: 'GRANTED', grantRef: state.grantRef, approvals: state.approvers.size };
  }
}

export interface TeamApprovalStore {
  openApproval(policy: TeamApprovalPolicy): Promise<void>;
  approveAndIssue(input: Readonly<{ proposalDigest: string; approver: string }>): Promise<TeamApprovalResult>;
}

/** The store operation must atomically record a distinct approval and issue the one Grant. */
export class PersistentApprovalService {
  constructor(private readonly store: TeamApprovalStore) {}

  async open(policy: TeamApprovalPolicy): Promise<void> {
    const distinct = [...new Set(policy.eligibleApprovers)];
    if (policy.policyVersion.length === 0 || policy.quorum < 1 || policy.quorum > distinct.length || distinct.includes(policy.requester)) throw new Error('APPROVAL_POLICY_INVALID');
    await this.store.openApproval({ ...policy, eligibleApprovers: Object.freeze(distinct) });
  }

  async approve(proposalDigest: string, approver: string): Promise<TeamApprovalResult> {
    return this.store.approveAndIssue({ proposalDigest, approver });
  }
}
