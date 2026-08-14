# TASK-202: Implement the App Server execution lifecycle

## Status

COMPLETED

PHASE: PHASE-002

MAX_ITERATIONS: 6

user_confirmed: true

## Requirement IDs

REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-090, REQ-091, REQ-093, REQ-096, REQ-098

## Objective

Activate one authorized Work Item through the full SAI lifecycle with atomic Task/Attempt/outbox creation, Codex App Server execution, ordered deduplicated events, status/result reconciliation, confirmed cancellation, and no duplicate execution after failure or restart.

## Context Pack

- `docs/api/sai.md`
- `docs/adapters/codex.md`
- `docs/orchestration.md`
- `docs/decisions/ADR-003-authoritative-state-and-delivery.md`

## Must Read

- `AGENTS.md`
- `docs/requirements.md`
- `docs/data-model.md`
- `docs/api/sai.md`
- `docs/adapters/codex.md`
- `docs/orchestration.md`
- `docs/operations.md`
- `docs/decisions/ADR-003-authoritative-state-and-delivery.md`
- `docs/decisions/ADR-004-task-worktrees.md`

## Allowed Files

- AGENTS.md
- package.json
- docs/README.md
- docs/delivery/README.md
- docs/delivery/phase-002.md
- docs/delivery/tasks/TASK-202.md
- packages/domain/src/task.ts
- packages/domain/src/work-item.ts
- packages/domain/src/execution-attempt.ts
- packages/domain/src/execution-envelope.ts
- packages/domain/src/resource-lease.ts
- packages/domain/src/ports/execution-port.ts
- packages/domain/src/ports/execution-repository.ts
- packages/domain/src/index.ts
- packages/domain/tests/task.test.ts
- packages/domain/tests/execution-attempt.test.ts
- packages/domain/tests/resource-lease.test.ts
- packages/persistence/src/sqlite/migrations/004-execution.sql
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/src/repositories/inbox-repository.ts
- packages/persistence/src/repositories/resource-lease-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/execution-transaction.test.ts
- packages/persistence/tests/outbox-inbox.test.ts
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/src/reconciliation.ts
- packages/codex-adapter/src/protocol.ts
- packages/codex-adapter/src/error-map.ts
- packages/codex-adapter/src/index.ts
- packages/codex-adapter/tests/execution.contract.test.ts
- packages/codex-adapter/tests/reconciliation.contract.test.ts
- packages/codex-adapter/tests/cancel.contract.test.ts
- packages/codex-adapter/tests/fixtures/fake-app-server.mjs
- packages/codex-adapter/tests/fixtures/execution-events.json
- apps/desktop/src/main/orchestrator.ts
- apps/desktop/src/main/outbox-dispatcher.ts
- apps/desktop/src/main/recovery-service.ts
- apps/desktop/src/main/task-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/tests/main/orchestrator.test.ts
- apps/desktop/tests/main/recovery-service.test.ts
- tests/fixtures/codex-smoke-repository/README.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/reports/phase-002-task-202.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Original Project workspace mutation, unapproved command/tool/network action, provider Thread/Turn in product tables or UI, exactly-once claims, redispatch while UNKNOWN/RECONCILING, and cancellation without process termination.

## Interfaces / Contracts

Implement all eight ExecutionPort operations: `describe`, `health`, `start`, `resume`, `cancel`, `status`, `events`, and `result`. Every command/event carries request, idempotency, Task, Work Item, Attempt, trace, sequence, protocol/Agent/Function versions, authorization reference, Project snapshot version, and resource fencing token.

## Data Constraints

Task, Work Item, ExecutionAttempt, lease, and outbox are created atomically. Commands/events are at-least-once. Inbox deduplicates provider/event identity; sequence is monotonic per Attempt. Same-goal retry creates a new Attempt. Changed objective/responsibility creates a remediation Work Item. UNKNOWN always transitions through RECONCILING before dispatch eligibility.

## UI Constraints

This pack exposes only typed progress data for TASK-203. Provider-native identifiers, raw unsafe output, and premature completed state remain hidden. Cancel state differentiates requested, terminating, terminated, and lease released.

## Implementation Requirements

- Acquire and validate the worktree/resource lease before dispatch.
- Map SAI start/resume/cancel/status/events/result to stable App Server operations inside the adapter only.
- Reconcile external execution identity and status on every uncertain response or restart.
- Treat late/duplicate/out-of-order events deterministically.
- Terminate worker and descendant processes before releasing the lease on cancel.

## Test Requirements

- Fake-server contracts for success, duplicate command, lost start response, duplicate/out-of-order events, disconnect, crash, restart, failure, and cancel race.
- Prove repeated confirmation/dispatch creates one initial Attempt.
- Prove restart reconciliation does not send a second start while outcome is unknown.
- Prove cancellation terminates the process tree and releases the fencing lease.
- Run domain, repository, contract, recovery, lint, typecheck, build, and opt-in disposable real Codex smoke.

## Acceptance Criteria

- `SCN-EXEC-IDEMPOTENT` creates one Attempt and one external execution.
- `SCN-RECOVERY-RECONCILE` survives platform or App Server restart without duplicate work.
- `SCN-CANCEL-TERMINATE` confirms process termination and lease release.
- `SCN-WORKTREE-ISOLATION` proves the original workspace remains unchanged.
- Every Attempt event and result is attributable and replay-safe.

## Done Definition

The full fake lifecycle and failure matrix passes, opt-in real smoke is honestly reported, no unauthorized/original-workspace write occurs, facts reflect observed contracts, and the draft is re-approved before implementation.

## User-approved evidence exception

On 2026-08-14, the user explicitly approved skipping the unavailable real Codex
smoke in order to continue with other development. The enabled smoke command was
implemented and attempted; its exact environment failure is recorded in the
TASK-202 report. This exception is not a real-runtime pass and must remain a
known PHASE-002 closeout risk.

## Risks

`SECURITY_PERMISSION 0.600` is active and confirmed. Duplicate side effects, confused authorization, stale fencing, process escape, and uncertain outcomes are critical. `CONCURRENCY_RACE 0.526` remains controlled even in the single-task phase through lease fencing and worktree isolation.

This approved revision follows TASK-201 migration `003-proposal-authorization`;
execution waits for PHASE-001 archival and TASK-201 PASS.

## Approved scope expansion

The user authorized opening PHASE-002 and beginning TASK-202. The five execution
fact files above may be updated only to record the active phase, Task status, and
this bounded expansion; no product or engineering contract changes are authorized
by this expansion.

The user additionally authorized `package.json` solely to replace the inherited
Codex smoke placeholder with the explicit, disposable, read-only smoke command
required by this Task Pack. It may not alter dependencies or unrelated scripts.

## Output Required

Return changed files, SAI/App Server mapping matrix, failure-injection results, Attempt/outbox/inbox evidence, cancellation process proof, worktree hashes, smoke status, and the phase report path.
