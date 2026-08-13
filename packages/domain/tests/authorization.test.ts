import { describe, expect, test } from 'vitest';
import { createAuthorizationGrant, consumeAuthorizationGrant, isAuthorizationGrantActive } from '../src/authorization.js';

describe('AuthorizationGrant', () => {
  const grant = createAuthorizationGrant({ grantId: 'grant-1', proposalVersionId: 'proposal-1', proposalDigest: 'sha256:abc', actorId: 'actor-1', idempotencyKey: 'confirm-1', actions: ['FILE_WRITE'], issuedAt: '2026-08-13T00:00:00.000Z', expiresAt: '2026-08-14T00:00:00.000Z' });

  test('is active only while issued and unexpired', () => {
    expect(isAuthorizationGrantActive(grant, '2026-08-13T12:00:00.000Z')).toBe(true);
    expect(isAuthorizationGrantActive(grant, '2026-08-14T00:00:00.000Z')).toBe(false);
  });

  test('atomically transitions an issued grant to consumed exactly once', () => {
    const consumed = consumeAuthorizationGrant(grant);
    expect(consumed.status).toBe('CONSUMED');
    expect(() => consumeAuthorizationGrant(consumed)).toThrow('must be ISSUED');
  });
});
