# TASK-702: OIDC identity and membership
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-081, REQ-090, REQ-091, REQ-094, REQ-095
## Objective
Implement OIDC Authorization Code plus PKCE identity, sessions and invitations.
## Context Pack
- docs/security.md
- docs/architecture.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/operations.md
## Implementation Requirements
Validate issuer, audience, nonce, state, PKCE and expiry fail-closed.
## Done Definition
Identity and membership negative tests pass without token disclosure.
## Allowed Files
- services/team/src/identity.ts
- services/team/src/membership.ts
- services/team/tests/identity.test.ts
- services/team/tests/membership.test.ts
- docs/security.md
- docs/delivery/tasks/TASK-702.md
- docs/verification/reports/phase-007-task-702.md
## Forbidden Files
Any file not explicitly listed; implicit token trust; plaintext tokens.
## Interfaces / Contracts
Actor context is backward-compatible in SAI envelopes.
## Data Constraints
Only opaque session references persist.
## UI Constraints
Authentication failure exposes a safe reauthentication path only.
## Test Requirements
Run OIDC negative tests, typecheck and governance gates.
## Acceptance Criteria
Invalid issuer, audience, nonce or PKCE never produces a session.
## Risks
JWKS outage yields read-only degraded state.
## Output Required
OIDC conformance evidence.
