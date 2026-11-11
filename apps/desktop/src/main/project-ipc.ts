import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, parse } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import type { FoundationId, ProjectRepository, RegisteredProject } from '@super-assistant/domain';
import type Database from 'better-sqlite3';
import { SqliteFoundationRepository, SqliteProjectRepository } from '@super-assistant/persistence';
import type { ProjectRendererProjection } from '../shared/ipc-contract.js';

function hasControl(value: string): boolean { return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127); }
function safeRepository(value: string | null): string | null {
  return value && value.length <= 128 && value.trim() === value && !/[\\/:@]/.test(value) && !hasControl(value) ? value : null;
}
function safeBranch(value: string | null): string | null {
  return value && value.length <= 128 && value.trim() === value && !/[\\:@\s]/.test(value) && !hasControl(value) && !value.includes('..') && !value.startsWith('/') && !value.endsWith('/') ? value : null;
}
function discoverGit(path: string): { repository: string | null; defaultBranch: string | null } {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_OPTIONAL_LOCKS = '0';
  const git = (...args: string[]) => execFileSync('git', ['-C', path, ...args], { encoding: 'utf8', env, timeout: 4000, maxBuffer: 16384, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const root = git('rev-parse', '--show-toplevel');
    if (!isAbsolute(root) || hasControl(root)) return { repository: null, defaultBranch: null };
    const repository = safeRepository(basename(realpathSync(root)));
    let defaultBranch: string | null = null;
    try { const ref = git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'); if (ref.startsWith('origin/')) defaultBranch = safeBranch(ref.slice('origin/'.length)); } catch { /* no evidenced default branch */ }
    return { repository, defaultBranch };
  } catch { return { repository: null, defaultBranch: null }; }
}

export class ProjectRegistrationService {
  // eslint-disable-next-line no-unused-vars -- TypeScript parameter property.
  constructor(private readonly repository: ProjectRepository) {}

  register(input: { workspaceId: FoundationId; candidatePath: string }): RegisteredProject {
    if (typeof input.candidatePath !== 'string' || input.candidatePath.length === 0 || input.candidatePath.length > 32767 || !isAbsolute(input.candidatePath)) throw new Error('Invalid Project path.');
    const canonicalPath = realpathSync(input.candidatePath);
    if (canonicalPath === parse(canonicalPath).root || !statSync(canonicalPath).isDirectory()) throw new Error('Invalid Project directory.');
    accessSync(canonicalPath, constants.R_OK);
    const discovered = discoverGit(canonicalPath);
    return this.repository.register({
      workspaceId: input.workspaceId,
      name: basename(canonicalPath),
      canonicalPath,
      metadata: { ...discovered, technology: null, provenance: 'DISCOVERED' }
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
      repository: safeRepository(project.metadata.repository), branch: safeBranch(project.metadata.defaultBranch),
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
