const requiredOperations = ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'];
const errorMappings = ['AUTH_REQUIRED', 'UNAVAILABLE', 'TIMEOUT', 'CANCELLED', 'UNKNOWN'];

export interface AdapterManifest {
  readonly adapterId: string; readonly manifestVersion: string; readonly saiVersion: string;
  readonly operations: readonly string[]; readonly credentialReference: string; readonly errorMappings: readonly string[];
}

export function validateAdapterManifest(manifest: AdapterManifest): Readonly<{ valid: boolean; reason: 'OK' | 'MANIFEST_INVALID' }> {
  const valid = /^[a-z0-9-]+$/.test(manifest.adapterId) && /^1\.\d+\.\d+$/.test(manifest.manifestVersion) && /^1\.\d+\.\d+$/.test(manifest.saiVersion) && /^cred:[a-z0-9-]+$/.test(manifest.credentialReference) && manifest.operations.length > 0 && manifest.operations.every((operation) => requiredOperations.includes(operation)) && manifest.errorMappings.every((mapping) => errorMappings.includes(mapping));
  return valid ? { valid: true, reason: 'OK' } : { valid: false, reason: 'MANIFEST_INVALID' };
}
