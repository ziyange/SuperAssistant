/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import type { ProposalVersion } from '@super-assistant/domain';

export class SqliteProposalRepository {
  constructor(private readonly database: Database.Database) {}
  save(proposal: ProposalVersion): void {
    this.database.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      proposal.proposalVersionId, proposal.workspaceId, proposal.projectId, proposal.agentId, proposal.functionId, proposal.objective,
      JSON.stringify(proposal.actions), proposal.projectSnapshotVersion, proposal.agentVersion, proposal.functionVersion, proposal.capabilityVersion,
      proposal.baselineCommit, proposal.expiresAt, proposal.createdAt, proposal.digest
    );
  }
  get(proposalVersionId: string): ProposalVersion | null {
    const row = this.database.prepare('SELECT * FROM proposal_versions WHERE proposal_version_id = ?').get(proposalVersionId) as Record<string, string> | undefined;
    if (!row) return null;
    const value = (key: string): string => { const found = row[key]; if (found === undefined) throw new Error(`Missing ProposalVersion column: ${key}`); return found; };
    return { proposalVersionId: value('proposal_version_id'), workspaceId: value('workspace_id'), projectId: value('project_id'), agentId: value('agent_id'), functionId: value('function_id'), objective: value('objective'), actions: JSON.parse(value('actions_json')), projectSnapshotVersion: value('project_snapshot_version'), agentVersion: value('agent_version'), functionVersion: value('function_version'), capabilityVersion: value('capability_version'), baselineCommit: value('baseline_commit'), expiresAt: value('expires_at'), createdAt: value('created_at'), digest: value('digest') as ProposalVersion['digest'] };
  }
}
