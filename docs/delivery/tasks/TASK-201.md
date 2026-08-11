# TASK-201: Implement Proposal authorization and preflight

## Status

DRAFT

PHASE: PHASE-002

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-008, REQ-009, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-031, REQ-090, REQ-091

## Objective

Classify read-only and side-effecting goals, route one Project and Codex Function, persist an immutable ProposalVersion, bind an AuthorizationGrant to the confirmed version, and fail preflight when any authority or snapshot input changes.

## Context Pack

- `docs/delivery/phase-002.md`
- `docs/security.md`
- `docs/orchestration.md`

## Must Read

- `AGENTS.md`
- `docs/product.md`
- `docs/requirements.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/orchestration.md`
- `docs/api/sai.md`

## Allowed Files

- packages/domain/src/proposal.ts
- packages/domain/src/authorization.ts
- packages/domain/src/preflight.ts
- packages/domain/src/routing.ts
- packages/domain/src/ports/proposal-repository.ts
- packages/domain/src/ports/policy-service.ts
- packages/domain/src/index.ts
- packages/domain/tests/proposal.test.ts
- packages/domain/tests/authorization.test.ts
- packages/domain/tests/preflight.test.ts
- packages/domain/tests/routing.test.ts
- packages/persistence/src/sqlite/migrations/002-proposal-authorization.sql
- packages/persistence/src/repositories/proposal-repository.ts
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/proposal-repository.test.ts
- apps/desktop/src/main/proposal-ipc.ts
- apps/desktop/src/main/preflight-service.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/proposal-review.tsx
- apps/desktop/tests/main/preflight-service.test.ts
- apps/desktop/tests/renderer/proposal-review.test.tsx
- apps/desktop/tests/e2e/proposal-confirmation.spec.ts
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/reports/phase-002-task-201.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Codex execution start, project mutation, tool approval, automatic confirmation, mutable approved Proposal content, remote operation, and plaintext credentials.

## Interfaces / Contracts

Goal classification returns `READ_ONLY` or `SIDE_EFFECTING` with reasons. ProposalVersion includes exact objective, Project snapshot, Agent/Function/version, Work Item scope, resource claims, allowed/forbidden actions, acceptance, expiration, and reconfirmation triggers. Confirmation creates one grant through an idempotent command.

## Data Constraints

ProposalVersion and AuthorizationGrant are immutable. Unique constraints bind one confirmation idempotency key to one grant and later one initial Attempt. Preflight compares Project, Agent, Function, capability, policy, authorization, branch/baseline, and resource versions in one deterministic result.

## UI Constraints

Read-only goals bypass the Proposal review and remain visibly read-only. Side-effecting goals show target, scope, prohibited actions, authorization, risks, acceptance, and changed-since-review facts. Confirm is disabled on failed or stale preflight.

## Implementation Requirements

- Keep model-generated Proposal suggestions separate from deterministic validation.
- Resolve routing ambiguity through explicit user selection.
- Persist confirmation actor, timestamp, exact version, expiry, and authorized resources/actions.
- Reconfirmation always creates a new Proposal version and grant; it never mutates history.

## Test Requirements

- Table-test goal classification including file, command, network, credential, and external-write cases.
- Test ambiguous Project routing with no guessed selection.
- Test duplicate confirmation, expiration, revocation, and every preflight invalidation input.
- Playwright proof that confirmation UI precedes any side effect and stale review disables execution.
- Run lint, typecheck, unit, repository, Playwright, and build.

## Acceptance Criteria

- `SCN-AUTH-READONLY` proves a read-only query creates no Proposal or grant.
- `SCN-AUTH-SIDE-EFFECT` proves project state is unchanged before confirmation.
- `SCN-PREFLIGHT-INVALIDATE` proves Project, Agent, Function, and grant changes invalidate preflight.
- Duplicate confirmation creates one grant and reserves one launch identity.

## Done Definition

All authorization and invalidation scenarios pass, immutable records are inspectable, no execution path is activated, facts are updated, and the draft is re-approved before implementation.

## Risks

`SECURITY_PERMISSION 0.600` is active and confirmed. Confused-deputy routing, stale authorization, TOCTOU, and double confirmation are critical. The Task Pack remains non-executable while status is DRAFT.

## Output Required

Return changed files, classification and invalidation matrices, record uniqueness evidence, Playwright results, command output, fact updates, and the phase report path.
