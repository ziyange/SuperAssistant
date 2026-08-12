export interface ProjectCard { id: string; name: string; status: 'INITIALIZING' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'ERROR'; repository: string | null; branch: string | null; provenance: 'DISCOVERED' | 'USER'; }
export function ProjectCenter({ projects }: Readonly<{ projects: readonly ProjectCard[] }>) {
  return <section aria-label="Project Center"><h2>Project Center</h2>{projects.length === 0 ? <p>No Projects registered.</p> : projects.map((project) => <article key={project.id}><h3>{project.name}</h3><p>{project.status}</p><p>{project.repository ?? 'Repository unavailable'} · {project.branch ?? 'Branch unavailable'}</p><p>{project.provenance === 'DISCOVERED' ? 'Discovered metadata' : 'User-provided metadata'}</p></article>)}</section>;
}
