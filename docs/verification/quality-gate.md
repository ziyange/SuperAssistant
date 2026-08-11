# Quality gate

This is the authoritative gate order for moving from an approved Task Pack to task acceptance, phase acceptance, and archive. Gates are fail-close: missing inputs, unavailable validators, malformed evidence, or ambiguous scope do not count as a pass.

## Gate order

For `PHASE-000`, run the local sequence in [the test strategy](test-strategy.md#phase-000-local-gate):

1. documentation links and anchors;
2. every `docs/delivery/tasks/TASK-*.md` pack, one validator invocation per file;
3. requirement traceability;
4. all five standalone JSON Schemas;
5. Plan-mode runtime trace, requiring exit `0`;
6. governance unit tests;
7. `git diff --check` and an exact changed/untracked-path comparison with the active Task Pack.

Do not reorder the checks in a verification report. A later pass cannot mask an earlier failure.

## Gate decisions

| Decision | Meaning |
|---|---|
| `PASS` | Acceptance criteria are met, required checks passed, scope is exact, evidence is current, and writeback is complete |
| `REQUEST_CHANGES` | A bounded correction inside the active Task Pack can satisfy the gate |
| `BLOCKED` | Authorization, facts, environment, external dependency, or trustworthy evidence is missing; or a stop-class runtime exit occurred |

Only the main acceptance owner records the decision. A worker or CI job supplies evidence but does not expand authorization.

## Task Pack gate

A pack is executable only when:

- its status permits execution and required human confirmation is recorded;
- all required sections contain concrete values;
- requirement and acceptance references resolve;
- `Allowed Files` is explicit and contains no repository-wide wildcard;
- interfaces, data, UI, tests, risks, and required output are specific or contain a task-specific `not applicable` reason;
- `check_task_pack.py` exits `0` with `--schemas references/schemas.md --json`.

All repository `TASK-*.md` files are structurally validated, including drafts. Only an `APPROVED` pack is executable. Approved content is frozen; changing it requires a reviewed revision before work resumes.

## Runtime-trace dispatch

`scripts/verify_runtime_trace.py` is a hard gate. Before invoking it, require both `docs/delivery/execution-trace.json` and `docs/delivery/permission-audit.log` to exist and be non-empty; missing runtime evidence is `BLOCKED`, never an empty successful trace. Dispatch uses the pair `(exit_code, runtime_event_reason)` and, for exit `4`, `reason_details`. Wrappers must preserve the original exit and JSON payload.

| Exit | Runtime detail | Mandatory action |
|---:|---|---|
| `0` | `SUCCESS` | Continue; this is the only passing result |
| `1` | iteration exceeded | Stop the autonomous loop and report `BLOCKED` |
| `2` | no event reason; `offending_files` present | Stop, show the exact paths, and request an approved scope expansion before retrying |
| `2` | `EXPANSION_LIMIT_EXCEEDED` | Stop Goal mode, downgrade to Plan mode, and obtain a new phase/task permission handshake |
| `3` | schema, parse, or corrupt-input failure | Stop fail-close; repair and revalidate the environment before any execution |
| `4` | `SAFELY_ABORTED_OPERATION` | Record the safe abort; retry only after confirming no side effect committed |
| `4` | `UNCOMMITTED_PENDING` in `reason_details` | Reconcile the transaction, then explicitly retry or abort it |
| `4` | `COMMITTED_RESULT_MISSING` in `reason_details` | Write the missing Result trace only; do **not** repeat the side effect |
| `5` | Merkle/hash mismatch or forged trace | Stop immediately, preserve evidence, and raise a security/audit incident |
| `6` | illegal transaction/result state | Stop immediately and require manual data audit; do not auto-repair |

Exit `1`, `3`, `5`, and `6` are unconditional stop classes. Exit `2` and `4` are dispatch classes, not passes; work resumes only after the prescribed branch completes and a fresh verification returns exit `0`.

## Task acceptance

A Task Pack receives `PASS` only when:

- every acceptance criterion has direct evidence;
- required `VAL-L1` and `VAL-L2` checks passed, plus `VAL-L3` where its risk requires it;
- runtime-trace verification returned exit `0` after the final authorized action;
- changed and untracked paths remain within `Allowed Files` and no unrelated change was incorporated;
- test assertions prove behavior and failure paths rather than mere execution;
- product or engineering facts discovered during implementation were written back to their authoritative documents;
- the verification report records commands, exit codes, versions, failures, skipped checks, and retained Artifacts.

## Application-phase gate

From `PHASE-001` onward, phase acceptance also requires:

- Vitest suites for the affected domain, persistence, IPC, and failure paths;
- the fake App Server contract suite appropriate to the phase;
- Electron Playwright critical flows on the supported Windows target;
- lint, typecheck, and production build;
- migration, recovery, worktree, adapter, and security evidence when affected;
- an explicitly enabled real-Codex smoke when required by the phase, using a disposable fixture and recording the exact upstream version.

The real smoke is supporting compatibility evidence only. It cannot replace deterministic fake-server contracts, and a default CI job must not invoke it. No `PHASE-001` smoke may reach a mutating Codex operation.

## Phase acceptance and archive gate

A phase can be marked `PASS` and archived only when all of the following are true:

- every required Task Pack has task-level `PASS`;
- phase exit conditions and required scenarios are proven;
- no unresolved blocking Decision, contract conflict, scope violation, or stop-class runtime event remains;
- runtime trace, tests, and applicable build evidence are current;
- requirements, traceability, architecture/contracts, commands, limitations, roadmap, and ADRs have received targeted writeback;
- the archive contains the exact approved pack snapshots and all required evidence;
- the next phase's Task Packs are structurally valid, reviewed, and `APPROVED` with required human confirmation;
- the archive handoff identifies remaining risks and the next executable pack.

Merge, push, publication, deletion, history rewrite, and release remain separate user-confirmation gates even after phase `PASS`.

## Remote CI status

The workflow in `.github/workflows/docs-gates.yml` mirrors the Python governance commands and validates each Task Pack individually. Its presence is only `planned` evidence. It becomes `external` evidence only after a specific run completes and its URL, commit, jobs, and conclusion are recorded. A locally passing gate must not be labeled as CI, and an unrun workflow must not be listed as passing.
