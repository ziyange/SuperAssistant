import { expect, test } from 'vitest';
import { createTeamApi } from '../src/team-api.js';

test('requires role authorization before a governed audit export route accesses records', async () => {
  let calls = 0;
  const api = createTeamApi({
    async createWorkspace() {}, async getWorkspace() { return undefined; }, async listEvents() { return []; },
    async exportAudit() { calls += 1; return { manifest: { digest: 'sha256:aaa' }, records: [] }; }
  }, undefined, { async authorize() { return { allowed: false as const, reason: 'ROLE_DENIED' as const }; } });

  await expect(api.handle({ method: 'GET', path: '/v1/workspaces/workspace-a/audit-export', actor: 'auditor-a', workspaceId: 'workspace-a' })).resolves.toEqual({ status: 403, body: { code: 'ROLE_DENIED' } });
  expect(calls).toBe(0);
});

test('returns an audit export only after the actor is authorized in its workspace', async () => {
  const api = createTeamApi({
    async createWorkspace() {}, async getWorkspace() { return undefined; }, async listEvents() { return []; },
    async exportAudit(input) { return { manifest: { workspaceId: input.workspaceId, digest: 'sha256:aaa' }, records: [] }; }
  }, undefined, { async authorize() { return { allowed: true as const }; } });
  await expect(api.handle({ method: 'GET', path: '/v1/workspaces/workspace-a/audit-export', actor: 'auditor-a', workspaceId: 'workspace-a' })).resolves.toEqual({ status: 200, body: { manifest: { workspaceId: 'workspace-a', digest: 'sha256:aaa' }, records: [] } });
});

test('does not expose a retention deletion until a workspace-authorized repository consumes its bound Grant', async () => {
  let calls = 0;
  const api = createTeamApi({
    async createWorkspace() {}, async getWorkspace() { return undefined; }, async listEvents() { return []; },
    async executeRetention() { calls += 1; throw new Error('RETENTION_EXECUTION_DENIED'); }
  }, undefined, { async authorize() { return { allowed: true as const }; } });
  await expect(api.handle({ method: 'POST', path: '/v1/workspaces/workspace-a/retention-executions', actor: 'operator-a', workspaceId: 'workspace-a', body: { recordId: 'record-a', policyVersion: 'v1', authorizationRef: 'grant:bound-a' } })).resolves.toEqual({ status: 409, body: { code: 'RETENTION_EXECUTION_DENIED' } });
  expect(calls).toBe(1);
});
