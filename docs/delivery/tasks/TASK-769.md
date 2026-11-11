# TASK-769: Repair cross-platform governance fixture

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authorization: user authorized resolution of development-baseline merge blockers.

## Requirement IDs
REQ-092, REQ-093, REQ-096

## Objective
Correct the case-sensitive task path in the runtime verifier fixture revealed by Linux CI and use a compatible Windows native-build runner with explicit Python. Do not weaken verification, alter runtime semantics, or modify application behavior.

## Context Pack
- docs/verification/reports/phase-007-task-768.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-768.md

## Allowed Files
- docs/delivery/tasks/TASK-769.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- tests/test_verify_runtime_trace.py
- .github/workflows/docs-gates.yml
- .github/workflows/application-gates.yml
- docs/verification/reports/phase-007-task-769.md

## Forbidden Files
Application sources, source evidence, archived reports, user workspaces and TASK-716 WIP. No real Codex or sandbox tests, merge or cleanup.

## Interfaces / Contracts
Exact path case must be retained on Linux and native Windows normalization retained. Preserve all negative assertions and Merkle chain validation. Anchor documentation CI to this task.

## Data Constraints
Use disposable fixtures only. Do not modify existing test data or secrets.

## UI Constraints
No UI changes.

## Implementation Requirements
Use the same exact case in fixture pack and audit record. Pin the Windows runner to 2022 and pass the configured Python to node-gyp; preserve npm ci and every test. Re-run governance, fixed-SHA CI and affected tests.

## Test Requirements
Run python -m unittest discover -s tests -v, the complete governance sequence, git diff --check and both remote CI workflows.

## Acceptance Criteria
The formerly failing fixture passes on both platforms; all existing negative checks remain active and CI passes on the candidate SHA.

## Done Definition
Record local and remote results without assuming an unrun gate passed.

## Risks
Cross-platform normalization errors could invalidate evidence. Fail closed on any runtime error.

## Output Required
docs/verification/reports/phase-007-task-769.md
