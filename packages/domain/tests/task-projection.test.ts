import { expect, test } from 'vitest';
import { projectTask } from '../src/task-projection.js';

test('projects reconciliation and cancellation truth without provider-native identifiers', () => {
  expect(projectTask({ taskId: 'task-1', goal: '<b>Fix</b>', projectName: 'Project', agentName: 'Codex', updatedAt: '2026-08-14T00:00:00.000Z', attemptState: 'RECONCILING', cancellation: 'NONE', activity: ['turn_123 <img>'] })).toEqual(expect.objectContaining({ state: 'RUNNING / RECONCILING', activity: ['turn_123 img'] }));
  expect(projectTask({ taskId: 'task-1', goal: 'Fix', projectName: 'Project', agentName: 'Codex', updatedAt: '2026-08-14T00:00:00.000Z', attemptState: 'CANCELLING', cancellation: 'TERMINATING', activity: [] }).state).toBe('CANCELLING');
});

test('does not project unknown work as failed or completed', () => {
  expect(projectTask({ taskId: 'task-1', goal: 'Fix', projectName: 'Project', agentName: 'Codex', updatedAt: '2026-08-14T00:00:00.000Z', attemptState: 'UNKNOWN', cancellation: 'NONE', activity: [] }).state).toBe('RUNNING / RECONCILING');
});
