# TASK-792: Refresh desktop Task and Decision views after a Codex recheck

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: the user's desktop original-Attempt recovery request covers making the resulting durable state visible without reopening the app.

## Requirement IDs
REQ-032, REQ-037, REQ-049, REQ-098

## Objective
After a completed explicit runtime check, reread the local Task and Decision projections. Discard stale results from any older read. This does not introduce a new execution capability.

## Context Pack
- docs/delivery/tasks/TASK-790.md
- docs/delivery/tasks/TASK-791.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/ux.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-792.md
- .github/workflows/docs-gates.yml
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/ux.md
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/renderer/task-cancellation-navigation.test.tsx

## Forbidden Files
No other files, main, retained source trees, external writes or live Codex/Electron sandbox tests.

## Interfaces / Contracts
Use existing typed checkCodex, listTasks and listDecisions. Only persisted state is displayed; a successful connection is not a successful Attempt.

## Data Constraints
Read only. No synthetic outcome, retry, mutation or polling loop; ignore late reads from older revisions.

## UI Constraints
Task cards are usable before secondary Decision loading; no stale Decision is shown as current. Surface a failed read without implying success or an empty history.

## Implementation Requirements
Remove duplicate initial list calls; refresh on settled runtime check. Use the cleanup lifecycle to guard asynchronous writes.

## Test Requirements
Exercise the real React App with controlled IPC responses in jsdom. Include out-of-order Decision completion and a changed Task projection; run build, lint, typecheck, full unit and contract suites, then governance.

## Acceptance Criteria
Returning to Task Center after an explicit recheck shows the latest stored state without reload. An old read cannot overwrite it or undo confirmed queued cancellation.

## Done Definition
Record commands, results and remaining runtime limits here.

## Risks
IPC can return late, fail, or return an unexpected projection. Connection availability alone says nothing about a Task.

## Output Required
This Task Pack records the projection refresh verification.

Local evidence on 2026-11-19 (patch based on `1bcb367`, Windows, Node
22.19.0): the red React regression could not find ACCEPTANCE_PENDING after
check; the old App kept its initial projection. The green route made two
list reads total (initial plus recheck), showed the newly persisted result,
ignored older Decisions and preserved the queued cancellation overlay.
Rejection of either read showed an error rather than an empty collection.
Final production build, ESLint and workspace typecheck passed. Vitest unit:
160 files, 563 passed, six PostgreSQL-dependent skips. Contract: eight
files, 50 passed, no skips. Local governance covered 345 Markdown files,
139 packs, 99 REQs, five schemas, Plan Exit 0, 34 Python tests and seven
exact changed paths. No live Codex, Electron sandbox, candidate CI,
merge or push. Together with TASK-790/791 this proves the reconnect/read
side against controlled inputs; it does not manufacture a production
receipt or a Grant and does not establish active cancellation.
