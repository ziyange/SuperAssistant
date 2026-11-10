import { describe, expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteFoundationRepository } from '../src/repositories/foundation-repository.js';
import { SqliteProjectRepository } from '../src/repositories/project-repository.js';

describe('Project repository', () => {
  test('keeps discovered metadata and rejects archive with active Tasks', () => {
    const db = createFoundationDatabase(':memory:'); const foundation = new SqliteFoundationRepository(db); const workspace = foundation.createWorkspace({ ownerId: 'owner', name: 'Local' }); const projects = new SqliteProjectRepository(db);
    const project = projects.register({ workspaceId: workspace.workspaceId, name: 'Demo', canonicalPath: 'E:/Demo', metadata: { repository: 'demo', defaultBranch: 'main', technology: 'TypeScript', provenance: 'DISCOVERED' } });
    expect(project.metadata).toEqual(expect.objectContaining({ defaultBranch: 'main', provenance: 'DISCOVERED' }));
    expect(() => projects.setStatus(project.projectId, 'ARCHIVED', 1)).toThrow(/active/i); db.close();
  });
  test('returns an existing Project for the same Workspace path and lists only that Workspace', () => {
    const db = createFoundationDatabase(':memory:');
    try {
      const foundation = new SqliteFoundationRepository(db);
      const first = foundation.createWorkspace({ ownerId: 'owner', name: 'First' });
      const second = foundation.createWorkspace({ ownerId: 'owner', name: 'Second' });
      const projects = new SqliteProjectRepository(db);
      const metadata = { repository: 'original', defaultBranch: 'main', technology: null, provenance: 'DISCOVERED' as const };
      const original = projects.register({ workspaceId: first.workspaceId, name: 'Zebra', canonicalPath: 'E:/Demo', metadata });
      const duplicate = projects.register({ workspaceId: first.workspaceId, name: 'Changed', canonicalPath: 'e:\\demo\\', metadata: { ...metadata, repository: 'changed' } });
      expect(duplicate).toEqual(original);
      const other = projects.register({ workspaceId: second.workspaceId, name: 'Other workspace', canonicalPath: 'E:/Demo', metadata });
      const alpha = projects.register({ workspaceId: first.workspaceId, name: 'Alpha', canonicalPath: 'E:/Alpha', metadata });
      expect(other.projectId).not.toBe(original.projectId);
      expect(projects.list(first.workspaceId).map(project => project.projectId)).toEqual([alpha.projectId, original.projectId]);
      expect(projects.list(second.workspaceId).map(project => project.projectId)).toEqual([other.projectId]);
      expect(db.prepare('SELECT count(*) AS count FROM projects').get()).toEqual({ count: 3 });
    } finally { db.close(); }
  });
});
