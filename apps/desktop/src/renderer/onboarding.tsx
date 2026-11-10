export function Onboarding({ completed, onAddProject, onConnectCodex }: Readonly<{ completed: boolean; onAddProject: () => void; onConnectCodex: () => void }>) {
  return <section aria-label="H1 onboarding">
    <h2>Get started</h2>
    <p>{completed ? 'Onboarding complete' : 'Connect Codex, add a Project, or start a Task.'}</p>
    {!completed && <div aria-label="Onboarding actions">
      <button type="button" onClick={onConnectCodex}>Connect Codex</button>
      <button type="button" onClick={onAddProject}>Add Project</button>
      <button type="button" disabled aria-describedby="task-unavailable">Start Task</button>
      <p id="task-unavailable">Task execution is not available until the Codex workflow is connected.</p>
    </div>}
  </section>;
}
