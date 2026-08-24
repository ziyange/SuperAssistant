/* eslint-disable no-unused-vars -- Team API port parameter names are public contract vocabulary. */
import type { TeamWorkspaceRecord, TeamWorkspaceEvent } from './postgres/team-repository.js';
import type { TeamSessionRef, TeamSessionService } from './session-service.js';
import type { TeamAction, TeamAuthorizationDecision } from './team-authorization.js';

export interface TeamApiRepository {
  createWorkspace(record: TeamWorkspaceRecord): Promise<void>;
  getWorkspace(workspaceId: string): Promise<TeamWorkspaceRecord | undefined>;
  listEvents(workspaceId: string): Promise<readonly TeamWorkspaceEvent[]>;
  exportAudit?(input: Readonly<{ actor: string; workspaceId: string; from: number; to: number }>): Promise<Readonly<Record<string, unknown>>>;
  executeRetention?(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; authorizationRef: string }>): Promise<{ deleted: true }>;
}
export interface TeamApiRequest { method: string; path: string; actor?: string; workspaceId?: string; body?: Readonly<Record<string, unknown>> }
export interface TeamApiResponse { status: number; body: Readonly<Record<string, unknown>> }
export interface TeamApiAuthorizer {
  authorize(input: Readonly<{ actor: string; workspaceId: string; action: TeamAction }>): Promise<TeamAuthorizationDecision>;
}

const denyByDefault: TeamApiAuthorizer = { async authorize() { return { allowed: false, reason: 'ROLE_DENIED' }; } };

export class TeamAuthorityHealth {
  constructor(private readonly available: () => boolean) {}
  writeState(): Readonly<{ writable: boolean; reason?: 'TEAM_AUTHORITY_UNAVAILABLE' }> { return this.available() ? { writable: true } : { writable: false, reason: 'TEAM_AUTHORITY_UNAVAILABLE' }; }
  readState(): Readonly<{ readable: boolean; reason?: 'TEAM_AUTHORITY_UNAVAILABLE' }> { return this.available() ? { readable: true } : { readable: false, reason: 'TEAM_AUTHORITY_UNAVAILABLE' }; }
}

export function createTeamApi(repository: TeamApiRepository, health = new TeamAuthorityHealth(() => true), authorizer: TeamApiAuthorizer = denyByDefault) {
  return { async handle(request: TeamApiRequest): Promise<TeamApiResponse> {
    if (request.actor === undefined || request.workspaceId === undefined) return { status: 401, body: { code: 'TEAM_SESSION_REQUIRED' } };
    if (!health.readState().readable) return { status: 503, body: { code: 'TEAM_AUTHORITY_UNAVAILABLE' } };
    const segments = request.path.split('/').filter(Boolean);
    const target = segments[2];
    if (target !== undefined && target !== request.workspaceId) return { status: 403, body: { code: 'WORKSPACE_DENIED' } };
    const action: TeamAction | undefined = request.method === 'GET' ? 'READ' : request.method === 'POST' && (request.path === '/v1/workspaces' || segments[3] === 'retention-executions') ? 'WRITE' : undefined;
    if (action !== undefined) {
      const decision = await authorizer.authorize({ actor: request.actor, workspaceId: request.workspaceId, action });
      if (!decision.allowed) return { status: 403, body: { code: decision.reason } };
    }
    if (request.method === 'GET' && segments.length === 3 && target !== undefined) {
      const workspace = await repository.getWorkspace(target);
      return workspace === undefined ? { status: 404, body: { code: 'NOT_FOUND' } } : { status: 200, body: { workspace } };
    }
    if (request.method === 'GET' && segments.length === 4 && target !== undefined && segments[3] === 'events') {
      return { status: 200, body: { events: await repository.listEvents(target) } };
    }
    if (request.method === 'GET' && segments.length === 4 && target !== undefined && segments[3] === 'audit-export') {
      if (repository.exportAudit === undefined) return { status: 503, body: { code: 'AUDIT_EXPORT_UNAVAILABLE' } };
      return { status: 200, body: await repository.exportAudit({ actor: request.actor, workspaceId: target, from: 0, to: Number.MAX_SAFE_INTEGER }) };
    }
    if (request.method === 'POST' && segments.length === 4 && target !== undefined && segments[3] === 'retention-executions') {
      if (!health.writeState().writable) return { status: 503, body: { code: 'TEAM_AUTHORITY_UNAVAILABLE' } };
      if (repository.executeRetention === undefined) return { status: 503, body: { code: 'RETENTION_UNAVAILABLE' } };
      const recordId = request.body?.recordId;
      const policyVersion = request.body?.policyVersion;
      const authorizationRef = request.body?.authorizationRef;
      if (typeof recordId !== 'string' || recordId.length === 0 || typeof policyVersion !== 'string' || policyVersion.length === 0 || typeof authorizationRef !== 'string' || !/^grant:/.test(authorizationRef)) return { status: 400, body: { code: 'RETENTION_REQUEST_INVALID' } };
      try {
        await repository.executeRetention({ actor: request.actor, workspaceId: target, recordId, policyVersion, authorizationRef });
        return { status: 200, body: { recordId, state: 'DELETED_BY_POLICY' } };
      } catch { return { status: 409, body: { code: 'RETENTION_EXECUTION_DENIED' } }; }
    }
    if (request.method === 'POST' && request.path === '/v1/workspaces') {
      if (!health.writeState().writable) return { status: 503, body: { code: 'TEAM_AUTHORITY_UNAVAILABLE' } };
      const workspaceId = request.body?.workspaceId;
      const name = request.body?.name;
      if (typeof workspaceId !== 'string' || workspaceId !== request.workspaceId || typeof name !== 'string' || name.length === 0) return { status: 400, body: { code: 'TEAM_REQUEST_INVALID' } };
      await repository.createWorkspace({ workspaceId, name, ownerActor: request.actor });
      return { status: 201, body: { workspaceId } };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  } };
}

export function createSessionBoundTeamApi(repository: TeamApiRepository, sessions: TeamSessionService, now: () => number, health = new TeamAuthorityHealth(() => true), authorizer: TeamApiAuthorizer = denyByDefault) {
  const api = createTeamApi(repository, health, authorizer);
  return { async handle(input: Readonly<{ method: string; path: string; sessionRef: TeamSessionRef; body?: Readonly<Record<string, unknown>> }>): Promise<TeamApiResponse> {
    try {
      const context = sessions.resolve(input.sessionRef, now());
      return api.handle({ method: input.method, path: input.path, ...(input.body === undefined ? {} : { body: input.body }), ...context });
    } catch { return { status: 401, body: { code: 'TEAM_SESSION_INVALID' } }; }
  } };
}
