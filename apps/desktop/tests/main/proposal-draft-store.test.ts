import { expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { SqliteFoundationRepository } from '../../../../packages/persistence/src/repositories/foundation-repository.js';
import { ProposalDraftStore } from '../../src/main/proposal-draft-store.js';

test('persists only locally scoped immutable drafts and verifies stored content', () => {
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
    const store = new ProposalDraftStore(db);
    expect(() => store.create({ ...candidate, projectSnapshotVersion: '2' })).toThrow();
    expect(() => store.create({ ...candidate, budget: null })).toThrow();
    const id = store.create(candidate);
    expect(store.get(id)).toEqual(candidate);
    const reopened = new Database(db.serialize());
    try { expect(new ProposalDraftStore(reopened).get(id)).toEqual(candidate); }
    finally { reopened.close(); }
    expect(() => db.prepare("UPDATE proposal_candidate_drafts SET payload_json = '{}' WHERE draft_id = ?").run(id)).toThrow();
    expect(() => db.prepare('DELETE FROM proposal_candidate_drafts WHERE draft_id = ?').run(id)).toThrow();
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run(w.workspaceId);
    expect(() => store.get(id)).toThrow();
    db.prepare("UPDATE workspaces SET status = 'ACTIVE' WHERE workspace_id = ?").run(w.workspaceId);
    db.prepare("UPDATE workspaces SET owner_id = 'other-owner' WHERE workspace_id = ?").run(w.workspaceId);
    repo.createWorkspace({ ownerId: 'local-owner', name: 'Another local workspace' });
    expect(() => store.get(id)).toThrow();
    db.prepare("UPDATE workspaces SET status = 'ARCHIVED' WHERE owner_id = 'local-owner'").run();
    db.prepare("UPDATE workspaces SET owner_id = 'local-owner' WHERE workspace_id = ?").run(w.workspaceId);
    db.exec('DROP TRIGGER proposal_candidate_drafts_immutable_update');
    db.prepare("UPDATE proposal_candidate_drafts SET payload_json = '{}' WHERE draft_id = ?").run(id);
    expect(() => store.get(id)).toThrow();
  } finally { db.close(); }
});
