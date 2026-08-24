/* eslint-disable no-unused-vars -- OIDC verification ports name public protocol parameters. */
import type { OidcClaims } from '../identity.js';
import { JwksCache } from './jwks-cache.js';

export interface OidcSignedToken { kid: string; token: string }
export interface OidcJwkVerifier { verify(input: Readonly<{ token: string; key: string }>): Promise<OidcClaims> }

export class OidcClient {
  constructor(private readonly keys: JwksCache, private readonly verifier: OidcJwkVerifier) {}
  async verify(input: OidcSignedToken, now: number): Promise<OidcClaims> {
    const key = await this.keys.get(input.kid, now);
    return this.verifier.verify({ token: input.token, key });
  }
}
