/* global window */
import { useEffect, useState } from 'react';
import { Navigation, type Destination } from './navigation.js';
import { Onboarding } from './onboarding.js';

export function App() {
  const [current, setCurrent] = useState<Destination>('super-assistant');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    void window.superAssistant?.getOnboarding().then(({ onboarding }) => setCompleted(onboarding.completed));
  }, []);

  const completeOnboarding = () => {
    void window.superAssistant?.setOnboarding({ completed: true }).then(({ onboarding }) => setCompleted(onboarding.completed));
  };

  return <main><Navigation current={current} onNavigate={setCurrent} /><h1>{current === 'super-assistant' ? 'Super Assistant' : current}</h1><Onboarding completed={completed} onComplete={completeOnboarding} /></main>;
}
