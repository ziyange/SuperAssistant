export type FollowUpDecision = Readonly<{ allowed: true } | { allowed: false; reason: 'COOLDOWN' | 'CONCURRENCY' | 'BUDGET' }>;
export function evaluateFollowUp(input: Readonly<{ now: number; lastFollowUpAt: number; cooldownMs: number; active: number; concurrencyLimit: number; used: number; budget: number }>): FollowUpDecision {
  if (input.now - input.lastFollowUpAt < input.cooldownMs) return { allowed: false, reason: 'COOLDOWN' };
  if (input.active >= input.concurrencyLimit) return { allowed: false, reason: 'CONCURRENCY' };
  if (input.used >= input.budget) return { allowed: false, reason: 'BUDGET' };
  return { allowed: true };
}
