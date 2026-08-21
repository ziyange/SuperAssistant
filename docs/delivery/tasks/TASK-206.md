# TASK-206: Stabilize Codex fake App Server contract timing

## Status

COMPLETED

PHASE: PHASE-002

MAX_ITERATIONS: 3

user_confirmed: true

## Requirement IDs

REQ-014, REQ-015, REQ-017, REQ-018, REQ-090, REQ-091, REQ-093

## Objective

Make the stdio discovery and fake execution contract suites deterministic under
full Vitest concurrency, without weakening fail-closed behavior or changing
the production discovery timeout.

## Context Pack

- `docs/adapters/codex.md`
- `docs/operations.md`
- `docs/security.md`

## Must Read

- AGENTS.md
- docs/adapters/codex.md
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-105.md

## Allowed Files

- packages/codex-adapter/src/stdio-transport.ts
- packages/codex-adapter/tests/discovery.contract.test.ts
- packages/codex-adapter/tests/execution.contract.test.ts
- docs/adapters/codex.md
- docs/operations.md
- docs/delivery/tasks/TASK-206.md
- docs/delivery/tasks/README.md
- docs/verification/reports/phase-002-task-206.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Protocol changes, production discovery-timeout increases, production Codex calls, credentials, or renderer changes.

## Interfaces / Contracts

Malformed frames, timeout, and child exit remain distinct fail-closed outcomes.
Test-only watchdogs may exceed the frozen production discovery timeout only to
allow concurrent fixture process startup; each fixture operation remains
bounded and kills its child on expiry.

## Data Constraints

This Task Pack changes no persisted records, migrations, Artifact data, or
credentials. Test fixtures remain non-production and create no Codex work.

## UI Constraints

No renderer, preload, desktop navigation, or user-visible state changes are
allowed.

## Implementation Requirements

- Drain an already-buffered stdout discovery frame before classifying a child
  exit as an exit failure.
- Keep timeout, malformed frame, process error, and exit errors fail-closed and
  distinguishable.
- Bound every test fixture process, terminate it on a test watchdog timeout,
  and retain the frozen five-second production discovery default.

## Test Requirements

`npm run test:contract -- --run packages/codex-adapter/tests/discovery.contract.test.ts packages/codex-adapter/tests/execution.contract.test.ts`, full `npm run test:unit`, lint, typecheck, and runtime trace.

## Acceptance Criteria

The discovery and execution fixtures are deterministic under full concurrency,
exit states are reported as exits rather than timeouts, and a hung fixture is
killed by its test-only watchdog.

## Done Definition

The targeted discovery and execution tests, the full unit suite, lint,
typecheck, build, and runtime trace pass with evidence in the phase report.

## Risks

Longer test-only watchdogs could hide a fixture hang if they were unbounded.
They are therefore limited to five seconds per fixture operation and twenty
seconds per aggregate test; production adapter timing remains unchanged.

## Output Required

Contract evidence and phase report.
