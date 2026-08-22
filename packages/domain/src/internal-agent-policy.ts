export function authorizeInternalAgentAccess(input: Readonly<{ agentDomain: string; requestedDomain: string; credentialReference: string }>): Readonly<{ allowed: boolean; reason?: 'DATA_DOMAIN_DENIED' | 'CREDENTIAL_REFERENCE_INVALID' }> {
  if (!/^cred:[a-z0-9-]+$/.test(input.credentialReference)) return { allowed: false, reason: 'CREDENTIAL_REFERENCE_INVALID' };
  if (input.agentDomain !== input.requestedDomain) return { allowed: false, reason: 'DATA_DOMAIN_DENIED' };
  return { allowed: true };
}
