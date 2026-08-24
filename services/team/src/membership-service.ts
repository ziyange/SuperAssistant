/* eslint-disable no-unused-vars -- membership service parameters are public Team contract vocabulary. */
export type MembershipRole = 'MEMBER' | 'ADMIN' | 'AUDITOR';
interface Invitation { workspaceId: string; email: string; role: MembershipRole; expiresAt: number; accepted: boolean }
export interface TeamMembership { workspaceId: string; subject: string; role: MembershipRole }

export class TeamMembershipService {
  private readonly invitations = new Map<string, Invitation>();
  private readonly memberships = new Map<string, TeamMembership>();
  constructor(private readonly nextId: () => string) {}
  invite(input: Readonly<{ workspaceId: string; email: string; role: MembershipRole; expiresAt: number }>): `invite:${string}` {
    if (!input.email.includes('@') || input.workspaceId.length === 0 || input.expiresAt < 1) throw new Error('INVITATION_INVALID');
    const ref = `invite:${this.nextId()}` as const;
    if (this.invitations.has(ref)) throw new Error('INVITATION_REPLAY');
    this.invitations.set(ref, { ...input, accepted: false });
    return ref;
  }
  accept(ref: string, subject: string, now: number): TeamMembership {
    const invitation = this.invitations.get(ref);
    if (invitation === undefined || invitation.accepted) throw new Error('INVITATION_UNKNOWN');
    if (invitation.email !== subject) throw new Error('INVITATION_PRINCIPAL_DENIED');
    if (invitation.expiresAt <= now) throw new Error('INVITATION_EXPIRED');
    invitation.accepted = true;
    const membership = { workspaceId: invitation.workspaceId, subject, role: invitation.role } as const;
    this.memberships.set(`${membership.workspaceId}:${membership.subject}`, membership);
    return membership;
  }
  list(workspaceId: string): readonly TeamMembership[] { return [...this.memberships.values()].filter(membership => membership.workspaceId === workspaceId); }
}

export interface PersistentMembershipStore { addMembership(record: TeamMembership): Promise<void>; listMemberships(workspaceId: string): Promise<readonly TeamMembership[]> }

export class PersistentTeamMembershipService {
  constructor(private readonly store: PersistentMembershipStore, private readonly nextId: () => string) {}
  private readonly invitations = new Map<string, Invitation>();
  invite(input: Readonly<{ workspaceId: string; email: string; role: MembershipRole; expiresAt: number }>): `invite:${string}` {
    const ref = `invite:${this.nextId()}` as const;
    this.invitations.set(ref, { ...input, accepted: false });
    return ref;
  }
  async accept(ref: string, subject: string, now: number): Promise<TeamMembership> {
    const invitation = this.invitations.get(ref);
    if (invitation === undefined || invitation.accepted) throw new Error('INVITATION_UNKNOWN');
    if (invitation.email !== subject || invitation.expiresAt <= now) throw new Error('INVITATION_PRINCIPAL_DENIED');
    invitation.accepted = true;
    const membership = { workspaceId: invitation.workspaceId, subject, role: invitation.role } as const;
    await this.store.addMembership(membership);
    return membership;
  }
}
