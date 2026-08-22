import { expect, test } from 'vitest';
import { evaluateAdapterOnboarding } from '../src/adapter-manifest.js';

test('keeps an incompatible Adapter disabled with a product reason', () => {
  expect(evaluateAdapterOnboarding({ adapterId: 'legacy', manifestVersion: '1.0.0', saiVersion: '1.0.0', operations: ['describe'], credentialReference: 'cred:legacy', errorMappings: ['AUTH_REQUIRED'] })).toEqual({ state: 'DISABLED', reason: 'CAPABILITY_UNAVAILABLE' });
});
