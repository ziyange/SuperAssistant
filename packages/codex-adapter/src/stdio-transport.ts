/* global Buffer, setTimeout, clearTimeout */
import type { ChildProcess } from 'node:child_process';
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

export function readStdioDiscovery(child: ChildProcess, timeoutMs: number): Promise<UpstreamDiscovery> {
  return new Promise((resolve, reject) => {
    if (!child.stdout) return reject(new Error('Codex App Server stdio is unavailable.'));
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => settle(() => { child.kill(); reject(new Error('Codex discovery timed out.')); }), timeoutMs);
    child.stdout.once('data', (chunk: Buffer) => settle(() => {
      try { resolve(parseDiscoveryFrame(chunk.toString('utf8').split(/\r?\n/, 1)[0])); } catch (error) { child.kill(); reject(error); }
    }));
    child.once('exit', () => settle(() => reject(new Error('Codex App Server exited before discovery.'))));
    child.once('error', () => settle(() => reject(new Error('Codex App Server discovery failed.'))));
  });
}
