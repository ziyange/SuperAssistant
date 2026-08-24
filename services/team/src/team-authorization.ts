/* eslint-disable no-unused-vars -- Authorization port parameters are public contract vocabulary. */
export type TeamAction = 'READ' | 'WRITE' | 'APPROVE' | 'MANAGE_MEMBERS' | 'EXPORT_AUDIT';
export type TeamRole = 'MEMBER' | 'OPERATOR' | 'APPROVER' | 'AUDITOR' | 'ADMIN';

export interface TeamRoleAssignment {
  workspaceId: string;
  actor: string;
  role: TeamRole;
}

export type TeamAuthorizationDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; reason: 'WORKSPACE_DENIED' | 'ROLE_DENIED' }>;

const rolesForAction: Readonly<Record<TeamAction, readonly TeamRole[]>> = {
  READ: ['MEMBER', 'OPERATOR', 'APPROVER', 'AUDITOR'],
  WRITE: ['OPERATOR'],
  APPROVE: ['APPROVER'],
  MANAGE_MEMBERS: ['ADMIN'],
  EXPORT_AUDIT: ['AUDITOR']
};

/**
 * Stateless policy evaluation. The caller must supply assignments from the
 * authoritative Team store; no request body can supply a role.
 */
export class TeamAuthorizationService {
  constructor(private readonly assignments: readonly TeamRoleAssignment[]) {}

  authorize(input: Readonly<{ actor: string; workspaceId: string; action: TeamAction }>): TeamAuthorizationDecision {
    const actorAssignments = this.assignments.filter(assignment => assignment.actor === input.actor);
    const targetAssignments = actorAssignments.filter(assignment => assignment.workspaceId === input.workspaceId);
    if (targetAssignments.length === 0) {
      return { allowed: false, reason: actorAssignments.length === 0 ? 'ROLE_DENIED' : 'WORKSPACE_DENIED' };
    }
    return targetAssignments.some(assignment => rolesForAction[input.action].includes(assignment.role))
      ? { allowed: true }
      : { allowed: false, reason: 'ROLE_DENIED' };
  }
}

export interface TeamRoleAssignmentStore {
  listRoleAssignments(workspaceId: string): Promise<readonly TeamRoleAssignment[]>;
}

/** Reads assignments from the authoritative store on every decision. */
export class PersistentTeamAuthorizationService {
  constructor(private readonly store: TeamRoleAssignmentStore) {}

  async authorize(input: Readonly<{ actor: string; workspaceId: string; action: TeamAction }>): Promise<TeamAuthorizationDecision> {
    return new TeamAuthorizationService(await this.store.listRoleAssignments(input.workspaceId)).authorize(input);
  }
}
