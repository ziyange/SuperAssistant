# TASK-101: Create the repository and test foundation

## Status

APPROVED

PHASE: PHASE-001

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-001, REQ-019, REQ-090, REQ-092, REQ-093, REQ-095, REQ-096

## Objective

Create the Node 22 npm-workspace foundation, TypeScript/lint/test/build configuration, package boundaries, and deterministic fixture policy required by later Phase 1 packs.

## Context Pack

- `docs/delivery/phase-001.md`
- `docs/architecture.md`
- `docs/operations.md`

## Must Read

- `AGENTS.md`
- `docs/requirements.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/operations.md`
- `docs/decisions/ADR-001-local-first.md`

## Allowed Files

- .nvmrc
- package.json
- package-lock.json
- tsconfig.base.json
- eslint.config.mjs
- vitest.workspace.ts
- playwright.config.ts
- apps/desktop/package.json
- apps/desktop/tsconfig.json
- apps/desktop/vite.config.ts
- apps/desktop/index.html
- packages/domain/package.json
- packages/domain/tsconfig.json
- packages/persistence/package.json
- packages/persistence/tsconfig.json
- packages/codex-adapter/package.json
- packages/codex-adapter/tsconfig.json
- tests/fixtures/README.md
- docs/architecture.md
- docs/operations.md
- docs/verification/reports/phase-001-task-101.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Application source modules, migrations, credentials, runtime databases, and Git remote configuration.

## Interfaces / Contracts

Define npm workspace names and dependency direction: desktop may depend on domain and persistence ports; persistence implements domain ports; codex-adapter depends only on SAI-neutral contracts. No renderer imports main-process or credential modules.

## Data Constraints

No production schema or database is created. Lockfile resolution must be deterministic. Node support is exactly the documented 22.x line and governance Python remains outside the application dependency graph.

## UI Constraints

The desktop package may expose only an empty testable host document. Do not implement navigation, styling, or product components.

## Implementation Requirements

- Use npm workspaces and committed lockfile.
- Configure strict TypeScript, ESLint, Vitest workspaces, and Electron Playwright entry points.
- Define focused scripts for lint, typecheck, unit, contract, e2e, build, and opt-in smoke.
- Keep real Codex smoke disabled unless its explicit environment switch is present.

## Test Requirements

- Install using the committed lockfile.
- Run lint and typecheck against empty package entry contracts.
- Prove a deliberately failing fixture test is discovered, then restore the passing fixture.
- Run build configuration validation without creating application behavior.

## Acceptance Criteria

- Node 22 installation with the lockfile resolves reproducibly.
- Each workspace is independently typechecked and included in the root test/build commands.
- The test runner fails on a failing assertion and passes on the restored fixture.
- Real Codex smoke is skipped by default with an explicit reason.

## Done Definition

Foundation commands pass locally, the package graph follows architecture dependency rules, documentation reflects actual scripts, and the verification report records versions and outputs.

## Risks

`SECURITY_PERMISSION 0.600` remains active with `user_confirmed: true`; package scripts must not download or execute undeclared postinstall code without review. Lockfile drift and test-runner false positives are controlled by clean-install and negative-fixture evidence.

## Output Required

Return changed files, dependency and runtime versions, package graph, exact command results, skipped smoke reason, and the phase report path.
