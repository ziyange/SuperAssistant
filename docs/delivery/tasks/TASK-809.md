# TASK-809: Owned key buffer lifecycle

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User authorized independent continuation and confirmed protected task content with Windows Credential Manager keys.

## Requirement IDs
REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Close the reviewed late-result secret-buffer gap between the reserved payload coordinator and isolated Windows vault, without wiping borrowed buffers or enabling production execution.

## Context Pack
- docs/delivery/tasks/TASK-807.md
- docs/delivery/tasks/TASK-808.md
- docs/decisions/ADR-008-protected-task-content.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-809.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/operations.md
- apps/desktop/src/main/reserved-payload-service.ts
- apps/desktop/src/main/windows-credential-vault.ts
- apps/desktop/tests/main/reserved-payload-service.test.ts
- apps/desktop/tests/main/windows-credential-vault.test.ts

## Forbidden Files
All other application files, real credentials, production WinCred writes, existing databases, archived evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
ReservedVault optionally exposes synchronous release(Buffer) for buffers it owns. The Windows vault marks its own returned copies and releases only marked objects; unrelated or borrowed buffers are never modified by it. The coordinator releases known-owned values after copying and invokes release for values returned after its deadline. Timeout never means the external operation was cancelled or safely retried.

## Data Constraints
No plaintext, key bytes or credentials enter logs, SQLite, filenames or arguments. Zeroization is best effort; runtime copies and an already compromised process remain outside its guarantee. An uncertain reservation and late external write are preserved for explicit reconciliation, not deleted or retried.

## UI Constraints
No renderer, UI, Grant, Proposal execution or Attempt wiring.

## Implementation Requirements
Track Windows vault-owned result buffers by object identity; release is idempotent and does not alter unknown buffers. The coordinator calls release on owned create/read results after its own copy, and when a vault promise succeeds after the user-facing deadline. Do not unconditionally clear borrowed vault buffers. Keep the four outstanding-call bound and deadline behavior from TASK-807 intact.

## Test Requirements
Use TDD to prove immediate owned results are released, late owned create and read results are released, foreign borrowed values remain unchanged, timeout remains UNCERTAIN, late effects never write a payload and slot recovery works. Run affected tests, lint, typecheck, build and full unit/contract and governance gates as available.

## Acceptance Criteria
Known owned buffers are zeroed on both normal and late completion; unknown borrowed buffers are unchanged; a timeout remains fail-closed and cannot trigger another key write. No production provider or execution flow is enabled.

## Done Definition
Record observed tests and limits in this Task Pack; do not claim release or merge readiness while provenance, actual-credential input isolation or crash reconciliation remain unproven.

## Risks
JavaScript and operating system copies cannot be guaranteed erased. Vault implementations that do not implement ownership release remain responsible for their own buffers. A caller that retains copies after release is outside this scope.

## Output Required
Bounded, ownership-aware buffer lifecycle in the two main-process modules, regression tests and one Task Pack evidence record.

## Local development evidence (2026-11-22)

- Red tests reproduced missing owned-buffer release, late create/read results left uncleared, and copied-buffer leakage when a release callback throws. Corrections preserve unrelated borrowed values and zero local owned copies; focused synthetic tests passed.
- Independent security review identified the release-failure edge in both read and create paths; both are covered by regression tests. Original borrowed buffers remain the responsibility of their owner if its release callback itself fails.
- Explicit Windows synthetic helper tests passed: 12 tests, zero skipped, including native create/read/duplicate rejection, releasing a real returned key buffer and exact cleanup. The two nonsecret synthetic target IDs and completed action are in task-809-command-001.
- This is best-effort in-process cleanup, not guaranteed erasure of runtime or OS copies. Production helper provenance, noncooperating writers, crash reconciliation, secret-input isolation and desktop execution are still unverified.
- Full lint, workspace typecheck and build exited 0. Full unit exited 0: 173 files, 688 tests passed, 9 skipped (six PostgreSQL-related tests and three separately opt-in native credential tests). The current Windows bridge test was independently enabled as task-809-command-001; no skipped test is counted as part of the unit pass. Remote CI was not run.
