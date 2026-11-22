# TASK-798: Connect local goal drafts to native Proposal review

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user requested continued implementation of the native Proposal workflow through the merge gate.

## Requirement IDs
REQ-008, REQ-009, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-090, REQ-094

## Objective
Connect a bounded user-provided goal and acceptance criterion to a local immutable draft and the existing native review-only window.

## Context Pack
- docs/delivery/tasks/TASK-794.md
- docs/delivery/tasks/TASK-796.md
- docs/delivery/tasks/TASK-797.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/api/sai.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-798.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/local-goal-draft.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/renderer/proposal-review.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/local-goal-draft.test.ts
- apps/desktop/tests/main/ipc-schemas.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/renderer/proposal-review.test.tsx
- docs/ux.md

## Forbidden Files
Other application files, archive evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The renderer supplies only Project ID, bounded goal and acceptance text. Main derives Workspace, registered Agent, built-in Function, current snapshot and Git baseline; all policy fields and limits are main-owned. This entry point holds drafts only in bounded main-process memory, never SQLite, because free text can contain unrecognizable secrets. IPC returns a draft identifier only, or a sanitized unavailable result. A separate native review action displays the full immutable draft and reports REVIEWED_ONLY, never a Grant or dispatch.

## Data Constraints
Ephemeral drafts capture and recheck Agent generation, catalog facts and Git baseline. They expire and are lost on restart; durable executable Proposals remain a later, separately secured concern. A stale or non-Git Project, unsupported Function, malformed input or ambiguous Workspace fails closed. No renderer-supplied Agent, Function, baseline, budget, action list, authorization or executable is trusted.

## UI Constraints
The UI clearly states this is review-only, shows fixed allowed/forbidden scope and budget before drafting, warns against entering secrets, and never reports execution or authorization. Submission is disabled during in-flight requests. User content is rendered as text only.

## Implementation Requirements
Implement a fixed review-only H1 candidate with a bounded FILE_WRITE scope, explicit forbidden command/network actions, a time limit and acceptance evidence text. Validate all input in IPC and again in main. Create and review must not create a Grant, Attempt, worktree or external effect. Reject stale and untrusted inputs without leaking filesystem paths or provider errors.

## Test Requirements
Use red-green tests for main-derived authority, malformed and extra IPC fields, disabled or stale catalog, unchanged original repository, native review invocation, empty/oversized goal, submit state, safe text and review-only result. Run build/lint/typecheck/unit/contract plus governance gates.

## Acceptance Criteria
A user can choose an eligible Project, enter a goal and acceptance criterion, create a local draft and invoke the existing native review. The generated immutable review displays the exact goal, criterion, policy and baseline. No executable action is authorized or launched, no Grant or Attempt is created, and invalid/stale/foreign inputs fail closed.

## Done Definition
Record actual tests and remaining live provenance, authorization, dispatch, cancellation and recovery integration. This task alone is not merge readiness.

## Risks
Draft text is user-provided; the application warns against entering credentials, keeps this entry point in memory only, and does not log it. Heuristic detection cannot reliably detect every secret. The fixed policy is review-only and is not OS confinement.

## Output Required
Tests and UX factual writeback.

### Security-driven revision — 2026-11-22

Independent review found free-form goal text cannot be reliably classified as
secret-free. The initial SQLite-backed draft implementation is replaced before
acceptance by an ephemeral, bounded main-process draft. This is a temporary
review-only path; it does not claim durable Proposal creation or restart
recovery. It expires and vanishes on restart. The fixed policy remains visible,
and neither review nor draft creates any Grant, Attempt or external effect.

Expiry means a draft is no longer usable and a timer makes a best-effort
removal of its main-process Map reference; an open review window can still
display text until dismissed, and garbage collection or memory zeroing is not
guaranteed. The review owner releases its draft after completion or dismissal.
Concurrent attempts for the same draft are rejected without clearing the
first request's state.

### Local verification — 2026-11-22

Windows Node 22.19.0 / npm 10.9.3 production build, lint and typecheck passed.
Full unit tests reported 624 passed and six PostgreSQL-environment skips;
contract tests reported 50 passed. The skips are not passes. Focused tests
exercise main-derived local catalog and Git baseline, no draft text in
serialized SQLite, no Grant/Attempt, malformed IPC, common secret-like input,
duplicate review ownership, renderer duplicate submission and sanitized
failures. The negative secret filter is defense in depth and cannot recognize
all credentials; the ephemeral path avoids SQLite persistence regardless.

Independent read-only review found and prompted fixes for both the initial
SQLite persistence of arbitrary user text and a same-draft review cleanup
race. Its final recheck found no new blocker within this review-only increment;
the reviewer did not run tests. Synchronous Git calls can still be abused for
main-process load, and live binary provenance, native authorization, owned
process confinement, cancellation and remote CI remain unverified. Real Codex
and Electron sandbox tests were not run.
