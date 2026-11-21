# TASK-794: Specify owned execution and cancellation boundaries

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: user requested trusted Function, native immutable Proposal approval, original Attempt receipt and active cancellation with confirmed process-tree termination before lease release.

## Requirement IDs
REQ-021, REQ-027, REQ-031, REQ-032, REQ-033, REQ-049, REQ-090, REQ-098

## Objective
Implement the immutable Proposal confirmation boundary before integrating an execution dispatcher.

## Context Pack
- docs/delivery/tasks/TASK-793.md
- docs/delivery/tasks/TASK-790.md
- docs/delivery/tasks/TASK-789.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-794.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/immutable-proposal-confirmation.ts
- apps/desktop/tests/main/immutable-proposal-confirmation.test.ts
- apps/desktop/src/main/local-proposal-review.ts
- apps/desktop/tests/main/local-proposal-review.test.ts
- apps/desktop/src/main/review-window.ts
- apps/desktop/tests/main/review-window.test.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/main/ipc-schemas.test.ts
- apps/desktop/src/renderer/proposal-review.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/renderer/proposal-review.test.tsx
- docs/ux.md

## Forbidden Files
Application files outside the allowlist, archived evidence, other worktrees, main, remote operations, real Codex and Electron sandbox.

## Interfaces / Contracts
Define trusted Function authority, reviewed Proposal identity, claimed start receipt and process-tree termination evidence. Thread and Turn stay private to the adapter. No renderer-supplied process identifier is authoritative.

## Data Constraints
The consumed Grant, immutable Proposal digest, current Project baseline, original Attempt and fencing token must agree. Unknown outcomes remain unretried and leases unreleased.

## UI Constraints
Native confirmation must display all security-relevant immutable review fields and fail closed when the reviewed snapshot changes.

## Implementation Requirements
Implement a private main-process confirmation boundary using persisted full review, canonical digest verification, and a restricted scrollable native desktop review window with no scripts or external navigation. Prepare the immutable review from a local draft only after validating the live local Project, Agent and Function catalog and exact Git baseline; reject stale or foreign authority. IPC carries only a draft identifier and routes through trusted sender checks. It reports review acknowledgement only, never creates a Grant or dispatches. No fake-only authorization or fixture production imports. Later integration must prove descendant termination rather than root PID disappearance.

## Test Requirements
Run focused Vitest, build, lint, typecheck, full unit and contract, document links, Task Pack validator, runtime trace and git diff check.

## Acceptance Criteria
The native review window displays the full exact review and explicitly states that acknowledgement does not authorize execution; wrong digest, missing review, concurrent confirmation, untrusted IPC and changes while awaiting the dialog do not approve. SQLite review creation rejects stale, foreign, or ambiguous authority. No Grant or execution is created by this component.

## Done Definition
Record verification and remaining integration gaps; do not claim execution or merge readiness.

## Risks
Windows process trees can outlive a root PID; interrupt acknowledgement is not termination proof. Upstream execution may be unknown after transport loss.

## Output Required
This pack records the integration boundary and subsequent work.

### Local progress — 2026-11-21

An unconnected confirmation boundary rejects absent, altered, expired,
oversized, bidi-controlled and concurrently prompted reviews. It compares
the full canonical digest before and after the presenter. This presenter is
still an injected interface; no native dialog, renderer entry, Grant or
dispatcher is wired.

The SQLite review preparation uses an immutable locally scoped draft and
rechecks the Project catalog and Git baseline; repeat preparation reuses the
matching immutable version. The SQLite writer lock does not encompass the
Git process. A created review is not a trusted executable Function.

Windows Node 22.19.0: production build, lint and typecheck passed; 580 unit
tests passed with 6 PostgreSQL-environment skips, and 50 contract tests passed.
Focused tests cover baseline advance, snapshot change, review tampering,
duplicate prompts, expiry, overlong content and bidi controls. Real Codex,
Electron sandbox and external CI were not run. The six database tests are not
counted as passed by this run. This task remains in progress and is not
integrated acceptance or merge readiness.

### Review window and IPC continuation — 2026-11-21

Main now prepares an existing local draft, opens a sandboxed, isolated,
JavaScript-disabled modal with escaped scrollable review content, and checks
the same persisted digest and authority after dismissal. External navigation,
new windows and webviews are denied; the only accepted link is a per-window
random target. IPC accepts only a draft identifier after the existing sender
check. The acknowledgement is explicitly REVIEWED_ONLY: it creates neither
a Grant nor an Attempt and is not an execution authorization. The renderer has
no draft creation or button wiring yet.

Windows Node 22.19.0: build, lint, typecheck passed; 584 unit passed, six
PostgreSQL-environment skips; 50 contract tests passed. Focused tests cover
escaped hostile text, invalid targets, denied navigation, load failure,
local SQLite and real Git snapshot change during review. Actual Electron
sandbox and Codex smoke remain deferred; no remote CI was run. This is not
H1 acceptance or merge readiness.

Independent read-only review found that two different Proposal IDs could open
simultaneous confirmation windows. The added cross-ID regression timed out
before the fix because it opened a second presenter; the boundary now blocks
all concurrent prompts and the focused 24-test suite passed. Independent
recheck found no additional blocking issue in this scoped review.

One governance run overlapped the audit transaction for that regression and
observed Exit 4 COMMITTED_RESULT_MISSING for task-794-write-037. Inspection
after the writer finished showed its matching completed Result; the trace
was rechecked with Exit 0. No side-effecting action was repeated.

The complete application gate was repeated after the concurrency repair:
build, lint, typecheck, 584 unit passes with six PostgreSQL-environment skips,
and 50 contract passes. No skipped test is represented as a pass. This
review-only increment remains an explicitly incomplete part of the H1
workflow; no real Electron window or execution operation has been accepted.
