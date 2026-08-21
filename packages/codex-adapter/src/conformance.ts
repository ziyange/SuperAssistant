const requiredOperations = ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'] as const;

export type SaiConformanceResult = Readonly<{ compatible: boolean; reason: 'OK' | 'VERSION_UNSUPPORTED' | 'CAPABILITY_UNAVAILABLE' }>;

export function verifySaiConformance(input: Readonly<{ saiVersion: string; operations: readonly string[] }>): SaiConformanceResult {
  if (!/^1\.\d+\.\d+$/.test(input.saiVersion)) return { compatible: false, reason: 'VERSION_UNSUPPORTED' };
  if (requiredOperations.some((operation) => !input.operations.includes(operation))) return { compatible: false, reason: 'CAPABILITY_UNAVAILABLE' };
  return { compatible: true, reason: 'OK' };
}
