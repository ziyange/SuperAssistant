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
});
