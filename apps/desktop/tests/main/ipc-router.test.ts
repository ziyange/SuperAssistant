import { describe, expect, test } from 'vitest';
import { validateRequest } from '../../src/main/ipc-schemas.js';
import { routeIpc } from '../../src/main/ipc-router.js';

describe('IPC request validation', () => {
  test('rejects unknown or malformed action types at the IPC boundary', () => {
    expect(validateRequest({ channel: 'proposal:classify', payload: { actions: ['READ'] } })).toEqual({ channel: 'proposal:classify', payload: { actions: ['READ'] } });
    expect(() => validateRequest({ channel: 'proposal:classify', payload: { actions: ['READ', 'SHELL'] } })).toThrow();
    expect(() => validateRequest({ channel: 'proposal:classify', payload: { actions: [null] } })).toThrow();
    expect(() => validateRequest({ channel: 'proposal:classify', payload: { actions: [] } })).toThrow();
    expect(() => validateRequest({ channel: 'proposal:classify', payload: { actions: new Array(1) } })).toThrow();
  });
  test('routes a validated check only to the injected main-process service', async () => {
    let calls = 0;
    const onboarding = { async get() { return { completed: false }; }, async set(value: { completed: boolean }) { return value; } };
    const check = async () => { calls += 1; return { state: 'CANCELLED' as const }; };
    const result = await routeIpc({ channel: 'codex:check', payload: {} }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, check);
    expect(result).toEqual({ codex: { state: 'CANCELLED' } });
    expect(calls).toBe(1);
    await expect(routeIpc({ channel: 'codex:check', payload: { path: 'C:/evil.exe' } }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, check)).rejects.toThrow();
    expect(calls).toBe(1);
  });
  test('Codex check accepts no renderer-provided executable or arguments', () => {
    expect(validateRequest({ channel: 'codex:check', payload: {} })).toEqual({ channel: 'codex:check', payload: {} });
    expect(() => validateRequest({ channel: 'codex:check', payload: { path: 'C:/evil.exe' } })).toThrow();
    expect(() => validateRequest({ channel: 'codex:check', payload: { args: ['--yolo'] } })).toThrow();
  });
  test('accepts only empty Project picker and list payloads', () => {
    for (const channel of ['project:list', 'project:choose']) {
      expect(validateRequest({ channel, payload: {} })).toEqual({ channel, payload: {} });
      expect(() => validateRequest({ channel, payload: { path: 'C:/secret' } })).toThrow();
      expect(() => validateRequest({ channel, payload: { workspaceId: 'other' } })).toThrow();
    }
  });
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
