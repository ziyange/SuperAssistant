# TASK-801: Isolate review-only Git baseline checks

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user requested continued desktop implementation, baseline-bound worktrees and remediation through merge readiness.

## Requirement IDs
REQ-006, REQ-021, REQ-024, REQ-025, REQ-031, REQ-090, REQ-098

## Objective
Move the review-only goal draft's synchronous Git baseline query out of Electron's main thread without weakening its canonical-path or full-commit validation.

## Context Pack
- docs/delivery/tasks/TASK-797.md
- docs/delivery/tasks/TASK-798.md
- docs/delivery/tasks/TASK-800.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/architecture.md
- docs/operations.md
- docs/ux.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-801.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/async-project-baseline.ts
- apps/desktop/src/main/local-goal-draft.ts
- apps/desktop/tests/main/async-project-baseline.test.ts
- apps/desktop/tests/main/async-project-baseline-timeout.test.ts
- apps/desktop/tests/main/local-goal-draft.test.ts
- docs/adapters/codex.md
- docs/ux.md

## Forbidden Files
Other files, archive evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The worker calls the existing compiled readProjectHead implementation, rather than duplicating its Git policy. The caller accepts only a complete lowercase 40- or 64-hex commit and rechecks current Project/Agent authority and in-memory draft identity after awaiting it. This entry point remains review-only.

## Data Constraints
At most two baseline worker threads may be active. Literal UNC/device Project paths are rejected on Windows. Requests time out after six seconds and attempt worker termination; a blocked worker retains its slot until exit. No new writes, Grant or Attempt result.

## UI Constraints
Slow Git checks do not synchronously block the Electron main event loop. Failure returns a sanitized unavailable response; no private path or error is exposed.

## Implementation Requirements
Reuse the existing compiled Git baseline implementation in a worker, with bounded concurrency and fail-closed timeout/error handling. Recheck draft membership, expiration and authority after asynchronous work. Do not present worker termination or a drive-letter path as proof of OS I/O cancellation or local storage.

## Test Requirements
First show a missing asynchronous boundary. Test an actual temporary Git repository, invalid/non-Git paths, full commit identity and event-loop responsiveness. Run desktop main build before tests so worker imports the real compiled module; then lint, typecheck, full unit/contract/build and governance gates.

## Acceptance Criteria
Review-only draft creation and review use the bounded asynchronous baseline worker, preserve exact existing Git validation and fail closed on errors or saturation. The existing read-only Git subprocess is invoked; no Project modification, Grant, Attempt or Codex execution is started.

## Done Definition
Record tests and remaining package/Electron integration, mapped drives and kernel I/O limitations. This increment is not merge readiness.

## Risks
Worker termination cannot guarantee interruption of a blocked kernel operation or termination of its Git subprocess; its slot remains occupied until the worker exits. Windows drive letters may map to network shares. Real Electron packaged-worker behavior is deferred and must not be reported as passed.

## Output Required
Source, tests and targeted UX fact writeback.

Scope note: the Adapter fact document is included explicitly so the earlier
TASK-800 statement about review-time synchronous Git checks can be corrected.
The separate timeout test file is included for a controlled worker-double
test of saturation, late exit and slot recovery; it is not OS I/O proof.

### Implementation and verification — 2026-11-22

The review-only goal entry now uses a bounded worker that invokes the existing
compiled Git baseline function. The caller rechecks authority, expiry and
draft ownership after asynchronous observations. Real temporary-Git tests
cover exact commit and invalid paths; a controlled Worker double covers
two-slot saturation, timeout, late completion and slot release. Independent
read-only review found no new blocking issue, but did not run tests.

On Windows Node 22.19.0 / npm 10.9.3, production build, lint and typecheck
passed; the full unit suite reported 627 passed and six PostgreSQL-environment
skips, and contract tests reported 44 passed. The late-normal-exit assertion
was tightened after that run and is reverified separately before completion.
The six skips are not passes. Real kernel-stalled Git cleanup, mapped drives,
packaged Electron workers, real Codex and Electron sandbox remain unverified.
