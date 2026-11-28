# TASK-861: 正式启用受保护执行数据库迁移

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
授权依据：用户要求按新日志规则持续修复合并阻断，能自行处理的无需重复确认。本包继承该授权，在 d997efdc8769f2f8bd87ce3f2b0ade14e7fd17c3 的独立副本执行；不接通生产执行、不变更系统权限。

## Requirement IDs
REQ-021, REQ-025, REQ-027, REQ-049, REQ-092, REQ-093, REQ-095, REQ-097, REQ-099
SCN-PERSISTENCE-DURABILITY、SCN-RECOVERY-RECONCILE 的迁移前置子集。

## Objective
将已有 033-protected-execution 纳入默认迁移，删除夹具的手动安装，使正式数据库具备相同结构；证明升级、失败回滚、备份恢复、旧记录兼容和不重复执行。独立进程恢复与正式桌面接线仍需后续独立验收。

## Context Pack
- docs/delivery/tasks/TASK-859.md
- docs/delivery/tasks/TASK-860.md
- packages/persistence/src/sqlite/migrations/033-protected-execution.sql

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-861.md
- docs/delivery/development-log.md
- docs/data-model.md
- docs/security.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/proposal-authority-rebuild.test.ts
- packages/persistence/tests/execution-transaction.test.ts
- packages/persistence/tests/protected-execution-migration.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts

## Forbidden Files
除清单外所有路径，特别是已发布的 SQL 001–033、冻结日志与清单、八份原有 WIP、依赖锁文件、CI 门限、正式桌面启动与生产权限、真实 Project 和凭据、系统审计／信任／防火墙。禁止 main 合并、发布、删除原工作树；真实 Codex 与 Electron 沙箱验证继续延期。

## Interfaces / Contracts
默认迁移连续到 033；033 的名称与 SQL 为保留契约，不允许用自定义同号脚本冒充。持久升级须在已验证备份和独占事务中进行，备份后发生其他提交则拒绝。032 仍按原受控重建规则执行；033 单独升级不关闭外键。重开已迁移数据库幂等，不生成 Grant、Attempt 或 dispatch；无法证明升级成功时拒绝正常使用。

范围复核修订（2026-11-28，沿用持续修复授权）：完整单测已定位旧故障注入夹具仍引用被 033 替换的触发器名称；在修改前逐项补入 execution-transaction.test.ts，只调整故障注入对象，保留独立拒绝、Grant 未消费和零 Task 的断言，不改生产逻辑或测试门限。

工程事实修订：security.md 只同步一段“033 未登记草案”的旧描述，改为已登记但生产入口未启用；从干净基线构建该段补丁，原工作树同文件中的诊断 WIP 不暂存。以完整树哈希及剔除该段后的原 WIP 字节指纹证明隔离，不使用整文件暂存。

## Data Constraints
仅使用可抛弃 SQLite 与合成身份；保留旧 Grant、Task、子记录及稀疏 rowid，校验完整性和外键。失败保留原状态和备份，恢复用新路径副本，不覆盖源。不得把迁移成功当作凭据、原生审批或终止证据；UNKNOWN 不重派，租约门禁不削弱。

## UI Constraints
无 UI 变化，正式桌面执行保持现有关闭边界。不声称已完成 H1/H3。

## Implementation Requirements
先用默认 opener 建立应具备保护表的失败测试；实现正式登记与持久升级安全检查。为 032 到 033、全新数据库、重开、同号替换、缺依赖、冲突回滚、备份后并发提交、备份恢复及旧授权拒绝规则补充测试。旧版本测试保留其历史语义，不把所有数字 32 盲改。

## Test Requirements
运行定向 persistence 与 protected approval/authority 测试；production build、lint、typecheck、完整 unit/contract、真实 Electron 功能与浏览器投影回归。按 quality-gate 顺序运行治理；候选正常提交和推送后核对实际 SHA 的两套 CI。所有原门限与既定跳过规则保留。

## Acceptance Criteria
新库和旧 032 库经正式 opener 到 033；旧数据、rowid 与备份一致，重开不重复迁移。直接无备份持久 033 升级拒绝；损坏计划、并发提交与中途冲突无部分提交。备份在新路径可恢复到 032 再正确升级。受保护执行测试不再自行加载 SQL，全部适用门禁通过。

## Done Definition
更新唯一中文 DEV-861，引用测试、审查、候选 SHA 与 CI。APPROVED 保留审批事实，执行结论以该条目为准；原 WIP 不纳入提交。

## Risks
033 会替换旧授权触发器，必须验证旧权限边界仍然生效。已有手动安装而无迁移历史的实验库应拒绝并保留，不能猜测补登记。升级备份含历史明文时原隐私风险不因新表消失。迁移不是可信安装或效果约束证明。

## Output Required
正式迁移实现、可执行升级与恢复回归、对应工程事实；收尾链接至同一 [DEV-861](../development-log.md#记录-dev-861)，不新增逐命令日志。
