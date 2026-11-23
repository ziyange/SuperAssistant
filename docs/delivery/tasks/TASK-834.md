# TASK-834: Verify successive task audit boundaries in CI

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: user authorized fixing GitHub test failures and autonomous remediation toward merge.

## Requirement IDs
REQ-090, REQ-092, REQ-093, REQ-096

## Objective
Fix the reproducible documentation CI failure caused by applying TASK-823's allowlist to later authorized tasks, without weakening audit-chain integrity or task file boundaries.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-833.md
- docs/verification/quality-gate.md
- docs/operations.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md

## Allowed Files
- docs/delivery/tasks/TASK-834.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- .github/workflows/docs-gates.yml
- scripts/verify_runtime_trace.py
- scripts/check_task_audit_history.py
- tests/test_verify_runtime_trace.py
- tests/test_check_task_audit_history.py

## Forbidden Files
Other paths, existing archived evidence, production data, user projects, real Codex or Electron sandbox verification, remote operations and merge.

## Interfaces / Contracts
Introduce an optional exclusive end anchor for a task range; both start and end must be genuine matching committed Task Pack write transactions with matching results, in audit order. The complete audit chain and transaction integrity remain checked on every run. Check all contiguous audited task ranges from TASK-823 through the current task using each task's actual allowlist; absence, ambiguity, out-of-order/repeated markers or writes outside their scope must fail closed. Historical pre-TASK-823 scope is not newly asserted.

## Data Constraints
Only local repository audit history and synthetic test records; never mutate historical evidence or ignore a failed entry.

## UI Constraints
No UI changes.

## Implementation Requirements
Reproduce the current CI command failing after a later task. Add a bounded task range while retaining global chain and transaction checks. Add a fail-closed CI entry point which identifies each successive original task-start marker, verifies every contiguous range and validates the final open range. Wire the workflow to the same entry point used locally.

## Test Requirements
Write and observe red tests before implementation. Cover valid successive tasks, an out-of-scope write inside each range, missing, tampered, repeated or out-of-order anchors, pending and tampered historical records, and future tasks. Run governance tests, actual repository history check, application checks if impacted, and runtime audit.

## Acceptance Criteria
The actual CI-equivalent history command exits 0 only when all task boundaries and global audit integrity pass. Negative controls must fail and later task writes must not be checked against older task allowlists.

## Done Definition
Record commands and outcomes, synchronize operations guidance and commit. This is not remote CI success or merge acceptance.

## Risks
Task Packs are current documents rather than immutable historical snapshots; changed historical allowlists can change results. This check cannot prove unrecorded writes; compare actual Git changes separately. No claim of full pre-TASK-823 history validation.

## Output Required
Range-aware verifier, CI history runner, failure-mode tests and truthful local evidence.

## Local Evidence
- The workflow's previous TASK-823 command returned Exit 2 on valid later
  task writes. A new bounded-range regression failed before implementation.
- `python scripts/check_task_audit_history.py` checked 12 consecutive task
  scopes through TASK-834 and returned Exit 0. Rechained out-of-scope writes,
  missing history, altered hashes, pending transactions and reordered task
  groups were rejected by the regression tests.
- The local governance suite passed 41 tests; documentation scan covered 391
  files, all Task Packs, traceability and schemas passed, and the current Goal
  runtime trace returned Exit 0. This changes no application code. The previous
  full application result predates this governance-only patch.
- These checks use current Task Pack contents, not archived snapshots; they do
  not discover unlogged writes. GitHub Actions has not run on this commit and
  is not reported as PASS. No merge or production acceptance is implied.
