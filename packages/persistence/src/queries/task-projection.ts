/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { projectTask, type TaskProjection } from '@super-assistant/domain';

// Read-only guard: recovery and display have no authority to accept work.
// Only inspect evidence for a Task that was actually finalized.
const completedWithEvidence = `CASE WHEN t.state = 'COMPLETED' AND ea.state = 'SUCCEEDED' THEN
  NOT EXISTS (SELECT 1 FROM decisions d WHERE d.task_id=t.task_id AND d.status='OPEN')
  AND NOT EXISTS (
    SELECT 1 FROM work_items item WHERE item.task_id=t.task_id
    AND (item.state<>'ACCEPTED' OR NOT EXISTS (
      SELECT 1 FROM execution_attempts last
      JOIN acceptance_evidence e ON e.task_id=t.task_id AND e.work_item_id=item.work_item_id AND e.attempt_id=last.attempt_id
      JOIN artifact_versions av ON av.artifact_version_id=e.artifact_version_id AND av.task_id=t.task_id
        AND av.work_item_id=item.work_item_id AND av.attempt_id=last.attempt_id AND av.project_id=t.project_id
        AND av.authorization_grant_id=t.authorization_grant_id AND av.baseline_commit=pv.baseline_commit
      WHERE last.work_item_id=item.work_item_id AND last.state='SUCCEEDED' AND e.outcome='ACCEPTED'
        AND length(trim(e.evaluator_id))>0 AND length(av.checksum)=71 AND substr(av.checksum,1,7)='sha256:'
        AND substr(av.checksum,8) NOT GLOB '*[^0-9a-f]*'
        AND NOT EXISTS (SELECT 1 FROM execution_attempts newer WHERE newer.work_item_id=item.work_item_id
          AND newer.attempt_id<>last.attempt_id AND newer.created_at>=last.created_at)
        AND NOT EXISTS (SELECT 1 FROM acceptance_evidence rejection WHERE rejection.task_id=t.task_id
          AND rejection.work_item_id=item.work_item_id AND rejection.attempt_id=last.attempt_id
          AND rejection.outcome='REJECTED' AND rejection.created_at>=e.created_at)
    ))
  ) ELSE 0 END`;

export class SqliteTaskProjectionQuery {
  constructor(private readonly database: Database.Database) {}

  get(taskId: string): TaskProjection | null { return this.read(taskId)[0] ?? null; }
  list(): readonly TaskProjection[] { return this.read(); }

  private read(taskId?: string): TaskProjection[] {
    return this.database.transaction(() => this.snapshot(taskId))();
  }

  private snapshot(taskId?: string): TaskProjection[] {
    const rows = this.database.prepare(`SELECT t.task_id, wi.work_item_id, p.name AS project_name, a.name AS agent_name, pv.objective,
      ea.state AS attempt_state, t.created_at, ${completedWithEvidence} AS completed_with_evidence
      FROM tasks t JOIN proposal_versions pv ON pv.proposal_version_id=t.proposal_version_id
      JOIN projects p ON p.project_id=t.project_id AND p.workspace_id=t.workspace_id
      JOIN work_items wi ON wi.task_id=t.task_id JOIN agents a ON a.agent_id=wi.agent_id AND a.workspace_id=t.workspace_id
      LEFT JOIN execution_attempts ea ON ea.work_item_id=wi.work_item_id
      WHERE ${taskId===undefined?'':'t.task_id=? AND '}(ea.attempt_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM execution_attempts newer WHERE newer.work_item_id=wi.work_item_id AND newer.created_at>ea.created_at
      )) ORDER BY t.created_at DESC,t.task_id,wi.work_item_id,ea.attempt_id`).all(...(taskId===undefined?[]:[taskId])) as Record<string,unknown>[];
    const groups=new Map<string,Record<string,unknown>[]>();
    for (const row of rows) {
      const id=String(row.task_id), group=groups.get(id);
      if (group) group.push(row); else groups.set(id,[row]);
    }
    if (!groups.size) return [];
    const activity=new Map<string,string[]>();
    // Only expose product event labels; never project raw provider output.
    const recent=this.database.prepare(`SELECT task_id,label FROM (
      SELECT h.task_id,CASE h.event_type WHEN 'EXECUTION_STARTED' THEN 'Execution started'
        WHEN 'EXECUTION_COMPLETED' THEN 'Execution completed' WHEN 'EXECUTION_FAILED' THEN 'Execution failed'
        ELSE 'Activity recorded' END AS label,
        row_number() OVER(PARTITION BY h.task_id ORDER BY h.occurred_at DESC,h.sequence DESC,h.activity_id DESC) AS seq
      FROM activity_history h JOIN tasks t ON t.task_id=h.task_id AND t.workspace_id=h.workspace_id AND t.project_id=h.project_id
      JOIN execution_attempts a ON a.attempt_id=h.attempt_id JOIN work_items wi ON wi.work_item_id=a.work_item_id AND wi.task_id=t.task_id
      ${taskId===undefined?'':'WHERE t.task_id=?'}
    ) WHERE seq<=100 ORDER BY task_id,seq DESC`).iterate(...(taskId===undefined?[]:[taskId])) as Iterable<{task_id:string;label:string}>;
    for (const event of recent) {
      const labels=activity.get(event.task_id); if (labels) labels.push(event.label); else activity.set(event.task_id,[event.label]);
    }
    return Array.from(groups.entries(), ([id,group])=>{
      const views=group.map(row=>({...this.toProjection(row),activity:activity.get(id)??[]}));
      const first=views[0]!;
      // Two latest attempts for the same item at the same timestamp do not
      // identify which one owns the result. No arbitrary ID is a tie-breaker.
      if (new Set(group.map(row=>row.work_item_id)).size!==group.length) return {...first,state:'RUNNING / RECONCILING'};
      for (const state of ['RUNNING / RECONCILING','CANCELLING','RUNNING'] as const) {
        const active=views.find(view=>view.state===state); if (active) return active;
      }
      if (group.length>1 && group.some(row=>row.attempt_state==='DISPATCH_PENDING')) return {...first,state:'RUNNING'};
      for (const state of ['FAILED','QUEUED','ACCEPTANCE_PENDING'] as const) {
        const active=views.find(view=>view.state===state); if (active) return active;
      }
      return first;
    });
  }

  private toProjection(row: Record<string, unknown>): TaskProjection {
    return projectTask({ taskId: String(row.task_id), goal: String(row.objective), projectName: String(row.project_name), agentName: String(row.agent_name), updatedAt: String(row.created_at), attemptState: row.attempt_state ? String(row.attempt_state) : 'CREATED', completedWithEvidence: row.completed_with_evidence === 1, cancellation: 'NONE', activity: [] });
  }
}
