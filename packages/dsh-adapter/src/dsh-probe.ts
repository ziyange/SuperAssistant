import { createHash } from 'node:crypto';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export type DshCapabilityPolicy = 'BROKER_REQUIRED';
export type DshProbeOutcome = 'PASS' | 'BLOCKED';

export interface DshProbeConfig {
  repositoryPath: string;
  expectedCommit: string;
  expectedProtocolVersion: string;
  runtimeCommand: string;
  runtimeArgs: readonly string[];
  shutdownTimeoutMs?: number;
}

export interface DshProbeResult {
  outcome: DshProbeOutcome;
  runtime: { commit: string; protocolVersion: string; serverInfoVersion?: string; profileDigest: string };
  capabilities: Record<'shell' | 'filesystem' | 'network' | 'plugin', DshCapabilityPolicy>;
  mappings: Record<'describe' | 'health' | 'start' | 'resume' | 'cancel' | 'status' | 'events' | 'result', string>;
  shutdown: { reaped: boolean; steps: string[] };
  failures: string[];
}

interface FixtureObservation {
  malformedFrame: boolean;
  serverInfoVersion?: string;
  initializeReceived: boolean;
}

const brokeredCapabilities: DshProbeResult['capabilities'] = {
  shell: 'BROKER_REQUIRED', filesystem: 'BROKER_REQUIRED', network: 'BROKER_REQUIRED', plugin: 'BROKER_REQUIRED'
};

const mappings: DshProbeResult['mappings'] = {
  describe: 'public profile metadata', health: 'fixture process liveness and initialize observation',
  start: 'future process-per-Attempt launch only', resume: 'requires separately proven session replay',
  cancel: 'shutdown, EOF, terminate, and kill ladder', status: 'platform journal derived',
  events: 'future normalized session notifications', result: 'platform journal derived; no direct DSH prompt result'
};

function profileDigest(commit: string, protocolVersion: string, serverInfoVersion?: string): string {
  return `sha256:${createHash('sha256').update(JSON.stringify({ commit, protocolVersion, serverInfoVersion: serverInfoVersion ?? null })).digest('hex')}`;
}

async function readPackageVersion(path: string): Promise<string> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || typeof parsed.version !== 'string') {
    throw new Error('PACKAGE_VERSION_MISSING');
  }
  return parsed.version;
}

async function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null) return true;
  return new Promise((resolve) => {
    const onExit = () => { globalThis.clearTimeout(timer); resolve(true); };
    const timer = globalThis.setTimeout(() => { child.off('exit', onExit); resolve(false); }, timeoutMs);
    child.once('exit', onExit);
  });
}

async function reapFixture(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<{ reaped: boolean; steps: string[] }> {
  const steps = ['SHUTDOWN', 'EOF'];
  const stdin = child.stdin;
  if (stdin?.writable) {
    stdin.write('{"jsonrpc":"2.0","id":"shutdown","method":"shutdown"}\n');
    stdin.end();
  }
  if (await waitForExit(child, timeoutMs)) return { reaped: true, steps };
  steps.push('TERMINATE');
  child.kill('SIGTERM');
  if (await waitForExit(child, timeoutMs)) return { reaped: true, steps };
  steps.push('KILL');
  child.kill('SIGKILL');
  return { reaped: await waitForExit(child, timeoutMs), steps };
}

async function inspectFixture(config: DshProbeConfig): Promise<{ observation: FixtureObservation; shutdown: DshProbeResult['shutdown'] }> {
  const timeoutMs = config.shutdownTimeoutMs ?? 250;
  const child = spawn(config.runtimeCommand, [...config.runtimeArgs], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const observation: FixtureObservation = { malformedFrame: false, initializeReceived: false };
  let buffer = '';
  let resolveInitialize: (() => void) | undefined;
  const initialized = new Promise<void>((resolve) => { resolveInitialize = resolve; });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    for (;;) {
      const end = buffer.indexOf('\n');
      if (end < 0) break;
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      try {
        const parsed: unknown = JSON.parse(line);
        if (typeof parsed !== 'object' || parsed === null || !('result' in parsed) || typeof parsed.result !== 'object' || parsed.result === null) {
          observation.malformedFrame = true;
          resolveInitialize?.();
          continue;
        }
        const result = parsed.result;
        if ('serverInfo' in result && typeof result.serverInfo === 'object' && result.serverInfo !== null && 'version' in result.serverInfo && typeof result.serverInfo.version === 'string') {
          observation.serverInfoVersion = result.serverInfo.version;
          observation.initializeReceived = true;
          resolveInitialize?.();
        }
      } catch {
        observation.malformedFrame = true;
        resolveInitialize?.();
      }
    }
  });
  child.stdin.write('{"jsonrpc":"2.0","id":"initialize","method":"initialize"}\n');
  await Promise.race([initialized, new Promise<void>((resolve) => globalThis.setTimeout(resolve, timeoutMs))]);
  return { observation, shutdown: await reapFixture(child, timeoutMs) };
}

export async function probeDsh(config: DshProbeConfig): Promise<DshProbeResult> {
  const failures: string[] = [];
  let commit = 'UNAVAILABLE';
  let protocolVersion = 'UNAVAILABLE';
  let serverInfoVersion: string | undefined;
  let shutdown: DshProbeResult['shutdown'] = { reaped: true, steps: [] };
  try {
    const git = await execFile('git', ['-C', config.repositoryPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    commit = git.stdout.trim();
    protocolVersion = await readPackageVersion(`${config.repositoryPath}/packages/sdk/protocol/package.json`);
  } catch {
    failures.push('RUNTIME_IDENTITY_UNREADABLE');
  }
  if (commit !== config.expectedCommit) failures.push('COMMIT_MISMATCH');
  if (protocolVersion !== config.expectedProtocolVersion) failures.push('PROTOCOL_MISMATCH');
  if (failures.length === 0) {
    const fixture = await inspectFixture(config);
    shutdown = fixture.shutdown;
    serverInfoVersion = fixture.observation.serverInfoVersion;
    if (fixture.observation.malformedFrame) failures.push('MALFORMED_FRAME');
    if (!fixture.observation.initializeReceived) failures.push('INITIALIZE_TIMEOUT');
    if (serverInfoVersion !== config.expectedProtocolVersion) failures.push('SERVER_INFO_MISMATCH');
    if (!shutdown.reaped) failures.push('PROCESS_NOT_REAPED');
  }
  return {
    outcome: failures.length === 0 ? 'PASS' : 'BLOCKED',
    runtime: { commit, protocolVersion, ...(serverInfoVersion === undefined ? {} : { serverInfoVersion }), profileDigest: profileDigest(commit, protocolVersion, serverInfoVersion) },
    capabilities: brokeredCapabilities, mappings, shutdown, failures
  };
}
