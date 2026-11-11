import { expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import * as projectModule from '../../src/main/project-ipc.js';
import { projectRegistrationError } from '../../src/main/project-ipc.js';
import { LocalProjectCatalog } from '../../src/main/project-ipc.js';
import { routeIpc } from '../../src/main/ipc-router.js';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { SqliteFoundationRepository } from '../../../../packages/persistence/src/repositories/foundation-repository.js';
import { SqliteProjectRepository } from '../../../../packages/persistence/src/repositories/project-repository.js';
import { LocalCodexRegistration } from '../../src/main/local-codex-registration.js';

test('explicit Project assignment is scoped, idempotent and persists without executing work', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-project-assignment-'));
  const directory = join(root, 'project');
  const executable = join(root, 'codex.exe');
  const databasePath = join(root, 'platform.sqlite');
  let db = createFoundationDatabase(databasePath);
  try {
    mkdirSync(directory); writeFileSync(executable, 'fake executable; never launched');
    new LocalCodexRegistration(db).save(executable, '0.121.0');
    const catalog = new LocalProjectCatalog(db, async () => directory);
    const created = await catalog.choose();
    const projectId = created.projects[0]!.id;
    const assign = Reflect.get(catalog, 'assignCodex');
    expect(typeof assign).toBe('function');
    expect(db.prepare('SELECT default_agent_id, snapshot_version, row_version FROM projects WHERE project_id = ?').get(projectId)).toEqual({ default_agent_id: null, snapshot_version: 1, row_version: 1 });
    const first = await assign.call(catalog, projectId);
    expect(first.status).toBe('ASSIGNED');
    expect(first.projects).toContainEqual(expect.objectContaining({ id: projectId, codexAssigned: true }));
    const after = db.prepare('SELECT default_agent_id, snapshot_version, row_version FROM projects WHERE project_id = ?').get(projectId);
    expect(after).toMatchObject({ default_agent_id: expect.any(String), snapshot_version: 2, row_version: 2 });
    expect((await assign.call(catalog, projectId)).status).toBe('ASSIGNED');
    expect(db.prepare('SELECT default_agent_id, snapshot_version, row_version FROM projects WHERE project_id = ?').get(projectId)).toEqual(after);
    expect(db.prepare('SELECT COUNT(*) AS count FROM tasks').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    db.close(); db = createFoundationDatabase(databasePath);
    expect(new LocalProjectCatalog(db, async () => null).list()).toContainEqual(expect.objectContaining({ id: projectId, codexAssigned: true }));
    const other = new SqliteFoundationRepository(db).createWorkspace({ ownerId: 'other-owner', name: 'Other' });
    const foreign = new SqliteFoundationRepository(db).createProject({ workspaceId: other.workspaceId, name: 'Foreign', canonicalPath: join(root, 'foreign') });
    db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE project_id = ?").run(foreign.projectId);
    const reopened = new LocalProjectCatalog(db, async () => null);
    expect((await Reflect.get(reopened, 'assignCodex').call(reopened, foreign.projectId)).status).toBe('ERROR');
    expect(db.prepare('SELECT default_agent_id, snapshot_version FROM projects WHERE project_id = ?').get(foreign.projectId)).toEqual({ default_agent_id: null, snapshot_version: 1 });
  } finally { if (db.open) db.close(); rmSync(root, { recursive: true, force: true }); }
}, 30_000);

test('assignment rejects missing, inactive, conflicting and locked authority without mutation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-project-assignment-negative-'));
  const executable = join(root, 'codex.exe');
  const db = createFoundationDatabase(':memory:');
  try {
    writeFileSync(executable, 'fake executable; never launched');
    const foundation = new SqliteFoundationRepository(db);
    const workspace = foundation.createWorkspace({ ownerId: 'local-owner', name: 'Local' });
    const project = foundation.createProject({ workspaceId: workspace.workspaceId, name: 'P', canonicalPath: join(root, 'project') });
    db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE project_id = ?").run(project.projectId);
    const catalog = new LocalProjectCatalog(db, async () => null);
    const assign = Reflect.get(catalog, 'assignCodex');
    expect((await assign.call(catalog, project.projectId)).status).toBe('ERROR');
    new LocalCodexRegistration(db).save(executable, '0.121.0');
    db.prepare("UPDATE agents SET connection = 'DISABLED' WHERE name = 'Codex'").run();
    expect((await assign.call(catalog, project.projectId)).status).toBe('ERROR');
    db.prepare("UPDATE agents SET connection = 'UNAVAILABLE' WHERE name = 'Codex'").run();
    db.prepare("UPDATE projects SET status = 'PAUSED' WHERE project_id = ?").run(project.projectId);
    expect((await assign.call(catalog, project.projectId)).status).toBe('ERROR');
    const other = foundation.createAgent({ workspaceId: workspace.workspaceId, name: 'Other', connection: 'UNAVAILABLE', availability: 'PAUSED' });
    db.prepare("UPDATE projects SET status = 'ACTIVE', default_agent_id = ? WHERE project_id = ?").run(other.agentId, project.projectId);
    expect((await assign.call(catalog, project.projectId)).status).toBe('ERROR');
    expect(db.prepare('SELECT default_agent_id, snapshot_version FROM projects WHERE project_id = ?').get(project.projectId)).toEqual({ default_agent_id: other.agentId, snapshot_version: 1 });
    db.prepare('UPDATE projects SET default_agent_id = NULL WHERE project_id = ?').run(project.projectId);
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run(workspace.workspaceId);
    expect((await assign.call(catalog, project.projectId)).status).toBe('ERROR');
    expect(db.prepare('SELECT default_agent_id, snapshot_version FROM projects WHERE project_id = ?').get(project.projectId)).toEqual({ default_agent_id: null, snapshot_version: 1 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM workspaces').get()).toEqual({ count: 1 });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test('discovers safe Git metadata, retains non-Git Projects and persists both after restart', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-project-metadata-'));
  const repository = join(root, 'git-repo');
  const plain = join(root, 'plain');
  const noDefault = join(root, 'no-default');
  const databasePath = join(root, 'platform.sqlite');
  let db = createFoundationDatabase(databasePath);
  try {
    mkdirSync(repository); mkdirSync(plain); mkdirSync(noDefault);
    execFileSync('git', ['init', '-b', 'working-branch', repository]);
    execFileSync('git', ['init', '-b', 'working-only', noDefault]);
    execFileSync('git', ['-C', repository, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    execFileSync('git', ['-C', repository, 'remote', 'add', 'origin', 'https://user:fake-secret@example.invalid/repo.git']);
    writeFileSync(join(repository, 'source.txt'), 'original');
    const before = execFileSync('git', ['-C', repository, 'status', '--porcelain'], { encoding: 'utf8' });
    let selected = repository;
    const catalog = new LocalProjectCatalog(db, async () => selected);
    const priorGitDir = process.env.GIT_DIR;
    process.env.GIT_DIR = join(root, 'wrong-git-dir');
    let first: Awaited<ReturnType<LocalProjectCatalog['choose']>>;
    try { first = await catalog.choose(); }
    finally { if (priorGitDir === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = priorGitDir; }
    expect(first.status).toBe('REGISTERED');
    expect(first.projects).toContainEqual(expect.objectContaining({ name: 'git-repo', repository: 'git-repo', branch: 'main' }));
    expect(JSON.stringify(first)).not.toContain('fake-secret');
    expect(JSON.stringify(first)).not.toContain(root);
    selected = plain;
    const second = await catalog.choose();
    expect(second.projects).toContainEqual(expect.objectContaining({ name: 'plain', repository: null, branch: null }));
    selected = noDefault;
    const third = await catalog.choose();
    expect(third.projects).toContainEqual(expect.objectContaining({ name: 'no-default', repository: 'no-default', branch: null }));
    db.close(); db = createFoundationDatabase(databasePath);
    const reopened = new LocalProjectCatalog(db, async () => null).list();
    expect(reopened).toContainEqual(expect.objectContaining({ name: 'git-repo', repository: 'git-repo', branch: 'main' }));
    expect(reopened).toContainEqual(expect.objectContaining({ name: 'plain', repository: null, branch: null }));
    expect(reopened).toContainEqual(expect.objectContaining({ name: 'no-default', repository: 'no-default', branch: null }));
    expect(readFileSync(join(repository, 'source.txt'), 'utf8')).toBe('original');
    expect(execFileSync('git', ['-C', repository, 'status', '--porcelain'], { encoding: 'utf8' })).toBe(before);
  } finally { if (db.open) db.close(); rmSync(root, { recursive: true, force: true }); }
}, 30_000);

test('maps project validation failures to a safe user message', () => {
  expect(projectRegistrationError(new Error('ENOENT secret-token --verbose'))).toBe('Project path could not be validated.');
});

test('canonicalizes aliases and rejects invalid paths before Project persistence', () => {
  const Constructor = Reflect.get(projectModule, 'ProjectRegistrationService');
  expect(typeof Constructor).toBe('function');
  const root = mkdtempSync(join(tmpdir(), 'sa-project-register-'));
  const directory = join(root, 'project');
  const alias = join(root, 'project-alias');
  const db = createFoundationDatabase(':memory:');
  try {
    mkdirSync(directory);
    writeFileSync(join(directory, 'source.txt'), 'unchanged');
    symlinkSync(directory, alias, 'junction');
    const foundation = new SqliteFoundationRepository(db);
    const workspace = foundation.createWorkspace({ ownerId: 'owner', name: 'Local' });
    const other = foundation.createWorkspace({ ownerId: 'owner', name: 'Other' });
    const repository = new SqliteProjectRepository(db);
    const service = new Constructor(repository);
    const first = service.register({ workspaceId: workspace.workspaceId, candidatePath: directory });
    const duplicate = service.register({ workspaceId: workspace.workspaceId, candidatePath: alias });
    expect(duplicate.projectId).toBe(first.projectId);
    expect(service.register({ workspaceId: other.workspaceId, candidatePath: directory }).projectId).not.toBe(first.projectId);
    expect(() => service.register({ workspaceId: workspace.workspaceId, candidatePath: join(root, 'missing') })).toThrow();
    expect(() => service.register({ workspaceId: workspace.workspaceId, candidatePath: join(directory, 'source.txt') })).toThrow();
    expect(() => service.register({ workspaceId: workspace.workspaceId, candidatePath: parse(directory).root })).toThrow();
    expect(db.prepare('SELECT count(*) AS count FROM projects').get()).toEqual({ count: 2 });
    expect(readFileSync(join(directory, 'source.txt'), 'utf8')).toBe('unchanged');
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('local Project picker persists only successful selections and rejects ambiguous workspaces', async () => {
  const Constructor = Reflect.get(projectModule, 'LocalProjectCatalog');
  expect(typeof Constructor).toBe('function');
  const root = mkdtempSync(join(tmpdir(), 'sa-project-picker-'));
  const directory = join(root, 'project');
  const db = createFoundationDatabase(':memory:');
  try {
    mkdirSync(directory);
    let selection: string | null = null;
    const catalog = new Constructor(db, async () => selection);
    expect(catalog.list()).toEqual([]);
    expect(await catalog.choose()).toEqual({ status: 'CANCELLED', projects: [] });
    selection = join(root, 'missing');
    expect(await catalog.choose()).toEqual({ status: 'ERROR', projects: [] });
    expect(db.prepare('SELECT count(*) AS count FROM workspaces').get()).toEqual({ count: 0 });
    selection = directory;
    const result = await catalog.choose();
    expect(result.status).toBe('REGISTERED');
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.name).toBe('project');
    expect(JSON.stringify(result)).not.toContain(directory);
    expect((await catalog.choose()).projects).toHaveLength(1);
    expect(db.prepare('SELECT count(*) AS count FROM projects').get()).toEqual({ count: 1 });
    db.prepare('UPDATE project_metadata SET repository = ?, default_branch = ?').run('https://user:fake-secret@host.invalid/repo', 'https://user:fake-secret@host.invalid/branch');
    expect(JSON.stringify(catalog.list())).not.toContain('fake-secret');
    expect(catalog.list()[0]).toMatchObject({ repository: null, branch: null });
    new SqliteFoundationRepository(db).createWorkspace({ ownerId: 'local-owner', name: 'Ambiguous' });
    expect(() => catalog.list()).toThrow(/workspace/i);
    expect((await catalog.choose()).status).toBe('ERROR');
    expect(db.prepare('SELECT count(*) AS count FROM projects').get()).toEqual({ count: 1 });
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('routes Project selection through IPC and reads the same catalog after database reopen', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-project-ipc-'));
  const directory = join(root, 'selected');
  const databasePath = join(root, 'platform.sqlite');
  let db = createFoundationDatabase(databasePath);
  const onboarding = { async get() { return { completed: false }; }, async set(input: { completed: boolean }) { return input; } };
  try {
    mkdirSync(directory);
    const catalog = new LocalProjectCatalog(db, async () => directory);
    const added = await routeIpc({ channel: 'project:choose', payload: {} }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, catalog);
    expect(added).toHaveProperty('status', 'REGISTERED');
    expect(added).toHaveProperty('projects', [expect.objectContaining({ name: 'selected' })]);
    await expect(routeIpc({ channel: 'project:choose', payload: { path: directory } }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, catalog)).rejects.toThrow();
    db.close();
    db = createFoundationDatabase(databasePath);
    const reopened = new LocalProjectCatalog(db, async () => null);
    const listed = await routeIpc({ channel: 'project:list', payload: {} }, onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reopened);
    expect(listed).toHaveProperty('projects', [expect.objectContaining({ name: 'selected' })]);
    expect(JSON.stringify(listed)).not.toContain(directory);
  } finally {
    if (db.open) db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
