# 开发记录与历史总览

这是人工开发记录的唯一入口。只写有意义的问题和可独立验收的阶段成果；同一问题持续更新原条目，不按命令、文件修改或重复重试新增流水。说明、验证和遗留项使用中文；命令、状态码、任务编号和原始机器输出保留原文。

开工、权限范围变化和收尾仍更新 Task Pack；工程事实变化更新所属事实源。索引、报告和归档引用本页或原始证据，不重复复制结论。阶段成果的 PASS 只代表明确列出的范围，不代表整项目通过。详细规则见 [ADR-009](../decisions/ADR-009-development-records.md) 和 [质量门禁](../verification/quality-gate.md)。

## 历史总览（截至迁移基线）

来源为当前候选分支 codex/phase-007-desktop-lifecycle，提交 a85907b6c16b2ef88b9bc95470d09a76c7bafa45 加迁移前未提交补丁；不是 main 已合并状态。main 当前为 8b9f7101b3703c9613c6427f413c81ff548972d0。基线的文件哈希、条目数和既有改动清单见 [冻结清单](logging-baseline.json)。原始英文证据不重写、不补造、不删除。

| 范围 | 已有成果或记录 | 验证与验收边界 | 后续缺口 |
|---|---|---|---|
| 历史 PHASE-001–006 | 平台、执行、决策、多 Agent、监测及领域模块的局部实现和归档 | 历史局部验收不能证明当前完整接线或 H1–H3 验收 | 按现行集成门禁逐项证明；[恢复计划](phase-007-integration-recovery.md) |
| 桌面候选 | 已有可信凭据、加密 Proposal、原 Attempt 与进程所有权相关基础模块 | 工程文档含原型及未启用说明；不能以模块测试推断正式用户闭环完成 | 正式接线与候选全量证据；[架构](../architecture.md)、[数据模型](../data-model.md) |
| TASK-850–851 | 可抛弃的原生隔离探针、Winsock 分类和清理诊断 | 网络隔离未证明；存在超出迭代上限及命令审计遗漏，仍未验收 | 保留阻断，不把 UNKNOWN 当作拒绝；[850](tasks/TASK-850.md)、[851](tasks/TASK-851.md) |
| TASK-852–854 | 恢复器、管道和所有权文件夹具的局部测试 | 同值并发、写入中强杀、双进程故障及真实审计策略协调未完整证明；不是生产恢复机制 | 不修改真实审计策略；[852](tasks/TASK-852.md)、[853](tasks/TASK-853.md)、[854](tasks/TASK-854.md) |
| TASK-855 | 只读 WFP 关联与合成解码测试 | 定向测试记录 11/11；最近完整 Python 运行仍失败；真实枚举及身份可信度未证明，迭代耗尽 | 只读接口拒绝访问与未知结果继续保留；[855](tasks/TASK-855.md) |
| TASK-856 | Team 请求体上限、流式拒绝和连接清理修复 | 记录定向测试 13/13、契约 50/50 及 lint/typecheck/build；不是本次重新验证 | 完整 unit、治理、桌面集成与干净候选 CI 未齐，任务未验收；[856](tasks/TASK-856.md) |

### 两份旧日志与存储说明

- [权限意图日志](permission-audit.log)：2,922 条，1,337,754 字节。
- [执行结果轨迹](execution-trace.json)：2,920 条，1,231,750 字节。
- [授权扩展](expansions.json)：2 条。意图与结果数量相差两条不能单凭数量断言丢失；PERMISSION_GRANT 按旧协议不要求 Result，仍须旧校验器核查事务关系。
- 两份旧日志合计约 2.45 MiB，其中记录 2,695 次文件写入、222 次命令；836 次为文档写入，TASK-851 任务文档写入 32 次。日志是过程噪声问题，不是主要存储来源。
- 2026-11-27 只读扫描：主目录（含内部工作树）约 1.37 GiB，旧外部工作树目录约 1.22 GiB，总计约 2.59 GiB；四份 node_modules 约占 96.4%。这是避开目录链接后的文件逻辑大小，不是 NTFS 分配块统计，也不包含全局缓存。本任务不清理存储。

### 保留的验收边界

上述内容是原记录的中文归纳，不是新的功能认证。未处理的审计遗漏、迭代耗尽、安全 UNKNOWN 和未完成集成不会因冻结日志而消失。真实 Codex 和 Electron 沙箱验证继续延期；没有新的合并、推送或发布结论。其他工作树和主工作区的原始材料保持不变。

## 记录 DEV-857

- 任务：TASK-857
- 日期：2026-11-27
- 类型：阶段成果
- 结论：PASS
- 说明：完成本地开发日志治理迁移：原始材料冻结、历史中文归纳、单一成果／问题记录、本地与 CI 文件范围入口同步。此 PASS 只适用于本次迁移，不是应用、H1/H3 或合并验收。
- 验证状态：PASS
- 验证：完整 Python 治理测试 104/104 通过，零失败、零跳过；其中新记录门禁 25/25、历史兼容 2/2。文档 416 份、Task Pack 204 份、需求追踪、五份 Schema、冻结历史、新范围门禁及 diff 空白检查均通过。
- 证据：[迁移任务](tasks/TASK-857.md)、[冻结清单](logging-baseline.json)、[替代决策](../decisions/ADR-009-development-records.md)、[新门禁回归](../../tests/test_delivery_records.py)、[历史兼容回归](../../tests/test_check_task_audit_history.py)。
- 遗留：远程 CI 为 PLANNED，尚无本补丁的干净提交和 Run URL；未提交、合并或推送。应用和历史验收边界见上节，不因治理回归通过而解除。早期超时原因不能仅凭后续通过认定已彻底消除。

### 当前补丁与验证环境

工作目录：`E:/Programs/Super Assistant/.worktrees/TASK-789-desktop-lifecycle`；HEAD 为 `a85907b6c16b2ef88b9bc95470d09a76c7bafa45` 加本地迁移补丁。环境为 Windows NT 10.0.26320.0、PowerShell 7.6.9、Python 3.9.12、Git 2.56.0.windows.4。2026-11-27 13:12（Asia/Shanghai）复核了最后一轮测试输出。

13 个迁移输入文件的一致性指纹为 `sha256:e922cf61232c9e8f62d612d29d1823e3df048307568d8f17539633fa9fbba1b5`：对 Task Pack 允许清单中除本记录和 Task Pack 自身外的文件，计算逐文件 SHA256，再对按路径排序、紧凑 JSON 的指纹映射计算 SHA256。它用于区分被验证的工作补丁，不是签名或授权证明。既有 19 个未提交文件指纹未变；两份旧流水和授权扩展的字节、哈希和条目数均未变。

| 实际命令或入口（均在上述目录） | 结果 |
|---|---|
| `python scripts/check_docs_links.py docs --json` | Exit 0；416 份文档，无断链 |
| 对每份 Pack 调用 `check_task_pack.py` 的同一校验函数 | Exit 0；204 份，零问题；本地批量复核使用单个 Python 进程，避免重复启动成本 |
| `python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json` | Exit 0 |
| `python scripts/check_schemas.py references/schemas --json` | Exit 0；五份独立 Schema |
| `python scripts/check_delivery_records.py --task-pack docs/delivery/tasks/TASK-857.md --iteration 3 --json` | Exit 0；34 个 Git 变更路径，15 个迁移文件在允许范围内，19 个迁移前文件内容不变 |
| `python scripts/check_task_audit_history.py` | Exit 0；34 个任务范围，仍由原底层验证器校验完整历史 |
| `python -m unittest discover -s tests -v` | Exit 0；最终完整运行 104/104，147.917 秒，零跳过；Windows 临时文件夹具使用适当的非沙箱进程环境，未修改系统执行策略、审计或防火墙 |
| `git diff --check` | Exit 0 |

### 本次发现的问题及处理

独立审查的八项重要问题已用回归测试修复：重命名源路径漏检、普通提交在 CI 被迫改日志、脏补丁冒充提交 SHA、既有修改被暂存／提交时仍获排除、冻结材料集合不完整、旧耗尽或非规范／未批准 Pack 被当作新授权、中文失败说明搭配 PASS、Python 3.9 GBK 管道兼容。随后补充真实 Git 场景，区分“历史 Pack 作为受控文件目标”与“历史 Pack 作为执行授权”，前者必须由新批准清单覆盖，后者仍被拒绝。

历史复核首次返回 Exit 3，定位到第 2816 项 `task-855-plan-switch-001`：合法 MODE_SWITCH 发生在 `task-855-write-001` 之前，旧分组器错误地把控制事务当作任务首个文件写入。补充失败测试后修正分组，不删除任何事务、不重排日志。篡改仍返回 5、缺 Result 仍返回 4、非法状态仍返回 6，越界仍失败；实际 34 个任务范围复核通过。这不消除历史未记录命令或隔离未证明等问题。

早期中间补丁的完整运行曾有 96 例、25 失败及 1 错误，包含 AuthorizationManager 拒绝、夹具就绪和超时问题；随后一个非沙箱单项也曾超过原 25 秒时限。这些运行没有算作通过，未放宽原门限、未改为跳过。最终在适当环境、原门限下完整通过 104 例；仅证明本次观察到的结果，不证明真实审计策略恢复或生产隔离已验收。超时单项的特定夹具进程和目录已确认无残留。

## 记录 DEV-858

- 任务：TASK-858
- 日期：2026-11-27
- 类型：阶段成果
- 结论：PLANNED
- 说明：按用户授权独立提交日志迁移，按原字节纳入旧日志和 TASK-850–856 作为证据依赖；应用源码、诊断脚本／测试及应用安全文档 WIP 不纳入。旧任务保持未验收，不恢复执行权。
- 验证状态：PLANNED
- 验证：待完成精确暂存、干净克隆和当前提交的两套 CI。DEV-857 的 104 例属于包含未提交夹具的历史工作补丁，不能冒充本提交测试数量。
- 证据：[安全提交任务](tasks/TASK-858.md)、[冻结清单](logging-baseline.json)。
- 遗留：迁移提交及真实 CI 尚未完成；剩余应用合并阻断继续单独处理，真实 Codex 和 Electron 沙箱仍延期。
