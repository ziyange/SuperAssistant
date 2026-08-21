# TASK-407: PHASE-004 deterministic DAG acceptance scenarios

## Status

APPROVED

PHASE: PHASE-004

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-054, REQ-056, REQ-057, REQ-058, REQ-059, REQ-060, REQ-061, REQ-062,
REQ-063, REQ-064, REQ-065, REQ-090, REQ-093, REQ-096, REQ-098

## Objective

Provide deterministic evidence for the thirty PHASE-004 DAG, resource-fencing
and independent-quality scenarios required for H2 acceptance.

## Context Pack

- docs/delivery/phase-004.md
- docs/orchestration.md
- docs/data-model.md
- docs/security.md

## Implementation Requirements

- Add exactly thirty independent, table-driven scenarios across DAG readiness,
  cycle rejection, resource conflicts, fencing and quality remediation.
- Exercise public domain contracts only; do not change production behavior
  unless a failing scenario proves a contract defect.
- Preserve the original Task identity for every remediation scenario.

## Done Definition

Thirty named deterministic scenarios pass, their focused evidence is recorded,
and no PHASE-005 code is introduced.

## Must Read

- AGENTS.md
- docs/delivery/phase-004.md
- docs/data-model.md
- docs/orchestration.md
- docs/security.md
- docs/delivery/tasks/TASK-403.md
- docs/delivery/tasks/TASK-404.md
- docs/delivery/tasks/TASK-405.md
- docs/verification/quality-gate.md

## Allowed Files

- packages/domain/tests/phase-004-dag-acceptance.test.ts
- docs/delivery/tasks/TASK-407.md
- docs/verification/reports/phase-004-task-407.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json

## Forbidden Files

Any file not explicitly listed; production source; persistence migrations;
PHASE-005 code; remote actions; credentials.

## Interfaces / Contracts

The scenarios use the published graph, scheduler and quality-evidence domain
interfaces. A detected contract defect blocks acceptance and requires a new,
separate, exact-file remediation Task Pack.

## Data Constraints

All examples are in-memory deterministic fixtures. Resource keys are canonical
and remediation remains under the original Task/Work Item identity.

## UI Constraints

No renderer change. Evidence must cover the state projected to the existing
aggregate and remediation views.

## Test Requirements

Run the focused Vitest file, full unit, contract and E2E suites, lint,
typecheck, build, governance checks and the build-mode runtime trace.

## Acceptance Criteria

Exactly thirty named scenarios pass; cycles and conflicting writes fail closed;
disjoint work remains schedulable; stale fences cannot write; executor
self-verification fails; rejection yields original-Task remediation.

## Risks

An uncovered production defect is not repaired in this pack. Record it and
stop for a separate bounded remediation pack.

## Output Required

Write a focused scenario count and full-gate evidence to
`docs/verification/reports/phase-004-task-407.md`.
