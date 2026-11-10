import type { ChildProcess } from 'node:child_process';
import { ReadOnlyAppServerClient } from './app-server-client.js';
import type { UpstreamDiscovery } from './discovery.js';

/** Read-only handshake; process ownership and termination remain with the supervisor. */
export async function discoverAppServer(child: ChildProcess, version: string, timeoutMs = 5000): Promise<UpstreamDiscovery> {
  const client = new ReadOnlyAppServerClient(child, timeoutMs);
  try { return await client.discover(version); } finally { client.dispose(); }
}
