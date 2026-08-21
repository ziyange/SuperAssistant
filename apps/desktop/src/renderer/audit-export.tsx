import type { AuditExportRendererProjection } from '../shared/ipc-contract.js';

export function AuditExport({ audit }: Readonly<{ audit?: AuditExportRendererProjection }>) {
  if (!audit) return <section aria-label="Audit export"><p>No local audit export has been generated.</p></section>;
  return <section aria-label="Audit export"><p>Exported {audit.manifest.recordCount} governed records.</p><code>{audit.manifest.checksum}</code></section>;
}
