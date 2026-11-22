import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { parseH1ProposalCandidate, type H1ProposalCandidate } from '@super-assistant/domain';
import { checkLocalProposalCatalog } from './proposal-catalog-check.js';
import { findLocalWorkspace } from './local-workspace.js';
import { isFullGitCommit, readProjectHead } from './project-git-baseline.js';

function checksum(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export class ProposalDraftStore {
  // eslint-disable-next-line no-unused-vars -- parameter property stores the database.
  constructor(private readonly database: Database.Database) {}

  create(input: unknown): string {
    const candidate = parseH1ProposalCandidate(input);
    const observed = this.database.transaction(() => this.projectAuthority(candidate))();
    if (!isFullGitCommit(candidate.baselineCommit) || readProjectHead(observed.canonical_path) !== candidate.baselineCommit) throw new Error('DRAFT_BASELINE_UNVERIFIED');
    return this.database.transaction(() => {
      const current = this.projectAuthority(candidate);
      if (current.canonical_path !== observed.canonical_path || current.row_version !== observed.row_version || current.agent_row_version !== observed.agent_row_version) throw new Error('DRAFT_CATALOG_REJECTED');
      const id = randomUUID();
      const payload = JSON.stringify(candidate);
      this.database.prepare('INSERT INTO proposal_candidate_drafts VALUES (?, ?, ?, ?, ?)').run(id, candidate.workspaceId, candidate.projectId, payload, checksum(payload));
      this.database.prepare('INSERT INTO draft_agent_generations (draft_id, agent_id, agent_row_version) VALUES (?, ?, ?)').run(id, candidate.agentId, current.agent_row_version);
      return id;
    }).immediate();
  }

  private projectAuthority(candidate: H1ProposalCandidate): { canonical_path: string; row_version: number; agent_row_version: number } {
    if (checkLocalProposalCatalog(this.database, candidate).status !== 'REQUIRES_LIVE_VERIFICATION') throw new Error('DRAFT_CATALOG_REJECTED');
    const row = this.database.prepare(`SELECT p.canonical_path, p.row_version, a.row_version AS agent_row_version FROM projects p
      JOIN agents a ON a.agent_id = p.default_agent_id AND a.workspace_id = p.workspace_id
      WHERE p.workspace_id = ? AND p.project_id = ? AND a.agent_id = ?`).get(candidate.workspaceId, candidate.projectId, candidate.agentId) as { canonical_path: string; row_version: number; agent_row_version: number } | undefined;
    if (!row || !Number.isSafeInteger(row.agent_row_version) || row.agent_row_version <= 0) throw new Error('DRAFT_CATALOG_REJECTED');
    return row;
  }

  get(id: string): H1ProposalCandidate {
    return this.database.transaction(() => {
      const workspace = findLocalWorkspace(this.database);
      if (!workspace || typeof id !== 'string' || id.length > 128) throw new Error('DRAFT_UNAVAILABLE');
      const row = this.database.prepare('SELECT project_id, payload_json, payload_sha256 FROM proposal_candidate_drafts WHERE draft_id = ? AND workspace_id = ?').get(id, workspace) as { project_id: string; payload_json: string; payload_sha256: string } | undefined;
      if (!row || checksum(row.payload_json) !== row.payload_sha256) throw new Error('DRAFT_UNAVAILABLE');
      const candidate = parseH1ProposalCandidate(JSON.parse(row.payload_json));
      if (candidate.workspaceId !== workspace || candidate.projectId !== row.project_id) throw new Error('DRAFT_UNAVAILABLE');
      const binding = this.database.prepare('SELECT agent_id, agent_row_version FROM draft_agent_generations WHERE draft_id = ?').get(id) as { agent_id: string; agent_row_version: number } | undefined;
      const current = this.projectAuthority(candidate);
      if (!binding || binding.agent_id !== candidate.agentId || binding.agent_row_version !== current.agent_row_version) throw new Error('DRAFT_UNAVAILABLE');
      return candidate;
    })();
  }
}
