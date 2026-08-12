import { afterEach, describe, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteFoundationRepository } from '../src/repositories/foundation-repository.js';

const folders: string[] = [];
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })));
function databasePath(): string { const folder = mkdtempSync(join(tmpdir(), 'sa-foundation-')); folders.push(folder); return join(folder, 'foundation.sqlite'); }

describe('foundation repository', () => {
  test('persists scoped foundation facts across reopen and preserves version references', () => {
    const path = databasePath(); const first = createFoundationDatabase(path);
    try {
      const repository = new SqliteFoundationRepository(first); const workspace = repository.createWorkspace({ ownerId: 'owner-1', name: 'Local' });
      const agent = repository.createAgent({ workspaceId: workspace.workspaceId, name: 'Codex', connection: 'CONNECTED', availability: 'AVAILABLE' });
      repository.createFunction({ agentId: agent.agentId, name: 'develop', functionVersion: '1.0.0' });
      const project = repository.createProject({ workspaceId: workspace.workspaceId, name: 'Super Assistant', canonicalPath: 'E:/Programs/Super Assistant', defaultAgentId: agent.agentId, snapshotVersion: 1 }); first.close();
      const reopened = createFoundationDatabase(path);
      try {
        const restored = new SqliteFoundationRepository(reopened);
        expect(restored.getProject(project.projectId)).toMatchObject({ canonicalPath: 'E:/Programs/Super Assistant', snapshotVersion: 1, defaultAgentId: agent.agentId });
        expect(restored.listFunctions(agent.agentId)).toEqual([expect.objectContaining({ name: 'develop', functionVersion: '1.0.0' })]);
      } finally { reopened.close(); }
    } finally { try { first.close(); } catch { /* already closed */ } }
  });
  test('rejects equivalent canonical Project paths', () => {
    const db = createFoundationDatabase(':memory:'); const repository = new SqliteFoundationRepository(db); const workspace = repository.createWorkspace({ ownerId: 'owner-1', name: 'Local' });
    repository.createProject({ workspaceId: workspace.workspaceId, name: 'One', canonicalPath: 'E:/Projects/One' });
    expect(() => repository.createProject({ workspaceId: workspace.workspaceId, name: 'Duplicate', canonicalPath: 'e:\\projects\\one\\' })).toThrow(/canonical/i); db.close();
  });
});
