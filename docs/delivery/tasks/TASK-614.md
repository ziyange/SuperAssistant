# TASK-614: DSH 0.1.1 public-profile compatibility refresh

## Status

COMPLETED

PHASE: PHASE-006

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-077, REQ-078, REQ-090, REQ-091, REQ-096

## Objective

Re-probe the user-maintained local DSH public profile after its observed commit
and public SDK/protocol version changed from `0.1.0-rc.8` to `0.1.1-rc.2`.
Record exact compatibility evidence, update only pinned public dependency
metadata if the stable Guard seam remains compatible, and otherwise leave DSH
Disabled with an explicit blocking reason.

## Context Pack

- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/adapters/dsh.md
- docs/verification/reports/phase-006-task-610.md
- docs/verification/reports/phase-006-task-613.md

## Must Read

- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/adapters/dsh.md
- docs/delivery/tasks/TASK-614.md

## Allowed Files

- package-lock.json
- packages/dsh-adapter/package.json
- packages/dsh-adapter/src/dsh-probe.ts
- packages/dsh-adapter/src/dsh-tool-guard-plugin.ts
- packages/dsh-adapter/tests/dsh-probe.test.ts
- packages/dsh-adapter/tests/dsh-loader-guard.test.ts
- docs/adapters/dsh.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-614.md
- docs/verification/reports/phase-006-task-614.md

## Forbidden Files

Every file under `E:\Programs\deepseek-harness`; provider/model or DSH process
invocation; credential; DSH Shell, filesystem, network, or plugin capability
execution; plugin installation/update/enable inside DSH; production profile;
remote Git action; and all files not explicitly listed above.

## Interfaces / Contracts

The Adapter continues to consume only DSH's public SDK/protocol, Cordis Loader,
and monotonic ToolRuntime `guard` seam. All eight SAI operations, opaque product
identities, immutable per-Attempt policy semantics, and DSH-disabled default are
unchanged. A changed or absent public Guard signature is an incompatibility, not
an opportunity to reinterpret the contract.

## Data Constraints

Probe records contain public commit/package/profile identifiers and fixture
frames only. No secret, prompt, provider result, session state, or capability
result is stored.

## UI Constraints

None. DSH remains Disabled whether the probe passes or blocks.

## Implementation Requirements

- Read only the external DSH commit and public package/protocol metadata.
- Pin `@deepseek-ai/dsh-tools` to the observed public version only after the
  public Guard type and Loader mount remain compatible.
- Update fixture expectations and profile digest evidence for exact observed
  public identities; preserve the old TASK-610 evidence as historical proof.
- Re-run matching, mismatch, malformed-frame, shutdown, and Loader Guard tests.
- Fail closed on any package, export, version, Guard-signature, or Loader
  incompatibility.

## Test Requirements

Run focused probe/Loader tests, typecheck, lint, deterministic unit and contract
suites, Playwright, build, governance checks, runtime trace, and `git diff
--check`.

## Acceptance Criteria

- The current DSH commit and protocol version are exact, recorded evidence.
- Matching identities pass; commit, protocol, server, malformed-frame, and
  shutdown failures remain deterministic and fail closed.
- The pinned public ToolRuntime Guard seam still mounts through the public
  Loader with immutable policy behavior.
- No DSH process, model/provider, credential, or capability operation occurs.

## Done Definition

The refreshed compatibility evidence passes all deterministic checks or records
an explicit BLOCKED result. In either case no production DSH Function is
enabled by this Task.

## Risks

Public release drift can change Loader or Guard semantics while preserving names.
Any uncertainty blocks DSH rather than falling back to internal APIs or terminal
parsing.

## Output Required

`docs/verification/reports/phase-006-task-614.md` with old/new identities,
public seam comparison, commands, no-effect declaration, and PASS/BLOCKED.
