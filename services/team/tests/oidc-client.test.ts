import { expect, test } from 'vitest';
import { OidcClient } from '../src/oidc/oidc-client.js';
import { JwksCache } from '../src/oidc/jwks-cache.js';
import { OidcIdentityService } from '../src/identity.js';

test('verifies fixture claims through a JWKS-selected key before session completion', async () => {
  const client = new OidcClient(new JwksCache(async () => ({ expiresAt: 100, keys: [{ kid: 'fixture-kid', material: 'fixture-public-key' }] })), {
    async verify({ token, key }) {
      expect(token).toBe('fixture-token');
      expect(key).toBe('fixture-public-key');
      return { issuer: 'https://issuer.example.test', audience: 'desktop-client', nonce: 'nonce-1', subject: 'member@example.test', expiresAt: 99 };
    }
  });
  expect(await client.verify({ kid: 'fixture-kid', token: 'fixture-token' }, 10)).toMatchObject({ subject: 'member@example.test' });
});

test('rejects state, issuer, audience, nonce and expiry mismatches before a session ref is issued', async () => {
  const identity = new OidcIdentityService(() => 'state-1', () => 'nonce-1', () => 'verifier-1');
  const pending = identity.begin({ issuer: 'https://issuer.example.test', audience: 'desktop-client' });
  const exchanger = { async exchange() { return 'token'; } };
  const valid = { issuer: pending.issuer, audience: pending.audience, nonce: pending.nonce, subject: 'member@example.test', expiresAt: 100 };
  await expect(identity.complete(pending, { code: 'code', state: 'wrong' }, exchanger, { async verify() { return valid; } }, 10)).rejects.toThrow('OIDC_STATE_INVALID');
  await expect(identity.complete(pending, { code: 'code', state: pending.state }, exchanger, { async verify() { return { ...valid, issuer: 'https://other.example.test' }; } }, 10)).rejects.toThrow('OIDC_ISSUER_INVALID');
  await expect(identity.complete(pending, { code: 'code', state: pending.state }, exchanger, { async verify() { return { ...valid, audience: 'other' }; } }, 10)).rejects.toThrow('OIDC_AUDIENCE_INVALID');
  await expect(identity.complete(pending, { code: 'code', state: pending.state }, exchanger, { async verify() { return { ...valid, nonce: 'other' }; } }, 10)).rejects.toThrow('OIDC_NONCE_INVALID');
  await expect(identity.complete(pending, { code: 'code', state: pending.state }, exchanger, { async verify() { return { ...valid, expiresAt: 10 }; } }, 10)).rejects.toThrow('OIDC_EXPIRED');
});
