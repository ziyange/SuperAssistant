/* eslint-disable no-unused-vars -- TypeScript handler parameters are public port vocabulary. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { clearTimeout, setImmediate, setTimeout } from 'node:timers';
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

const MAX_TEAM_REQUEST_BYTES = 1024 * 1024;

function rejectRequest(request: IncomingMessage, response: ServerResponse, status: 401 | 413, code: string): void {
  // Drain without retaining bytes so the peer can receive the rejection.
  // Both the drain cap and deadline bound a sender that ignores the rejection.
  request.on('error', () => {});
  const deadline = setTimeout(() => request.destroy(), 10_000);
  deadline.unref();
  request.once('end', () => clearTimeout(deadline));
  request.once('close', () => clearTimeout(deadline));
  let drained = 0;
  let stopping = false;
  request.on('data', (chunk: Buffer) => {
    drained += chunk.length;
    if (!stopping && drained > 2 * MAX_TEAM_REQUEST_BYTES) {
      stopping = true;
      request.pause();
      const finishSending = () => { if (!request.socket.destroyed) request.socket.end(); };
      if (response.writableFinished) finishSending();
      else response.once('finish', finishSending);
    }
  });
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ code }));
  // The async iterator's return may pause the stream after this function returns.
  setImmediate(() => { if (!request.destroyed && !stopping) request.resume(); });
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
      if (identity === undefined) {
        rejectRequest(request, response, 401, 'TEAM_SESSION_REQUIRED');
        return;
      }
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      let body: Readonly<Record<string, unknown>> | undefined;
      if (request.method === 'POST') {
        const declared = request.headers['content-length'];
        if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > MAX_TEAM_REQUEST_BYTES)) {
          rejectRequest(request, response, 413, 'TEAM_BODY_TOO_LARGE');
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > MAX_TEAM_REQUEST_BYTES) {
            rejectRequest(request, response, 413, 'TEAM_BODY_TOO_LARGE');
            return;
          }
          chunks.push(bytes);
        }
        try {
          const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          body = parsed as Readonly<Record<string, unknown>>;
        } catch {
          response.writeHead(400, { 'content-type': 'application/json' });
          response.end('{"code":"TEAM_REQUEST_INVALID"}');
          return;
        }
      }
      const result = await api.handle({ method: request.method ?? 'GET', path, ...(body === undefined ? {} : { body }), ...(identity === undefined ? {} : identity) } satisfies TeamApiRequest);
      const stream = request.method === 'GET' && path.endsWith('/events') && result.status === 200;
      response.writeHead(result.status, { 'content-type': stream ? 'text/event-stream' : 'application/json' });
      response.end(stream ? `event: team-events\ndata: ${JSON.stringify(result.body)}\n\n` : JSON.stringify(result.body));
    })().catch(() => { response.writeHead(503, { 'content-type': 'application/json' }); response.end('{"code":"TEAM_AUTHORITY_UNAVAILABLE"}'); });
  });
}
