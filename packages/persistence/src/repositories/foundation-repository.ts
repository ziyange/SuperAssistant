/* eslint-disable no-unused-vars -- constructor parameter property is a TypeScript runtime dependency. */
import type Database from 'better-sqlite3';
import { createFoundationId, type Agent, type FoundationId, type FoundationRepository, type FunctionRecord, type Project, type Workspace, isValidAgentState } from '@super-assistant/domain';

function now(): string { return new Date().toISOString(); }
function canonicalPath(path: string): string { return path.replaceAll('\\', '/').replace(/\/+$/, ''); }
function canonicalKey(path: string): string { return canonicalPath(path).toLowerCase(); }
function asId(value: string): FoundationId { return value as FoundationId; }

export class SqliteFoundationRepository implements FoundationRepository {
  constructor(private readonly database: Database.Database) {}
  createWorkspace(input: { ownerId: string; name: string }): Workspace {
    const workspaceId = createFoundationId(); const timestamp = now();
    this.database.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, 1)').run(workspaceId, input.ownerId, input.name, 'ACTIVE', timestamp, timestamp);
    return { workspaceId, ownerId: input.ownerId, name: input.name, status: 'ACTIVE', createdAt: timestamp, updatedAt: timestamp, rowVersion: 1 };
  }
  createAgent(input: { workspaceId: FoundationId; name: string; connection: Agent['connection']; availability: Agent['availability']; agentVersion?: string; credentialRef?: string }): Agent {
    if (!isValidAgentState(input.connection, input.availability)) throw new Error('Invalid Agent connection and availability combination.');
    const agentId = createFoundationId(); const agentVersion = input.agentVersion ?? '1.0.0'; const credentialRef = input.credentialRef ?? null;
    this.database.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, 1)').run(agentId, input.workspaceId, input.name, agentVersion, input.connection, input.availability, credentialRef);
    return { agentId, workspaceId: input.workspaceId, name: input.name, agentVersion, connection: input.connection, availability: input.availability, credentialRef, rowVersion: 1 };
  }
  createProject(input: { workspaceId: FoundationId; name: string; canonicalPath: string; defaultAgentId?: FoundationId; snapshotVersion?: number }): Project {
    const projectId = createFoundationId(); const timestamp = now(); const normalizedPath = canonicalPath(input.canonicalPath); const defaultAgentId = input.defaultAgentId ?? null; const snapshotVersion = input.snapshotVersion ?? 1;
    try { this.database.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(projectId, input.workspaceId, input.name, normalizedPath, canonicalKey(input.canonicalPath), 'INITIALIZING', defaultAgentId, snapshotVersion, timestamp, timestamp); }
    catch (error) { if (String(error).includes('UNIQUE constraint failed: projects.workspace_id, projects.canonical_key')) throw new Error('Canonical Project path already exists.'); throw error; }
    return { projectId, workspaceId: input.workspaceId, name: input.name, canonicalPath: normalizedPath, status: 'INITIALIZING', defaultAgentId, snapshotVersion, createdAt: timestamp, updatedAt: timestamp, rowVersion: 1 };
  }
  getProject(projectId: FoundationId): Project | null {
    const row = this.database.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId) as Record<string, unknown> | undefined;
    return row ? { projectId: asId(String(row.project_id)), workspaceId: asId(String(row.workspace_id)), name: String(row.name), canonicalPath: String(row.canonical_path), status: String(row.status) as Project['status'], defaultAgentId: row.default_agent_id ? asId(String(row.default_agent_id)) : null, snapshotVersion: Number(row.snapshot_version), createdAt: String(row.created_at), updatedAt: String(row.updated_at), rowVersion: Number(row.row_version) } : null;
  }
  createFunction(input: { agentId: FoundationId; name: string; functionVersion: string }): FunctionRecord {
    const functionId = createFoundationId(); this.database.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run(functionId, input.agentId, input.name, input.functionVersion, 'ACTIVE');
    this.database.prepare('INSERT INTO version_references VALUES (?, ?, ?, ?, ?)').run(createFoundationId(), 'FUNCTION', functionId, input.functionVersion, now());
    return { functionId, agentId: input.agentId, name: input.name, functionVersion: input.functionVersion, lifecycle: 'ACTIVE' };
  }
  listFunctions(agentId: FoundationId): FunctionRecord[] { return (this.database.prepare('SELECT * FROM functions WHERE agent_id = ? ORDER BY name').all(agentId) as Array<Record<string, unknown>>).map((row) => ({ functionId: asId(String(row.function_id)), agentId: asId(String(row.agent_id)), name: String(row.name), functionVersion: String(row.function_version), lifecycle: String(row.lifecycle) as FunctionRecord['lifecycle'] })); }
}
