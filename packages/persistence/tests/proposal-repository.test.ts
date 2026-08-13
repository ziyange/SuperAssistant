import { describe, expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteProposalRepository } from '../src/repositories/proposal-repository.js';
import { SqliteAuthorizationRepository } from '../src/repositories/authorization-repository.js';
import { SqliteFoundationRepository } from '../src/repositories/foundation-repository.js';
import { createProposalVersion } from '@super-assistant/domain';

describe('Proposal and authorization repositories', () => {
  test('persists immutable proposals and returns one grant for duplicate confirmation', () => {
    const db = createFoundationDatabase(':memory:');
    const foundation = new SqliteFoundationRepository(db); const workspace = foundation.createWorkspace({ ownerId: 'owner-1', name: 'Local' }); const agent = foundation.createAgent({ workspaceId: workspace.workspaceId, name: 'Codex', connection: 'CONNECTED', availability: 'AVAILABLE', agentVersion: '1' }); const project = foundation.createProject({ workspaceId: workspace.workspaceId, name: 'Demo', canonicalPath: 'E:/Demo', defaultAgentId: agent.agentId, snapshotVersion: 1 }); const fn = foundation.createFunction({ agentId: agent.agentId, name: 'codex', functionVersion: '1' });
    const proposals = new SqliteProposalRepository(db); const grants = new SqliteAuthorizationRepository(db);
    const proposal = createProposalVersion({ proposalVersionId: 'proposal-1', workspaceId: workspace.workspaceId, projectId: project.projectId, agentId: agent.agentId, functionId: fn.functionId, objective: 'Write a report', actions: ['FILE_WRITE'], projectSnapshotVersion: 'snapshot-1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc', expiresAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z' });
    proposals.save(proposal);
    expect(proposals.get(proposal.proposalVersionId)?.digest).toBe(proposal.digest);
    expect(() => db.prepare("UPDATE proposal_versions SET objective = 'Changed' WHERE proposal_version_id = ?").run(proposal.proposalVersionId)).toThrow(/immutable/i);
    const first = grants.issue({ grantId: 'grant-1', proposal, actorId: 'actor-1', idempotencyKey: 'confirmation-1', issuedAt: '2026-08-13T01:00:00.000Z' });
    const second = grants.issue({ grantId: 'grant-2', proposal, actorId: 'actor-1', idempotencyKey: 'confirmation-1', issuedAt: '2026-08-13T01:00:01.000Z' });
    expect(second).toEqual(first); db.close();
  });
});
