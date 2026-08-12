/* eslint-disable no-unused-vars -- constructor parameter properties are used at runtime. */
import type { ChildProcess } from 'node:child_process';
import { CodexDiscoveryAdapter, type UpstreamDiscovery } from './discovery.js';

export class CodexWorker {
  private child: ChildProcess | null = null;
  constructor(private readonly spawnReadOnly: () => ChildProcess, private readonly discovery: () => Promise<UpstreamDiscovery>) {}
  async initialize(): Promise<CodexDiscoveryAdapter> { this.child = this.spawnReadOnly(); return new CodexDiscoveryAdapter(this.discovery); }
  shutdown(): void { this.child?.kill(); this.child = null; }
}
