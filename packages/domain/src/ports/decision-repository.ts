/* eslint-disable no-unused-vars -- interface parameter names describe the public repository contract. */
import type { Decision } from '../decision.js';
import type { DecisionResolution } from '../decision.js';

export interface DecisionRepository {
  create(decision: Decision): void;
  get(decisionId: string): Decision | null;
  findOpenByFingerprint(fingerprint: string): Decision | null;
  resolve(decision: Decision): void;
  resolveAndEnqueueResume(decisionId: string, resolution: DecisionResolution): { decision: Decision; resumeEnqueued: boolean };
}
