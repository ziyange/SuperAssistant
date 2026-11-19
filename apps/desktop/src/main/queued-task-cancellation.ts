/* eslint-disable no-unused-vars -- constructor properties and interface arguments describe the main-process contract. */
import type Database from 'better-sqlite3';
import { SqliteResourceLeaseRepository } from '@super-assistant/persistence';
import type { QueuedCancellationStatus } from '../shared/ipc-contract.js';
import { findLocalWorkspace } from './local-workspace.js';

interface Snapshot {
  task_id: string; work_item_id: string; attempt_id: string; message_id: string; lease_id: string; fencing_token: number;
  task_state: string; work_state: string; attempt_state: string; outbox_state: string; lease_state: string;
  payload_json: string;
}

export class QueuedTaskCancellation {
  private readonly prompting = new Set<string>();

  constructor(private readonly db: Database.Database, private readonly confirmInMain: (taskId: string) => Promise<boolean>,
    private readonly now: () => string = () => new Date().toISOString()) {}

  async cancel(taskId: string): Promise<QueuedCancellationStatus> {
    if (typeof taskId !== 'string' || taskId.length === 0 || taskId.length > 128 || /[^a-z0-9_-]/i.test(taskId) || this.prompting.has(taskId)) return 'NOT_CANCELLABLE';
    this.prompting.add(taskId);
    try {
      const original = this.db.transaction(() => this.snapshot(taskId))();
      if (!original) return 'NOT_CANCELLABLE';
      if (this.matches(original, 'CANCELLED', 'CANCELLED', 'CANCELLED', 'CANCELLED', 'RELEASED')) return 'CANCELLED';
      if (!this.pending(original)) return 'NOT_CANCELLABLE';
      if (await this.confirmInMain(taskId) !== true) return 'DISMISSED';
      return this.db.transaction((): QueuedCancellationStatus => {
        const current = this.snapshot(taskId);
        if (!current || !this.pending(current) || JSON.stringify(current) !== JSON.stringify(original)) return 'NOT_CANCELLABLE';
        const releasedAt = this.now();
        const parsed = Date.parse(releasedAt);
        if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== releasedAt) return 'NOT_CANCELLABLE';
        const outbox = this.db.prepare("UPDATE outbox SET state = 'CANCELLED' WHERE message_id = ? AND state = 'PENDING' AND claim_token IS NULL").run(current.message_id);
        const attempt = this.db.prepare("UPDATE execution_attempts SET state = 'CANCELLED' WHERE attempt_id = ? AND state = 'DISPATCH_PENDING' AND last_sequence = 0").run(current.attempt_id);
        const work = this.db.prepare("UPDATE work_items SET state = 'CANCELLED' WHERE work_item_id = ? AND state = 'WAITING'").run(current.work_item_id);
        const task = this.db.prepare("UPDATE tasks SET state = 'CANCELLED' WHERE task_id = ? AND state = 'QUEUED'").run(current.task_id);
        if ([outbox, attempt, work, task].some(result => result.changes !== 1) ||
          !new SqliteResourceLeaseRepository(this.db).release(current.lease_id, current.fencing_token, releasedAt)) throw new Error('CANCEL_CONFLICT');
        return 'CANCELLED';
      }).immediate();
    } catch {
      return 'NOT_CANCELLABLE';
    } finally {
      this.prompting.delete(taskId);
    }
  }

  private matches(row: Snapshot, task: string, work: string, attempt: string, outbox: string, lease: string): boolean {
    return row.task_state === task && row.work_state === work && row.attempt_state === attempt && row.outbox_state === outbox && row.lease_state === lease;
  }

  private pending(row: Snapshot): boolean { return this.matches(row, 'QUEUED', 'WAITING', 'DISPATCH_PENDING', 'PENDING', 'ACTIVE'); }

  private snapshot(taskId: string): Snapshot | undefined {
    const workspace = findLocalWorkspace(this.db);
    if (!workspace) return undefined;
    const row = this.db.prepare(`
      SELECT t.task_id, w.work_item_id, a.attempt_id, o.message_id, l.lease_id, l.fencing_token, o.payload_json,
        t.state AS task_state, w.state AS work_state, a.state AS attempt_state, o.state AS outbox_state, l.state AS lease_state
      FROM tasks t
      JOIN projects project ON project.project_id = t.project_id AND project.workspace_id = t.workspace_id
      JOIN proposal_versions p ON p.proposal_version_id = t.proposal_version_id AND p.workspace_id = t.workspace_id AND p.project_id = t.project_id
      JOIN authorization_grants g ON g.grant_id = t.authorization_grant_id AND g.proposal_version_id = p.proposal_version_id
        AND g.proposal_digest = p.digest AND g.actor_id = 'local-owner' AND g.status = 'CONSUMED'
      JOIN work_items w ON w.task_id = t.task_id AND w.agent_id = p.agent_id AND w.function_id = p.function_id
      JOIN execution_attempts a ON a.work_item_id = w.work_item_id
      JOIN outbox o ON o.attempt_id = a.attempt_id AND o.message_id = 'outbox:' || a.attempt_id
        AND o.message_type = 'start' AND o.idempotency_key = a.idempotency_key AND o.request_id = a.request_id AND o.claim_token IS NULL
      JOIN resource_leases l ON l.attempt_id = a.attempt_id AND l.resource_key = 'project:' || t.project_id
      WHERE t.task_id = ? AND t.workspace_id = ? AND a.last_sequence = 0
        AND NOT EXISTS (SELECT 1 FROM work_items AS other WHERE other.task_id = t.task_id AND other.work_item_id <> w.work_item_id)
        AND NOT EXISTS (SELECT 1 FROM execution_attempts AS other WHERE other.work_item_id = w.work_item_id AND other.attempt_id <> a.attempt_id)
        AND NOT EXISTS (SELECT 1 FROM outbox AS other WHERE other.attempt_id = a.attempt_id AND other.message_id <> o.message_id)
        AND NOT EXISTS (SELECT 1 FROM resource_leases AS other WHERE other.attempt_id = a.attempt_id AND other.lease_id <> l.lease_id)
        AND (l.state = 'RELEASED' OR NOT EXISTS (
          SELECT 1 FROM resource_leases AS history
          WHERE history.resource_key IN (l.resource_key, 'worktree:' || t.project_id) AND history.lease_id <> l.lease_id
            AND (history.state <> 'RELEASED' OR history.fencing_token >= l.fencing_token)
        ))
        AND NOT EXISTS (SELECT 1 FROM fixture_attempt_correlations AS evidence WHERE evidence.attempt_id = a.attempt_id)
    `).get(taskId, workspace) as Snapshot | undefined;
    if (!row || !Number.isSafeInteger(row.fencing_token) || row.fencing_token <= 0) return undefined;
    const payload: unknown = JSON.parse(row.payload_json);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length !== 1
      || !('attempt_id' in payload) || payload.attempt_id !== row.attempt_id) return undefined;
    return row;
  }
}
