import type { GoalAction } from './routing.js';

export type AuthorizationGrantStatus = 'ISSUED' | 'CONSUMED' | 'REVOKED' | 'EXPIRED';

export interface AuthorizationGrantInput {
  grantId: string;
  proposalVersionId: string;
  proposalDigest: string;
  actorId: string;
  idempotencyKey: string;
  actions: readonly GoalAction[];
  issuedAt: string;
  expiresAt: string;
}

export interface AuthorizationGrant extends AuthorizationGrantInput {
  status: AuthorizationGrantStatus;
}

export function createAuthorizationGrant(input: AuthorizationGrantInput): AuthorizationGrant {
  return { ...input, actions: [...input.actions], status: 'ISSUED' };
}

export function isAuthorizationGrantActive(grant: AuthorizationGrant, now: string): boolean {
  return grant.status === 'ISSUED' && new Date(grant.expiresAt).getTime() > new Date(now).getTime();
}

export function consumeAuthorizationGrant(grant: AuthorizationGrant): AuthorizationGrant {
  if (grant.status !== 'ISSUED') throw new Error('AuthorizationGrant must be ISSUED before consumption');
  return { ...grant, status: 'CONSUMED' };
}
