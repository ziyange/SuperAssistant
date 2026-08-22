# TASK-609: Domain acceptance and PHASE-007 handoff
## Status
APPROVED
PHASE: PHASE-006
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-070, REQ-071, REQ-072, REQ-077, REQ-078, REQ-079, REQ-080, REQ-090, REQ-096, REQ-099
## Objective
Verify safe domain Artifact rendering, compatibility matrix and PHASE-007 readiness.
## Context Pack
- docs/ux.md
- docs/security.md
- docs/archive/README.md
## Implementation Requirements
- Malicious domain output remains isolated; prepare approved PHASE-007 Packs before archive.
## Done Definition
Domain E2E and next-phase readiness pass.
## Must Read
- AGENTS.md
- docs/ux.md
- docs/security.md
- docs/operations.md
- docs/archive/README.md
## Allowed Files
- apps/desktop/src/renderer/artifact-view.tsx
- apps/desktop/tests/renderer/artifact-view.test.tsx
- docs/ux.md
- docs/security.md
- docs/operations.md
- docs/delivery/phase-007.md
- docs/delivery/tasks/TASK-609.md
- docs/verification/reports/phase-006-task-609.md
- docs/archive/phase-006/README.md
## Forbidden Files
Any file not explicitly listed; unsanitized HTML; PHASE-007 implementation; remote actions.
## Interfaces / Contracts
Artifact preview follows safe MIME and provenance policy.
## Data Constraints
Untrusted output is quarantined or download-only.
## UI Constraints
No active content executes in renderer.
## Test Requirements
Run renderer, domain E2E, lint, typecheck, build and governance gates.
## Acceptance Criteria
PHASE-007 Packs are approved before PHASE-006 archive.
## Risks
Unsafe output blocks archive.
## Output Required
Report domain acceptance and enterprise handoff evidence.
