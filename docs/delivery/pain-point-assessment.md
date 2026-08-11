# Pain-point card assessment

- Assessment date: 2026-08-09
- Input: `docs/source/super-assistant-v3.md`
- Rule source: `references/pain-points.md`
- Selection rule: activate only the highest score at or above `0.600`

## Score table

The score is `S = (2 × mandatory hits + pattern hits) / (2 × mandatory total + pattern total)` after semantic normalization of equivalent Chinese terms.

| Card | Mandatory hits | Pattern hits | Score | Decision |
|---|---:|---:|---:|---|
| SECURITY_PERMISSION | 5 of 7 | 2 of 6 | 0.600 | Activated; user confirmed |
| CONCURRENCY_RACE | 4 of 7 | 2 of 5 | 0.526 | Ignored by Top-1 exclusivity; engineering gate retained |
| SCHEMA_MIGRATION | 3 of 6 | 2 of 5 | 0.471 | Below threshold |
| STATE_MEMORY_LEAK | 1 of 6 | 2 of 5 | 0.235 | Below threshold |
| PERFORMANCE_DEGRADATION | 1 of 6 | 1 of 5 | 0.176 | Below threshold |
| CROSS_PLATFORM | 1 of 7 | 1 of 5 | 0.158 | Below threshold |

## Activated card

- `card_id: SECURITY_PERMISSION`
- `score: 0.600`
- `user_confirmed: true`
- Mandatory controls: Proposal-bound authorization, deny-by-default IPC and policy, Credential Manager, exact resource/file scope, secret redaction, and negative authorization tests.

## Ignored candidates

`CONCURRENCY_RACE` is not activated under the Top-1 card rule, but it is not treated as a product risk dismissal. Worktree isolation is mandatory in H1, and ResourceLease/fencing plus conflicting-write rejection are Phase 4 exit gates. Other candidates remain in the phase risk registers and are rescored when their relevant phase opens.
