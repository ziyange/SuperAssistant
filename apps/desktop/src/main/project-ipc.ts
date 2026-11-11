import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, parse } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import type { FoundationId, ProjectRepository, RegisteredProject } from '@super-assistant/domain';
import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '@super-assistant/persistence';
import type { ProjectRendererProjection } from '../shared/ipc-contract.js';
import { ensureLocalWorkspace, findLocalWorkspace } from './local-workspace.js';

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

  list(): ProjectRendererProjection[] {
    const workspace = findLocalWorkspace(this.database);
    if (!workspace) return [];
    const codex = this.database.prepare('SELECT r.agent_id FROM local_codex_registrations r JOIN agents a ON a.agent_id = r.agent_id AND a.workspace_id = r.workspace_id WHERE r.workspace_id = ?').get(workspace) as { agent_id: string } | undefined;
    return this.repository.list(workspace).map(project => ({
      id: project.projectId, name: project.name, status: project.status,
      repository: safeRepository(project.metadata.repository), branch: safeBranch(project.metadata.defaultBranch),
      provenance: project.metadata.provenance, codexAssigned: codex !== undefined && project.defaultAgentId === codex.agent_id, hasDefaultAgent: project.defaultAgentId !== null
    }));
  }

  async assignCodex(projectId: string): Promise<{ status: 'ASSIGNED' | 'ERROR'; projects: ProjectRendererProjection[] }> {
    try {
      if (typeof projectId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(projectId)) throw new Error('Project identity invalid.');
      const assign = this.database.transaction(() => {
        const workspace = findLocalWorkspace(this.database);
        if (!workspace) throw new Error('Local workspace unavailable.');
        const project = this.database.prepare('SELECT default_agent_id, status FROM projects WHERE project_id = ? AND workspace_id = ?').get(projectId, workspace) as { default_agent_id: string | null; status: string } | undefined;
        const codex = this.database.prepare("SELECT r.agent_id FROM local_codex_registrations r JOIN agents a ON a.agent_id = r.agent_id AND a.workspace_id = r.workspace_id WHERE r.workspace_id = ? AND a.name = 'Codex' COLLATE NOCASE AND a.connection <> 'DISABLED'").get(workspace) as { agent_id: string } | undefined;
        if (!project || project.status !== 'ACTIVE' || !codex || (project.default_agent_id !== null && project.default_agent_id !== codex.agent_id)) throw new Error('Project assignment unavailable.');
        if (project.default_agent_id === null) {
          const changed = this.database.prepare("UPDATE projects SET default_agent_id = ?, snapshot_version = snapshot_version + 1, row_version = row_version + 1, updated_at = ? WHERE project_id = ? AND workspace_id = ? AND status = 'ACTIVE' AND default_agent_id IS NULL").run(codex.agent_id, new Date().toISOString(), projectId, workspace);
          if (changed.changes !== 1) throw new Error('Project assignment changed.');
        }
        return this.list();
      });
      return { status: 'ASSIGNED', projects: assign() };
    } catch { return { status: 'ERROR', projects: [] }; }
  }

  async choose(): Promise<{ status: 'REGISTERED' | 'CANCELLED' | 'ERROR'; projects: ProjectRendererProjection[] }> {
    try {
      findLocalWorkspace(this.database);
      const candidatePath = await this.selectDirectory();
      if (candidatePath === null) return { status: 'CANCELLED', projects: this.list() };
      const register = this.database.transaction(() => {
        const workspaceId = ensureLocalWorkspace(this.database);
        this.registration.register({ workspaceId, candidatePath });
        return this.list();
      });
      return { status: 'REGISTERED', projects: register() };
    } catch {
      return { status: 'ERROR', projects: [] };
    }
  }
}
