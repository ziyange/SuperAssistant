# TASK-721: Repair authorization and data boundaries
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authorization: user-approved integration remediation plan, reaffirmed when choosing E:/Programs/Super Assistant as the main repository.
## Requirement IDs
REQ-082, REQ-085, REQ-087, REQ-090, REQ-094, REQ-095, REQ-096, REQ-099
## Objective
Repair the G2 authorization, session, IPC and notification boundaries and prove them through negative and integration tests before any M1 merge.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/delivery/integration-recovery-baseline.md
- docs/verification/quality-gate.md
## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-716.md
- docs/verification/test-strategy.md
- docs/verification/scenarios.md
## Allowed Files
- docs/delivery/tasks/TASK-721.md
- docs/delivery/tasks/README.md
- docs/delivery/phase-007-integration-recovery.md
- docs/delivery/execution-trace.json
- docs/delivery/permission-audit.log
- docs/security.md
- docs/operations.md
- docs/verification/reports/phase-007-task-721.md
- services/team/src/team-api.ts
- services/team/src/notification-policy.ts
- services/team/src/postgres/team-repository.ts
- services/team/src/postgres/schema.ts
- services/team/src/session-service.ts
- services/team/src/notification-delivery-service.ts
- services/team/src/notification-outbox.ts
- services/team/src/notification-preference-service.ts
- services/team/tests/team-api.test.ts
- services/team/tests/notification-policy.test.ts
- services/team/tests/postgres-team-repository.test.ts
- services/team/tests/notification-delivery-service.test.ts
- services/team/tests/notification-outbox.test.ts
- services/team/tests/notification-preference-service.test.ts
- services/team/tests/notification-api.contract.test.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/window-policy.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/team-notification-client.ts
- apps/desktop/src/main/team-notification-ipc.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/preload/team-api.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/main/window-policy.test.ts
- apps/desktop/tests/main/team-notification-ipc.test.ts
- scripts/verify_runtime_trace.py
- tests/test_verify_runtime_trace.py
## Forbidden Files
Do not modify archived evidence, the original TASK-716 worktree, user-owned untracked files, unrelated application files, package locks, Git history, or secrets. This pack does not authorize merge, push, or cleanup before G8.
## Interfaces / Contracts
Audit export requires EXPORT_AUDIT before protected reads. Notification targets must be resolved from the authorized server-side reference. IPC admits only the actual trusted application frame and exact approved development origin. Delivery claims use fencing and distinguish confirmed from unknown outcomes.

Runtime scope revision, explicitly authorized by the user: an optional task-start transaction identifies the first task-named, committed, matched FILE_WRITE of the current Task Pack. With this option, validate the complete audit chain and transaction states, then apply the current allowlist to all writes from that transaction onward, regardless of transaction name. Reject missing, later, mismatched, non-committed or untraced anchors. Without the option retain existing full-history boundary behavior. This is not a replacement for Git changed-file validation.

Notification schema scope revision: `services/team/src/postgres/schema.ts` is explicitly included for the previously approved TASK-716 notification-table work and the user's 2026-11-04 instruction to autonomously handle ordinary in-scope changes. Only additive, fail-closed initialization is allowed; do not alter existing records or run migrations on non-disposable databases. Preservation and separate review of TASK-716 WIP remain mandatory.
## Data Constraints
PostgreSQL NULL and bigint session values must map correctly without exposing secrets. Preserve immutable audit evidence and TASK-716's existing 30-file WIP; do not silently copy or overwrite it.
## UI Constraints
No graphical layout changes are included. IPC behavior is validated from the real main-process boundary, including absent sender and deceptive origins.
## Implementation Requirements
Start with reproducible failing tests for each security flaw. Fix audit export authorization, deep-link target mismatch, persistent session handling and IPC sender validation. Independently review and integrate only the needed TASK-716 notification source after checking its recorded hashes and dependencies; preserve unknown delivery states and prevent stale claim confirmation. If dependencies cannot be integrated safely, leave the corresponding G2 criterion BLOCKED and continue independent checks.
## Test Requirements
Use Node 22.x and the locked dependency tree. Execute targeted Vitest security regressions, real PostgreSQL session integration, notification crash/concurrency tests, IPC negative tests, full affected unit and contract suites, lint, typecheck and build. Run the ordered governance gate and exact changed-file review; no empty-test pass or skipped mandatory case counts as PASS.

User-directed sequencing (2026-11-04): defer real Electron sandbox/preload execution and its security validation until after the preceding development work, at the pre-release acceptance milestone. Do not run those validations during current work. This is a scheduling deferral, not a waiver: retain sandbox enforcement, record the known production preload failure, and keep G2, M1, and release acceptance unpassed until the required evidence exists. Independent non-sandbox remediation may continue.

For the runtime scope revision, first reproduce the false positive; test an allowed historical write, a current out-of-scope write with an unrelated transaction name, malformed anchors and corruption in the historical chain. Run the complete Python governance suite and the actual TASK-721 gate with the anchored task start.
## Acceptance Criteria
Only EXPORT_AUDIT-authorized principals can export and denied requests perform no protected reads; mismatched deep links cannot return another object; active, expired and revoked PostgreSQL sessions are correct; untrusted IPC sources fail closed; confirmed notification delivery is not repeated and stale claims cannot confirm a newer lease. No secrets appear in UI, logs, SQLite, notifications or export.
## Done Definition
All G2 cases pass on the candidate, TASK-716 provenance is preserved, applicable facts are updated, runtime trace exits 0, exact file scope is verified and the report records commands, versions, counts, failures, skips and remaining limits. Missing environment or unsupported notification integration remains BLOCKED, not PASS.
## Risks
Authorization flaws can disclose protected data. Unknown external delivery outcomes cannot be blindly retried. Different PostgreSQL versions and Node versions cannot substitute for target evidence. A dirty or ambiguous worktree must never be removed.
## Output Required
docs/verification/reports/phase-007-task-721.md with direct evidence, candidate identity, G2 decision and explicitly unverified items.
