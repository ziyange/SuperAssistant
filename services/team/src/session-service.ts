/* eslint-disable no-unused-vars -- session service parameters are public identity contract vocabulary. */
import type { IncomingMessage } from 'node:http';
export type TeamSessionRef = `session:sha256:${string}`;
interface TeamSession { actor: string; workspaceId: string; expiresAt: number; revoked: boolean }

export class TeamSessionService {
  private readonly sessions = new Map<TeamSessionRef, TeamSession>();
  constructor(private readonly nextId: () => string) {}
  create(input: Readonly<{ actor: string; workspaceId: string; expiresAt: number }>): TeamSessionRef {
    if (input.actor.length === 0 || input.workspaceId.length === 0 || !Number.isFinite(input.expiresAt)) throw new Error('TEAM_SESSION_INVALID');
    const ref = `session:sha256:${this.nextId()}` as TeamSessionRef;
    if (this.sessions.has(ref)) throw new Error('TEAM_SESSION_REPLAY');
    this.sessions.set(ref, { ...input, revoked: false });
    return ref;
  }
  resolve(ref: TeamSessionRef, now: number): Readonly<{ actor: string; workspaceId: string }> {
    const session = this.sessions.get(ref);
    if (session === undefined) throw new Error('TEAM_SESSION_UNKNOWN');
    if (session.revoked) throw new Error('TEAM_SESSION_REVOKED');
    if (session.expiresAt <= now) throw new Error('TEAM_SESSION_EXPIRED');
    return { actor: session.actor, workspaceId: session.workspaceId };
  }
  revoke(ref: TeamSessionRef): void { const session = this.sessions.get(ref); if (session === undefined) throw new Error('TEAM_SESSION_UNKNOWN'); session.revoked = true; }
}

export interface PersistentTeamSessionStore {
  createSession(record: Readonly<{ sessionRef: TeamSessionRef; actor: string; workspaceId: string; expiresAt: number }>): Promise<void>;
  getSession(sessionRef: TeamSessionRef): Promise<Readonly<{ actor: string; workspaceId: string; expiresAt: number; revokedAt?: number }> | undefined>;
  revokeSession(sessionRef: TeamSessionRef): Promise<void>;
}

export class PersistentTeamSessionService {
  constructor(private readonly store: PersistentTeamSessionStore, private readonly nextId: () => string) {}
  async create(input: Readonly<{ actor: string; workspaceId: string; expiresAt: number }>): Promise<TeamSessionRef> {
    const ref = `session:sha256:${this.nextId()}` as TeamSessionRef;
    await this.store.createSession({ ...input, sessionRef: ref });
    return ref;
  }
  async resolve(ref: TeamSessionRef, now: number): Promise<Readonly<{ actor: string; workspaceId: string }>> {
    const session = await this.store.getSession(ref);
    if (session === undefined) throw new Error('TEAM_SESSION_UNKNOWN');
    if (session.revokedAt !== undefined) throw new Error('TEAM_SESSION_REVOKED');
    if (session.expiresAt <= now) throw new Error('TEAM_SESSION_EXPIRED');
    return { actor: session.actor, workspaceId: session.workspaceId };
  }
  async revoke(ref: TeamSessionRef): Promise<void> { await this.store.revokeSession(ref); }
}

/** Converts only an opaque bearer session reference into server-side identity. */
export function createSessionRequestAuthenticator(sessions: TeamSessionService, now: () => number): Readonly<{ authenticate(request: IncomingMessage): Promise<Readonly<{ actor: string; workspaceId: string }> | undefined> }> {
  return { async authenticate(request) {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer session:sha256:')) return undefined;
    try { return sessions.resolve(header.slice('Bearer '.length) as TeamSessionRef, now()); } catch { return undefined; }
  } };
}

export function createPersistentSessionRequestAuthenticator(sessions: PersistentTeamSessionService, now: () => number): Readonly<{ authenticate(request: IncomingMessage): Promise<Readonly<{ actor: string; workspaceId: string }> | undefined> }> {
  return { async authenticate(request) {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer session:sha256:')) return undefined;
    try { return await sessions.resolve(header.slice('Bearer '.length) as TeamSessionRef, now()); } catch { return undefined; }
  } };
}
