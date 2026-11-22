# TASK-814: Deterministic loopback Team HTTP tests

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: User requested fixing test blockers without relaxing gates while continuing to merge readiness.

## Requirement IDs
REQ-081, REQ-082, REQ-090, REQ-092, REQ-093, REQ-095

## Objective
Remove the demonstrated Node fetch forbidden-port nondeterminism from real loopback Team HTTP integration tests while preserving actual server and authentication coverage.

## Context Pack
- docs/delivery/tasks/TASK-813.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-814.md
- docs/delivery/tasks/TASK-813.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- services/team/tests/team-api.test.ts

## Forbidden Files
Production application code, credentials, production databases, archived evidence, other worktrees, remote operations, real Codex and Electron sandbox tests.

## Interfaces / Contracts
Tests use real Node HTTP transport and a local server. Never trust a client actor header. A response must be fully read and the server closed on every path. Do not disable or skip assertions.

## Data Constraints
Synthetic identities and disposable localhost only; no production credentials.

## UI Constraints
No UI changes.

## Implementation Requirements
Replace browser-style fetch in the affected loopback tests with a bounded Node HTTP request helper. Add a regression using an available fetch-forbidden port and verify the real server responds through that helper. If all candidate ports are unavailable, fail with an explicit diagnostic rather than silently skip.

## Test Requirements
Demonstrate the existing fetch rejection on a real forbidden loopback port, then verify the new real HTTP request succeeds. Run the affected tests, full unit suite and contract suite; retain and report all skipped or failed cases.

## Acceptance Criteria
Actor spoofing is still rejected by the real HTTP adapter, session checks still execute, forbidden port is handled by the test client, and the full test gate is re-run without loosening timeouts or skip thresholds.

## Done Definition
Record actual evidence and distinguish the previously observed fetch failure from the reproduced generic forbidden-port cause. No remote CI or H1 acceptance is claimed.

## Risks
An earlier full-suite failure did not capture its allocated port, so the precise historical cause is unproven. Loopback services can fail for independent environmental reasons.

## Output Required
Real HTTP test helper and regression, verification evidence and updated TASK-813 result.

## Local evidence (2026-11-22)

- On this machine the dynamic port range begins at 1024. A disposable server on port 6000 reproduced `fetch failed / bad port`, while the same real Team HTTP service answered via the Node HTTP test client. The historical failure did not preserve its port; its exact cause remains unknown.
- The regression failed initially because the new loopback client was absent. All eight Team HTTP tests then passed, including identity spoofing, session handling and the forbidden-port case; no assertion or test was skipped.
- After one documented lint failure for an undeclared NodeJS type global, lint and typecheck passed. Full Windows unit: 707 passed, nine explicitly accounted skips, zero failed, 174 files. Full contract: 49 passed, zero skipped, eight files. Build passed for the same application code before this test-only change.
- The preceding TASK-813 final-unit failure and the unrecoverable sandbox contract report remain historical failures. This rerun is local evidence, not remote CI, native Electron acceptance or real Codex verification.
