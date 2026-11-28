# TASK-862: 受保护 Attempt 中断隔离与跨进程对账

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
授权依据：用户持续授权自行解决剩余合并阻断，要求原 Attempt 恢复且不重复询问普通实现选择；基线为 b168c6b5c0d8d176bf910b38f1daeb632fa272cd。采用既有加密、授权及状态契约，不启用生产执行、不更改系统安全策略。

## Requirement IDs
REQ-025, REQ-027, REQ-049, REQ-092, REQ-093, REQ-094, REQ-095, REQ-097, REQ-099
SCN-RECOVERY-RECONCILE、SCN-PERSISTENCE-DURABILITY、SCN-SECRET-STORAGE 的受保护恢复子集。

## Objective
解决进程退出后已领取或已写回执的 Attempt 仍停在旧状态、无法进入对账的问题。先认证既有审批绑定，在一个事务中隔离中断记录，再用独立新进程、新 vault、新只读客户端读取原回执。恢复不得重发 start、创建 Attempt、替换密钥或释放租约。

## Context Pack
- docs/delivery/tasks/TASK-861.md
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/src/main/protected-attempt-observer.ts
- apps/desktop/src/main/windows-native-vault.ts

执行环境修订：旧临时验证副本的 workspace 链接缺失，保留现场；改用项目内已忽略的 `.superpowers/task862-verify` 独立克隆，以 `--no-local` 避免对象共享，使用原锁文件 `npm ci`。此为验证环境恢复，不改依赖、系统设置或生产范围。

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/adapters/codex.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-862.md
- docs/delivery/development-log.md
- docs/data-model.md
- docs/security.md
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/src/main/protected-attempt-observer.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts
- apps/desktop/tests/main/protected-process-recovery.test.ts
- apps/desktop/tests/fixtures/protected-process-runner.mjs
- apps/desktop/tests/fixtures/protected-process-loader.mjs
- apps/desktop/tests/fixtures/protected-process-consent.mjs

## Forbidden Files
清单外所有文件，历史 SQL、冻结日志及清单、原八份 WIP、依赖与锁文件、CI 门限、正式入口／IPC／renderer、原生所有权代码、真实项目与非测试凭据、系统审计／防火墙／信任设置。禁止 main 合并、发布、删除原工作树或关闭未知进程；真实 Codex 与 Electron 沙箱验证继续延期。

## Interfaces / Contracts
新增 main-only `quarantineInterrupted(scope)`，异步返回布尔值，先验证活动 local-owner Workspace、既有加密绑定及审批 HMAC，事务内复核快照和 Task／WorkItem／Grant／Lease／Outbox 关系。仅已领取或已确认派发的非终态可以进入 UNKNOWN；未领取 PENDING 和终态拒绝，UNKNOWN／RECONCILING 幂等保留。DISPATCHING Outbox 同事务进入 RECONCILING 并清除旧 claim；ACKNOWLEDGED 不重排。恢复观察器调用隔离后才读取原回执；未知结果仍隔离，不写终态、不释放 Lease，也不宣称进程已死。

## Data Constraints
仅用可抛弃 Git／SQLite、已有独立测试命名空间的 WinCred addon 和假 App Server。生产者、恢复者是不同 OS 进程；父测试只通过自有子进程管道捕获测试凭据引用及创建值指纹，不写入或传输密钥。磁盘清单不能授予清理权；先核对目录身份、清单与父进程捕获值，再核对创建时指纹，按精确引用和原值清理；不确定时保留现场并失败。事务更新失败不得留下部分隔离。旧回执认证失败、缺密钥、主体变化或状态变更均不得伪造恢复。

## UI Constraints
无 UI 变化。夹具中的 native consent 替身只通过显式测试 loader 提供，不能进入生产构建或证明原生用户确认已验收；不启用正式确认按钮。

## Implementation Requirements
先建立已领取与已回执中断的失败测试；实现有界、无重派的认证隔离，复用现有 authority／observer，不新增并行状态源。再用正式 dist 和真实测试 vault 做两个独立进程的强制退出与恢复：首进程在领取或回执后被父测试终止，新进程只读取原记录并对账；禁止共享内存 Map 或同实例重开冒充恢复。所有辅助写入仅是本任务独占夹具证据。

## Test Requirements
覆盖领取无回执、已回执中断、重复恢复、未领取／终态拒绝、HMAC 篡改、异 Workspace、缺失密钥、主体改变、await 期间状态改变及事务回滚；实际新进程恢复必须观察零新增 start 和不变的 Grant／Attempt／Lease 身份。运行目标测试、build、lint、typecheck、完整 unit／contract、真实 Electron 功能及浏览器投影；治理依原顺序，候选 CI 按实际 SHA 核对。保持原门限和既定跳过规则。

## Acceptance Criteria
强制退出首进程后，新进程能从已认证持久记录将原 Attempt 隔离，再读到原回执的观察结果；缺回执保留 UNKNOWN，无重复派发。全部恢复拒绝路径无新密钥、Grant、Attempt 或租约释放；部分更新能回滚。测试证明的是恢复子集，不是 OS 效果隔离、可信安装、终态／Lease 释放事务或完整 H1。

## Done Definition
唯一中文 DEV-862 记录问题、实际用例、审查、提交与 CI，不追加旧流水。APPROVED 保留审批事实，执行结论以同一条目为准。原 WIP 与本任务补丁严格分开。

## Risks
隔离只表示结果不明，不是进程终止证据；旧进程可能仍活着，Lease 必须保持阻断。对账时外部只读结果不能直接变成终态。测试凭据与进程都必须精确归属；无法证明清理安全时失败并保留，不能泛删凭据或进程。生产安装和持续效果约束仍由后续门禁负责。

## Output Required
认证中断隔离实现、独立进程恢复回归及对应工程事实；收尾只链接同一 [DEV-862](../development-log.md#记录-dev-862)，不新增重复验收报告。
