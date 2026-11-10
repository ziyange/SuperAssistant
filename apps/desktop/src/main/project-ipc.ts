import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, parse } from 'node:path';
import type { FoundationId, ProjectRepository, RegisteredProject } from '@super-assistant/domain';
import type Database from 'better-sqlite3';
import { SqliteFoundationRepository, SqliteProjectRepository } from '@super-assistant/persistence';
import type { ProjectRendererProjection } from '../shared/ipc-contract.js';

export class ProjectRegistrationService {
  // eslint-disable-next-line no-unused-vars -- TypeScript parameter property.
  constructor(private readonly repository: ProjectRepository) {}

  register(input: { workspaceId: FoundationId; candidatePath: string }): RegisteredProject {
    if (typeof input.candidatePath !== 'string' || input.candidatePath.length === 0 || input.candidatePath.length > 32767 || !isAbsolute(input.candidatePath)) throw new Error('Invalid Project path.');
    const canonicalPath = realpathSync(input.candidatePath);
    if (canonicalPath === parse(canonicalPath).root || !statSync(canonicalPath).isDirectory()) throw new Error('Invalid Project directory.');
    accessSync(canonicalPath, constants.R_OK);
    return this.repository.register({
      workspaceId: input.workspaceId,
      name: basename(canonicalPath),
      canonicalPath,
      metadata: { repository: null, defaultBranch: null, technology: null, provenance: 'DISCOVERED' }
    });
  }
}

export function projectRegistrationError(error: unknown): string {
  void error;
  return 'Project path could not be validated.';
}

export class LocalProjectCatalog {
  private readonly repository: SqliteProjectRepository;
  private readonly registration: ProjectRegistrationService;
  // eslint-disable-next-line no-unused-vars -- TypeScript parameter properties.
  constructor(private readonly database: Database.Database, private readonly selectDirectory: () => Promise<string | null>) {
    this.repository = new SqliteProjectRepository(database);
    this.registration = new ProjectRegistrationService(this.repository);
  }

  private workspace(): FoundationId | null {
    const rows = this.database.prepare("SELECT workspace_id FROM workspaces WHERE owner_id = ? AND status = 'ACTIVE' ORDER BY workspace_id LIMIT 2").all('local-owner') as { workspace_id: string }[];
    if (rows.length > 1) throw new Error('Ambiguous local workspace.');
    return rows[0] ? rows[0].workspace_id as FoundationId : null;
  }

  list(): ProjectRendererProjection[] {
    const workspace = this.workspace();
    if (!workspace) return [];
    return this.repository.list(workspace).map(project => ({
      id: project.projectId, name: project.name, status: project.status,
      repository: null, branch: project.metadata.defaultBranch,
      provenance: project.metadata.provenance
    }));
  }

  async choose(): Promise<{ status: 'REGISTERED' | 'CANCELLED' | 'ERROR'; projects: ProjectRendererProjection[] }> {
    try {
      this.workspace();
      const candidatePath = await this.selectDirectory();
      if (candidatePath === null) return { status: 'CANCELLED', projects: this.list() };
      const register = this.database.transaction(() => {
        const workspaceId = this.workspace() ?? new SqliteFoundationRepository(this.database).createWorkspace({ ownerId: 'local-owner', name: 'Local Workspace' }).workspaceId;
        this.registration.register({ workspaceId, candidatePath });
        return this.list();
      });
      return { status: 'REGISTERED', projects: register() };
    } catch {
      return { status: 'ERROR', projects: [] };
    }
  }
}
