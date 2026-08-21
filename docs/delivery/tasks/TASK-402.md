# TASK-402: Version Agent Templates
## Status
APPROVED
PHASE: PHASE-004
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-051, REQ-052, REQ-053
## Objective
Add immutable Agent Template and Function versions compatible with H1 records.
## Context Pack
- docs/data-model.md
- docs/ux.md
## Implementation Requirements
- Pin immutable versions for active Work Items.
## Done Definition
Migration, compatibility and UI evidence are recorded.
## Must Read
- AGENTS.md
- docs/data-model.md
- docs/api/sai.md
- docs/ux.md
- docs/delivery/phase-004.md
## Allowed Files
- packages/domain/src/agent-template.ts
- packages/domain/tests/agent-template.test.ts
- packages/persistence/src/sqlite/migrations/010-agent-template.sql
- packages/persistence/src/repositories/agent-template-repository.ts
- packages/persistence/tests/agent-template-repository.test.ts
- apps/desktop/src/renderer/agent-template.tsx
- apps/desktop/tests/renderer/agent-template.test.tsx
- docs/data-model.md
- docs/ux.md
- docs/delivery/tasks/TASK-402.md
- docs/verification/reports/phase-004-task-402.md
## Forbidden Files
Any file not explicitly listed; mutable template edits; H1 record rewrites.
## Interfaces / Contracts
Active Work Items pin Template and Function versions.
## Data Constraints
Versions are append-only.
## UI Constraints
Template provenance is visible.
## Test Requirements
Run migration, domain, renderer, lint, typecheck, build and governance gates.
## Acceptance Criteria
Templates are immutable and H1 records remain readable.
## Risks
Version drift blocks dispatch.
## Output Required
Report migration and compatibility proof.
