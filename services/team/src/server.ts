/* eslint-disable no-unused-vars -- TypeScript handler parameters are public port vocabulary. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import type { TeamApiAuthorizer, TeamApiRepository, TeamApiRequest } from './team-api.js';
import { createTeamApi, TeamAuthorityHealth } from './team-api.js';

export interface TeamRequest { method: string; path: string }
export interface TeamResponse { status: number; headers: Readonly<Record<string, string>>; body: string }
export type TeamAuthority = 'LOCAL' | 'TEAM';

export function createTeamRequestHandler(authority: () => TeamAuthority): (request: TeamRequest) => Promise<TeamResponse> {
  return async request => {
    const current = authority();
    if (request.method === 'GET' && request.path === '/health') {
      return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ authority: current, writable: current === 'TEAM' }) };
    }
    if (request.method === 'GET' && request.path === '/v1/events') {
      return { status: 200, headers: { 'content-type': 'text/event-stream' }, body: `event: authority\ndata: ${JSON.stringify({ authority: current })}\n\n` };
    }
    if (request.method === 'POST' && request.path === '/v1/commands' && current !== 'TEAM') {
      return { status: 409, headers: { 'content-type': 'application/json' }, body: '{"code":"TEAM_AUTHORITY_NOT_ACTIVE"}' };
    }
    return { status: 404, headers: { 'content-type': 'application/json' }, body: '{"code":"NOT_FOUND"}' };
  };
}

export function createTeamServer(authority: () => TeamAuthority) {
  const handler = createTeamRequestHandler(authority);
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    void handler({ method: request.method ?? 'GET', path: new URL(request.url ?? '/', 'http://localhost').pathname }).then(result => {
      response.writeHead(result.status, result.headers);
      response.end(result.body);
    });
  });
}

export interface TeamRequestAuthenticator {
  authenticate(request: IncomingMessage): Promise<Readonly<{ actor: string; workspaceId: string }> | undefined>;
}

/**
 * HTTP adapter for a verified identity boundary. It deliberately accepts an
 * authenticator function rather than treating request headers as identity.
 */
export function createAuthenticatedTeamServer(repository: TeamApiRepository, authenticator: TeamRequestAuthenticator, health = new TeamAuthorityHealth(() => true), authorizer?: TeamApiAuthorizer) {
  const api = createTeamApi(repository, health, authorizer);
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    void (async () => {
      const identity = await authenticator.authenticate(request);
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      let body: Readonly<Record<string, unknown>> | undefined;
      if (request.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Readonly<Record<string, unknown>>; } catch { body = undefined; }
      }
      const result = await api.handle({ method: request.method ?? 'GET', path, ...(body === undefined ? {} : { body }), ...(identity === undefined ? {} : identity) } satisfies TeamApiRequest);
      const stream = request.method === 'GET' && path.endsWith('/events') && result.status === 200;
      response.writeHead(result.status, { 'content-type': stream ? 'text/event-stream' : 'application/json' });
      response.end(stream ? `event: team-events\ndata: ${JSON.stringify(result.body)}\n\n` : JSON.stringify(result.body));
    })().catch(() => { response.writeHead(503, { 'content-type': 'application/json' }); response.end('{"code":"TEAM_AUTHORITY_UNAVAILABLE"}'); });
  });
}
