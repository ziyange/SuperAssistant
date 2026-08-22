# TASK-609: Domain acceptance and PHASE-007 handoff
## Status
COMPLETED
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
- docs/delivery/tasks/TASK-701.md
- docs/delivery/tasks/TASK-702.md
- docs/delivery/tasks/TASK-703.md
- docs/delivery/tasks/TASK-704.md
- docs/delivery/tasks/TASK-705.md
- docs/delivery/tasks/TASK-706.md
- docs/delivery/tasks/TASK-707.md
- docs/delivery/tasks/TASK-708.md
- docs/delivery/tasks/TASK-709.md
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

## Approved Scope Expansion

- 2026-08-22: the approved H1-H3 execution plan requires TASK-609 to prepare
  the nine exact PHASE-007 Task Packs before a PHASE-006 archive. The original
  allowlist omitted their individual paths. This bounded expansion adds only
  those nine documents; it authorizes no PHASE-007 implementation, remote
  action, or change to the Gemini BLOCKED conclusion.

## Outcome

Domain Artifact isolation and the bounded PHASE-007 handoff documents are
complete. PHASE-006 itself remains unarchived because TASK-606 blocks the
required Gemini Adapter path; this Task Pack does not authorize a workaround.
