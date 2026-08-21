/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createQualityEvidence, type QualityEvidence } from '@super-assistant/domain';
export class SqliteQualityEvidenceRepository {
  constructor(private readonly database: Database.Database) {}
  append(input: QualityEvidence): void { const value = createQualityEvidence(input); this.database.prepare('INSERT INTO quality_evidence(task_id, work_item_id, executor_agent_id, evaluator_agent_id, role, outcome) VALUES (?, ?, ?, ?, ?, ?)').run(value.taskId, value.workItemId, value.executorAgentId, value.evaluatorAgentId, value.role, value.outcome); }
  list(taskId: string): readonly QualityEvidence[] { return (this.database.prepare('SELECT * FROM quality_evidence WHERE task_id = ? ORDER BY evidence_id').all(taskId) as Array<Record<string, unknown>>).map((row) => createQualityEvidence({ taskId: String(row.task_id), workItemId: String(row.work_item_id), executorAgentId: String(row.executor_agent_id), evaluatorAgentId: String(row.evaluator_agent_id), role: String(row.role) as QualityEvidence['role'], outcome: String(row.outcome) as QualityEvidence['outcome'] })); }
}
