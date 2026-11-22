# TASK-812: Fail-closed Windows CI skip accounting

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User authorized autonomous correction of GitHub test failures and progress toward merge; real Codex execution and Electron sandbox verification are deferred.

## Requirement IDs
REQ-090, REQ-092, REQ-093, REQ-095, REQ-096

## Objective
Fix the deterministic Windows CI skipped-test count mismatch without permitting unrelated skips. Preserve the distinct production and integration acceptance gates.

## Context Pack
- docs/delivery/tasks/TASK-811.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-812.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- .github/workflows/application-gates.yml
- scripts/check_vitest_summary.py
- tests/test_check_vitest_summary.py
- docs/verification/quality-gate.md

## Forbidden Files
Application code, credentials, databases, archived evidence, other worktrees, remote mutations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The Vitest summary checker accepts exact file and assertion title skip declarations. Each declared assertion must be observed once as skipped; unapproved skips, ambiguous specifications and missing declarations fail closed.

## Data Constraints
Synthetic test reports only; never log secrets or access production credentials.

## UI Constraints
No user interface changes.

## Implementation Requirements
Preserve existing PostgreSQL-only file exceptions and count gate. Declare the three explicitly opt-in native credential tests individually and require passing tests in their files. Do not treat deferred native tests as passed.

## Test Requirements
First reproduce the missing option and negative cases. Test unknown and missing skips, duplicate/unsafe declarations and original checks. Run the actual Windows unit report and checker with CI arguments, contract gate, Python governance tests and applicable documentation checks.

## Acceptance Criteria
All explicitly declared skips must be observed exactly once; all other skips outside the existing database exceptions fail. CI configuration matches the actual default unit suite and no production acceptance is inferred.

## Done Definition
Record actual local command results and outstanding CI limitations; remote CI remains planned until actually run.

## Risks
Native credential integration is not established by skipped tests; a local test report cannot prove GitHub Actions has run.

## Output Required
Scoped checker and workflow fix, negative tests and evidence in this pack.

## Local evidence and limitations (2026-11-22)

- The previous CI parameters rejected the actual unit JSON report because it contained nine rather than six skipped tests. The three additional assertions require explicit native credential opt-in; their names and files are now individually accounted for.
- Test-first reproduction: the exact-skip acceptance test failed on the missing checker option. Nine focused checker tests passed after implementation, including missing, unexpected, duplicated, ambiguous and unsafe declarations.
- Windows unit: 174 files, 706 passed, nine skipped; the new CI checker passed the actual JSON report. The old parameters rejected that same report. Windows contract: 44 passed, zero skipped. The separately gated native tests are not claimed as passed by this run.
- Python governance suite: 38 passed. Real Codex execution and Electron sandbox acceptance remain deferred. This local result is not a GitHub Actions run and does not establish merge readiness.
