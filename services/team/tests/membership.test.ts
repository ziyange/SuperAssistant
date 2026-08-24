import { expect, test } from 'vitest';
import { MembershipService } from '../src/membership.js';

test('accepts an unexpired invitation only for its intended principal and records a member role', () => {
  const memberships = new MembershipService(() => 'invite-fixed');
  const invitation = memberships.invite({ workspaceId: 'workspace-1', email: 'user@example.com', role: 'MEMBER', expiresAt: 200 });
  expect(memberships.accept(invitation.ref, 'user@example.com', 100)).toEqual({ workspaceId: 'workspace-1', subject: 'user@example.com', role: 'MEMBER' });
});

test('rejects replay, wrong principal and expired invitation', () => {
  const memberships = new MembershipService(() => 'invite-fixed');
  const invitation = memberships.invite({ workspaceId: 'workspace-1', email: 'user@example.com', role: 'MEMBER', expiresAt: 200 });
  expect(() => memberships.accept(invitation.ref, 'other@example.com', 100)).toThrow('INVITATION_PRINCIPAL_DENIED');
  expect(() => memberships.accept(invitation.ref, 'user@example.com', 201)).toThrow('INVITATION_EXPIRED');
  expect(() => memberships.accept('invite:missing', 'user@example.com', 100)).toThrow('INVITATION_UNKNOWN');
  const replay = new MembershipService(() => 'invite-replay');
  const accepted = replay.invite({ workspaceId: 'workspace-1', email: 'user@example.com', role: 'MEMBER', expiresAt: 200 });
  replay.accept(accepted.ref, 'user@example.com', 100);
  expect(() => replay.accept(accepted.ref, 'user@example.com', 100)).toThrow('INVITATION_UNKNOWN');
});
