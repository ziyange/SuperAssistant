/* eslint-disable no-unused-vars -- TypeScript RBAC contract parameters are public vocabulary. */
type TeamAction = 'READ' | 'WRITE' | 'APPROVE' | 'MANAGE_MEMBERS' | 'EXPORT_AUDIT';
type TeamRole = 'MEMBER' | 'OPERATOR' | 'APPROVER' | 'AUDITOR' | 'ADMIN';
interface Group { workspaceId: string; groupId: string; members: readonly string[]; roles: readonly TeamRole[] }

export class TeamRbacService {
  constructor(private readonly groups: readonly Group[]) {}
  authorize(input: Readonly<{ actor: string; workspaceId: string; action: TeamAction; requester: string }>): Readonly<{ allowed: boolean; reason?: 'WORKSPACE_DENIED' | 'ROLE_DENIED' | 'SEPARATION_OF_DUTIES_DENIED' }> {
    const knownElsewhere = this.groups.some(group => group.workspaceId !== input.workspaceId && group.members.includes(input.actor));
    const roles = this.groups.filter(group => group.workspaceId === input.workspaceId && group.members.includes(input.actor)).flatMap(group => group.roles);
    if (roles.length === 0) return { allowed: false, reason: knownElsewhere ? 'WORKSPACE_DENIED' : 'ROLE_DENIED' };
    if (input.action === 'APPROVE' && input.actor === input.requester) return { allowed: false, reason: 'SEPARATION_OF_DUTIES_DENIED' };
    const allowed = input.action === 'READ' || input.action === 'WRITE' && roles.includes('OPERATOR') || input.action === 'APPROVE' && roles.includes('APPROVER') || input.action === 'MANAGE_MEMBERS' && roles.includes('ADMIN') || input.action === 'EXPORT_AUDIT' && roles.includes('AUDITOR');
    return allowed ? { allowed: true } : { allowed: false, reason: 'ROLE_DENIED' };
  }
}
