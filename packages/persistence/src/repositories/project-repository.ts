/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createFoundationId, type FoundationId, type ProjectRepository, type ProjectStatus, type RegisteredProject, type ProjectMetadata, canArchiveProject, canTransitionProject } from '@super-assistant/domain';
function normal(path: string): string { return path.replaceAll('\\', '/').replace(/\/+$/, ''); }
function key(path: string): string { return normal(path).toLowerCase(); }
function getId(value: string): FoundationId { return value as FoundationId; }
function mapProject(row: Record<string, unknown>): RegisteredProject { return { projectId: getId(String(row.project_id)), workspaceId: getId(String(row.workspace_id)), name: String(row.name), canonicalPath: String(row.canonical_path), status: String(row.status) as ProjectStatus, defaultAgentId: row.default_agent_id ? getId(String(row.default_agent_id)) : null, snapshotVersion: Number(row.snapshot_version), createdAt: String(row.created_at), updatedAt: String(row.updated_at), rowVersion: Number(row.row_version), metadata: { repository: row.repository ? String(row.repository) : null, defaultBranch: row.default_branch ? String(row.default_branch) : null, technology: row.technology ? String(row.technology) : null, provenance: String(row.provenance) as ProjectMetadata['provenance'] } }; }
export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly database: Database.Database) {}
  register(input: { workspaceId: FoundationId; name: string; canonicalPath: string; metadata: ProjectMetadata }): RegisteredProject {
    const projectId = createFoundationId(); const now = new Date().toISOString(); const path = normal(input.canonicalPath);
    const transaction = this.database.transaction(() => {
      this.database.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(projectId, input.workspaceId, input.name, path, key(path), 'ACTIVE', null, 1, now, now);
      this.database.prepare('INSERT INTO project_metadata VALUES (?, ?, ?, ?, ?)').run(projectId, input.metadata.repository, input.metadata.defaultBranch, input.metadata.technology, input.metadata.provenance);
    });
    try { transaction(); } catch (error) {
      if (String(error).includes('UNIQUE constraint failed: projects.workspace_id, projects.canonical_key')) {
        const existing = this.database.prepare('SELECT project_id FROM projects WHERE workspace_id = ? AND canonical_key = ?').get(input.workspaceId, key(path)) as { project_id: string } | undefined;
        const project = existing ? this.get(getId(existing.project_id)) : null;
        if (project) return project;
      }
      throw error;
    }
    return this.get(projectId) as RegisteredProject;
  }
  setStatus(projectId: FoundationId, status: ProjectStatus, activeTasks: number): RegisteredProject {
    const current = this.get(projectId); if (!current) throw new Error('Project not found.');
    if (status === 'ARCHIVED' && !canArchiveProject(current.status, activeTasks)) throw new Error('Project with active Tasks cannot be archived.');
    if (current.status !== status && !canTransitionProject(current.status, status)) throw new Error('Invalid Project transition.');
    this.database.prepare('UPDATE projects SET status = ?, updated_at = ?, row_version = row_version + 1 WHERE project_id = ?').run(status, new Date().toISOString(), projectId);
    return this.get(projectId) as RegisteredProject;
  }
  get(projectId: FoundationId): RegisteredProject | null {
    const row = this.database.prepare('SELECT p.*, m.repository, m.default_branch, m.technology, m.provenance FROM projects p LEFT JOIN project_metadata m ON m.project_id = p.project_id WHERE p.project_id = ?').get(projectId) as Record<string, unknown> | undefined;
    return row ? mapProject(row) : null;
  }
  list(workspaceId: FoundationId): RegisteredProject[] {
    const rows = this.database.prepare('SELECT p.*, m.repository, m.default_branch, m.technology, m.provenance FROM projects p LEFT JOIN project_metadata m ON m.project_id = p.project_id WHERE p.workspace_id = ? ORDER BY p.name COLLATE NOCASE, p.project_id').all(workspaceId) as Record<string, unknown>[];
    return rows.map(mapProject);
  }
}
