import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteTaskProjectionQuery } from '../src/queries/task-projection.js';

function seedTask(db: ReturnType<typeof createFoundationDatabase>, attemptState: string): void {
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'owner-1', 'Workspace', 'ACTIVE', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('proposal-1', 'workspace-1', 'project-1', 'agent-1', 'function-1', '<b>Fix parser</b>', '[]', '1', '1.0.0', '1.0.0', '1.0.0', 'base', '2026-08-14T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 'sha256:abc');
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', 'proposal-1', 'sha256:abc', 'actor-1', 'grant-key-1', '[]', 'CONSUMED', '2026-08-12T00:00:00.000Z', '2026-08-14T00:00:00.000Z');
  db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('task-1', 'workspace-1', 'project-1', 'proposal-1', 'grant-1', 'QUEUED', '2026-08-12T00:00:00.000Z');
  db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run('work-1', 'task-1', 'agent-1', 'function-1', 'WAITING');
  db.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)').run('attempt-1', 'work-1', 'request-1', 'key-1', attemptState, 1, '2026-08-12T00:00:00.000Z');
}

test('rebuilds reconciliation display state from persisted Task facts', () => {
  const db = createFoundationDatabase(':memory:'); seedTask(db, 'RECONCILING');
  expect(new SqliteTaskProjectionQuery(db).get('task-1')).toEqual(expect.objectContaining({ goal: 'bFix parser/b', state: 'RUNNING / RECONCILING' }));
  db.close();
});
