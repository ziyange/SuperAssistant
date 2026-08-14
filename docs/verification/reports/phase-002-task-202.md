# PHASE-002 TASK-202 execution evidence (in progress)

## Status

`COMPLETED WITH USER-APPROVED EVIDENCE EXCEPTION` — the explicit Codex smoke
entry was implemented and attempted. Its environment failure is recorded below;
it is not a real-runtime pass and remains a PHASE-002 closeout risk.

## Implemented control-plane behavior

- An authorized execution atomically consumes one current `ISSUED` Grant and
  creates the Task, required Work Item, Attempt, fencing lease, and start
  outbox record. A repeated idempotency key returns the original Attempt.
- Attempt sequence duplicates are ignored. A sequence gap changes the local
  Attempt to `RECONCILING`; `UNKNOWN` and `RECONCILING` are never dispatchable.
- The Codex Adapter emits only stable attempt-facing fields. A lost start
  response is recorded as `START_OUTCOME_UNKNOWN` and fails closed instead of
  sending another upstream start. Returned events are sorted and deduplicated.
- Cancellation first sends the upstream interrupt, then confirms process-tree
  termination, then releases the fencing lease. It cannot report complete until
  both confirmations are true.
- A required Work Item remains below its original Task. A successful Attempt is
  `ACCEPTANCE_PENDING` until required acceptance evidence exists; remediation
  creates a Work Item, not a replacement top-level Task.

## Fresh verification (2026-08-13)

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run test:unit` — PASS: 39 files, 126 tests.
- `npm run test:contract -- --run packages/codex-adapter/tests/execution.contract.test.ts packages/codex-adapter/tests/cancel.contract.test.ts packages/codex-adapter/tests/reconciliation.contract.test.ts` — PASS: 16 project-scoped tests.
- `npm run test:e2e` — PASS: 2 Playwright flows.
- `npm run build` — PASS.
- Fake App Server lifecycle fixture — PASS for success, failure, disconnect,
  and crash frames in `execution.contract.test.ts`.
- `npm run smoke:codex` — default safe-skip path is PASS. The enabled path now
  invokes the installed Codex CLI only in `--ephemeral --sandbox read-only`
  mode within the disposable fixture and requires an exact `SMOKE_OK` response.

## Real Codex smoke blocker (2026-08-14)

The enabled smoke was attempted and did not reach a model response. The local
pnpm Codex CLI is `0.121.0` and exits while loading the existing user
configuration because its `service_tier` parser accepts only `fast` or `flex`,
whereas the configuration supplies `default`. The desktop-bundled `codex.exe`
could not be started because WindowsApps denied execution. No fixture file was
modified, no tool was called by Codex, and no external side effect occurred.

This is an external environment compatibility blocker, not a passing smoke. On
2026-08-14, the user explicitly approved skipping this evidence to continue
development. Resolving it still requires a compatible Codex CLI/configuration
or a separately authorized configuration change before PHASE-002 archival.
- `python scripts/check_docs_links.py docs --json` — PASS.
- `python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json` — PASS.
- `python scripts/check_schemas.py references/schemas --json` — PASS.
- `python scripts/verify_runtime_trace.py --mode build --task-pack docs/delivery/tasks/TASK-202.md --schemas references/schemas.md --next-iteration 1 --json` — Exit 0.
- `git diff --check` — PASS at the time of the gate.

## Handoff risk

- Preserve the failed real-smoke evidence through TASK-204 and PHASE-002
  archive; it is a documented exception, not a substituted test result.
