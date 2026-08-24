import { expect, test } from 'vitest';
import { createAuditManifest, verifyAuditManifest } from '../src/audit-manifest.js';

test('creates a scoped immutable manifest and detects changed governed evidence', () => {
  const manifest = createAuditManifest({ workspaceId: 'workspace-1', actor: 'auditor-1', from: 10, to: 20, records: [{ id: 'a', payload: '{"event":"created"}' }, { id: 'b', payload: '{"event":"approved"}' }] });
  expect(Object.isFrozen(manifest)).toBe(true);
  expect(verifyAuditManifest(manifest, [{ id: 'a', payload: '{"event":"created"}' }, { id: 'b', payload: '{"event":"approved"}' }])).toBe(true);
  expect(verifyAuditManifest(manifest, [{ id: 'a', payload: '{"event":"created"}' }, { id: 'b', payload: '{"event":"tampered"}' }])).toBe(false);
});

test('rejects secret-like records from an export', () => {
  expect(() => createAuditManifest({ workspaceId: 'workspace-1', actor: 'auditor-1', from: 10, to: 20, records: [{ id: 'a', payload: '{"token":"value"}' }] })).toThrow('AUDIT_SECRET_REDACTION_REQUIRED');
});
