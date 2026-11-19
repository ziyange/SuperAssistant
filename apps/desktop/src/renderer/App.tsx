/* global window */
import { useEffect, useState } from 'react';
import { Navigation, type Destination } from './navigation.js';
import { Onboarding } from './onboarding.js';
import { AgentCenter } from './agent-center.js';
import { ProjectCenter } from './project-center.js';
import type { ProjectCard } from './project-center.js';
import { ProposalPreparation } from './proposal-review.js';
import { TaskCenter } from './task-center.js';
import type { TaskCard } from './task-center.js';
import { DecisionCenter, type DecisionCenterModel } from './decision-center.js';
import { TaskHistory, type TaskHistoryModel } from './task-history.js';
import { ProjectChanges, type ProjectChangesModel } from './project-changes.js';
import { AuditExport } from './audit-export.js';
import { DegradedState } from './degraded-state.js';
import { MonitoringStatus } from './monitoring-status.js';
import type { MonitoringStatusRendererProjection } from '../shared/ipc-contract.js';
import type { CodexCheckProjection, CodexRegistrationProjection } from '../shared/ipc-contract.js';
import { TeamWorkspace } from './team-workspace.js';
import { TeamMembers } from './team-members.js';
import { TeamApprovals } from './team-approvals.js';
import { TeamGovernance } from './team-governance.js';
import type { TeamWorkspaceProjection } from '../main/team-client.js';

export function App() {
  const [current, setCurrent] = useState<Destination>('super-assistant');
  const [completed, setCompleted] = useState(false);
  const [tasks, setTasks] = useState<readonly TaskCard[]>([]);
  const [taskRevision, setTaskRevision] = useState(0);
  const [taskRead, setTaskRead] = useState<'LOADING' | 'READY' | 'TASK_ERROR' | 'DECISION_ERROR'>('LOADING');
  const [withdrawnTaskIds, setWithdrawnTaskIds] = useState<readonly string[]>([]);
  const [projects, setProjects] = useState<readonly ProjectCard[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string>();
  const [projectNotice, setProjectNotice] = useState<string>();
  const [codex, setCodex] = useState<CodexCheckProjection>();
  const [codexRegistration, setCodexRegistration] = useState<CodexRegistrationProjection>();
  const [codexChecking, setCodexChecking] = useState(false);
  const [decisions, setDecisions] = useState<readonly DecisionCenterModel[]>([]);
  const [history] = useState<TaskHistoryModel>({ activity: [], human: [] });
  const [changes] = useState<readonly ProjectChangesModel[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringStatusRendererProjection>();
  const [team, setTeam] = useState<TeamWorkspaceProjection>({ state: 'DEGRADED', members: [], approvals: [] });

  useEffect(() => {
    void window.superAssistant?.getOnboarding().then((response) => {
      if ('onboarding' in response) setCompleted(response.onboarding.completed);
    });
  }, []);

  useEffect(() => {
    const api = window.superAssistant;
    if (!api?.listProjects) { setProjectError('Project catalog is unavailable.'); return; }
    setProjectLoading(true);
    void api.listProjects().then((response) => {
      if (!('projects' in response) || response.status === 'ERROR') { setProjectError('Project catalog is unavailable.'); return; }
      setProjects(response.projects);
    }).catch(() => setProjectError('Project catalog is unavailable.')).finally(() => setProjectLoading(false));
  }, []);

  const chooseProject = () => {
    const api = window.superAssistant;
    if (!api?.chooseProject || projectLoading) { setProjectError('Project catalog is unavailable.'); return; }
    setProjectLoading(true);
    setProjectError(undefined);
    setProjectNotice(undefined);
    void api.chooseProject().then((response) => {
      if (!('projects' in response) || response.status === 'ERROR') { setProjectError('Project path could not be validated.'); return; }
      setProjects(response.projects);
      setProjectNotice(response.status === 'CANCELLED' ? 'Project selection cancelled.' : 'Project registered.');
    }).catch(() => setProjectError('Project path could not be validated.')).finally(() => setProjectLoading(false));
  };

  const assignCodex = (projectId: string) => {
    const api = window.superAssistant;
    if (!api?.assignProjectCodex || projectLoading) { setProjectError('Codex assignment is unavailable.'); return; }
    setProjectLoading(true);
    setProjectError(undefined);
    setProjectNotice(undefined);
    void api.assignProjectCodex(projectId).then(response => {
      if (!('projects' in response) || response.status !== 'ASSIGNED') { setProjectError('Codex assignment is unavailable.'); return; }
      setProjects(response.projects);
      setProjectNotice('Codex configured for Project.');
    }).catch(() => setProjectError('Codex assignment is unavailable.')).finally(() => setProjectLoading(false));
  };

  const checkCodex = () => {
    if (codexChecking) return;
    const check = window.superAssistant?.checkCodex;
    if (!check) { setCodex({ state: 'UNAVAILABLE' }); return; }
    setCodexChecking(true);
    void check().then(response => setCodex('codex' in response ? response.codex : { state: 'UNAVAILABLE' }))
      .catch(() => setCodex({ state: 'UNAVAILABLE' })).finally(() => {
        setCodexChecking(false);
        setTaskRevision(previous => previous + 1);
      });
  };

  useEffect(() => {
    void window.superAssistant?.getCodexRegistration?.().then(response => {
      if ('codexRegistration' in response) setCodexRegistration(response.codexRegistration);
    }).catch(() => setCodexRegistration({ state: 'UNAVAILABLE' }));
  }, []);

  useEffect(() => { void window.superAssistant?.getTeamWorkspace?.('default-workspace').then(response => { if ('team' in response) setTeam(response.team); }); }, []);

  useEffect(() => {
    void window.superAssistant?.getMonitoringStatus?.('default-project').then((response) => {
      if ('monitoring' in response) setMonitoring(response.monitoring);
    });
  }, []);

  useEffect(() => {
    let currentRead = true;
    const api = window.superAssistant;
    setTaskRead('LOADING');
    setDecisions([]);
    void (async () => {
      if (!api?.listTasks) throw new Error('TASK_READ_UNAVAILABLE');
      const list = await api.listTasks();
      if (!currentRead) return;
      if (!('tasks' in list)) throw new Error('TASK_READ_UNAVAILABLE');
      const cards = list.tasks.map(task => ({ ...task, artifacts: [], decisions: [] }));
      setTasks(cards);
      setTaskRead('READY');
      try {
        const groups = await Promise.all(cards.map(async task => {
          const result = await api.listDecisions(task.taskId);
          if (!('decisions' in result)) throw new Error('DECISION_READ_UNAVAILABLE');
          return result.decisions;
        }));
        if (!currentRead) return;
        setDecisions(groups.flat());
        setTasks(cards.map((card, index) => ({ ...card, decisions: groups[index] ?? [] })));
      } catch { if (currentRead) setTaskRead('DECISION_ERROR'); }
    })().catch(() => { if (currentRead) { setTasks([]); setTaskRead('TASK_ERROR'); } });
    return () => { currentRead = false; };
  }, [taskRevision]);

  return <main><Navigation current={current} onNavigate={setCurrent} /><h1>{current === 'super-assistant' ? 'Super Assistant' : current}</h1>{current === 'agent-center' ? <AgentCenter connection={codex?.state === 'CHECKED' ? codex.connection : 'UNAVAILABLE'} availability={codex?.state === 'CHECKED' ? codex.availability : 'PAUSED'} version={codex?.state === 'CHECKED' ? codex.version : codexRegistration?.state === 'RECHECK_REQUIRED' ? codexRegistration.version : 'unknown'} functions={[]} onCheck={checkCodex} checking={codexChecking} observedAt={codex?.state === 'CHECKED' ? codex.observedAt : undefined} notice={codex?.state === 'CANCELLED' ? 'Codex selection cancelled.' : codex?.state === 'UNAVAILABLE' ? 'Codex check unavailable.' : codex === undefined && codexRegistration?.state === 'RECHECK_REQUIRED' ? 'Codex registration requires a new check.' : undefined} /> : current === 'project-center' ? <><ProjectCenter projects={projects} onAdd={chooseProject} onAssignCodex={assignCodex} codexRegistered={codex?.state === 'CHECKED' || codexRegistration?.state === 'RECHECK_REQUIRED'} loading={projectLoading} error={projectError} notice={projectNotice} /><MonitoringStatus status={monitoring} /><ProjectChanges changes={changes} /><AuditExport /><TeamWorkspace team={team} /><TeamMembers members={team.members} /><TeamApprovals approvals={team.approvals} /><TeamGovernance team={team} /></> : current === 'task-center' ? <>{taskRead === 'TASK_ERROR' ? <p role="alert">Task status could not be loaded.</p> : taskRead === 'LOADING' ? <p role="status">Loading task status…</p> : <TaskCenter tasks={tasks.map(task => withdrawnTaskIds.includes(task.taskId) ? { ...task, state: 'CANCELLED' } : task)} cancelQueuedTask={window.superAssistant?.cancelQueuedTask} onQueuedCancelled={taskId => setWithdrawnTaskIds(previous => previous.includes(taskId) ? previous : [...previous, taskId])} />}{taskRead === 'DECISION_ERROR' && <p role="alert">Decision status could not be loaded.</p>}<TaskHistory history={history} /></> : current === 'super-assistant' ? <>{(taskRead === 'DECISION_ERROR' || taskRead === 'TASK_ERROR') && <p role="alert">Decision status could not be loaded.</p>}<DegradedState reason="Adapter status is unavailable until reconciliation completes." /><ProposalPreparation projects={projects} loading={projectLoading} error={projectError} readContext={window.superAssistant?.getProposalContext} />{decisions.map((decision) => <DecisionCenter key={decision.decisionId} decision={decision} />)}</> : <Onboarding completed={completed} onAddProject={() => setCurrent('project-center')} onConnectCodex={() => setCurrent('agent-center')} />}</main>;
}
