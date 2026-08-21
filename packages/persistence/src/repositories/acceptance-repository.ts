/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';

export interface AcceptanceEvidence { evidenceId: string; taskId: string; workItemId: string; attemptId: string; artifactVersionId: string; evaluatorId: string; outcome: 'ACCEPTED' | 'REJECTED'; createdAt: string; }

export class SqliteAcceptanceRepository {
  constructor(private readonly database: Database.Database) {}
  append(evidence: AcceptanceEvidence): void { this.database.prepare('INSERT INTO acceptance_evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(evidence.evidenceId, evidence.taskId, evidence.workItemId, evidence.attemptId, evidence.artifactVersionId, evidence.evaluatorId, evidence.outcome, evidence.createdAt); }
  listForTask(taskId: string): readonly AcceptanceEvidence[] { return this.database.prepare('SELECT * FROM acceptance_evidence WHERE task_id = ? ORDER BY created_at, evidence_id').all(taskId).map((row) => { const value = row as Record<string, unknown>; return { evidenceId: String(value.evidence_id), taskId: String(value.task_id), workItemId: String(value.work_item_id), attemptId: String(value.attempt_id), artifactVersionId: String(value.artifact_version_id), evaluatorId: String(value.evaluator_id), outcome: String(value.outcome) as AcceptanceEvidence['outcome'], createdAt: String(value.created_at) }; }); }
}
