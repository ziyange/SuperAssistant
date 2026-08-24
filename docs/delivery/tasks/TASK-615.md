# TASK-615: DSH public SDK server lifecycle probe

## Status

COMPLETED

PHASE: PHASE-006

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-028, REQ-029, REQ-030, REQ-031, REQ-049, REQ-077, REQ-078, REQ-090, REQ-091, REQ-093, REQ-095, REQ-096, REQ-098

## Objective

Launch one disposable process using the public DSH SDK JSON-RPC server and a
configuration-relative Super Assistant Guard module; prove `initialize` and
`shutdown` lifecycle ownership, JSON-RPC framing, process reaping, immutable
policy mount, and no redispatch. No `session/prompt`, provider/model request,
or DSH Shell/filesystem/network/plugin capability operation is permitted.

## Context Pack

- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/adapters/dsh.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/verification/reports/phase-006-task-613.md
- docs/verification/reports/phase-006-task-614.md

## Must Read

- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/adapters/dsh.md
- docs/delivery/tasks/TASK-615.md

## Allowed Files

- package-lock.json
- packages/dsh-adapter/package.json
- packages/dsh-adapter/src/dsh-process-host.ts
- packages/dsh-adapter/src/dsh-event-journal.ts
- packages/dsh-adapter/src/dsh-reconciler.ts
- packages/dsh-adapter/tests/dsh-public-server-lifecycle.test.ts
- packages/dsh-adapter/fixtures/sdk-server/cordis.yml
- packages/dsh-adapter/fixtures/sdk-server/runner.mjs
- docs/adapters/dsh.md
- docs/operations.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-615.md
- docs/verification/reports/phase-006-task-615.md

## Forbidden Files

Every file under `E:\Programs\deepseek-harness`; `session/prompt`; any
provider/model request; credential; DSH Shell, filesystem, network, or plugin
capability execution; plugin installation/update/enable inside DSH; `--yolo`;
production profile; remote Git action; and all files not explicitly listed.

## Interfaces / Contracts

The process speaks public newline-delimited JSON-RPC `initialize` and
`shutdown`. The platform owns process correlation, terminal evidence, journal
sequence, Lease disposition, and reconciliation. `shutdown` response plus child
exit are required before terminal cancellation; EOF, terminate, and kill remain
fallbacks. The public Guard remains deny-only and bound to one immutable Attempt
policy.

## Data Constraints

Only nonsecret fixture JSON-RPC frames and redacted process/journal evidence are
stored. The disposable profile has no provider, credential, session persistence,
or capability plugin. No Project worktree is written by the fixture.

## UI Constraints

None. DSH stays Disabled.

## Implementation Requirements

- Build a disposable runner from public published SDK packages, not DSH source
  internals, terminal scraping, or the CLI.
- Mount the configuration-relative Guard and public SDK server plugins; use a
  fake in-memory Agent service sufficient for handshake only.
- Send only `initialize` and `shutdown`; reject any outbound prompt or tool body
  observation as a test failure.
- Assert exactly one owned process, ordered JSON-RPC evidence, graceful shutdown
  before fallback termination, and `UNKNOWN/RECONCILING` on missing evidence.

## Test Requirements

Write lifecycle tests first. Run focused lifecycle, process/journal/reconciler,
typecheck, lint, unit, contract, Playwright, build, governance, runtime trace,
and `git diff --check`.

## Acceptance Criteria

- The public SDK Server returns its public identity on `initialize` and exits
  only after `shutdown` acknowledgement.
- Child ownership and terminal evidence are recorded exactly once; no fallback
  kill occurs on graceful shutdown.
- No prompt, provider/model request, credential, DSH capability, or worktree
  mutation occurs.
- Lost or malformed lifecycle evidence remains `UNKNOWN/RECONCILING` and cannot
  redispatch.

## Done Definition

One public SDK server lifecycle is proven under the immutable Guard with no
provider or capability effect, all gates pass, and DSH remains Disabled pending
full authorized execution evidence.

## Risks

The published SDK server may require undeclared runtime services or alter its
handshake semantics. Any such requirement is a fail-closed compatibility block,
not grounds to use DSH internals or weaken the policy.

## Output Required

`docs/verification/reports/phase-006-task-615.md` records exact public package
versions, profile, JSON-RPC frames, process evidence, no-effect assertion,
commands, and PASS/BLOCKED conclusion.
