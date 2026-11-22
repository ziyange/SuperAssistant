/* eslint-disable no-unused-vars -- parameter names document the renderer port. */
import { useState } from 'react';
import type { IpcResponse } from '../shared/ipc-contract.js';

export interface DecisionCenterModel { decisionId: string; taskId: string; question: string; level: 'L3' | 'L4'; status: 'OPEN' | 'RESOLVED'; }

export function DecisionCenter({ decision, reviewDecision }: Readonly<{ decision: DecisionCenterModel; reviewDecision?: ((decisionId: string) => Promise<IpcResponse>) | undefined }>) {
  const [state, setState] = useState<'IDLE' | 'PENDING' | 'RECORDED' | 'DISMISSED' | 'UNAVAILABLE'>('IDLE');
  const review = () => {
    if (!reviewDecision || state === 'PENDING' || state === 'RECORDED') return;
    setState('PENDING');
    void reviewDecision(decision.decisionId).then(result => {
      setState('decisionReview' in result ? result.decisionReview : 'UNAVAILABLE');
    }).catch(() => setState('UNAVAILABLE'));
  };
  return <section aria-label="Decision"><h2>Decision</h2><p>{decision.question}</p><p>Risk: {decision.level}</p>
    <p>{decision.status === 'OPEN' ? 'Waiting for your decision. AI recommendation is not authorization.' : 'Decision recorded; execution may still be waiting or reconciling.'}</p>
    {decision.status === 'OPEN' && reviewDecision && state !== 'RECORDED' && <button type="button" disabled={state === 'PENDING'} onClick={review}>Review decision</button>}
    {state === 'RECORDED' && <p role="status">Answer recorded; execution has not resumed.</p>}
    {state === 'DISMISSED' && <p role="status">Decision review cancelled.</p>}
    {state === 'UNAVAILABLE' && <p role="alert">Decision could not be recorded.</p>}
  </section>;
}
