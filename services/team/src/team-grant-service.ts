/* eslint-disable no-unused-vars -- Team grant port parameters are public contract vocabulary. */
export interface TeamGrantIssue {
  workspaceId: string;
  requester: string;
  proposalDigest: `sha256:${string}`;
  approvers: readonly string[];
}

export interface TeamGrantRecord extends TeamGrantIssue {
  ref: `grant:${string}`;
  consumedAt?: number;
}

export type TeamGrantConsumption =
  | Readonly<{ consumed: true }>
  | Readonly<{ consumed: false; reason: 'GRANT_NOT_FOUND' | 'GRANT_BINDING_DENIED' | 'GRANT_ALREADY_CONSUMED' }>;

/** An in-process reference implementation; durable issuance is added through the Team authority repository. */
export class TeamGrantService {
  private readonly records = new Map<string, TeamGrantRecord>();

  constructor(private readonly nextRef: () => `grant:${string}`, private readonly now: () => number = () => Date.now()) {}

  issue(input: TeamGrantIssue): TeamGrantRecord {
    if (!/^sha256:[a-f0-9]+$/.test(input.proposalDigest) || input.workspaceId.length === 0 || input.requester.length === 0 || new Set(input.approvers).size !== input.approvers.length || input.approvers.includes(input.requester)) {
      throw new Error('TEAM_GRANT_INVALID');
    }
    const ref = this.nextRef();
    if (this.records.has(ref)) throw new Error('TEAM_GRANT_REFERENCE_EXISTS');
    const record = Object.freeze({ ref, workspaceId: input.workspaceId, requester: input.requester, proposalDigest: input.proposalDigest, approvers: Object.freeze([...input.approvers]) });
    this.records.set(ref, record);
    return record;
  }

  consume(ref: string, binding: Readonly<{ workspaceId: string; requester: string; proposalDigest: string }>): TeamGrantConsumption {
    const record = this.records.get(ref);
    if (record === undefined) return { consumed: false, reason: 'GRANT_NOT_FOUND' };
    if (record.consumedAt !== undefined) return { consumed: false, reason: 'GRANT_ALREADY_CONSUMED' };
    if (record.workspaceId !== binding.workspaceId || record.requester !== binding.requester || record.proposalDigest !== binding.proposalDigest) {
      return { consumed: false, reason: 'GRANT_BINDING_DENIED' };
    }
    this.records.set(ref, Object.freeze({ ...record, consumedAt: this.now() }));
    return { consumed: true };
  }
}

export interface TeamGrantStore {
  issueGrant(input: TeamGrantIssue): Promise<TeamGrantRecord>;
  consumeGrant(ref: string, binding: Readonly<{ workspaceId: string; requester: string; proposalDigest: string }>): Promise<TeamGrantConsumption>;
}

export class PersistentTeamGrantService {
  constructor(private readonly store: TeamGrantStore) {}

  async issue(input: TeamGrantIssue): Promise<TeamGrantRecord> {
    if (!/^sha256:[a-f0-9]+$/.test(input.proposalDigest) || input.workspaceId.length === 0 || input.requester.length === 0 || new Set(input.approvers).size !== input.approvers.length || input.approvers.includes(input.requester)) {
      throw new Error('TEAM_GRANT_INVALID');
    }
    return this.store.issueGrant(input);
  }

  async consume(ref: string, binding: Readonly<{ workspaceId: string; requester: string; proposalDigest: string }>): Promise<TeamGrantConsumption> {
    return this.store.consumeGrant(ref, binding);
  }
}
