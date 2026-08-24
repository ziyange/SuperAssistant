# TASK-613: DSH public Loader Guard mount

## Status

COMPLETED

PHASE: PHASE-006

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-077, REQ-078, REQ-090, REQ-091, REQ-095, REQ-096

## Objective

Prove that the version-pinned Super Assistant Guard is loadable by the public
Cordis Loader through a configuration-relative module reference, and that its
immutable Attempt policy denies an undeclared or unauthorized call before any
ToolRuntime body is reached. This Task performs no model, provider, DSH process,
Shell, filesystem, network, or plugin capability operation.

## Context Pack

- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/adapters/dsh.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/verification/reports/phase-006-task-612.md

## Must Read

- AGENTS.md
- docs/README.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/adapters/dsh.md
- docs/delivery/tasks/TASK-613.md

## Allowed Files

- package-lock.json
- packages/dsh-adapter/package.json
- packages/dsh-adapter/src/dsh-tool-guard-plugin.ts
- packages/dsh-adapter/tests/dsh-loader-guard.test.ts
- packages/dsh-adapter/fixtures/loader/cordis.yml
- docs/adapters/dsh.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-613.md
- docs/verification/reports/phase-006-task-613.md

## Forbidden Files

Every file under `E:\Programs\deepseek-harness`; any provider/model or DSH
process invocation; credential; Shell, filesystem, network, or plugin capability
execution; plugin installation/update/enable inside DSH; production profile;
remote Git action; and all files not explicitly listed above.

## Interfaces / Contracts

The plugin exports public Cordis metadata (`name`, `inject`, `apply`) and mounts
only a monotonic `ToolRuntime.guard`. Its loader configuration supplies an
already-canonical immutable Attempt policy and exact tool-to-capability binding.
No configuration can hot-reload authority or force-allow another Guard's denial.

## Data Constraints

Fixture configuration is nonsecret and disposable. It contains no credential,
prompt, provider, session, tool result, or mutable DSH state. The test may keep
only in-memory guard observations.

## UI Constraints

None. DSH remains Disabled.

## Implementation Requirements

- Pin the public Cordis Loader package version in package and lock metadata.
- Load the emitted Guard plugin through a relative fixture configuration using
  the public Loader API, not a hand-shaped runtime substitute.
- Prove a permitted declared call reaches no ToolRuntime body and an undeclared
  or target-denied call is denied synchronously before dispatch.
- Dispose the Loader context in every test path. Any loader, module, policy, or
  guard failure leaves DSH Disabled.

## Test Requirements

Write the Loader-mount test first. Run focused Loader/Guard tests, typecheck,
build, lint, deterministic unit and contract suites, Playwright, governance
checks, runtime trace, and `git diff --check`.

## Acceptance Criteria

- The public Loader resolves the relative emitted Guard module and exposes its
  plugin identity.
- The mounted Guard allows only an exact declared policy binding and blocks an
  undeclared or target-denied operation before a ToolRuntime body executes.
- No prohibited DSH capability, process, provider, credential, or remote
  operation occurs.
- Loader/profile mismatch fails closed and records DSH as Disabled.

## Done Definition

Public Loader mount evidence and all required gates pass without any provider,
model, DSH process, or capability effect.

## Risks

The public Loader package or relative-resolution semantics can drift. Any drift
is a blocking compatibility failure and must not be bypassed with a substitute
runtime.

## Output Required

`docs/verification/reports/phase-006-task-613.md` records exact dependency
versions, fixture path, Guard decisions, no-effect evidence, commands, and
PASS/BLOCKED result.
