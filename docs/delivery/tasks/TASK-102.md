# TASK-102: Build the secure desktop shell and IPC boundary

## Status

APPROVED

PHASE: PHASE-001

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-002, REQ-005, REQ-090, REQ-091, REQ-093, REQ-094

## Objective

Implement the smallest secure Electron shell with isolated renderer, typed validated IPC, fixed primary navigation skeleton, and a restart-safe onboarding projection without domain execution behavior.

## Context Pack

- `docs/delivery/phase-001.md`
- `docs/security.md`
- `docs/ux.md`

## Must Read

- `AGENTS.md`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/ux.md`

## Allowed Files

- apps/desktop/src/main/main.ts
- apps/desktop/src/main/window-policy.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/navigation.tsx
- apps/desktop/src/renderer/onboarding.tsx
- apps/desktop/src/renderer/styles.css
- apps/desktop/tests/main/window-policy.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/renderer/navigation.test.tsx
- apps/desktop/tests/e2e/onboarding.spec.ts
- docs/security.md
- docs/ux.md
- docs/verification/reports/phase-001-task-102.md
- apps/desktop/index.html
- apps/desktop/tsconfig.json
- playwright.config.ts

## Approved Scope Expansion

Expansion 1 of 2 was approved by the user on 2026-08-12. The three exact
paths above are required to mount the bounded renderer, type-check the
implementation, and run the required browser acceptance suite. This expansion
does not permit dependency, privilege, IPC-channel, or product-scope changes.

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Node integration in the renderer, permissive preload bridges, arbitrary IPC channels, external navigation, credentials, persistence, Project writes, and Codex process startup.

## Interfaces / Contracts

Expose a frozen typed preload API whose channel names, request schemas, response schemas, actor context, and error envelopes match the secure IPC contract. Main validates every message and renderer receives no raw Electron or Node object.

## Data Constraints

The shell persists no product records directly. Onboarding state is accessed through a replaceable typed port. IPC rejects unknown fields, oversized inputs, path traversal payloads, and requests from an untrusted frame.

## UI Constraints

Provide exactly Super Assistant, Agent Center, Task Center, Project Center, and Settings as primary navigation. Super Assistant is default. H1 onboarding offers connect Codex, add Project, and start Task; Agent Template is absent.

## Implementation Requirements

- Enable context isolation, sandboxing, and a restrictive content security policy.
- Disable Node integration and unsafe navigation/window creation.
- Validate origin/frame, channel, payload, response, and error mapping.
- Make security behavior unit-testable without a graphical session.

## Test Requirements

- Unit-test every allowed channel and representative unknown, malformed, oversized, and traversal request.
- Assert the renderer cannot access Node, Electron, environment variables, or arbitrary IPC.
- Run Electron Playwright for default page, all five navigation destinations, and onboarding restart projection.
- Run lint, typecheck, unit, e2e, and build.

## Acceptance Criteria

- Security negative tests reject every undeclared capability.
- No renderer bundle contains Node/Electron privileged imports.
- Primary navigation and H1 onboarding satisfy REQ-002 and REQ-005.
- Application restart restores only validated onboarding projection state.

## Done Definition

The shell launches, security and UX tests pass, no privileged product action is reachable, documentation matches the implemented IPC boundary, and evidence is recorded.

## Risks

`SECURITY_PERMISSION 0.600` is the active card with `user_confirmed: true`. Principal risks are renderer privilege escalation, confused IPC authority, malicious navigation, and accidental exposure of future Template routes; deny-by-default tests are mandatory.

## Output Required

Return changed files, IPC channel inventory, negative-test matrix, Playwright evidence, build result, and the phase report path.
