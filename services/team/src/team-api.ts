/* eslint-disable no-unused-vars -- Team API port parameter names are public contract vocabulary. */
import type { TeamWorkspaceRecord, TeamWorkspaceEvent } from './postgres/team-repository.js';
import type { TeamSessionRef, TeamSessionService } from './session-service.js';

export interface TeamApiRepository {
  createWorkspace(record: TeamWorkspaceRecord): Promise<void>;
  getWorkspace(workspaceId: string): Promise<TeamWorkspaceRecord | undefined>;
  listEvents(workspaceId: string): Promise<readonly TeamWorkspaceEvent[]>;
}
export interface TeamApiRequest { method: string; path: string; actor?: string; workspaceId?: string; body?: Readonly<Record<string, unknown>> }
export interface TeamApiResponse { status: number; body: Readonly<Record<string, unknown>> }

export class TeamAuthorityHealth {
  constructor(private readonly available: () => boolean) {}
  writeState(): Readonly<{ writable: boolean; reason?: 'TEAM_AUTHORITY_UNAVAILABLE' }> { return this.available() ? { writable: true } : { writable: false, reason: 'TEAM_AUTHORITY_UNAVAILABLE' }; }
  readState(): Readonly<{ readable: boolean; reason?: 'TEAM_AUTHORITY_UNAVAILABLE' }> { return this.available() ? { readable: true } : { readable: false, reason: 'TEAM_AUTHORITY_UNAVAILABLE' }; }
}

export function createTeamApi(repository: TeamApiRepository, health = new TeamAuthorityHealth(() => true)) {
  return { async handle(request: TeamApiRequest): Promise<TeamApiResponse> {
    if (request.actor === undefined || request.workspaceId === undefined) return { status: 401, body: { code: 'TEAM_SESSION_REQUIRED' } };
    if (!health.readState().readable) return { status: 503, body: { code: 'TEAM_AUTHORITY_UNAVAILABLE' } };
    const segments = request.path.split('/').filter(Boolean);
    const target = segments[2];
    if (target !== undefined && target !== request.workspaceId) return { status: 403, body: { code: 'WORKSPACE_DENIED' } };
    if (request.method === 'GET' && segments.length === 3 && target !== undefined) {
      const workspace = await repository.getWorkspace(target);
      return workspace === undefined ? { status: 404, body: { code: 'NOT_FOUND' } } : { status: 200, body: { workspace } };
    }
    if (request.method === 'GET' && segments.length === 4 && target !== undefined && segments[3] === 'events') {
      return { status: 200, body: { events: await repository.listEvents(target) } };
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

export function createSessionBoundTeamApi(repository: TeamApiRepository, sessions: TeamSessionService, now: () => number, health = new TeamAuthorityHealth(() => true)) {
  const api = createTeamApi(repository, health);
  return { async handle(input: Readonly<{ method: string; path: string; sessionRef: TeamSessionRef; body?: Readonly<Record<string, unknown>> }>): Promise<TeamApiResponse> {
    try {
      const context = sessions.resolve(input.sessionRef, now());
      return api.handle({ method: input.method, path: input.path, ...(input.body === undefined ? {} : { body: input.body }), ...context });
    } catch { return { status: 401, body: { code: 'TEAM_SESSION_INVALID' } }; }
  } };
}
