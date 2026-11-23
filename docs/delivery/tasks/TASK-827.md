# TASK-827: Fixture protected-dispatch lifecycle

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: standing user authorization for fake-App-Server integration and safe continuous work toward the merge gates. TASK-824 remains WIP; no production launch is authorized.

## Requirement IDs
REQ-024, REQ-027, REQ-028, REQ-031, REQ-033, REQ-035, REQ-049, REQ-090, REQ-098

## Objective
Consolidate the fixture protected claim, isolated worktree and fake-server start/receipt/UNKNOWN sequence into one main-side lifecycle unit. Eliminate test-side selection of the Task ID and ensure failure after claim never silently redispatches or releases the Lease.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-824.md
- docs/delivery/tasks/TASK-826.md
- docs/orchestration.md
- docs/api/sai.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-827.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- docs/security.md
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/src/main/fixture-protected-dispatch.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
Other paths, production composition, main startup, renderer or IPC, registering migration 033, user credentials or projects, other worktrees, real Codex, Electron sandbox verification, external operations and merge.

## Interfaces / Contracts
The fixture-only dispatcher consumes an authenticated scope and obtains Task ID, Project path, baseline and objective from the claim-bound authority, never caller-selected Task or objective. It creates the worktree from the claimed Task/Project and baseline, prepares the original Attempt's receipt, then invokes only a test-supplied fake transport. If any step after claim fails, it quarantines that claim or authenticated receipt as UNKNOWN without Lease release or retry; failure to record quarantine must be surfaced rather than labeled successful. A normal fake receipt is RUNNING evidence only, not task completion or process termination. Production adapter construction and lifecycle integration remain disabled.

## Data Constraints
Only disposable Git repositories and synthetic vaults may be used. Never persist or log the decrypted objective, claim token, test paths, credentials or process IDs. Preserve unknown Attempts and their Leases.

## UI Constraints
No UI or IPC changes; production execution and running cancellation remain unavailable.

## Implementation Requirements
Extend the frozen TASK-826 context with signed Task ID and validated Project ID. Provide a fixture-only dispatcher that follows claim, worktree, receipt preparation, fake transport and quarantine ordering. Its test-only transport must not be treated as proof of binary provenance, process ownership or confinement. Do not trust the context as continuing authority after its transaction. If quarantine cannot be persisted return an explicit failure and retain all possible effects for inspection. Update the actual fake App Server integration tests to exercise the new unit with real SQLite and Git, not just a mock callback.

## Test Requirements
First demonstrate missing dispatcher with a failing test. Verify fake accepted lost reply retains the same UNKNOWN Attempt and ACTIVE Lease, normal fake acknowledgement records the same Attempt's encrypted receipt, failures before and after receipt fail closed, repeated dispatch does not create a second Attempt, and claim identity cannot be caller-selected. Run affected tests, lint, typecheck, build, full unit and contract, independent review and governance. Real Codex and Electron sandbox are deferred.

## Acceptance Criteria
Both fake-server flows exercise the lifecycle unit with an isolated worktree and the original Attempt. Ambiguous effects never become CANCELLED, terminal or released, and no duplicate start is dispatched. Production behavior remains unchanged and disabled.

## Done Definition
Record red/green, test and review evidence, synchronize relevant facts and commit. This fixture-only task is neither production integration nor merge readiness.

## Risks
Fake transport and injected fixture process have no production provenance or confinement. A claim snapshot can go stale before a side effect; a later production supervisor must revalidate under trusted custody and profile enforcement.

## Output Required
Fixture protected-dispatch lifecycle code, claim-bound Task identity, fake integration tests and precise production limitations.

## Work in progress
The initial Task identity regression failed because the claim snapshot lacked Task and Project IDs; it now derives them from the authenticated proof and validated scope. Real temporary Git and fake App Server tests drive both accepted and lost-reply cases through the fixture dispatcher. Independent review identified missing persisted-receipt verification and a hidden UNKNOWN-write failure; three regressions reproduced those flaws before the fix. The fixture now requires the persisted receipt to match the returned value, prevents start after an UNKNOWN notification, and exposes `PERSISTENCE_FAILED` for a caller to monitor. An after-receipt failure test retains the original UNKNOWN Attempt and ACTIVE Lease. On the current patch 149 protected-authority and integration tests passed; lint and typecheck passed. Independent static re-review found no further substantiated Critical or Important issue but did not run tests. Full unit, contract, production build and final governance remain pending. The transport is injected only for fixtures, is not an owned-process or confinement proof and is not wired to production. Fixture code, not the dispatcher, remains responsible for cleaning up a process if its factory fails after spawning.

After the final application and test edits, the Windows host full unit suite passed 1,058 tests with nine skipped across 182 files; the fake-service contract suite passed 49/49. Production build, lint and typecheck passed. These skips are not passes. The result is confined to this fixture task; trusted runtime custody, verified termination, real desktop execution, sandbox evidence and merge acceptance remain open.
