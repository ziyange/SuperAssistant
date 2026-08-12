/* eslint-disable no-unused-vars -- destination is a type-only callback parameter. */
export const DESTINATIONS = [
  ['super-assistant', 'Super Assistant'],
  ['agent-center', 'Agent Center'],
  ['task-center', 'Task Center'],
  ['project-center', 'Project Center'],
  ['settings', 'Settings']
] as const;

export type Destination = (typeof DESTINATIONS)[number][0];

export function Navigation({ current, onNavigate }: Readonly<{ current: Destination; onNavigate: (destination: Destination) => void }>) {
  return <nav aria-label="Primary navigation">{DESTINATIONS.map(([id, label]) => <button aria-current={current === id ? 'page' : undefined} key={id} onClick={() => onNavigate(id)} type="button">{label}</button>)}</nav>;
}
