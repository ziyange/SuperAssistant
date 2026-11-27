# TASK-858: 安全提交日志迁移并验证候选 CI

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
授权依据：用户于 2026-11-27 要求先安全提交日志迁移、验证 CI，不混入原有未提交的应用改动，再解决其余合并阻断。允许向已配置 origin 的当前候选分支正常推送，不允许强推或直接更新 main。

## Requirement IDs
REQ-096, REQ-099

## Objective
形成包含治理代码和完整历史文档依赖的独立可复现提交，在干净副本及该提交对应的 GitHub Actions 验证。旧任务文档作为证据导入，不恢复旧任务执行权、不验收其中提到的应用代码。

## Context Pack
- docs/delivery/tasks/TASK-857.md
- docs/delivery/logging-baseline.json
- docs/delivery/development-log.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/verification/quality-gate.md
- docs/decisions/ADR-009-development-records.md

## Allowed Files
- .gitattributes
- .github/workflows/docs-gates.yml
- AGENTS.md
- docs/README.md
- docs/decisions/README.md
- docs/decisions/ADR-009-development-records.md
- docs/delivery/development-log.md
- docs/delivery/logging-baseline.json
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/delivery/phase-007-integration-recovery.md
- docs/delivery/tasks/TASK-850.md
- docs/delivery/tasks/TASK-851.md
- docs/delivery/tasks/TASK-852.md
- docs/delivery/tasks/TASK-853.md
- docs/delivery/tasks/TASK-854.md
- docs/delivery/tasks/TASK-855.md
- docs/delivery/tasks/TASK-856.md
- docs/delivery/tasks/TASK-857.md
- docs/delivery/tasks/TASK-858.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
- scripts/check_delivery_records.py
- scripts/check_task_audit_history.py
- tests/test_delivery_records.py
- tests/test_check_task_audit_history.py

## Forbidden Files
全部应用源码、原生诊断脚本及其测试、docs/security.md、其他工作树和系统设置。历史两份日志保持原字节；TASK-852、853、854 仅允许去除末尾多余空行，原字节须先存入冻结清单并以原 SHA256 校验，禁止修改正文、状态和迭代上限；其余旧任务文档原字节提交。禁止混入应用改动、强推、更新 main、删除分支／工作树或发布。真实 Codex 和 Electron 沙箱验证继续延期。

## Interfaces / Contracts
提交前核对精确暂存清单、父提交和数据指纹；提交后用同一 SHA 的干净临时克隆复核治理及文件范围，不以带应用 WIP 的工作目录代替候选提交。CI 只按实际 SHA、Run URL 和结论记证据。

## Data Constraints

保真属性仅针对冻结日志、清单及三份规范化旧文档，确保 Windows 自动换行设置不会改变证据字节；不禁用 diff 或任何空白错误规则。
沿用三份原始日志的冻结哈希，历史数据和剩余应用 WIP 内容不变。冻结清单可追加 format_sources，保存三份旧文档规范化前的原始 Base64；解码后的 SHA256 必须等于既有指纹，当前文档只能为原始内容或仅规范化 EOF 的副本。暂存前要求真实索引为空或仅含已识别的本任务文件；发现未知暂存内容时保留并停止该提交。发布前扫描凭据特征，不打印秘密值。干净副本位于唯一自建临时目录，不注册永久工作树。

## UI Constraints
不启用或修改任何应用能力。人工结果只更新开发记录中的同一条 DEV-858。

## Implementation Requirements
逐个文件暂存，不使用 git add 的全仓库选项。只将旧日志和任务文档作为迁移证据纳入；剩余十个应用相关文件保持未提交。核对 staged diff 后正常提交并推送当前候选分支。CI 失败先定位实际日志，不通过删除测试、放宽门限或自动豁免获得通过。

## Test Requirements
文档链接、全部 Task Pack、需求追踪、五份 Schema、提交范围、历史复核、完整 Python 治理测试及 git diff --check。干净提交中不存在尚未提交的 WFP 应用夹具，必须据实报告发现数量，不沿用上次混合工作目录的 104 例数量。验证 Documentation gates 和 Development application gates 的实际运行。

## Acceptance Criteria
提交文件清单精确匹配允许范围，零应用源码／原生诊断改动；九份旧文档证据原字节可复核，三份 EOF 规范化文档须同时保留原始内容；剩余应用 WIP 不变。干净副本治理通过，推送前远程无未知分叉，当前候选 SHA 的两套 CI 成功或明确记录真实阻断。

## Done Definition
同一中文记录保存提交 SHA、干净验证数量、CI URL／jobs／结论和剩余合并阻断。提交或 CI 成功不等于 H1/H3 验收或 main 已合并。

## Risks
迁移依赖未提交的历史文档，漏掉它们会造成断链和冻结哈希不一致。应用安全文档与源码仍有 WIP，不能以治理提交代为验收。提交失败保留精确暂存现场；远程变化先读差异，不强推覆盖。

## Output Required
独立治理提交、干净候选验证和真实 CI 证据；结果只见 [DEV-858](../development-log.md#记录-dev-858)。
