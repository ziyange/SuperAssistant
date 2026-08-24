import { expect, test } from 'vitest';
import { createTeamApi } from '../src/team-api.js';
import { createAuthenticatedTeamServer } from '../src/server.js';

test('rejects unauthenticated and cross-workspace API requests before repository access', async () => {
  let calls = 0;
  const api = createTeamApi({
    async createWorkspace() { calls += 1; },
    async getWorkspace() { calls += 1; return { workspaceId: 'team-1', name: 'Team', ownerActor: 'actor-1' }; },
    async listEvents() { calls += 1; return []; }
  });
  await expect(api.handle({ method: 'GET', path: '/v1/workspaces/team-1' })).resolves.toMatchObject({ status: 401 });
  await expect(api.handle({ method: 'GET', path: '/v1/workspaces/team-1', actor: 'actor-2', workspaceId: 'team-2' })).resolves.toMatchObject({ status: 403 });
  expect(calls).toBe(0);
});

test('creates and reads a Workspace only in the actor context', async () => {
  const records = new Map<string, { workspaceId: string; name: string; ownerActor: string }>();
  const api = createTeamApi({
    async createWorkspace(record) { records.set(record.workspaceId, record); },
    async getWorkspace(workspaceId) { return records.get(workspaceId); },
    async listEvents() { return []; }
  });
  expect((await api.handle({ method: 'POST', path: '/v1/workspaces', actor: 'actor-1', workspaceId: 'team-1', body: { workspaceId: 'team-1', name: 'Team' } })).status).toBe(201);
  expect(await api.handle({ method: 'GET', path: '/v1/workspaces/team-1', actor: 'actor-1', workspaceId: 'team-1' })).toMatchObject({ status: 200 });
  expect(await api.handle({ method: 'GET', path: '/v1/workspaces/team-1/events', actor: 'actor-1', workspaceId: 'team-1' })).toEqual({ status: 200, body: { events: [] } });
});

test('HTTP adapter delegates identity to its verifier instead of trusting a caller header', async () => {
  const records = new Map<string, { workspaceId: string; name: string; ownerActor: string }>();
  const server = createAuthenticatedTeamServer({
    async createWorkspace(record) { records.set(record.workspaceId, record); },
    async getWorkspace(workspaceId) { return records.get(workspaceId); },
    async listEvents() { return []; }
  }, { async authenticate() { return { actor: 'actor-1', workspaceId: 'team-1' }; } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const response = await globalThis.fetch(`http://127.0.0.1:${port}/v1/workspaces`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-team-actor': 'attacker' }, body: JSON.stringify({ workspaceId: 'team-1', name: 'Team' }) });
    expect(response.status).toBe(201);
    expect(records.get('team-1')?.ownerActor).toBe('actor-1');
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error === undefined ? resolve() : reject(error))); }
});
