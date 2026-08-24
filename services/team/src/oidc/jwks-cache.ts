/* eslint-disable no-unused-vars -- JWKS source argument is public identity-port vocabulary. */
export interface JwkSet { expiresAt: number; keys: readonly { kid: string; material: string }[] }
export interface JwksSource { (): Promise<JwkSet> }

export class JwksCache {
  private cached: JwkSet | undefined;
  constructor(private readonly source: JwksSource) {}
  async get(kid: string, now: number): Promise<string> {
    if (this.cached === undefined || this.cached.expiresAt <= now || !this.cached.keys.some(key => key.kid === kid)) this.cached = await this.source();
    const key = this.cached.keys.find(item => item.kid === kid);
    if (key === undefined || this.cached.expiresAt <= now) throw new Error('OIDC_JWKS_KEY_UNKNOWN');
    return key.material;
  }
}
