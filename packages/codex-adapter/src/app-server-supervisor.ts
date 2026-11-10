/* global process, setTimeout, clearTimeout */
/* eslint-disable no-unused-vars -- callback parameter names describe the public supervisor contract. */
import type { ChildProcess } from 'node:child_process';
import { ReadOnlyAppServerClient } from './app-server-client.js';
import { CodexDiscoveryAdapter } from './discovery.js';
import { terminateProcessTree } from './worker.js';

type TerminateChild = (child: ChildProcess) => Promise<void>;

async function terminateOwnedChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onClose: (() => void) | undefined;
  const closed = new Promise<void>((resolve, reject) => {
    onClose = () => resolve();
    child.once('close', onClose);
    timer = setTimeout(() => reject(new Error('Codex discovery process termination was not confirmed.')), 5000);
  });
  try {
    const termination = process.platform === 'win32' && typeof child.pid === 'number'
      ? terminateProcessTree(child.pid)
      : Promise.resolve(child.kill());
    await Promise.all([closed, termination]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onClose) child.off('close', onClose);
  }
}

/** Owns one read-only discovery process; it never grants execution capability. */
export function createAppServerDiscoverySupervisor(
  spawnReadOnly: () => ChildProcess,
  observedVersion: string,
  timeoutMs = 5000,
  terminate: TerminateChild = terminateOwnedChild
) {
  let child: ChildProcess | undefined;
  let client: ReadOnlyAppServerClient | undefined;
  let started = false;
  let stopped = false;
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    stopped = true;
    client?.dispose();
    if (!shutdownPromise) shutdownPromise = child ? terminate(child) : Promise.resolve();
    return shutdownPromise;
  };
  return {
    async initialize(): Promise<CodexDiscoveryAdapter> {
      if (started || stopped) throw new Error('Codex discovery supervisor cannot be initialized again.');
      started = true;
      child = spawnReadOnly();
      const owned = child;
      owned.once('exit', () => { stopped = true; });
      try {
        client = new ReadOnlyAppServerClient(owned, timeoutMs);
        const snapshot = await client.discover(observedVersion);
        if (stopped || owned.exitCode !== null || owned.signalCode !== null) throw new Error('Codex discovery process is unavailable.');
        return new CodexDiscoveryAdapter(async () => {
          if (stopped || !client?.isReady() || owned.exitCode !== null || owned.signalCode !== null) throw new Error('Codex discovery process is unavailable.');
          return snapshot;
        });
      } catch (error) {
        await shutdown();
        throw error;
      }
    },
    async observe(threadId: string): Promise<'ACTIVE' | 'IDLE' | 'INDETERMINATE'> {
      if (!client || stopped) throw new Error('Codex discovery process is unavailable.');
      try {
        const status = await client.threadStatus(threadId);
        if (stopped) throw new Error('Codex discovery process is unavailable.');
        return status;
      } catch {
        await shutdown();
        throw new Error('Codex discovery process is unavailable.');
      }
    },
    shutdown
  };
}
