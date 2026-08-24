# TASK-718: H3 truthful closeout and maintenance handoff
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
## Requirement IDs
REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-087, REQ-088, REQ-089, REQ-090, REQ-096, REQ-099
## Objective
Write back only verified H3 facts, archive PHASE-007 and prepare long-term maintenance after TASK-711–717 pass.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/archive/README.md
- docs/verification/reports/phase-007-task-717.md
## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/architecture.md
- docs/security.md
- docs/operations.md
## Implementation Requirements
Do not archive on plan or partial evidence. PHASE-007 is terminal: maintenance handoff replaces a PHASE-008 Pack.
## Done Definition
All H3 gates pass, active facts reflect actual system and immutable archive/handoff evidence is complete.
## Allowed Files
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/delivery/roadmap.md
- docs/delivery/phase-007.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-718.md
- docs/verification/reports/phase-007-task-718.md
- docs/archive/phase-007/README.md
- docs/archive/phase-007/summary.md
- docs/archive/phase-007/known-issues.md
- docs/archive/phase-007/next-phase-handoff.md
## Forbidden Files
PHASE-008 Pack, archive rewrite, completion claim without evidence, merge/push/release action.
## Interfaces / Contracts
No closeout changes an accepted public contract without a superseding ADR.
## Data Constraints
Archive contains redacted evidence references and no credentials or personal data.
## UI Constraints
Writeback records actual validated accessibility behavior only.
## Test Requirements
Full governance sequence, H3 system suite, lint, typecheck, build and fresh runtime Exit 0.
## Acceptance Criteria
Every H3 requirement and lifecycle scenario has current evidence; no blocking Decision, unknown outcome or security incident remains.
## Risks
Any evidence gap leaves PHASE-007 reopened.
## Output Required
H3 archive and maintenance handoff only after acceptance.
