# TASK-745: Fail closed on unconfirmed Codex cancellation

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 safety remediation.

## Requirement IDs
REQ-029, REQ-030, REQ-031, REQ-033, REQ-090, REQ-093, REQ-098

## Objective
Prevent the synthetic Codex cancellation adapter from releasing a lease or claiming completion without trusted process termination and successful lease release.

## Context Pack
- docs/adapters/codex.md
- docs/security.md
- docs/verification/reports/phase-007-task-744.md
- packages/codex-adapter/tests/cancel.contract.test.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/adapters/codex.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/src/worker.ts

## Allowed Files
- docs/delivery/tasks/TASK-745.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-745.md
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/tests/cancel.contract.test.ts

## Forbidden Files
Do not connect the synthetic transport to real Codex, change SQLite schema, alter external permissions, weaken sandbox settings, execute real Codex or modify archived evidence.

## Interfaces / Contracts
Cancellation receives a positive safe process ID and trusted termination and release operations supplied by control-plane composition. Caller-supplied booleans cannot prove termination or release. Failure or absence of termination retains the lease and returns CANCELLATION_INCOMPLETE. A failed interrupt still attempts termination but retains the lease pending reconciliation. Only a successful interrupt, confirmed termination and successful release may return complete.

## Data Constraints
Tests use fake transport and in-memory observations only. No real process tree, user data or external effects.

## UI Constraints
No renderer or IPC changes.

## Implementation Requirements
Reproduce early release and forged completion first, then implement fail-closed sequencing. Catch termination and release failures without reporting success. Do not claim the synthetic transport is a real App Server implementation.

## Test Requirements
Cover termination failure, invalid or missing process ID, forged booleans, failed interrupt, failed release and successful order; run build, lint, typecheck, full unit and contract suites and anchored runtime trace. No Electron sandbox validation.

## Acceptance Criteria
The release operation is never called without confirmed termination; missing evidence or any failure cannot yield complete. Failed interrupt preserves the lease even if termination succeeds.

## Done Definition
Record red/green tests, full regression and remaining real process evidence and durable release requirements.

## Risks
Injected termination and release functions are trusted only inside the main/control plane; this test-only transport is not production Codex protocol evidence.

## Output Required
docs/verification/reports/phase-007-task-745.md
