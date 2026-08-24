import { expect, test } from 'vitest';
import { CredentialReferenceService } from '../src/credential-reference-service.js';
import { PersistentCredentialReferenceService } from '../src/credential-reference-service.js';

test('exposes only an opaque credential reference to its owner in the same workspace', () => {
  const credentials = new CredentialReferenceService();
  credentials.register({ ref: 'cred:service-a', owner: 'actor-a', workspaceId: 'workspace-a', rotationDueAt: 200 });

  expect(credentials.resolve('cred:service-a', { actor: 'actor-a', workspaceId: 'workspace-a' })).toEqual({ ref: 'cred:service-a', rotationDueAt: 200 });
  expect(credentials.resolve('cred:service-a', { actor: 'actor-b', workspaceId: 'workspace-a' })).toBeUndefined();
  expect(credentials.resolve('cred:service-a', { actor: 'actor-a', workspaceId: 'workspace-b' })).toBeUndefined();
});

test('resolves opaque credential metadata from an authoritative store after service restart', async () => {
  const records = new Map<string, { ref: `cred:${string}`; owner: string; workspaceId: string; rotationDueAt: number }>();
  const store = {
    async registerCredential(record: { ref: `cred:${string}`; owner: string; workspaceId: string; rotationDueAt: number }) { records.set(record.ref, record); },
    async findCredential(ref: string) { return records.get(ref); }
  };
  const first = new PersistentCredentialReferenceService(store);
  await first.register({ ref: 'cred:service-a', owner: 'actor-a', workspaceId: 'workspace-a', rotationDueAt: 200 });

  await expect(new PersistentCredentialReferenceService(store).resolve('cred:service-a', { actor: 'actor-a', workspaceId: 'workspace-a' })).resolves.toEqual({ ref: 'cred:service-a', rotationDueAt: 200 });
});
