import { describe, expect, test } from 'vitest';
import { createDecision, resolveDecision } from '../src/decision.js';

const input = {
  decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-item-1',
  question: 'Grant network access?', level: 'L3' as const, createdAt: '2026-08-21T00:00:00.000Z'
};

describe('Decision', () => {
  test('creates a stable fingerprint for the same scoped question', () => {
    expect(createDecision(input).fingerprint).toBe(createDecision({ ...input, decisionId: 'decision-2', question: ' grant network access? ' }).fingerprint);
  });

  test('resolves an open Decision once and makes the same idempotency key harmless', () => {
    const open = createDecision(input);
    const resolved = resolveDecision(open, { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' });
    expect(resolveDecision(resolved, { resolutionId: 'resolution-2', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:02:00.000Z' })).toEqual(resolved);
  });

  test('rejects a different resolution key after resolution', () => {
    const resolved = resolveDecision(createDecision(input), { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' });
    expect(() => resolveDecision(resolved, { resolutionId: 'resolution-2', idempotencyKey: 'resolve-key-2', actorId: 'user-1', option: 'DENY', resolvedAt: '2026-08-21T00:02:00.000Z' })).toThrow('Decision is already resolved');
  });
});
