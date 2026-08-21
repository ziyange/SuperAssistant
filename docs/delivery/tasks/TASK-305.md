# TASK-305: Accept H1 and prepare PHASE-004

## Status

APPROVED

PHASE: PHASE-003

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-003, REQ-040, REQ-041, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048,
REQ-049, REQ-090, REQ-091, REQ-092, REQ-093, REQ-094, REQ-095, REQ-096,
REQ-097, REQ-098, REQ-099

## Objective

Run H1 end-to-end acceptance evidence, write back facts, prepare and approve
PHASE-004 Packs, then archive PHASE-003 if every gate is satisfied.

## Context Pack

- `docs/delivery/phase-003.md`
- `docs/archive/README.md`
- `docs/verification/quality-gate.md`

## Must Read

- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/delivery/phase-003.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
- docs/archive/README.md

## Allowed Files

- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/operations.md
- docs/ux.md
- docs/delivery/README.md
- docs/delivery/roadmap.md
- docs/delivery/phase-003.md
- docs/delivery/phase-004.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-305.md
- docs/delivery/tasks/TASK-401.md
- docs/delivery/tasks/TASK-402.md
- docs/delivery/tasks/TASK-403.md
- docs/delivery/tasks/TASK-404.md
- docs/delivery/tasks/TASK-405.md
- docs/delivery/tasks/TASK-406.md
- docs/verification/reports/phase-003-task-305.md
- docs/archive/phase-003/README.md
- docs/archive/phase-003/task-pack-snapshots.md
- docs/archive/phase-003/verification-evidence.md
- docs/archive/phase-003/acceptance-record.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Production source, dependencies, migrations, credentials, remote actions,
  Git refs, or unapproved PHASE-004 implementation.

## Interfaces / Contracts

H1 ends only when the full single-task, Decision, audit, acceptance and
recovery contracts have current evidence. PHASE-004 code stays blocked until
PHASE-003 archives and its Packs are approved.

## Data Constraints

Use deterministic fixtures and approved disposable smoke evidence only. Archive
copies never replace active facts.

## UI Constraints

Evidence includes keyboard-capable H1 paths, safe degraded states and no hidden
provider-native control surface.

## Implementation Requirements

- Run H1 workload, recovery, performance and accessibility evidence.
- Snapshot completed Packs and current facts.
- Create and validate TASK-401–406 before archival.

## Test Requirements

Run all application, governance, performance, accessibility, fake Adapter and
explicitly enabled disposable real-Codex checks required by PHASE-003 facts.

## Acceptance Criteria

H1 quantitative gates pass, every required scenario has evidence, and
PHASE-004 Packs are approved with `user_confirmed: true`.

## Done Definition

PHASE-003 is archived only after all Task Packs pass and H1 evidence plus
PHASE-004 readiness is complete.

## Risks

Missing real smoke, unresolved security event, unknown execution, or unapproved
next-phase Pack blocks archival.

## Output Required

Return H1 acceptance decision, archive evidence, next-pack proof and report.
