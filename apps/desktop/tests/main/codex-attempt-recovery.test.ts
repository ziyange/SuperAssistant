/* global URL */
import { afterEach, expect, test } from 'vitest';
import { ChildProcess, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import process from 'node:process';
import { PassThrough } from 'node:stream';
import { createAppServerDiscoverySupervisor } from '@super-assistant/codex-adapter';
import { createCodexProbe } from '../../src/main/codex-discovery-ipc.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { createFoundationDatabase, SqliteProposalRepository, SqliteExecutionRepository } from '@super-assistant/persistence';
import { recoverLocalStartup } from '../../src/main/recovery-service.js';
import { CodexAttemptRecovery } from '../../src/main/codex-attempt-recovery.js';
import { AppServerExecutionClient } from '../../../../packages/codex-adapter/src/app-server-execution-client.js';

const opened = new Set<ReturnType<typeof createFoundationDatabase>>();
const directories: string[] = [];
afterEach(() => { for (const db of opened) if (db.open) db.close(); opened.clear(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true }); });
const now = '2026-11-19T00:00:00.000Z', expires = '2026-11-20T00:00:00.000Z';
const identity = { principalHash: '5436e781e3c2db4e810e7e5bc12feb86b6a01a2521a0a49f9f598adb6f4fb483', executable: join(tmpdir(), 'codex.exe'), binaryHash: 'a'.repeat(64), version: '0.121.0' };
const receipt = { attemptId: 'original', claim: 'owned-claim', threadId: 'thread', turnId: 'turn', cwd: join(tmpdir(), 'sa-worktree') };

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'sa-reconcile-')); directories.push(root);
  const file = join(root, 'control.sqlite'), db = createFoundationDatabase(file); opened.add(db);
  db.prepare('INSERT INTO workspaces VALUES (?,?,?,?,?,?,?)').run('local','local-owner','Local','ACTIVE',now,now,1);
  db.prepare('INSERT INTO agents VALUES (?,?,?,?,?,?,?,?)').run('agent','local','Codex',identity.version,'CONNECTED','AVAILABLE',null,1);
  db.prepare('INSERT INTO local_codex_registrations (workspace_id,agent_id,executable_path,observed_version,updated_at) VALUES (?,?,?,?,?)').run('local','agent',identity.executable,identity.version,now);
  db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('project','local','Project','project','project','ACTIVE','agent',1,now,now,1);
  db.prepare('INSERT INTO functions VALUES (?,?,?,?,?)').run('func','agent','Develop','1','ACTIVE');
  const review = createH1ReviewedProposal('approval', {
    objective:'Write a report',workspaceId:'local',projectId:'project',agentId:'agent',functionId:'func',projectSnapshotVersion:'1',agentVersion:identity.version,functionVersion:'1',capabilityVersion:'1',baselineCommit:'b'.repeat(40),createdAt:now,expiresAt:expires,deadlineAt:expires,
    budget:{maxDurationMs:5000,maxTokens:null,maxCost:null},capabilities:[{id:'write',version:'1'}],
    workItems:[{id:'work',projectId:'project',agentId:'agent',functionId:'func',objective:'Write a report',required:true,dependencies:[]}],
    resources:[{key:'project:project',intent:'WRITE'}],allowedActions:['FILE_WRITE'],forbiddenActions:['COMMAND'],reconfirmationTriggers:['scope'],risk:'LOW',acceptanceCriteria:[{criterion:'report exists',evidence:'report'}]
  });
  new SqliteProposalRepository(db).save(review);
  db.prepare('INSERT INTO authorization_grants VALUES (?,?,?,?,?,?,?,?,?)').run('grant','approval',review.digest,'local-owner','confirm','["FILE_WRITE"]','ISSUED',now,expires);
  new SqliteExecutionRepository(db,()=>now).createAuthorizedExecution({taskId:'task',workItemId:'work',attemptId:'original',leaseId:'lease',requestId:'req',idempotencyKey:'approval',workspaceId:'local',projectId:'project',agentId:'agent',functionId:'func',proposalVersionId:'approval',authorizationGrantId:'grant',resourceKey:'project:project',fencingToken:1,createdAt:now});
  db.exec("UPDATE outbox SET state='DISPATCHING',claim_token='owned-claim'");
  return { db, file, recovery:new CodexAttemptRecovery(db) };
}

test('persists UNKNOWN for an owned start claim without releasing the lease or permitting redispatch', () => {
  const { db, file, recovery } = setup();
  expect(recovery.markUnknown(identity, { attemptId: 'original', claim: 'wrong' })).toBe(false);
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('DISPATCH_PENDING');
  expect(recovery.markUnknown(identity, { attemptId: 'original', claim: receipt.claim })).toBe(true);
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  expect(db.prepare('SELECT state FROM outbox').pluck().get()).toBe('RECONCILING');
  expect(db.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
  expect(() => recovery.recordStart(identity, receipt)).toThrow();
  db.close();
  const reopened = createFoundationDatabase(file); opened.add(reopened);
  expect(reopened.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  expect(reopened.prepare('SELECT count(*) FROM outbox WHERE state = ?').pluck().get('PENDING')).toBe(0);
});

test('a lost fake App Server Turn reply persists UNKNOWN on the original Attempt', async () => {
  const { db, file, recovery } = setup();
  const fake = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
  const child = spawn(process.execPath, [fake, 'lost-turn'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const closed = once(child, 'close');
  const principalHash = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
  const runtime = { ...identity, principalHash };
  const client = new AppServerExecutionClient(child, runtime.version, principalHash, async () => true,
    () => recovery.markUnknown(runtime, { attemptId: receipt.attemptId, claim: receipt.claim }), () => true);
  try {
    await client.initialize();
    await expect(client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    expect(client.status()).toBe('UNKNOWN');
    expect(client.unknownNotificationFailed()).toBe(false);
    expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
    expect(db.prepare('SELECT state FROM outbox').pluck().get()).toBe('RECONCILING');
    expect(db.prepare('SELECT count(*) FROM codex_start_receipts').pluck().get()).toBe(0);
    expect(db.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
    await expect(client.start(process.cwd(), 'Write the approved change')).rejects.toThrow();
    db.close();
    const reopened = createFoundationDatabase(file); opened.add(reopened);
    expect(reopened.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  } finally {
    client.dispose();
    if (!child.stdin.destroyed) child.stdin.end();
    await closed;
  }
}, 15000);

test('a Turn receipt followed immediately by completion is persisted before UNKNOWN', async () => {
  const { db, file, recovery } = setup();
  const worktree = mkdtempSync(join(tmpdir(), 'sa-immediate-turn-')); directories.push(worktree);
  const fake = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
  const child = spawn(process.execPath, [fake, 'early-completed'], { cwd: worktree, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const closed = once(child, 'close');
  const principalHash = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
  const runtime = { ...identity, principalHash };
  const client = new AppServerExecutionClient(child, runtime.version, principalHash, async () => true,
    () => recovery.markUnknown(runtime, { attemptId: receipt.attemptId, claim: receipt.claim }), start => {
      recovery.recordStart(runtime, { attemptId: receipt.attemptId, claim: receipt.claim, threadId: start.threadId, turnId: start.turnId, cwd: start.cwd });
      return true;
    });
  try {
    await client.initialize();
    await expect(client.start(worktree, 'Write the approved change')).rejects.toThrow();
    expect(client.status()).toBe('UNKNOWN');
    expect(client.unknownNotificationFailed()).toBe(false);
    expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
    expect(db.prepare('SELECT state FROM outbox').pluck().get()).toBe('ACKNOWLEDGED');
    expect(db.prepare('SELECT thread_id,turn_id FROM codex_start_receipts').get()).toEqual({ thread_id: 'thread-1', turn_id: 'turn-1' });
    db.close();
    const reopened = createFoundationDatabase(file); opened.add(reopened);
    const restored = new CodexAttemptRecovery(reopened);
    await restored.reconcile(runtime, async (thread, turn, cwd) =>
      thread === 'thread-1' && turn === 'turn-1' && cwd === worktree ? 'COMPLETED' : 'INDETERMINATE');
    expect(reopened.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: 'original', state: 'SUCCEEDED' }]);
    expect(reopened.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
  } finally {
    client.dispose();
    if (!child.stdin.destroyed) child.stdin.end();
    await closed;
  }
}, 15000);

test('a saved fake App Server receipt reconciles the original Attempt after worker disconnect', async () => {
  const { db, recovery } = setup();
  const worktree = mkdtempSync(join(tmpdir(), 'sa-original-attempt-')); directories.push(worktree);
  const fake = fileURLToPath(new URL('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs', import.meta.url));
  const principalHash = createHash('sha256').update('codex-personal-v1:fixture@example.invalid:plus').digest('hex');
  const runtime = { ...identity, principalHash };
  const child = spawn(process.execPath, [fake, 'normal'], { cwd: worktree, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const closed = once(child, 'close');
  const client = new AppServerExecutionClient(child, runtime.version, principalHash, async () => true,
    () => recovery.markUnknown(runtime, { attemptId: receipt.attemptId, claim: receipt.claim }), start => {
      recovery.recordStart(runtime, { attemptId: receipt.attemptId, claim: receipt.claim, threadId: start.threadId, turnId: start.turnId, cwd: start.cwd });
      return true;
    });
  try {
    await client.initialize();
    const start = await client.start(worktree, 'Write the approved change');
    expect(start).toMatchObject({ threadId: 'thread-1', turnId: 'turn-1', cwd: worktree, principalHash });
    expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('RUNNING');
    client.dispose();
    expect(client.unknownNotificationFailed()).toBe(false);
    expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
    if (!child.stdin.destroyed) child.stdin.end();
    await closed;

    const reconnect = spawn(process.execPath, [fake, 'reconcile'], { cwd: worktree, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    const reconnectClosed = once(reconnect, 'close');
    const check = createCodexProbe(async () => runtime.version,
      () => createAppServerDiscoverySupervisor(() => reconnect, runtime.version, 5000, async () => {
        if (!reconnect.stdin.destroyed) reconnect.stdin.end();
        await reconnectClosed;
      }),
      async (executable, version, observe, observedPrincipal) => {
        await recovery.reconcile({ ...runtime, executable, version, principalHash: observedPrincipal }, observe);
      });
    await check(runtime.executable);
    expect(db.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{ attempt_id: 'original', state: 'SUCCEEDED' }]);
    expect(db.prepare('SELECT count(*) FROM execution_attempts').pluck().get()).toBe(1);
    expect(db.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
  } finally {
    client.dispose();
    if (!child.stdin.destroyed) child.stdin.end();
    await closed;
  }
}, 20000);

test('marks only the original receipt UNKNOWN after acknowledgement and never rewrites terminal evidence', () => {
  const { db, recovery } = setup();
  recovery.recordStart(identity, receipt);
  expect(recovery.markUnknown({ ...identity, binaryHash: 'c'.repeat(64) }, { attemptId: 'original', claim: receipt.claim })).toBe(false);
  expect(recovery.markUnknown(identity, { attemptId: 'original', claim: 'wrong-claim' })).toBe(false);
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('RUNNING');
  expect(recovery.markUnknown(identity, { attemptId: 'original', claim: receipt.claim })).toBe(true);
  expect(recovery.markUnknown(identity, { attemptId: 'original', claim: receipt.claim })).toBe(true);
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  expect(db.prepare('SELECT state FROM outbox').pluck().get()).toBe('ACKNOWLEDGED');
  expect(db.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
  db.prepare("UPDATE execution_attempts SET state='SUCCEEDED' WHERE attempt_id='original'").run();
  expect(recovery.markUnknown(identity, { attemptId: 'original', claim: receipt.claim })).toBe(false);
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('SUCCEEDED');
});

test('isolates pending and claimed resume messages when original owner is lost', () => {
  const { db, recovery } = setup();
  recovery.recordStart(identity, receipt);
  db.prepare("UPDATE execution_attempts SET state='WAITING_USER' WHERE attempt_id='original'").run();
  const insert = db.prepare(`INSERT INTO outbox(message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at,claim_token)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  insert.run('resume-pending', 'original', 'req-2', 'key-2', 'resume', '{}', 'PENDING', now, null);
  insert.run('resume-claimed', 'original', 'req-3', 'key-3', 'resume', '{}', 'DISPATCHING', now, 'other-claim');
  expect(recovery.markUnknown(identity, { attemptId: 'original', claim: receipt.claim })).toBe(true);
  expect(db.prepare("SELECT message_id,state,claim_token FROM outbox WHERE message_id LIKE 'resume-%' ORDER BY message_id").all()).toEqual([
    { message_id: 'resume-claimed', state: 'RECONCILING', claim_token: null },
    { message_id: 'resume-pending', state: 'RECONCILING', claim_token: null }
  ]);
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  expect(db.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
});

test('serializes competing receipt and UNKNOWN transitions across SQLite connections', async () => {
  const { db, file } = setup();
  const gate = new SharedArrayBuffer(4);
  const moduleFile = fileURLToPath(new URL('../../dist/main/codex-attempt-recovery.js', import.meta.url));
  const script = `
    const { parentPort, workerData } = require('node:worker_threads');
    const { pathToFileURL } = require('node:url');
    const Database = require('better-sqlite3');
    (async () => {
      const { CodexAttemptRecovery } = await import(pathToFileURL(workerData.moduleFile).href);
      const db = new Database(workerData.file);
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');
      const service = new CodexAttemptRecovery(db);
      const gate = new Int32Array(workerData.gate);
      if (Atomics.add(gate, 0, 1) === 0) Atomics.wait(gate, 0, 1, 5000);
      else Atomics.notify(gate, 0, 1);
      let result;
      try {
        result = workerData.mode === 'receipt'
          ? (service.recordStart(workerData.identity, workerData.receipt), 'recorded')
          : String(service.markUnknown(workerData.identity, { attemptId: workerData.receipt.attemptId, claim: workerData.receipt.claim }));
      } catch { result = 'rejected'; }
      finally { db.close(); }
      parentPort.postMessage(result);
    })().catch(error => { throw error; });
  `;
  const run = (mode: string) => new Promise<string>((resolve, reject) => {
    const worker = new Worker(script, { eval: true, workerData: { mode, file, moduleFile, gate, identity, receipt } });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
  const results = await Promise.all([run('receipt'), run('unknown')]);
  expect(results[1]).toBe('true');
  expect(['recorded', 'rejected']).toContain(results[0]);
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  const state = db.prepare('SELECT state FROM outbox').pluck().get();
  expect(['RECONCILING', 'ACKNOWLEDGED']).toContain(state);
  expect(db.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
  expect(db.prepare('SELECT count(*) FROM codex_start_receipts').pluck().get()).toBe(state === 'ACKNOWLEDGED' ? 1 : 0);
}, 15000);

test('only the original acknowledged receipt is observed after reopening SQLite; never releases the lease or accepts the task',async()=>{
  const { db,file,recovery }=setup();
  expect(()=>recovery.recordStart(identity,{...receipt,claim:'late'})).toThrow();
  expect(db.prepare('SELECT count(*) FROM codex_start_receipts').pluck().get()).toBe(0);
  recovery.recordStart(identity,receipt);
  expect(db.prepare('SELECT state FROM outbox').pluck().get()).toBe('ACKNOWLEDGED');
  expect(()=>db.exec("UPDATE codex_start_receipts SET turn_id='different'")).toThrow();
  db.close();
  const restored=createFoundationDatabase(file); opened.add(restored); recoverLocalStartup(restored);
  const service=new CodexAttemptRecovery(restored), calls:string[][]=[];
  const observe=async (thread:string,turn:string,cwd:string)=>{calls.push([thread,turn,cwd]);return 'COMPLETED' as const;};
  await service.reconcile({...identity,binaryHash:'c'.repeat(64)},observe);
  expect(calls).toEqual([]);
  await service.reconcile(identity,observe); await service.reconcile(identity,observe);
  expect(calls).toEqual([['thread','turn',receipt.cwd]]);
  expect(restored.prepare('SELECT attempt_id,state FROM execution_attempts').all()).toEqual([{attempt_id:'original',state:'SUCCEEDED'}]);
  expect(restored.prepare('SELECT state FROM resource_leases').pluck().get()).toBe('ACTIVE');
  expect(restored.prepare('SELECT state FROM tasks').pluck().get()).toBe('QUEUED');
});

test('a lock during the observation or fixture-only evidence cannot change UNKNOWN',async()=>{
  const legacy=setup();
  const digest=legacy.db.prepare('SELECT digest FROM proposal_versions').pluck().get();
  legacy.db.prepare('INSERT INTO codex_start_receipts(attempt_id,proposal_digest,executable_path,binary_hash,thread_id,turn_id,worktree_path) VALUES (?,?,?,?,?,?,?)').run('original',digest,identity.executable,identity.binaryHash,'thread','turn',receipt.cwd);
  legacy.db.exec("UPDATE outbox SET state='ACKNOWLEDGED',claim_token=NULL; UPDATE execution_attempts SET state='UNKNOWN'");
  expect(legacy.recovery.markUnknown(identity, { attemptId: 'original', claim: receipt.claim })).toBe(false);
  let legacyReads=0;
  await legacy.recovery.reconcile(identity,async()=>{legacyReads++;return 'COMPLETED';});
  expect(legacyReads).toBe(0);
  expect(legacy.db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  const {db,recovery}=setup();
  db.exec("INSERT INTO fixture_attempt_correlations VALUES ('original','fixture-thread','fixture-turn')");
  expect(()=>recovery.recordStart(identity,receipt)).toThrow();
  recoverLocalStartup(db);
  let calls=0;
  await recovery.reconcile(identity,async()=>{calls++;return 'COMPLETED';});
  expect(calls).toBe(0);
  const other=setup();
  other.recovery.recordStart(identity,receipt); recoverLocalStartup(other.db);
  await other.recovery.reconcile(identity,async()=>{other.db.exec("UPDATE workspaces SET status='LOCKED'");return 'COMPLETED';});
  expect(other.db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
});

test('an initial Turn cannot close an Attempt which has additional resume delivery history',async()=>{
  const {db,recovery}=setup();
  recovery.recordStart(identity,receipt); recoverLocalStartup(db);
  db.prepare(`INSERT INTO outbox(message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at)
    VALUES ('resume-later','original','other-request','other-key','resume','{}','ACKNOWLEDGED',?)`).run(now);
  let calls=0;
  await recovery.reconcile(identity,async()=>{calls++;return 'COMPLETED';});
  expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe('UNKNOWN');
  expect(calls).toBe(0);
});

test.each(['chatgpt','other-user','switch-during-read','enterprise','apiKey','unrecognized','absent'])('desktop reconnect uses the authenticated read-only transport (%s)',async authentication=>{
  const {db,recovery}=setup();
  recovery.recordStart(identity,receipt); recoverLocalStartup(db);
  const stdin=new PassThrough(), stdout=new PassThrough(), methods:string[]=[];
  const child=Object.assign(new ChildProcess(),{stdin,stdout,exitCode:null,signalCode:null});
  stdin.on('data', bytes=>{
    const frame=JSON.parse(bytes.toString());
    methods.push(frame.method);
    if (frame.id === undefined) return;
    const result=frame.method==='initialize'?{userAgent:'controlled-upstream'}:frame.method==='account/read'
      ?{requiresOpenaiAuth:true,account:authentication==='absent'?null:
        ['chatgpt','other-user','enterprise','switch-during-read'].includes(authentication)?{type:'chatgpt',email:authentication==='other-user'||(authentication==='switch-during-read'&&methods.includes('thread/read'))?'other@example.test':'user@example.test',planType:authentication==='enterprise'?'enterprise':'plus'}:{type:authentication}}
      :{thread:{id:receipt.threadId,cwd:receipt.cwd,turns:[{id:receipt.turnId,status:'failed'}]}};
    stdout.write(JSON.stringify({id:frame.id,result})+'\n');
  });
  try {
    const check=createCodexProbe(async()=>identity.version,()=>createAppServerDiscoverySupervisor(()=>child,identity.version,5000,async()=>{}),
      async(executable,version,observe,principalHash)=>recovery.reconcile({...identity,executable,version,principalHash},observe));
    await check(identity.executable);
    const recognized=authentication==='chatgpt';
    expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe(recognized?'FAILED':'UNKNOWN');
    expect(methods).toEqual(['initialize','initialized','account/read',...(recognized||authentication==='switch-during-read'?['thread/read','account/read']:[])]);
  } finally {stdin.destroy();stdout.destroy();}
});
