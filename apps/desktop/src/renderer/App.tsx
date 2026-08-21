/* global window */
import { useEffect, useState } from 'react';
import { Navigation, type Destination } from './navigation.js';
import { Onboarding } from './onboarding.js';
import { ProjectCenter } from './project-center.js';
import { ProposalReview } from './proposal-review.js';
import { TaskCenter } from './task-center.js';
import type { TaskCard } from './task-center.js';
import { DecisionCenter, type DecisionCenterModel } from './decision-center.js';

export function App() {
  const [current, setCurrent] = useState<Destination>('super-assistant');
  const [completed, setCompleted] = useState(false);
  const [tasks, setTasks] = useState<readonly TaskCard[]>([]);
  const [decisions, setDecisions] = useState<readonly DecisionCenterModel[]>([]);

  useEffect(() => {
    void window.superAssistant?.getOnboarding().then((response) => {
      if ('onboarding' in response) setCompleted(response.onboarding.completed);
    });
  }, []);

  useEffect(() => {
    void window.superAssistant?.listTasks?.().then((response) => {
      if ('tasks' in response) setTasks(response.tasks.map((task) => ({ ...task, artifacts: [], decisions: [] })));
    });
  }, []);

  useEffect(() => {
    void window.superAssistant?.listTasks?.().then(async (response) => {
      if (!('tasks' in response) || !window.superAssistant) return;
      const responses = await Promise.all(response.tasks.map((task) => window.superAssistant!.listDecisions(task.taskId)));
      const byTask = new Map(response.tasks.map((task, index) => {
        const result = responses[index];
        return [task.taskId, result && 'decisions' in result ? result.decisions : []];
      }));
      setDecisions(responses.flatMap((item) => ('decisions' in item ? item.decisions : [])));
      setTasks(response.tasks.map((task) => ({ ...task, artifacts: [], decisions: byTask.get(task.taskId) ?? [] })));
    });
  }, []);

  const completeOnboarding = () => {
    void window.superAssistant?.setOnboarding({ completed: true }).then((response) => {
      if ('onboarding' in response) setCompleted(response.onboarding.completed);
    });
  };

  return <main><Navigation current={current} onNavigate={setCurrent} /><h1>{current === 'super-assistant' ? 'Super Assistant' : current}</h1>{current === 'project-center' ? <ProjectCenter projects={[]} /> : current === 'task-center' ? <TaskCenter tasks={tasks} /> : current === 'super-assistant' ? <><ProposalReview objective="Side-effecting plan review" classification="SIDE_EFFECTING" preflight="STALE" onConfirm={() => undefined} />{decisions.map((decision) => <DecisionCenter key={decision.decisionId} decision={decision} />)}</> : <Onboarding completed={completed} onComplete={completeOnboarding} />}</main>;
}
