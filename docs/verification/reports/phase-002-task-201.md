# PHASE-002 TASK-201 verification report

## Scope

Implements only goal action classification, immutable ProposalVersion digest,
idempotent AuthorizationGrant persistence, deterministic preflight comparison,
and a bounded desktop Proposal Review projection. The approved exact scope
expansion registers migration 003 and typed proposal IPC schemas. No Codex
execution, process launch, command, network, filesystem write, worktree,
credential retrieval, Task, WorkItem, Attempt, lease, or Outbox path exists.

## TDD evidence

The initial targeted runs failed because the routing, proposal, authorization,
preflight, repository, service, and review modules did not exist. The tests
were then made green with the minimal implementations. A subsequent typecheck
found response-union compatibility and SQLite row-decoding defects; both were
corrected before the final gate.

## Required behavior evidence

- `READ` is `READ_ONLY` and has no authorization affordance.
- Any declared file write, command, network, external write, or credential use
  is `SIDE_EFFECTING`.
- Proposal digest format is `sha256:<lowercase-hex>` and deterministic for the
  same canonical JSON values.
- Proposal rows reject mutation; duplicate actor/idempotency confirmation
  returns one existing Grant.
- Project snapshot or Grant-state change returns `STALE`; stale UI confirmation
  is disabled.

## Final command evidence

- `npm run lint` — PASS.
- `npm run typecheck` — PASS across desktop, domain, persistence, and adapter.
- `npm run test:unit` — PASS: 26 files, 99 tests.
- `npm run test:contract` — PASS: 26 files, 94 tests before the second
  exact scope expansion; all changed domain and desktop tests were rerun
  afterward through the final unit/E2E gates.
- `npm run test:e2e` — PASS: two flows, including stale preflight confirmation
  disabled before any side effect.
- `npm run build` — PASS.
- documentation links (63 files), Task Pack, traceability, all five schemas, and
  runtime trace (`exit_code: 0`, one recorded approved expansion) — PASS.

Real Codex smoke is not applicable to this Task and remains opt-in only.
