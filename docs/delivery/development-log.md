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
- 结论：PASS
- 说明：按用户授权独立提交日志迁移，旧日志和 TASK-850–856 作为证据依赖，应用 WIP 不纳入。三份旧文档因 EOF 空行被严格门禁拒绝，原始字节已保存在冻结清单 format_sources 并以原 SHA256 校验，提交副本只规范化末尾空行；首次干净克隆又暴露 CRLF 转换问题，追加精确保真属性，不禁用 diff／空白检查。旧任务保持未验收，不恢复执行权。
- 验证状态：PASS
- 验证：85f4183 与换行修正 548f92b 已独立提交并正常推送候选分支，未更新 main；两次提交零应用源码，原有十份应用 WIP 哈希未变且未提交。548f92bfe1a8339043b6a31ef8f04e7922101f2b 的全新干净克隆通过 417 份文档、205 份 Task Pack、追踪、五份 Schema、26 路径精确范围、34 个历史范围、69/69 项 Python 测试（53.160 秒，零跳过）及空白检查。两套实际 CI 均成功：治理；Windows 构建、打包完整性、合成凭据、进程树、桌面注册重启 2/2、lint/typecheck、单测 1182 通过及既定 9 项跳过、契约 50/50；独立 PostgreSQL 16 测试 13/13。DEV-857 的 104 例仍仅属于历史混合工作补丁。
- 证据：[安全提交任务](tasks/TASK-858.md)、[冻结清单](logging-baseline.json)、[548f92b 文档 CI](https://github.com/ziyange/SuperAssistant/actions/runs/45957666190)、[548f92b 应用 CI](https://github.com/ziyange/SuperAssistant/actions/runs/45957666249)。两个 Run 的 headSha 均已核对，Governance validators、Windows build and deterministic tests、PostgreSQL 16 disposable compatibility 均为 success。
- 遗留：只验收日志迁移与该候选提交的既定 CI，不代表 H1/H3 或 main 合并验收。生产桌面执行接线、可信安装与效果约束等原有缺口仍在；应用 WIP 由后续独立任务处理。真实 Codex 和 Electron 沙箱仍延期。

## 记录 DEV-859

- 任务：TASK-859
- 日期：2026-11-27
- 类型：阶段成果
- 结论：PASS
- 说明：在独立干净副本复现了两项缺陷：1,048,577 字节请求返回 201 并进入仓库，非法 JSON 进入业务授权端。修复为认证前置、声明及流式 1 MiB 边界、非法 JSON 直接拒绝，以及有限排空和连接关闭；不启用任何生产桌面执行或 Team 连接。REQ-081、093–095、097、099；仅覆盖 SCN-TEAM-GOVERNANCE、SCN-NFR-QUALITY 的请求边界子集。
- 验证状态：PASS
- 验证：Windows、Node 22.23.2、npm 10.9.8、Python 3.9.12；基线 548f92b 加本任务五文件补丁。`vitest run --project unit services/team/tests/server.test.ts --maxWorkers=1` 13/13；独立安全复核无阻断，适当 loopback 进程环境独立运行也是 13/13。完整 `npm run build`、`npm run lint`、`npm run typecheck` 返回 0；`npm run test:unit -- --maxWorkers=1` 187 文件，1193 通过、既定 9 项跳过，515.96 秒；`npm run test:contract -- --maxWorkers=1` 50/50。真实 Electron 功能回归 2/2（注册重启与只读 Proposal 审阅，不是沙箱或执行验收），浏览器投影回归 9/9。文档 418 份、Task Pack 206 份、追踪、五份 Schema、34 个历史范围及 Python 69/69（50.254 秒）通过；五路径范围及 diff 空白检查通过。
- 证据：[任务与精确范围](tasks/TASK-859.md)、[真实 socket 回归](../../services/team/tests/server.test.ts)、[HTTP 安全事实](../security.md#team-http-请求体边界)、[8ae7544 文档 CI](https://github.com/ziyange/SuperAssistant/actions/runs/45961724611)、[8ae7544 应用 CI](https://github.com/ziyange/SuperAssistant/actions/runs/45961724326)。提交为 8ae7544f7af7fca7c1504968ed513fb33363007c，整个提交树 2aaf8aaf63e42461d0618356a05afe9bb514c3da 与独立验证副本一致；干净副本按真实 SHA 的范围门禁返回 0。两套 CI 的 headSha 已核对，治理、Windows 构建与确定性测试、PostgreSQL 兼容性三项 job 均 success；CI 单测 1193 通过／9 跳过、契约 50/50、数据库 13/13、桌面功能 2/2，均读取实际运行输出。未更新 main。
- 遗留：只关闭本任务 HTTP 边界问题，不代表 H1/H3 或可合并。9 项跳过为 6 项需数据库用例及 3 项显式启用原生探针，不能当作本地通过；数据库已由独立 CI 执行。正式入口仍为 Team unavailable、Decision 只记录答案、保护执行未接入；可信安装、文件／网络效果约束和原 Attempt 终止／租约事务仍为合并阻断。剩余 8 份原生诊断 WIP 保留未提交，未更改系统审计或信任设置。真实 Codex 和 Electron 沙箱继续延期。

### 验证环境边界

独立审查首次在受限沙箱运行因 loopback EACCES 及连带超时失败，不计为通过；随后同一测试在适当进程环境通过，未改代码、断言或门限。拒绝期限用例证明观察到的及时关闭，不单独证明一定由 10 秒定时器触发；未声称一般 DoS 防护、生产认证延迟、TLS 或全局连接配额已验收。原工作树中的应用 WIP 在独立验证期间保持不变，后续只转入本任务明确审查的部分。

精确转入时，首次 `git apply --cached --whitespace=error` 因 PowerShell 给补丁末行追加 CRLF 而被拒；保留暂存现场、修正传输边界后通过，并以完整树哈希证明没有带入混合的原生安全文档。未放宽空白规则。保留文件剔除本次新增的 10 行已验收 HTTP 说明后，原有内容指纹逐一不变。

正式接线依赖复核确认：默认迁移只到 032，033 仍由夹具手动执行；现有凭据“重启”用例是同进程用原 vault 重开备份，不是结束首进程后的恢复证明；正式启动仍选择旧回执，退出也只等待发现流程。这些是现存开发缺口，不是本次 CI 失败；不能跳过它们，或把 unsigned 包、哈希／实例检查替代安装信任和效果约束来宣称可以合并。

## 记录 DEV-860

- 任务：TASK-860
- 日期：2026-11-27
- 类型：问题
- 结论：PASS
- 说明：最终收尾提交 a17d733 的 Windows CI 在 unsigned 包完整性断言后，删除临时复制 EXE 报 EBUSY，门禁真实失败，后续测试未执行；不能沿用 8ae7544 的成功覆盖它。行为不变的清理接缝加真实 Windows FileShare 文件锁，在本地稳定复现同一错误。已识别问题为立即删除缺少有界占用处理、PASS 先于清理；具体外部句柄持有者未证明，不擅自终止未知进程。新增等待同时要求目录身份及重复调用保护。
- 验证状态：PASS
- 验证：Windows / Node 22.23.2 / npm 10.9.8 / Python 3.9.12，独立临时克隆，基线 a17d733 加本任务六文件补丁。清理定向 11/11；`npm run build`、`npm run lint`、`npm run typecheck` 返回 0。实际 unsigned 打包烟测通过 440 个清单文件、启动、篡改拒绝及全部清理，PASS 在清理之后输出；输出目录为独占的 sa-package-output-6e93119d881b48c4960a2ad02acdd110。完整 `npm run test:unit -- --maxWorkers=1` 为 188 文件、1204 通过及既定 9 项跳过，450.91 秒；contract 50/50，真实 Electron 功能 2/2、浏览器投影 9/9。治理按原顺序通过 419 文档、207 Task Pack、追踪、五份 Schema、六路径范围、34 历史范围、Python 69/69（43.243 秒）及空白检查。独立静态复核及错误传播修订复核均无 Critical／Important 发现。
- 证据：[任务范围](tasks/TASK-860.md)、[原失败 CI](https://github.com/ziyange/SuperAssistant/actions/runs/45963402337)、[真实文件锁回归](../../apps/desktop/tests/main/package-fixture-cleanup.test.ts)、[夹具清理实现](../../apps/desktop/tests/native/package-fixture-cleanup.cjs)、[0b42555 文档 CI](https://github.com/ziyange/SuperAssistant/actions/runs/45968881245)、[0b42555 应用 CI](https://github.com/ziyange/SuperAssistant/actions/runs/45968881356)。修复提交为 0b42555ef31ea22243522ebcda0c70cc85ea31ec，提交树 f82e8fa65baff5d27cd8c0b6b868e6cf161ac367 与独立验证副本一致，干净 SHA 范围门禁返回 0；两套 CI 的 headSha 已核对，Governance validators、Windows build and deterministic tests、PostgreSQL 16 disposable compatibility 均 success。实际 CI 输出为清理回归 11/11、单测 1204 通过／9 跳过、契约 50/50、数据库 13/13、桌面功能 2/2，打包 440 文件／启动／篡改拒绝／清理均通过。
- 遗留：本问题在所述修复提交上关闭，a17d733 的失败保留，不重跑成历史成功。9 项既定跳过不是本地通过；数据库已由独立 CI 执行。只验收夹具清理修复，不证明 H1/H3 或可以合并；[既有接线与信任／隔离缺口](#记录-dev-859) 仍在。原有 8 份 WIP 保留未提交，main 未更新，真实 Codex 与 Electron 沙箱继续延期。

首轮完整检查在 lint 停止，发现 6 项类型词汇／导入及 finally 显式重抛问题。修正了 Node performance 导入和类型标注；只对一个类型签名词汇使用仓库既有的窄 lint 注释，没有关闭运行逻辑规则。篡改验证标志改为全部断言及已有终止检查通过后才成立；失败时保留证据与原始错误，避免新清理覆盖它。随后从失败门禁起重验并完成后续所有检查。没有扩大 30 秒启动／读取期限或既有测试超时，持续锁的新用例使用独立的 10 秒预算验证 5 秒等待边界；底层正在进行的文件系统操作不属于硬实时保证。

## 记录 DEV-861

- 任务：TASK-861
- 日期：2026-11-28
- 类型：问题
- 结论：REQUEST_CHANGES
- 说明：默认迁移停在 032，受保护执行夹具自行安装 033。已正式登记既有 SQL；补上单独 033 升级的验证备份、独占事务、规范计划锁定和历史连续性检查，保留外键与旧授权边界，不开启生产执行。
- 验证状态：PASS
- 验证：Windows／Node 22.23.2／npm 10.9.8／Python 3.9.12，以 d997efd 为隔离基线。默认缺表、无备份直接升级、错误备份和同号替换均先复现再修复；独立审查的乱序 033 历史反例同样 RED→GREEN。`npm run build`、`npm run lint`、`npm run typecheck` 返回 0；迁移 14 项和执行事务 36 项定向通过。最终 `vitest run --project unit --maxWorkers=1` 为 189 文件、1218 通过及既定 9 项跳过，480.742 秒；严格 JSON 汇总检查通过。contract 50/50、真实 Electron 功能 2/2、浏览器投影 9/9。治理按序通过 420 文档、208 Pack、99 REQ 追踪、五份 Schema、12 路径范围、34 历史范围及 Python 69/69（46.867 秒）；空白检查通过。只证明本次迁移前置，不冒充完整执行验收。
- 证据：[批准范围](tasks/TASK-861.md)、[迁移回归](../../packages/persistence/tests/protected-execution-migration.test.ts)、[执行事务拒绝回归](../../packages/persistence/tests/execution-transaction.test.ts)、[原迁移 SQL](../../packages/persistence/src/sqlite/migrations/033-protected-execution.sql)。
- 遗留：本地验证通过，当前任务尚待提交与精确 SHA 的两套 CI，因此整体结论仍为 REQUEST_CHANGES。9 项既定跳过不是本地通过，数据库由独立 CI 复核。独立进程原 Attempt 恢复、正式桌面接线与可信安装／效果约束仍须独立验证；原 WIP 保留，真实 Codex 和 Electron 沙箱继续延期。

本地执行目录为 `C:\Users\ZZY\AppData\Local\Temp\sa-task858-final-b92d84043b034c918412d9403686598f`；原始完整单测 JSON 保存在同一临时根目录的 `sa-task861-unit.json`（首轮）及 `sa-task861-unit-final.json`，契约为 `sa-task861-contract-final.json`。首轮完整单测 1217 通过、1 失败及 9 跳过，根因为旧故障注入仍删除 032 触发器；已先修订精确范围，再适配新名称，保留拒绝断言。安全文档清单项一度误落在必读区，范围门禁真实拒绝；修正到 Allowed Files 后从第一项重验，未在拒绝状态提交。上述历史结果保留，不用最终通过覆盖失败事实。
