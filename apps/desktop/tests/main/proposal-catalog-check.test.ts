import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { SqliteFoundationRepository } from '../../../../packages/persistence/src/repositories/foundation-repository.js';
import { checkLocalProposalCatalog } from '../../src/main/proposal-catalog-check.js';

test('local Proposal catalog rejects untrusted, stale and foreign facts without mutating state', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    const repo = new SqliteFoundationRepository(db);
    const w = repo.createWorkspace({ ownerId: 'local-owner', name: 'Local' });
    const a = repo.createAgent({ workspaceId: w.workspaceId, name: 'Codex', connection: 'UNAVAILABLE', availability: 'PAUSED', agentVersion: '1' });
    const p = repo.createProject({ workspaceId: w.workspaceId, name: 'P', canonicalPath: 'E:/fixture', defaultAgentId: a.agentId, snapshotVersion: 1 });
    const fn = repo.createFunction({ agentId: a.agentId, name: 'Code', functionVersion: '1' });
    db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE project_id = ?").run(p.projectId);
    db.prepare("INSERT INTO local_codex_registrations VALUES (?, ?, 'E:/fake.exe', '1', '2026')").run(w.workspaceId, a.agentId);
    const candidate = {
      objective: 'Update', workspaceId: w.workspaceId, projectId: p.projectId, agentId: a.agentId, functionId: fn.functionId,
      projectSnapshotVersion: '1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc',
      createdAt: '2026-08-13T00:00:00.000Z', expiresAt: '2026-08-13T01:00:00.000Z', deadlineAt: '2026-08-13T02:00:00.000Z',
      budget: { maxDurationMs: 1, maxTokens: null, maxCost: null }, capabilities: [{ id: 'code', version: '1' }],
      workItems: [{ id: 'work', projectId: p.projectId, agentId: a.agentId, functionId: fn.functionId, objective: 'Update', required: true, dependencies: [] }],
      resources: [{ key: 'project:p', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: [],
      reconfirmationTriggers: ['change'], risk: 'HIGH', acceptanceCriteria: [{ criterion: 'passes', evidence: 'test log' }]
    };
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REQUIRES_LIVE_VERIFICATION' });
    for (const patch of [{ workspaceId: 'foreign' }, { projectSnapshotVersion: '2' }, { agentVersion: '2' }, { functionVersion: '2' }, { unknown: true }]) {
      expect(checkLocalProposalCatalog(db, { ...candidate, ...patch })).toEqual({ status: 'REJECTED' });
    }
    for (const field of ['projectId', 'agentId', 'functionId']) {
      const altered = { ...candidate, [field]: 'missing', workItems: [{ ...candidate.workItems[0]!, [field]: 'missing' }] };
      expect(checkLocalProposalCatalog(db, altered)).toEqual({ status: 'REJECTED' });
    }
    db.prepare("UPDATE local_codex_registrations SET observed_version = '2' WHERE workspace_id = ?").run(w.workspaceId);
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    db.prepare("UPDATE local_codex_registrations SET observed_version = '1' WHERE workspace_id = ?").run(w.workspaceId);
    db.prepare("UPDATE projects SET status = 'PAUSED' WHERE project_id = ?").run(p.projectId);
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    db.prepare("UPDATE projects SET status = 'ACTIVE', default_agent_id = NULL WHERE project_id = ?").run(p.projectId);
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    db.prepare('UPDATE projects SET default_agent_id = ? WHERE project_id = ?').run(a.agentId, p.projectId);
    db.prepare("UPDATE functions SET lifecycle = 'DISABLED' WHERE function_id = ?").run(fn.functionId);
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    db.prepare("UPDATE functions SET lifecycle = 'ACTIVE' WHERE function_id = ?").run(fn.functionId);
    db.prepare("UPDATE agents SET connection = 'DISABLED' WHERE agent_id = ?").run(a.agentId);
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    db.prepare("UPDATE agents SET connection = 'UNAVAILABLE' WHERE agent_id = ?").run(a.agentId);
    db.prepare('DELETE FROM local_codex_registrations WHERE workspace_id = ?').run(w.workspaceId);
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    db.prepare("INSERT INTO local_codex_registrations VALUES (?, ?, 'E:/fake.exe', '1', '2026')").run(w.workspaceId, a.agentId);
    const foreign = repo.createWorkspace({ ownerId: 'other-owner', name: 'Foreign' });
    const foreignAgent = repo.createAgent({ workspaceId: foreign.workspaceId, name: 'Codex', connection: 'UNAVAILABLE', availability: 'PAUSED', agentVersion: '1' });
    const foreignProject = repo.createProject({ workspaceId: foreign.workspaceId, name: 'F', canonicalPath: 'E:/foreign', defaultAgentId: foreignAgent.agentId });
    const foreignFunction = repo.createFunction({ agentId: foreignAgent.agentId, name: 'Code', functionVersion: '1' });
    db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE project_id = ?").run(foreignProject.projectId);
    db.prepare("INSERT INTO local_codex_registrations VALUES (?, ?, 'E:/foreign.exe', '1', '2026')").run(foreign.workspaceId, foreignAgent.agentId);
    const foreignCandidate = { ...candidate, workspaceId: foreign.workspaceId, projectId: foreignProject.projectId, agentId: foreignAgent.agentId, functionId: foreignFunction.functionId, workItems: [{ ...candidate.workItems[0]!, projectId: foreignProject.projectId, agentId: foreignAgent.agentId, functionId: foreignFunction.functionId }] };
    expect(checkLocalProposalCatalog(db, foreignCandidate)).toEqual({ status: 'REJECTED' });
    const duplicate = repo.createWorkspace({ ownerId: 'local-owner', name: 'Ambiguous' });
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    db.prepare("UPDATE workspaces SET status = 'ARCHIVED' WHERE workspace_id = ?").run(duplicate.workspaceId);
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run(w.workspaceId);
    expect(checkLocalProposalCatalog(db, candidate)).toEqual({ status: 'REJECTED' });
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
  } finally { db.close(); }
});
