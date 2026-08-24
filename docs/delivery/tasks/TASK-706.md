# TASK-706: Verifiable audit export
## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-085, REQ-096, REQ-099
## Objective
Export complete scoped governance evidence with integrity verification.
## Context Pack
- docs/security.md
- docs/operations.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/data-model.md
## Implementation Requirements
Use canonical scope manifests, checksums and Merkle verification.
## Done Definition
Export suite verifies coverage and detects tampering.
## Allowed Files
- services/team/src/audit-export.ts
- services/team/tests/audit-export.test.ts
- packages/domain/src/audit-manifest.ts
- packages/domain/tests/audit-manifest.test.ts
- docs/operations.md
- docs/delivery/tasks/TASK-706.md
- docs/delivery/tasks/README.md
- docs/verification/reports/phase-007-task-706.md
## Forbidden Files
Any file not explicitly listed; export of secrets; mutable audit history.
## Interfaces / Contracts
Exports contain scope, actor, time range, digest and verification result.
## Data Constraints
All governed records remain attributable without secret material.
## UI Constraints
Export initiation requires scoped authorization.
## Test Requirements
Run completeness and Merkle tamper tests plus governance gates.
## Acceptance Criteria
Checksum or Merkle mismatch fails verification.
## Risks
Incomplete scope is a hard export failure.
## Output Required
Auditable export evidence.

## Approved Scope Expansion

- 2026-08-24: completion writeback requires exactly
  `docs/delivery/tasks/README.md` so the execution registry cannot disagree
  with this completed Pack. No implementation scope is added.
