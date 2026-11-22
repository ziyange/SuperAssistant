/* global URL, process, setTimeout, clearTimeout */
import { isAbsolute } from 'node:path';
import { Worker } from 'node:worker_threads';

const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
import(workerData.moduleUrl)
  .then(module => parentPort.postMessage(module.readProjectHead(workerData.path)))
  .catch(() => parentPort.postMessage(null));
`;

let activeWorkers = 0;

/** Review-only observation; the existing main-process Git policy executes in a worker. */
export function readProjectHeadAsync(path: string): Promise<string | null> {
  if (typeof path !== 'string' || path.length === 0 || path.length > 32767 || !isAbsolute(path)
    || path.startsWith('\\\\') || path.startsWith('//')
    || (process.platform === 'win32' && !/^[a-z]:[\\/]/i.test(path)) || activeWorkers >= 2) return Promise.resolve(null);
  activeWorkers += 1;
  return new Promise(resolve => {
    let worker: Worker;
    try {
      const moduleUrl = new URL('../../dist/main/project-git-baseline.js', import.meta.url).href;
      worker = new Worker(workerSource, { eval: true, workerData: { path, moduleUrl } });
    } catch { activeWorkers -= 1; resolve(null); return; }
    let settled = false;
    let result: string | null = null;
    const finish = (value: string | null) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => { finish(null); void worker.terminate().catch(() => undefined); }, 6000);
    timer.unref();
    worker.once('message', (value: unknown) => {
      if (typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) result = value;
    });
    worker.once('error', () => finish(null));
    worker.once('exit', code => {
      activeWorkers -= 1;
      if (!settled) finish(code === 0 ? result : null);
    });
  });
}
