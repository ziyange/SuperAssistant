/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createActivity, createHumanHistory, type Activity, type HumanHistory } from '@super-assistant/domain';

export class SqliteHistoryRepository {
  constructor(private readonly database: Database.Database) {}

  appendActivity(input: Activity): void {
    const activity = createActivity(input);
    this.database.prepare('INSERT INTO activity_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(activity.activityId, activity.workspaceId, activity.projectId, activity.taskId, activity.attemptId, activity.sequence, activity.eventType, activity.occurredAt);
  }

  appendHuman(input: HumanHistory): void {
    const record = createHumanHistory(input);
    this.database.prepare('INSERT INTO human_history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(record.historyId, record.workspaceId, record.projectId, record.taskId, record.decisionId ?? null, record.actorId, record.action, record.sourceVersion, record.occurredAt);
  }

  listForTask(scope: { workspaceId: string; projectId: string; taskId: string }): { activity: readonly Activity[]; human: readonly HumanHistory[] } {
    const activity = this.database.prepare('SELECT * FROM activity_history WHERE workspace_id = ? AND project_id = ? AND task_id = ? ORDER BY occurred_at, sequence, activity_id').all(scope.workspaceId, scope.projectId, scope.taskId) as Array<Record<string, unknown>>;
    const human = this.database.prepare('SELECT * FROM human_history WHERE workspace_id = ? AND project_id = ? AND task_id = ? ORDER BY occurred_at, history_id').all(scope.workspaceId, scope.projectId, scope.taskId) as Array<Record<string, unknown>>;
    return { activity: activity.map((row) => ({ activityId: String(row.activity_id), workspaceId: String(row.workspace_id), projectId: String(row.project_id), taskId: String(row.task_id), attemptId: String(row.attempt_id), sequence: Number(row.sequence), eventType: String(row.event_type), occurredAt: String(row.occurred_at) })), human: human.map((row) => ({ historyId: String(row.history_id), workspaceId: String(row.workspace_id), projectId: String(row.project_id), taskId: String(row.task_id), ...(row.decision_id ? { decisionId: String(row.decision_id) } : {}), actorId: String(row.actor_id), action: String(row.action) as HumanHistory['action'], sourceVersion: String(row.source_version), occurredAt: String(row.occurred_at) })) };
  }
}
