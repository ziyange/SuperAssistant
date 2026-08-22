# TASK-606: Gemini compatibility probe
## Status
APPROVED
PHASE: PHASE-006
MAX_ITERATIONS: 3
user_confirmed: true
## Requirement IDs
REQ-077, REQ-078
## Objective
Probe fixed Gemini CLI/Core 0.55.1 against all SAI operations.
## Context Pack
- docs/api/sai.md
- docs/security.md
## Implementation Requirements
- Use Core programmatic API; headless JSON is black-box fixture only.
## Done Definition
Conformance result is PASS or documented BLOCKED without weakening SAI.
## Must Read
- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
## Allowed Files
- package.json
- package-lock.json
- packages/codex-adapter/tests/gemini-probe.test.ts
- docs/adapters/gemini.md
- docs/operations.md
- docs/delivery/tasks/TASK-606.md
- docs/verification/reports/phase-006-task-606.md
## Forbidden Files
Any file not explicitly listed; `--yolo`; production adapter; credential.
## Interfaces / Contracts
All eight SAI operations must be representable.
## Data Constraints
Fixtures contain no secrets.
## UI Constraints
Failed probe displays Disabled.
## Test Requirements
Run fixture conformance and governance gates.
## Acceptance Criteria
Missing reconciliation/status/events/result blocks production adapter.
## Risks
Probe failure blocks TASK-607.
## Output Required
Report fixed-version capability matrix.

## Approved Revision

- 2026-08-22: user authorized a one-time exact dependency probe after the
  initial blocked evidence. `@google/gemini-cli-core@0.55.1` may be added only
  through the lockfile, then exercised by deterministic fixture tests. This
  revision does not authorize production Adapter code, terminal-text parsing,
  credentials, `--yolo`, or any weakening of SAI.
