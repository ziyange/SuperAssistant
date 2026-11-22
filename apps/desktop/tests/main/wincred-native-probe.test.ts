import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';
import { expect, test } from 'vitest';

const powershell = join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const script = join(process.cwd(), 'apps/desktop/tests/native/wincred-probe.ps1');
function probe(mode: string, target?: string): Record<string, boolean> {
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, '-Mode', mode];
  if (target) args.push('-Target', target);
  const output = execFileSync(powershell, args,
    { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output.trim()) as Record<string, boolean>;
}
test.skipIf(process.platform !== 'win32')('rejects targets outside the synthetic test namespace without accessing WinCred', () => {
  expect(probe('validate')).toEqual({ wrongNamespaceRejected: true, malformedNameRejected: true });
});
test.skipIf(process.platform !== 'win32' || process.env.SA_RUN_WINCRED_PROBE !== '1')(
  'creates reads and safely cleans an exact synthetic WinCred entry', () => {
    const id = process.env.SA_WINCRED_PROBE_ID;
    if (!id || !/^[0-9a-f]{64}$/.test(id)) throw new Error('Explicit synthetic probe identity required');
    expect(probe('selftest', 'SuperAssistant/TestProbe/' + id)).toEqual({ created: true, readMatches: true, duplicateRejected: true,
      wrongProofPreserved: true, exactCleanup: true });
  });
