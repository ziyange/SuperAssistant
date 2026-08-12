import { describe, expect, test } from 'vitest';
import { effectiveAgentPresentation, isValidAgentState } from '../src/agent-state.js';

describe('Agent connection and availability', () => {
  test.each([['CONNECTED', 'AVAILABLE', true], ['AUTH_REQUIRED', 'AVAILABLE', false], ['UNAVAILABLE', 'AVAILABLE', false], ['DISABLED', 'AVAILABLE', false], ['CONNECTED', 'ERROR', true]] as const)('validates %s / %s as %s', (connection, availability, valid) => expect(isValidAgentState(connection, availability)).toBe(valid));
  test('connection problems take display precedence', () => {
    expect(effectiveAgentPresentation({ connection: 'AUTH_REQUIRED', availability: 'ERROR' })).toBe('AUTH_REQUIRED');
    expect(effectiveAgentPresentation({ connection: 'CONNECTED', availability: 'SATURATED' })).toBe('SATURATED');
  });
});
