# TASK-828: Fail closed on unverified DSH cancellation

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user authorized fixing merge blockers and requires a process tree to be confirmed terminated before Lease release. DSH Shell, filesystem, network and plugin capabilities must not be disabled by this task.

## Requirement IDs
REQ-031, REQ-033, REQ-077, REQ-078, REQ-090, REQ-098

## Objective
Prevent the disconnected legacy DSH adapter service from releasing a Lease or claiming completed cancellation solely on a caller-provided boolean.

## Context Pack
- docs/delivery/tasks/TASK-799.md
- docs/delivery/tasks/TASK-824.md
- docs/adapters/dsh.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-828.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/dsh.md
- apps/desktop/src/main/dsh-adapter-service.ts
- apps/desktop/tests/main/dsh-adapter-service.test.ts

## Forbidden Files
Other paths, existing archive evidence, DSH source checkout, capability broker or policy implementations, production routing, user projects and credentials, other worktrees, real Codex, Electron sandbox verification, remote operations and merge.

## Interfaces / Contracts
Keep the existing `cancel` call shape. The disconnected legacy cancellation port has no trusted process ownership, complete process-tree termination proof or atomic fenced release; it returns `{ cancelled: false, leaseReleased: false }` without invoking the caller, host or Lease callbacks. It must not report completion from root PID disappearance or a boolean. The `executeCapability` behavior is unchanged: approved Shell, filesystem, network and plugin operations remain subject to the existing broker and policy; this task does not disable any capability.

## Data Constraints
Use synthetic identifiers and test-only callbacks. Do not access user processes, DSH checkout state, real credentials or real databases. No callback, Lease release or external effect occurs through the legacy cancellation method.

## UI Constraints
No UI, renderer or IPC changes. The DSH adapter remains a disabled compatibility probe rather than a routable production Function.

## Implementation Requirements
First reproduce the unsafe path: a host and caller return true without terminating a process and the service releases a Lease. Replace that legacy path with a fail-closed result; preserve the capability broker behavior. Treat old callback-based simulated success as superseded evidence, not a real process-tree proof. A future separate task must connect a trustworthy DSH owner, process-tree exit evidence and an atomic fence-bound release before reporting cancellation.

## Test Requirements
Run a failing no-effect regression before the fix. Verify true, false, rejected, forged and repeated callbacks are not invoked; no host or Lease method runs; capability allow and deny paths remain unchanged. Run affected tests, lint, typecheck, build, full unit and contract, independent review and governance.

## Acceptance Criteria
The legacy adapter cancellation cannot terminate, release, or report completed cancellation from synthetic callbacks. All four DSH capability types retain their existing broker-gated behavior. No real DSH or Codex process is launched.

## Done Definition
Commit the scoped safety fix and verification evidence; this does not implement running DSH cancellation, enable DSH or establish merge readiness.

## Risks
Failing closed leaves cancellation unavailable until trusted ownership and fenced release are implemented. A root-only process exit is insufficient when descendants may remain.

## Output Required
Fail-closed legacy service cancellation, regression tests, updated DSH engineering facts and exact local results.

## Local verification
The regression first demonstrated that a caller returning `true` caused the disconnected legacy service to report cancellation and release a Lease. After the fix seven targeted cases passed, including repeated false/rejected/true callbacks and all four broker-approved capability types. The Windows host full unit suite passed 1,063 with nine skipped across 182 files; fake-service contracts passed 49/49. Build, lint, typecheck, documentation scan and runtime verification passed. Nine skips are not passes. Independent static review found no substantiated Critical or Important issue and did not run tests; each capability's individual deny path was not separately parameterized. The prior synthetic callback-success test is superseded and does not establish real termination. DSH remains a disabled compatibility probe, and real running cancellation, process ownership and fenced release remain unimplemented.
