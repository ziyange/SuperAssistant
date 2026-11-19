/* global process */
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [receiptPath, root, mode] = process.argv.slice(2);
let dir;
let threadId;
let initialized = false;
for await (const line of createInterface({ input: process.stdin })) {
  const message = JSON.parse(line);
  const { id, method, params } = message;
  const reply = (result) => process.stdout.write(JSON.stringify({ id, result }) + '\n');
  try {
    if (method === 'initialize' && params.clientInfo?.name === 'super_assistant') {
      reply({ userAgent: mode === 'wrong-version' ? 'fixture-app-server/0.157.1' : 'fixture-app-server/0.121.0' });
    } else if (method === 'initialized' && id === undefined) {
      initialized = true;
    } else if (method === 'account/read' && initialized && params.refreshToken === false) {
      reply({ account: { type: 'chatgpt' }, requiresOpenaiAuth: true });
    } else if (method === 'thread/start' && initialized && params.approvalPolicy === 'on-request' && params.sandbox === 'workspace-write') {
      dir = realpathSync.native(params.cwd);
      if (dirname(dir) !== realpathSync.native(root)) throw new Error('invalid fixture target');
      threadId = randomUUID();
      reply({ thread: { id: threadId } });
    } else if (method === 'turn/start' && dir && threadId && params.threadId === threadId
      && params.input?.length === 1 && params.input[0]?.type === 'text' && params.input[0]?.text === 'fixture:write-result') {
      if (existsSync(receiptPath)) throw new Error('duplicate effect');
      writeFileSync(join(dir, 'result.txt'), 'fixture result\n', { flag: 'wx' });
      const turnId = randomUUID();
      writeFileSync(receiptPath, JSON.stringify({ threadId, turnId }), { flag: 'wx' });
      if (mode === 'lost-receipt') process.exit(0);
      reply({ turn: { id: turnId, status: 'inProgress' } });
    } else if (method === 'thread/read' && initialized && params.includeTurns === true && existsSync(receiptPath)) {
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      if (params.threadId !== receipt.threadId || mode === 'read-error') throw new Error('invalid fixture receipt');
      const turn = { id: mode === 'wrong-turn' ? randomUUID() : receipt.turnId, status: mode === 'in-progress' ? 'inProgress' : 'completed' };
      reply({ thread: { id: mode === 'wrong-thread' ? randomUUID() : receipt.threadId, turns: mode === 'duplicate-turn' ? [turn, turn] : [turn] } });
    } else {
      throw new Error('unexpected fixture input');
    }
  } catch {
    process.stdout.write(JSON.stringify({ id, error: { code: -32602, message: 'fixture request rejected' } }) + '\n');
  }
}
