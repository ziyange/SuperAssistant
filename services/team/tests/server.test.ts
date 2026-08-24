import { expect, test } from 'vitest';
import { createTeamRequestHandler } from '../src/server.js';

test('keeps Team commands read-only before verified authority cutover', async () => {
  const handler = createTeamRequestHandler(() => 'LOCAL');
  await expect(handler({ method: 'POST', path: '/v1/commands' })).resolves.toEqual({
    status: 409,
    headers: { 'content-type': 'application/json' },
    body: '{"code":"TEAM_AUTHORITY_NOT_ACTIVE"}'
  });
});

test('serves health and a bounded SSE authority projection after cutover', async () => {
  const handler = createTeamRequestHandler(() => 'TEAM');
  await expect(handler({ method: 'GET', path: '/health' })).resolves.toEqual({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: '{"authority":"TEAM","writable":true}'
  });
  await expect(handler({ method: 'GET', path: '/v1/events' })).resolves.toEqual({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: 'event: authority\ndata: {"authority":"TEAM"}\n\n'
  });
});
