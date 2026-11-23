# TASK-829: Preserve unverified DSH process ownership

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: standing user authorization to repair merge blockers, require whole-tree termination and prevent duplicate Attempts. DSH Shell, filesystem, network and plugin capabilities must not be disabled by this task.

## Requirement IDs
REQ-027, REQ-031, REQ-033, REQ-049, REQ-077, REQ-078, REQ-090, REQ-098

## Objective
Prevent the disconnected DSH process host from asserting whole-tree cancellation from a caller boolean or root exit and from reusing an Attempt identity after root exit without reconciliation.

## Context Pack
- docs/delivery/tasks/TASK-828.md
- docs/delivery/tasks/TASK-824.md
- docs/adapters/dsh.md
- docs/api/sai.md

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
- docs/delivery/tasks/TASK-829.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/dsh.md
- packages/dsh-adapter/src/dsh-process-host.ts
- packages/dsh-adapter/tests/dsh-process-host.test.ts

## Forbidden Files
Other paths, archive evidence, DSH source checkout, capability broker or policy implementations, production routing, user projects and credentials, other worktrees, real Codex, Electron sandbox verification, external operations and merge.

## Interfaces / Contracts
Keep existing method signatures. The legacy in-memory host lacks a trusted whole-tree handle and durable reconciliation: `cancel` and `cancelProcess` must not claim cancellation or signal a process on untrusted evidence. Retain a per-instance Attempt tombstone after root exit or spawn failure, so this host cannot start the same Attempt again. This in-memory tombstone does not replace durable SQLite idempotency or prove a process tree has stopped. Brokered Shell, filesystem, network and plugin behavior is unchanged.

## Data Constraints
Only test-owned synthetic handles and disposable child processes; cleanup must use retained test handles. No user process, real credential, DSH source or SQLite database may be touched. Never release a Lease or redispatch based on root exit alone.

## UI Constraints
No renderer, IPC or UI changes; DSH remains a disabled compatibility probe.

## Implementation Requirements
Reproduce the legacy bool-success path and the same-Attempt reuse after child exit. Fail closed without invoking untrusted callbacks or sending root-only termination signals. Preserve Attempt identity in the host after exit and spawn error; keep existing start shape. Do not claim root or descendant termination, durable recovery, or production capability.

## Test Requirements
Observe red regressions before the fix. Verify booleans and forged callbacks have no effect, root exit never permits same-Attempt reuse in the host, failed spawn remains non-dispatchable, and a real test-owned child is not signalled by the unavailable cancellation API; the test cleanup must terminate that exact retained child. Run affected tests, lint, typecheck, build, full unit, contract, independent review and governance.

## Acceptance Criteria
No legacy DSH host cancellation reports verified completion or sends a signal; no second start occurs for an Attempt previously registered in the same host even after root exit. All DSH capability broker implementations remain unchanged. No real DSH process or user data is accessed.

## Done Definition
Commit scoped code, tests and facts with honest evidence; running DSH cancellation remains unavailable until trustworthy whole-tree ownership, durable reconciliation and atomic fenced release are implemented.

## Risks
The fail-closed host cannot stop a real process. Host-local identity retention is not durable across restart, is not an OS process owner, and cannot be used as proof of safe Lease release.

## Output Required
Fail-closed legacy host and in-memory Attempt retention with real fixture and regression evidence.

## Local verification
Three regressions first reproduced fabricated callback success, reuse after root exit and false whole-tree completion from a root signal. The revised host keeps its local Attempt reservation and declines both cancellation methods without invoking callbacks or signalling. A real disposable child remained alive until the test explicitly terminated and awaited its own retained handle. The DSH package suite passed 25 tests; the full Windows host unit suite passed 1,064 with nine skipped across 182 files, and fake-service contracts passed 49/49. Build, lint and typecheck passed. Skips are not passes. Independent static review found no substantiated Critical or Important new issue and did not run tests; it noted that `started: true` can precede asynchronous spawn failure and the host lacks an external UNKNOWN notification. The initial test patch failed on context, leaving audit transaction `task-829-write-004` pending; the file was inspected, the same authorized edit completed once, and Goal runtime verification subsequently returned Exit 0. These results do not establish durable reconciliation, whole-tree ownership, DSH availability or merge readiness.
