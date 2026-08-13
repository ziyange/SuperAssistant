import { describe, expect, test } from 'vitest';
import { classifyGoalActions, routeSingleCandidate } from '../src/routing.js';

describe('goal action classification', () => {
  test('keeps a read-only query outside the authorization flow', () => {
    expect(classifyGoalActions(['READ'])).toEqual({ kind: 'READ_ONLY', actions: ['READ'] });
  });

  test.each(['FILE_WRITE', 'COMMAND', 'NETWORK', 'EXTERNAL_WRITE', 'CREDENTIAL'] as const)('requires authorization for %s', (action) => {
    expect(classifyGoalActions(['READ', action])).toEqual({
      kind: 'SIDE_EFFECTING',
      actions: ['READ', action]
    });
  });

  test('refuses to guess when multiple Project functions can satisfy the goal', () => {
    const candidates = [{ projectId: 'project-a', agentId: 'agent-a', functionId: 'function-a' }, { projectId: 'project-b', agentId: 'agent-b', functionId: 'function-b' }];
    expect(routeSingleCandidate(candidates)).toEqual({ status: 'AMBIGUOUS', candidates });
  });
});
