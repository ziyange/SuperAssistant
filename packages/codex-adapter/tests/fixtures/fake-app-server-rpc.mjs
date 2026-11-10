/* global process */
import { createInterface } from 'node:readline';
const mode = process.argv[2];
let step = 0;
createInterface({ input: process.stdin }).on('line', (line) => {
  if (mode === 'silent') return;
  if (mode === 'malformed') { process.stdout.write('{broken}\n'); return; }
  const msg = JSON.parse(line);
  const expected = step < 3 ? ['initialize', 'initialized', 'account/read'][step] : 'thread/read';
  step += 1;
  if (msg.method !== expected) { process.stdout.write('{broken}\n'); return; }
  if (msg.method === 'initialize') process.stdout.write(JSON.stringify({ id: msg.id, result: { userAgent: 'fixture' } }) + '\n');
  if (msg.method === 'account/read') process.stdout.write(JSON.stringify({ id: msg.id, result: { account: { type: 'chatgpt' }, requiresOpenaiAuth: true } }) + '\n');
  if (msg.method === 'thread/read' && mode !== 'hold-read') process.stdout.write(JSON.stringify({ id: msg.id, result: { thread: { id: mode === 'bad-read' ? 'wrong-thread' : msg.params.threadId, status: { type: 'idle' }, private: 'private-content' } } }) + '\n');
});
