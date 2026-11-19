/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { projectTask, type TaskProjection } from '@super-assistant/domain';

// Read-only guard: recovery and display have no authority to accept work.
// Only inspect evidence for a Task that was actually finalized.
const completedWithEvidence = `CASE WHEN t.state = 'COMPLETED' AND ea.state = 'SUCCEEDED' THEN
  NOT EXISTS (SELECT 1 FROM decisions d WHERE d.task_id=t.task_id AND d.status='OPEN')
  AND NOT EXISTS (
    SELECT 1 FROM work_items item WHERE item.task_id=t.task_id
    AND (item.state<>'ACCEPTED' OR NOT EXISTS (
      SELECT 1 FROM execution_attempts last
      JOIN acceptance_evidence e ON e.task_id=t.task_id AND e.work_item_id=item.work_item_id AND e.attempt_id=last.attempt_id
      JOIN artifact_versions av ON av.artifact_version_id=e.artifact_version_id AND av.task_id=t.task_id
        AND av.work_item_id=item.work_item_id AND av.attempt_id=last.attempt_id AND av.project_id=t.project_id
        AND av.authorization_grant_id=t.authorization_grant_id AND av.baseline_commit=pv.baseline_commit
      WHERE last.work_item_id=item.work_item_id AND last.state='SUCCEEDED' AND e.outcome='ACCEPTED'
        AND length(trim(e.evaluator_id))>0 AND length(av.checksum)=71 AND substr(av.checksum,1,7)='sha256:'
        AND substr(av.checksum,8) NOT GLOB '*[^0-9a-f]*'
        AND NOT EXISTS (SELECT 1 FROM execution_attempts newer WHERE newer.work_item_id=item.work_item_id
          AND newer.attempt_id<>last.attempt_id AND newer.created_at>=last.created_at)
        AND NOT EXISTS (SELECT 1 FROM acceptance_evidence rejection WHERE rejection.task_id=t.task_id
          AND rejection.work_item_id=item.work_item_id AND rejection.attempt_id=last.attempt_id
          AND rejection.outcome='REJECTED' AND rejection.created_at>=e.created_at)
    ))
  ) ELSE 0 END`;

export class SqliteTaskProjectionQuery {
  constructor(private readonly database: Database.Database) {}

  get(taskId: string): TaskProjection | null {
    const row = this.database.prepare(`SELECT t.task_id, p.name AS project_name, a.name AS agent_name, pv.objective,
      ea.state AS attempt_state, t.created_at, ${completedWithEvidence} AS completed_with_evidence
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
      ea.state AS attempt_state, t.created_at, ${completedWithEvidence} AS completed_with_evidence
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
    return projectTask({ taskId: String(row.task_id), goal: String(row.objective), projectName: String(row.project_name), agentName: String(row.agent_name), updatedAt: String(row.created_at), attemptState: row.attempt_state ? String(row.attempt_state) : 'CREATED', completedWithEvidence: row.completed_with_evidence === 1, cancellation: 'NONE', activity: [] });
  }
}
