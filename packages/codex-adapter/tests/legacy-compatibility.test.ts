import { expect, test } from 'vitest';
import { evaluateLegacyCompatibility } from '../src/legacy-compatibility.js';

test('enables only a supported upstream version with complete stable capabilities', () => {
  expect(evaluateLegacyCompatibility({ upstreamVersion: '1.0.0', operations: ['describe', 'health', 'start', 'resume', 'cancel', 'status', 'events', 'result'] })).toEqual({ state: 'ENABLED', reason: 'Compatible' });
});

test('fails closed in product language when upstream changes', () => {
  expect(evaluateLegacyCompatibility({ upstreamVersion: '2.0.0', operations: ['describe'] })).toEqual({ state: 'DISABLED', reason: 'Adapter compatibility unavailable' });
});
