export type TeamAction = 'READ' | 'WRITE' | 'APPROVE' | 'MANAGE_MEMBERS' | 'EXPORT_AUDIT';
export type TeamWorkspaceRole = 'MEMBER' | 'OPERATOR' | 'APPROVER' | 'AUDITOR' | 'ADMIN';
export type TeamAccessReason = 'WORKSPACE_DENIED' | 'ROLE_DENIED' | 'SEPARATION_OF_DUTIES_DENIED';

export function evaluateTeamAccess(input: Readonly<{ actor: string; actorWorkspace: string; resourceWorkspace: string; roles: readonly string[]; action: string; requester: string }>): Readonly<{ allowed: boolean; reason?: TeamAccessReason }> {
  if (input.actorWorkspace !== input.resourceWorkspace) return { allowed: false, reason: 'WORKSPACE_DENIED' };
  if (input.action === 'APPROVE' && input.actor === input.requester) return { allowed: false, reason: 'SEPARATION_OF_DUTIES_DENIED' };
  const allowed = input.action === 'READ' ? input.roles.some(role => ['MEMBER', 'OPERATOR', 'APPROVER', 'AUDITOR', 'ADMIN'].includes(role))
    : input.action === 'WRITE' ? input.roles.includes('OPERATOR')
    : input.action === 'APPROVE' ? input.roles.includes('APPROVER')
    : input.action === 'MANAGE_MEMBERS' ? input.roles.includes('ADMIN')
    : input.action === 'EXPORT_AUDIT' ? input.roles.includes('AUDITOR')
    : false;
  return allowed ? { allowed: true } : { allowed: false, reason: 'ROLE_DENIED' };
}
