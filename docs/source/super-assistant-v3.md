# Super Assistant

## 智能体统一管理与任务协作平台产品方案

**版本：V3.0 正式版**

------

# 一、产品定义

## 1.1 产品名称

**Super Assistant**

中文名称：

**超级助理**

产品定位：

**智能体统一管理与任务协作平台**

------

## 1.2 一句话定位

Super Assistant 是一个帮助用户统一创建、接入、管理和使用 AI 智能体，并由超级助理组织这些智能体在实际项目和业务环境中共同完成任务的工作平台。

用户主要负责：

> 提出目标和做关键决定。

超级助理负责：

> 理解目标、选择智能体、选择项目、组织任务、协调执行、处理普通问题、跟踪结果和请求必要授权。

Agent 负责：

> 完成实际工作。

------

# 二、产品核心价值

Super Assistant 不重新创造新的大模型或 Coding Agent。

平台重点解决 AI Agent 真正进入长期工作之后产生的管理问题。

## 2.1 找谁做

用户不需要记住不同 Agent 的使用边界。

超级助理知道：

- 每个 Agent 是什么；
  -能完成哪些 Function；
  -适合哪些任务；
  -当前是否可用；
  -在哪些 Project 中可以工作。

------

## 2.2 去哪里做

平台长期保存 Project 和相关工作环境。

用户提出：

> 修改天工维序登录功能。

超级助理可以自动找到：

- 天工维序 Project；
  -项目目录；
  -Repository；
  -项目 Agent；
  -Codex；
  -项目 Function 与 Capability。

------

## 2.3 用什么做

每个 Agent 都公开自己的 Function。

Function 背后可以由：

- Skill；
  -MCP；
  -Tool；
  -Plugin；
  -API；

提供支撑。

普通用户主要关注：

> Agent 能做什么。

超级助理再负责：

> Agent 应该使用什么能力完成。

------

## 2.4 怎么一起做

复杂工作可以由多个 Agent 共同参与一个 Task。

例如：

```text
日志分析
→ 项目分析
→ Codex 修复
→ 测试
→ 验收
```

用户只需要理解：

> 一个 Task 有哪些 Agent 参与、分别负责什么、当前轮到谁。

------

## 2.5 什么时候找人

事实明确、风险低的问题由超级助理处理。

涉及：

- 业务规则；
  -架构；
  -数据结构；
  -生产环境；
  -权限；
  -高风险操作；

时请求用户决定。

------

# 三、产品核心模型

Super Assistant 只要求用户理解四个主要对象。

## Super Assistant

负责理解、规划、协调和管理。

## Agent

负责执行工作。

## Project

负责承载长期项目环境和工作上下文。

## Task

负责承载一次完整用户目标。

Task 内部可以进一步包含：

## Work Item

表示具体分配给某个 Agent 的一项工作。

Work Item 是 Task 的内部执行单元，不作为独立一级产品概念。

------

# 四、产品一级导航

一级导航固定为：

## 超级助理

AI 工作入口和全局管理入口。

## 智能体中心

管理所有 Agent。

## 任务中心

管理所有 Task。

## 项目中心

管理长期 Project。

## 设置

管理平台级连接和配置。

用户不确定应该进入哪个页面时，可以始终直接使用超级助理。

------

# 五、首次使用

首次进入平台不要求用户先理解所有功能。

Super Assistant 提供四个入口：

### 接入一个已有智能体

适合已经拥有 Codex、内部 Agent 或脚本 Agent 的用户。

### 添加一个项目

适合首先管理软件项目的用户。

### 帮我创建一个智能体

由超级助理引导建立 Agent。

### 直接开始一个任务

由超级助理根据任务反向判断需要什么 Agent 和 Project。

同时提供 3—5 个简单示例，让用户知道可以直接说什么。

------

# 六、超级助理

Super Assistant 是整个产品的默认首页。

产品原则：

# 不知道去哪里，就先问超级助理。

------

# 七、超级助理首页

默认界面保持简单，只包含三部分。

## 7.1 主交互区域

用户直接输入目标。

例如：

> 修一下天工维序的登录 Bug。

> Codex 最近在做什么？

> 最近哪个项目异常最多？

> 帮我创建一个程序日志 Agent。

> 最近运营数据有什么变化？

------

## 7.2 关键工作摘要

默认最多展示三组最重要的信息。

例如：

```text
运行任务    8

等待决定    2

异常任务    1
```

超级助理可以根据用户工作自动调整摘要内容。

------

## 7.3 待决定事项

存在需要用户参与的问题时显示。

没有待决定事项时不占页面空间。

------

# 八、动态内容

其他内容均按需展开。

Super Assistant 可以在当前页面直接展示：

- Agent Card；
  -Project Card；
  -Task Board；
  -Decision Card；
  -数据表格；
  -指标卡；
  -趋势图；
  -分析结果；
  -用户操作历史。

例如用户说：

> 打开 TASK-032。

Super Assistant 可以直接在对话区域呈现 TASK-032 看板。

用户不需要离开当前页面。

------

# 九、数据可视化

超级助理提供一组有限、通用的数据展示组件。

## 指标卡

用于展示当前 KPI、变化和状态。

最少需要：

- 指标名称；
  -当前值。

有历史数据时可以补充：

- 环比；
  -同比；
  -趋势。

------

## 折线图

用于连续时间数据。

需要：

- 时间；
  -数值；
  -可选系列名称。

支持：

- 时间范围调整；
  -查看数据点；
  -下钻相关明细。

数据不足以形成趋势时降级为指标卡或表格。

------

## 柱状图

用于分类比较和排名。

需要：

- 分类；
  -数值。

------

## 环形图

用于明确的组成关系。

需要：

- 类别；
  -占比或数量。

类别过多时自动使用列表或柱状图。

------

## 漏斗图

用于存在明确阶段关系的转化数据。

例如：

```text
曝光
→ 点击
→ 咨询
→ 下单
```

------

## 数据表格

用于需要查看明细、排序和筛选的场景。

所有图表支持按实际数据源进行刷新。

动态刷新频率由数据源配置决定。

单次回答优先使用能够说明问题的最少数量图表，不为展示而堆叠图表。

------

# 十、数据分析能力

Super Assistant 可以调用 Agent 或数据工具完成以下分析。

## 当前值分析

输入：

至少一个当前指标。

输出：

当前值、状态和必要说明。

------

## 历史趋势

输入：

连续时间数据。

输出：

上升、下降、稳定或明显波动，并展示对应趋势。

------

## 环比分析

需要：

至少两个可比较的连续周期。

输出：

变化值、变化比例和方向。

数据不足时明确显示：

> 数据不足，无法计算环比。

------

## 同比分析

需要：

具有对应历史同期的数据。

数据不存在时不进行推断。

------

## 异常分析

根据提前配置的：

- 业务阈值；
  -历史区间；
  -统计变化；
  -Agent 判断；

识别值得关注的变化。

------

## Top / Bottom

用于：

- 排名；
  -异常项目；
  -表现最好或最差对象。

------

## 关联分析

用于比较多个指标是否存在明显共同变化。

不将简单相关性直接表述为因果关系。

------

## Agent 解读

Agent 可以基于数据生成：

- 数据摘要；
  -趋势判断；
  -异常原因假设；
  -风险提示；
  -行动建议。

需要进一步业务动作时，通过 Task 或 Decision 继续处理。

------

# 十一、全局超级助理小窗

用户进入：

- Agent Detail；
  -Task Detail；
  -Project Detail；
  -Settings；

之后仍然能够打开超级助理小窗。

超级助理默认获得当前页面对象上下文。

例如用户正在：

**天工维序 → Project Detail**

直接问：

> 最近怎么老出问题？

Super Assistant 默认理解为当前项目。

------

# 十二、Execution Proposal

由 AI 主动创建重要 Agent、Task 或执行计划前，首先形成：

# Execution Proposal

即：

**执行方案。**

------

# 十三、Execution Proposal 内容

包括：

## 目标

本次需要实现什么。

## Project

涉及哪些项目。

## Agent

计划使用哪些智能体。

## Work Item

每个 Agent 分别承担什么。

## 执行顺序

哪些工作：

- 先后执行；
  -可以并行；
  -存在依赖。

## Capability

主要需要哪些 Function 和支撑能力。

## 授权范围

用户本次允许的自动行为。

## 需要再次确认的行为

超出什么范围时必须重新确认。

## 验收条件

满足什么条件后任务才算完成。

------

# 十四、快速理解模式

所有创建 Task 的入口默认由 Super Assistant 处理。

但超级助理不会固定逐项询问。

如果用户已经说明：

- Project；
  -Agent；
  -目标；
  -要求；

等足够信息，则直接生成 Execution Proposal。

例如：

> 用 Codex 在天工维序修复登录接口 500，相关日志已经在附件中，不修改数据库。

可以直接产生方案。

信息不足时才继续提问。

------

# 十五、Proposal 预检

用户确认 Proposal 后，在真正开始执行之前进行一次预检。

确认：

- Agent 仍然可用；
  -Project 仍然有效；
  -所需 Capability 可用；
  -授权仍有效；
  -相关 Project 状态没有发生影响执行的重要变化。

如果预检通过：

开始 Task。

如果关键条件变化：

重新显示更新后的 Proposal。

避免用户批准很久后，平台按照已经失效的信息执行。

------

# 十六、智能体中心

智能体中心回答：

# 我有哪些 Agent，它们现在能做什么？

------

# 十七、Agent Card

Agent Card 显示：

- 名称；
  -角色；
  -主状态；
  -当前 Work Item 数；
  -关联 Project 数；
  -最近 Activity。

------

# 十八、Agent 状态

Agent 状态由两个维度构成。

## Connection

表示能不能连接：

```text
已连接
需要认证
不可用
已禁用
```

## Availability

表示是否可以接工作：

```text
可接任务
已满载
暂停
异常
```

Agent Card 主状态使用 Availability。

当 Connection 异常时，在卡片上增加连接警告。

状态展示优先级：

```text
连接异常
>
运行异常
>
正常可用状态
```

例如：

**Codex Developer**

主状态：

> 已满载

附加信息：

> Connected

而：

**Project Agent**

主状态：

> 不可用

原因：

> Authentication Required

不会出现逻辑冲突的组合，例如：

> 已禁用 + 可接任务。

------

# 十九、Agent 分类

平台提供主要工作类别用于筛选：

- 开发；
  -项目；
  -测试；
  -监察；
  -数据；
  -运营；
  -HR；
  -其他。

每个 Agent 有一个主要类别。

同时可以拥有多个用户自定义标签。

类别主要用于：

- 展示；
  -筛选；
  -推荐。

超级助理最终选择 Agent 时仍依据：

- Function；
  -Project；
  -可用状态；
  -授权；

而不是仅依据分类。

------

# 二十、Agent Detail

固定包含：

## 概览

身份、角色、状态、负载、最近工作。

## 功能

面向用户展示 Function。

## 支撑能力

Skill、MCP、Tool、Plugin、API。

默认折叠。

## 项目

Agent 当前在哪些 Project 工作。

## 任务

所有关联 Task 与 Work Item。

## 设置

接入、权限、触发和 Agent 配置。

------

# 二十一、创建 Agent

提供三种方式。

## 让超级助理创建

推荐方式。

## 从模板开始

利用预置岗位配置。

## 接入已有 Agent

用于 Codex、已有内部 Agent、脚本或服务。

------

# 二十二、Agent Template

平台内置七类基础模板。

模板不是独立一级页面，只存在于：

**创建 Agent**

流程中。

------

# 二十三、项目维护智能体模板

定位：

维护一个或多个长期 Project 的业务和技术上下文。

核心 Function：

| Function     | 作用                          | 主要输入                | 主要输出          |
| ------------ | ----------------------------- | ----------------------- | ----------------- |
| 查询项目     | 获取项目基本情况              | Project                 | 项目摘要          |
| 查询文档     | 查找项目资料                  | Project、问题           | 相关文档信息      |
| 分析需求     | 理解新需求                    | Project、需求           | 需求分析          |
| 分析 Bug     | 判断项目问题                  | Project、问题、可选日志 | 原因与影响分析    |
| 查询历史     | 查询历史 Task/Decision/Change | Project、查询条件       | 历史上下文        |
| 准备开发任务 | 为 Coding Agent 整理上下文    | Project、目标           | 开发 Task Package |

常用支撑能力：

- 文件/文档检索；
  -Repository 查询；
  -项目知识能力。

创建时主要填写：

- Agent 名称；
  -关联 Project；
  -主要文档位置；
  -可访问范围。

------

# 二十四、程序日志智能体模板

定位：

分析已经由监控程序发现的异常事件。

核心 Function：

| Function     | 作用              | 输入                 | 输出     |
| ------------ | ----------------- | -------------------- | -------- |
| 分析日志     | 理解日志内容      | 日志数据             | 日志分析 |
| 聚合错误     | 合并重复异常      | 异常列表             | 错误组   |
| 判断严重度   | 判断异常影响      | 错误组、规则         | 严重度   |
| 初步诊断     | 分析可能根因      | 错误、Project 上下文 | 诊断结果 |
| 创建异常任务 | 创建后续处理 Task | 诊断、目标 Agent     | Task     |

实际持续监听由普通程序或监测服务完成。

Agent 只在达到需要分析的条件时调用。

------

# 二十五、开发智能体模板

定位：

实际修改软件项目。

默认 Runtime：

Codex。

核心 Function：

- 分析代码；
  -实现需求；
  -修复 Bug；
  -运行测试；
  -代码 Review；
  -修复 CI；
  -生成代码变更结果。

主要输入：

- Project；
  -任务目标；
  -验收条件；
  -相关上下文。

------

# 二十六、测试智能体模板

核心 Function：

- 分析验收条件；
  -生成测试计划；
  -运行现有测试；
  -执行专项测试；
  -分析失败；
  -生成测试报告；
  -判断是否通过。

测试失败可以直接生成新的修复 Work Item。

------

# 二十七、监察智能体模板

核心 Function：

- 检查 Task 是否长期无进展；
  -检查 Work Item 是否重复失败；
  -检查任务是否偏离目标；
  -检查 Agent 是否异常；
  -检查结果是否满足验收条件；
  -生成异常报告。

它是预置模板。

只有用户实际创建以后才成为 Agent Center 中的 Agent。

------

# 二十八、HR 智能体模板

核心 Function：

- 简历信息提取；
  -岗位要求匹配；
  -候选人整理；
  -候选人摘要；
  -招聘状态查询；
  -招聘跟进建议。

是否发送消息、修改招聘状态等具有外部副作用的行为根据授权执行。

------

# 二十九、运营数据智能体模板

核心 Function：

- 查询指标；
  -时间趋势分析；
  -环比/同比；
  -异常识别；
  -异常原因分析；
  -Top / Bottom；
  -生成运营摘要；
  -生成行动建议。

数据来源通过已有 API 或数据连接获得。

涉及发布、预算等外部动作时需要单独授权。

------

# 三十、SAI 智能体接入

Super Assistant 通过统一智能体能力描述管理 Agent。

称为：

# SAI — Super Assistant Agent Interface

SAI 只规定平台需要知道什么。

不限制 Agent 内部如何实现。

------

# 三十一、SAI 最小能力

一个 Agent 至少让平台获得：

## Agent Info

是谁、版本、位置或服务地址。

## Function List

能做哪些工作。

## Function Description

每项工作需要哪些输入、返回什么。

## Status

是否连接、是否可以接任务。

## Task Execution

如何开始和继续工作。

## Result

如何获取执行结果。

这是第一阶段必须实现的最小 SAI。

更完整的认证、错误码和版本规范在独立技术文档定义。

------

# 三十二、Agent 接入方式

## 原生 SAI

自研 Agent 直接按照 SAI 开发。

## 专用 Adapter

成熟产品根据它已有的官方接口进行适配。

第一阶段正式支持：

# Codex Adapter

其他 Agent 后续逐一接入。

## 配置式接入

简单脚本或遗留系统由用户配置：

- Function；
  -启动方式；
  -输入；
  -结果；
  -状态读取方式。

------

# 三十三、Adapter 维护

每个 Adapter 记录：

- 上游产品版本；
  -Adapter 版本；
  -兼容状态。

上游接口升级时先进行兼容检查。

对于存在破坏性变化的版本：

- 新 Task 暂停使用不兼容功能；
  -正在执行的 Task 尽量继续使用创建时版本；
  -无法继续时进入阻塞并通知用户。

第一阶段不同时维护大量 Coding Agent Adapter。

首先把 Codex 接入做好。

------

# 三十四、Codex Developer

Codex 作为第一优先开发 Agent。

平台通过 Codex Adapter 封装官方能力。

用户看到：

## Functions

- Feature Development；
  -Bug Fix；
  -Code Analysis；
  -Test；
  -Code Review；
  -CI Fix。

## Skills

显示当前 Project/Workspace 可使用的 Codex Skill。

## MCP / App / Tool

显示当前连接和可以提供的工作能力。

## Current Work

当前 Task 和 Work Item。

产品层不要求用户理解 App Server、Thread、Turn 等实现细节。

------

# 三十五、Project Center

Project Center 回答：

# 我的长期项目现在怎么样？

------

# 三十六、Project 状态

Project 使用：

```text
初始化中
活跃
暂停
归档
异常
```

### 初始化中

项目尚未完成基本环境识别。

### 活跃

允许创建和执行新的 Task。

### 暂停

暂时不创建新的自动 Task。

### 异常

存在影响正常工作的连接或配置问题。

### 归档

项目不再接受新的 Task，但历史数据保留。

------

# 三十七、Project 归档

如果 Project 存在活跃 Task：

不能直接完成归档。

用户可以选择：

- 等 Task 完成后归档；
  -暂停/取消相关 Task 后归档。

归档后：

- 历史 Task 保留；
  -历史 Change 保留；
  -历史 Agent 关系保留；
  -不能创建新 Task。

Project 不执行业务级硬删除。

------

# 三十八、Project Card

显示：

- Project 名称；
  -状态；
  -当前 Task；
  -活跃 Agent；
  -最近变化；
  -异常提示；
  -最后活动时间。

默认按照：

**最近活动时间**

排序。

异常 Project 可以提升显示优先级。

------

# 三十九、Project Detail

包括：

## 概览

基本信息和当前状态。

## 任务

所有相关 Task。

## 智能体

有哪些 Agent 正在或曾经参与。

## 变更记录

Project 实际发生的变化。

## 资源与能力

Workspace、Repository、文档、项目 Capability。

## 设置

Project 配置。

------

# 四十、Project 基础信息

包括：

- 名称；
  -简介；
  -Workspace；
  -Repository；
  -默认 Branch；
  -技术栈；
  -Project Agent；
  -默认 Developer Agent。

其中：

### Workspace / Repository

首次添加 Project 时自动识别，可人工修改。

### 技术栈

自动扫描形成初始结果，用户可以修正。

### Project Agent

可选。

### 默认 Developer Agent

可选。

未设置时，由 Super Assistant 在创建 Task 时选择。

------

# 四十一、Project Change Log

用于回答：

> 项目本身发生了什么？

记录：

- 时间；
  -变更类型；
  -来源 Task；
  -执行 Agent；
  -涉及模块；
  -Commit / PR；
  -配置变化；
  -版本变化；
  -用户授权。

支持：

- 时间筛选；
  -Agent 筛选；
  -Task 筛选；
  -变更类型筛选。

默认优先显示近期变化。

------

# 四十二、回滚记录

如果某次变更被回滚：

不删除原 Change。

新增：

# Rollback Change

并引用原变更。

原变更状态更新为：

> 已回滚

原 Task 对应 Artifact 同样标记：

> 已回滚

保留完整历史链路。

------

# 四十三、Task Center

Task Center 回答：

# 所有工作现在做到哪里？

------

# 四十四、Task 创建流程

所有 Task 创建入口统一经过以下步骤：

```text
用户目标
↓
超级助理理解
↓
补充必要信息
↓
确定 Project
↓
确定 Agent
↓
拆分 Work Item
↓
确定执行顺序和依赖
↓
确定授权范围
↓
生成 Execution Proposal
↓
用户确认
↓
执行前预检
↓
Task 开始
```

信息已经充分时：

跳过不必要的追问。

------

# 四十五、Task

Task 表示一个完整用户目标。

例如：

> 完成新版订单导出。

即使涉及：

- Backend；
  -Frontend；
  -Codex；
  -测试；
  -验收；

用户仍然看到一个 Task。

------

# 四十六、Work Item

复杂 Task 根据实际执行需要拆成 Work Item。

每个 Work Item 包含：

- 工作内容；
  -负责 Agent；
  -所属 Project；
  -状态；
  -前置依赖；
  -输入；
  -预期输出；
  -执行结果。

------

# 四十七、简单 Task

如果一个 Task：

- 只有一个 Agent；
  -只有一个 Work Item；

产品界面默认隐藏 Work Item 层。

用户直接看到：

```text
需求分析
→ 执行
→ 验收
```

只有复杂任务才显式展示 Work Item。

避免用户为简单任务学习额外概念。

------

# 四十八、Work Item 依赖

支持三种关系。

## 顺序

B 必须等待 A 完成。

```text
A → B
```

## 并行

A 与 B 可以同时执行。

```text
A
├── B1
└── B2
```

## 验收依赖

测试或监察需要等待对应开发 Work Item 完成。

依赖由 Super Assistant 在 Execution Proposal 中规划。

用户确认后成为 Task 的正式执行关系。

------

# 四十九、并发冲突

两个 Work Item 可以并行，但不能未经处理同时修改同一受保护资源。

对于软件项目，平台在执行前检查：

- Workspace；
  -Branch；
  -模块；
  -共享配置；
  -数据库结构；
  -公共依赖。

存在明显写入冲突时：

- 调整为顺序执行；
  -或者建立独立工作区；
  -无法安全处理时请求用户。

具体资源锁实现属于任务执行技术规范。

------

# 五十、Task 状态

Task 使用：

```text
待确认
等待执行
执行中
等待用户
已暂停
已阻塞
已完成
失败
已取消
```

------

# 五十一、Work Item 状态

使用：

```text
等待
执行中
等待输入
等待用户
已完成
验收失败
已阻塞
失败
已取消
```

------

# 五十二、Task 状态推导

Task 状态根据 Work Item 和 Decision 自动形成。

规则优先级：

### 用户主动暂停

Task：

> 已暂停

### 存在不可恢复失败

Task：

> 失败

### 存在正在执行的 Work Item

Task：

> 执行中

### 存在验收失败并已经进入修复

Task：

> 执行中

### 没有执行中的工作，但存在等待用户的 Work Item 或 Decision

Task：

> 等待用户

### 没有执行中的工作，但存在阻塞 Work Item

Task：

> 已阻塞

### 所有必要 Work Item 已完成，且没有待处理 Decision

Task：

> 已完成

### 尚未开始

根据阶段分别为：

> 待确认 / 等待执行

------

# 五十三、Task Detail

包括：

## 概览

目标、状态、Project、负责人。

## 进度

阶段和复杂 Task 的 Work Item。

## 智能体分配

每个 Agent 负责什么。

## 项目与资源

涉及哪些 Project。

## 决策

当前和历史 Decision。

## 日志

Task 工作动态与原始日志。

## 产出

最终 Artifact。

------

# 五十四、Task 执行流程

正式开始后：

```text
执行可用 Work Item
↓
Agent 工作
↓
产生 Activity
↓
成功
    ↓
更新 Work Item
    ↓
检查新的可执行 Work Item
↓
失败
    ↓
判断重试 / 退回 / 阻塞
↓
需要用户
    ↓
创建 Decision
↓
全部满足验收
    ↓
Task Completed
```

------

# 五十五、验收退回流程

当测试或 Inspector 不通过：

```text
验收 Work Item
↓
验收失败
↓
生成失败说明
↓
重新打开对应开发 Work Item
↓
修复
↓
重新验收
```

所有执行都保留在原 Task。

不会因为一次测试失败创建一个新的顶层 Task。

------

# 五十六、Agent 被停用

如果 Agent 被：

- 禁用；
  -断开；
  -失去认证；

且拥有活动 Work Item：

对应 Work Item：

> 已阻塞

Super Assistant 提供：

- 等待恢复；
  -重新分配 Agent；
  -取消 Work Item。

已完成结果不受影响。

------

# 五十七、Decision

Decision 数据只保存一份。

用户可以在：

## Super Assistant

统一看到全部等待处理事项。

或者：

## Task Detail

直接处理当前 Task 的 Decision。

处理结果立即同步。

------

# 五十八、Decision Card

必需信息：

- Decision 标题；
  -问题背景；
  -来源 Task；
  -来源 Agent；
  -风险等级；
  -当前事实；
  -可选方案；
  -影响；
  -超级助理建议；
  -建议理由。

可选信息：

- 截止时间；
  -附件；
  -自定义方案输入；
  -相关 Project。

------

# 五十九、Decision 优先级

## 普通

不阻塞核心工作或影响较低。

## 重要

阻塞 Task 或涉及明显业务/技术选择。

## 紧急

涉及：

- 生产问题；
  -安全风险；
  -不可逆操作；
  -重大业务影响。

Decision 的超时时间由：

- Template；
  -Project；
  -Task；

配置决定。

不使用全产品统一的固定时间。

------

# 六十、Decision 超时

普通 Decision：

继续保持等待。

重要 Decision：

达到配置时间后再次通知。

紧急 Decision：

如果超过允许等待时间：

Task 保持暂停或阻塞。

不会自动接受 AI 推荐方案。

------

# 六十一、Decision 完成

用户处理以后：

```text
保存 Human History
↓
更新 Task
↓
通知相关 Work Item
↓
恢复可以继续执行的 Agent
```

------

# 六十二、Question Router

Agent 提问首先由 Super Assistant 判断。

分四级。

## L1 明确事实

存在于：

- 当前代码；
  -配置；
  -Project；
  -已确认 Decision。

自动回答。

## L2 低风险执行判断

不改变业务规则和授权范围。

可以自动处理。

## L3 重要确认

涉及：

- 产品规则；
  -数据结构；
  -第三方服务；
  -跨项目重要变化；
  -生产环境；
  -预算。

请求用户确认。

## L4 高风险

涉及：

- 权限；
  -安全；
  -敏感信息；
  -不可逆动作；
  -受监管高风险行为。

用户必须介入。

------

# 六十三、日志与人工历史

两种记录保持独立。

## Task Log

记录：

> Agent 做了什么。

## Human History

记录：

> 用户决定了什么。

通过：

- Task ID；
  -Decision ID；

建立关联。

------

# 六十四、Task Log

默认展示：

# Activity

只保留重要工作事件。

例如：

```text
Codex 开始分析

Codex 完成代码修改

测试开始

测试失败

用户批准方案 A

Codex 恢复执行
```

其中“用户批准”只作为执行上下文引用。

完整 Decision 内容仍然属于 Human History。

高级用户可以查看 Raw Log。

------

# 六十五、Artifact

Task 产出统一称为：

# Artifact

包括：

- 代码变更；
  -PR / Commit；
  -文档；
  -数据文件；
  -测试报告；
  -图表；
  -配置；
  -其他 Agent 输出。

------

# 六十六、Artifact 版本

同一个 Work Item 重新执行时：

不会覆盖旧 Artifact。

生成新版本。

例如：

```text
Test Report v1
Failed

Test Report v2
Passed
```

------

# 六十七、Artifact 权限与保存

Artifact 默认继承：

> Task 访问权限。

存储时长、单文件大小和清理规则由系统设置控制。

不在产品方案中固定统一数值。

Agent 自定义 Artifact 时，通过 SAI 声明：

- 名称；
  -类型；
  -格式；
  -展示方式。

平台不能识别的格式提供下载或外部链接。

------

# 六十八、持续监测

持续监测不等于 Agent 长期占用模型。

工作模式为：

```text
普通程序持续获取数据
↓
标准规则判断
↓
正常
继续监测
↓
达到需要智能分析的条件
调用 Agent
```

------

# 六十九、事件聚合

同类事件在设定时间窗口内可以合并。

例如：

同一错误在一分钟出现 100 次：

不会调用 Agent 100 次。

而是形成：

```text
异常类型
发生次数
第一次时间
最后一次时间
代表样本
```

再调用一次 Agent。

------

# 七十、调用限制

持续 Agent 可以配置：

- 单位时间最大智能分析次数；
  -同类事件冷却时间；
  -最大并发；
  -调用预算。

达到限制时根据配置：

- 仅记录；
  -延迟分析；
  -汇总后分析；
  -通知用户。

------

# 七十一、持续监测场景

当前产品正式支持的目标是：

- 监测；
  -分析；
  -判断；
  -生成报告；
  -生成建议；
  -创建后续 Task。

对于金融等高风险场景：

当前产品仅定位于：

# 数据监测、分析和建议

不将真实资金自动交易作为通用产品能力。

需要执行真实资金行为时，应作为独立受监管场景另行设计。

------

# 七十二、Project Change 与 Task Rollback

Task 如果支持回滚：

执行后：

- 新增 Rollback Change；
  -原 Change 标为“已回滚”；
  -对应 Artifact 标为“已回滚”；
  -Task History 保留完整记录。

不存在删除历史来制造“没有发生过”的情况。

------

# 七十三、Super Assistant 运行模式

Super Assistant 使用：

# 事件唤醒 + 持久状态

会在以下情况调用：

- 用户输入；
  -Agent 提问；
  -Work Item 状态变化；
  -Decision 完成；
  -监测事件；
  -异常事件。

每次只加载：

- 当前 Task；
  -相关 Work Item；
  -相关 Agent；
  -相关 Project；
  -必要历史 Decision。

避免把所有历史内容持续放入模型上下文。

------

# 七十四、Super Assistant 不可用时

如果超级助理使用的模型或网络暂时不可用：

## 已经运行的独立 Agent Task

允许继续执行已经授权的工作。

## 新 Decision

保存为等待状态。

## Task / Agent / Project 页面

仍然可以只读查看现有信息。

## 新的 AI 规划操作

暂时不可用。

例如：

- 创建 Agent；
  -自动规划 Task；
  -重新编排工作。

恢复后继续。

核心任务数据不依赖模型会话保存。

------

# 七十五、Agent 版本变化

每个 Agent 登记：

- Agent Version；
  -Function Version。

Agent 更新后重新同步 Function。

如果只是兼容升级：

继续使用。

如果 Function：

- 被删除；
  -参数发生不兼容变化；
  -行为发生重要改变；

且影响活动 Work Item：

对应工作进入：

> 已阻塞

由 Super Assistant 重新检查执行方案。

------

# 七十六、设置

设置页包含：

## Agent Runtime

查看：

- 已注册 Runtime；
  -连接状态；
  -版本；
  -启用状态。

## 外部连接

查看：

- 名称；
  -类型；
  -认证；
  -连接状态；
  -最近使用；
  -测试连接。

## 权限与授权

管理：

- 默认授权策略；
  -高风险动作规则；
  -Agent 访问范围。

## 通知

管理：

- 渠道；
  -优先级；
  -免打扰；
  -聚合。

## 模型

管理：

- Super Assistant 默认模型；
  -备用模型；
  -基础模型策略。

## 存储

管理：

- 日志保留；
  -Artifact 保留；
  -清理。

## 系统

管理：

- 语言；
  -时区；
  -主题；
  -数据导出；
  -账户。

------

# 七十七、通知

通知类型主要包括：

- 等待 Decision；
  -紧急 Decision；
  -Task 完成；
  -Task 失败；
  -Agent 不可用；
  -Project 异常。

通知支持：

- 站内；
  -桌面；
  -Email；
  -企业 IM。

------

# 七十八、通知规则

高频同类通知支持聚合。

例如：

> 过去 10 分钟出现 8 个相同异常。

而不是推送 8 条。

支持：

- 优先级过滤；
  -免打扰；
  -已读状态；
  -点击进入对应 Task / Project / Agent。

紧急事件可以绕过普通免打扰策略，但具体规则由用户设置。

------

# 七十九、核心工作流程

## 创建任务

```text
目标
→ 理解
→ Project
→ Agent
→ Work Item
→ Proposal
→ 用户确认
→ 预检
→ 执行
```

## 执行任务

```text
Work Item 可执行
→ Agent
→ Activity
→ Result
→ 下一 Work Item
```

## 处理决策

```text
Agent Question
→ Question Router
→ L1/L2 自动处理
→ L3/L4 Decision
→ 用户决定
→ 恢复 Work Item
```

## 验收退回

```text
执行完成
→ Testing / Inspection
→ 通过
    → 完成
→ 不通过
    → 失败说明
    → 重新打开工作项
    → 修复
    → 再验收
```

------

# 八十、第一版本用户范围

第一阶段首先针对：

# 单用户工作空间

优化产品体验。

一个用户拥有：

- Agents；
  -Projects；
  -Tasks；
  -Connections。

产品数据结构保留 Workspace 和 Owner 概念，为后续团队模式留下扩展空间。

多成员、角色权限、多人审批等属于后续版本。

------

# 八十一、第一建设阶段

核心目标：

# Super Assistant 管理 Codex 完成真实开发任务

重点完成：

- Onboarding；
  -Super Assistant；
  -Agent Center；
  -Project Center；
  -Task Center；
  -Codex Adapter；
  -SAI 最小接口；
  -Function 展示；
  -Skill / MCP 展示；
  -Work Item；
  -Execution Proposal；
  -Question Router；
  -Decision；
  -Task Log；
  -Artifact；
  -Project Change Log。

其中：

# Codex Adapter

属于第一阶段关键路径。

不同时承诺多个 Coding Agent 深度接入。

------

# 八十二、第二建设阶段

加入：

- Agent Template；
  -Project Agent；
  -Program Log Agent；
  -Testing Agent；
  -Inspector Agent；
  -多 Agent Task；
  -持续监测；
  -事件聚合；
  -自动接力；
  -验收退回。

形成完整：

```text
发现
→ 分析
→ 开发
→ 测试
→ 验收
```

闭环。

------

# 八十三、第三建设阶段

继续扩展：

- 运营 Agent；
  -HR Agent；
  -数据 Agent；
  -企业内部 Agent；
  -更多成熟 Agent Adapter；
  -团队 Workspace。

不增加新的一级导航。

新的能力继续落入：

```text
Agent
Project
Task
Super Assistant
```

体系。

------

# 八十四、技术实现边界

产品可以基于现有能力实现。

Codex 使用官方能力通过专用 Adapter 接入。

自研 Agent 可以直接实现 SAI。

遗留 Agent 可以通过轻量 Adapter 或配置接入。

长期监测使用普通脚本、API、Webhook、Scheduler 等既有软件方式完成。

Agent 只在需要智能判断时运行。

多 Agent 协作通过 Task + Work Item 实现，而不是重新设计复杂工作流引擎。

详细实现由以下独立文档承载：

- 《SAI 智能体接口规范》
- 《Codex Adapter 设计规范》
- 《Task / Work Item 状态与执行规范》
- 《数据模型设计》
- 《权限与安全设计》
- 《前端交互与组件规范》

------

# 八十五、正式产品验收目标

产品完成后至少满足：

## 用户入口

用户可以不理解 Agent 架构，直接通过 Super Assistant 提出目标。

## Proposal

AI 重要执行方案必须先供用户确认。

## 快速模式

信息充分的请求可以直接生成 Proposal，不重复追问。

## Agent

可以查看 Agent 状态、Function、Project 和 Task。

## Codex

可以被 Super Assistant 启动和管理开发任务，并展示项目可用 Skill 和相关能力。

## Project

能够集中查看项目任务、Agent 和变更历史。

## Task

能够管理完整目标和执行状态。

## Work Item

复杂 Task 可以拆给多个 Agent 或多个 Project。

## 状态

Task 状态可以由 Work Item 和 Decision 一致推导。

## Decision

可以从 Super Assistant 和 Task Detail 处理同一 Decision。

## Question Router

明确事实问题可以自动回答；高风险问题不会由 AI 越权处理。

## 日志

Agent 工作和人的管理决策均可追溯。

## Artifact

任务结果支持版本化查看。

## Rollback

底层支持回滚的任务可以完整记录回滚历史。

## 持续监测

普通程序持续采集，Agent 按条件进行智能分析，并支持事件聚合和频率限制。

## 降级

Super Assistant 暂时不可用时，已授权独立任务不会丢失。

------

# 八十六、最终产品逻辑

Super Assistant 的产品逻辑最终保持为：

# 用户提出目标

↓

# Super Assistant 规划与管理

↓

# Agent 完成 Work Item

↓

# Work Item 共同完成 Task

↓

# Task 改变 Project 或产生业务结果

平台的复杂性隐藏在 Super Assistant 后面。

用户不需要首先理解：

- Adapter；
  -SAI；
  -Skill；
  -MCP；
  -状态机；
  -事件；
  -上下文；
  -协作协议。

用户真正需要理解的是：

> **我想完成什么。**

Super Assistant 负责继续回答：

> 用哪个 Agent。

> 在哪个 Project。

> 分成哪些工作。

> 哪些可以并行。

> 需要什么能力。

> 是否需要用户授权。

> 当前做到哪里。

> 为什么卡住。

> 接下来应该怎么办。

最终产品提供的不是另一套复杂 AI 开发工具，而是：

# 一个让人真正能够管理 AI 工作的统一工作平台。