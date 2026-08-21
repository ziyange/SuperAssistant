/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createProjectChange, type ProjectChange } from '@super-assistant/domain';

function toChange(row: Record<string, unknown>): ProjectChange {
  return { changeId: String(row.change_id), workspaceId: String(row.workspace_id), projectId: String(row.project_id), taskId: String(row.task_id), workItemId: String(row.work_item_id), attemptId: String(row.attempt_id), agentId: String(row.agent_id), authorizationGrantId: String(row.authorization_grant_id), resourceKey: String(row.resource_key), baselineRevision: String(row.baseline_revision), resultRevision: String(row.result_revision), status: String(row.status) as ProjectChange['status'], ...(row.original_change_id ? { originalChangeId: String(row.original_change_id) } : {}), createdAt: String(row.created_at) };
}

export class SqliteProjectChangeRepository {
  constructor(private readonly database: Database.Database) {}

  append(input: ProjectChange): void {
    const change = createProjectChange(input);
    this.database.prepare('INSERT INTO project_changes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(change.changeId, change.workspaceId, change.projectId, change.taskId, change.workItemId, change.attemptId, change.agentId, change.authorizationGrantId, change.resourceKey, change.baselineRevision, change.resultRevision, change.status, change.originalChangeId ?? null, change.createdAt);
  }

  listForProject(scope: { workspaceId: string; projectId: string }): readonly ProjectChange[] {
    return (this.database.prepare('SELECT * FROM project_changes WHERE workspace_id = ? AND project_id = ? ORDER BY created_at, change_id').all(scope.workspaceId, scope.projectId) as Array<Record<string, unknown>>).map(toChange);
  }
}
