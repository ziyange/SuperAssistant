/* global Buffer, setTimeout, clearTimeout */
/* eslint-disable no-unused-vars -- parameter names document the boundary contract. */
import type { ChildProcess } from 'node:child_process';
export type CodexCheck = { state: 'CANCELLED' | 'UNAVAILABLE' } | {
  state: 'CHECKED';
  connection: 'CONNECTED' | 'AUTH_REQUIRED' | 'VERSION_UNSUPPORTED' | 'UNAVAILABLE';
  availability: 'AVAILABLE' | 'PAUSED' | 'UNAVAILABLE';
  version: string;
  observedAt: string;
};

export function createCodexDiscoveryCheck(
  choose: () => Promise<string | null>,
  probe: (path: string) => Promise<unknown>,
  persist?: (path: string, observation: Observation) => Promise<void>
): () => Promise<CodexCheck> {
  let pending: Promise<CodexCheck> | undefined;
  async function run(): Promise<CodexCheck> {
    try {
      const selected = await choose();
      if (selected === null) return { state: 'CANCELLED' };
      const result = await probe(selected);
      if (!result || typeof result !== 'object') return { state: 'UNAVAILABLE' };
      const value = result as Record<string, unknown>;
      if (value.state !== 'CHECKED'
        || typeof value.connection !== 'string' || !['CONNECTED', 'AUTH_REQUIRED', 'VERSION_UNSUPPORTED', 'UNAVAILABLE'].includes(value.connection)
        || typeof value.availability !== 'string' || !['AVAILABLE', 'PAUSED', 'UNAVAILABLE'].includes(value.availability)
        || typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version)
        || typeof value.observedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.observedAt)
        || !Number.isFinite(Date.parse(value.observedAt)) || new Date(value.observedAt).toISOString() !== value.observedAt
        || (value.connection !== 'CONNECTED' && value.availability === 'AVAILABLE'))
        return { state: 'UNAVAILABLE' };
      const observation: Observation = { state: 'CHECKED', connection: value.connection as Observation['connection'], availability: value.availability as Observation['availability'], version: value.version, observedAt: value.observedAt };
      if (persist) await persist(selected, observation);
      return observation;
    } catch { return { state: 'UNAVAILABLE' }; }
  }
  return () => {
    if (!pending) {
      const current = run();
      pending = current;
      void current.finally(() => { if (pending === current) pending = undefined; });
    }
    return pending;
  };
}

type Observation = Extract<CodexCheck, { state: 'CHECKED' }>;

/** Probe only a selected executable; never resolve with an unconfirmed timed-out child. */
export function createVersionProbe(
  launch: (path: string) => ChildProcess,
  terminate: (child: ChildProcess) => Promise<void>,
  timeoutMs = 5000
): (path: string) => Promise<string> {
  return (path) => new Promise((resolve, reject) => {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) { reject(new Error('Invalid timeout.')); return; }
    let child: ChildProcess;
    try { child = launch(path); } catch { reject(new Error('Version probe unavailable.')); return; }
    if (!child.stdout) { reject(new Error('Version probe unavailable.')); return; }
    const stdout = child.stdout;
    let output = '';
    let done = false;
    let aborting = false;
    let closed = false;
    let terminated = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (value?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.off('close', onClose); child.off('error', onError);
      stdout.off('data', onData); stdout.off('error', onError);
      if (value) resolve(value); else reject(new Error('Version probe unavailable.'));
    };
    const onClose = (code: number | null) => {
      closed = true;
      if (aborting) { if (terminated) finish(); return; }
      const match = code === 0 ? /^codex-cli (\d+\.\d+\.\d+)\s*$/.exec(output) : null;
      finish(match?.[1]);
    };
    const abort = () => {
      if (aborting || done) return;
      aborting = true;
      clearTimeout(timer);
      timer = setTimeout(() => finish(), 10000);
      void Promise.resolve().then(() => terminate(child)).then(() => {
        terminated = true;
        if (closed) finish();
      }, () => finish());
    };
    const onError = () => {
      if (typeof child.pid !== 'number') finish();
      else abort();
    };
    const onData = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (Buffer.byteLength(output, 'utf8') > 4096) abort();
    };
    child.once('close', onClose); child.once('error', onError);
    stdout.on('data', onData); stdout.once('error', onError);
    timer = setTimeout(abort, timeoutMs);
  });
}
type DiscoverySupervisor = {
  initialize(): Promise<{
    health(): Promise<{ connection: string; availability: string; observedAt: string }>;
    describe(): Promise<{ adapterVersion: string }>;
  }>;
  shutdown(): Promise<void>;
};

export function createCodexProbe(
  inspectVersion: (path: string) => Promise<string>,
  supervise: (path: string, version: string) => DiscoverySupervisor
): (path: string) => Promise<Observation> {
  return async (path) => {
    const version = await inspectVersion(path);
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid Codex version.');
    const supervisor = supervise(path, version);
    try {
      const adapter = await supervisor.initialize();
      const health = await adapter.health();
      const description = await adapter.describe();
      if (description.adapterVersion !== version) throw new Error('Codex version changed.');
      if (!['CONNECTED', 'AUTH_REQUIRED', 'VERSION_UNSUPPORTED', 'UNAVAILABLE'].includes(health.connection)
        || !['AVAILABLE', 'PAUSED', 'UNAVAILABLE'].includes(health.availability)) throw new Error('Invalid health state.');
      return { state: 'CHECKED', connection: health.connection as Observation['connection'], availability: health.availability as Observation['availability'], version, observedAt: health.observedAt };
    } finally {
      await supervisor.shutdown();
    }
  };
}
