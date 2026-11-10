/* global Buffer, performance, setTimeout, clearTimeout */
/* eslint-disable no-unused-vars -- pending callback parameter names document the transport contract. */
import type { ChildProcess } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import type { UpstreamDiscovery } from './discovery.js';

const MAX_FRAME_BYTES = 1_048_576;
const MAX_PENDING = 32;
const CLIENT_INFO = Object.freeze({ name: 'super_assistant', version: '0.1.0' });
type Pending = { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> };
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function failure(): Error { return new Error('Codex discovery failed.'); }

/** Observation-only transport; it must not be used for an active execution stream. */
export class ReadOnlyAppServerClient {
  private readonly stdin: NonNullable<ChildProcess['stdin']>;
  private readonly stdout: NonNullable<ChildProcess['stdout']>;
  private readonly decoder = new StringDecoder('utf8');
  private readonly pending = new Map<number, Pending>();
  private buffer = '';
  private nextId = 1;
  private state: 'NEW' | 'INITIALIZING' | 'READY' | 'CLOSED' = 'NEW';

  constructor(private readonly child: ChildProcess, private readonly timeoutMs = 5000) {
    if (!child.stdin || !child.stdout || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Codex discovery input is invalid.');
    this.stdin = child.stdin; this.stdout = child.stdout;
    this.stdout.on('data', this.onData); this.stdout.once('end', this.onFailure); this.stdout.once('close', this.onFailure); this.stdout.once('error', this.onFailure);
    this.stdin.once('close', this.onFailure); this.stdin.once('error', this.onFailure); child.once('exit', this.onFailure); child.once('error', this.onFailure);
  }

  private isState(expected: 'NEW' | 'INITIALIZING' | 'READY' | 'CLOSED'): boolean { return this.state === expected; }
  isReady(): boolean { return this.state === 'READY'; }
  private readonly onFailure = (): void => { this.dispose(); };
  private readonly onData = (chunk: Buffer | string): void => {
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.write(chunk);
    if (Buffer.byteLength(this.buffer, 'utf8') > MAX_FRAME_BYTES) { this.dispose(); return; }
    for (;;) {
      const end = this.buffer.indexOf('\n');
      if (end < 0 || this.state === 'CLOSED') return;
      const line = this.buffer.slice(0, end).replace(/\r$/, '');
      this.buffer = this.buffer.slice(end + 1);
      let value: unknown;
      try { value = JSON.parse(line); } catch { this.dispose(); return; }
      if (!record(value)) { this.dispose(); return; }
      if (!('id' in value) && typeof value.method === 'string') continue;
      if ('method' in value || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || 'error' in value || !record(value.result)) { this.dispose(); return; }
      const pending = this.pending.get(value.id);
      if (!pending) { this.dispose(); return; }
      this.pending.delete(value.id); clearTimeout(pending.timer); pending.resolve(value.result);
    }
  };

  private write(value: Record<string, unknown>): boolean {
    if (this.state === 'CLOSED') return false;
    try { this.stdin.write(JSON.stringify(value) + '\n'); return true; } catch { this.dispose(); return false; }
  }

  private request(method: 'initialize' | 'account/read' | 'thread/read', params: Record<string, unknown>, timeoutMs: number): Promise<Record<string, unknown>> {
    const validMethod = method === 'initialize' || method === 'account/read' || method === 'thread/read';
    if (!validMethod || !record(params) || this.state === 'CLOSED' || this.pending.size >= MAX_PENDING || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > this.timeoutMs) return Promise.reject(failure());
    if (method === 'initialize' && (this.state !== 'INITIALIZING' || Object.keys(params).length !== 1 || params.clientInfo !== CLIENT_INFO)) return Promise.reject(failure());
    if (method === 'account/read' && (this.state !== 'INITIALIZING' || Object.keys(params).length !== 1 || params.refreshToken !== false)) return Promise.reject(failure());
    if (method === 'thread/read' && (this.state !== 'READY' || Object.keys(params).length !== 1 || typeof params.threadId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(params.threadId))) return Promise.reject(failure());
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.dispose(), timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ id, method, params });
    });
  }

  async discover(version: string): Promise<UpstreamDiscovery> {
    if (this.state !== 'NEW' || !/^\d+\.\d+\.\d+$/.test(version)) { this.dispose(); throw new Error('Codex discovery input is invalid.'); }
    this.state = 'INITIALIZING';
    const deadline = performance.now() + this.timeoutMs;
    const remaining = () => Math.max(0, deadline - performance.now());
    try {
      const initialized = await this.request('initialize', { clientInfo: CLIENT_INFO }, remaining());
      if (!this.isState('INITIALIZING') || typeof initialized.userAgent !== 'string' || initialized.userAgent.length === 0 || !this.write({ method: 'initialized', params: {} })) throw failure();
      const result = await this.request('account/read', { refreshToken: false }, remaining());
      if (!this.isState('INITIALIZING') || typeof result.requiresOpenaiAuth !== 'boolean') throw failure();
      const account = result.account;
      if (account !== undefined && account !== null && (!record(account) || typeof account.type !== 'string')) throw failure();
      this.state = 'READY';
      return { version, authenticated: account !== undefined && account !== null, capabilities: [] };
    } catch { this.dispose(); throw failure(); }
  }

  async threadStatus(threadId: string): Promise<'ACTIVE' | 'IDLE' | 'INDETERMINATE'> {
    if (this.state !== 'READY' || !/^[a-z0-9_-]{1,128}$/i.test(threadId)) throw failure();
    try {
      const result = await this.request('thread/read', { threadId }, this.timeoutMs);
      const thread = result.thread;
      if (!this.isState('READY') || !record(thread) || thread.id !== threadId || !record(thread.status) || typeof thread.status.type !== 'string') throw failure();
      if (thread.status.type === 'active') return 'ACTIVE';
      if (thread.status.type === 'idle') return 'IDLE';
      return 'INDETERMINATE';
    } catch { this.dispose(); throw failure(); }
  }

  dispose(): void {
    if (this.state === 'CLOSED') return;
    this.state = 'CLOSED';
    this.stdout.off('data', this.onData); this.stdout.off('end', this.onFailure); this.stdout.off('close', this.onFailure); this.stdout.off('error', this.onFailure);
    this.stdin.off('close', this.onFailure); this.stdin.off('error', this.onFailure); this.child.off('exit', this.onFailure); this.child.off('error', this.onFailure);
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(failure()); }
    this.pending.clear(); this.buffer = '';
  }
}
