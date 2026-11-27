# TASK-860: 修复 Windows 打包夹具清理竞态

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
授权依据：用户于 2026-11-27 要求独立提交日志迁移、验证 CI，并继续自行修复剩余合并阻断；本包仅处理最终候选 a17d733 的新 CI 清理失败，不扩大生产权限。

## Requirement IDs
REQ-090, REQ-093, REQ-095, REQ-096, REQ-099
SCN-NFR-QUALITY 的打包夹具可靠性子集；不代表完整发布验收。

## Objective
定位并修复 CI 在完整性断言通过后删除临时测试 EXE 报 EBUSY 的问题；构建真实 Windows 文件锁反例，不靠重跑碰运气，不跳过清理失败。

## Context Pack
- docs/delivery/tasks/TASK-849.md
- docs/delivery/tasks/TASK-859.md
- docs/operations.md
- apps/desktop/tests/native/package-fixture-smoke.cjs

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
- docs/delivery/tasks/TASK-860.md
- docs/delivery/development-log.md
- docs/operations.md
- apps/desktop/tests/native/package-fixture-smoke.cjs
- apps/desktop/tests/native/package-fixture-cleanup.cjs
- apps/desktop/tests/main/package-fixture-cleanup.test.ts

## Forbidden Files
其他所有文件、旧日志和冻结清单、原有八份 WIP、依赖／锁文件、CI 门限、原生所有权实现、正式桌面入口、真实 Project 或凭据、系统审计／防火墙／信任设置。禁止 main 合并、发布、删除原工作树、关闭未知进程；真实 Codex 与 Electron 沙箱验证继续延期。

## Interfaces / Contracts
清理仅接受新建且规范路径为系统临时目录直接子目录的 sa-package-profile-* 或 sa-package-clone-* 所有权快照，拒绝链接、目录替换及范围逃逸。进程树终止断言仍是调用前提。对临时 EBUSY／EPERM／ENOTEMPTY 使用单调时钟下最长 5 秒的有限清理等待；不重试执行或篡改断言。持续失败必须非零退出并保留剩余证据；全部清理成功后才打印 PASS。

范围内复核修订：同一所有权快照的并发或重复清理共用一次结果；完成后不触碰复用同一路径的新目录，失败后不自动开始另一轮删除。文件范围不变。

## Data Constraints
只使用本任务独占的临时目录、可抛弃合成文件及明确归属的锁持有进程。每次删除尝试复核目录身份；不跟随链接。记录不含秘密，不追加旧流水。该夹具仍假设临时目录独占，不宣称抵御所有恶意同用户进程的系统调用内竞态。

## UI Constraints
无产品 UI 变化。打包烟测仍是 unsigned 测试包完整性验证，不是 Electron 沙箱或可信安装验收。

## Implementation Requirements
先建立最小真实文件锁反例并观察 EBUSY。允许先提取行为不变的原清理调用作为测试接缝，但不能把缺模块错误算作缺陷复现。再实现有界等待、路径身份保护及失败证据；保持已有 owner.stop()==TERMINATED 断言和 30 秒启动／读取期限。不得吞掉清理错误、删除失败后仍输出 PASS，或终止不属于夹具的进程。

## Test Requirements
覆盖真实 Windows 短暂及持续文件锁、替换目录、符号链接／错误前缀、正常清理、调用目标变造、并发／重复清理和界限退出。新持续锁用例可有单独 10 秒测试预算，以验证 5 秒清理界限；不改既有测试门限。运行实际打包 startup/tamper smoke、目标及完整 unit/contract、lint/typecheck/build、既有桌面功能回归和完整治理；实际候选两套 CI 均须核对 SHA 与结果。

## Acceptance Criteria
短暂锁在释放后成功清理；持续锁最多 5 秒等待后失败并保留剩余目录；链接或目录替换在删除前拒绝且目标数据不变；未知错误立即传播。原生进程终止断言不可绕过，所有最终 PASS 均发生在清理成功之后。最终提交无原有 WIP，无未经执行的测试冒充通过。

## Done Definition
在同一中文 DEV-860 记录反例、根因证据、修复、审查、实际命令／数量及最终 SHA 的 CI。保留 a17d733 的真实失败，8ae7544 的历史通过不被改写。

## Risks
Job 已终止不必然意味着系统扫描／崩溃报告等文件句柄已释放；未知持有者不能被擅自结束。重试必须有界且只涉及独占目录；未知执行和路径身份变化不应被误当作临时锁。此任务不解决生产签名、网络隔离或桌面接线。

## Output Required
确定性文件锁回归、有限且保全证据的清理实现、实际打包及 CI 结果；收尾只更新同一 [DEV-860](../development-log.md#记录-dev-860)，不新增重复报告。APPROVED 保留审批事实，验收以该条目明确范围为准。
