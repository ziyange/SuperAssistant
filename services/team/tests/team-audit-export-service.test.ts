import { expect, test } from 'vitest';
import { TeamAuditExportService } from '../src/team-audit-export-service.js';

test('creates a scoped append-only export and detects manifest tampering', async () => {
  const records = [{ id: 'audit-1', class: 'AUDIT' as const, payload: '{"event":"created"}' }];
  const service = new TeamAuditExportService({ async listGovernedRecords(workspaceId) { return workspaceId === 'workspace-a' ? records : []; } });
  const exported = await service.export({ actor: 'auditor-a', workspaceId: 'workspace-a', from: 0, to: 100 });

  expect(service.verify(exported)).toBe(true);
  expect(service.verify({ ...exported, manifest: { ...exported.manifest, recordCount: 2 } })).toBe(false);
});
