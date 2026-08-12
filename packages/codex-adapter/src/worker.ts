/* eslint-disable no-unused-vars -- constructor parameter properties are used at runtime. */
/* global NodeJS, process, setTimeout, clearTimeout */
import type { ChildProcess } from 'node:child_process';
import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { CodexDiscoveryAdapter, type UpstreamDiscovery } from './discovery.js';

const DISCOVERY_TIMEOUT_MS = 5_000;
type SpawnReadOnly = () => ChildProcess;
type SpawnProcess = (command: string, args: readonly string[], options: SpawnOptionsWithoutStdio) => ChildProcess;

export function createReadOnlyCodexLaunch(executablePath: string, projectPath: string, launch: SpawnProcess = spawn, environment: NodeJS.ProcessEnv = process.env): SpawnReadOnly {
  if (!isAbsolute(executablePath) || !isAbsolute(projectPath)) throw new Error('Codex executable and Project paths must be absolute.');
  const env = Object.fromEntries(['SystemRoot', 'TEMP'].flatMap((key) => environment[key] ? [[key, environment[key] as string]] : []));
  return () => launch(executablePath, ['app-server'], { cwd: projectPath, env, shell: false, windowsHide: true });
}

export class CodexWorker {
  private child: ChildProcess | null = null;
  constructor(private readonly spawnReadOnly: SpawnReadOnly, private readonly discovery: () => Promise<UpstreamDiscovery>, private readonly discoveryTimeoutMs = DISCOVERY_TIMEOUT_MS) {}
  async initialize(): Promise<CodexDiscoveryAdapter> {
    this.child = this.spawnReadOnly();
    try {
      await withTimeout(this.discovery(), this.discoveryTimeoutMs);
      return new CodexDiscoveryAdapter(this.discovery);
    } catch (error) {
      this.shutdown();
      throw error;
    }
  }
  shutdown(): void { this.child?.kill(); this.child = null; }
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('Codex discovery timed out.')), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
