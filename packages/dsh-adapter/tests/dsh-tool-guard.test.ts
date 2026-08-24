import { expect, test } from 'vitest';
import { createDshToolGuard } from '../src/dsh-tool-guard.js';

test('DSH ToolGuard can only deny a capability that lacks a Broker grant', () => {
  const guard = createDshToolGuard({ authorize: request => request.target === 'fixture' ? { allowed: true } : { allowed: false, reason: 'TARGET_DENIED' } });
  expect(guard({ toolName: 'bash', target: 'fixture', grant: 'g', snapshot: 's', fence: 1 })).toBeUndefined();
  expect(guard({ toolName: 'bash', target: 'outside', grant: 'g', snapshot: 's', fence: 1 })).toBe('TARGET_DENIED');
});
