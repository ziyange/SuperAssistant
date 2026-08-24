import { expect, test } from 'vitest';
import { TeamRbacService } from '../src/rbac.js';

test('resolves groups only within the target Workspace and denies unknown group membership', () => {
  const rbac = new TeamRbacService([{ workspaceId: 'workspace-1', groupId: 'operators', members: ['operator'], roles: ['OPERATOR'] }]);
  expect(rbac.authorize({ actor: 'operator', workspaceId: 'workspace-1', action: 'WRITE', requester: 'requester' })).toEqual({ allowed: true });
  expect(rbac.authorize({ actor: 'operator', workspaceId: 'workspace-2', action: 'WRITE', requester: 'requester' })).toEqual({ allowed: false, reason: 'WORKSPACE_DENIED' });
  expect(rbac.authorize({ actor: 'unknown', workspaceId: 'workspace-1', action: 'WRITE', requester: 'requester' })).toEqual({ allowed: false, reason: 'ROLE_DENIED' });
});
