import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { parseH1ProposalCandidate, type H1ProposalCandidate } from '@super-assistant/domain';
import { checkLocalProposalCatalog } from './proposal-catalog-check.js';
import { findLocalWorkspace } from './local-workspace.js';

function checksum(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export class ProposalDraftStore {
  // eslint-disable-next-line no-unused-vars -- parameter property stores the database.
  constructor(private readonly database: Database.Database) {}

  create(input: unknown): string {
    const candidate = parseH1ProposalCandidate(input);
    return this.database.transaction(() => {
      if (checkLocalProposalCatalog(this.database, candidate).status !== 'REQUIRES_LIVE_VERIFICATION') throw new Error('DRAFT_CATALOG_REJECTED');
      const id = randomUUID();
      const payload = JSON.stringify(candidate);
      this.database.prepare('INSERT INTO proposal_candidate_drafts VALUES (?, ?, ?, ?, ?)').run(id, candidate.workspaceId, candidate.projectId, payload, checksum(payload));
      return id;
    }).immediate();
  }

  get(id: string): H1ProposalCandidate {
    return this.database.transaction(() => {
      const workspace = findLocalWorkspace(this.database);
      if (!workspace || typeof id !== 'string' || id.length > 128) throw new Error('DRAFT_UNAVAILABLE');
      const row = this.database.prepare('SELECT project_id, payload_json, payload_sha256 FROM proposal_candidate_drafts WHERE draft_id = ? AND workspace_id = ?').get(id, workspace) as { project_id: string; payload_json: string; payload_sha256: string } | undefined;
      if (!row || checksum(row.payload_json) !== row.payload_sha256) throw new Error('DRAFT_UNAVAILABLE');
      const candidate = parseH1ProposalCandidate(JSON.parse(row.payload_json));
      if (candidate.workspaceId !== workspace || candidate.projectId !== row.project_id) throw new Error('DRAFT_UNAVAILABLE');
      return candidate;
    })();
  }
}
