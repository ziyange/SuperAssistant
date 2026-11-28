import process from 'node:process';

// This does not exercise Electron or attest native user consent.
export async function presentProtectedConsent(review) {
  if (process.env.SA_PROTECTED_PROCESS_FIXTURE !== '1' || typeof review !== 'string') return false;
  return review.includes('Write the approved change');
}
export async function presentProtectedCancellation() { return false; }
