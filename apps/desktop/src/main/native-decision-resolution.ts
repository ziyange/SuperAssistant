/* eslint-disable no-unused-vars -- presenter and repository parameter names describe the boundary. */
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { SqliteDecisionRepository } from '@super-assistant/persistence';
import { findLocalWorkspace } from './local-workspace.js';

export type NativeDecisionContext = Readonly<{ decisionId: string; taskId: string; project: string; goal: string; question: string; level: 'L3' | 'L4' }>;
export type DecisionReviewStatus = 'RECORDED' | 'DISMISSED' | 'UNAVAILABLE';

function safeText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limit && value.trim() === value
    && !/[\p{Cc}\p{Cf}]/u.test(value);
}

let activePrompt = false;
export class NativeDecisionResolution {
  constructor(private readonly db: Database.Database, private readonly repository: SqliteDecisionRepository,
    private readonly present: (context: NativeDecisionContext) => Promise<'ALLOW' | 'DENY' | null>,
    private readonly clock: () => string = () => new Date().toISOString()) {}

  async review(decisionId: string): Promise<DecisionReviewStatus> {
    if (typeof decisionId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(decisionId) || activePrompt) return 'UNAVAILABLE';
    activePrompt = true;
    try {
      const original = this.snapshot(decisionId);
      if (!original) return 'UNAVAILABLE';
      const before = JSON.stringify(original);
      const choice = await this.present(Object.freeze({ ...original.view }));
      if (choice === null) return 'DISMISSED';
      if (choice !== 'ALLOW' && choice !== 'DENY') return 'UNAVAILABLE';
      const current = this.snapshot(decisionId);
      if (!current || JSON.stringify(current) !== before) return 'UNAVAILABLE';
      this.repository.resolveAndEnqueueResume(decisionId, {
        resolutionId: randomUUID(), idempotencyKey: randomUUID(), actorId: 'local-owner', option: choice, resolvedAt: this.clock()
      }, () => JSON.stringify(this.snapshot(decisionId)) === before);
      return 'RECORDED';
    } catch { return 'UNAVAILABLE'; } finally { activePrompt = false; }
  }

  private snapshot(decisionId: string): { view: NativeDecisionContext; binding: readonly unknown[] } | null {
    const workspace = findLocalWorkspace(this.db);
    if (!workspace) return null;
    const rows = this.db.prepare(`
      SELECT d.decision_id,d.task_id,d.question,d.level,d.fingerprint,p.name AS project,v.objective AS goal,
        d.workspace_id,d.project_id,d.work_item_id,a.attempt_id,a.request_id,a.idempotency_key,
        t.authorization_grant_id,t.proposal_version_id,v.digest,w.agent_id,w.function_id
      FROM decisions d JOIN tasks t ON t.task_id=d.task_id AND t.workspace_id=d.workspace_id AND t.project_id=d.project_id
      JOIN projects p ON p.project_id=t.project_id AND p.workspace_id=t.workspace_id AND p.status='ACTIVE'
      JOIN proposal_versions v ON v.proposal_version_id=t.proposal_version_id AND v.workspace_id=t.workspace_id AND v.project_id=t.project_id
      JOIN work_items w ON w.work_item_id=d.work_item_id AND w.task_id=t.task_id
      JOIN execution_attempts a ON a.work_item_id=w.work_item_id AND a.state IN ('WAITING_USER','WAITING_INPUT')
      WHERE d.decision_id=? AND d.workspace_id=? AND d.status='OPEN' AND t.state IN ('QUEUED','RUNNING')
    `).all(decisionId, workspace) as Array<{ decision_id: string; task_id: string; question: string; level: string; project: string; goal: string; fingerprint: string; workspace_id: string; project_id: string; work_item_id: string; attempt_id: string; request_id: string; idempotency_key: string; authorization_grant_id: string; proposal_version_id: string; digest: string; agent_id: string; function_id: string }>;
    const row = rows[0];
    if (rows.length !== 1 || !row || !/^[a-z0-9_-]{1,128}$/i.test(row.task_id) || !safeText(row.project, 200)
      || !safeText(row.goal, 500) || !safeText(row.question, 1000) || (row.level !== 'L3' && row.level !== 'L4')) return null;
    return { view: { decisionId: row.decision_id, taskId: row.task_id, project: row.project, goal: row.goal, question: row.question, level: row.level },
      binding: [row.fingerprint, row.workspace_id, row.project_id, row.work_item_id, row.attempt_id, row.request_id, row.idempotency_key,
        row.authorization_grant_id, row.proposal_version_id, row.digest, row.agent_id, row.function_id] };
  }
}
