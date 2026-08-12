/* eslint-disable no-unused-vars -- constructor parameter properties are used at runtime. */
/* global NodeJS, process, setTimeout, clearTimeout */
import type { ChildProcess } from 'node:child_process';
import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { CodexDiscoveryAdapter, type UpstreamDiscovery } from './discovery.js';

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
    killer.once('close', (code) => code === 0 ? resolve() : reject(new Error(`taskkill failed with exit code ${String(code)}.`)));
  });
}

export class CodexWorker {
  private child: ChildProcess | null = null;
  constructor(private readonly spawnReadOnly: SpawnReadOnly, private readonly discovery: () => Promise<UpstreamDiscovery>, private readonly discoveryTimeoutMs = DISCOVERY_TIMEOUT_MS, private readonly terminateTree: ProcessTreeTerminator = terminateProcessTree) {}
  async initialize(): Promise<CodexDiscoveryAdapter> {
    this.child = this.spawnReadOnly();
    try {
      await withTimeout(this.discovery(), this.discoveryTimeoutMs);
      return new CodexDiscoveryAdapter(this.discovery);
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
