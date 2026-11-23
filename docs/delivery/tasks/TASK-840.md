# TASK-840: Reject invalidated drafts at protected registration commit

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: continuing the user's approved immutable Proposal and fake App Server integration work; real Codex and Electron sandbox security verification remain deferred.

## Requirement IDs
REQ-020, REQ-021, REQ-022, REQ-024, REQ-025, REQ-027, REQ-090, REQ-095, REQ-098

## Objective
Prevent protected registration from committing when the originating main-process goal draft is discarded or expires during asynchronous ciphertext authentication.

## Context Pack
- docs/delivery/tasks/TASK-839.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-840.md
- docs/delivery/tasks/TASK-839.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/local-goal-draft.ts
- apps/desktop/src/main/protected-proposal-registry.ts
- apps/desktop/src/main/protected-proposal-intake.ts
- apps/desktop/tests/main/local-goal-draft.test.ts
- apps/desktop/tests/main/protected-proposal-registry.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
Other repository files, real user projects or credentials, production route activation, migration 033 registration, real Codex, Electron sandbox security validation, merge and release.

## Interfaces / Contracts
Inside the registration transaction, an additional synchronous main-owned draft check rejects absent, expired or changed draft snapshots. It cannot authenticate ciphertext, approve a Proposal or dispatch work; existing independent authentication and authority checks remain mandatory. A post-commit draft discard may still leave an encrypted identity and cannot be interpreted as successful staging.

## Data Constraints
Use disposable SQLite and Git projects and synthetic vaults. Do not write plaintext goal or secrets into persistent storage or logs.

## UI Constraints
No UI or IPC wiring or production execution activation.

## Implementation Requirements
First demonstrate the stale-draft registration defect with an executable failing test. Add a synchronous identity and lifetime check inside the registration transaction, covering discarded, expired and forged draft sources. Retain current uncertain-key handling and independent Proposal authentication.

## Test Requirements
Run targeted real-SQLite and temporary-Git tests, independent security review, build, lint, typecheck, full unit and contract tests, desktop and browser E2E, and ordered governance checks. Do not use real Codex or Electron sandbox security verification.

## Acceptance Criteria
Discard or expiry during asynchronous registration authentication creates no protected binding, authority reference, Grant or Attempt. Authentic unchanged drafts still stage successfully. Forged draft sources cannot satisfy the lifetime check. Unknown key outcomes remain preserved.

## Done Definition
Record exact local and CI evidence, known limitations, and any unresolved failures. Do not declare H1, production execution or merge acceptance.

## Risks
Draft validity is a restrictive check only; it does not establish approval. Cancellation after registration commit remains a separate race and encrypted identities are not proof of staging or authorization.

## Output Required
Guarded protected registration, regression tests, synchronized facts and verifiable local and remote evidence.

## Current verification
The previous implementation reproduced an unwanted binding after draft discard;
after the transaction guard, the related regression passes. Security review
also found and led to fixes for mutable TypeScript-private state and synchronous
clock reentrancy. A subsequent independent static review found no confirmed
Critical or Important issue within this scope; main-process compromise remains
outside this boundary. Targeted suites passed 46 tests, build/lint/typecheck
passed. A prior concurrent build/test run had five authorization failures;
their cause is unproven and they passed in the later serial run.

Full unit run failed: 1139 passed, 2 failed, 9 skipped. The failures are
`dsh-probe.test.ts` reporting `reaped=false` after its 25 ms kill ladder and
`worktree-service.test.ts` timing out at its unchanged 15 s limit. Neither
failure is waived. Investigate separately before re-running the full gate;
this task remains IN_PROGRESS and is not merge evidence.

The preceding failed full run used Vitest's default parallelism, not the
documented CI `--maxWorkers=1`. The two failing files separately passed (9
tests); a full run with the CI worker setting and unchanged thresholds passed
1141 tests with 9 skipped. This does not establish the cause of either failure
or waive the skipped checks. TASK-841 separately addresses a confirmed signal
exit observation defect and a spawn-failure handling defect. Its changes must
also pass the full gates before the combined candidate can be accepted.

After both fixes, local Windows verification passed: build, lint, typecheck;
unit 1143 passed and 9 skipped (CI skip allowlist verified); contract 50 passed
with no skips; real Electron functional tests 2 passed; browser E2E 9 passed.
The shared Electron SQLite file's SHA-256 remained
`9FD7F1298ED1F7184C11FAD6FB985510A36F08575AC033EA06C8014FC1B85215`.
GitHub CI for the combined candidate has not yet run. These tests do not prove
the production confirmation/dispatch path, whole-tree cancellation or H1.
