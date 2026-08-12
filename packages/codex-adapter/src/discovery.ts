export interface UpstreamDiscovery { version: string; authenticated: boolean; capabilities: string[]; }
/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
export class CodexDiscoveryAdapter {
  constructor(private readonly discoverUpstream: () => Promise<UpstreamDiscovery>) {}
  async describe() { const source = await this.discoverUpstream(); return { adapter: 'codex', adapterVersion: source.version, saiVersion: '1.0.0', functions: source.capabilities }; }
  async health() { const source = await this.discoverUpstream(); return { connection: source.authenticated ? 'CONNECTED' : 'AUTH_REQUIRED', availability: source.authenticated ? 'AVAILABLE' : 'PAUSED', observedAt: new Date().toISOString() }; }
  async start(): Promise<never> { throw unavailable(); }
  async resume(): Promise<never> { throw unavailable(); }
  async cancel(): Promise<never> { throw unavailable(); }
  async status(): Promise<never> { throw unavailable(); }
  async events(): Promise<never> { throw unavailable(); }
  async result(): Promise<never> { throw unavailable(); }
}
function unavailable() { return { code: 'CAPABILITY_UNAVAILABLE', category: 'POLICY', execution_may_have_started: false }; }
