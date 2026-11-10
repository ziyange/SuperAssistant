/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { classifyGoalActions, createProposalVersion, type GoalAction } from '@super-assistant/domain';
import { SqliteResourceLeaseRepository } from './resource-lease-repository.js';
import { SqliteProposalRepository } from './proposal-repository.js';

export class SqliteExecutionRepository {
  constructor(private readonly database: Database.Database, private readonly clock: () => string = () => new Date().toISOString(), private readonly principal: () => string = () => 'local-owner') {}
  createAuthorizedExecution(input: { taskId: string; workItemId: string; attemptId: string; leaseId: string; requestId: string; idempotencyKey: string; workspaceId: string; projectId: string; agentId: string; functionId: string; proposalVersionId: string; authorizationGrantId: string; resourceKey: string; fencingToken: number; createdAt: string }): { attemptId: string; created: boolean } {
    const transaction = this.database.transaction((): { attemptId: string; created: boolean } => {
      const actor = this.principal();
      const localAuthority = this.database.prepare('SELECT w.owner_id, w.status, g.actor_id FROM workspaces w JOIN proposal_versions p ON p.workspace_id = w.workspace_id JOIN authorization_grants g ON g.proposal_version_id = p.proposal_version_id WHERE w.workspace_id = ? AND g.grant_id = ?').get(input.workspaceId, input.authorizationGrantId) as { owner_id: string; status: string; actor_id: string } | undefined;
      if (!actor || !localAuthority || localAuthority.status !== 'ACTIVE' || localAuthority.owner_id !== actor || localAuthority.actor_id !== actor) throw new Error('LOCAL_AUTHORITY_DENIED');
      if (input.resourceKey !== `project:${input.projectId}`) throw new Error('PROJECT_RESOURCE_MISMATCH');
      const priorRows = this.database.prepare('SELECT a.attempt_id, t.task_id, t.workspace_id, t.project_id, t.proposal_version_id, t.authorization_grant_id, w.work_item_id, w.agent_id, w.function_id, l.resource_key, l.fencing_token FROM execution_attempts a JOIN work_items w ON w.work_item_id = a.work_item_id JOIN tasks t ON t.task_id = w.task_id LEFT JOIN resource_leases l ON l.attempt_id = a.attempt_id WHERE a.idempotency_key = ?').all(input.idempotencyKey) as { attempt_id: string; task_id: string; workspace_id: string; project_id: string; proposal_version_id: string; authorization_grant_id: string; work_item_id: string; agent_id: string; function_id: string; resource_key: string | null; fencing_token: number | null }[];
      if (priorRows.length > 0) {
        const prior = priorRows[0];
        if (priorRows.length !== 1 || !prior || prior.task_id !== input.taskId || prior.work_item_id !== input.workItemId || prior.workspace_id !== input.workspaceId || prior.project_id !== input.projectId || prior.agent_id !== input.agentId || prior.function_id !== input.functionId || prior.proposal_version_id !== input.proposalVersionId || prior.authorization_grant_id !== input.authorizationGrantId || prior.resource_key !== input.resourceKey || prior.fencing_token !== input.fencingToken) throw new Error('EXECUTION_IDEMPOTENCY_CONFLICT');
        return { attemptId: prior.attempt_id, created: false };
      }
      const authority = this.database.prepare('SELECT p.workspace_id, p.project_id, p.agent_id, p.function_id, p.digest, g.proposal_digest, g.expires_at, g.issued_at FROM proposal_versions p JOIN authorization_grants g ON g.proposal_version_id = p.proposal_version_id WHERE p.proposal_version_id = ? AND g.grant_id = ?').get(input.proposalVersionId, input.authorizationGrantId) as { workspace_id: string; project_id: string; agent_id: string; function_id: string; digest: string; proposal_digest: string; expires_at: string; issued_at: string } | undefined;
      if (!authority || authority.workspace_id !== input.workspaceId || authority.project_id !== input.projectId || authority.agent_id !== input.agentId || authority.function_id !== input.functionId || authority.digest !== authority.proposal_digest) throw new Error('EXECUTION_AUTHORITY_MISMATCH');
      const proposal = new SqliteProposalRepository(this.database).get(input.proposalVersionId);
      const grantScope = this.database.prepare('SELECT actions_json FROM authorization_grants WHERE grant_id = ?').get(input.authorizationGrantId) as { actions_json: string } | undefined;
      if (!proposal || !grantScope) throw new Error('EXECUTION_AUTHORITY_MISMATCH');
      const { digest, ...proposalFields } = proposal;
      if (digest !== authority.digest || createProposalVersion(proposalFields).digest !== digest) throw new Error('PROPOSAL_DIGEST_MISMATCH');
      if (proposal.expiresAt !== authority.expires_at) throw new Error('GRANT_EXPIRY_MISMATCH');
      const grantActions: unknown = JSON.parse(grantScope.actions_json);
      if (!Array.isArray(grantActions) || classifyGoalActions(proposal.actions).kind !== 'SIDE_EFFECTING'
        || classifyGoalActions(grantActions as GoalAction[]).kind !== 'SIDE_EFFECTING'
        || JSON.stringify(proposal.actions) !== JSON.stringify(grantActions)) throw new Error('GRANT_SCOPE_MISMATCH');
      const snapshot = this.database.prepare(`
        SELECT p.project_snapshot_version, p.agent_version AS approved_agent_version,
               p.function_version AS approved_function_version, p.workspace_id,
               pr.workspace_id AS project_workspace, pr.status AS project_status,
               pr.snapshot_version, a.workspace_id AS agent_workspace,
               a.agent_version, a.connection, a.availability,
               f.function_version, f.lifecycle
        FROM proposal_versions p
        JOIN projects pr ON pr.project_id = p.project_id
        JOIN agents a ON a.agent_id = p.agent_id
        JOIN functions f ON f.function_id = p.function_id AND f.agent_id = a.agent_id
        WHERE p.proposal_version_id = ?
      `).get(input.proposalVersionId) as { project_snapshot_version: string; approved_agent_version: string; approved_function_version: string; workspace_id: string; project_workspace: string; project_status: string; snapshot_version: number; agent_workspace: string; agent_version: string; connection: string; availability: string; function_version: string; lifecycle: string } | undefined;
      if (!snapshot || snapshot.workspace_id !== snapshot.project_workspace || snapshot.workspace_id !== snapshot.agent_workspace
        || snapshot.project_status !== 'ACTIVE' || snapshot.project_snapshot_version !== String(snapshot.snapshot_version)
        || snapshot.approved_agent_version !== snapshot.agent_version || snapshot.connection !== 'CONNECTED' || snapshot.availability !== 'AVAILABLE'
        || snapshot.approved_function_version !== snapshot.function_version || snapshot.lifecycle !== 'ACTIVE') throw new Error('EXECUTION_SNAPSHOT_STALE');
      const timestamp = Date.parse(this.clock());
      const expiry = Date.parse(authority.expires_at);
      const issued = Date.parse(authority.issued_at);
      if (!Number.isFinite(timestamp) || !Number.isFinite(expiry) || !Number.isFinite(issued) || timestamp >= expiry || timestamp < issued) throw new Error('GRANT_NOT_CONSUMABLE');
      const now = new Date(timestamp).toISOString();
      const consumed = this.database.prepare("UPDATE authorization_grants SET status = 'CONSUMED' WHERE grant_id = ? AND proposal_version_id = ? AND status = 'ISSUED' AND expires_at = ?").run(input.authorizationGrantId, input.proposalVersionId, authority.expires_at);
      if (consumed.changes !== 1) throw new Error('GRANT_NOT_CONSUMABLE');
      this.database.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run(input.taskId, input.workspaceId, input.projectId, input.proposalVersionId, input.authorizationGrantId, 'QUEUED', now);
      this.database.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run(input.workItemId, input.taskId, input.agentId, input.functionId, 'WAITING');
      this.database.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)').run(input.attemptId, input.workItemId, input.requestId, input.idempotencyKey, 'DISPATCH_PENDING', 0, now);
      new SqliteResourceLeaseRepository(this.database).acquire({ leaseId: input.leaseId, resourceKey: input.resourceKey, attemptId: input.attemptId, fencingToken: input.fencingToken, createdAt: now });
      this.database.prepare('INSERT INTO outbox (message_id, attempt_id, request_id, idempotency_key, message_type, payload_json, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`outbox:${input.attemptId}`, input.attemptId, input.requestId, input.idempotencyKey, 'start', JSON.stringify({ attempt_id: input.attemptId }), 'PENDING', now);
      return { attemptId: input.attemptId, created: true };
    });
    return transaction();
  }
}
