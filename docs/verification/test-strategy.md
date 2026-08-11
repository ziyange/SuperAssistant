# Verification and test strategy

This document defines how Super Assistant turns planned checks into inspectable evidence. It covers the `PHASE-000` documentation baseline and the additional application checks required from `PHASE-001` onward.

## Evidence vocabulary

Every reported result is labeled as one of:

- `planned`: specified but not run;
- `local`: run in the current working tree;
- `isolated`: run from a clean worktree, clean install, sandbox, or disposable fixture;
- `external`: produced by a remote CI or review system.

A command written in a plan is not evidence. A report records the command, working directory, relevant tool versions, start time, exit code, result summary, and any retained output or Artifact. Skipped checks name both the reason and the approving authority.

The validation levels are named `VAL-L1` through `VAL-L4` so they cannot be confused with the product's `QR-L1` through `QR-L4` Question Router risk levels.

| Level | Required evidence |
|---|---|
| `VAL-L1` | Focused unit, contract, or manual check for the changed behavior |
| `VAL-L2` | Applicable local unit tests, lint, typecheck, build, and governance checks |
| `VAL-L3` | Clean/isolated execution, migration or recovery proof, and disposable integration fixtures |
| `VAL-L4` | Actually completed remote CI and review evidence |

Every Task Pack requires `VAL-L1`. A phase requires `VAL-L2`; persistence, security, worktree, adapter, and recovery changes also require `VAL-L3`. `VAL-L4` remains `planned` until a remote run has completed successfully.

## PHASE-000 local gate

Run the following commands from the repository root, in this exact fail-fast order. Do not continue after a non-zero exit. The standalone schema validator requires the repository's supported Python interpreter and the `jsonschema` package; a missing prerequisite is a failed environment gate, not a skipped schema check.

### 1. Documentation links and anchors

```powershell
python scripts/check_docs_links.py docs --json
```

Pass: exit `0`, `status` is `passed`, and `total_issues` is `0`.

### 2. Every Task Pack

```powershell
$taskPacks = @(Get-ChildItem -LiteralPath 'docs/delivery/tasks' -Filter 'TASK-*.md' -File | Sort-Object Name)
if ($taskPacks.Count -eq 0) { throw 'No TASK-*.md files were found.' }
foreach ($taskPack in $taskPacks) {
  python scripts/check_task_pack.py $taskPack.FullName --schemas references/schemas.md --json
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Pass: at least one pack exists and every invocation exits `0`. This includes draft and future packs: a non-executable status does not exempt a pack from structural validation. Broad allowlists such as `*`, `**`, or `.` fail the gate.

### 3. Requirement traceability

```powershell
python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json
```

Pass: every `REQ-*` has exactly one complete row with engineering, phase, Task Pack or explicit phase-plan handoff, `AC-*`, and `SCN-*` evidence references.

### 4. Five standalone JSON Schemas

```powershell
python scripts/check_schemas.py references/schemas --json
```

Pass: exit `0` and all five expected files validate as JSON Schemas:

- `AuditLogSchema.json`
- `ExecutionTraceSchema.json`
- `ExpansionSchema.json`
- `TaskPackSchema.json`
- `PainPointCardSchema.json`

### 5. Plan-mode runtime trace

```powershell
$runtimeInputs = @('docs/delivery/execution-trace.json', 'docs/delivery/permission-audit.log')
foreach ($runtimeInput in $runtimeInputs) {
  if (-not (Test-Path -LiteralPath $runtimeInput -PathType Leaf)) { throw "Missing runtime evidence: $runtimeInput" }
  if ((Get-Item -LiteralPath $runtimeInput).Length -eq 0) { throw "Empty runtime evidence: $runtimeInput" }
}
python scripts/verify_runtime_trace.py --mode plan --task-pack docs/delivery/tasks/TASK-000.md --schemas references/schemas.md --next-iteration 1 --json
```

Pass: both evidence files exist and are non-empty, process exit is `0`, payload `exit_code` is `0`, and `reason` is `SUCCESS`. Any other exit is dispatched according to [the quality gate](quality-gate.md#runtime-trace-dispatch); it must not be normalized to success by a wrapper.

### 6. Governance unit tests

```powershell
python -m unittest discover -s tests -v
```

Pass: exit `0` with no failed or errored tests. Tests must assert meaningful behavior; empty tests, unconditional success, status-only checks, and mocks that replace the behavior under test are invalid evidence.

### 7. Patch integrity and Task Pack scope

```powershell
git diff --check
git diff --name-only -- .
git ls-files --others --exclude-standard
```

Pass: `git diff --check` exits `0`, and the union of changed and untracked paths is contained by the active Task Pack's exact `Allowed Files`. This step is an explicit local review because repository history and the active authorization boundary are required to interpret the result. Never infer scope compliance from a clean formatter run.

## Application-phase checks

Application phases retain the complete documentation gate and add the following evidence. `TASK-101` establishes the package scripts; once established, their names are stable engineering contracts recorded in `AGENTS.md`.

| Check | Required proof |
|---|---|
| Vitest | Domain, state-machine, repository, migration, IPC, redaction, and failure-path suites run non-interactively with meaningful assertions |
| Fake App Server contract | Stable JSON-RPC initialization and negotiated capability behavior; later phases add execution, duplicate/out-of-order events, malformed frames, cancellation, result collection, and reconciliation |
| Electron Playwright | Critical renderer-to-main user flows on the supported Windows target, including negative and degraded states; no test-only privilege bypass |
| Real Codex smoke | Explicit opt-in only, runs against a disposable fixture/worktree, records the exact Codex/App Server version, and has bounded time and resource limits |
| Static and package checks | Lint, typecheck, and production build all exit `0` |

The default application sequence is:

```powershell
npm run test:unit
npm run test:contract
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

The real-Codex smoke is a separate, opt-in command established by its owning Task Pack. It is never part of the default local or CI sequence, never runs against a user's live Project, and never substitutes for the deterministic fake-server contract suite. In `PHASE-001` it is read-only discovery only; mutating execution is not authorized until the applicable `PHASE-002` pack is approved.

## Coverage by risk

- State transitions: success, rejection, retry, boundary, illegal transition, crash-before/after-commit, restart, and idempotent replay.
- SQLite: forward migration, rollback where supported, interrupted migration, constraint enforcement, and restart persistence.
- IPC and security: schema rejection, origin rejection, path containment, secret redaction, grant expiry/scope, and least-privilege negative cases.
- Worktrees: dirty source, symlink/path escape, fencing token, cancellation, quarantine, and proof that the source repository remains unchanged.
- Adapter: supported and unsupported versions, malformed/oversized frames, process exit, duplicate/late events, cancellation, and ambiguous outcome reconciliation.
- UI: keyboard and screen-reader semantics, loading/empty/error states, confirmation text, and degraded read-only behavior.

## Test data and cleanup

Tests use temporary directories, disposable repositories, fake credentials, fake App Server processes, and deterministic clocks/identifiers where practical. They do not use production credentials or mutable user Projects. Cleanup is verified, but ambiguous or dirty worktrees are quarantined rather than destructively removed.

## Reporting

Task evidence is stored under `docs/verification/reports/` and linked from the Task Pack or phase summary. A phase report distinguishes failed checks from skipped checks, identifies the first failed gate, links retained Artifacts, and records runtime-trace exit dispatch. Remote CI remains `planned` until a run URL and final conclusion exist.
