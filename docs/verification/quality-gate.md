# Quality gate

## Adapter typecheck coverage correction

TASK-738 found that previous root typecheck runs reported exit 0 while both
Codex and DSH adapter configurations selected zero files. Those historical
results are not evidence of adapter type safety. The corrected gate requires
the compiler file list to include each adapter's source and tests; a zero-file
or partial scan cannot pass even when the compiler returns exit 0.

This is the authoritative gate order for moving from an approved Task Pack to task acceptance, phase acceptance, and archive. Gates are fail-close: missing inputs, unavailable validators, malformed evidence, or ambiguous scope do not count as a pass.

## Gate order

自 TASK-857 起的开发记录规则见 [ADR-009](../decisions/ADR-009-development-records.md)。
以下顺序继续有效，但第 5 项对新工作改为冻结历史与开发记录门禁；旧 runtime-trace 分派只用于旧证据，不再为每次开发操作生成事务。

For `PHASE-000`, run the local sequence in [the test strategy](test-strategy.md#phase-000-local-gate):

1. documentation links and anchors;
2. every `docs/delivery/tasks/TASK-*.md` pack, one validator invocation per file;
3. requirement traceability;
4. all five standalone JSON Schemas;
5. `check_delivery_records.py` 检查冻结历史、中文记录和实际 Git 文件范围，随后 `check_task_audit_history.py` 复核保留的旧事务，均要求 exit `0`；
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

## 开发记录与文件边界门禁

本地运行 `python scripts/check_delivery_records.py --task-pack docs/delivery/tasks/TASK-857.md --json`，后续替换为实际活动任务。CI 使用相同脚本并传入事件 `--base`、`--head`，从本次变更的记录或 Task Pack 取得精确文件范围；不能把未变化的旧成果当作新授权。

不产生新问题或阶段成果的普通代码提交可在 commit body 使用独立一行 `Task: TASK-858`（替换为实际任务），CI 据此读取现有批准范围，无需改日志。新授权只能来自规范任务目录中 TASK-857 及之后的 APPROVED pack；旧耗尽任务不能通过默认迭代 1 恢复。`--head` 要求工作树干净；暂存或已提交的旧修改不能使用“迁移前脏文件”排除。重命名按删除和新增两个路径校验。记录的 PASS 必须有明确的验证状态 PASS，不能搭配计划或失败说明。

历史、关闭或草案 Task Pack 出现在提交中时，只能作为被保全或更新的文件目标，不能自动作为新执行授权；这些文件仍须被当前批准清单逐项覆盖。显式引用旧耗尽 Pack 为执行任务仍被拒绝。归档不可变等更高层规则不因文件清单而失效。

门禁覆盖暂存、未暂存、未跟踪路径的并集。只有事件基线等于冻结清单的来源提交、且既有文件内容完全相同时，才识别为迁移前改动；基线变化或内容变化不享有该排除。冻结清单在后续已有该清单的基线上不得静默修改。缺输入、零记录、错误类型、非中文说明、失效证据、计划验证标为 PASS 或文件越界均失败。

只记录错误和独立成果，重复问题更新原条目，命令和原始输出以证据引用。一个成果可有多项测试，但不按命令生成开发记录。Task Pack 记录授权、边界和收尾链接，事实文档只更新事实，不复制流水。该门禁只验证材料和范围，不能证明测试真的执行或产品已验收；实际验收仍须直接证据。

## Runtime-trace dispatch

本节保留为 TASK-857 之前历史事务的兼容规则，不适用于普通新开发操作。

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
- 自 TASK-857 起，新记录与文件范围门禁及冻结历史复核返回 exit `0`；旧任务保留其 runtime-trace 规则；
- changed and untracked paths remain within `Allowed Files` and no unrelated change was incorporated;
- test assertions prove behavior and failure paths rather than mere execution;
- product or engineering facts discovered during implementation were written back to their authoritative documents;
- 中文开发记录引用命令结果、失败、跳过项及证据；不重复创建验收报告。历史报告保留不重写。

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
- 开发记录门禁、保留的历史审计、产品运行轨迹、测试与适用的构建证据有效；
- requirements, traceability, architecture/contracts, commands, limitations, roadmap, and ADRs have received targeted writeback;
- the archive contains the exact approved pack snapshots and all required evidence;
- the next phase's Task Packs are structurally valid, reviewed, and `APPROVED` with required human confirmation;
- the archive handoff identifies remaining risks and the next executable pack.

Merge, push, publication, deletion, history rewrite, and release remain separate user-confirmation gates even after phase `PASS`.

## Remote CI status

For a development-baseline merge, Windows build, lint, typecheck, nonempty
unit and contract tests and isolated PostgreSQL 16 compatibility tests must
pass on the candidate SHA. The Windows unit job may omit only the six named
PostgreSQL cases when the separate database job executes them with no skips.
Three opt-in native Windows credential tests may also be skipped only when
each exact file and assertion title is declared and observed once. Their
skipped status is not evidence of native integration; all other skips fail.
The summary checker must reject missing, failed, inconsistent, zero-test or
unexpectedly skipped reports. Deferred real Codex and Electron sandbox tests
remain required for their original acceptance or release gates; a development
baseline is not H1/M1 acceptance.

The workflow in `.github/workflows/docs-gates.yml` mirrors the Python governance commands and validates each Task Pack individually. Its presence is only `planned` evidence. It becomes `external` evidence only after a specific run completes and its URL, commit, jobs, and conclusion are recorded. A locally passing gate must not be labeled as CI, and an unrun workflow must not be listed as passing.
