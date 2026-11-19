import { useEffect, useState } from 'react';
import type { ProjectRendererProjection, ProposalContextProjection, ReadProposalContext } from '../shared/ipc-contract.js';

const prerequisiteMessage: Record<ProposalContextProjection['status'], string> = {
  PROJECT_UNAVAILABLE: 'The selected Project is unavailable.',
  CODEX_REQUIRED: 'Assign a registered Codex to this Project in Project Center.',
  FUNCTION_REQUIRED: 'No active Codex Function is registered for this Project.',
  LIVE_VERIFICATION_REQUIRED: 'Live verification is still required before any Proposal can be confirmed.'
};

function ProjectPrerequisites({ projectId, readContext }: Readonly<{ projectId: string; readContext: ReadProposalContext }>) {
  const [result, setResult] = useState<ProposalContextProjection['status'] | 'ERROR'>();
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await readContext(projectId);
        if (active) setResult('proposalContext' in response ? response.proposalContext.status : 'ERROR');
      } catch {
        if (active) setResult('ERROR');
      }
    })();
    return () => { active = false; };
  }, [projectId, readContext]);
  if (result === 'ERROR') return <p role="alert">Project prerequisites could not be checked.</p>;
  return <p role="status">{result ? prerequisiteMessage[result] : 'Checking Project prerequisites…'}</p>;
}

export function ProposalPreparation({ projects, readContext, loading = false, error }: Readonly<{
  projects: readonly Pick<ProjectRendererProjection, 'id' | 'name' | 'status'>[];
  readContext?: ReadProposalContext | undefined;
  loading?: boolean;
  error?: string | undefined;
}>) {
  const [selected, setSelected] = useState('');
  const eligible = projects.filter(project => project.status === 'ACTIVE');
  const activeId = eligible.some(project => project.id === selected) ? selected : '';
  return <section aria-label="Proposal preparation">
    <h2>Proposal preparation</h2>
    {loading ? <p role="status">Loading Projects…</p> : error ? <p role="alert">Project catalog is unavailable.</p> :
      eligible.length === 0 ? <p>Register or activate a Project in Project Center.</p> : <>
        <label>Project for proposal <select value={activeId} onChange={event => setSelected(event.target.value)}>
          <option value="">Select a Project</option>
          {eligible.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select></label>
        {activeId && (readContext
          ? <ProjectPrerequisites key={activeId} projectId={activeId} readContext={readContext} />
          : <p role="alert">Project prerequisites could not be checked.</p>)}
      </>}
    <button type="button" disabled>Confirm proposal</button>
  </section>;
}

export function ProposalReview({ objective, classification, preflight, onConfirm }: Readonly<{ objective: string; classification: 'READ_ONLY' | 'SIDE_EFFECTING'; preflight: 'READY' | 'STALE'; onConfirm: () => void }>) {
  if (classification === 'READ_ONLY') return <section aria-label="Proposal Review"><h2>Proposal Review</h2><p>{objective}</p><p>No authorization required</p></section>;
  const ready = preflight === 'READY';
  return <section aria-label="Proposal Review"><h2>Proposal Review</h2><p>{objective}</p>{!ready && <p>Preflight must be refreshed</p>}<button type="button" disabled={!ready} onClick={onConfirm}>Confirm proposal</button></section>;
}
