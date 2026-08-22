# PHASE-004 acceptance and PHASE-005 handoff

Accepted locally on 2026-08-22 after TASK-401–408 evidence and the final
TASK-406 gate. PHASE-005 may open on `codex/phase-005-monitoring` in a fresh
task worktree, beginning with `TASK-501`.

The handoff retains the existing known limitation: real Codex smoke evidence
is not a substitute for deterministic fake-Adapter and local E2E evidence.
It remains an explicit, user-approved exception until a disposable-repository
smoke run has verifiable evidence.

Next-phase packs `TASK-501`–`TASK-505` are structurally valid,
`APPROVED`, and `user_confirmed: true`. PHASE-005 starts by reading the
current facts and TASK-501, then follows its exact-file allowlist. No merge,
push, remote CI or release is implied by this local acceptance.
