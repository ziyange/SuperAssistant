# TASK-712: OIDC PKCE, sessions and membership integration
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-081, REQ-090, REQ-094, REQ-099
## Objective
Implement the generic OIDC Authorization Code + PKCE boundary, secure sessions and durable Team membership on top of TASK-711.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/security.md
- docs/data-model.md
## Must Read
- AGENTS.md
- docs/architecture.md
- docs/operations.md
- docs/decisions/ADR-006-team-authority-and-oidc.md
## Implementation Requirements
Validate issuer, audience, nonce, state, PKCE and JWKS before every session; invalid identity state is read-only/fail-closed.
## Done Definition
Fixture-IdP/JWKS, session renewal/revocation and invitation/membership flows have durable scoped evidence.
## Allowed Files
- services/team/src/oidc/jwks-cache.ts
- services/team/src/oidc/oidc-client.ts
- services/team/src/session-service.ts
- services/team/src/membership-service.ts
- services/team/src/team-api.ts
- services/team/tests/oidc-client.test.ts
- services/team/tests/session-service.test.ts
- services/team/tests/membership-service.test.ts
- services/team/tests/oidc-api.contract.test.ts
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/delivery/tasks/TASK-712.md
- docs/verification/reports/phase-007-task-712.md
## Forbidden Files
Issuer/audience/nonce/PKCE bypass, token logging, static production secrets or remote identity configuration.
## Interfaces / Contracts
Identity success produces an opaque session reference only; actor and Workspace are resolved server-side.
## Data Constraints
No raw token, code verifier or credential value persists after its required lifetime.
## UI Constraints
Unauthenticated or expired Team sessions expose no protected record.
## Test Requirements
Fixture OIDC/JWKS contract tests, expiry/rotation/replay negatives, PostgreSQL membership tests and governance gates.
## Acceptance Criteria
Every authenticated Team request derives its actor from a verified session and no failed identity path gains write access.
## Risks
JWKS outage and identity ambiguity must fail closed.
## Output Required
OIDC/session/membership evidence.
