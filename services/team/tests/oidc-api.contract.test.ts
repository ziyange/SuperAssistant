import { expect, test } from 'vitest';
import { createSessionBoundTeamApi } from '../src/team-api.js';
import { TeamSessionService } from '../src/session-service.js';

test('derives Team API actor and Workspace from session rather than caller input', async () => {
  const sessions = new TeamSessionService(() => 'session-1');
  const sessionRef = sessions.create({ actor: 'trusted-subject', workspaceId: 'team-1', expiresAt: 100 });
  const api = createSessionBoundTeamApi({ async createWorkspace() {}, async getWorkspace() { return undefined; }, async listEvents() { return []; } }, sessions, () => 10);
  await expect(api.handle({ method: 'GET', path: '/v1/workspaces/team-2', sessionRef })).resolves.toMatchObject({ status: 403 });
  await expect(api.handle({ method: 'GET', path: '/v1/workspaces/team-1', sessionRef: 'session:sha256:unknown' })).resolves.toMatchObject({ status: 401 });
});
