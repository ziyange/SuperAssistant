/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createAuditExport, type AuditExport, type AuditExportScope } from '@super-assistant/domain';

export class SqliteAuditExportRepository {
  constructor(private readonly database: Database.Database) {}

  export(scope: AuditExportScope, generatedAt: string): AuditExport {
    const records = (this.database.prepare('SELECT activity_id, task_id, attempt_id, sequence, event_type, occurred_at FROM activity_history WHERE workspace_id = ? AND project_id = ? ORDER BY occurred_at, sequence, activity_id').all(scope.workspaceId, scope.projectId) as Array<Record<string, unknown>>)
      .map((row) => ({ kind: 'ACTIVITY', activityId: String(row.activity_id), taskId: String(row.task_id), attemptId: String(row.attempt_id), sequence: Number(row.sequence), eventType: String(row.event_type), occurredAt: String(row.occurred_at) }));
    const audit = createAuditExport({ scope, generatedAt, records });
    this.database.prepare('INSERT OR IGNORE INTO audit_exports VALUES (?, ?, ?, ?, ?, ?, ?)').run(`audit:${audit.manifest.checksum}`, scope.workspaceId, scope.projectId, generatedAt, audit.manifest.checksum, audit.manifest.recordCount, JSON.stringify(audit.records));
    return audit;
  }
}
