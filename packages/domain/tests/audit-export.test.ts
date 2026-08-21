import { expect, test } from 'vitest';
import { createAuditExport } from '../src/audit-export.js';

test('creates a scoped checksum manifest while redacting credential values', () => {
  const audit = createAuditExport({
    scope: { workspaceId: 'workspace-1', projectId: 'project-1' },
    generatedAt: '2026-08-21T00:00:00.000Z',
    records: [{ kind: 'TASK', taskId: 'task-1', authorizationRef: 'grant-1', credential: 'never-export', nested: { token: 'also-never-export', state: 'QUEUED' } }]
  });

  expect(audit.manifest).toEqual({
    scope: { workspaceId: 'workspace-1', projectId: 'project-1' },
    generatedAt: '2026-08-21T00:00:00.000Z',
    recordCount: 1,
    checksum: 'sha256:2b906272abd93050574c11ed0b638ded28eb8c0ec3b79a130f31cf3c710b733f'
  });
  expect(audit.records).toEqual([{ kind: 'TASK', taskId: 'task-1', authorizationRef: 'grant-1', nested: { state: 'QUEUED' } }]);
});
