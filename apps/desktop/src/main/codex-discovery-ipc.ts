export type CodexDiscoveryProjection = Readonly<{
  connection: string;
  availability: string;
  version: string;
  functions: readonly string[];
}>;

export function projectCodexDiscovery(value: Record<string, unknown>): CodexDiscoveryProjection {
  return {
    connection: typeof value.connection === 'string' ? value.connection : 'UNAVAILABLE',
    availability: typeof value.availability === 'string' ? value.availability : 'UNAVAILABLE',
    version: typeof value.version === 'string' ? value.version : 'unknown',
    functions: Array.isArray(value.functions) ? value.functions.filter((item): item is string => typeof item === 'string') : []
  };
}
