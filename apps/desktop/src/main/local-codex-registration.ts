import { realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { SqliteFoundationRepository } from '@super-assistant/persistence';
import type { CodexRegistrationProjection } from '../shared/ipc-contract.js';
import { ensureLocalWorkspace, findLocalWorkspace } from './local-workspace.js';

export class LocalCodexRegistration {
  // eslint-disable-next-line no-unused-vars -- parameter property stores the authoritative database.
  constructor(private readonly database: Database.Database) {}

  save(path: string, version: string): void {
    if (typeof path !== 'string' || path.length === 0 || path.length > 32767 || !isAbsolute(path) || typeof version !== 'string' || version.length > 64 || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Codex registration invalid.');
    const canonical = realpathSync(path);
    if (extname(canonical).toLowerCase() !== '.exe' || !statSync(canonical).isFile()) throw new Error('Codex registration invalid.');
    const register = this.database.transaction(() => {
      const workspaceId = ensureLocalWorkspace(this.database);
      const existing = this.database.prepare('SELECT agent_id FROM local_codex_registrations WHERE workspace_id = ?').get(workspaceId) as { agent_id: string } | undefined;
      const timestamp = new Date().toISOString();
      let agentId: string;
      if (existing) {
        const changed = this.database.prepare("UPDATE agents SET agent_version = ?, connection = 'UNAVAILABLE', availability = 'PAUSED', row_version = row_version + 1 WHERE agent_id = ? AND workspace_id = ?").run(version, existing.agent_id, workspaceId);
        if (changed.changes !== 1) throw new Error('Codex Agent unavailable.');
        agentId = existing.agent_id;
        this.database.prepare('UPDATE local_codex_registrations SET executable_path = ?, observed_version = ?, updated_at = ? WHERE workspace_id = ? AND agent_id = ?').run(canonical, version, timestamp, workspaceId, agentId);
      } else {
        const unlinked = this.database.prepare('SELECT agent_id FROM agents WHERE workspace_id = ? AND name = ? COLLATE NOCASE LIMIT 1').get(workspaceId, 'Codex');
        if (unlinked) throw new Error('Existing Codex Agent requires reconciliation.');
        agentId = new SqliteFoundationRepository(this.database).createAgent({ workspaceId, name: 'Codex', connection: 'UNAVAILABLE', availability: 'PAUSED', agentVersion: version }).agentId;
        this.database.prepare('INSERT INTO local_codex_registrations (workspace_id, agent_id, executable_path, observed_version, updated_at) VALUES (?, ?, ?, ?, ?)').run(workspaceId, agentId, canonical, version, timestamp);
      }
      this.database.prepare('INSERT OR IGNORE INTO version_references (reference_id, owner_kind, owner_id, version, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), 'AGENT', agentId, version, timestamp);
    });
    register();
  }

  get(): CodexRegistrationProjection {
    const workspaceId = findLocalWorkspace(this.database);
    if (!workspaceId) return { state: 'NOT_REGISTERED' };
    const row = this.database.prepare('SELECT r.observed_version AS version FROM local_codex_registrations r JOIN agents a ON a.agent_id = r.agent_id AND a.workspace_id = r.workspace_id WHERE r.workspace_id = ?').get(workspaceId) as { version: string } | undefined;
    if (!row) return { state: 'NOT_REGISTERED' };
    if (typeof row.version !== 'string' || row.version.length > 64 || !/^\d+\.\d+\.\d+$/.test(row.version)) throw new Error('Codex registration invalid.');
    return { state: 'RECHECK_REQUIRED', version: row.version };
  }
}
