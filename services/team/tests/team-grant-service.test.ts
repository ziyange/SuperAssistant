import { expect, test } from 'vitest';
import { TeamGrantService } from '../src/team-grant-service.js';
import { PersistentTeamGrantService } from '../src/team-grant-service.js';

test('binds a Grant to its immutable proposal and consumes it once', () => {
  const grants = new TeamGrantService(() => 'grant:sha256:one');
  const grant = grants.issue({ workspaceId: 'workspace-a', requester: 'requester', proposalDigest: 'sha256:aaaaaaaa', approvers: ['a', 'b'] });

  expect(grants.consume(grant.ref, { workspaceId: 'workspace-a', requester: 'requester', proposalDigest: 'sha256:aaaaaaaa' })).toEqual({ consumed: true });
  expect(grants.consume(grant.ref, { workspaceId: 'workspace-a', requester: 'requester', proposalDigest: 'sha256:aaaaaaaa' })).toEqual({ consumed: false, reason: 'GRANT_ALREADY_CONSUMED' });
  expect(grants.consume(grant.ref, { workspaceId: 'workspace-a', requester: 'requester', proposalDigest: 'sha256:bbbbbbbb' })).toEqual({ consumed: false, reason: 'GRANT_ALREADY_CONSUMED' });
});

test('consumes a durable Grant through one compare-and-set store transition', async () => {
  let consumed = false;
  const grants = new PersistentTeamGrantService({
    async issueGrant(input) { return { ...input, ref: 'grant:sha256:durable' as const }; },
    async consumeGrant(ref, binding) {
      if (ref !== 'grant:sha256:durable' || binding.proposalDigest !== 'sha256:aaaaaaaa') return { consumed: false as const, reason: 'GRANT_BINDING_DENIED' as const };
      if (consumed) return { consumed: false as const, reason: 'GRANT_ALREADY_CONSUMED' as const };
      consumed = true;
      return { consumed: true as const };
    }
  });
  const grant = await grants.issue({ workspaceId: 'workspace-a', requester: 'requester', proposalDigest: 'sha256:aaaaaaaa', approvers: ['a', 'b'] });
  await expect(grants.consume(grant.ref, { workspaceId: 'workspace-a', requester: 'requester', proposalDigest: 'sha256:aaaaaaaa' })).resolves.toEqual({ consumed: true });
  await expect(grants.consume(grant.ref, { workspaceId: 'workspace-a', requester: 'requester', proposalDigest: 'sha256:aaaaaaaa' })).resolves.toEqual({ consumed: false, reason: 'GRANT_ALREADY_CONSUMED' });
});
