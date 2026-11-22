import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { SqliteFoundationRepository } from '../../../../packages/persistence/src/repositories/foundation-repository.js';
import { checkLocalProposalCatalog } from '../../src/main/proposal-catalog-check.js';
import * as catalog from '../../src/main/proposal-catalog-check.js';
import { builtinCodexFunctionId, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';
import { routeIpc } from '../../src/main/ipc-router.js';

test('Proposal context IPC derives local scope and returns only read-only prerequisites', async () => {
  const db = createFoundationDatabase(':memory:');
  try {
    const repo = new SqliteFoundationRepository(db);
    const local = repo.createWorkspace({ ownerId: 'local-owner', name: 'Local' });
    const foreign = repo.createWorkspace({ ownerId: 'other-owner', name: 'Foreign' });
    const project = repo.createProject({ workspaceId: local.workspaceId, name: 'Local Project', canonicalPath: 'E:/local' });
    const other = repo.createProject({ workspaceId: foreign.workspaceId, name: 'Foreign Project', canonicalPath: 'E:/foreign' });
    const codex = repo.createAgent({ workspaceId: local.workspaceId, name: 'Codex', connection: 'UNAVAILABLE', availability: 'PAUSED', agentVersion: '0.121.0' });
    const onboarding = {
      get: async () => { throw new Error('Unrelated onboarding read'); },
      set: async () => { throw new Error('Unexpected onboarding write'); }
    };
    const request = (payload: unknown) => routeIpc({ channel: 'proposal:context', payload }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, (projectId: string) => catalog.readLocalProposalContext(db, projectId));
    const check = async (status: string, projectId = project.projectId as string) => {
      const changes = db.prepare('SELECT total_changes() AS count');
      const before = changes.get();
      await expect(request({ projectId })).resolves.toEqual({ proposalContext: { status } });
      expect(changes.get()).toEqual(before);
    };
    await check('PROJECT_UNAVAILABLE');
    db.prepare("UPDATE projects SET status = 'ACTIVE'").run();
    await check('PROJECT_UNAVAILABLE', other.projectId);
    await check('PROJECT_UNAVAILABLE', 'unknown');
    await check('CODEX_REQUIRED');
    db.prepare('UPDATE projects SET default_agent_id = ? WHERE project_id = ?').run(codex.agentId, project.projectId);
    await check('CODEX_REQUIRED');
    db.prepare("INSERT INTO local_codex_registrations VALUES (?, ?, 'E:/fake.exe', '0.121.0', '2026')").run(local.workspaceId, codex.agentId);
    await check('FUNCTION_REQUIRED');
    const fn = repo.createFunction({ agentId: codex.agentId, name: 'Code', functionVersion: '1' });
    await check('FUNCTION_REQUIRED');
    provisionBuiltinCodexFunction(db, local.workspaceId, codex.agentId, '0.121.0');
    await check('LIVE_VERIFICATION_REQUIRED');
    db.prepare("UPDATE functions SET lifecycle = 'DISABLED' WHERE function_id = ?").run(builtinCodexFunctionId(codex.agentId));
    await check('FUNCTION_REQUIRED');
    db.prepare("UPDATE functions SET lifecycle = 'DISABLED' WHERE function_id = ?").run(fn.functionId);
    await check('FUNCTION_REQUIRED');
    db.prepare("UPDATE local_codex_registrations SET observed_version = '0.122.0'").run();
    await check('CODEX_REQUIRED');
    db.prepare("UPDATE local_codex_registrations SET observed_version = '0.121.0'").run();
    db.prepare("UPDATE agents SET connection = 'DISABLED' WHERE agent_id = ?").run(codex.agentId);
    await check('CODEX_REQUIRED');
    db.prepare("UPDATE projects SET status = 'PAUSED' WHERE project_id = ?").run(project.projectId);
    await check('PROJECT_UNAVAILABLE');
    db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE project_id = ?").run(project.projectId);
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run(local.workspaceId);
    await check('PROJECT_UNAVAILABLE');
    db.prepare("UPDATE workspaces SET status = 'ACTIVE' WHERE workspace_id = ?").run(local.workspaceId);
    repo.createWorkspace({ ownerId: 'local-owner', name: 'Ambiguous' });
    await check('PROJECT_UNAVAILABLE');
    for (const payload of [{}, { projectId: '../outside' }, { projectId: 'project-1\n' }, { projectId: 'x'.repeat(129) }, { projectId: project.projectId, workspaceId: foreign.workspaceId }]) {
      await expect(request(payload)).rejects.toThrow('IPC channel or payload is not allowed.');
    }
    await expect(routeIpc({ channel: 'proposal:context', payload: { projectId: project.projectId } }, onboarding)).resolves.toEqual({ proposalContext: { status: 'PROJECT_UNAVAILABLE' } });
  } finally { db.close(); }
  expect(catalog.readLocalProposalContext(db, 'project-1')).toEqual({ status: 'PROJECT_UNAVAILABLE' });
});

test('local Proposal catalog rejects untrusted, stale and foreign facts without mutating state', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    const repo = new SqliteFoundationRepository(db);
    const w = repo.createWorkspace({ ownerId: 'local-owner', name: 'Local' });
    const a = repo.createAgent({ workspaceId: w.workspaceId, name: 'Codex', connection: 'UNAVAILABLE', availability: 'PAUSED', agentVersion: '0.121.0' });
    const p = repo.createProject({ workspaceId: w.workspaceId, name: 'P', canonicalPath: 'E:/fixture', defaultAgentId: a.agentId, snapshotVersion: 1 });
    db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE project_id = ?").run(p.projectId);
    db.prepare("INSERT INTO local_codex_registrations VALUES (?, ?, 'E:/fake.exe', '0.121.0', '2026')").run(w.workspaceId, a.agentId);
    provisionBuiltinCodexFunction(db, w.workspaceId, a.agentId, '0.121.0');
    const fn = { functionId: builtinCodexFunctionId(a.agentId) };
    const candidate = {
      objective: 'Update', workspaceId: w.workspaceId, projectId: p.projectId, agentId: a.agentId, functionId: fn.functionId,
      projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc',
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
    db.prepare("UPDATE local_codex_registrations SET observed_version = '0.121.0' WHERE workspace_id = ?").run(w.workspaceId);
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
    db.prepare("INSERT INTO local_codex_registrations VALUES (?, ?, 'E:/fake.exe', '0.121.0', '2026')").run(w.workspaceId, a.agentId);
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
