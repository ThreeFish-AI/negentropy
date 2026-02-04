# apps/negentropy-ui 设计与落地方案（产品与架构 + 工程代码）

> 目标：在最小干预前提下，为 [apps/negentropy-ui](../apps/negentropy-ui) 提供可执行的产品与工程落地蓝图，并与后端 ADK 服务现状对齐。

## 0. 范围与约束

- **范围**：仅覆盖 `apps/negentropy-ui` 的产品/交互/架构/落地路径；不改动后端逻辑。
- **约束**：遵循 AG-UI 协议与 Next.js App Router 约束；UI 作为事件流展示层，不自写状态真值。
- **事实源**：本文件所有对接点均以仓库内已存在文件为准，仅提供链接与集成策略，不复制逻辑。

## 1. 事实源盘点（Single Source of Truth）

### 1.1 前端现状

- **应用入口**：[apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)（默认模板占位）。
- **全局布局**：[apps/negentropy-ui/app/layout.tsx](../apps/negentropy-ui/app/layout.tsx)、[apps/negentropy-ui/app/globals.css](../apps/negentropy-ui/app/globals.css)。
- **技术基线**：[apps/negentropy-ui](../apps/negentropy-ui) 已使用 Next.js App Router（[apps/negentropy-ui/app](../apps/negentropy-ui/app)）。<sup>[[1]](#ref1)</sup>

### 1.2 后端 ADK 服务现状

- **ADK Web 入口**：`uv run adk web --port 8000 src/negentropy`（参见 [docs/project-initialization.md](./project-initialization.md)）。
- **对外暴露 Agent**：[apps/negentropy/src/negentropy/__init__.py](../apps/negentropy/src/negentropy/__init__.py) 导出 `agent = root_agent` 与 `runner = get_runner()`。
- **服务后端配置**：[apps/negentropy/src/negentropy/config/services.py](../apps/negentropy/src/negentropy/config/services.py) 以环境变量切换 Session/Memory/Artifact 后端。
- **ADK CLI 补丁**：[apps/negentropy/src/negentropy/engine/bootstrap.py](../apps/negentropy/src/negentropy/engine/bootstrap.py) 绑定自定义服务工厂并注入 tracing。
- **Runner 统一入口**：[apps/negentropy/src/negentropy/engine/factories/runner.py](../apps/negentropy/src/negentropy/engine/factories/runner.py) 组装 Session/Memory/Artifact 服务。

## 2. 产品目标与用户任务（MVP）

### 2.1 核心任务

1. **对话与任务执行**：用户输入目标，Agent 以事件流返回文本/工具/状态。<sup>[[5]](#ref5)</sup><sup>[[6]](#ref6)</sup>
2. **运行可观测**：能看到步骤、工具调用与状态快照。<sup>[[5]](#ref5)</sup>
3. **人机协作（HITL）**：需要确认的步骤以 UI 交互形式呈现。

### 2.2 信息架构（IA）

- **左栏**：会话列表（Session 列表 + 状态标签 + 最近更新时间）
- **主栏**：消息流（Chat）+ 事件流（Event Timeline）
- **右栏**：运行状态（State Snapshot）+ 活动日志（Activity）

## 3. 交互与页面结构（MVP）

### 3.1 页面 A：对话与运行主界面（/）

**布局结构**
- 左栏：会话列表
- 主栏：消息流 + 事件流
- 右栏：状态快照 + 活动日志

**核心交互**
- **新会话**：点击 “New Session” 生成新 `session_id`，立即建立 AG-UI 连接并写入列表。
- **会话切换**：切换时重新订阅对应 `session_id` 的事件流，主栏清空并回放（如后端支持历史）。
- **发送指令**：输入框支持多行，`Enter` 发送，`Shift+Enter` 换行；发送时主栏显示 `TEXT_MESSAGE_START` 占位。
- **流式更新**：文本、工具、状态事件按类型渲染；展示层允许做可逆 compaction 以降低冗余（不影响事件语义）。
- **断连提示**：SSE 断开时提示“连接中断，重试中…”，重连成功后恢复。

**事件到 UI 的映射**
- `TEXT_MESSAGE_*` → 文本气泡（流式拼接）
- `TOOL_CALL_*` → 可折叠“工具调用卡片”（入参/出参分区）
- `STATE_SNAPSHOT/DELTA` → 右栏状态树/JSON（只读）
- `ACTIVITY_*` → 右栏活动日志（时间序列）

**按钮/控件**
- 顶部：`New Session`、`Reconnect`、`Export`（P1）
- 输入区：`Send` + `Attach`（P2）

### 3.2 页面 B：会话详情（/sessions/[id]，P1）

**目标**：提供单会话稳定链接（可分享/可回放）。

**交互**
- 只读模式显示事件流与状态快照
- 支持过滤：仅文本 / 仅工具 / 仅状态

### 3.3 页面 C：设置（/settings，P2）

**目标**：集中配置 UI 与连接策略。

**交互**
- AG-UI Base URL 配置（仅本地开发）
- 事件日志级别（info/debug）
- 主题与布局密度

## 4. 交互状态机（自洽约束）

### 4.1 连接状态

- `idle`：未连接（进入页面未创建 session）
- `connecting`：发起 SSE 连接
- `streaming`：事件流正常
- `retrying`：指数退避重试
- `error`：连接失败（提示手动重连）

### 4.2 输入状态

- `ready`：可发送
- `sending`：发送中（锁定输入）
- `blocked`：等待 HITL（需用户确认）

### 4.3 恢复策略

- 断连 → `retrying`（指数退避 + 最大重试）
- 重试成功 → `streaming`
- 超过阈值 → `error`

## 5. 组件拆分（MVP）

- `SessionList`：左栏会话列表（只读渲染 + 选中状态）
- `ChatStream`：主栏消息流（文本/系统/错误）
- `EventTimeline`：工具/状态/活动事件（可折叠）
- `StateSnapshot`：右栏状态树（只读）
- `Composer`：输入框与发送按钮

## 6. 协议与数据流（AG-UI + CopilotKit）

### 6.1 AG-UI 协议定位

- **事件流为最小单位**：所有 UI 状态以事件流驱动。<sup>[[5]](#ref5)</sup>
- **传输无绑定**：协议支持 SSE/WebSockets/Webhooks；Server Quickstart 展示 Python 端以 `EventEncoder` 输出事件流。<sup>[[6]](#ref6)</sup><sup>[[7]](#ref7)</sup>
- **JS 客户端能力**：`@ag-ui/client` 提供 HttpAgent、订阅与中间件能力。<sup>[[6]](#ref6)</sup><sup>[[8]](#ref8)</sup>

### 6.2 CopilotKit 连接层策略

- **推荐 `useAgent`**：作为 AG-UI 级联接口，增强连接控制与状态管理。<sup>[[9]](#ref9)</sup>
- **最小集成路径**：通过 CopilotKit Provider 接入 Agent 状态与消息流（按官方快速开始流程）。<sup>[[9]](#ref9)</sup>

## 7. 前端架构（Next.js App Router）

### 7.1 组件与路由边界

- **默认 Server Components**：布局/页面默认服务端渲染，交互部分再标注 `"use client"`。<sup>[[2]](#ref2)</sup>
- **Route Handlers 作为 BFF**：在 [apps/negentropy-ui/app](../apps/negentropy-ui/app) 下新增 `/api/agui` 代理层（SSE/HTTP 转发）。<sup>[[3]](#ref3)</sup>
- **环境变量分层**：仅暴露 `NEXT_PUBLIC_` 前缀，其他仅服务端可读。<sup>[[4]](#ref4)</sup>

### 7.2 目录拆分原则（建议）

- **交互层**：页面与布局（`app/`）
- **特性层**：AG-UI/CopilotKit 适配（`features/`）
- **基础设施层**：环境变量/HTTP/SSE 工具（`lib/`）
- **领域类型**：跨层共享的类型（`types/`）

> 目录为建议性结构，按需求演进，避免一次性拆分。

## 8. 与后端 ADK 服务对接

### 8.1 对接原则

- **不侵入后端核心逻辑**：前端通过 AG-UI 与 ADK 服务通信。
- **复用现有运行入口**：使用 `uv run adk web --port 8000 src/negentropy`。参见 [docs/project-initialization.md](./project-initialization.md)。
- **后端可配置**：通过环境变量切换 Session/Memory/Artifact 后端（见 [apps/negentropy/src/negentropy/config/services.py](../apps/negentropy/src/negentropy/config/services.py)）。

### 8.2 BFF 代理层（Route Handlers）

- **目的**：解决 CORS/鉴权/统一路由问题。
- **实现**：在 [apps/negentropy-ui/app](../apps/negentropy-ui/app) 下新增 `/api/agui` Route Handler。
- **可选增强**：注入 `X-Session-ID`/`X-User-ID` 以触发后端 tracing（参见 [apps/negentropy/src/negentropy/engine/bootstrap.py](../apps/negentropy/src/negentropy/engine/bootstrap.py)）。

## 9. 落地计划（阶段化）

### P0. 骨架与连通性

- ✅ 已完成：建立 `/api/agui` 代理层（SSE/POST 转发）。实现见 [apps/negentropy-ui/app/api/agui/route.ts](../apps/negentropy-ui/app/api/agui/route.ts)。
- ✅ 已完成：BFF 将 ADK SSE 事件转换为 AG-UI 事件流（含 Run/Message/Tool/State/Activity）。实现见 [apps/negentropy-ui/app/api/agui/route.ts](../apps/negentropy-ui/app/api/agui/route.ts) 与 [apps/negentropy-ui/lib/adk.ts](../apps/negentropy-ui/lib/adk.ts)。<sup>[[5]](#ref5)</sup>
- ✅ 已完成：环境变量（`AGUI_BASE_URL` + `NEXT_PUBLIC_AGUI_APP_NAME` + `NEXT_PUBLIC_AGUI_USER_ID`）本地配置。<sup>[[4]](#ref4)</sup>
- ✅ 已完成：主界面最小 UI 骨架与事件展示。实现见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)。
  - **验证记录（feature/1.0.0）**：使用该分支提供的 `ZAI_API_KEY`/`ZAI_API_BASE`，`POST /api/agui` 返回 `glm-4.7` 的 SSE 分片输出，验证通过。

### P1. 事件驱动 UI

- ✅ 已完成：ADK Event → UI 适配（文本/状态增量）。实现见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)。
- ✅ 已完成：Tool/Artifact 事件结构化卡片展示（入参/出参/状态/Artifact 内容）。实现见 [apps/negentropy-ui/components/ui/EventTimeline.tsx](../apps/negentropy-ui/components/ui/EventTimeline.tsx)。<sup>[[5]](#ref5)</sup>
- ✅ 已完成：事件 compaction（降低冗余）。基于 `compactEvents` 进行合并展示。实现见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)。<sup>[[10]](#ref10)</sup>

### P2. CopilotKit 集成

- ✅ 已完成：引入 CopilotKit Provider + `useAgent` 实现统一 Agent 状态管理。实现见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)。<sup>[[9]](#ref9)</sup>
- ✅ 已完成：前端动作（确认/修正/补充信息）以工具调用形式上报，并在必要时追加用户反馈消息继续执行。实现见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)。

### P3. 可观测性与稳定性

- ✅ 已完成：UI 侧埋点（事件耗时、连接重试次数、错误次数）。实现见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)。
- `session_id`/`user_id` 贯穿前后端（参见 [apps/negentropy/src/negentropy/engine/bootstrap.py](../apps/negentropy/src/negentropy/engine/bootstrap.py)）。
- ✅ 已完成：最小回归测试（单元 + 集成）。覆盖 `lib/adk` 事件映射、核心 UI 组件（ChatStream/EventTimeline/StateSnapshot/Composer），并在 `tests/integration` mock `useAgent` 验证页面级交互流程；配置 `vitest`。实现见 [apps/negentropy-ui/tests](../apps/negentropy-ui/tests)、[apps/negentropy-ui/vitest.config.ts](../apps/negentropy-ui/vitest.config.ts)。
- ✅ 已完成：CI 回归（GitHub Actions）在 `apps/negentropy-ui` 变更时执行 `yarn test`。实现见 [.github/workflows/negentropy-ui-tests.yml](../.github/workflows/negentropy-ui-tests.yml)。

## 10. 风险与验证（Feedback Loop）

- **SSE 断连与重连**：验证断网/刷新后的会话恢复策略。
- **状态漂移**：UI 不做隐式写入，以 `STATE_*` 事件为唯一真值。<sup>[[5]](#ref5)</sup>
- **环境变量泄漏**：仅暴露 `NEXT_PUBLIC_` 前缀变量。<sup>[[4]](#ref4)</sup>

### 10.1 验证路径与操作指引（页面 + 流式交互）

> 目标：确保 UI → BFF → ADK → AG-UI 全链路可用，消息/工具/状态/Artifact 均可见。

**前置条件**

- 后端 ADK 已启动，`AGUI_BASE_URL` 可访问。
- 前端已启动：`http://localhost:3000`。
- `.env.local` 中 `NEXT_PUBLIC_AGUI_APP_NAME` 与 `NEXT_PUBLIC_AGUI_USER_ID` 已设置。

**页面可用性**

- 打开 `/`：三栏布局显示（Session 列表 / 对话区 / 状态+事件）。
- 点击 **New Session**：左栏新增会话，标题更新为新会话。

**流式交互（核心）**

1. 输入框发送普通指令（例如“请用一句话概括当前状态”）。
2. 期望结果：
   - 中栏出现用户消息与 Agent 回应（逐步更新）。
   - 右栏 Event Timeline 出现文本/工具/状态/Artifact 相关卡片。
   - 连接状态 `connecting → streaming → idle` 变化可见。

**Tool/Artifact 卡片**

- 若后端触发工具调用：右栏展示工具卡片（名称/入参/结果/状态）。
- 若后端产出 Artifact：右栏展示 Artifact 卡片（内容结构化）。

**HITL 验证（确认/修正/补充）**

- 触发需要确认的工具调用（后端产生 `requestedToolConfirmations`）。
- UI 显示确认卡片：点击“确认/修正/补充”任意按钮。
- 期望结果：
  - UI 上报并继续执行（连接状态再次切换）。
  - Timeline 记录 Tool 结果或状态变化。

**Session 回放**

- 切换左侧已有 Session：
  - 中栏加载历史消息。
  - 右栏加载历史事件卡片。
  - State Snapshot 呈现历史状态。

### 10.2 实际验证记录（dev server）

- **页面可用性**：`GET /` 返回完整 HTML（三栏布局可见）。
- **健康检查**：`GET /api/health` 返回 `{ status: "ok" }`。
- **Session 列表**：`GET /api/agui/sessions/list` 返回会话数组（backend 可达）。
- **流式交互（BFF → ADK → AG-UI）**：
  - 初始异常：`POST /api/agui` 返回 `RUN_STARTED` 后连续 `RUN_ERROR(ADK_EVENT_PARSE_ERROR)`。
  - 根因修复：`/api/agui` 的 SSE 行解析正则从 `data:\\s*` 修正为 `data:\s*`（详见 [apps/negentropy-ui/app/api/agui/route.ts](../apps/negentropy-ui/app/api/agui/route.ts)）。
  - 修复后复验：`POST /api/agui` 正常输出 `TEXT_MESSAGE_*`、`STATE_DELTA`、`ACTIVITY_SNAPSHOT` 等 AG‑UI 事件，流式交互通过。
  - 新增异常：UI 侧仅出现空 `ARTIFACT {}` 与 `STATE_DELTA []`，对话消息不展示；控制台出现 `threadId/runId` 缺失报错。
  - 修复策略：BFF 注入 `threadId/runId` 到所有 AG‑UI 事件；ADK 事件解析增强（兼容 `content.text` / `content.content` / `message.content`），并忽略空 `artifactDelta/stateDelta`。实现见 [apps/negentropy-ui/app/api/agui/route.ts](../apps/negentropy-ui/app/api/agui/route.ts)、[apps/negentropy-ui/lib/adk.ts](../apps/negentropy-ui/lib/adk.ts)。
  - 进一步异常：中栏/右栏消息与快照未随流式更新，Runtime Logs 频繁“跳动”。
  - 修复策略：移除对 `agent.messages/state` 的过度 memo，确保 `useAgent` 触发的更新可直接反映到 UI（见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)）。  
  - 流式拆分问题：assistant 片段被拆为多条消息。
  - 修复策略：中栏渲染改为基于 AG‑UI `TEXT_MESSAGE_*` 事件流聚合，按 `messageId` 汇聚为单条消息（见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)）。
  - **验证待补录**：需在 UI 侧完成真实交互验证，并记录日志缓冲输出与断连/重连表现（见下方模板）。

**UI 真实验证模板（待补录）**
- **时间**：
- **环境**：浏览器 / 版本 / 系统
- **路径**：New Session → 发送消息 → HITL 确认/修正/补充 → 会话切换/回放
- **结果**：
  - 消息是否显示：✅/❌
  - State Snapshot 是否更新：✅/❌
  - Artifact 卡片是否可读：✅/❌
  - 断连/重连行为：✅/❌（描述）
  - Runtime Logs 关键条目（复制粘贴）：

## 11. 未来扩展：知识库/知识图谱/用户记忆管理

> 当前不实现，仅在设计层预留统一入口、状态视图与操作路径，避免后期架构返工。

### 11.1 信息架构（新增导航）

- **一级导航**：`Knowledge`
- **二级导航**：`Knowledge Base` / `Knowledge Graph` / `User Memory` / `Pipelines`

### 11.2 页面与交互（MVP+）

**页面 D：Knowledge Dashboard（/knowledge）**
- 顶部：关键指标（覆盖率、实体数量、可用记忆槽、最近构建时间）
- 主栏：最近作业（Pipeline Runs）
- 右栏：告警与失败原因（最近 24h）

**页面 E：Knowledge Base（/knowledge/base）**
- 左栏：数据源列表（DB/Docs/Files/API）
- 主栏：数据源详情（元数据、连接状态、最近索引时间）
- 右栏：检索配置（chunk size、embedding、filters）
- 交互：新增数据源（连接 → 预检 → 保存）、触发构建、索引回滚（需确认）

**页面 F：Knowledge Graph（/knowledge/graph）**
- 主视图区：图谱可视化（缩放/拖拽）
- 右栏：实体详情（属性、来源、更新时间）
- 底部：构建作业与增量导入历史
- 交互：搜索实体、关系编辑（编辑模式）、增量构建

**页面 G：User Memory（/knowledge/memory）**
- 左栏：用户列表（支持检索）
- 主栏：记忆片段时间线（事件/摘要/来源）
- 右栏：记忆策略（保留/衰减/隐私）
- 交互：记忆审计（保留/删除/匿名化）、策略配置

**页面 H：Pipelines（/knowledge/pipelines）**
- 主栏：作业列表（状态/耗时/触发来源）
- 右栏：作业详情（输入/输出/日志/错误）
- 交互：重跑、失败定位

### 11.3 跨页面一致性

- 构建类操作必须显式确认。
- 状态以事件流为准，不做写后假设。
- 统一“左列表 + 中详情 + 右配置/状态”分栏布局。

### 11.4 线框图（布局规格）

**A. Knowledge Dashboard（/knowledge）**

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Top Metrics: Coverage | Entities | Memory Slots | Last Build           │
├───────────────────────────────────────────────────────────────────────┤
│ Pipeline Runs (table)                     │ Alerts / Failures         │
│ - Run ID | Status | Duration | Trigger    │ - Error summary            │
│ - ...                                    │ - Last failure stack        │
└───────────────────────────────────────────────────────────────────────┘
```

**B. Knowledge Base（/knowledge/base）**

```text
┌──────────────┬──────────────────────────────────┬───────────────────────┐
│ Sources      │ Source Detail                    │ Retrieval Config      │
│ - Docs       │ - Metadata                        │ - Chunk Size          │
│ - DB         │ - Last Index                       │ - Embedding Model     │
│ - Files      │ - Status                           │ - Filters             │
└──────────────┴──────────────────────────────────┴───────────────────────┘
```

**C. Knowledge Graph（/knowledge/graph）**

```text
┌───────────────────────────────────────────────────┬────────────────────┐
│ Graph Canvas (zoom/pan)                            │ Entity Detail      │
│ - nodes/edges                                      │ - attrs/source     │
├───────────────────────────────────────────────────┴────────────────────┤
│ Build Runs (timeline)                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

**D. User Memory（/knowledge/memory）**

```text
┌──────────────┬──────────────────────────────────┬───────────────────────┐
│ Users        │ Memory Timeline                   │ Policy & Controls     │
│ - user A     │ - event -> summary -> source       │ - retention           │
│ - user B     │ - ...                              │ - anonymization       │
└──────────────┴──────────────────────────────────┴───────────────────────┘
```

**E. Pipelines（/knowledge/pipelines）**

```text
┌──────────────────────────────────┬────────────────────────────────────┐
│ Pipeline Runs (list/table)       │ Run Detail                          │
│ - status/duration/trigger        │ - inputs/outputs/logs/errors        │
└──────────────────────────────────┴────────────────────────────────────┘
```

## 12. 可视化架构（Mermaid）

```mermaid
flowchart LR
    subgraph UI[Frontend: apps/negentropy-ui]
        Page[App Router Page]
        Client[Client Components]
        BFF[Route Handler /api/agui]
    end

    subgraph Protocol[AG-UI Protocol]
        Events[Event Stream
(TEXT/TOOL/STATE)]
    end

    subgraph Backend[Backend: apps/negentropy]
        ADK[ADK Web Service]
        Runner[Runner + Services]
    end

    Page --> Client
    Client --> BFF
    BFF -->|HTTP SSE| ADK
    ADK --> Events
    Events --> Client

    classDef ui fill:#FDE68A,stroke:#92400E,color:#000
    classDef protocol fill:#A7F3D0,stroke:#065F46,color:#000
    classDef backend fill:#BFDBFE,stroke:#1E3A8A,color:#000

    class Page,Client,BFF ui
    class Events protocol
    class ADK,Runner backend
```

## 13. 实现层级补充：接口契约草案 / API 代理路径 / UI 状态模型

> 仅提供“草案级”定义，保证最小可落地与可演进；所有字段以 AG-UI 事件流为主，不在前端重复定义后端真值。

### 13.0 当前实现状态（与工程同步）

- **BFF 代理**：已实现 `POST /api/agui`，完成 ADK → AG-UI 事件转换与 SSE 输出（见 [apps/negentropy-ui/app/api/agui/route.ts](../apps/negentropy-ui/app/api/agui/route.ts)、[apps/negentropy-ui/lib/adk.ts](../apps/negentropy-ui/lib/adk.ts)）。
- **健康检查**：已实现 `GET /api/health`（见 [apps/negentropy-ui/app/api/health/route.ts](../apps/negentropy-ui/app/api/health/route.ts)）。
- **Session 创建**：已实现 `POST /api/agui/sessions`（见 [apps/negentropy-ui/app/api/agui/sessions/route.ts](../apps/negentropy-ui/app/api/agui/sessions/route.ts)）。
- **Session 列表**：已实现 `GET /api/agui/sessions/list`（见 [apps/negentropy-ui/app/api/agui/sessions/list/route.ts](../apps/negentropy-ui/app/api/agui/sessions/list/route.ts)）。
- **Session 回放**：已实现 `GET /api/agui/sessions/:id` 并在 UI 端加载历史 events（见 [apps/negentropy-ui/app/api/agui/sessions/[sessionId]/route.ts](../apps/negentropy-ui/app/api/agui/sessions/[sessionId]/route.ts)）。
- **密钥映射**：已在启动阶段将 `NE_API_KEY` 映射到 `ZAI_API_KEY`（见 [apps/negentropy/src/negentropy/engine/bootstrap.py](../apps/negentropy/src/negentropy/engine/bootstrap.py)）。
- **UI 骨架**：已实现三栏布局、session 创建与 Agent 事件展示（见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)）。
- **CopilotKit 统一连接**：已接入 `CopilotKitProvider` + `useAgent` + `HttpAgent`，统一消息/状态/事件流（见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)）。
- **事件 compaction + 卡片化**：Tool/Artifact/State 事件进行合并并结构化展示（见 [apps/negentropy-ui/app/page.tsx](../apps/negentropy-ui/app/page.tsx)、[apps/negentropy-ui/components/ui/EventTimeline.tsx](../apps/negentropy-ui/components/ui/EventTimeline.tsx)）。
- **组件拆分**：已抽取 Header/SessionList/ChatStream/Composer/StateSnapshot/EventTimeline（见 [apps/negentropy-ui/components/ui/Header.tsx](../apps/negentropy-ui/components/ui/Header.tsx) 等）。

### 13.1 接口契约草案（AG-UI 事件流视角）

#### 13.1.1 发送输入并获取流式响应（SSE over POST）

- **路径**：`POST /api/agui`
- **目的**：通过 BFF 代理层调用后端 `POST /run_sse`，将 ADK SSE 转换为 AG-UI 事件流。
- **请求头**：
  - `X-Session-ID`: string（可选；用于 tracing/归档）
  - `X-User-ID`: string（可选；用于 tracing）
- **请求体（对齐 AG-UI RunAgentInput）**：

```json
{
  "threadId": "uuid",
  "runId": "uuid",
  "state": {},
  "messages": [
    { "id": "msg_1", "role": "user", "content": "user message" }
  ],
  "context": [],
  "tools": [],
  "forwardedProps": {}
}
```

- **查询参数**：
  - `app_name` / `user_id` / `session_id`（必填；由 UI 传入）
- **响应**：`200 OK` + `text/event-stream`

> 说明：UI 以 AG-UI RunAgentInput 为输入，BFF 内部映射为 ADK `RunAgentRequest` 后请求后端。

#### 13.1.2 Session 创建（HTTP）

- **路径**：`POST /api/agui/sessions`
- **目的**：创建 Session 并返回 `session_id`。
- **请求体（草案）**：

```json
{
  "app_name": "agents",
  "user_id": "ui",
  "session_id": "optional",
  "state": {}
}
```

#### 13.1.3 事件负载（前端侧最小解析）

```json
{
  "type": "ADK_EVENT",
  "timestamp": "iso-8601",
  "payload": {
    "id": "uuid",
    "author": "system",
    "content": {
      "role": "model",
      "parts": [{ "text": "Error: ..." }]
    },
    "actions": {
      "stateDelta": {}
    }
  },
  "meta": {
    "session_id": "uuid",
    "run_id": "uuid"
  }
}
```

> 说明：UI 仅解析 `type`、`payload`、`meta`；其余字段保持透传，以兼容协议演进。

### 13.2 API 代理路径（BFF 路由）

| 路径 | 方法 | 目的 | 备注 |
| ---- | ---- | ---- | ---- |
| `/api/agui` | `POST` | 发送用户输入并返回 SSE | 透传后端 `/run_sse` |
| `/api/agui/sessions` | `POST` | 创建 Session | 透传后端 session API |
| `/api/agui/sessions/list` | `GET` | 拉取 Session 列表 | 透传后端 session API |
| `/api/agui/sessions/:id` | `GET` | 获取 Session 详情（含 events） | 用于回放 |
| `/api/health` | `GET` | UI 运行自检 | 可选 |

> BFF 代理层仅做连接与头部注入，不做协议语义改写，避免“二次真值源”。

### 13.3 UI 状态模型（前端内部最小真值）

> UI 状态只服务于“展示与交互控制”，不替代后端业务状态。

#### 13.3.1 核心状态切片

```ts
type ConnectionState = "idle" | "connecting" | "streaming" | "retrying" | "error";
type InputState = "ready" | "sending" | "blocked";

type UiState = {
  sessionId: string | null;
  userId: string | null;
  connection: ConnectionState;
  input: InputState;
  messages: Array<{
    id: string;
    role: "user" | "agent" | "system";
    content: string;
    timestamp: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
    timestamp: string;
  }>;
  snapshot: Record<string, unknown> | null;
};
```

#### 13.3.2 状态更新规则

- **只读策略**：`snapshot` 仅由 `STATE_*` 事件驱动更新。
- **事件流优先**：`events` 以时间序列追加，UI 不做删除性变更（除非用户切换会话）。
- **消息派生**：`messages` 可由 `TEXT_MESSAGE_*` 聚合生成，但需保留事件原始序列。
- **连接状态**：由 SSE 连接生命周期驱动，不以“请求成功”作为唯一信号。

#### 13.3.3 错误与恢复

- **错误记录**：错误事件以 `events` 形式落地，避免隐式吞错。
- **恢复机制**：断连后进入 `retrying`，重连成功则回到 `streaming`；达到阈值转 `error` 并显式提示。

### 13.4 严格字段定义 / 错误码 / 重试策略（细则）

> 该部分为前端侧“严格约定”，用于减少歧义与回归风险；如后端已有官方契约，应以官方为准并回写本节。

#### 13.4.1 事件字段（最小严格集）

**Event Envelope**

```ts
type AguiEvent = {
  id: string;                // 事件唯一 ID（幂等）
  type: string;              // 事件类型（AG-UI 标准）
  timestamp: string;         // ISO-8601
  payload: {
    id?: string;
    author?: string;
    content?: {
      role?: string;
      parts?: Array<{ text?: string }>;
    };
    actions?: {
      stateDelta?: Record<string, unknown>;
      artifactDelta?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  meta: {
    session_id?: string;
    run_id?: string;
    user_id?: string;
    source?: "agent" | "tool" | "system";
    seq?: number;            // 可选：事件序号（用于排序/补偿）
  };
};
```

**Text 事件（最小解析）**

```ts
type TextMessageContent = {
  text: string;              // 必填：增量内容
  role?: "user" | "agent" | "system";
};
```

**Tool 事件（最小解析）**

```ts
type ToolCallPayload = {
  tool_name: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  status?: "start" | "progress" | "end" | "error";
};
```

**State 事件（最小解析）**

```ts
type StatePayload = {
  snapshot?: Record<string, unknown>; // STATE_SNAPSHOT
  delta?: Record<string, unknown>;    // STATE_DELTA
};
```

#### 13.4.2 请求字段（POST /api/agui）

```ts
type AguiRunRequest = {
  app_name: string;       // 必填
  user_id: string;        // 必填
  session_id: string;     // 必填
  new_message: {
    role: "user";
    parts: Array<{ text: string }>;
  };
  streaming: boolean;     // true
  state_delta?: Record<string, unknown> | null;
  invocation_id?: string | null;
  metadata?: {
    client_request_id?: string; // UUID，用于去重
  };
};
```

**校验规则**
- `session_id` 需为 UUID（前端生成或后端返回）。
- `new_message.parts[0].text` 不能为空，最大长度建议 `<= 8000` 字符。
- `app_name/user_id/session_id` 不允许为空。

#### 13.4.3 错误码（BFF 统一返回）

> 约定由 BFF 统一翻译后端错误，UI 只处理以下错误码与语义。

| 错误码 | HTTP | 含义 | UI 行为 |
| --- | --- | --- | --- |
| `AGUI_BAD_REQUEST` | 400 | 请求字段不合法 | 显示表单错误，不重试 |
| `AGUI_UNAUTHORIZED` | 401 | 鉴权失败 | 提示登录/权限不足 |
| `AGUI_FORBIDDEN` | 403 | 权限不足 | 提示无权限，不重试 |
| `AGUI_NOT_FOUND` | 404 | 目标资源不存在 | 提示资源不可用 |
| `AGUI_RATE_LIMITED` | 429 | 触发限流 | 延迟重试（指数退避） |
| `AGUI_UPSTREAM_TIMEOUT` | 504 | 上游超时 | 自动重试（限次数） |
| `AGUI_UPSTREAM_ERROR` | 502 | 上游错误 | 自动重试（限次数） |
| `AGUI_INTERNAL_ERROR` | 500 | BFF 内部错误 | 提示错误，可重试 |

**错误响应结构（草案）**

```json
{
  "error": {
    "code": "AGUI_UPSTREAM_ERROR",
    "message": "Upstream error",
    "trace_id": "uuid"
  }
}
```

#### 13.4.4 重试策略细则（SSE 与 POST）

**SSE 连接重试**
- 初始延迟：`500ms`
- 退避系数：`1.8`
- 最大延迟：`8s`
- 最大次数：`8`
- 抖动：`±20%`
- 达到上限 → 进入 `error` 并提示手动重连

**POST 发送重试（幂等前提）**
- 默认不重试（避免重复输入）。
- 仅在 `AGUI_UPSTREAM_TIMEOUT`/`AGUI_UPSTREAM_ERROR`/`AGUI_RATE_LIMITED` 时重试。
- 最大次数：`2`。
- 若有 `trace_id`，需透传并用于去重。

**幂等建议**
- 前端为每次输入生成 `client_request_id`（UUID），通过 `metadata` 透传。
- BFF 侧可基于 `client_request_id` 做去重（若后端支持）。
## 参考文献

<a id="ref1"></a>[1] Vercel, "App Router," _Next.js Documentation_, Jul. 30, 2025. [Online]. Available: https://nextjs.org/docs/app

<a id="ref2"></a>[2] Vercel, "Server and Client Components," _Next.js Documentation_, Jan. 26, 2026. [Online]. Available: https://nextjs.org/docs/app/getting-started/server-and-client-components

<a id="ref3"></a>[3] Vercel, "Route Handlers," _Next.js Documentation_, Nov. 18, 2025. [Online]. Available: https://nextjs.org/docs/app/getting-started/route-handlers

<a id="ref4"></a>[4] Vercel, "Environment Variables," _Next.js Documentation_, Oct. 8, 2025. [Online]. Available: https://nextjs.org/docs/app/guides/environment-variables

<a id="ref5"></a>[5] CopilotKit, "Events," _Agent User Interaction Protocol_, 2025. [Online]. Available: https://docs.ag-ui.com/concepts/events

<a id="ref6"></a>[6] CopilotKit, "Core Architecture," _Agent User Interaction Protocol_, 2025. [Online]. Available: https://docs.ag-ui.com/concepts/architecture

<a id="ref7"></a>[7] CopilotKit, "Server Quickstart," _Agent User Interaction Protocol_, 2025. [Online]. Available: https://docs.ag-ui.com/quickstart/server

<a id="ref8"></a>[8] CopilotKit, "Middleware / Stream Compaction," _Agent User Interaction Protocol (JS Client SDK)_, 2025. [Online]. Available: https://docs.ag-ui.com/sdk/js/client/middleware

<a id="ref9"></a>[9] CopilotKit, "CopilotKit README (Quick Start & useAgent)," _GitHub Repository_, 2025. [Online]. Available: https://github.com/CopilotKit/CopilotKit

<a id="ref10"></a>[10] CopilotKit, "Stream Compaction," _Agent User Interaction Protocol (JS Client SDK)_, 2025. [Online]. Available: https://docs.ag-ui.com/sdk/js/client/compaction
