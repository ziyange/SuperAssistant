import { expect, test } from 'vitest';
import { validateAdapterManifest } from '../src/adapter-manifest.js';

test('accepts a versioned manifest with opaque credentials and all SAI operations', () => {
  expect(validateAdapterManifest({ adapterId: 'gemini-core', manifestVersion: '1.0.0', saiVersion: '1.0.0', operations: ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'], credentialReference: 'cred:adapter-1', errorMappings: ['AUTH_REQUIRED'] })).toEqual({ valid: true, reason: 'OK' });
});

test('rejects missing operations, unknown capability and a credential value', () => {
  expect(validateAdapterManifest({ adapterId: 'bad', manifestVersion: '1.0.0', saiVersion: '1.0.0', operations: ['describe'], credentialReference: 'secret-value', errorMappings: ['UNKNOWN'] })).toEqual({ valid: false, reason: 'MANIFEST_INVALID' });
});
