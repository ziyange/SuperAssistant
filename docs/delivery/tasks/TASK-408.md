# TASK-408: Enforce hierarchical resource conflicts

## Status

APPROVED

PHASE: PHASE-004

MAX_ITERATIONS: 3

user_confirmed: true

## Requirement IDs

REQ-059, REQ-060, REQ-061, REQ-090, REQ-093, REQ-096, REQ-098

## Objective

Block canonical parent and descendant resource claims before dispatch while
retaining concurrent scheduling for disjoint resource trees.

## Context Pack

- docs/delivery/phase-004.md
- docs/orchestration.md
- docs/data-model.md
- docs/security.md

## Implementation Requirements

- Treat equal keys and colon-delimited ancestor/descendant keys as conflicts.
- Preserve deterministic request ordering and fencing for disjoint keys.
- Repair only the domain scheduler contract reproduced by TASK-407.

## Done Definition

The preserved failing scenario passes; hierarchy conflicts fail closed; all
existing suites remain green.

## Must Read

- AGENTS.md
- docs/delivery/phase-004.md
- docs/orchestration.md
- docs/data-model.md
- docs/security.md
- docs/delivery/tasks/TASK-404.md
- docs/delivery/tasks/TASK-407.md
- docs/verification/quality-gate.md

## Allowed Files

- packages/domain/src/resource-scheduler.ts
- packages/domain/tests/resource-scheduler.test.ts
- packages/domain/tests/phase-004-dag-acceptance.test.ts
- docs/delivery/tasks/TASK-408.md
- docs/verification/reports/phase-004-task-407.md
- docs/verification/reports/phase-004-task-408.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json

## Forbidden Files

Any file not explicitly listed; persistence migrations; renderer code;
PHASE-005 code; remote actions; credentials.

## Interfaces / Contracts

`scheduleResources` keeps its input and output shape. Its conflict predicate
blocks an equal key or either colon-delimited ancestor/descendant relation.

## Data Constraints

No schema change. A blocked request receives no fencing token.

## UI Constraints

No renderer change; existing conflict projections remain the sole UI path.

## Test Requirements

Run focused acceptance and scheduler tests, then full unit, contract, E2E,
lint, typecheck, build, governance and build-mode runtime-trace gates.

## Acceptance Criteria

Project and descendant claims block each other, disjoint Projects still run
concurrently, and blocked claims receive no usable fence.

## Risks

Only `:` component boundaries define hierarchy; raw string prefixes must not
block unrelated resource keys.

## Output Required

Record TASK-407 red evidence and TASK-408 green evidence in their exact
verification reports.
