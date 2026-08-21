import { describe, expect, test } from 'vitest';
import { validateRequest } from '../../src/main/ipc-schemas.js';

describe('IPC request validation', () => {
  test('accepts the bounded onboarding read channel', () => {
    expect(validateRequest({ channel: 'onboarding:get', payload: {} })).toEqual({ channel: 'onboarding:get', payload: {} });
  });

  test('accepts only a bounded Decision identifier for a Decision read', () => {
    expect(validateRequest({ channel: 'decision:get', payload: { decisionId: 'decision-1' } })).toEqual({ channel: 'decision:get', payload: { decisionId: 'decision-1' } });
    expect(() => validateRequest({ channel: 'decision:get', payload: { decisionId: 'decision-1', fingerprint: 'private' } })).toThrow();
  });

  test('accepts only a bounded Task identifier for Decision listing', () => {
    expect(validateRequest({ channel: 'decision:list', payload: { taskId: 'task-1' } })).toEqual({ channel: 'decision:list', payload: { taskId: 'task-1' } });
    expect(() => validateRequest({ channel: 'decision:list', payload: {} })).toThrow();
  });

  test.each([{ channel: 'shell:execute', payload: {} }, { channel: 'onboarding:get', payload: { extra: true } }, { channel: 'onboarding:set', payload: { completed: true, projectPath: '../escape' } }, { channel: 'onboarding:set', payload: { completed: 'yes' } }, { channel: 'onboarding:get', payload: { text: 'x'.repeat(1_048_577) } }])('rejects untrusted request %#', (request) => {
    expect(() => validateRequest(request)).toThrow();
  });
});
