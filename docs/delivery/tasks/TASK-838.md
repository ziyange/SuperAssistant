# TASK-838: Register authenticated protected Proposal authority

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: user authorized continuous implementation of immutable Proposal confirmation and the original Attempt loop; production dispatch remains closed until its separate security gates pass.

## Requirement IDs
REQ-021, REQ-022, REQ-024, REQ-025, REQ-027, REQ-090, REQ-091, REQ-095, REQ-098

## Objective
Replace hand-written fixture SQL with a reusable main-process component that atomically registers a cryptographically authenticated protected Proposal without writing its plaintext or issuing authorization.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-837.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/decisions/ADR-008-protected-task-content.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-838.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/protected-proposal-registry.ts
- apps/desktop/tests/main/protected-proposal-registry.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
Other repository paths, registration of migration 033, production routing, renderer or IPC changes, real user projects, actual credentials, real Codex, Electron sandbox security testing, merge and release.

## Interfaces / Contracts
The registry accepts only Workspace, Project and Proposal identifiers and derives all content from the encrypted, authenticated Proposal envelope. This H1 component accepts only the currently supported built-in Codex 0.121.0 Function; broader Adapter and Function registration needs a later authorized contract. It captures the envelope, Project/Agent row versions and registration catalog before asynchronous vault access, authenticates that exact envelope, then compares them again inside one immediate SQLite transaction and rejects observed clock rollback. The transaction inserts the matching protected authority reference and binding together, or accepts an exact existing binding idempotently; partial, conflicting, stale or tampered state fails closed. It stores no Proposal plaintext or plaintext-derived digest and creates no Grant, Task, Attempt or external process.

## Data Constraints
Use synthetic vaults and disposable SQLite/Git fixtures. Never log Proposal content, keys or secrets. An interrupted encryption/reservation remains unresolved and must not be recreated or silently deleted by the registry.

## UI Constraints
No production UI or IPC route is enabled; this component alone cannot authorize execution.

## Implementation Requirements
Test first using the existing encrypted payload and real SQLite migrations. Validate owner, Project and Agent/Function versions and expiry at registration, reject malformed or changed inputs, recheck the captured envelope in the transaction, and roll back both records on failure. Replace fixture-only hand-inserted registry SQL in the fake execution integration with the reusable component. Preserve all existing confirmation and fail-closed behavior.

## Test Requirements
Show red then green for new registry behavior; test exact repeat, concurrent duplicate, foreign scope, expired Proposal, changed ciphertext, Project/Agent/Function changes during asynchronous access, malformed or partial existing bindings, injected insert failure and absence of plaintext, Grant or Attempt. Run protected authority and fake-service tests, lint, typecheck, build, full unit, contract and governance.

## Acceptance Criteria
Authenticated matching content creates exactly one consistent reference/binding pair or returns an exact idempotent result; tamper, stale or failure creates no partial pair or authorization. Fake execution tests use this component instead of manually registering authority.

## Done Definition
Record local and CI evidence and security limitations; do not claim H1, production execution or merge completion.

## Risks
Staging is not authorization and does not make a later Git baseline, Agent health or process identity immutable. Production vault custody, helper provenance, effect fencing and cancellation remain separate gates.

## Output Required
Reusable protected registry, negative and integration tests, synchronized engineering facts and exact evidence.

## Earlier independent diagnostic
Before this task was created, the existing explicitly enabled Windows WinCred
tests ran with three fresh random synthetic targets: 14 passed, zero skipped,
including matching-proof cleanup. This was a separate diagnostic, not an
audited write of this Task Pack or evidence of trusted production helper
provenance. No existing credential was enumerated, and no key was printed.

## Local evidence
The initial registry test failed while the component was absent. The actual
component now authenticates the captured envelope, rechecks the H1 catalog and
clock, and atomically inserts or verifies the protected authority pair. The
fake execution integration uses it instead of manual registry SQL. Negative
tests cover ciphertext mutation, Project/Agent/Function changes, row-version
changes, expired or rolled-back time, partial/conflicting bindings, rollback,
foreign scope, extra fields and disguised arrays; no Grant, Attempt or plaintext
is created. An independent read-only review found no remaining confirmed
critical or important issue within this scope; it did not execute the tests.

After the final input check, build, lint, typecheck, host unit (1131 passed,
9 skipped) and contract (50 passed) succeeded. Before that one-line input
guard, the unchanged desktop routes also passed 2 real Electron tests and 9
browser tests; these do not exercise this unconnected registry. Skips are not
PASS evidence. Production intake, vault custody, native process ownership,
side-effect fencing, cancellation and H1 acceptance remain unproven. GitHub CI
for this change is pending.
