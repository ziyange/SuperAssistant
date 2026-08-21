export interface TaskHistoryModel { activity: readonly Readonly<{ activityId: string; eventType: string; occurredAt: string }>[]; human: readonly Readonly<{ historyId: string; actorId: string; action: string; occurredAt: string }>[]; }

export function TaskHistory({ history }: Readonly<{ history: TaskHistoryModel }>) {
  return <section aria-label="Task history"><h2>Task History</h2><section aria-label="Agent activity"><h3>Agent activity</h3>{history.activity.length === 0 ? <p>No Agent activity.</p> : history.activity.map((item) => <p key={item.activityId}>{item.eventType} · {item.occurredAt}</p>)}</section><section aria-label="Human history"><h3>Human history</h3>{history.human.length === 0 ? <p>No human actions.</p> : history.human.map((item) => <p key={item.historyId}>{item.actorId} · {item.action} · {item.occurredAt}</p>)}</section></section>;
}
