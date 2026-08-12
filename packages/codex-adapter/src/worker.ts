/* eslint-disable no-unused-vars -- constructor parameter properties are used at runtime. */
/* global NodeJS, process, setTimeout, clearTimeout */
import type { ChildProcess } from 'node:child_process';
import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { CodexDiscoveryAdapter, type UpstreamDiscovery } from './discovery.js';
import { readStdioDiscovery } from './stdio-transport.js';

const DISCOVERY_TIMEOUT_MS = 5_000;
type SpawnReadOnly = () => ChildProcess;
type SpawnProcess = (command: string, args: readonly string[], options: SpawnOptionsWithoutStdio) => ChildProcess;
type ProcessTreeTerminator = (pid: number) => Promise<void>;

export function createReadOnlyCodexLaunch(executablePath: string, projectPath: string, launch: SpawnProcess = spawn, environment: NodeJS.ProcessEnv = process.env): SpawnReadOnly {
  if (!isAbsolute(executablePath) || !isAbsolute(projectPath)) throw new Error('Codex executable and Project paths must be absolute.');
  const env = Object.fromEntries(['SystemRoot', 'TEMP'].flatMap((key) => environment[key] ? [[key, environment[key] as string]] : []));
  return () => launch(executablePath, ['app-server'], { cwd: projectPath, env, shell: false, windowsHide: true });
}

export function terminateProcessTree(pid: number): Promise<void> {
  if (process.platform !== 'win32') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { shell: false, windowsHide: true, stdio: 'ignore' });
    killer.once('error', reject);
    killer.once('close', (code) => {
      if (code === 0 || isProcessGone(pid)) resolve();
      else reject(new Error(`taskkill failed with exit code ${String(code)}.`));
    });
  });
}

function isProcessGone(pid: number): boolean {
  try { process.kill(pid, 0); return false; } catch { return true; }
}

export function createStdioCodexWorker(spawnReadOnly: SpawnReadOnly, discoveryTimeoutMs = DISCOVERY_TIMEOUT_MS): CodexWorker {
  let child: ChildProcess | null = null;
  return new CodexWorker(() => {
    child = spawnReadOnly();
    return child;
  }, async () => {
    if (!child) throw new Error('Codex App Server child was not started.');
    return readStdioDiscovery(child, discoveryTimeoutMs);
  }, discoveryTimeoutMs);
}

export class CodexWorker {
  private child: ChildProcess | null = null;
  constructor(private readonly spawnReadOnly: SpawnReadOnly, private readonly discovery: () => Promise<UpstreamDiscovery>, private readonly discoveryTimeoutMs = DISCOVERY_TIMEOUT_MS, private readonly terminateTree: ProcessTreeTerminator = terminateProcessTree) {}
  async initialize(): Promise<CodexDiscoveryAdapter> {
    this.child = this.spawnReadOnly();
    try {
      const initializedDiscovery = await withTimeout(this.discovery(), this.discoveryTimeoutMs);
      return new CodexDiscoveryAdapter(async () => initializedDiscovery);
    } catch (error) {
      await this.shutdown();
      throw error;
    }
  }
  async shutdown(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child) return;
    if (typeof child.pid === 'number' && child.pid > 0) await this.terminateTree(child.pid);
    else child.kill();
  }
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('Codex discovery timed out.')), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
