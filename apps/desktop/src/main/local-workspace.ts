import type Database from 'better-sqlite3';
import type { FoundationId } from '@super-assistant/domain';
import { SqliteFoundationRepository } from '@super-assistant/persistence';

export function findLocalWorkspace(database: Database.Database): FoundationId | null {
  const rows = database.prepare("SELECT workspace_id, status FROM workspaces WHERE owner_id = ? AND status IN ('ACTIVE', 'LOCKED') ORDER BY workspace_id LIMIT 2").all('local-owner') as { workspace_id: string; status: string }[];
  if (rows.length > 1) throw new Error('Ambiguous local workspace.');
  if (rows[0]?.status === 'LOCKED') throw new Error('Local workspace is locked.');
  return rows[0] ? rows[0].workspace_id as FoundationId : null;
}

export function ensureLocalWorkspace(database: Database.Database): FoundationId {
  return findLocalWorkspace(database) ?? new SqliteFoundationRepository(database).createWorkspace({ ownerId: 'local-owner', name: 'Local Workspace' }).workspaceId;
}
