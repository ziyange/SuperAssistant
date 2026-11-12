# TASK-781: Bound H1 Proposal candidate time and budget

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user requested continuous autonomous remediation of Proposal merge blockers.

## Requirement IDs
REQ-021, REQ-022, REQ-024, REQ-025, REQ-026, REQ-090, REQ-098

## Objective
Add explicit time and budget fields to the non-authoritative H1 candidate parser while retaining fail-closed confirmation and execution.

## Context Pack
- docs/requirements.md
- docs/data-model.md
- docs/orchestration.md
- docs/delivery/tasks/TASK-780.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-781.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/orchestration.md
- packages/domain/src/proposal-candidate.ts
- packages/domain/tests/proposal-candidate.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-781.md

## Forbidden Files
All other files; no persistence, user data, Grant creation, UI confirmation or execution.

## Interfaces / Contracts
Candidate requires canonical UTC millisecond createdAt, expiresAt and deadlineAt; expiration and deadline must follow creation. A strict budget object requires positive safe-integer maxDurationMs, explicitly nullable nonnegative safe-integer maxTokens, and explicitly nullable maxCost containing nonnegative safe-integer minorUnits and a three-letter uppercase currency code. Null indicates no numeric limit was supplied, not permission for unbounded execution. Parser has no trusted clock, authorization or budget enforcement.

## Data Constraints
Existing persisted ProposalVersion and digests remain unchanged. Candidate is unpersisted, not approvable, and parsing never produces a Grant or external effect.

## UI Constraints
No UI or presentation changes.

## Implementation Requirements
Document the candidate contract first. Validate real canonical UTC timestamps, temporal order, numeric bounds and strict object shape; preserve detached nested output and existing candidate field checks.

## Test Requirements
Add failing tests for missing limits, invalid timestamps and order, negative, fractional, unsafe or malformed budgets, currency shape, unknown budget fields, and detached budget output. Run targeted tests, build, lint, typecheck, unit, contract and governance.

## Acceptance Criteria
Only structurally valid explicit time and budget values pass; no claim is made about current validity, currency existence, authorization or enforcement.

## Done Definition
Record actual evidence, runtime Exit 0 and exact file boundaries. Persisting, validating against trusted facts and live policy enforcement remain separate required tasks.

## Risks
Null budget dimensions do not authorize unlimited spending. No existing execution path may infer approval or capability from a parsed candidate.

## Output Required
docs/verification/reports/phase-007-task-781.md
