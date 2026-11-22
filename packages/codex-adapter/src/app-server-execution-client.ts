/* global Buffer, setTimeout, clearTimeout */
/* eslint-disable no-unused-vars -- callback names describe the private protocol port. */
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

type State = 'NEW' | 'INITIALIZING' | 'READY' | 'STARTING' | 'RUNNING' | 'INTERRUPTING' | 'UNKNOWN' | 'CLOSED';
type Pending = { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>; accept?: (value: Record<string, unknown>) => void };
type StartReceipt = Readonly<{ threadId: string; turnId: string; cwd: string; principalHash: string }>;
const LIMIT = 1_048_576;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9_-]{1,128}$/i.test(id);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = () => new Error('Codex execution outcome unavailable.');

function personalAccountHash(value: unknown): string | undefined {
  if (!record(value) || value.type !== 'chatgpt' || typeof value.email !== 'string' || value.email.length > 254
    || !/^[^\s@:]+@[^\s@:]+$/u.test(value.email) || /\p{C}/u.test(value.email)
    || typeof value.planType !== 'string' || !['free', 'go', 'plus', 'pro'].includes(value.planType)) return;
  return createHash('sha256').update('codex-personal-v1:' + value.email + ':' + value.planType).digest('hex');
}

function policy(cwd: string) {
  return { type: 'workspaceWrite', writableRoots: [cwd], readOnlyAccess: { type: 'restricted', includePlatformDefaults: true, readableRoots: [cwd] },
    networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true };
}

function exactPolicy(value: unknown, cwd: string): boolean {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'excludeSlashTmp,excludeTmpdirEnvVar,networkAccess,readOnlyAccess,type,writableRoots'
    || value.type !== 'workspaceWrite' || value.networkAccess !== false
    || value.excludeTmpdirEnvVar !== true || value.excludeSlashTmp !== true
    || !Array.isArray(value.writableRoots) || value.writableRoots.length !== 1 || value.writableRoots[0] !== cwd
    || !record(value.readOnlyAccess) || Object.keys(value.readOnlyAccess).join(',') !== 'type'
    || value.readOnlyAccess.type !== 'fullAccess') return false;
  return true;
}

/**
 * Private, one-shot transport. The caller must own the exact child and supply
 * independent confinement evidence covering the requested cwd and permissions.
 * A mocked verifier is test-only; this module provides no production verifier.
 * Its response is neither an applied-sandbox attestation nor termination proof.
 */
export class AppServerExecutionClient {
  #state: State = 'NEW';
  private readonly stdin: NonNullable<ChildProcess['stdin']>;
  private readonly stdout: NonNullable<ChildProcess['stdout']>;
  private readonly decoder = new StringDecoder('utf8');
  private readonly pending = new Map<number, Pending>();
  private buffer = '';
  private nextId = 1;
  private principalHash = '';
  private threadId = '';
  private turnId = '';
  private disposed = false;
  private notificationFailed = false;
  private readonly ignoreLateError = () => {};

  constructor(private readonly child: ChildProcess, private readonly version: string, private readonly expectedPrincipalHash: string,
    private readonly verifyConfinement: (child: ChildProcess, cwd: string) => Promise<boolean>,
    private readonly onUnknown: () => boolean, private readonly recordStart: (receipt: StartReceipt) => boolean, private readonly timeoutMs = 5000) {
    if (!child.stdin || !child.stdout || !/^[a-f0-9]{64}$/.test(expectedPrincipalHash)
      || typeof verifyConfinement !== 'function' || typeof onUnknown !== 'function' || typeof recordStart !== 'function'
      || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw failure();
    this.stdin = child.stdin;
    this.stdout = child.stdout;
    this.stdout.on('data', this.onData);
    this.stdout.once('end', this.onFailure);
    this.stdout.once('close', this.onFailure);
    this.stdout.once('error', this.onFailure);
    this.stdin.once('error', this.onFailure);
    this.stdin.once('close', this.onFailure);
    child.once('exit', this.onFailure);
    child.once('error', this.onFailure);
  }

  status(): State { return this.#state; }
  unknownNotificationFailed(): boolean { return this.notificationFailed; }
  private readonly onFailure = () => this.fail();
  private readonly onData = (chunk: Buffer | string) => {
    for (let offset = 0; offset < chunk.length; offset += 65_536) {
      const part = chunk.slice(offset, offset + 65_536);
      this.buffer += typeof part === 'string' ? part : this.decoder.write(part);
      this.drain();
      if (this.#state === 'CLOSED' || this.#state === 'UNKNOWN') return;
    }
  };

  private drain(): void {
    for (;;) {
      const end = this.buffer.indexOf('\n');
      if (this.#state === 'CLOSED' || this.#state === 'UNKNOWN') return;
      if (end < 0) {
        if (Buffer.byteLength(this.buffer, 'utf8') > LIMIT) this.fail();
        return;
      }
      const line = this.buffer.slice(0, end).replace(/\r$/, '');
      this.buffer = this.buffer.slice(end + 1);
      if (Buffer.byteLength(line, 'utf8') > LIMIT) { this.fail(); return; }
      let message: unknown;
      try { message = JSON.parse(line); } catch { this.fail(); return; }
      if (!record(message)) { this.fail(); return; }
      if (!('id' in message) && typeof message.method === 'string') {
        // Until a durable ordered event bridge exists, terminal signals cannot
        // be dropped and must trigger original-Attempt reconciliation.
        if (message.method === 'turn/completed' && ['STARTING', 'RUNNING', 'INTERRUPTING'].includes(this.#state)) {
          this.fail();
          return;
        }
        continue;
      }
      if ('method' in message || typeof message.id !== 'number' || !Number.isSafeInteger(message.id)
        || 'error' in message || !record(message.result)) { this.fail(); return; }
      const pending = this.pending.get(message.id);
      if (!pending) { this.fail(); return; }
      try { pending.accept?.(message.result); }
      catch { this.fail(); return; }
      if (this.status() === 'CLOSED' || this.status() === 'UNKNOWN') return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      pending.resolve(message.result);
    }
  }

  private fail(): void {
    if (this.#state === 'CLOSED' || this.#state === 'UNKNOWN') return;
    this.#state = ['STARTING', 'RUNNING', 'INTERRUPTING'].includes(this.#state) ? 'UNKNOWN' : 'CLOSED';
    if (this.#state === 'UNKNOWN') {
      // The owner must synchronously persist the original Attempt's unknown
      // state; failure remains visible and cannot turn into success.
      try { if (this.onUnknown() !== true) this.notificationFailed = true; }
      catch { this.notificationFailed = true; }
    }
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(failure()); }
    this.pending.clear();
    this.buffer = '';
  }

   #write(value: Record<string, unknown>): void {
    const line = JSON.stringify(value) + '\n';
    if (this.#state === 'CLOSED' || this.#state === 'UNKNOWN' || Buffer.byteLength(line, 'utf8') > LIMIT) throw failure();
    try { this.stdin.write(line); } catch { this.fail(); throw failure(); }
  }

   #request(method: string, params: Record<string, unknown>, accept?: (value: Record<string, unknown>) => void): Promise<Record<string, unknown>> {
    if (this.pending.size !== 0 || this.#state === 'CLOSED' || this.#state === 'UNKNOWN') return Promise.reject(failure());
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(), this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, ...(accept ? { accept } : {}) });
      try { this.#write({ id, method, params }); } catch { this.fail(); }
    });
  }

  private async account(): Promise<string> {
    const result = await this.#request('account/read', { refreshToken: false });
    const hash = result.requiresOpenaiAuth === true ? personalAccountHash(result.account) : undefined;
    if (!hash || this.#state === 'CLOSED' || this.#state === 'UNKNOWN') throw failure();
    return hash;
  }

  private async confinement(cwd: string): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.verifyConfinement(this.child, cwd),
        new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), this.timeoutMs); })
      ]) === true;
    } catch { return false; }
    finally { if (timer) clearTimeout(timer); }
  }

  async initialize(): Promise<void> {
    if (this.#state !== 'NEW' || this.version !== '0.121.0') { this.fail(); throw failure(); }
    this.#state = 'INITIALIZING';
    try {
      const response = await this.#request('initialize', { clientInfo: { name: 'super_assistant', version: '0.1.0' } });
      if (this.#state !== 'INITIALIZING' || typeof response.userAgent !== 'string' || response.userAgent.length === 0) throw failure();
      this.#write({ method: 'initialized', params: {} });
      this.principalHash = await this.account();
      if (this.#state !== 'INITIALIZING' || this.principalHash !== this.expectedPrincipalHash) throw failure();
      this.#state = 'READY';
    } catch { this.fail(); throw failure(); }
  }

  async start(cwd: string, objective: string): Promise<{ threadId: string; turnId: string; cwd: string; principalHash: string }> {
    if (this.#state !== 'READY' || typeof cwd !== 'string' || !isAbsolute(cwd) || Array.from(cwd).some(character => character.charCodeAt(0) < 32)
      || typeof objective !== 'string' || !objective.trim() || objective.length > 32768) throw failure();
    this.#state = 'STARTING';
    try {
      if (await this.confinement(cwd) !== true || this.#state !== 'STARTING') throw failure();
      if (await this.account() !== this.principalHash || this.#state !== 'STARTING') throw failure();
      const thread = await this.#request('thread/start', { cwd, approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write',
        experimentalRawEvents: false, persistExtendedHistory: true,
        config: { sandbox_workspace_write: { writable_roots: [cwd], network_access: false, exclude_tmpdir_env_var: true, exclude_slash_tmp: true } } });
      if (this.#state !== 'STARTING' || !record(thread.thread) || !validId(thread.thread.id)
        || thread.thread.cwd !== cwd || thread.thread.cliVersion !== this.version || !Array.isArray(thread.thread.turns) || thread.thread.turns.length !== 0
        || thread.cwd !== cwd || thread.approvalPolicy !== 'on-request' || thread.approvalsReviewer !== 'user' || !exactPolicy(thread.sandbox, cwd)) throw failure();
      this.threadId = thread.thread.id;
      if (await this.account() !== this.principalHash || this.#state !== 'STARTING') throw failure();
      if (await this.confinement(cwd) !== true || this.#state !== 'STARTING') throw failure();
      let receipt: StartReceipt | undefined;
      await this.#request('turn/start', { threadId: this.threadId, cwd, approvalPolicy: 'on-request', approvalsReviewer: 'user',
        sandboxPolicy: policy(cwd), input: [{ type: 'text', text: objective, text_elements: [] }] }, turn => {
        if (this.#state !== 'STARTING' || !record(turn.turn) || !validId(turn.turn.id) || turn.turn.status !== 'inProgress') throw failure();
        this.turnId = turn.turn.id;
        const observed = Object.freeze({ threadId: this.threadId, turnId: this.turnId, cwd, principalHash: this.principalHash });
        if (this.recordStart(observed) !== true || this.status() !== 'STARTING') throw failure();
        receipt = observed;
        this.#state = 'RUNNING';
      });
      if (this.status() !== 'RUNNING' || !receipt) throw failure();
      return receipt;
    } catch { this.fail(); throw failure(); }
  }

  async interrupt(): Promise<boolean> {
    if (this.#state !== 'RUNNING') return false;
    this.#state = 'INTERRUPTING';
    try {
      await this.#request('turn/interrupt', { threadId: this.threadId, turnId: this.turnId });
      return this.#state === 'INTERRUPTING';
    } catch { this.fail(); return false; }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fail();
    // The process is owned by the caller and may not have exited yet. Keep
    // late errors handled without treating them as termination evidence.
    this.child.on('error', this.ignoreLateError);
    this.stdin.on('error', this.ignoreLateError);
    this.stdout.on('error', this.ignoreLateError);
    this.stdout.off('data', this.onData);
    this.stdout.off('end', this.onFailure); this.stdout.off('close', this.onFailure); this.stdout.off('error', this.onFailure);
    this.stdin.off('error', this.onFailure); this.stdin.off('close', this.onFailure);
    this.child.off('exit', this.onFailure); this.child.off('error', this.onFailure);
  }
}
