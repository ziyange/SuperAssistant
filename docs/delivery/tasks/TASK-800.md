# TASK-800: Bind review-only drafts to executable bytes

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user requested trusted executable Function and immutable Proposal revalidation before execution.

## Requirement IDs
REQ-021, REQ-024, REQ-025, REQ-027, REQ-090, REQ-098

## Objective
Make an ephemeral goal review fail closed when the locally registered executable file changes, even if its reported version remains the same.

## Context Pack
- docs/delivery/tasks/TASK-795.md
- docs/delivery/tasks/TASK-797.md
- docs/delivery/tasks/TASK-798.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/adapters/codex.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-800.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/local-goal-draft.ts
- apps/desktop/tests/main/local-goal-draft.test.ts
- apps/desktop/src/main/immutable-proposal-confirmation.ts
- apps/desktop/tests/main/immutable-proposal-confirmation.test.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/src/main/main.ts
- docs/adapters/codex.md
- docs/ux.md

## Forbidden Files
Other application files, archive evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
Only the trusted main process derives a bounded SHA-256 fingerprint from the registered canonical executable. Drafts retain the fingerprint in memory and revalidate it before and after native review. A fingerprint establishes byte consistency at observation only; it does not authenticate a publisher, prove the spawned process image, prevent replacement after check, or establish sandbox confinement.

## Data Constraints
No goal, acceptance text, executable path or hash is written to SQLite or exposed by IPC. Reject missing, non-file, oversized or unstable executable files and catalog changes. Do not modify or launch the executable.

## UI Constraints
Review stays explicitly REVIEWED_ONLY and never issues a Grant or starts execution.

## Implementation Requirements
Read the already registered executable through an owned read handle with bounded chunked input in an isolated worker, verify canonical path and stable handle metadata before and after hashing, then bind the in-memory review to that fingerprint. Limit hashing concurrency, reject literal UNC and extended-device paths, and time out requests while attempting worker termination. A drive letter or realpath does not prove the underlying volume is local. Make draft creation and confirmation reads asynchronous while retaining sender and generation checks. Re-evaluate the fingerprint and Agent/Project authority on review. Fail closed on errors and compare again after native dialog. Keep existing draft expiry, size and concurrent ownership protections.

## Test Requirements
First reproduce that same-version file replacement leaves the old draft readable. Test in-place mutation, replacement, missing file, stable unchanged file, registration change, no database write and no execution. Run lint, typecheck, unit/contract/build and governance gates.

## Acceptance Criteria
A previously reviewable draft becomes unavailable when the registered executable changes or disappears even without a version change; an unchanged executable remains reviewable. No execution, Grant or Attempt is created. This is not executable trust or cancellation proof.

## Done Definition
Report limitations, tests and outstanding production process identity, confinement, authorization and cancellation. No merge-readiness claim.

## Risks
A local attacker can race or restore bytes and metadata around checks. Final execution must independently verify the opened image and process identity at launch and authorization. Mapped drives or reparse points can reach network storage despite a drive-letter path. A worker blocked in kernel I/O may not terminate promptly and occupies its bounded slot until exit; two such workers can make review unavailable. Git baseline checks still run synchronously on the main process.

## Output Required
Regression tests and Adapter/UX facts for review-only fingerprinting.

### Security-driven scope revision

Independent review identified that synchronous file reads could freeze the
Electron main process, especially over network paths. The six exact additional
paths above permit an asynchronous, bounded, isolated worker and the necessary
IPC/confirmation changes. No real execution or authorization is enabled.

### Implementation and independent review — 2026-11-22

An initial red test demonstrated that modifying the selected executable while
keeping its version unchanged left a draft reviewable. The new in-memory
binding uses a bounded worker and rechecks the fingerprint before and after the
native review. Focused tests cover unchanged bytes, same-size modification,
missing, empty and over-limit files and the async review path. No Grant,
Attempt or SQLite draft is created.

Independent read-only review found the first synchronous implementation could
freeze the main process. The replacement uses at most two worker threads,
five-second request timeouts, literal UNC/device-path rejection and retains a
worker slot until the worker exits. Final re-review found no new security
blocker in this review-only scope but did not run tests. Real kernel-blocked
worker timeout/recovery, mapped drives, reparse points and open-handle file
replacement lack direct test evidence. Git checks remain synchronous. These
limitations and the absence of publisher/process identity, OS confinement,
native authorization and full execution are not waived.

### Local verification — 2026-11-22

Windows Node 22.19.0 / npm 10.9.3 production build, lint and typecheck
passed. The full unit suite reported 625 passed and six PostgreSQL-environment
skips; the contract suite reported 44 passed. Skips are not passes. Focused
tests cover same-size byte modification, missing/empty/oversized files,
asynchronous review before and after the presenter, no SQLite draft, and no
Grant or Attempt. Independent review did not run tests. Real kernel-blocked
worker timeout and Windows mapped-drive/reparse behaviors remain unverified.
Real Codex, Electron sandbox and remote CI were not run.
