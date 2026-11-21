import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteTaskProjectionQuery } from '../src/queries/task-projection.js';

function seedTask(db: ReturnType<typeof createFoundationDatabase>, attemptState: string): void {
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'owner-1', 'Workspace', 'ACTIVE', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('proposal-1', 'workspace-1', 'project-1', 'agent-1', 'function-1', '<b>Fix parser</b>', '[]', '1', '1.0.0', '1.0.0', '1.0.0', 'base', '2026-08-14T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 'sha256:abc');
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', 'proposal-1', 'sha256:abc', 'actor-1', 'grant-key-1', '[]', 'CONSUMED', '2026-08-12T00:00:00.000Z', '2026-08-14T00:00:00.000Z');
  db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run('task-1', 'workspace-1', 'project-1', 'proposal-1', 'grant-1', 'QUEUED', '2026-08-12T00:00:00.000Z');
  db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run('work-1', 'task-1', 'agent-1', 'function-1', 'WAITING');
  db.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)').run('attempt-1', 'work-1', 'request-1', 'key-1', attemptState, 1, '2026-08-12T00:00:00.000Z');
}

test('rebuilds reconciliation display state from persisted Task facts', () => {
  const db = createFoundationDatabase(':memory:'); seedTask(db, 'RECONCILING');
  expect(new SqliteTaskProjectionQuery(db).get('task-1')).toEqual(expect.objectContaining({ goal: 'bFix parser/b', state: 'RUNNING / RECONCILING' }));
  db.close();
});

test.each(['other-item','same-time-retry'])('one truthful Task for uncertain sibling or ambiguous latest Attempt (%s)',variant=>{
  const db=createFoundationDatabase(':memory:');
  try {
    seedTask(db,'SUCCEEDED');
    if (variant==='other-item') db.exec("INSERT INTO work_items VALUES('w2','task-1','agent-1','function-1','RUNNING')");
    db.prepare("INSERT INTO execution_attempts VALUES('another',?,'req2','k2',?,0,?)").run(variant==='other-item'?'w2':'work-1',variant==='other-item'?'UNKNOWN':'SUCCEEDED',variant==='other-item'?'2026-08-11T00:00:00.000Z':'2026-08-12T00:00:00.000Z');
    const query=new SqliteTaskProjectionQuery(db);
    expect(query.list().map(row=>[row.taskId,row.state])).toEqual([['task-1','RUNNING / RECONCILING']]);
    expect(query.get('task-1')).toEqual(query.list()[0]);
  } finally {db.close();}
});

test('success of the original Attempt does not accept the Task in list or detail', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedTask(db, 'SUCCEEDED');
    const query = new SqliteTaskProjectionQuery(db);
    const states = () => [query.get('task-1')?.state, query.list()[0]?.state];
    expect(states()).toEqual(['ACCEPTANCE_PENDING', 'ACCEPTANCE_PENDING']);
    expect(db.prepare('SELECT state FROM tasks').pluck().get()).toBe('QUEUED');
    db.exec("UPDATE tasks SET state='COMPLETED'");
    expect(states()).toEqual(['ACCEPTANCE_PENDING', 'ACCEPTANCE_PENDING']);
    db.exec("UPDATE work_items SET state='ACCEPTED'");
    db.exec("INSERT INTO acceptance_evidence VALUES('proof','task-1','work-1','attempt-1','artifact','reviewer','ACCEPTED','2026-08-13')");
    expect(states()).toEqual(['ACCEPTANCE_PENDING', 'ACCEPTANCE_PENDING']);
    db.prepare("INSERT INTO artifact_versions VALUES ('artifact','report','task-1','work-1','attempt-1','project-1','base','grant-1','report','text/plain',8,?,'private-ref','2026-08-13')").run('sha256:'+'a'.repeat(64));
    expect(states()).toEqual(['COMPLETED', 'COMPLETED']);
    db.exec("INSERT INTO decisions (decision_id,workspace_id,project_id,task_id,work_item_id,question,level,fingerprint,status,created_at) VALUES ('d','workspace-1','project-1','task-1','work-1','Approve?','L3','key','OPEN','2026-08-13')");
    expect(states()).toEqual(['ACCEPTANCE_PENDING', 'ACCEPTANCE_PENDING']);
    db.exec("UPDATE execution_attempts SET state='UNKNOWN'");
    expect(states()).toEqual(['RUNNING / RECONCILING', 'RUNNING / RECONCILING']);
  } finally { db.close(); }
});

test('never-started sibling does not mask failure; activity is read from the matching Task, Project and Attempt',()=>{
  const db=createFoundationDatabase(':memory:');
  try {
    seedTask(db,'FAILED');
    db.exec("INSERT INTO work_items VALUES('waiting','task-1','agent-1','function-1','WAITING')");
    const save=db.prepare("INSERT INTO activity_history VALUES(?,?,?,?,?,?,?,?)");
    save.run('valid','workspace-1','project-1','task-1','attempt-1',1,'EXECUTION_STARTED','2026-08-12');
    save.run('opaque','workspace-1','project-1','task-1','attempt-1',2,'private data','2026-08-13');
    save.run('foreign','workspace-1','different','task-1','attempt-1',3,'EXECUTION_STARTED','2026-08-14');
    save.run('unknown','workspace-1','project-1','task-1','not-owned',4,'EXECUTION_STARTED','2026-08-15');
    const read=new SqliteTaskProjectionQuery(db);
    expect(read.get('task-1')).toMatchObject({state:'FAILED',activity:['Execution started','Activity recorded']});
    expect(read.list()).toEqual([read.get('task-1')]);
  } finally {db.close();}
});
