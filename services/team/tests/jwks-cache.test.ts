import { expect, test } from 'vitest';
import { JwksCache } from '../src/oidc/jwks-cache.js';

test('refreshes a matching key and fails closed when it is stale or unknown', async () => {
  let calls = 0;
  const cache = new JwksCache(async () => { calls += 1; return { expiresAt: calls < 3 ? 100 : 200, keys: [{ kid: 'one', material: 'fixture-key' }] }; });
  await expect(cache.get('one', 10)).resolves.toEqual('fixture-key');
  await expect(cache.get('one', 50)).resolves.toEqual('fixture-key');
  await expect(cache.get('missing', 50)).rejects.toThrow('OIDC_JWKS_KEY_UNKNOWN');
  await expect(cache.get('one', 101)).resolves.toEqual('fixture-key');
  expect(calls).toBe(3);
});
