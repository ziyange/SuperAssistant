import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { findLocalWorkspace } from './local-workspace.js';

const PROTOCOL = '0.121.0';
const NAME = 'Codex built-in development';
const VERSION = '1';

/** Stable catalog identity only; it is never executable authority. */
export function builtinCodexFunctionId(agentId: string): string {
  return 'builtin-codex-' + createHash('sha256').update('super-assistant:codex-function:v1:' + agentId).digest('hex');
}

export function provisionBuiltinCodexFunction(db: Database.Database, workspaceId: string, agentId: string, observedVersion: string): void {
  if (observedVersion !== PROTOCOL) return;
  if (findLocalWorkspace(db) !== workspaceId) throw new Error('FUNCTION_WORKSPACE_UNAVAILABLE');
  const registered = db.prepare(`
    SELECT 1 FROM local_codex_registrations r
    JOIN agents a ON a.agent_id = r.agent_id AND a.workspace_id = r.workspace_id
    WHERE r.workspace_id = ? AND r.agent_id = ? AND r.observed_version = ?
      AND a.name = 'Codex' COLLATE NOCASE AND a.agent_version = ?
  `).get(workspaceId, agentId, PROTOCOL, PROTOCOL);
  if (!registered) throw new Error('FUNCTION_AGENT_UNAVAILABLE');
  const id = builtinCodexFunctionId(agentId);
  const existing = db.prepare('SELECT agent_id, name, function_version FROM functions WHERE function_id = ?')
    .get(id) as { agent_id: string; name: string; function_version: string } | undefined;
  if (existing) {
    if (existing.agent_id !== agentId || existing.name !== NAME || existing.function_version !== VERSION) throw new Error('FUNCTION_IDENTITY_CONFLICT');
    return;
  }
  db.prepare("INSERT INTO functions (function_id, agent_id, name, function_version, lifecycle) VALUES (?, ?, ?, ?, 'ACTIVE')")
    .run(id, agentId, NAME, VERSION);
}

export function isBuiltinCodexFunction(db: Database.Database, workspaceId: string, agentId: string, functionId: string, version: string): boolean {
  try {
    if (findLocalWorkspace(db) !== workspaceId || functionId !== builtinCodexFunctionId(agentId) || version !== VERSION) return false;
    return Boolean(db.prepare(`
      SELECT 1 FROM local_codex_registrations r
      JOIN agents a ON a.agent_id = r.agent_id AND a.workspace_id = r.workspace_id
      JOIN functions f ON f.agent_id = a.agent_id
      WHERE r.workspace_id = ? AND r.agent_id = ? AND r.observed_version = ?
        AND a.name = 'Codex' COLLATE NOCASE AND a.agent_version = ? AND a.connection <> 'DISABLED'
        AND f.function_id = ? AND f.name = ? AND f.function_version = ? AND f.lifecycle = 'ACTIVE'
    `).get(workspaceId, agentId, PROTOCOL, PROTOCOL, functionId, NAME, VERSION));
  } catch { return false; }
}
