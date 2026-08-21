import { expect, test } from 'vitest';
import { verifySaiConformance } from '../src/conformance.js';

test('accepts all eight operations for a compatible SAI 1.x adapter', () => {
  expect(verifySaiConformance({ saiVersion: '1.2.0', operations: ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'] })).toEqual({ compatible: true, reason: 'OK' });
});

test('fails closed for a different SAI major or a missing operation', () => {
  expect(verifySaiConformance({ saiVersion: '2.0.0', operations: ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'] })).toEqual({ compatible: false, reason: 'VERSION_UNSUPPORTED' });
  expect(verifySaiConformance({ saiVersion: '1.0.0', operations: ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events'] })).toEqual({ compatible: false, reason: 'CAPABILITY_UNAVAILABLE' });
});
