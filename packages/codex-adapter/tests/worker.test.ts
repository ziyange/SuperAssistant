import { expect, test } from 'vitest';
import { CodexWorker } from '../src/worker.js';
test('shuts down its only discovery child', async () => { const child = { kill: () => { killed = true; } } as never; let killed = false; const worker = new CodexWorker(() => child, async () => ({ version: '0.121.0', authenticated: true, capabilities: [] })); await worker.initialize(); worker.shutdown(); expect(killed).toBe(true); });
