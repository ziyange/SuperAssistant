/* global process, setImmediate */
import { createInterface } from 'node:readline';

const mode = process.argv[2] ?? 'normal';
let initialized = false;
let reads = 0;
let cwd = '';
let turnStarted = false;
const send = value => {
  const line = JSON.stringify(value) + '\n';
  if (mode === 'fragmented') {
    const cut = Math.max(1, Math.floor(line.length / 2));
    process.stdout.write(line.slice(0, cut));
    setImmediate(() => process.stdout.write(line.slice(cut)));
  } else process.stdout.write(line);
};

for await (const line of createInterface({ input: process.stdin })) {
  const value = JSON.parse(line);
  const { id, method, params } = value;
  const reply = result => send({ id, result });
  if (method === 'initialize' && params.clientInfo?.name === 'super_assistant') {
    reply({ userAgent: 'fixture/0.121.0' });
  } else if (method === 'initialized' && id === undefined) {
    initialized = true;
  } else if (method === 'account/read' && initialized && params.refreshToken === false) {
    reads += 1;
    const switched = (mode === 'account-switch' && reads > 1) || (mode === 'account-switch-after-thread' && reads > 2);
    reply({ requiresOpenaiAuth: true, account: { type: 'chatgpt', email: switched ? 'other@example.invalid' : 'fixture@example.invalid', planType: 'plus' } });
  } else if (method === 'thread/start' && initialized && params.approvalPolicy === 'on-request' && params.approvalsReviewer === 'user' && params.sandbox === 'workspace-write'
    && params.experimentalRawEvents === false && params.persistExtendedHistory === true
    && params.config?.sandbox_workspace_write?.network_access === false
    && params.config?.sandbox_workspace_write?.exclude_tmpdir_env_var === true
    && params.config?.sandbox_workspace_write?.exclude_slash_tmp === true
    && params.config?.sandbox_workspace_write?.writable_roots?.length === 1
    && params.config.sandbox_workspace_write.writable_roots[0] === params.cwd) {
    cwd = params.cwd;
    if (mode === 'server-request') send({ id: 501, method: 'item/commandExecution/requestApproval', params: { secret: 'not-for-ui' } });
    else reply({ thread: { id: 'thread-1', cwd: mode === 'wrong-thread-cwd' ? cwd + '-different' : cwd, cliVersion: '0.121.0', turns: [] }, cwd: mode === 'wrong-cwd' ? cwd + '-different' : cwd, approvalPolicy: 'on-request', approvalsReviewer: mode === 'wrong-reviewer' ? 'guardian_subagent' : 'user',
      sandbox: { type: 'workspaceWrite', writableRoots: [cwd], readOnlyAccess: { type: 'fullAccess' }, ...(mode === 'unknown-policy' ? { unexpectedPermission: true } : {}),
        networkAccess: mode === 'loose-sandbox', excludeTmpdirEnvVar: true, excludeSlashTmp: true } });
  } else if (method === 'turn/start' && cwd && !turnStarted && params.threadId === 'thread-1'
    && params.cwd === cwd && params.approvalPolicy === 'on-request' && params.approvalsReviewer === 'user' && params.input?.length === 1
    && params.input[0]?.type === 'text' && params.input[0]?.text === 'Write the approved change' && Array.isArray(params.input[0]?.text_elements)
    && params.sandboxPolicy?.type === 'workspaceWrite' && params.sandboxPolicy?.networkAccess === false
    && params.sandboxPolicy?.excludeTmpdirEnvVar === true && params.sandboxPolicy?.excludeSlashTmp === true
    && params.sandboxPolicy?.writableRoots?.length === 1 && params.sandboxPolicy.writableRoots[0] === cwd
    && params.sandboxPolicy?.readOnlyAccess?.type === 'restricted' && params.sandboxPolicy.readOnlyAccess.includePlatformDefaults === true
    && params.sandboxPolicy.readOnlyAccess.readableRoots?.length === 1 && params.sandboxPolicy.readOnlyAccess.readableRoots[0] === cwd) {
    turnStarted = true;
    if (mode === 'lost-turn') process.exit(0);
    const turn = { id: 'turn-1', status: 'inProgress', items: [], error: null, startedAt: null, completedAt: null, durationMs: null };
    if (mode === 'early-completed') {
      process.stdout.write(JSON.stringify({ id, result: { turn } }) + '\n' +
        JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } }) + '\n');
    } else reply({ turn });
  } else if (method === 'turn/interrupt' && turnStarted && params.threadId === 'thread-1' && params.turnId === 'turn-1') {
    reply({});
  } else if (method === 'thread/read' && initialized && mode === 'reconcile'
    && params.threadId === 'thread-1' && params.includeTurns === true) {
    reply({ thread: { id: 'thread-1', cwd: process.cwd(), turns: [{ id: 'turn-1', status: 'completed' }] } });
  } else send({ id, error: { code: -32602, message: 'fixture rejected request' } });
}
