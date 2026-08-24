import { expect, test } from 'vitest';
import { evaluateTeamAccess } from '../src/team-rbac.js';

test('allows only scoped roles and enforces requester/approver separation', () => {
  expect(evaluateTeamAccess({ actor: 'operator', actorWorkspace: 'workspace-1', resourceWorkspace: 'workspace-1', roles: ['OPERATOR'], action: 'WRITE', requester: 'requester' })).toEqual({ allowed: true });
  expect(evaluateTeamAccess({ actor: 'approver', actorWorkspace: 'workspace-1', resourceWorkspace: 'workspace-1', roles: ['APPROVER'], action: 'APPROVE', requester: 'requester' })).toEqual({ allowed: true });
  expect(evaluateTeamAccess({ actor: 'approver', actorWorkspace: 'workspace-1', resourceWorkspace: 'workspace-1', roles: ['APPROVER'], action: 'APPROVE', requester: 'approver' })).toEqual({ allowed: false, reason: 'SEPARATION_OF_DUTIES_DENIED' });
});

test('denies a 200-case cross-workspace and role-escalation matrix', () => {
  const roles = ['MEMBER', 'OPERATOR', 'APPROVER', 'AUDITOR', 'UNKNOWN'] as const;
  const actions = ['WRITE', 'APPROVE', 'MANAGE_MEMBERS', 'EXPORT_AUDIT', 'UNKNOWN'] as const;
  let denials = 0;
  for (let index = 0; index < 200; index += 1) {
    const result = evaluateTeamAccess({
      actor: `actor-${index}`,
      actorWorkspace: 'workspace-2',
      resourceWorkspace: 'workspace-1',
      roles: [roles[index % roles.length]!],
      action: actions[index % actions.length]!,
      requester: `actor-${index}`
    });
    if (!result.allowed) denials += 1;
  }
  expect(denials).toBe(200);
});
