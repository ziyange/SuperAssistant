# TASK-859: 独立验收 Team HTTP 请求体边界

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
授权依据：用户于 2026-11-27 授权在独立提交日志迁移并核对 CI 后继续解决合并阻断，自行处理可确定的问题。本任务采用新的有限范围，不恢复 TASK-856 的旧执行权。

## Requirement IDs
REQ-081, REQ-093, REQ-094, REQ-095, REQ-097, REQ-099

场景：SCN-TEAM-GOVERNANCE 的 HTTP 前置拒绝边界、SCN-NFR-QUALITY 的请求资源与失败清理；只覆盖这两个场景的所述子集，不声明整个场景通过。

## Objective
在不含原有应用 WIP 的干净候选副本中，先复现 Team HTTP 无界缓冲及非法 JSON 下传，再独立实现并验收请求体边界。原工作树材料保留，不因历史定向测试而直接接受。

## Context Pack
- docs/delivery/tasks/TASK-856.md
- docs/delivery/tasks/TASK-858.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/verification/quality-gate.md
- services/team/src/team-api.ts

## Allowed Files
- docs/delivery/tasks/TASK-859.md
- docs/delivery/development-log.md
- docs/security.md
- services/team/src/server.ts
- services/team/tests/server.test.ts

## Forbidden Files
其他所有文件；特别是旧日志、冻结清单、依赖清单及锁文件、原生探针、WFP 脚本及其测试、生产桌面入口和其他原工作树。不得修改系统审计、网络策略或真实凭据，不运行真实 Codex 和 Electron 沙箱验证，不合并 main、发布或删除原工作树。

## Interfaces / Contracts
认证后的 POST 请求体最多 1,048,576 字节，同时检查声明长度和实际流量；超限 413，未认证 401，非法 JSON 400，均不得调用授权后端或写库。合法 JSON 的既有 API 行为不变。拒绝流不缓存剩余内容；额外排空上限 2 MiB、关闭期限 10 秒，先尽力发送完整拒绝再关闭，不声称恶意客户端必然接收。

## Data Constraints
循环回环地址、可抛弃服务、合成身份和内存仓库，不记录请求体或秘密。依赖使用现有锁文件及 Node 22.x / npm 10.x。干净临时副本与原工作树隔离，原有十份应用 WIP 不改动。迁移 CI 的证据只归 TASK-858，不算本任务验收。

## UI Constraints
无 UI 变更，不启用 Team 生产连接或受保护执行入口。

## Implementation Requirements
按测试先行在提交版本复现，再实现最小边界；借鉴旧工作但不得直接冒充已验收实现。覆盖连接中止、并发、持续发送、响应完整性和清理，不放宽已有门限。仅更新 security 中所属 HTTP 事实，不导入混合的原生诊断段落。使用独立 codex/phase-007-* 分支的临时干净副本，不新增永久 worktree。

## Test Requirements
先运行真实 loopback 超限及非法 JSON 反例，再运行全部 server 测试、完整 unit/contract、lint/typecheck/production build、Python 治理和文件范围门禁。准确列出数据库及原生可选测试的预先批准跳过项；不可当作通过。包含 Windows socket 行为及独立安全审查，候选提交 CI 采用现有两套入口。

## Acceptance Criteria
精确上限可写入一次，一字节超限（声明和 chunked）均 413 且零写入；非法 JSON 400 且不调用授权端；未认证及中止请求零写入；五个并发超限客户端得到完整拒绝；持续发送或不完整输入连接按既有上限清理。完整适用门禁无新增失败，不降低测试断言或门限，文件范围仅为上述五项。

## Done Definition
独立代码审查和实际验证后，在同一中文 DEV-859 条目记录结论、红绿证据、环境、命令、数量、CI 和遗留项。原 TASK-856 历史记录不重写，本任务不证明 H1/H3 或生产级 DoS 防护。

## Risks
过早销毁 socket 可截断 413；仅看 Content-Length 会漏掉流式超限；拒绝时异步迭代器可能暂停流，导致连接和定时器残留。身份提供器超时、生产 TLS、通用限流及完整 Team UI 另属集成门禁，不能因本任务通过宣称完成。

## Output Required
独立可审查的 Team 请求体边界补丁、行为测试及 owning security 事实。收尾只见同一 [DEV-859](../development-log.md#记录-dev-859)，不新增逐操作日志或重复报告；APPROVED 保留审批事实，实际验收以该条目明确范围为准。
