export function mapDiscoveryError(error: unknown): { code: string; connection: 'UNAVAILABLE'; message: string } {
  const text = String(error); return { code: /auth/i.test(text) ? 'CREDENTIAL_UNAVAILABLE' : 'UPSTREAM_UNAVAILABLE', connection: 'UNAVAILABLE', message: 'Codex runtime discovery is unavailable.' };
}
