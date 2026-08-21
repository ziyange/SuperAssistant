/* eslint-disable no-unused-vars -- parameter names are part of this public port contract. */
import type { AuditExport, AuditExportScope } from '@super-assistant/domain';
import type { AuditExportRendererProjection } from '../shared/ipc-contract.js';

export interface AuditExportPort { export(scope: AuditExportScope, generatedAt: string): AuditExport; }

export function projectAuditExportForRenderer(port: AuditExportPort, input: AuditExportScope & Readonly<{ generatedAt: string }>): AuditExportRendererProjection {
  const audit = port.export({ workspaceId: input.workspaceId, projectId: input.projectId }, input.generatedAt);
  return { manifest: { generatedAt: audit.manifest.generatedAt, recordCount: audit.manifest.recordCount, checksum: audit.manifest.checksum }, records: audit.records };
}
