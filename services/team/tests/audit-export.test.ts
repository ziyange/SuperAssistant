import { expect, test } from 'vitest';
import { TeamAuditExporter } from '../src/audit-export.js';

test('requires exact scope and verifies a complete immutable export', () => {
  const exporter = new TeamAuditExporter();
  const exported = exporter.export({ workspaceId: 'workspace-1', actor: 'auditor-1', from: 10, to: 20, records: [{ id: 'a', payload: '{"event":"created"}' }] });
  expect(exporter.verify(exported)).toBe(true);
  expect(exporter.verify({ ...exported, records: [{ id: 'a', payload: '{"event":"changed"}' }] })).toBe(false);
  expect(() => exporter.export({ workspaceId: '', actor: 'auditor-1', from: 10, to: 20, records: [] })).toThrow('AUDIT_SCOPE_INVALID');
});
