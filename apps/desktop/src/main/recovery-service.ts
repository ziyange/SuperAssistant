/* eslint-disable no-unused-vars -- parameter names are part of this public port contract. */
import { reconcileAttempt, type RecoveryObservation, type RecoveryOutcome, type RecoveryState } from '@super-assistant/domain';
import type Database from 'better-sqlite3';
import { SqliteOutboxRepository } from '@super-assistant/persistence';

export function recoverLocalStartup(database: Database.Database): { orphanedClaims: number; inFlightAttempts: number } {
  return database.transaction(() => {
    const workspaces = database.prepare("SELECT workspace_id, status FROM workspaces WHERE owner_id = 'local-owner' AND status IN ('ACTIVE', 'LOCKED') ORDER BY workspace_id LIMIT 2").all() as { workspace_id: string; status: string }[];
    const workspace = workspaces[0];
    if (workspaces.length !== 1 || !workspace || workspace.status !== 'ACTIVE') return { orphanedClaims: 0, inFlightAttempts: 0 };
    const orphanedClaims = new SqliteOutboxRepository(database).recoverInterrupted(workspace.workspace_id);
    const inFlightAttempts = database.prepare(`
      UPDATE execution_attempts SET state = 'UNKNOWN'
      WHERE state IN ('DISPATCHED', 'RUNNING', 'CANCELLING', 'WAITING_USER', 'WAITING_INPUT')
        AND work_item_id IN (SELECT w.work_item_id FROM work_items w JOIN tasks t ON w.task_id = t.task_id WHERE t.workspace_id = ?)
    `).run(workspace.workspace_id).changes;
    return { orphanedClaims, inFlightAttempts };
  }).immediate();
}

export interface RecoveryAdapterPort {
  status(attemptId: string): Promise<RecoveryObservation['status']>;
  events(attemptId: string): Promise<RecoveryObservation['events']>;
  result(attemptId: string): Promise<RecoveryObservation['result']>;
}

export async function reconcileAfterRestart(attempts: readonly Readonly<{ attemptId: string; state: RecoveryState; lastSequence: number }>[], adapter: RecoveryAdapterPort): Promise<Readonly<{ mode: 'NORMAL' | 'DEGRADED_READ_ONLY'; attempts: readonly RecoveryOutcome[] }>> {
  const outcomes = await Promise.all(attempts.map(async (attempt) => reconcileAttempt(attempt, {
    status: await adapter.status(attempt.attemptId),
    events: await adapter.events(attempt.attemptId),
    result: await adapter.result(attempt.attemptId)
  })));
  return { mode: outcomes.some((outcome) => outcome.state === 'RECONCILING') ? 'DEGRADED_READ_ONLY' : 'NORMAL', attempts: outcomes };
}
