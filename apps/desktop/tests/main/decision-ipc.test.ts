import { expect, test } from 'vitest';
import { listDecisionsForRenderer, projectDecisionForRenderer } from '../../src/main/decision-ipc.js';

test('projects one open Decision without adapter-native identifiers', () => {
  const decision = projectDecisionForRenderer({ get: () => ({ decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-1', question: 'Grant network access?', level: 'L3', fingerprint: 'private-fingerprint', status: 'OPEN', createdAt: '2026-08-21T00:00:00.000Z' }) }, { decisionId: 'decision-1' });
  expect(decision).toEqual({ decisionId: 'decision-1', taskId: 'task-1', question: 'Grant network access?', level: 'L3', status: 'OPEN' });
  expect(JSON.stringify(decision)).not.toContain('fingerprint');
});

test('lists the same open Decision for its Task without private scope fields', () => {
  expect(listDecisionsForRenderer({ get: () => null, listForTask: () => [{ decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-1', question: 'Grant network access?', level: 'L3', fingerprint: 'private', status: 'OPEN', createdAt: '2026-08-21T00:00:00.000Z' }] }, { taskId: 'task-1' })).toEqual([{ decisionId: 'decision-1', taskId: 'task-1', question: 'Grant network access?', level: 'L3', status: 'OPEN' }]);
});
