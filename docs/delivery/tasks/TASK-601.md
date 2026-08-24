# TASK-601: Generic adapter manifest
## Status
COMPLETED
PHASE: PHASE-006
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-077, REQ-078, REQ-079, REQ-090, REQ-091
## Objective
Create a versioned generic Adapter manifest and conformance onboarding gate.
## Context Pack
- docs/api/sai.md
- docs/security.md
## Implementation Requirements
- Disabled-by-default adapters expose capability, auth-reference and error mapping metadata only after conformance.
## Done Definition
Manifest validation and disabled incompatible Adapter evidence pass.
## Must Read
- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/delivery/phase-006.md
## Allowed Files
- packages/domain/src/adapter-manifest.ts
- packages/domain/src/index.ts
- packages/domain/tests/adapter-manifest.test.ts
- packages/codex-adapter/src/adapter-manifest.ts
- packages/codex-adapter/tests/adapter-manifest.test.ts
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-601.md
- docs/verification/reports/phase-006-task-601.md
## Forbidden Files
Any file not explicitly listed; provider Thread/Turn UI; credentials; automatic enablement.
## Interfaces / Contracts
Manifest preserves SAI 1.0 operations and fails unknown capabilities closed.
## Data Constraints
Only opaque credential references may appear.
## UI Constraints
Unconformant adapters show Disabled with a reason.
## Test Requirements
Run manifest, conformance, lint, typecheck, build and governance gates.
## Acceptance Criteria
An Adapter without complete conformance remains DISABLED.
## Risks
Provider drift fails closed.
## Output Required
Report adapter manifest and conformance evidence.
