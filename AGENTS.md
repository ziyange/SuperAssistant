# Super Assistant repository instructions

## Current lifecycle state

- 当前候选为 `codex/phase-007-desktop-lifecycle`；TASK-857 迁移开发记录规则。
  TASK-858 已获授权独立提交治理及历史文档证据并验证 CI，应用 WIP 不纳入该提交。
  现有未提交应用修改和 TASK-850–856 保留，局部证据不等于集成验收。
  真实 Codex 和 Electron 沙箱验证继续延期，H1/H3 尚未验收。
  当前成果和阻断统一查看 [中文开发记录](docs/delivery/development-log.md)。

- `PHASE-000` is the accepted document-first baseline; `TASK-000` is completed locally.
- `PHASE-001` is archived on `codex/phase-001-platform-foundation`; TASK-100
  through TASK-106 are accepted local evidence.
- `PHASE-002` is archived locally on
  `codex/phase-002-single-task-loop`. TASK-201 through TASK-207 and closeout
  TASK-204 are completed local evidence; TASK-202's user-approved real-smoke
  exception remains recorded in its phase archive.
- PHASE-003 through PHASE-006 have historical local archive records; their
  integrated behavior is subject to the current recovery acceptance gates.
- PHASE-007 is reopened. TASK-716 has uncommitted work in a separate worktree;
  preserve it and review any selectively transferred changes against its evidence.
- The initial GitHub publication is an S21 handoff after local acceptance, not an application phase.

## Sources of truth

Read these in order before changing the repository:

1. `docs/README.md` — document map and current status.
2. `docs/product.md` and `docs/requirements.md` — product truth.
3. `docs/architecture.md`, `docs/data-model.md`, and the relevant interface document — engineering truth.
4. The active phase plan and Task Pack — execution truth.
5. `docs/source/super-assistant-v3.md` — immutable source evidence, not current truth.

When sources disagree, the more specific active fact source wins. A conflict with an ADR requires a new superseding ADR. Never silently edit archived evidence.

## Delivery discipline

- Every implementation change must reference active `REQ-*` identifiers and one approved Task Pack.
- Respect the Task Pack allowlist. Do not expand scope through interpretation or broad file patterns.
- Side-effecting work requires an immutable approved Proposal or an explicitly approved repository Task Pack. Read-only queries do not.
- Application work uses an isolated `codex/phase-00x-*` branch and task worktree. `TASK-000` is the one approved bootstrap exception on a new `main`.
- Keep product, engineering, and execution facts synchronized before archiving a phase.
- A nonterminal phase cannot archive until the following phase's Task Packs are approved. `PHASE-007` archives only with the accepted H3 completion statement and maintenance-handoff packs.

## Validation

自 TASK-857 起，按 [ADR-009](docs/decisions/ADR-009-development-records.md)
执行：人工开发记录只写有意义的问题和独立验收成果，同一问题更新原条目。
普通读取、修改、成功命令与重复重试不追加开发日志；Task Pack 收尾链接到同一条目。
只更新发生变化的工程事实。旧日志原路径冻结，禁止补造或清空。
产品运行时授权和安全审计不变；历史阻断及迭代上限仍有效。

Run the local gate in the order documented by `docs/verification/quality-gate.md`. The principal commands are:

```powershell
python scripts/check_docs_links.py docs --json
python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json
python scripts/check_schemas.py references/schemas --json
python scripts/check_delivery_records.py --task-pack docs/delivery/tasks/TASK-857.md --json
python scripts/check_task_audit_history.py
python -m unittest discover -s tests -v
git diff --check
```

Remote CI is evidence only after it actually runs. Until then, label it `planned`.
以上 TASK-857 是迁移示例；后续本地检查使用实际活动 Task Pack。CI 按事件提交范围选择本次新增或更新的任务记录。

## Safety invariants

- The platform database, never a model conversation, owns task state.
- Commands and events are at-least-once and therefore require idempotency.
- An attempt in `UNKNOWN` or `RECONCILING` cannot be redispatched before reconciliation.
- No secret is stored in repository files or SQLite. Windows Credential Manager holds credentials.
- Cancellation is incomplete until the process is terminated and its resource lease is released.
