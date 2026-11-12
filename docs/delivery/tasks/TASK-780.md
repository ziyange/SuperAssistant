# TASK-780: Validate H1 Proposal candidate structural fields

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user requested autonomous remediation of the Proposal merge blocker.

## Requirement IDs
REQ-008, REQ-021, REQ-022, REQ-023, REQ-024, REQ-026, REQ-090, REQ-094

## Objective
Add a fail-closed structural validation boundary for specified single-WorkItem H1 Proposal candidate fields without enabling confirmation, persistence or execution.

## Context Pack
- docs/requirements.md
- docs/orchestration.md
- docs/data-model.md
- docs/delivery/tasks/TASK-201.md

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
- docs/delivery/tasks/TASK-780.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/orchestration.md
- packages/domain/src/proposal-candidate.ts
- packages/domain/src/index.ts
- packages/domain/tests/proposal-candidate.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-780.md

## Forbidden Files
All other files; do not modify historic Proposal or Grant records, open confirmation IPC, dispatch, execute Codex, edit application UI or access user projects.

## Interfaces / Contracts
Export parseH1ProposalCandidate(input: unknown), yielding a detached strictly validated candidate or throwing. The candidate requires objective, identities and pinned versions, exactly one required WorkItem with explicit empty dependencies, capability references, declared resource intents, allowed and forbidden action lists, reconfirmation triggers, explicit risk and measurable acceptance evidence descriptions. Reject unknown fields and unrecognized actions. Parsing alone is not authority, digest, persistence, referential integrity, path safety, policy evaluation or approval.

## Data Constraints
Do not alter migration 003, persisted legacy digests, or existing ProposalVersion APIs. No external effects or database changes. All nested fields must be copied from untrusted input by the parser.

## UI Constraints
No UI changes; candidate must not be represented as confirmable.

## Implementation Requirements
Document the strict boundary before implementation. Reuse the existing zod dependency and GoalAction definitions. Reject absent sections, whitespace-only identifiers, empty scope, mismatched Project/Agent/Function and unrecognized values.

## Test Requirements
Tests exercise valid full candidate, each missing field class, H1 cardinality and dependencies, identity mismatch, invalid/unknown action, unknown fields, malformed nested values and input mutation isolation. Run targeted tests, full unit and contract suites, lint, typecheck, build and governance.

## Acceptance Criteria
Malformed or incomplete examples cannot pass the structural boundary; a valid single-WorkItem fixture parses to a detached object. No claim is made that referenced entities exist or the candidate is authorized.

## Done Definition
Record actual verification results, retain legacy compatibility, verify runtime Exit 0 and file boundaries. Later tasks must integrate trusted persistence, actor confirmation and preflight before execution can be enabled.

## Risks
Structural validation cannot establish existence, capability availability, resource containment or safe execution; budgets, deadlines and validity windows also remain to be represented and validated before review. Fail closed outside this boundary.

## Output Required
docs/verification/reports/phase-007-task-780.md
