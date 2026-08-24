/* eslint-disable no-unused-vars -- TypeScript identity port parameters are public contract vocabulary. */
import { createHash } from 'node:crypto';

export interface OidcClaims { issuer: string; audience: string; nonce: string; subject: string; expiresAt: number }
export interface OidcTokenVerifier { verify(idToken: string): Promise<OidcClaims> }
export interface OidcCodeExchanger { exchange(request: Readonly<{ code: string; codeVerifier: string }>): Promise<string> }
export interface PendingOidcIdentity { issuer: string; audience: string; state: string; nonce: string; pkceChallenge: string; readonly pkceVerifier: string }

export class OidcIdentityService {
  constructor(private readonly nextState: () => string, private readonly nextNonce: () => string, private readonly nextVerifier: () => string) {}

  begin(input: Readonly<{ issuer: string; audience: string }>): PendingOidcIdentity {
    if (!input.issuer.startsWith('https://') || input.audience.length === 0) throw new Error('OIDC_CONFIGURATION_INVALID');
    const pkceVerifier = this.nextVerifier();
    if (pkceVerifier.length < 1) throw new Error('OIDC_PKCE_INVALID');
    return Object.freeze({ issuer: input.issuer, audience: input.audience, state: this.nextState(), nonce: this.nextNonce(), pkceVerifier, pkceChallenge: createHash('sha256').update(pkceVerifier).digest('base64url') });
  }

  async complete(pending: PendingOidcIdentity, response: Readonly<{ code: string; state: string }>, exchanger: OidcCodeExchanger, verifier: OidcTokenVerifier, now: number): Promise<Readonly<{ sessionRef: `session:sha256:${string}`; subject: string }>> {
    if (response.state !== pending.state || response.code.length === 0) throw new Error('OIDC_STATE_INVALID');
    let claims: OidcClaims;
    try {
      const idToken = await exchanger.exchange({ code: response.code, codeVerifier: pending.pkceVerifier });
      claims = await verifier.verify(idToken);
    } catch {
      throw new Error('OIDC_VERIFICATION_UNAVAILABLE');
    }
    if (claims.issuer !== pending.issuer) throw new Error('OIDC_ISSUER_INVALID');
    if (claims.audience !== pending.audience) throw new Error('OIDC_AUDIENCE_INVALID');
    if (claims.nonce !== pending.nonce) throw new Error('OIDC_NONCE_INVALID');
    if (!Number.isFinite(claims.expiresAt) || claims.expiresAt <= now) throw new Error('OIDC_EXPIRED');
    const sessionRef = `session:sha256:${createHash('sha256').update(`${claims.subject}:${pending.state}:${claims.expiresAt}`).digest('hex')}` as const;
    return Object.freeze({ sessionRef, subject: claims.subject });
  }
}
