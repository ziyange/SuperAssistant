import { expect, test } from 'vitest';
import { parseDiscoveryFrame } from '../src/stdio-transport.js';

test('rejects malformed, oversized, and execution-native discovery frames', () => {
  expect(() => parseDiscoveryFrame('{not-json}')).toThrow(/malformed/i);
  expect(() => parseDiscoveryFrame(JSON.stringify({ thread_id: 'private', version: '0.121.0' }))).toThrow(/unsupported/i);
  expect(() => parseDiscoveryFrame('x'.repeat(1_048_577))).toThrow(/oversized/i);
});
test('accepts only bounded discovery facts', () => {
  expect(parseDiscoveryFrame(JSON.stringify({ version: '0.121.0', authenticated: false, capabilities: ['develop'] }))).toEqual({ version: '0.121.0', authenticated: false, capabilities: ['develop'] });
});
