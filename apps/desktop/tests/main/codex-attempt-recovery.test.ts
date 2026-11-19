import { afterEach, expect, test } from 'vitest';
import { ChildProcess } from 'node:child_process';
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

const opened = new Set<ReturnType<typeof createFoundationDatabase>>();
const directories: string[] = [];
afterEach(() => { for (const db of opened) if (db.open) db.close(); opened.clear(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true }); });
const now = '2026-11-19T00:00:00.000Z', expires = '2026-11-20T00:00:00.000Z';
const identity = { executable: join(tmpdir(), 'codex.exe'), binaryHash: 'a'.repeat(64), version: '0.121.0' };
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

test.each(['chatgpt','unrecognized','absent'])('desktop reconnect uses the authenticated read-only transport (%s)',async authentication=>{
  const {db,recovery}=setup();
  recovery.recordStart(identity,receipt); recoverLocalStartup(db);
  const stdin=new PassThrough(), stdout=new PassThrough(), methods:string[]=[];
  const child=Object.assign(new ChildProcess(),{stdin,stdout,exitCode:null,signalCode:null});
  stdin.on('data', bytes=>{
    const frame=JSON.parse(bytes.toString());
    methods.push(frame.method);
    if (frame.id === undefined) return;
    const result=frame.method==='initialize'?{userAgent:'controlled-upstream'}:frame.method==='account/read'
      ?{requiresOpenaiAuth:true,account:authentication==='absent'?null:{type:authentication}}
      :{thread:{id:receipt.threadId,cwd:receipt.cwd,turns:[{id:receipt.turnId,status:'failed'}]}};
    stdout.write(JSON.stringify({id:frame.id,result})+'\n');
  });
  try {
    const check=createCodexProbe(async()=>identity.version,()=>createAppServerDiscoverySupervisor(()=>child,identity.version,5000,async()=>{}),
      async(executable,version,observe)=>recovery.reconcile({...identity,executable,version},observe));
    await check(identity.executable);
    const recognized=authentication==='chatgpt';
    expect(db.prepare('SELECT state FROM execution_attempts').pluck().get()).toBe(recognized?'FAILED':'UNKNOWN');
    expect(methods).toEqual(['initialize','initialized','account/read',...(recognized?['thread/read']:[])]);
  } finally {stdin.destroy();stdout.destroy();}
});
