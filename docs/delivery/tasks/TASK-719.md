# TASK-719: DSH Loader full-suite stability

## Status

COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 2
user_confirmed: true

## Requirement IDs

REQ-090, REQ-096, REQ-099

## Objective

Make the public Cordis Loader Guard integration check deterministic when run
inside the complete Windows unit suite, without relaxing any DSH capability
denial assertion or changing production timeout behavior.

## Context Pack

- docs/delivery/phase-007-integration-recovery.md
- docs/delivery/tasks/TASK-714.md
- docs/operations.md

## Must Read

- AGENTS.md
- packages/dsh-adapter/tests/dsh-loader-guard.test.ts
- packages/dsh-adapter/src/dsh-tool-guard-plugin.ts
- docs/verification/quality-gate.md

## Implementation Requirements

The test synchronously builds the emitted Guard before the Cordis Loader mounts
it. Its test-only deadline must cover bounded Windows TypeScript startup under
full-suite load; it must remain finite and retain the same loader, allow and
deny assertions.

## Done Definition

The isolated Loader test and the complete deterministic unit suite pass twice
without changing production behavior, DSH policy, capability bindings or
default global test timeouts.

## Allowed Files

- packages/dsh-adapter/tests/dsh-loader-guard.test.ts
- docs/delivery/phase-007-integration-recovery.md
- docs/delivery/tasks/TASK-719.md
- docs/verification/reports/phase-007-task-719.md

## Forbidden Files

- packages/dsh-adapter/src/dsh-tool-guard-plugin.ts
- packages/dsh-adapter/src/dsh-tool-guard.ts
- package.json
- vitest.workspace.ts
- any production DSH policy, permission, capability or global timeout setting

## Interfaces / Contracts

No production interface changes. The public Cordis Loader contract still mounts
the emitted Guard and rejects outside-target and undeclared tools before body
dispatch.

## Data Constraints

No persistence, credentials, external process policy or runtime profile fact
may change.

## UI Constraints

Not applicable: this is a test-only stability correction.

## Test Requirements

- run the isolated Loader test;
- run the complete deterministic unit suite twice with one worker;
- run lint, typecheck and build;
- run governance gates and `git diff --check`.

## Acceptance Criteria

- The Loader test has a finite explicit deadline that accommodates its declared
  synchronous build step.
- Both complete-suite runs pass with the existing Guard assertions intact.
- No out-of-allowlist path changes.

## Risks

An unbounded or global timeout could mask a deadlock; changing DSH behavior
would be an unauthorized security regression.

## Output Required

`docs/verification/reports/phase-007-task-719.md` records both full-suite
runs, their outcomes and the exact deadline.
