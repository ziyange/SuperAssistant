import type Database from 'better-sqlite3';
import { parseH1ProposalCandidate } from '@super-assistant/domain';
import { findLocalWorkspace } from './local-workspace.js';
import type { ProposalContextProjection } from '../shared/ipc-contract.js';
import { builtinCodexFunctionId, isBuiltinCodexFunction } from './local-codex-function.js';

export function readLocalProposalContext(database: Database.Database, projectId: string): ProposalContextProjection {
  try {
    return database.transaction((): ProposalContextProjection => {
      const workspace = findLocalWorkspace(database);
      if (!workspace) return { status: 'PROJECT_UNAVAILABLE' };
      const context = database.prepare(`
        SELECT a.agent_id AS codex_id
        FROM projects p
        LEFT JOIN local_codex_registrations r ON r.workspace_id = p.workspace_id AND r.agent_id = p.default_agent_id
        LEFT JOIN agents a ON a.workspace_id = p.workspace_id AND a.agent_id = r.agent_id
          AND a.name = 'Codex' COLLATE NOCASE AND a.connection <> 'DISABLED'
          AND a.agent_version = r.observed_version AND length(trim(a.agent_version)) > 0
        WHERE p.workspace_id = ? AND p.project_id = ? AND p.status = 'ACTIVE'
      `).get(workspace, projectId) as { codex_id: string | null } | undefined;
      if (!context) return { status: 'PROJECT_UNAVAILABLE' };
      if (!context.codex_id) return { status: 'CODEX_REQUIRED' };
      const id = builtinCodexFunctionId(context.codex_id);
      return { status: isBuiltinCodexFunction(database, workspace, context.codex_id, id, '1') ? 'LIVE_VERIFICATION_REQUIRED' : 'FUNCTION_REQUIRED' };
    })();
  } catch {
    return { status: 'PROJECT_UNAVAILABLE' };
  }
}

export function checkLocalProposalCatalog(database: Database.Database, input: unknown): { status: 'REJECTED' | 'REQUIRES_LIVE_VERIFICATION' } {
  try {
    const candidate = parseH1ProposalCandidate(input);
    return database.transaction(() => {
      const workspace = findLocalWorkspace(database);
      if (!workspace || candidate.workspaceId !== workspace) return { status: 'REJECTED' as const };
      if (!isBuiltinCodexFunction(database, workspace, candidate.agentId, candidate.functionId, candidate.functionVersion)) return { status: 'REJECTED' as const };
      const match = database.prepare(`
        SELECT 1 FROM projects p
        JOIN agents a ON a.agent_id = p.default_agent_id AND a.workspace_id = p.workspace_id
        JOIN local_codex_registrations r ON r.agent_id = a.agent_id AND r.workspace_id = p.workspace_id
        JOIN functions f ON f.agent_id = a.agent_id
        WHERE p.workspace_id = ? AND p.project_id = ? AND p.status = 'ACTIVE'
          AND CAST(p.snapshot_version AS TEXT) = ?
          AND a.agent_id = ? AND a.name = 'Codex' COLLATE NOCASE AND a.connection <> 'DISABLED'
          AND a.agent_version = ? AND r.observed_version = a.agent_version
          AND f.function_id = ? AND f.lifecycle = 'ACTIVE' AND f.function_version = ?
      `).get(workspace, candidate.projectId, candidate.projectSnapshotVersion, candidate.agentId, candidate.agentVersion, candidate.functionId, candidate.functionVersion);
      return { status: match ? 'REQUIRES_LIVE_VERIFICATION' as const : 'REJECTED' as const };
    })();
  } catch {
    return { status: 'REJECTED' };
  }
}
