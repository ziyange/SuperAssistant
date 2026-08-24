# TASK-714: Governed audit export and retention operations
## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-085, REQ-086, REQ-096, REQ-099
## Objective
Deliver an inventory-backed, access-checked audit export and legal-hold/retention operation workflow.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/operations.md
- docs/security.md
## Must Read
- AGENTS.md
- docs/data-model.md
- docs/architecture.md
- docs/decisions/ADR-003-authoritative-state-and-delivery.md
## Implementation Requirements
Exports cover all governed record classes, verify their manifest and remain append-only. Legal hold always wins; destructive execution is separately authorized.
## Done Definition
Audit API/export verification, record inventory, retention dry-run/execution, legal-hold and backup/restore evidence pass.
## Allowed Files
- services/team/src/governed-record-inventory.ts
- services/team/src/team-audit-export-service.ts
- services/team/src/retention-operation-service.ts
- services/team/src/team-api.ts
- services/team/src/postgres/team-repository.ts
- services/team/src/postgres/schema.ts
- services/team/tests/governed-record-inventory.test.ts
- services/team/tests/team-audit-export-service.test.ts
- services/team/tests/retention-operation-service.test.ts
- services/team/tests/audit-retention-api.contract.test.ts
- services/team/tests/postgres-team-repository.test.ts
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-714.md
- docs/verification/reports/phase-007-task-714.md
## Forbidden Files
Mutation of audit history, deletion of legal-held evidence, secret-bearing export or automatic destructive execution.
## Interfaces / Contracts
Export and retention operations are scoped to actor/Workspace, carry manifest/digest evidence and require a separate authorized destructive action.
## Data Constraints
Retention inventory includes holds, rollbacks, grants, attempts, audit and evidence records; Team PostgreSQL remains authority.
## UI Constraints
None; API returns a safe reason for held/deferred records without protected payload leakage.
## Test Requirements
Completeness/tamper/authorization tests, legal-hold deletion negatives, backup/restore rehearsal and governance gates.
## Acceptance Criteria
All governed records are accounted for; unqualified deletion is impossible and audit meaning survives restore.
## Risks
Incomplete inventory or non-verifiable export blocks the Task.
## Output Required
Audit/retention operation evidence.

## Approved scope expansion

- Approval: user authorization on 2026-08-24.
- Reason: durable governed inventory, legal-hold/retention state and
  backup/restore evidence require PostgreSQL authority tables and the existing
  disposable repository integration fixture.
- Added paths: `services/team/src/postgres/schema.ts` and
  `services/team/tests/postgres-team-repository.test.ts`.

## Gate status

- Recorded 2026-08-25: implementation evidence is complete, but the complete
  deterministic unit suite remains blocked by the unrelated
  `packages/dsh-adapter/tests/dsh-loader-guard.test.ts` five-second timeout.
  The test passes in isolation but fails under the full suite; it is outside
  this Pack's explicit allowlist and must be handled by a dedicated DSH Task.
