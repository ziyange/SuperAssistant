# TASK-607: Gemini SAI Adapter
## Status
APPROVED
PHASE: PHASE-006
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-077, REQ-078, REQ-090, REQ-091
## Objective
Implement the Gemini Core Adapter only after TASK-606 passes.
## Context Pack
- docs/api/sai.md
- docs/adapters/gemini.md
## Implementation Requirements
- Map cancellation, reconciliation and errors through SAI; opt-in smoke only.
## Done Definition
Deterministic conformance and opt-in smoke evidence pass.
## Must Read
- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/adapters/gemini.md
## Allowed Files
- packages/codex-adapter/src/gemini-adapter.ts
- packages/codex-adapter/tests/gemini-adapter.test.ts
- docs/adapters/gemini.md
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-607.md
- docs/verification/reports/phase-006-task-607.md
## Forbidden Files
Any file not explicitly listed; CLI terminal parsing; `--yolo`; auto-approval.
## Interfaces / Contracts
Stable SAI only; no provider Thread/Turn in product state.
## Data Constraints
Authentication uses opaque references.
## UI Constraints
Unavailable adapter stays Disabled.
## Test Requirements
Run fake contract, conformance, opt-in smoke, lint, typecheck, build and governance gates.
## Acceptance Criteria
All eight operations and failure modes conform.
## Risks
TASK-606 failure keeps this Pack blocked.
## Output Required
Report adapter evidence.
