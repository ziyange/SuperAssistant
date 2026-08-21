import { expect, test } from 'vitest';
import { createDecision } from '../src/decision.js';
import { resolveDecisionAndPrepareResume } from '../src/decision-resolution.js';

const decision = createDecision({
  decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1',
  taskId: 'task-1', workItemId: 'work-item-1', question: 'Grant access?',
  level: 'L3', createdAt: '2026-08-21T00:00:00.000Z'
});
const resolution = { resolutionId: 'resolution-1', idempotencyKey: 'resolve-1', actorId: 'user-1', option: 'ALLOW' as const, resolvedAt: '2026-08-21T00:01:00.000Z' };

test('prepares exactly one resume only for the first valid resolution', () => {
  const first = resolveDecisionAndPrepareResume(decision, resolution, 'WAITING_USER', true);
  expect(first.resume).toEqual({ decisionId: 'decision-1', workItemId: 'work-item-1', resolutionId: 'resolution-1' });
  expect(resolveDecisionAndPrepareResume(first.decision, resolution, 'WAITING_USER', true).resume).toBeUndefined();
});

test.each(['UNKNOWN', 'RECONCILING'] as const)('does not resolve or prepare a resume for an ambiguous %s Attempt', (state) => {
  expect(() => resolveDecisionAndPrepareResume(decision, resolution, state, true)).toThrow('Attempt must reconcile before a Decision can resume work');
});
