import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteAuditExportRepository } from '../src/repositories/audit-export-repository.js';

test('persists a scoped manifest and excludes records owned by another Project', () => {
  const database = createFoundationDatabase(':memory:');
  database.prepare('INSERT INTO activity_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('activity-1', 'workspace-1', 'project-1', 'task-1', 'attempt-1', 1, 'EXECUTION_STARTED', '2026-08-21T00:00:00.000Z');
  database.prepare('INSERT INTO activity_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('activity-2', 'workspace-1', 'project-2', 'task-2', 'attempt-2', 1, 'EXECUTION_STARTED', '2026-08-21T00:00:00.000Z');

  const exported = new SqliteAuditExportRepository(database).export({ workspaceId: 'workspace-1', projectId: 'project-1' }, '2026-08-21T00:00:01.000Z');

  expect(exported.records).toEqual([{ kind: 'ACTIVITY', activityId: 'activity-1', taskId: 'task-1', attemptId: 'attempt-1', sequence: 1, eventType: 'EXECUTION_STARTED', occurredAt: '2026-08-21T00:00:00.000Z' }]);
  expect(database.prepare('SELECT scope_workspace_id, scope_project_id, checksum FROM audit_exports').all()).toEqual([{ scope_workspace_id: 'workspace-1', scope_project_id: 'project-1', checksum: exported.manifest.checksum }]);
  database.close();
});
