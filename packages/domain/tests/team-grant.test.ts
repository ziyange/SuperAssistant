import { expect, test } from 'vitest';
import { createTeamGrant, canUseTeamGrant } from '../src/team-grant.js';

test('binds a Team Grant immutably to actor, Workspace, Proposal and opaque credential reference', () => {
  const grant = createTeamGrant({ actor: 'user-1', workspaceId: 'workspace-1', proposalDigest: 'sha256:abc', credentialRef: 'cred:user-1' });
  expect(Object.isFrozen(grant)).toBe(true);
  expect(canUseTeamGrant(grant, { actor: 'user-1', workspaceId: 'workspace-1', proposalDigest: 'sha256:abc', credentialRef: 'cred:user-1' })).toBe(true);
  expect(canUseTeamGrant(grant, { actor: 'user-2', workspaceId: 'workspace-1', proposalDigest: 'sha256:abc', credentialRef: 'cred:user-1' })).toBe(false);
  expect(canUseTeamGrant(grant, { actor: 'user-1', workspaceId: 'workspace-2', proposalDigest: 'sha256:abc', credentialRef: 'cred:user-1' })).toBe(false);
});
