export function Onboarding({ completed, onComplete }: Readonly<{ completed: boolean; onComplete: () => void }>) {
  return <section aria-label="H1 onboarding">
    <h2>Get started</h2>
    <p>{completed ? 'Onboarding complete' : 'Connect Codex, add a Project, or start a Task.'}</p>
    {!completed && <div aria-label="Onboarding actions">
      <button type="button">Connect Codex</button>
      <button type="button">Add Project</button>
      <button type="button" onClick={onComplete}>Start Task</button>
    </div>}
  </section>;
}
