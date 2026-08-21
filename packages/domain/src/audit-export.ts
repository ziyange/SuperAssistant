import { createHash } from 'node:crypto';

export type AuditExportScope = Readonly<{ workspaceId: string; projectId: string }>;
export type AuditExportManifest = Readonly<{ scope: AuditExportScope; generatedAt: string; recordCount: number; checksum: string }>;
export type AuditExport = Readonly<{ manifest: AuditExportManifest; records: readonly Record<string, unknown>[] }>;

const secretKey = /^(credential|secret|token|password|authorization|authorizationheader|apikey)$/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !secretKey.test(key))
    .map(([key, item]) => [key, redact(item)]));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createAuditExport(input: Readonly<{ scope: AuditExportScope; generatedAt: string; records: readonly Record<string, unknown>[] }>): AuditExport {
  const records = input.records.map((record) => redact(record) as Record<string, unknown>);
  const payload = canonical({ scope: input.scope, generatedAt: input.generatedAt, records });
  const checksum = `sha256:${createHash('sha256').update(payload).digest('hex')}`;
  return { manifest: { scope: input.scope, generatedAt: input.generatedAt, recordCount: records.length, checksum }, records };
}
