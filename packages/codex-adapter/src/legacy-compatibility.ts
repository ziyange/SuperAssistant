const operations = ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'];

export function evaluateLegacyCompatibility(input: Readonly<{ upstreamVersion: string; operations: readonly string[] }>): Readonly<{ state: 'ENABLED' | 'DISABLED'; reason: 'Compatible' | 'Adapter compatibility unavailable' }> {
  const compatible = /^1\.\d+\.\d+$/.test(input.upstreamVersion) && operations.every((operation) => input.operations.includes(operation));
  return compatible ? { state: 'ENABLED', reason: 'Compatible' } : { state: 'DISABLED', reason: 'Adapter compatibility unavailable' };
}
