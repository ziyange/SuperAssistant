import { expect, test } from 'vitest';
import { PersistentTeamSessionService, TeamSessionService } from '../src/session-service.js';

test('returns only a validated opaque session scope and rejects expiry/revocation', () => {
  let sequence = 0;
  const sessions = new TeamSessionService(() => `session-${++sequence}`);
  const ref = sessions.create({ actor: 'subject-1', workspaceId: 'team-1', expiresAt: 100 });
  expect(sessions.resolve(ref, 99)).toEqual({ actor: 'subject-1', workspaceId: 'team-1' });
  sessions.revoke(ref);
  expect(() => sessions.resolve(ref, 99)).toThrow('TEAM_SESSION_REVOKED');
  const expired = sessions.create({ actor: 'subject-2', workspaceId: 'team-1', expiresAt: 100 });
  expect(() => sessions.resolve(expired, 100)).toThrow('TEAM_SESSION_EXPIRED');
});

test('persists opaque session scope through a server-side store', async () => {
  const records = new Map<string, { actor: string; workspaceId: string; expiresAt: number; revokedAt?: number }>();
  const sessions = new PersistentTeamSessionService({ async createSession(record) { records.set(record.sessionRef, { actor: record.actor, workspaceId: record.workspaceId, expiresAt: record.expiresAt }); }, async getSession(ref) { return records.get(ref); }, async revokeSession(ref) { const record = records.get(ref); if (record) record.revokedAt = 1; } }, () => 'persisted');
  const ref = await sessions.create({ actor: 'subject', workspaceId: 'team-1', expiresAt: 100 });
  expect(await sessions.resolve(ref, 10)).toEqual({ actor: 'subject', workspaceId: 'team-1' });
  await sessions.revoke(ref);
  await expect(sessions.resolve(ref, 10)).rejects.toThrow('TEAM_SESSION_REVOKED');
});
