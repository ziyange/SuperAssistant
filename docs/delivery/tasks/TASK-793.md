# TASK-793: Fix independent review findings on original Attempt and Task identity

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: existing desktop confirmation/cancellation/recovery mandate and permission to fix non-destructive integration blockers.

## Requirement IDs
REQ-032, REQ-037, REQ-049, REQ-090, REQ-093, REQ-098

## Objective
Prevent attribution to another observable authenticated principal, merge constituent current execution states into one conservative Task projection, and stop unknown history from rendering as empty.

## Context Pack
- docs/delivery/tasks/TASK-790.md
- docs/delivery/tasks/TASK-791.md
- docs/delivery/tasks/TASK-792.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/data-model.md
- docs/requirements.md
- docs/adapters/codex.md
- docs/ux.md
- docs/verification/quality-gate.md

## Allowed Files
- apps/desktop/tests/main/worktree-service.test.ts
- packages/dsh-adapter/src/dsh-process-host.ts
- packages/dsh-adapter/tests/dsh-process-host.test.ts
- docs/delivery/tasks/TASK-793.md
- .github/workflows/docs-gates.yml
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/ux.md
- docs/adapters/codex.md
- packages/codex-adapter/src/app-server-client.ts
- packages/codex-adapter/src/app-server-supervisor.ts
- apps/desktop/src/main/codex-discovery-ipc.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/codex-attempt-recovery.ts
- apps/desktop/tests/main/codex-attempt-recovery.test.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/026-receipt-principal.sql
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/src/queries/task-projection.ts
- packages/persistence/tests/task-projection.test.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/renderer/task-cancellation-navigation.test.tsx

## Forbidden Files
All other paths, credential files, retained worktrees, main, remote changes, real Codex and Electron sandbox.

## Interfaces / Contracts
Use non-secret account context from the authenticated owned App Server handshake only. Exact personal ChatGPT identity and plan may be compared by opaque fingerprint; key-only and organizational accounts without an unambiguous identity remain unresolved. Never read auth files or infer a historic principal from current credentials.

## Data Constraints
Migration 026 adds nullable identity proof; legacy receipts remain immutable with no backfill. Recovery cannot finalize under an absent or different proof. One card per Task; include every Work Item's latest Attempt; ambiguous ties and uncertain Attempts cannot be hidden by success.

## UI Constraints
Never display empty activity/history without a history read. List/detail must agree on one conservative Task state.

## Implementation Requirements
Bind recheck to the private handshake identity, not user agent strings, renderer input, or file names. Read the same current executions for list and detail. Fix the three independent review findings without enabling dispatch.

## Test Requirements
Approved continuation: stabilize the real Git isolation fixture and owned DSH cancellation. Keep the 15 s isolation test and 500 ms cancellation deadlines, verify real exit and deterministic escalation/non-exit, then run full gates before committing. No production Git guard is loosened.
Run account-switch, older receipt, multi-Work-Item/tied-Attempt and history failure regressions; build, lint, typecheck, full unit/contract and governance.

## Acceptance Criteria
Different credentials cannot close the old Attempt on a shared binary. Unknown and tied execution states remain visible for the Task only once. No false empty history.

## Done Definition
Record focused and full verification and independent review; no complete H1 claim.

## Risks
The pinned upstream does not publish an identity for API-key accounts or an organization workspace ID. Remain UNKNOWN where a stable comparable personal identity is unavailable. A fingerprint is sensitive metadata and is never returned to renderer.

## Output Required
This pack records the local review and verification results.

### Review evidence (Windows, Node 22.19.0, 2026-11-19)

Patch based on `37a354f`. Red cases reproduced cross-principal and legacy
receipt adoption, a user switch while reading a Turn, duplicate cards and
selection of an arbitrary tied Attempt, hidden execution failure, and false
empty activity. The production reconnect now checks the observed personal
account before and after the terminal read; unsupported or ambiguous
principals cannot use historic evidence. Reopened SQLite and the framed
fake validate the read side; no production worker minted a real receipt.
A separate read-only reviewer rechecked the receipt, aggregation and history
changes and approved the final two regressions after repair. No real Codex
or Electron sandbox ran. Both retained dirty worktrees were preserved.

Build, lint and typecheck exited zero. Focused recovery + Task projection:
15/15 after review. On the first frozen-patch full unit run, 569 passed, six
database-environment cases skipped and one Git worktree isolation case timed
out at its unchanged 15-second limit. Standalone rerun: the same case passed
in 8.572 s; its file passed all five. Neither that module, its tests nor
the timeout changed relative to main. Low available memory was observed;
the precise cause of the intermittent duration was not established. The
complete rerun and contract results are recorded separately below.

**Final disposition: REQUEST_CHANGES — not mergeable.** A second complete
unit run on the unchanged patch also exited 1: 569 passed, six skipped,
one failure (160 files). The Git worktree case passed in that run, but
`packages/dsh-adapter/tests/dsh-process-host.test.ts` expected only
TERMINATE for the owned Node fixture. The host recorded TERMINATE then
KILL and confirmed cancellation. The existing test starts a process then
requests cancellation immediately and assumes its exit is observed within
500 ms. The host explicitly escalates if that observation times out. No
DSH file differs from main. A focused rerun of that file passed 3/3; not
a substitute for a green full run. Contracts: 50/50 across eight files,
exit 0. No timeout changed, assertion weakened, or failing test skipped.
Keep this patch uncommitted; the source worktrees and main remain intact.

For the next gate, distinguish delayed child-exit observation from actual
failure to terminate with deterministic graceful/forced/missing-evidence
tests and an owned fake-child test. Preserve the original Git baseline and
isolation assertions while recording per-command elapsed times on a clean
Windows runner. Then rerun the complete unchanged gate. This diagnosis
does not authorize a change to production timeouts or a weaker assertion.
Official executable Function, full native Proposal confirmation, write-side
receipt integration and owned-process active cancellation remain open.
Real Codex and Electron sandbox verification are deferred; remote CI unrun.

### Continuation gate — 2026-11-19, Windows, base 37a354f (uncommitted)

**BLOCKED; do not commit, merge, or enable desktop dispatch.** No timeout,
baseline check or exit-proof requirement was lifted. In the isolated Git
case the previous profile observed 24 real Git launches (14 inside the two
service.create calls). A single real fast-import seeds the file and commit;
a single porcelain listing independently proves both checkout paths, HEADs
and attached branches, plus the source's main branch and original HEAD.
Both creates and all checks remain inside 15 seconds. Production Git code is
unchanged. DSH now listens before signalling, coalesces pending cancellation,
retains ownership without exit proof, and will not accept a caller callback or
negative spawn errno as proof that an owned child exited. The latter two
behaviors had failing tests on the earlier implementation. The real Node child
announces readiness before cancellation; success also requires OS PID absence.
An independent read-only review approved the fixes, not overall acceptance.

- Build, lint and typecheck reached the full Windows unit gate (Node 22.19.0,
  one Vitest worker). **570 passed, 4 failed, 6 PostgreSQL-routed cases skipped**.
  All seven DSH cases passed in that run. Failures: normal fake App Server
  response timeout (31.9 s), Git baseline unverified (44.3 s), a busy temp
  directory during cleanup (54.8 s), and clean branch-conflict timeout
  (41.3 s). The chain stopped there; no new contract or remote CI PASS.
  Unit report: Windows TEMP, `sa-793-gates-098d9fd6024b45c3bad552079af2f4cf/unit.json`;
  SHA256 `cf2caf392a60dabe2236663747df4a393153c15bed3de0d8f1967c09cfdb9901`.
- Isolated loopback PostgreSQL 16.4, separate generated cluster, SCRAM
  authentication: database split **13/13 passed, zero skipped**, instance
  stopped. Report in Windows TEMP, `sa-pg793-af789d2acb7041bab70d1ff7d0d96e57/report.json`;
  SHA256 `dc4e217bb567ee083e65871c0c048de3538c2347333d9461a943e0bee3705576`.
- Independent runner diagnostic: same Git 2.55.0.windows.3, native binary
  instead of cmd shim, fresh E: temporary directory, same test thresholds,
  same tests, one worker. Three files, **6 passed and 10 failed**; real Git
  reported `spawnSync git ETIMEDOUT` and even Vitest's worker RPC timed
  out. Real DSH cancellation did not obtain exit evidence within the original
  deadlines and correctly refused success. Controlled graceful, forced,
  no-exit and spawn-error checks stayed green. This is not stable real-process
  acceptance. Host samples during diagnostics: free physical memory dropped
  to ~470 MiB; one counter sample showed 25,773 pages read/sec. Resource
  pressure is observed, not proof of the exclusive cause of every failure.
- Resume on an idle Windows runner with sufficient physical memory using
  the same frozen patch, same timeouts, and both CI splits. Preserve the
  retained worktrees and failed evidence. Only a clean full local gate
  authorizes a TASK-793 commit. Native immutable approval, dispatch receipt
  and active cancellation still require their own pack and fake-server
  integration. A successful interrupt or absent root PID is not proof an
  entire owned Codex process tree is gone, and must not release its Lease.

### Local verification continuation — 2026-11-21

On unchanged candidate base 37a354f, the Windows run completed build, lint
and typecheck, followed by 574 passing unit tests, 6 PostgreSQL environment
skips, and 50 passing contract tests. Git isolation and DSH tests were included
with their original limits. Node was 22.19.0; nested npm reported a 12.2.0
compatibility warning. The governance checks validated 346 Markdown files,
the Task Packs, traceability, five Schemas, runtime Exit 0 and 34 governance
tests. The 22 changed paths matched the committed audit artifact hashes.

The separate disposable PostgreSQL 16.4 loopback run passed 13/13 with zero
skips and shut down. Its temporary JSON report SHA256 is
`ad7a92bf64971722fc6f904710c8599ddcabf565efe82a5070188207f9fc0b97`.
The prior temporary PostgreSQL report was no longer present and was not reused.
These are local test results only, not remote CI or H1 acceptance. Real Codex
and Electron sandbox checks remain deferred. Native Proposal confirmation,
production start receipt and process-tree cancellation remain outstanding.
