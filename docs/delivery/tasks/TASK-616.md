# TASK-616: DSH ToolRuntime Guard dispatch conformance

## Status

COMPLETED

PHASE: PHASE-006

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-026, REQ-030, REQ-031, REQ-077, REQ-078, REQ-090, REQ-091, REQ-095, REQ-096, REQ-098

## Objective

Prove against the public DSH ToolRuntime that an immutable Super Assistant Guard
prevents an undeclared or target-denied call from reaching a fixture tool body,
while one exact declared call reaches only an in-memory no-effect fixture body.

## Context Pack

- docs/adapters/dsh.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/security.md
- docs/verification/reports/phase-006-task-615.md

## Must Read

- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/adapters/dsh.md
- docs/delivery/tasks/TASK-616.md

## Allowed Files

- package-lock.json
- packages/dsh-adapter/package.json
- packages/dsh-adapter/src/dsh-tool-guard-plugin.ts
- packages/dsh-adapter/tests/dsh-tool-runtime-conformance.test.ts
- docs/adapters/dsh.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-616.md
- docs/verification/reports/phase-006-task-616.md

## Forbidden Files

Every file under `E:\Programs\deepseek-harness`; DSH CLI or process invocation;
model/provider request; credential; user Project worktree; real Shell,
filesystem, network, or plugin action; plugin installation/update/enable;
remote Git action; and all files not explicitly listed.

## Interfaces / Contracts

Uses only public `ToolRuntime.register`, `ToolRuntime.guard`, and
`ToolRuntime.execute`. The Guard may deny synchronously; it cannot force-allow
or mutate ToolExecution identity. Fixture tool output is in-memory content only.

## Data Constraints

No secret, prompt, session, filesystem content, network payload, plugin result,
or mutable runtime state is persisted.

## UI Constraints

None. DSH remains Disabled.

## Implementation Requirements

- Pin the public SystemPrompt peer required by ToolRuntime; do not rely on a
  transitive dependency.
- Mount the immutable Guard through the public plugin entry.
- Register one fixture tool whose body increments an in-memory counter only.
- Prove target-denied and undeclared calls return an error and keep the counter
  at zero; prove one exact declared call increments it once.
- Dispose the Cordis context and retain no Fixture process or capability effect.

## Test Requirements

Run focused conformance, lint, typecheck, unit, contract, Playwright, build,
governance, runtime trace, and `git diff --check`.

## Acceptance Criteria

- Real public ToolRuntime guard ordering rejects denied calls before the body.
- Exact immutable binding allows one no-effect fixture dispatch only.
- No model, external DSH process, credential, Project, or capability effect.

## Done Definition

Public ToolRuntime conformance is proven with no external effect and all gates
pass; DSH remains Disabled pending product-level execution authorization.

## Risks

ToolRuntime semantics can drift despite unchanged method names. Any order or
immutability ambiguity fails closed.

## Output Required

`docs/verification/reports/phase-006-task-616.md` records Guard decisions,
fixture counter evidence, public versions, commands, and PASS/BLOCKED.
