/* global Buffer */
import type { UpstreamDiscovery } from './discovery.js';
const MAX_FRAME_BYTES = 1_048_576;
export function parseDiscoveryFrame(frame: string): UpstreamDiscovery {
  if (Buffer.byteLength(frame, 'utf8') > MAX_FRAME_BYTES) throw new Error('Discovery frame is oversized.');
  let value: unknown; try { value = JSON.parse(frame); } catch { throw new Error('Discovery frame is malformed.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Discovery frame is unsupported.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['version', 'authenticated', 'capabilities'].includes(key)) || typeof record.version !== 'string' || typeof record.authenticated !== 'boolean' || !Array.isArray(record.capabilities) || record.capabilities.some((item) => typeof item !== 'string')) throw new Error('Discovery frame is unsupported.');
  return { version: record.version, authenticated: record.authenticated, capabilities: record.capabilities as string[] };
}
