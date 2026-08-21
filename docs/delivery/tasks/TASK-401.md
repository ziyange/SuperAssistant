# TASK-401: Publish SAI 1.0 conformance
## Status
APPROVED
PHASE: PHASE-004
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-050, REQ-061, REQ-065, REQ-078
## Objective
Publish version negotiation and an eight-operation SAI conformance kit.
## Context Pack
- docs/api/sai.md
- docs/adapters/codex.md
## Implementation Requirements
- Keep H1 envelope compatibility and fail incompatible adapters closed.
## Done Definition
Conformance evidence and current facts are recorded.
## Must Read
- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/delivery/phase-004.md
## Allowed Files
- packages/domain/src/ports/execution-port.ts
- packages/domain/tests/execution-port.test.ts
- packages/codex-adapter/src/conformance.ts
- packages/codex-adapter/tests/conformance.test.ts
- docs/api/sai.md
- docs/architecture.md
- docs/delivery/tasks/TASK-401.md
- docs/verification/reports/phase-004-task-401.md
## Forbidden Files
Any file not explicitly listed; provider Thread/Turn in product contracts; production credentials.
## Interfaces / Contracts
`describe`, `health`, `start`, `resume`, `cancel`, `status`, `events`, and `result` negotiate a backward-compatible SAI 1.0 range.
## Data Constraints
Conformance fixtures contain no secrets and preserve H1 envelope fields.
## UI Constraints
Unavailable adapters are truthfully disabled.
## Test Requirements
Run conformance, contract, unit, lint, typecheck, build, governance and runtime trace.
## Acceptance Criteria
Every operation and required error category passes deterministic conformance.
## Risks
Incompatible adapters remain disabled.
## Output Required
Report version matrix and retained fixture evidence.
