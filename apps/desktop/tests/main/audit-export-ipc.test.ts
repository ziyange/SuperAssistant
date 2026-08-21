import { expect, test } from 'vitest';
import { projectAuditExportForRenderer } from '../../src/main/audit-export-ipc.js';

test('projects a redacted checksum manifest without persistence implementation details', () => {
  const response = projectAuditExportForRenderer({
    export: () => ({ manifest: { scope: { workspaceId: 'workspace-1', projectId: 'project-1' }, generatedAt: '2026-08-21T00:00:00.000Z', recordCount: 1, checksum: 'sha256:abc' }, records: [{ kind: 'ACTIVITY', taskId: 'task-1' }] })
  }, { workspaceId: 'workspace-1', projectId: 'project-1', generatedAt: '2026-08-21T00:00:00.000Z' });

  expect(response).toEqual({ manifest: { generatedAt: '2026-08-21T00:00:00.000Z', recordCount: 1, checksum: 'sha256:abc' }, records: [{ kind: 'ACTIVITY', taskId: 'task-1' }] });
});
