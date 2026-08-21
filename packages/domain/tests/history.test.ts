import { expect, test } from 'vitest';
import { createActivity, createHumanHistory } from '../src/history.js';

test('keeps Agent Activity and human actions as distinct immutable records', () => {
  const activity = createActivity({ activityId: 'activity-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', attemptId: 'attempt-1', sequence: 1, eventType: 'EXECUTION_STARTED', occurredAt: '2026-08-21T00:00:00.000Z' });
  const human = createHumanHistory({ historyId: 'human-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', decisionId: 'decision-1', actorId: 'user-1', action: 'DECISION_RESOLVED', sourceVersion: 'decision-1', occurredAt: '2026-08-21T00:01:00.000Z' });
  expect(activity.actorId).toBeUndefined();
  expect(human.attemptId).toBeUndefined();
  expect(() => createActivity({ ...activity, sequence: 0 })).toThrow('ACTIVITY_SEQUENCE_INVALID');
});
