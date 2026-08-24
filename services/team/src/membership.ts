/* eslint-disable no-unused-vars -- TypeScript membership port parameters are public contract vocabulary. */
export type TeamRole = 'MEMBER' | 'ADMIN' | 'AUDITOR';
interface Invitation { workspaceId: string; email: string; role: TeamRole; expiresAt: number; accepted: boolean }

export class MembershipService {
  private readonly invitations = new Map<string, Invitation>();
  constructor(private readonly nextId: () => string) {}

  invite(input: Readonly<{ workspaceId: string; email: string; role: TeamRole; expiresAt: number }>): Readonly<{ ref: `invite:${string}` }> {
    if (!input.email.includes('@') || input.workspaceId.length === 0 || input.expiresAt < 1) throw new Error('INVITATION_INVALID');
    const ref = `invite:${this.nextId()}` as const;
    if (this.invitations.has(ref)) throw new Error('INVITATION_REPLAY');
    this.invitations.set(ref, { ...input, accepted: false });
    return Object.freeze({ ref });
  }

  accept(ref: string, subject: string, now: number): Readonly<{ workspaceId: string; subject: string; role: TeamRole }> {
    const invitation = this.invitations.get(ref);
    if (!invitation || invitation.accepted) throw new Error('INVITATION_UNKNOWN');
    if (invitation.email !== subject) throw new Error('INVITATION_PRINCIPAL_DENIED');
    if (invitation.expiresAt < now) throw new Error('INVITATION_EXPIRED');
    invitation.accepted = true;
    return Object.freeze({ workspaceId: invitation.workspaceId, subject, role: invitation.role });
  }
}
