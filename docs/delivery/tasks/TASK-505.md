# TASK-505: Accept PHASE-005 and prepare PHASE-006
## Status
APPROVED
PHASE: PHASE-005
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-066, REQ-067, REQ-068, REQ-069, REQ-090, REQ-096, REQ-099
## Objective
Run monitoring acceptance, archive PHASE-005, and prepare PHASE-006 packs.
## Context Pack
- docs/delivery/phase-005.md
- docs/archive/README.md
## Implementation Requirements
- Archive only after event, collector, aggregation and budget evidence passes.
## Done Definition
PHASE-005 archive and PHASE-006 readiness are complete.
## Must Read
- AGENTS.md
- docs/delivery/phase-005.md
- docs/archive/README.md
- docs/verification/quality-gate.md
## Allowed Files
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/ux.md
- docs/delivery/roadmap.md
- docs/delivery/phase-005.md
- docs/delivery/phase-006.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-505.md
- docs/verification/reports/phase-005-task-505.md
- docs/archive/phase-005/README.md
- docs/archive/phase-005/task-pack-snapshots.md
- docs/archive/phase-005/verification-evidence.md
- docs/archive/phase-005/acceptance-record.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
## Forbidden Files
Any file not explicitly listed; PHASE-006 implementation; remote actions; credentials.
## Interfaces / Contracts
PHASE-006 code remains blocked until PHASE-005 archive and approved Packs.
## Data Constraints
Archive never replaces active facts.
## UI Constraints
Monitoring health, aggregation and limit state are accessible.
## Test Requirements
Run event storm, retention, budget, lint, typecheck, build and governance gates.
## Acceptance Criteria
Monitoring exits pass and PHASE-006 packs are approved.
## Risks
Unknown signal origin or unapproved next packs blocks archive.
## Output Required
Return archive evidence and PHASE-006 readiness proof.
