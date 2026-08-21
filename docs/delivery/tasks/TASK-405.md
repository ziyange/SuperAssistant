# TASK-405: Independent quality evidence

## Status

APPROVED

PHASE: PHASE-004

MAX_ITERATIONS: 6

user_confirmed: true

## Requirement IDs

REQ-054, REQ-055, REQ-062, REQ-063, REQ-064

## Objective

Add Testing and Inspector roles, independent evidence, and original-Task remediation.
## Context Pack
- docs/orchestration.md
- docs/security.md
## Implementation Requirements
- Require provenance-distinct quality evidence before acceptance.
## Done Definition
Independent evidence and remediation tests pass.

## Must Read

- AGENTS.md
- docs/product.md
- docs/orchestration.md
- docs/security.md
- docs/ux.md
- docs/delivery/phase-004.md

## Allowed Files

- packages/domain/src/quality-evidence.ts
- packages/domain/tests/quality-evidence.test.ts
- packages/persistence/src/sqlite/migrations/013-quality-evidence.sql
- packages/persistence/src/repositories/quality-evidence-repository.ts
- packages/persistence/tests/quality-evidence-repository.test.ts
- apps/desktop/src/renderer/quality-evidence.tsx
- apps/desktop/tests/renderer/quality-evidence.test.tsx
- apps/desktop/tests/e2e/quality-remediation.spec.ts
- docs/data-model.md
- docs/orchestration.md
- docs/security.md
- docs/ux.md
- docs/delivery/tasks/TASK-405.md
- docs/verification/reports/phase-004-task-405.md

## Forbidden Files

Any file not explicitly listed; executor-authored inspector evidence; replacement top-level Tasks.

## Interfaces / Contracts

Quality evidence identifies role, Agent, Function version, Attempt and authorization; rejection adds or reopens a Work Item under the original Task.

## Data Constraints

Evidence is immutable and independently attributable.

## UI Constraints

Acceptance rejection explains required remediation without representing completion.

## Test Requirements

Run provenance, remediation, renderer, Playwright, lint, typecheck, build and governance gates.

## Acceptance Criteria

An executor cannot satisfy its own independent quality requirement; remediation remains in one Task.

## Risks

Colluding self-verification fails closed.

## Output Required

Report independent-evidence and remediation evidence.
