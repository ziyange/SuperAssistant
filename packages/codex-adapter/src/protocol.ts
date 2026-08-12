export const CODEX_DISCOVERY_PROTOCOL = Object.freeze({ sai: '1.0.0', minimumCodex: '0.121.0', operations: ['describe', 'health'] as const });

export type DiscoveryEvent = Readonly<{ event_id: string; version: string; authenticated: boolean; capabilities: readonly string[] }>;

export function isCompatibleCodexVersion(version: string): boolean {
  return /^0\.121\.\d+$/.test(version);
}

export function normalizeDiscoveryEvent(event: DiscoveryEvent, seenEventIds: ReadonlySet<string>): DiscoveryEvent | null {
  if (seenEventIds.has(event.event_id)) return null;
  return event;
}
