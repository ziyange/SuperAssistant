# TASK-841: Correct DSH probe signal-exit observation

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user authorized autonomous repair of DSH cancellation failures and continuation toward the merge gate.

## Requirement IDs
REQ-077, REQ-078, REQ-090, REQ-093, REQ-098

## Objective
Recognize an already observed signal exit in the DSH fixture probe without claiming that an unobserved process has terminated or changing any deadline.
Also fail closed on a fixture process that cannot be spawned, without an
unhandled child or stdin error and without reporting it as reaped.

## Context Pack
- docs/delivery/tasks/TASK-840.md
- docs/adapters/dsh.md
- docs/security.md
- docs/operations.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-841.md
- docs/delivery/tasks/TASK-840.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/dsh.md
- packages/dsh-adapter/src/dsh-probe.ts
- packages/dsh-adapter/tests/dsh-probe.test.ts

## Forbidden Files
All other repository files, real DSH execution or user credentials, production route activation, timeout or test threshold reductions, real Codex, Electron sandbox security verification, merge and release.

## Interfaces / Contracts
An exit is observed only for a successfully spawned child if exitCode or signalCode is non-null or a real exit event is received. A spawn failure or timeout without observed exit remains failure. This fixture observation does not prove whole process-tree termination or release a Lease.

## Data Constraints
Only disposable fixtures and processes started by the test are permitted. Do not inspect or terminate unrelated processes.

## UI Constraints
No UI or IPC change.

## Implementation Requirements
First add failing deterministic real-child regressions for a signal exit already observed before waiting and for a missing executable. Cover a still-running child as a negative case, preserve the existing kill ladder and its timeouts, and avoid weakening cancellation guarantees.

## Test Requirements
Run targeted DSH probe tests, build, lint, typecheck, full unit and contract tests using CI's original worker count and assertions, affected desktop tests and governance gates; independently review the result.

## Acceptance Criteria
An already observed signal exit is recognized; a live or unobserved process is never reported reaped. Existing kill-ladder tests and all required gates pass with no relaxed limits.

## Done Definition
Record actual results and failures; no claim of production DSH conformance, H1 or merge acceptance.

## Risks
Direct-child exit is not process-tree termination proof. Signal observation does not authorize Lease release.

## Output Required
Corrected exit observation, real-process regression, facts and verification evidence.

## Local evidence and remaining limits
The signal regression first failed with a real child whose `exitCode` was null
and `signalCode` was SIGTERM, then passed after checking both. A missing binary
first produced an unhandled spawn error and no `LAUNCH_FAILED`, then passed
with explicit failure and `reaped=false`. All six targeted DSH probe tests
passed. Independent static review found no confirmed Critical or Important
issue in scope; it noted that errors arriving after process exit but before
stdio close have no dedicated regression, so complete transport capture is not
claimed. Direct-child observation never proves whole-tree termination.

On the combined working candidate: build/lint/typecheck passed; unit 1143
passed with 9 CI-allowlisted skips, contract 50 passed without skips; real
Electron functional tests 2 passed and browser E2E 9 passed. Governance scanned
398 Markdown files, checked 188 Task Packs and 41 governance tests, and the
history checker validated 19 contiguous scopes. The shared Electron SQLite
file hash was unchanged. The current candidate still lacks remote CI evidence,
production execution integration, and full merge acceptance.

Subsequently, commit `a05f4a5bc4107236aac38ba4614a8003922205da` passed
GitHub documentation run 45263972980 and application run 45263972944,
including the Windows and PostgreSQL 16 jobs. This is scoped task evidence,
not H1 or merge acceptance.
