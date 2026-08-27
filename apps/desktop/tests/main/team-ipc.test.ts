import { expect, test } from 'vitest';
import { TeamClient } from '../../src/main/team-client.js';
test('projects only server workspace facts and fails closed on denied states', async () => { const client = new TeamClient({ async request() { return { status: 403, body: { role: 'ADMIN' } }; } }); await expect(client.workspace('workspace-a')).resolves.toEqual({ state: 'DENIED', members: [], approvals: [] }); });
