import process from 'node:process';
import { URL } from 'node:url';

const authority = new URL('../../dist/main/protected-proposal-authority.js', import.meta.url).href;
const consent = new URL('./protected-process-consent.mjs', import.meta.url).href;

// Explicit child-process fixture only; no production entry point loads this hook.
export async function resolve(specifier, context, nextResolve) {
  if (process.env.SA_PROTECTED_PROCESS_FIXTURE !== '1') throw new Error('Fixture loader not enabled');
  if (context.parentURL === authority && specifier === './protected-native-consent.js') {
    return { url: consent, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
