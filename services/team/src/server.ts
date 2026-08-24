/* eslint-disable no-unused-vars -- TypeScript handler parameters are public port vocabulary. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

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
