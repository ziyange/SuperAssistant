import { expect, test } from 'vitest';
import { TeamMembershipService } from '../src/membership-service.js';

test('accepts one unexpired invitation once and records membership in its Workspace', () => {
  const membership = new TeamMembershipService(() => 'invite-1');
  const invitation = membership.invite({ workspaceId: 'team-1', email: 'member@example.test', role: 'MEMBER', expiresAt: 100 });
  expect(membership.accept(invitation, 'member@example.test', 99)).toEqual({ workspaceId: 'team-1', subject: 'member@example.test', role: 'MEMBER' });
  expect(() => membership.accept(invitation, 'member@example.test', 99)).toThrow('INVITATION_UNKNOWN');
  expect(membership.list('team-1')).toEqual([{ workspaceId: 'team-1', subject: 'member@example.test', role: 'MEMBER' }]);
});
