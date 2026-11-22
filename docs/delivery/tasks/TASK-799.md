# TASK-799: Fail closed without owned process-tree termination proof

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user requested running cancellation to release its lease only after the whole process tree is confirmed terminated.

## Requirement IDs
REQ-031, REQ-032, REQ-033, REQ-049, REQ-090, REQ-098

## Objective
Remove the legacy adapter assumption that a termination command returning or root PID disappearing proves the entire owned process tree has exited.

## Context Pack
- docs/delivery/tasks/TASK-793.md
- docs/delivery/tasks/TASK-795.md
- docs/delivery/tasks/TASK-798.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-799.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/tests/cancel.contract.test.ts
- docs/adapters/codex.md

## Forbidden Files
Other application files, archive evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The legacy PID-based cancellation entry has no owned-process handle, incarnation-bound identity or safely cancellable transactional lease release. It must return incomplete before interrupt, OS termination or lease release for every request. RPC interruption, taskkill and injected boolean callbacks are not ownership or termination proof. A future production implementation needs a separate OS-owned supervisor and deadline/fencing-aware transaction.

## Data Constraints
An incomplete cancellation does not change the original Attempt or lease. Concurrent/repeated requests cause no side effects. The future real implementation must satisfy the existing 15-second overall and 5-second graceful-interrupt limits; this unavailable port does not start timers.

## UI Constraints
No UI change. Unproven termination cannot be presented as CANCELLED.

## Implementation Requirements
Replace the unsafe legacy PID cancellation implementation with a fail-closed, side-effect-free result until a separately implemented owned-process supervisor and transactional lease-release protocol exist. Preserve the public input shape for callers but do not invoke renderer- or caller-supplied callbacks. Do not claim cancellation is implemented or that a fake verifier proves OS containment.

## Test Requirements
Demonstrate the old unsafe default in a failing regression. Test absent, forged, stale, repeated and concurrent PID requests with callbacks that must never execute; verify no interrupt, termination or lease release occurs. Record that older simulated-success tests exercised an unsafe contract and are superseded, not evidence of real cancellation. Run build/lint/typecheck, full unit/contract and governance gates.

## Acceptance Criteria
No interrupt, termination, lease release or completed cancellation occurs through the legacy PID port. A future real implementation must independently verify ownership and the whole process tree. No real Codex operation is started.

## Done Definition
Document remaining concrete Windows owned-process tree implementation and end-to-end integration; this task is not merge readiness.

## Risks
An arbitrary injected verifier can lie. A mere Promise timeout cannot cancel a later OS kill or lease release. PID reuse and changes in lease fencing make the prior in-memory deduplication insufficient. Real cancellation remains unavailable pending an OS-owned process tree and transactional, incarnation/fencing-bound release.

## Output Required
Tests and Adapter contract writeback with exact remaining gaps.

### Scope correction after independent review

Review found that verifying only after termination could still kill an
unrelated reused PID, an asynchronous lease-release callback could complete
after timeout, and cached results were not bound to a process incarnation or
lease fence. No production owner exists to validate those conditions. This
pack therefore deliberately leaves the legacy cancellation entry unavailable,
with zero side effects, instead of enabling a fake proof seam.

### Local verification — 2026-11-22

On Windows Node 22.19.0 / npm 10.9.3, production build, lint and typecheck
passed. Unit tests reported 624 passed and six PostgreSQL-environment skips;
the contract suite reported 44 passed. Skips are not passes. The contract
count differs from the prior run because simulated successful PID-only
cancellation cases were replaced with fail-closed tests; those prior cases
are not evidence of real process-tree termination. The new tests cover
forged PIDs and callbacks, 100 concurrent requests with no effects, and a real
temporary unrelated child remaining alive. Independent read-only re-review
found no new blocker in this scoped safety change; it did not run tests.

Real running cancellation, owned-process lifetime, Git/OS confinement,
transactional release and end-to-end acceptance remain open. Real Codex,
Electron sandbox and remote CI were not run.
