# TASK-306: Align desktop React test runtime

## Status

APPROVED

PHASE: PHASE-003

MAX_ITERATIONS: 3

user_confirmed: true

## Requirement IDs

REQ-090, REQ-098, REQ-099

## Objective

Align Electron desktop React and React DOM versions with the root renderer test
runtime so one React dispatcher is loaded during App integration tests.

## Context Pack

- `docs/architecture.md`
- `docs/verification/test-strategy.md`

## Must Read

- AGENTS.md
- docs/architecture.md
- docs/verification/test-strategy.md
- docs/delivery/tasks/TASK-301.md

## Allowed Files

- apps/desktop/package.json
- package-lock.json
- docs/delivery/tasks/TASK-306.md
- docs/delivery/tasks/README.md
- docs/operations.md
- docs/verification/reports/phase-003-task-306.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- New dependencies, broad version ranges, production feature changes, IPC
  changes, migration changes, credentials, remote configuration or lockfile
  edits unrelated to React/React DOM resolution.

## Interfaces / Contracts

Desktop renderer and tests resolve one matching React/React DOM major-minor
runtime. No product API changes.

## Data Constraints

No data, SQLite schema, credentials, attempts, grants or artifacts change.

## UI Constraints

No visual or interaction behavior changes; this Pack only restores the ability
to execute existing React integration tests.

## Implementation Requirements

- Pin desktop `react` and `react-dom` to the version resolved by the root test
  runtime.
- Regenerate only the committed lockfile resolution.
- Prove the App renderer test no longer reports an invalid hook call.

## Test Requirements

Run the affected renderer test, `npm ls react react-dom --all`, lint,
typecheck, unit, contract, build and governance checks.

## Acceptance Criteria

One React version is resolved for the desktop renderer and testing-library
runtime; the App integration test executes hooks normally.

## Done Definition

All required checks pass and the report records the exact resolved versions.

## Risks

Dependency drift is fail-closed: any unrelated lockfile change blocks this
Task.

## Output Required

Return manifest/lock diff, dependency tree, test evidence and report path.
