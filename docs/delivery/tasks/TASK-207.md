# TASK-207: Separate unit and contract test selection

## Status

COMPLETED

PHASE: PHASE-002

MAX_ITERATIONS: 3

user_confirmed: true

## Requirement IDs

REQ-090, REQ-092, REQ-093, REQ-096, REQ-099

## Objective

Make the Vitest unit and contract projects mutually exclusive so each test has
one owner and PHASE-002 gates do not duplicate expensive fixture processes.

## Context Pack

- `docs/operations.md`
- `docs/verification/quality-gate.md`
- `docs/verification/test-strategy.md`

## Must Read

- AGENTS.md
- docs/operations.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
- docs/delivery/tasks/TASK-206.md

## Allowed Files

- vitest.workspace.ts
- package.json
- docs/operations.md
- docs/delivery/tasks/TASK-207.md
- docs/delivery/tasks/README.md
- docs/verification/reports/phase-002-task-207.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Test timeout increases, test skips, production source changes, dependency
  changes, renderer changes, and behavior changes.

## Interfaces / Contracts

`npm run test:unit` owns non-contract `*.test.ts` files. `npm run
test:contract` owns `*.contract.test.ts` files. No test file may be selected
by both projects.

## Data Constraints

No persistent data, migrations, credential references, or Artifact metadata
are changed.

## UI Constraints

No UI behavior, IPC surface, or Electron packaging changes are allowed.

## Implementation Requirements

- Retain the existing source aliases.
- Exclude contract test paths from the unit project while retaining all other
  existing unit paths.
- Bind each stable root test script to its named Vitest project.
- Prove the full unit and contract commands pass independently without
  duplicated contract execution.

## Test Requirements

Run `npm run test:unit`, `npm run test:contract`, lint, typecheck, build, and
the runtime trace after verifying the configuration change.

## Acceptance Criteria

The unit and contract commands each pass and no `*.contract.test.ts` result is
reported by the unit project.

## Done Definition

The config boundary and operations fact are current, all required checks pass,
and the phase report records exact test totals and command results.

## Risks

An exclusion could accidentally hide a unit test. The task therefore changes
only the contract-path exclusion and relies on the full independent suites to
prove both selections.

## Output Required

Return changed files, per-suite test evidence, command results, and the phase
report path.
