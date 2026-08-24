import { expect, test } from 'vitest';
import { TeamAuthorizationService } from '../src/team-authorization.js';
import { PersistentTeamAuthorizationService } from '../src/team-authorization.js';

test('authorizes only a role held in the authenticated actor workspace', () => {
  const authorization = new TeamAuthorizationService([
    { workspaceId: 'workspace-a', actor: 'operator-a', role: 'OPERATOR' },
    { workspaceId: 'workspace-b', actor: 'operator-b', role: 'OPERATOR' }
  ]);

  expect(authorization.authorize({ actor: 'operator-a', workspaceId: 'workspace-a', action: 'WRITE' })).toEqual({ allowed: true });
  expect(authorization.authorize({ actor: 'operator-a', workspaceId: 'workspace-b', action: 'WRITE' })).toEqual({ allowed: false, reason: 'WORKSPACE_DENIED' });
  expect(authorization.authorize({ actor: 'operator-a', workspaceId: 'workspace-a', action: 'APPROVE' })).toEqual({ allowed: false, reason: 'ROLE_DENIED' });
});

test('loads authoritative role assignments for every protected authorization decision', async () => {
  const assignments = [{ workspaceId: 'workspace-a', actor: 'operator-a', role: 'OPERATOR' as const }];
  const authorization = new PersistentTeamAuthorizationService({ async listRoleAssignments(workspaceId) { return assignments.filter(assignment => assignment.workspaceId === workspaceId); } });

  await expect(authorization.authorize({ actor: 'operator-a', workspaceId: 'workspace-a', action: 'WRITE' })).resolves.toEqual({ allowed: true });
  await expect(authorization.authorize({ actor: 'operator-a', workspaceId: 'workspace-b', action: 'WRITE' })).resolves.toEqual({ allowed: false, reason: 'ROLE_DENIED' });
});
