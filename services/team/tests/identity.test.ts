import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { OidcIdentityService, type OidcCodeExchanger, type OidcTokenVerifier } from '../src/identity.js';

const verifier: OidcTokenVerifier = { verify: async () => ({ issuer: 'https://issuer.example', audience: 'team-service', nonce: 'nonce-fixed', subject: 'user-1', expiresAt: 200 }) };
const exchanger: OidcCodeExchanger = { exchange: async request => {
  expect(request.codeVerifier).toBe('verifier-fixed');
  return 'untrusted-token';
} };

test('creates only opaque session references after state, nonce, PKCE and claims validate', async () => {
  const service = new OidcIdentityService(() => 'state-fixed', () => 'nonce-fixed', () => 'verifier-fixed');
  const pending = service.begin({ issuer: 'https://issuer.example', audience: 'team-service' });
  expect(pending.pkceChallenge).toBe(createHash('sha256').update('verifier-fixed').digest('base64url'));

  await expect(service.complete(pending, { code: 'code', state: 'state-fixed' }, exchanger, verifier, 100)).resolves.toEqual({
    sessionRef: expect.stringMatching(/^session:sha256:[a-f0-9]{64}$/),
    subject: 'user-1'
  });
});

test.each([
  ['state', { code: 'code', state: 'wrong' }, verifier, 'OIDC_STATE_INVALID'],
  ['issuer', { code: 'code', state: 'state-fixed' }, { verify: async () => ({ issuer: 'https://evil.example', audience: 'team-service', nonce: 'nonce-fixed', subject: 'user-1', expiresAt: 200 }) }, 'OIDC_ISSUER_INVALID'],
  ['audience', { code: 'code', state: 'state-fixed' }, { verify: async () => ({ issuer: 'https://issuer.example', audience: 'other', nonce: 'nonce-fixed', subject: 'user-1', expiresAt: 200 }) }, 'OIDC_AUDIENCE_INVALID'],
  ['nonce', { code: 'code', state: 'state-fixed' }, { verify: async () => ({ issuer: 'https://issuer.example', audience: 'team-service', nonce: 'other', subject: 'user-1', expiresAt: 200 }) }, 'OIDC_NONCE_INVALID'],
  ['expiry', { code: 'code', state: 'state-fixed' }, { verify: async () => ({ issuer: 'https://issuer.example', audience: 'team-service', nonce: 'nonce-fixed', subject: 'user-1', expiresAt: 99 }) }, 'OIDC_EXPIRED'],
  ['jwks', { code: 'code', state: 'state-fixed' }, { verify: async () => { throw new Error('JWKS_UNAVAILABLE'); } }, 'OIDC_VERIFICATION_UNAVAILABLE']
])('fails closed when %s is invalid or unavailable', async (_case, response, tokenVerifier, code) => {
  const service = new OidcIdentityService(() => 'state-fixed', () => 'nonce-fixed', () => 'verifier-fixed');
  const pending = service.begin({ issuer: 'https://issuer.example', audience: 'team-service' });
  await expect(service.complete(pending, response, exchanger, tokenVerifier, 100)).rejects.toThrow(code);
});
