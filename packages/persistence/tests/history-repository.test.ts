import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteHistoryRepository } from '../src/repositories/history-repository.js';

test('keeps Activity and Human History append-only and Project-scoped', () => {
  const database = createFoundationDatabase(':memory:'); const history = new SqliteHistoryRepository(database);
  history.appendActivity({ activityId: 'activity-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', attemptId: 'attempt-1', sequence: 1, eventType: 'EXECUTION_STARTED', occurredAt: '2026-08-21T00:00:00.000Z' });
  history.appendHuman({ historyId: 'human-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', decisionId: 'decision-1', actorId: 'user-1', action: 'DECISION_RESOLVED', sourceVersion: 'decision-1', occurredAt: '2026-08-21T00:01:00.000Z' });
  expect(history.listForTask({ workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1' })).toMatchObject({ activity: [{ activityId: 'activity-1' }], human: [{ historyId: 'human-1', actorId: 'user-1' }] });
  expect(history.listForTask({ workspaceId: 'workspace-2', projectId: 'project-1', taskId: 'task-1' })).toEqual({ activity: [], human: [] });
  expect(() => database.prepare("UPDATE human_history SET actor_id = 'other' WHERE history_id = 'human-1'").run()).toThrow(/append-only/);
  database.close();
});
