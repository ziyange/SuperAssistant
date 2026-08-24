import { expect, test } from 'vitest';
import { CredentialScopeStore } from '../src/credential-scope.js';

test('returns opaque credential metadata only to its owning principal and Workspace', () => {
  const store = new CredentialScopeStore();
  store.register({ ref: 'cred:user-1', owner: 'user-1', workspaceId: 'workspace-1', rotationDueAt: 200 });
  expect(store.lookup('cred:user-1', 'user-1', 'workspace-1')).toEqual({ ref: 'cred:user-1', owner: 'user-1', workspaceId: 'workspace-1', rotationDueAt: 200 });
  expect(store.lookup('cred:user-1', 'user-2', 'workspace-1')).toBeUndefined();
  expect(store.lookup('cred:user-1', 'user-1', 'workspace-2')).toBeUndefined();
});

test('rejects values that resemble secret material', () => {
  const store = new CredentialScopeStore();
  expect(() => store.register({ ref: 'secret-value', owner: 'user-1', workspaceId: 'workspace-1', rotationDueAt: 200 } as unknown as { ref: `cred:${string}`; owner: string; workspaceId: string; rotationDueAt: number })).toThrow('CREDENTIAL_REFERENCE_INVALID');
});
