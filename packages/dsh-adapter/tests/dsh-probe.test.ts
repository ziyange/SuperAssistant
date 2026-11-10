/* global process */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { probeDsh } from '../src/dsh-probe.js';

let repositoryPath = '';
let expectedCommit = '';
const expectedProtocolVersion = '0.1.1-rc.2';

beforeAll(() => {
  repositoryPath = mkdtempSync(join(tmpdir(), 'super-assistant-dsh-probe-'));
  const protocolDirectory = join(repositoryPath, 'packages', 'sdk', 'protocol');
  mkdirSync(protocolDirectory, { recursive: true });
  writeFileSync(join(protocolDirectory, 'package.json'), JSON.stringify({ version: expectedProtocolVersion }));
  execFileSync('git', ['init', '--quiet', repositoryPath]);
  execFileSync('git', ['-C', repositoryPath, '-c', 'user.name=DSH Probe Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '--quiet', '--allow-empty', '-m', 'Disposable fixture']);
  expectedCommit = execFileSync('git', ['-C', repositoryPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
});

afterAll(() => {
  if (repositoryPath) rmSync(repositoryPath, { recursive: true, force: true });
});

function rpcFixture(source: string): string[] {
  return ['-e', source];
}

const cooperativeFixture = `
let buffered = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffered += chunk;
  for (;;) {
    const end = buffered.indexOf('\\n');
    if (end < 0) break;
    const request = JSON.parse(buffered.slice(0, end));
    buffered = buffered.slice(end + 1);
    if (request.method === 'initialize') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { serverInfo: { version: '0.1.1-rc.2' } } }));
    }
    if (request.method === 'shutdown') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }));
      process.exit(0);
    }
  }
});
`;

describe('probeDsh', () => {
  it('records a matching public profile and broker-required capability declarations', async () => {
    const result = await probeDsh({
      repositoryPath,
      expectedCommit,
      expectedProtocolVersion,
      runtimeCommand: process.execPath,
      runtimeArgs: rpcFixture(cooperativeFixture),
      shutdownTimeoutMs: 3000
    });

    expect(result.outcome).toBe('PASS');
    expect(result.runtime.commit).toBe(expectedCommit);
    expect(result.runtime.protocolVersion).toBe(expectedProtocolVersion);
    expect(result.shutdown.reaped).toBe(true);
    expect(result.capabilities).toEqual({
      filesystem: 'BROKER_REQUIRED',
      network: 'BROKER_REQUIRED',
      plugin: 'BROKER_REQUIRED',
      shell: 'BROKER_REQUIRED'
    });
  });

  it('fails closed when the configured commit or protocol does not match', async () => {
    const commitMismatch = await probeDsh({
      repositoryPath,
      expectedCommit: '0000000000000000000000000000000000000000',
      expectedProtocolVersion,
      runtimeCommand: process.execPath,
      runtimeArgs: rpcFixture(cooperativeFixture)
    });
    const protocolMismatch = await probeDsh({
      repositoryPath,
      expectedCommit,
      expectedProtocolVersion: '0.0.0-mismatch',
      runtimeCommand: process.execPath,
      runtimeArgs: rpcFixture(cooperativeFixture)
    });

    expect(commitMismatch.outcome).toBe('BLOCKED');
    expect(commitMismatch.failures).toContain('COMMIT_MISMATCH');
    expect(protocolMismatch.outcome).toBe('BLOCKED');
    expect(protocolMismatch.failures).toContain('PROTOCOL_MISMATCH');
  });

  it('rejects a malformed JSON-RPC frame and reaps the fixture process', async () => {
    const malformedFixture = "process.stdin.resume(); console.log('not-json'); setInterval(() => {}, 1000);";
    const result = await probeDsh({
      repositoryPath,
      expectedCommit,
      expectedProtocolVersion,
      runtimeCommand: process.execPath,
      runtimeArgs: rpcFixture(malformedFixture),
      shutdownTimeoutMs: 3000
    });

    expect(result.outcome).toBe('BLOCKED');
    expect(result.failures).toContain('MALFORMED_FRAME');
    expect(result.shutdown.reaped).toBe(true);
  }, 15000);

  it('uses the kill ladder when a fixture ignores protocol shutdown', async () => {
    const stuckFixture = "process.stdin.resume(); setInterval(() => {}, 1000);";
    const result = await probeDsh({
      repositoryPath,
      expectedCommit,
      expectedProtocolVersion,
      runtimeCommand: process.execPath,
      runtimeArgs: rpcFixture(stuckFixture),
      shutdownTimeoutMs: 25
    });

    expect(result.outcome).toBe('BLOCKED');
    expect(result.failures).toContain('INITIALIZE_TIMEOUT');
    expect(result.shutdown.reaped).toBe(true);
    expect(result.shutdown.steps).toContain('TERMINATE');
  });
});
