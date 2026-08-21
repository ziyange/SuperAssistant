/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { projectTask, type TaskProjection } from '@super-assistant/domain';

export class SqliteTaskProjectionQuery {
  constructor(private readonly database: Database.Database) {}

  get(taskId: string): TaskProjection | null {
    const row = this.database.prepare(`SELECT t.task_id, p.name AS project_name, a.name AS agent_name, pv.objective,
      ea.state AS attempt_state, t.created_at
      FROM tasks t
      JOIN proposal_versions pv ON pv.proposal_version_id = t.proposal_version_id
      JOIN projects p ON p.project_id = t.project_id
      JOIN work_items wi ON wi.task_id = t.task_id
      JOIN agents a ON a.agent_id = wi.agent_id
      LEFT JOIN execution_attempts ea ON ea.work_item_id = wi.work_item_id
      WHERE t.task_id = ? ORDER BY ea.created_at DESC LIMIT 1`).get(taskId) as Record<string, unknown> | undefined;
    return row ? this.toProjection(row) : null;
  }

  list(): readonly TaskProjection[] {
    const rows = this.database.prepare(`SELECT t.task_id, p.name AS project_name, a.name AS agent_name, pv.objective,
      ea.state AS attempt_state, t.created_at
      FROM tasks t
      JOIN proposal_versions pv ON pv.proposal_version_id = t.proposal_version_id
      JOIN projects p ON p.project_id = t.project_id
      JOIN work_items wi ON wi.task_id = t.task_id
      JOIN agents a ON a.agent_id = wi.agent_id
      LEFT JOIN execution_attempts ea ON ea.work_item_id = wi.work_item_id
      WHERE ea.attempt_id IS NULL OR ea.created_at = (SELECT MAX(latest.created_at) FROM execution_attempts latest WHERE latest.work_item_id = wi.work_item_id)
      ORDER BY t.created_at DESC`).all() as Record<string, unknown>[];
    return rows.map((row) => this.toProjection(row));
  }

  private toProjection(row: Record<string, unknown>): TaskProjection {
    return projectTask({ taskId: String(row.task_id), goal: String(row.objective), projectName: String(row.project_name), agentName: String(row.agent_name), updatedAt: String(row.created_at), attemptState: row.attempt_state ? String(row.attempt_state) : 'CREATED', cancellation: 'NONE', activity: [] });
  }
}
