# TASK-819: Native local Decision resolution without dispatch

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User authorized autonomous desktop Decision remediation toward merge.

## Requirement IDs
REQ-040, REQ-041, REQ-043, REQ-044, REQ-090, REQ-091, REQ-094, REQ-098

## Objective
Allow a local user to review a waiting Decision in a native main-process prompt and record the selected option atomically on its original Attempt. Clearly show that the outcome is queued and not yet resumed. Do not enable or trigger Adapter dispatch.

## Context Pack
- docs/delivery/tasks/TASK-818.md
- docs/orchestration.md
- docs/security.md
- docs/ux.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/ux.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-819.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/ux.md
- docs/security.md
- apps/desktop/src/main/native-decision-resolution.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/decision-center.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/native-decision-resolution.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/renderer/decision-center.test.tsx
- packages/persistence/src/repositories/decision-repository.ts
- apps/desktop/src/main/review-window.ts
- apps/desktop/tests/main/review-window.test.ts
- apps/desktop/src/main/prompt-gate.ts
- apps/desktop/tests/main/prompt-gate.test.ts

## Forbidden Files
All other files, real Codex execution, Electron sandbox verification, production databases, credentials, other worktrees, archives, remote operations and merge.

## Interfaces / Contracts
The renderer may request review by Decision ID only; never supply an option, actor, timestamp, resolution ID, or approval. Main selects only a unique active local workspace Decision, presents the exact bounded question and Task/Project identity in a native dialog, and derives ALLOW/DENY only from its response. Cancel means no write. Reject controls, ambiguous identities, changed snapshots, reentrant prompts and unavailable context. Generate IDs in main; the existing SQLite Decision transaction checks current authority and original waiting Attempt after the prompt. Return only RECORDED, DISMISSED or UNAVAILABLE; RECORDED means queued, not resumed. No Adapter or dispatch is invoked.

## Data Constraints
Preserve immutable audit history and existing schema. Main derives local-owner from the existing local workspace contract. Compare complete displayed context before and after asynchronous dialog. Never accept hidden bidirectional controls, unsafe control characters or truncated text. No user-owned transaction may roll back authorization evidence.

## UI Constraints
Show a native review button only for OPEN Decisions. Explain explicitly that recording the answer does not resume execution. Renderer errors and stale replies cannot show false success. Do not expose private upstream IDs.

## Implementation Requirements
Use the trusted main-process native presenter and the existing atomic Decision repository. Keep renderer input limited to the Decision ID; re-read and compare the full displayed local context after the asynchronous prompt. Never dispatch or create a replacement Attempt.

Approved scope amendment under the user's standing autonomous-repair authorization: the exact Decision repository file is required to compare the reviewed snapshot inside the same SQLite write transaction. This is a security correction, not authorization to enable dispatch.

The same authorization covers the existing isolated review-window implementation and its test, to display the complete Decision in a scrollable main-owned surface before the native choice prompt.

The exact prompt-gate module and test are additionally required to serialize Decision, Proposal and cancellation confirmation flows through one main-process slot; this prevents cross-channel confirmation confusion.

## Test Requirements
TDD with real SQLite and injected native presenter: ALLOW/DENY, dismissal, stale Decision/task/identity while dialog open, duplicate clicks, malformed text, expired Grant and Lease, no effect on Adapter and original Attempt. Test IPC schema extra fields and renderer statuses. Run focused, unit, contract, build, lint, typecheck and governance.

## Acceptance Criteria
Only a main-owned explicit native response against unchanged local context may record an answer. Every failure is closed with no new resume. A recorded answer creates at most one original-Attempt resume without dispatch; UI never claims execution resumed.

## Done Definition
Evidence and independent security review recorded. Real Codex, OS fencing, secure structured upstream request binding, production dispatch and Electron sandbox remain unverified.

## Risks
Decision question text alone is not a structured per-action grant. Recording is not permission to execute or to perform a blanket session approval.

## Output Required
Main-process resolution service, desktop routing and UI, tests and scoped evidence.

## Local evidence (2026-11-22; working patch on f24c48b)
- TDD reproduced incorrect dispatch-context acceptance after the last read, a second concurrent native prompt, invisible control text, missing native review UI and a missing cross-channel gate; the targeted regressions now pass.
- Full unit: 176 files passed, 804 tests passed, 9 skipped (PostgreSQL and opt-in Windows Credential Manager). Contract: 8 files / 49 tests passed.
- Node 22.19.0 and npm 10.9.3: lint, typecheck and production build passed.
- Main-process native review uses a scrollable isolated review surface and a separate answer choice; the Decision and original Attempt binding are rechecked inside the SQLite write transaction. Decision, Proposal and queued-cancellation prompts share one slot.
- Independent read-only security review found and prompted fixes for transaction timing, incomplete text presentation, spoofing controls, and cross-flow prompt overlap; final review found no remaining Critical/Important issue in this bounded patch.
- Limitations: prompt-slot tests use controlled callbacks rather than actual Electron IPC. Actual Windows rendering, scrolling, accessibility and sandbox are deferred and not accepted. The Decision question is not a structured upstream request binding; no production Adapter dispatch is enabled. A recorded answer is queued, not resumed.
- Tests describe the working patch, not a clean-SHA CI run, integrated H1 acceptance or merge approval.
