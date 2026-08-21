import { ArtifactView, type ArtifactViewModel } from './artifact-view.js';
import { DecisionCenter, type DecisionCenterModel } from './decision-center.js';
import { TaskProgress } from './task-progress.js';

export interface TaskDetailModel { goal: string; state: string; projectName: string; agentName: string; activity: readonly string[]; artifacts: readonly ArtifactViewModel[]; decisions?: readonly DecisionCenterModel[]; }

export function TaskDetail({ task }: Readonly<{ task: TaskDetailModel }>) {
  return <section aria-label="Task detail"><h2>{task.goal}</h2><p>{task.state}</p><p>{task.projectName} · {task.agentName}</p>{task.state === 'RUNNING / RECONCILING' ? <p>Previous execution outcome is being determined. No duplicate execution will start.</p> : null}{task.state === 'CANCELLING' ? <p>Cancellation remains active until the process stops and leases release.</p> : null}<TaskProgress activity={task.activity} />{task.decisions?.map((decision) => <DecisionCenter key={decision.decisionId} decision={decision} />)}<section aria-label="Artifacts"><h3>Artifacts</h3>{task.artifacts.length === 0 ? <p>No artifacts available.</p> : task.artifacts.map((artifact) => <ArtifactView key={artifact.checksum} artifact={artifact} />)}</section></section>;
}
