# TASK-818: Revalidate and deliver Decision through Outbox

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User requested autonomous completion of original-Attempt Decision and recovery flow until merge gates.

## Requirement IDs
REQ-027, REQ-031, REQ-033, REQ-038, REQ-040, REQ-043, REQ-044, REQ-049, REQ-090, REQ-092, REQ-098

## Objective
Connect the actual SQLite Outbox and desktop dispatcher so a claimed Decision resume is revalidated immediately before the Adapter invocation and carries the stored ALLOW/DENY option. Exercise real SQLite with a fake Adapter; do not enable production execution.

## Context Pack
- docs/delivery/tasks/TASK-817.md
- docs/orchestration.md
- docs/api/sai.md
- docs/adapters/codex.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/api/sai.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-818.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/orchestration.md
- docs/security.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/tests/outbox-inbox.test.ts
- apps/desktop/src/main/outbox-dispatcher.ts
- apps/desktop/tests/main/orchestrator.test.ts

## Forbidden Files
Other files, production databases, credentials, existing archives, other worktrees, real Codex execution, Electron sandbox verification, remote operations and merge.

## Interfaces / Contracts
A resume claim is resolved by the SQLite Outbox itself, using exact message ID, claim token, Attempt, Decision and resolution. The database supplies the immutable choice, not the renderer or caller. Dispatch requires both the existing trusted guard and this second synchronous SQLite validation immediately before invoking the Adapter. Absence, mismatch or error fails closed and never calls the Adapter. The Adapter receives the bound Decision option. An unsuccessful or ambiguous claim is quarantined by the existing logic; no retry is created.

## Data Constraints
No schema changes, production data or secrets. Validate full Proposal digest, Grant scope/expiry and owner, current Project/Agent/Function, unexpired Project Lease and fencing history with a trusted clock. Persist observed expiry without accidentally committing an effect. Reject caller-owned outer transactions that could undo Lease time evidence.

## UI Constraints
No UI or native confirmation changes. Never expose private Codex identifiers. This fake Adapter integration does not enable any real execution or claim H1 acceptance.

## Implementation Requirements
Re-read the claimed row and all authority from SQLite after any asynchronous guard, validate exact payload and Decision scope, use the current clock and Lease. Reject malformed data, stale token, conflicting leases, clock reversal, cancelled task or unavailable actor. Do not trust user-provided timestamps or option. Carry ALLOW/DENY as a typed product field to the fake Adapter. A production Codex response still requires a separately bound server request and verified policy; never translate ALLOW into a blanket session approval.

## Test Requirements
TDD tests with real SQLite Outbox, existing Decision transaction, a fake Adapter and injected clock; prove actual option reaches Adapter, expiry/version/lease/revocation/cancellation or claim changes after initial guard prevent invocation, and failed validation never starts or retries the Attempt. Test accepted same Attempt and lost response. Run focused tests, full unit/contract, build, lint, typecheck and governance checks.

## Acceptance Criteria
Only the exact still-owned claimed resume with current authority delivers its saved option. Adverse cases produce no Adapter effect and retain conservative UNKNOWN/RECONCILING semantics. No real Codex or native confirmation is inferred.

## Done Definition
Record test and independent-review evidence and explicitly retain unresolved dispatch-to-side-effect races, actual process confinement, native confirmation, structured approval scope and protected Proposal wiring.

## Risks
A SQLite check is not an OS fence or proof of a native approval; authority may change after validation and before an external process acts. This must not be used to enable production dispatch until the Adapter enforces a live per-action boundary.

## Output Required
Scoped SQLite and desktop Outbox integration, tests and one evidence record.

## Local evidence (2026-11-22; working patch on faad53f)
- Red: an unchanged dispatcher forwarded stale Project, Function, Task and Lease state and omitted the stored option.
- Focused unit: 70 passed, including real SQLite, fake Adapter, invalidated authority, immutable Proposal corruption, concurrent resume and long Decision ID.
- Full unit: 174 files passed, 785 tests passed, 9 skipped (PostgreSQL and opt-in Windows Credential Manager); contract: 8 files / 49 tests passed.
- Local lint, typecheck and build exited 0 after selecting Node 22.19.0 and npm 10.9.3 for both parent and nested scripts; the previous npm 12 warning was caused by a global prefix override.
- Independent read-only security review found and prompted fixes for noncanonical messages, long IDs, open and concurrent Decisions, history timestamps and Grant chronology; final review found no new Critical/Important issue in this bounded patch.
- Limitations: fake Adapter only, no native user confirmation, no production Outbox connection, no operating-system fence, no verified cross-process race handling. Another unresolved Decision or unacknowledged resume is conservatively quarantined; its complete recovery policy remains unfinished. Database check to side effect remains a TOCTOU risk. Real Codex and Electron sandbox remain deferred.
- Local tests are working-patch evidence, not clean-SHA, remote CI, H1 acceptance or merge approval.
- Governance on this working patch: 374 Markdown files scanned without issues; 165 Task Packs, traceability, five schemas and anchored runtime Exit 0; 38 Python tests and git diff --check passed.
