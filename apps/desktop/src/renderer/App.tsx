/* global window */
import { useEffect, useState } from 'react';
import { Navigation, type Destination } from './navigation.js';
import { Onboarding } from './onboarding.js';
import { ProjectCenter } from './project-center.js';
import { ProposalReview } from './proposal-review.js';
import { TaskCenter } from './task-center.js';
import type { TaskCard } from './task-center.js';

export function App() {
  const [current, setCurrent] = useState<Destination>('super-assistant');
  const [completed, setCompleted] = useState(false);
  const [tasks, setTasks] = useState<readonly TaskCard[]>([]);

  useEffect(() => {
    void window.superAssistant?.getOnboarding().then((response) => {
      if ('onboarding' in response) setCompleted(response.onboarding.completed);
    });
  }, []);

  useEffect(() => {
    void window.superAssistant?.listTasks?.().then((response) => {
      if ('tasks' in response) setTasks(response.tasks.map((task) => ({ ...task, artifacts: [] })));
    });
  }, []);

  const completeOnboarding = () => {
    void window.superAssistant?.setOnboarding({ completed: true }).then((response) => {
      if ('onboarding' in response) setCompleted(response.onboarding.completed);
    });
  };

  return <main><Navigation current={current} onNavigate={setCurrent} /><h1>{current === 'super-assistant' ? 'Super Assistant' : current}</h1>{current === 'project-center' ? <ProjectCenter projects={[]} /> : current === 'task-center' ? <TaskCenter tasks={tasks} /> : current === 'super-assistant' ? <ProposalReview objective="Side-effecting plan review" classification="SIDE_EFFECTING" preflight="STALE" onConfirm={() => undefined} /> : <Onboarding completed={completed} onComplete={completeOnboarding} />}</main>;
}
