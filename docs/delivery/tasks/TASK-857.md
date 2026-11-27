# TASK-857: 开发日志精简与历史门禁迁移

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
授权依据：用户批准《开发日志精简、历史整理与门禁迁移方案》，并于 2026-11-27 要求继续执行。此授权明确替换本任务及后续普通开发的逐操作事务记录要求；不是补录、清空旧记录或豁免历史失败。
范围预审修订：迁移验证发现旧任务分组器误拒 MODE_SWITCH 先于 Task Pack 的合法控制事务。依据同一项治理门禁迁移授权，将分组器及其回归测试逐项纳入；不修改原始日志或底层运行轨迹验证器，不改变事务错误的退出语义。

## Requirement IDs
REQ-096, REQ-099

## Objective
保全历史开发证据，将人工记录收敛为一份中文成果／问题记录，并同步迁移本地和 CI 门禁。应用运行时审计、权限、恢复与合并标准保持不变。

## Context Pack
- docs/verification/quality-gate.md
- docs/decisions/ADR-005-rolling-task-packs.md
- docs/delivery/tasks/TASK-850.md
- docs/delivery/tasks/TASK-855.md
- docs/delivery/tasks/TASK-856.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-857.md
- docs/delivery/development-log.md
- docs/delivery/logging-baseline.json
- docs/decisions/ADR-009-development-records.md
- docs/decisions/README.md
- docs/README.md
- AGENTS.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
- docs/delivery/phase-007-integration-recovery.md
- scripts/check_delivery_records.py
- tests/test_delivery_records.py
- scripts/check_task_audit_history.py
- tests/test_check_task_audit_history.py
- .github/workflows/docs-gates.yml

## Forbidden Files
其余全部文件，包括两份原始开发日志、expansions.json、TASK-850 至 TASK-856、归档、应用代码、其他工作树和系统设置。禁止删除目录、依赖或日志，禁止提交既有应用改动、合并、推送和发布。

## Interfaces / Contracts
新增只读门禁 check_delivery_records.py：冻结历史文件哈希校验、中文成果／问题条目校验、基于 Git 的暂存／未暂存／未跟踪文件边界检查。支持 --task-pack 指定本地活动任务；CI 通过事件基线和候选提交检查同一入口。旧校验器及退出语义保留用于历史证据。

## Data Constraints
原始日志逐字节保留。基线清单绑定当前候选提交和既有未提交文件的指纹；只有基线提交相同且内容未变时，才可将既有修改排除于本任务新增范围。文件链接不得逃出仓库。机器命令和技术标识可以保留原文，人工说明使用中文。不存储秘密。

## UI Constraints
不修改应用界面；唯一人工开发记录为 development-log.md，其余事实源和任务文档仅链接结论，不复制过程流水。

## Implementation Requirements
先写门禁反例测试并观察失败，再实现。冻结记录不再追加 Intent/Result；普通本地修改和成功命令不新增人工记录。错误按问题合并更新，独立验收成果记录一次。变更范围或事实时仍更新所属 Task Pack／工程文档，但不逐次记录过程。保留旧迭代上限、拒绝结论和未解决审计缺口。

## Test Requirements
验证日志篡改、损坏／缺失基线、空记录、英文人工说明、虚假 PASS、越界路径、暂存与未暂存并集、未跟踪文件、基线变化、既有改动变化、无日志修改的普通开发、历史冻结与 CI 候选范围。运行完整 Python 治理测试、文档链接、全部 Task Pack、追踪、五份 Schema、历史校验和 git diff --check。真实 Codex 和 Electron 沙箱不运行。

## Acceptance Criteria
旧日志及既有代码指纹不变；历史总览为中文且明确区分实现／验证／验收／合并；普通开发无逐操作记账要求；反例被拒绝；本地与 CI 入口一致。结构通过不等于功能验收，远程 CI 未运行只能记为 PLANNED。

## Done Definition
将实际结果收敛到中文开发记录，并在本任务引用该条目；只对实际完成的迁移作结论，不将历史失败转换为 PASS。

## Risks
冻结基线只能证明已保存材料未变，不能证明旧记录完整或产品功能通过。Git 提交和工作补丁必须分开表述；不能把原始日志自动翻译重写，也不能将开发日志精简扩展为削弱产品审计。

## Output Required
冻结基线、中文历史总览、替代 ADR、新旧兼容门禁及回归测试；唯一收尾记录见 [DEV-857](../development-log.md#记录-dev-857)。本包 APPROVED 保留审批事实，实际执行验收只以该记录为准，不在多处复制结果。
