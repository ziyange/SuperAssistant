import { expect, test } from 'vitest';
import { RetentionOperationService } from '../src/retention-operation-service.js';

test('legal hold wins over expiry and a destructive execution requires a matching authorization', async () => {
  const service = new RetentionOperationService({
    async inspect(recordId) { return { recordId, workspaceId: 'workspace-a', expiresAt: 10, legalHold: recordId === 'held', stateKnown: true }; },
    async recordDryRun() {},
    async executeAuthorizedDelete() { return { deleted: true as const }; }
  });

  await expect(service.dryRun({ actor: 'auditor-a', workspaceId: 'workspace-a', recordId: 'held', policyVersion: 'v1', now: 20 })).resolves.toEqual({ action: 'PRESERVE', reason: 'LEGAL_HOLD' });
  await service.dryRun({ actor: 'auditor-a', workspaceId: 'workspace-a', recordId: 'expired', policyVersion: 'v1', now: 20 });
  await expect(service.execute({ actor: 'operator-a', workspaceId: 'workspace-a', recordId: 'expired', policyVersion: 'v1', authorizationRef: 'grant:retention-a', now: 20 })).resolves.toEqual({ deleted: true });
});
