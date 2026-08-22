import { validateAdapterManifest, type AdapterManifest } from '@super-assistant/domain';
import { verifySaiConformance } from './conformance.js';

export function evaluateAdapterOnboarding(manifest: AdapterManifest): Readonly<{ state: 'ENABLED' | 'DISABLED'; reason: 'OK' | 'MANIFEST_INVALID' | 'VERSION_UNSUPPORTED' | 'CAPABILITY_UNAVAILABLE' }> {
  if (!validateAdapterManifest(manifest).valid) return { state: 'DISABLED', reason: 'MANIFEST_INVALID' };
  const conformance = verifySaiConformance(manifest);
  return conformance.compatible ? { state: 'ENABLED', reason: 'OK' } : { state: 'DISABLED', reason: conformance.reason };
}
