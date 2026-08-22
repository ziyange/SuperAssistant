import { expect, test } from 'vitest';
import { authorizeInternalAgentAccess } from '../src/internal-agent-policy.js';

test('permits an Internal Agent only within its declared data domain and opaque credential scope', () => {
  expect(authorizeInternalAgentAccess({ agentDomain: 'finance', requestedDomain: 'finance', credentialReference: 'cred:finance-service' })).toEqual({ allowed: true });
});

test('rejects cross-domain access and credential values', () => {
  expect(authorizeInternalAgentAccess({ agentDomain: 'finance', requestedDomain: 'hr', credentialReference: 'cred:finance-service' })).toEqual({ allowed: false, reason: 'DATA_DOMAIN_DENIED' });
  expect(authorizeInternalAgentAccess({ agentDomain: 'finance', requestedDomain: 'finance', credentialReference: 'secret' })).toEqual({ allowed: false, reason: 'CREDENTIAL_REFERENCE_INVALID' });
});
