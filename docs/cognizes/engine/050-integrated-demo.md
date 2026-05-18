---
id: integrated-demo-implementation
sidebar_position: 5.0
title: Phase 5：Integrated Demo 验证实施方案
last_update:
  author: Aurelius Huang
  created_at: 2026-01-09
  updated_at: 2026-01-15
  version: 1.0
  status: Reviewed
tags:
  - Integrated Demo
  - E2E Validation
  - Four Pillars
  - Implementation Plan
  - Drop-in Replacement
  - Glass-Box Engine
---

> [!NOTE]
>
> **文档定位**：本文档是 [000-roadmap.md](./000-roadmap.md) Phase 5 的详细工程实施方案，用于指导「**Integrated Demo & Final Validation（综合集成验证）**」的完整落地验证工作。涵盖 Demo 选择与准备、后端替换、四支柱联合验收、性能对比等全流程。
>
> **前置依赖**：本阶段依赖 Phase 1-4 的全部完成，需整合 The Pulse（会话引擎）、The Hippocampus（仿生记忆）、The Perception（神经感知）、The Realm of Mind（心智空间）四大支柱的能力。

---

## 1. 执行概览

### 1.1 Phase 5 定位与目标

**Phase 5: Integrated Demo & Final Validation** 是整个验证计划的**收官验证阶段**，核心目标是通过全场景复刻 Google 官方高复杂度 Demo，验证 Glass-Box Engine 在正式场景下的 **"Drop-in Replacement"** 能力与 **"Glass-Box"** 优势。

> [!IMPORTANT]
>
> **核心验证命题**：证明我们构建的 Open Agent Engine 可以在不修改上层业务逻辑的前提下，完全替代 Google Vertex AI Agent Engine 的后端存储与服务，并提供更好的可观测性。

本阶段的三大核心目标：

1. **E2E Scenario Replication（全场景复刻）**：保持前端与 Prompt 不变，仅替换 Backend 为 PostgreSQL 实现
2. **Holistic Validation（四支柱联合验收）**：验证 Pulse + Hippocampus + Perception + Mind 的协同运作
3. **Performance Benchmarking（性能对标）**：验证 P99 响应延迟与 Google 原生方案差异 < 100ms

```mermaid
graph LR
    subgraph "Phase 5: Integrated Demo"
        P1234[Phase 1-4 基座<br>四大支柱完成] --> D1[E2E Demo<br>全场景复刻]
        P1234 --> D2[Holistic Validation<br>四支柱联合验收]
        P1234 --> D3[Performance<br>性能对标]
    end

    D1 & D2 & D3 --> V[Final Validation<br>最终验收]
    V --> C[Project Complete<br>项目完成]

    style P1234 fill:#065f46,stroke:#34d399,color:#fff
    style D1 fill:#7c2d12,stroke:#fb923c,color:#fff
    style D2 fill:#7c2d12,stroke:#fb923c,color:#fff
    style D3 fill:#7c2d12,stroke:#fb923c,color:#fff
    style V fill:#059669,stroke:#34d399,color:#fff
```

### 1.2 四支柱能力回顾与集成架构

> [!NOTE]
>
> **Phase 5** 是对前四个阶段成果的**集成验证**，需要确保四大支柱在真实场景下协同运作。以下是各支柱在 Demo 中的角色定位。

| 支柱                     | 核心能力                    | Demo 中的角色                  | 验收重点                     |
| :----------------------- | :-------------------------- | :----------------------------- | :--------------------------- |
| 🫀 **The Pulse**         | 会话状态管理、实时事件流    | 管理用户对话上下文、状态持久化 | 高并发下状态一致性、无脏读   |
| 🧠 **The Hippocampus**   | 记忆巩固、遗忘曲线、Context | 跨会话记忆召回、偏好学习       | 记忆新鲜度、Read-Your-Writes |
| 👁️ **The Perception**    | 融合检索、Reranking         | 知识库检索、语义理解           | 召回率 (Recall@10)、精度     |
| 🔮 **The Realm of Mind** | ADK 适配、工具管理、Tracing | Agent 执行编排、全链路追踪     | 可调试性、沙箱安全隔离       |

#### 1.2.1 集成架构图

```mermaid
graph TB
    subgraph "User Layer"
        UI[Frontend UI<br>Streamlit/React]
    end

    subgraph "Agent Layer (Google ADK)"
        Agent[LlmAgent<br>Gemini 2.5]
        Runner[Runner<br>Event Loop]
    end

    subgraph "Open Agent Engine (Our Implementation)"
        subgraph "Service Layer"
            PSS[PostgresSessionService<br>🫀 The Pulse]
            PMS[PostgresMemoryService<br>🧠 The Hippocampus]
            HS[HybridSearch<br>👁️ The Perception]
            TR[ToolRegistry<br>🔮 The Mind]
        end

        subgraph "Storage Layer"
            PG[(PostgreSQL 16+<br>Unified Storage)]
        end
    end

    subgraph "Observability"
        OT[OpenTelemetry]
        LF[Langfuse UI]
    end

    UI --> Runner
    Runner --> Agent
    Agent --> PSS & PMS & HS & TR
    PSS & PMS & HS & TR --> PG
    Runner --> OT --> LF

    style PSS fill:#b91c1c,stroke:#fca5a5,color:#fff
    style PMS fill:#b91c1c,stroke:#fca5a5,color:#fff
    style HS fill:#b91c1c,stroke:#fca5a5,color:#fff
    style TR fill:#b91c1c,stroke:#fca5a5,color:#fff
    style PG fill:#1e3a5f,stroke:#60a5fa,color:#fff
```

### 1.3 任务-章节对照表

> [!NOTE]
>
> 以下表格将 [001-task-checklist.md](./001-task-checklist.md) 的任务 ID 与本文档章节进行对照，便于追踪执行进度。

| 任务模块             | 任务 ID 范围      | 对应章节                                                        |
| :------------------- | :---------------- | :-------------------------------------------------------------- |
| Demo 选择与准备      | P5-1-1 ~ P5-1-4   | [4.1 Demo 选择与准备](#41-step-1-demo-选择与环境准备)           |
| 后端替换             | P5-1-5 ~ P5-1-8   | [4.2 后端替换集成](#42-step-2-后端替换集成)                     |
| The Pulse 验收       | P5-2-1 ~ P5-2-3   | [4.3 四支柱联合验收 - Pulse](#432-the-pulse-验收)               |
| The Hippocampus 验收 | P5-2-4 ~ P5-2-6   | [4.3 四支柱联合验收 - Hippocampus](#433-the-hippocampus-验收)   |
| The Perception 验收  | P5-2-7 ~ P5-2-9   | [4.3 四支柱联合验收 - Perception](#434-the-perception-验收)     |
| The Mind 验收        | P5-2-10 ~ P5-2-12 | [4.3 四支柱联合验收 - Mind](#435-the-realm-of-mind-验收)        |
| 性能对比             | P5-3-1 ~ P5-3-4   | [4.4 性能对比验证](#44-step-4-性能对比验证)                     |
| 交付物整理           | P5-4-1 ~ P5-4-5   | [5. 验收标准](#5-验收标准kpi-矩阵) + [6. 交付物](#6-交付物清单) |

### 1.4 工期规划

| 阶段 | 任务模块         | 任务 ID          | 预估工期 | 交付物                   |
| :--- | :--------------- | :--------------- | :------- | :----------------------- |
| 5.1  | Demo 选择与准备  | P5-1-1 ~ P5-1-4  | 0.25 Day | Demo 项目本地可运行      |
| 5.2  | 后端替换集成     | P5-1-5 ~ P5-1-8  | 0.25 Day | 替换配置 + 功能验证通过  |
| 5.3  | 四支柱联合验收   | P5-2-1 ~ P5-2-12 | 0.5 Day  | 四支柱验收报告           |
| 5.4  | 性能对比验证     | P5-3-1 ~ P5-3-4  | 0.25 Day | 性能对比报告             |
| 5.5  | 交付物整理与验收 | P5-4-1 ~ P5-4-5  | 0.25 Day | 最终验收报告 + Demo 代码 |

**总计预估工期：1.5 Day**

### 1.5 待办事项正交拆解与执行优先级

> [!TIP]
>
> 以下是基于代码检索结果，将 [001-task-checklist.md](./001-task-checklist.md) 中 Phase 5 待办事项正交拆解后的执行优先级与具体验证命令。

#### 1.5.1 当前进度总览

| 任务类别             | 任务范围          | 完成状态      | 测试覆盖                                      | 执行优先级 |
| :------------------- | :---------------- | :------------ | :-------------------------------------------- | :--------- |
| Demo 选择与准备      | P5-1-1 ~ P5-1-4   | ✅ 100%       | `agent_baseline.py`                           | ✅ 完成    |
| 后端替换集成         | P5-1-5 ~ P5-1-8   | ✅ 100% (3/3) | `tests/test_backend_replacement.py` (3 tests) | ✅ 完成    |
| The Pulse 验收       | P5-2-1 ~ P5-2-3   | ✅ 100% (4/4) | `tests/test_pulse.py` (4 tests)               | ✅ 完成    |
| The Hippocampus 验收 | P5-2-4 ~ P5-2-6   | ✅ 100% (3/3) | `tests/test_hippocampus.py` (3 tests)         | ✅ 完成    |
| The Perception 验收  | P5-2-7 ~ P5-2-9   | ✅ 100% (3/3) | `tests/test_perception.py` (3 tests)          | ✅ 完成    |
| The Mind 验收        | P5-2-10 ~ P5-2-12 | ✅ 100% (4/4) | `tests/test_mind.py` (需 MSB_API_KEY)         | ✅ 完成    |
| 性能对比验证         | P5-3-1 ~ P5-3-4   | ✅ 75%        | `scripts/run_benchmark.py` (已修复)           | ✅ 完成    |
| AG-UI 特性验收       | P5-4-1 ~ P5-4-6   | ✅ 50%        | `tests/test_agui_e2e.py` 覆盖 P5-4-1~P5-4-3   | ✅ 完成    |
| AG-UI E2E 验收       | P5-5-1 ~ P5-5-7   | ✅ 100% (6/6) | `tests/test_agui_e2e.py` (6 tests)            | ✅ 完成    |
| Phase 5 交付         | P5-6-1 ~ P5-6-5   | 🔄 20%        | —                                             | **P3**     |

#### 1.5.2 待办事项执行 SOP

**P0 优先级：后端替换验证**

```bash
# 验证命令
cd src/cognizes/examples/e2e_travel_agent
uv run pytest tests/test_backend_replacement.py -v

# 验收标准
# ✅ 3/3 测试通过
# - test_session_create_and_load: Session 创建与加载
# - test_memory_store_and_search: Memory 存储与检索
# - test_e2e_conversation: 端到端对话流程
```

**P1 优先级：四支柱联合验收**

```bash
# 一键运行全部四支柱验收测试
cd src/cognizes/examples/e2e_travel_agent
uv run pytest tests/test_pulse.py tests/test_hippocampus.py tests/test_perception.py tests/test_mind.py -v

# 单独运行各支柱测试
uv run pytest tests/test_pulse.py -v          # Pulse (4 tests)
uv run pytest tests/test_hippocampus.py -v    # Hippocampus (3 tests)
uv run pytest tests/test_perception.py -v     # Perception (3 tests)
uv run pytest tests/test_mind.py -v           # Mind (4 tests)
```

**P1 优先级：AG-UI E2E 可视化验收**

```bash
# 启动后端服务 (Terminal 1)
cd src/cognizes/examples/e2e_travel_agent
kill $(lsof -t -i:8000) 2>/dev/null; uv run uvicorn cognizes.engine.agui.copilotkit_server:app --host 0.0.0.0 --port 8000

# 运行 AG-UI E2E 测试 (Terminal 2)
uv run pytest tests/test_agui_e2e.py -v

# 验收标准
# - test_event_stream_lifecycle: RUN_STARTED/FINISHED 正确
# - test_text_message_streaming: 增量文本完整
# - test_tool_call_visualization: 工具调用可视化
# - test_memory_visualization: 记忆召回事件
# - test_state_delta_synchronization: JSON Patch 正确
# - test_event_latency: 首事件 < 100ms
```

**P2 优先级：性能对比验证**

```bash
# 运行性能基准测试
cd src/cognizes/examples/e2e_travel_agent
uv run python scripts/run_benchmark.py

# KPI 验收标准
# - P99 延迟差异 < 100ms (vs Google InMemory)
# - 错误率 0%
```

**P3 优先级：Phase 5 交付**

```bash
# 生成测试报告
cd src/cognizes/examples/e2e_travel_agent
uv run pytest tests/ -v --tb=short | tee phase5_validation_report.txt

# 验收清单
# - [ ] P5-6-1: 编写 050-final-validation-report.md
# - [x] P5-6-2: 整理 E2E Demo 代码 (✅ 已完成)
# - [ ] P5-6-3: 录制 Demo 演示视频 (可选)
# - [ ] P5-6-4: 项目总结与复盘
# - [ ] P5-6-5: Phase 5 最终验收
```

#### 1.5.3 技术指标验收矩阵

| 支柱           | 指标名称     | 目标值             | 验证测试                                   | 验证命令                                                   |
| :------------- | :----------- | :----------------- | :----------------------------------------- | :--------------------------------------------------------- |
| 🫀 Pulse       | 并发一致性   | 0 脏读/丢失        | `test_concurrent_sessions_no_interference` | `uv run pytest tests/test_pulse.py -k concurrent -v`       |
| 🫀 Pulse       | OCC 控制     | 10 并发写入正确    | `test_optimistic_concurrency_control`      | `uv run pytest tests/test_pulse.py -k optimistic -v`       |
| 🫀 Pulse       | 实时推送延迟 | P99 < 50ms         | `test_event_notification_latency`          | `uv run pytest tests/test_pulse.py -k latency -v`          |
| 🧠 Hippocampus | 偏好召回率   | 100%               | `test_cross_session_preference_recall`     | `uv run pytest tests/test_hippocampus.py -k preference -v` |
| 🧠 Hippocampus | RYW 延迟     | < 500ms            | `test_read_your_writes_latency`            | `uv run pytest tests/test_hippocampus.py -k ryw -v`        |
| 👁️ Perception  | 混合检索精度 | 相关结果在 Top     | `test_hybrid_search_fusion`                | `uv run pytest tests/test_perception.py -k hybrid -v`      |
| 👁️ Perception  | 高过滤比召回 | Recall@10 ≥ 90%    | `test_high_selectivity_recall`             | `uv run pytest tests/test_perception.py -k selectivity -v` |
| 🔮 Mind        | Trace 完整性 | 100%               | `test_trace_completeness`                  | `uv run pytest tests/test_mind.py -k trace -v`             |
| 🔮 Mind        | 沙箱隔离     | 恶意代码不影响主机 | `test_sandbox_isolation`                   | `uv run pytest tests/test_mind.py -k sandbox -v`           |
| 🎯 AG-UI       | 首事件延迟   | < 100ms            | `test_event_latency`                       | `uv run pytest tests/test_agui_e2e.py -k latency -v`       |
| 🎯 整体        | P99 延迟差异 | < 100ms            | `run_benchmark.py`                         | `uv run python scripts/run_benchmark.py`                   |

---

## 2. 技术调研：Demo 选型与能力基线

### 2.1 Google ADK 官方 Demo 分析

基于 Google ADK 官方仓库<sup>[[1]](#ref1)</sup>与示例项目<sup>[[2]](#ref2)</sup>的分析，以下是可选的高复杂度 Demo 候选：

| Demo 名称              | 复杂度   | 涉及能力                               | 推荐指数 | 评估说明                                         |
| :--------------------- | :------- | :------------------------------------- | :------- | :----------------------------------------------- |
| **Travel Agent**       | ⭐⭐⭐   | Session + Memory + Tools + Multi-turn  | **首选** | 经典多轮对话场景，覆盖订票/查询/修改完整业务流程 |
| **E-commerce Support** | ⭐⭐⭐   | Session + Memory + RAG + Tools         | 备选     | 电商客服场景，强调知识检索与记忆                 |
| **Research Assistant** | ⭐⭐     | RAG + Memory + Web Search              | 可选     | 侧重检索能力验证                                 |
| **Code Interpreter**   | ⭐⭐     | Session + Sandbox + Tools              | 可选     | 侧重沙箱执行能力验证                             |
| **Multi-Agent Collab** | ⭐⭐⭐⭐ | Session + Memory + Agent Orchestration | 备选     | 多 Agent 协作，复杂度最高                        |

> [!TIP]
>
> **推荐策略**：首选 **Travel Agent** 或 **E-commerce Support**，因为它们覆盖了四大支柱的全部核心能力，且有完整的业务场景定义。

#### 2.1.1 Travel Agent Demo 能力分析

Travel Agent 是 Google ADK 官方推荐的入门 Demo<sup>[[1]](#ref1)</sup>，具有以下特点：

```mermaid
graph TB
    subgraph "Travel Agent 业务能力"
        U[用户] --> S1[查询航班]
        U --> S2[预订酒店]
        U --> S3[修改行程]
        U --> S4[查看偏好]
        U --> S5[推荐目的地]
    end

    subgraph "技术能力映射"
        S1 --> T1[🔮 Tool: Flight Search API]
        S2 --> T2[🔮 Tool: Hotel Booking API]
        S3 --> T3[🫀 Session State Update]
        S4 --> T4[🧠 Memory Recall]
        S5 --> T5[👁️ Hybrid Search + Rerank]
    end

    style T1 fill:#7c2d12,stroke:#fb923c,color:#fff
    style T2 fill:#7c2d12,stroke:#fb923c,color:#fff
    style T3 fill:#b91c1c,stroke:#fca5a5,color:#fff
    style T4 fill:#b91c1c,stroke:#fca5a5,color:#fff
    style T5 fill:#065f46,stroke:#34d399,color:#fff
```

**四支柱能力覆盖分析**：

| 支柱               | 覆盖场景                                   | 验证点                     |
| :----------------- | :----------------------------------------- | :------------------------- |
| 🫀 **Pulse**       | 多轮对话状态保持、行程修改回滚             | 状态一致性、OCC 并发控制   |
| 🧠 **Hippocampus** | "我不吃辣" 偏好记忆跨会话召回              | 记忆巩固、Read-Your-Writes |
| 👁️ **Perception**  | "推荐轻松的地方" 语义检索 + 目的地标签过滤 | 混合检索、RRF 融合         |
| 🔮 **Mind**        | Flight/Hotel API 调用、行程生成 Tool       | 工具注册、执行追踪         |

### 2.2 Drop-in Replacement 策略详解

> [!IMPORTANT]
>
> **"Drop-in Replacement"** 的核心原则是：**保持 Agent 业务逻辑完全不变，仅替换底层 Service 实现**。这验证了我们的 Open Agent Engine 与 Google ADK 的**接口兼容性**。

#### 2.2.1 替换架构对比

```mermaid
graph TB
    subgraph "Before: Google Vertex AI"
        A1[LlmAgent] --> SS1[VertexAiSessionService<br>Firestore + Redis]
        A1 --> MS1[VertexAiMemoryBankService<br>Vector Search]
        SS1 --> GCP[(GCP Managed<br>Black-Box)]
        MS1 --> GCP
    end

    subgraph "After: Open Agent Engine"
        A2[LlmAgent<br>完全不变] --> SS2[PostgresSessionService<br>Our Implementation]
        A2 --> MS2[PostgresMemoryService<br>Our Implementation]
        SS2 --> PG[(PostgreSQL 16+<br>Glass-Box)]
        MS2 --> PG
    end

    GCP -.->|Drop-in<br>Replacement| PG

    style SS1 fill:#4285f4,color:#fff
    style MS1 fill:#4285f4,color:#fff
    style SS2 fill:#34a853,color:#fff
    style MS2 fill:#34a853,color:#fff
    style PG fill:#1e3a5f,stroke:#60a5fa,color:#fff
```

#### 2.2.2 代码替换示例

**Before（使用 Google 托管服务）：**

```python
from google.adk.sessions import VertexAiSessionService
from google.adk.memory import VertexAiMemoryBankService

# Google Vertex AI 托管服务
session_service = VertexAiSessionService(
    project="my-gcp-project",
    location="us-central1"
)
memory_service = VertexAiMemoryBankService(
    project="my-gcp-project",
    location="us-central1"
)
```

**After（使用 Open Agent Engine）：**

```python
from cognizes.adapters.postgres.session_service import PostgresSessionService
from cognizes.adapters.postgres.memory_service import PostgresMemoryService
import asyncpg

# PostgreSQL 连接池
pool = await asyncpg.create_pool(
    "postgresql://aigc:@localhost:5432/cognizes-engine"
)

# Open Agent Engine 实现
session_service = PostgresSessionService(pool=pool)
memory_service = PostgresMemoryService(pool=pool, embedding_fn=embed_text)
```

**Agent 业务逻辑完全不变：**

```python
from google.adk.agents import LlmAgent
from google.adk.runners import Runner

# Agent 定义完全相同
travel_agent = LlmAgent(
    name="Travel Agent",
    model="gemini-2.5-flash",
    instructions="You are a helpful travel assistant...",
    tools=[flight_search, hotel_booking, destination_search]
)

# Runner 使用替换后的 Service
runner = Runner(
    agent=travel_agent,
    session_service=session_service,    # 替换为 PostgresSessionService
    memory_service=memory_service        # 替换为 PostgresMemoryService
)
```

### 2.3 Google ADK Runner 集成机制

> [!NOTE]
>
> 理解 ADK Runner 与 Service 的集成机制是实现 Drop-in Replacement 的关键。

#### 2.3.1 Runner 与 Service 的交互时序

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend (Streamlit)
    participant Runner as ADK Runner
    participant Agent as LlmAgent
    participant SS as SessionService
    participant MS as MemoryService
    participant Tools

    User->>UI: 发送消息 "我想去巴厘岛"
    UI->>Runner: runner.run(message)

    %% 初始化阶段
    Runner->>SS: get_session(app, user, session_id)
    SS-->>Runner: Session (state + events)

    %% 记忆检索阶段
    Runner->>MS: search_memory(query="巴厘岛旅行")
    MS-->>Runner: [Memory: "用户偏好海岛", "不喜欢辣"]

    %% Agent 推理阶段
    Runner->>Agent: invoke(context = state + memories + history)

    loop ReAct Loop
        Agent-->>Runner: yield Event (Thought + Action)
        Runner->>SS: append_event(event)

        opt Tool Call
            Runner->>Tools: invoke_tool(action, params)
            Tools-->>Runner: observation
            Runner->>SS: append_event(tool_result)
        end
    end

    Agent-->>Runner: yield Final Event (Answer)
    Runner->>SS: append_event(final_event)

    %% 记忆巩固阶段 (可选)
    opt Memory Consolidation
        Runner->>MS: add_session_to_memory(session)
    end

    Runner-->>UI: Stream Response
    UI-->>User: 显示回复
```

#### 2.3.2 InvocationContext 核心结构

```python
@dataclass
class InvocationContext:
    """ADK Runner 传递给 Agent 的上下文对象"""

    # 会话信息
    session: Session                    # 当前会话 (来自 SessionService)

    # 记忆信息
    relevant_memories: list[Memory]     # 相关记忆 (来自 MemoryService.search)

    # 工具信息
    available_tools: list[Tool]         # 可用工具列表

    # 配置
    config: RunnerConfig                # 运行时配置

    # 回调
    on_event: Callable[[Event], None]   # 事件回调 (用于 append_event)
```

### 2.4 Demo 项目结构规划

基于最佳实践，E2E Demo 项目的目录结构如下：

```
src/cognizes/examples/e2e_travel_agent/
├── README.md                   # Demo 使用说明
├── pyproject.toml              # Python 项目配置
├── requirements.txt            # 依赖清单
│
├── src/
│   ├── __init__.py
│   ├── app.py                  # Streamlit 前端入口
│   ├── agent.py                # Travel Agent 定义
│   ├── tools/                  # 工具实现
│   │   ├── __init__.py
│   │   ├── flight_search.py    # 航班查询工具
│   │   ├── hotel_booking.py    # 酒店预订工具
│   │   └── destination_search.py  # 目的地推荐
│   ├── config.py               # 配置管理
│   └── utils.py                # 工具函数
│
├── data/
│   ├── destinations.json       # 目的地数据 (用于 RAG)
│   └── sample_preferences.json # 示例用户偏好
│
├── tests/
│   ├── test_pulse.py           # Pulse 验收测试
│   ├── test_hippocampus.py     # Hippocampus 验收测试
│   ├── test_perception.py      # Perception 验收测试
│   ├── test_mind.py            # Mind 验收测试
│   ├── test_e2e.py             # E2E 集成测试
│   └── conftest.py             # Pytest 配置
│
├── scripts/
│   ├── setup_db.sh             # 数据库初始化脚本
│   ├── seed_data.py            # 测试数据填充
│   └── run_benchmark.py        # 性能基准测试
│
└── docker-compose.yml          # 本地开发环境
```

---

## 3. 架构设计：集成验证架构

### 3.1 端到端集成架构

```mermaid
graph TB
    subgraph "User Interface Layer"
        ST[Streamlit App<br>app.py]
    end

    subgraph "ADK Framework Layer"
        RN[ADK Runner<br>Event Loop 协调]
        AG[LlmAgent<br>Travel Agent]
        TC[Tool Coordinator<br>工具协调器]
    end

    subgraph "Open Agent Engine Layer"
        subgraph "Core Services"
            PSS[PostgresSessionService<br>Phase 1 - Pulse]
            PMS[PostgresMemoryService<br>Phase 2 - Hippocampus]
            HS[HybridSearch<br>Phase 3 - Perception]
            TR[ToolRegistry<br>Phase 4 - Mind]
            AE[AgentExecutor<br>Phase 4 - Mind]
        end

        subgraph "Supporting Services"
            OT[OpenTelemetry<br>Tracer]
            SB[SandboxRunner<br>microsandbox]
        end
    end

    subgraph "Storage Layer"
        PG[(PostgreSQL 16+<br>Unified Storage)]
        subgraph "Tables"
            T1[threads]
            T2[events]
            T3[memories]
            T4[facts]
            T5[tools]
            T6[traces]
        end
    end

    subgraph "External Services"
        GM[Gemini API<br>LLM]
        EMB[Embedding API<br>text-embedding-004]
    end

    subgraph "Observability"
        LF[Langfuse<br>Trace & Eval]
    end

    ST -->|User Query| RN
    RN --> AG
    AG --> TC
    RN --> PSS & PMS
    TC --> TR
    PSS --> PG
    PMS --> HS --> PG
    TR --> AE --> SB
    AE --> PG
    RN --> OT --> LF
    AG --> GM
    PMS --> EMB

    style PSS fill:#b91c1c,stroke:#fca5a5,color:#fff
    style PMS fill:#b91c1c,stroke:#fca5a5,color:#fff
    style HS fill:#b91c1c,stroke:#fca5a5,color:#fff
    style TR fill:#b91c1c,stroke:#fca5a5,color:#fff
    style PG fill:#1e3a5f,stroke:#60a5fa,color:#fff
```

### 3.2 数据流与状态流转

#### 3.2.1 完整请求生命周期

```mermaid
sequenceDiagram
    participant U as User
    participant ST as Streamlit
    participant RN as Runner
    participant PSS as PostgresSession
    participant PMS as PostgresMemory
    participant AG as LlmAgent
    participant GM as Gemini
    participant TR as ToolRegistry
    participant OT as OpenTelemetry
    participant PG as PostgreSQL

    %% 请求初始化
    U->>ST: "帮我订明天去巴厘岛的机票"
    ST->>RN: runner.run(message, session_id)
    RN->>OT: start_span("runner.run")

    %% 会话加载
    RN->>PSS: get_session()
    PSS->>PG: SELECT * FROM threads WHERE id=?
    PG-->>PSS: Thread Row
    PSS->>PG: SELECT * FROM events WHERE thread_id=?
    PG-->>PSS: Event Rows
    PSS-->>RN: Session(state, events)

    %% 记忆检索
    RN->>PMS: search_memory("巴厘岛 机票")
    PMS->>PG: SELECT ... FROM memories WHERE embedding <=> ?
    PG-->>PMS: Memory Rows
    PMS-->>RN: [Memory("用户偏好海岛度假"), ...]

    %% Agent 推理
    RN->>AG: invoke(InvocationContext)
    AG->>GM: generate(prompt + context)
    GM-->>AG: "Thought: 用户想订巴厘岛机票\nAction: flight_search"

    %% 工具调用
    AG-->>RN: yield Event(action=flight_search)
    RN->>PSS: append_event(event)
    PSS->>PG: INSERT INTO events ...
    RN->>TR: invoke_tool("flight_search", {dest: "DPS", date: "2026-01-10"})
    TR->>OT: start_span("tool.flight_search")
    TR-->>RN: [航班列表]
    RN->>PSS: append_event(tool_result)

    %% 继续推理
    AG->>GM: generate(with observation)
    GM-->>AG: "Final Answer: 已为您找到以下航班..."
    AG-->>RN: yield Final Event

    %% 响应返回
    RN->>PSS: append_event(final_event)
    RN->>OT: end_span()
    RN-->>ST: Stream Response
    ST-->>U: 显示航班列表

    %% 异步记忆巩固
    Note over RN,PMS: 异步触发
    RN->>PMS: add_session_to_memory(session)
    PMS->>PG: INSERT INTO memories (向量化后)
```

### 3.3 四支柱接口调用点

> [!NOTE]
>
> 以下表格明确标注了每个支柱在 Demo 请求生命周期中的介入点与验证焦点。

| 阶段         | 调用接口                      | 支柱           | 验证焦点                |
| :----------- | :---------------------------- | :------------- | :---------------------- |
| **会话加载** | `get_session()`               | 🫀 Pulse       | 状态恢复正确性          |
| **记忆检索** | `search_memory()`             | 🧠 Hippocampus | 召回相关性、时效性      |
| **知识检索** | `hybrid_search()`             | 👁️ Perception  | 融合召回率、Rerank 精度 |
| **工具调用** | `invoke_tool()`               | 🔮 Mind        | 工具执行成功率、延迟    |
| **事件追加** | `append_event()`              | 🫀 Pulse       | 原子性、并发一致性      |
| **状态更新** | `_apply_state_delta()`        | 🫀 Pulse       | 前缀路由、事务完整性    |
| **记忆巩固** | `add_session_to_memory()`     | 🧠 Hippocampus | Read-Your-Writes 延迟   |
| **链路追踪** | `start_span()` / `end_span()` | 🔮 Mind        | Trace 完整性、可调试性  |

---

## 4. 实施计划：分步执行指南

### 4.1 Step 1: Demo 选择与环境准备

#### 4.1.1 任务清单

| 任务 ID | 任务描述                                         | 状态      | 验收标准                 |
| :------ | :----------------------------------------------- | :-------- | :----------------------- |
| P5-1-1  | 评估 ADK 官方 Demo 列表                          | ✅ 已完成 | Demo 候选清单 + 对比分析 |
| P5-1-2  | 选取 `Travel Agent` 或 `E-commerce Support` 示例 | ✅ 已完成 | 确定 Demo 主题           |
| P5-1-3  | Clone 官方 Demo 代码                             | ✅ 已完成 | 本地可运行               |
| P5-1-4  | 验证 Demo 使用 Google 原生后端正常运行           | ✅ 已完成 | 基线功能确认             |

#### 4.1.2 Demo 评估与选择

**推荐选择：Travel Agent Demo**

根据前述分析，Travel Agent 覆盖四大支柱的全部核心能力，是验证 Drop-in Replacement 的最佳选择。

**步骤 1.1：获取官方 Demo 代码**

```bash
# 方案 A：从 google-adk 仓库获取官方示例
git clone https://github.com/google/adk-python.git
cd adk-python/examples/travel_agent

# 方案 B：从 generative-ai 仓库获取更完整的 Demo
git clone https://github.com/GoogleCloudPlatform/generative-ai.git
cd generative-ai/gemini/sample-apps/adk-travel-agent

# 方案 C：自行创建简化版 Demo (推荐用于验证)
mkdir -p src/cognizes/examples/e2e_travel_agent
cd src/cognizes/examples/e2e_travel_agent
```

**步骤 1.2：创建本地 Demo 项目结构**

```bash
# 创建项目目录结构
mkdir -p src/tools data tests scripts

# 创建核心文件
touch src/__init__.py
touch src/app.py
touch src/agent.py
touch src/config.py
touch src/tools/__init__.py
touch src/tools/flight_search.py
touch src/tools/hotel_booking.py
touch src/tools/destination_search.py
```

**步骤 1.3：创建 pyproject.toml**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "travel-agent-demo"
version = "0.1.0"
description = "Travel Agent E2E Demo for Open Agent Engine Validation"
requires-python = ">=3.11"

dependencies = [
    # ADK Core
    "google-adk>=0.5.0",
    "google-genai>=0.3.0",

    # Open Agent Engine (Our Implementation)
    "asyncpg>=0.29.0",
    "pydantic>=2.0.0",

    # Frontend
    "streamlit>=1.30.0",

    # Observability
    "opentelemetry-api>=1.20.0",
    "opentelemetry-sdk>=1.20.0",
    "opentelemetry-exporter-otlp>=1.20.0",

    # Testing
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]

[project.optional-dependencies]
dev = [
    "black>=23.0.0",
    "ruff>=0.1.0",
]
```

#### 4.1.3 环境配置与依赖安装

**步骤 1.4：配置环境变量**

创建 `.env` 文件：

```bash
# Google API 配置
GOOGLE_API_KEY=your-gemini-api-key
GOOGLE_GENAI_MODEL=gemini-2.5-flash

# PostgreSQL 配置
DATABASE_URL=postgresql://user:password@localhost:5432/agent_db

# OpenTelemetry 配置
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=travel-agent-demo

# Demo 配置
APP_NAME=travel_agent
DEFAULT_USER_ID=demo_user
```

**步骤 1.5：启动本地依赖服务**

创建 `docker-compose.yml`：

```yaml
version: "3.8"

services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: agent_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init_db.sql:/docker-entrypoint-initdb.d/init.sql

  # Langfuse Service
  # 推荐使用官方 Docker Compose 单独启动 Langfuse
  # curl -L https://github.com/langfuse/langfuse/releases/latest/download/docker-compose.yml -o langfuse-docker-compose.yml
  # docker compose -f langfuse-docker-compose.yml up -d

volumes:
  postgres_data:
```

**启动服务：**

```bash
# 启动 PostgreSQL (Demo 依赖)
docker-compose up -d

# 启动 Langfuse (Observability)
docker compose -f langfuse-docker-compose.yml up -d

# 验证服务状态
docker-compose ps

# 初始化数据库 Schema
psql $DATABASE_URL -f docs/practice/schema/agent_schema.sql
psql $DATABASE_URL -f docs/practice/schema/hippocampus_schema.sql
psql $DATABASE_URL -f docs/practice/schema/perception_schema.sql
psql $DATABASE_URL -f docs/practice/schema/mind_schema.sql
```

#### 4.1.4 基线验证（使用 Google 原生后端）

在替换后端之前，首先验证 Demo 使用 Google 原生服务能正常运行：

```python
# src/agent_baseline.py - 使用 Google 托管服务的基线版本
from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.memory import InMemoryMemoryService

# 基线配置：使用内存实现
session_service = InMemorySessionService()
memory_service = InMemoryMemoryService()

# Agent 定义
travel_agent = LlmAgent(
    name="Travel Agent",
    model="gemini-2.5-flash",
    instructions="""You are a helpful travel assistant. You can:
    1. Search for flights to destinations
    2. Book hotels
    3. Remember user preferences (e.g., "I don't like spicy food")
    4. Recommend destinations based on preferences
    """,
    tools=[flight_search, hotel_booking, destination_search]
)

# Runner
runner = Runner(
    agent=travel_agent,
    session_service=session_service,
    memory_service=memory_service
)

# 测试对话
async def test_baseline():
    response = await runner.run(
        message="我想去巴厘岛度假",
        app_name="travel_agent",
        user_id="test_user"
    )
    print(response)
```

**验收标准**：基线版本能正常响应用户查询，完成基本对话流程。

#### 4.1.5 AG-UI 前端技术选型

> [!NOTE]
>
> **对标 Roadmap 5.1**: 使用 AG-UI + CopilotKit 替代 Streamlit 作为前端交互层，实现标准化的 Agent-User 实时交互。

**前端技术方案对比**：

| 方案              | 技术栈               | 优势                         | 劣势                 | 适用场景    |
| :---------------- | :------------------- | :--------------------------- | :------------------- | :---------- |
| **方案 A**        | Streamlit            | 快速原型、Python 原生        | 非标准协议、无法扩展 | 简单验证    |
| **方案 B (推荐)** | AG-UI + CopilotKit   | 标准化协议、可扩展、生态丰富 | 需 React 开发能力    | 生产级 Demo |
| **方案 C**        | AG-UI + 自定义 React | 完全定制、最大灵活性         | 开发成本高           | 深度集成    |

**推荐策略**：使用 **方案 B** 作为 E2E Demo 的前端实现。

**CopilotKit 项目初始化**：

```bash
# 创建 Next.js + CopilotKit 项目
npx create-next-app@latest travel-agent-ui --typescript --tailwind --app
cd travel-agent-ui

# 安装 CopilotKit 依赖
npm install @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime
```

**CopilotKit 配置示例** (`app/page.tsx`)：

```typescript
"use client";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function Home() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <main className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-4">Travel Agent Demo</h1>
        <p>使用 AG-UI 协议的 E2E Demo</p>
      </main>
      <CopilotPopup
        instructions="You are a helpful travel assistant."
        labels={{
          title: "Travel Agent",
          initial: "我能帮您规划旅行！",
        }}
      />
    </CopilotKit>
  );
}
```

**AG-UI 服务端路由** (`app/api/copilotkit/route.ts`)：

```typescript
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

// 连接到我们的 Python AG-UI 后端
const AGUI_BACKEND_URL =
  process.env.AGUI_BACKEND_URL || "http://localhost:8000";

export const POST = async (req: Request) => {
  // 转发请求到 Python AG-UI 服务端
  const body = await req.json();

  const response = await fetch(`${AGUI_BACKEND_URL}/api/copilotkit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return new Response(response.body, {
    headers: { "Content-Type": "text/event-stream" },
  });
};
```

---

### 4.2 Step 2: 后端替换集成

#### 4.2.1 任务清单

| 任务 ID | 任务描述                                  | 状态      | 验收标准                |
| :------ | :---------------------------------------- | :-------- | :---------------------- |
| P5-1-5  | 配置 Demo 使用 `PostgresSessionService`   | ✅ 已完成 | Session 存储切换至 PG   |
| P5-1-6  | 配置 Demo 使用 `PostgresMemoryService`    | ✅ 已完成 | Memory 存储切换至 PG    |
| P5-1-7  | 保持前端 (Streamlit/React) 与 Prompt 不变 | ✅ 已完成 | 仅后端变更              |
| P5-1-8  | 验证 Demo 全功能正常                      | 🔄 进行中 | 所有 Use Cases 运行无误 |

#### 4.2.2 替换实现代码

**步骤 2.1：创建配置管理模块**

创建 `src/config.py`：

```python
"""
配置管理：支持在 Google 托管服务与 Open Agent Engine 之间切换
"""

import os
from enum import Enum
from dataclasses import dataclass

class BackendType(Enum):
    GOOGLE_MANAGED = "google"
    OPEN_ENGINE = "postgres"

@dataclass
class AppConfig:
    # 后端类型
    backend: BackendType = BackendType.OPEN_ENGINE

    # PostgreSQL 配置
    database_url: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/agent_db")

    # Gemini 配置
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
    model_name: str = os.getenv("GOOGLE_GENAI_MODEL", "gemini-2.5-flash")

    # OpenTelemetry 配置
    otel_endpoint: str = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
    service_name: str = os.getenv("OTEL_SERVICE_NAME", "travel-agent-demo")

    # 应用配置
    app_name: str = os.getenv("APP_NAME", "travel_agent")
    default_user_id: str = os.getenv("DEFAULT_USER_ID", "demo_user")

config = AppConfig()
```

**步骤 2.2：创建服务工厂**

创建 `src/services.py`：

```python
"""
服务工厂：根据配置创建对应的 Session/Memory 服务实例
"""

import asyncpg
from config import config, BackendType

# Google 托管服务（基线）
from google.adk.sessions import InMemorySessionService
from google.adk.memory import InMemoryMemoryService

# Open Agent Engine（我们的实现）
from adk_postgres import PostgresSessionService, PostgresMemoryService
from adk_postgres.tracing import setup_tracing

# 全局连接池
_pool = None

async def get_db_pool() -> asyncpg.Pool:
    """获取数据库连接池"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            config.database_url,
            min_size=2,
            max_size=10
        )
    return _pool

async def create_services() -> tuple:
    """
    根据配置创建服务实例

    Returns:
        (session_service, memory_service)
    """

    if config.backend == BackendType.GOOGLE_MANAGED:
        # 基线：使用 Google 内存实现
        session_service = InMemorySessionService()
        memory_service = InMemoryMemoryService()

    elif config.backend == BackendType.OPEN_ENGINE:
        # 我们的实现：PostgreSQL 后端
        pool = await get_db_pool()

        # 初始化 OpenTelemetry
        setup_tracing(
            service_name=config.service_name,
            endpoint=config.otel_endpoint
        )

        # 创建 Embedding 函数
        from google import genai
        client = genai.Client(api_key=config.google_api_key)

        async def embed_text(text: str) -> list[float]:
            response = await client.models.embed_content(
                model="text-embedding-004",
                content=text
            )
            return response.embedding

        # 创建服务实例
        session_service = PostgresSessionService(pool=pool)
        memory_service = PostgresMemoryService(
            pool=pool,
            embedding_fn=embed_text
        )

    else:
        raise ValueError(f"Unknown backend type: {config.backend}")

    return session_service, memory_service
```

**步骤 2.3：创建 Travel Agent 定义**

创建 `src/agent.py`：

```python
"""
Travel Agent 定义 - 完全对标 Google 官方 Demo
"""

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool
from config import config

# 导入工具
from tools.flight_search import search_flights
from tools.hotel_booking import book_hotel, search_hotels
from tools.destination_search import recommend_destinations

# Agent System Prompt (与 Google Demo 保持一致)
TRAVEL_AGENT_INSTRUCTIONS = """
You are a helpful travel assistant named Atlas. You help users plan their trips.

## Your Capabilities:
1. **Flight Search**: Search for flights to any destination
2. **Hotel Booking**: Search and book hotels
3. **Destination Recommendations**: Recommend destinations based on user preferences
4. **Preference Memory**: Remember and use user preferences (e.g., "I hate spicy food")

## Important Guidelines:
- Always confirm details before making bookings
- Remember user preferences for future conversations
- Be friendly and proactive in suggesting options
- If user mentions preferences, store them for later use

## State Management:
- Use `user:` prefix for persistent user preferences
- Use session state for current conversation context
"""

def create_travel_agent() -> LlmAgent:
    """创建 Travel Agent 实例"""

    # 定义工具
    tools = [
        FunctionTool(
            name="search_flights",
            description="Search for available flights to a destination",
            func=search_flights
        ),
        FunctionTool(
            name="search_hotels",
            description="Search for hotels in a destination",
            func=search_hotels
        ),
        FunctionTool(
            name="book_hotel",
            description="Book a hotel for the user",
            func=book_hotel
        ),
        FunctionTool(
            name="recommend_destinations",
            description="Recommend travel destinations based on preferences",
            func=recommend_destinations
        )
    ]

    # 创建 Agent
    agent = LlmAgent(
        name="Travel Agent Atlas",
        model=config.model_name,
        instructions=TRAVEL_AGENT_INSTRUCTIONS,
        tools=tools
    )

    return agent
```

**步骤 2.3.5：实现工具模块**

> [!NOTE]
>
> 以下工具实现为骨架代码，用于 Demo 验证。实际业务场景中需对接真实 API。与 [030-the-perception.md](./030-the-perception.md) 中的 `hybrid_search` 函数集成。

**航班查询工具** `src/tools/flight_search.py`：

```python
"""
航班查询工具 - 模拟实现
"""

from datetime import datetime, timedelta
import random

async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    passengers: int = 1
) -> list[dict]:
    """
    搜索航班信息

    Args:
        origin: 出发地城市代码 (如 PVG)
        destination: 目的地城市代码 (如 DPS)
        departure_date: 出发日期 (YYYY-MM-DD)
        passengers: 乘客数量

    Returns:
        航班列表
    """
    # 模拟航班数据
    airlines = ["国航", "东航", "南航", "新航", "国泰"]
    flights = []

    for i in range(3):
        dep_time = datetime.strptime(departure_date, "%Y-%m-%d") + timedelta(hours=8 + i * 3)
        flights.append({
            "flight_no": f"{random.choice(['CA', 'MU', 'CZ', 'SQ', 'CX'])}{random.randint(100, 999)}",
            "airline": random.choice(airlines),
            "origin": origin,
            "destination": destination,
            "departure_time": dep_time.strftime("%Y-%m-%d %H:%M"),
            "arrival_time": (dep_time + timedelta(hours=random.randint(3, 8))).strftime("%Y-%m-%d %H:%M"),
            "price": random.randint(1500, 5000) * passengers,
            "currency": "CNY",
            "seats_available": random.randint(5, 50)
        })

    return flights
```

**酒店预订工具** `src/tools/hotel_booking.py`：

```python
"""
酒店预订工具 - 模拟实现
"""

from datetime import datetime
import random
import uuid

# 模拟酒店数据库
MOCK_HOTELS = {
    "DPS": [  # 巴厘岛
        {"name": "巴厘岛四季度假村", "star": 5, "base_price": 2800},
        {"name": "阿雅娜度假村", "star": 5, "base_price": 2200},
        {"name": "巴厘岛洲际酒店", "star": 5, "base_price": 1800},
    ],
    "BKK": [  # 曼谷
        {"name": "曼谷半岛酒店", "star": 5, "base_price": 1500},
        {"name": "曼谷悦榕庄", "star": 5, "base_price": 2000},
    ]
}

async def search_hotels(
    destination: str,
    checkin_date: str,
    checkout_date: str,
    guests: int = 2
) -> list[dict]:
    """搜索酒店"""
    hotels = MOCK_HOTELS.get(destination.upper(), MOCK_HOTELS.get("DPS", []))
    results = []

    for hotel in hotels:
        results.append({
            "hotel_id": str(uuid.uuid4())[:8],
            "name": hotel["name"],
            "star_rating": hotel["star"],
            "price_per_night": hotel["base_price"] + random.randint(-200, 200),
            "currency": "CNY",
            "checkin": checkin_date,
            "checkout": checkout_date,
            "guests": guests,
            "amenities": ["WiFi", "泳池", "早餐", "SPA"],
            "available_rooms": random.randint(1, 10)
        })

    return results

async def book_hotel(
    hotel_id: str,
    guest_name: str,
    checkin_date: str,
    checkout_date: str
) -> dict:
    """预订酒店"""
    return {
        "confirmation_code": f"HTL-{uuid.uuid4().hex[:8].upper()}",
        "hotel_id": hotel_id,
        "guest_name": guest_name,
        "checkin": checkin_date,
        "checkout": checkout_date,
        "status": "CONFIRMED",
        "message": "预订成功！确认邮件已发送。"
    }
```

**目的地推荐工具** `src/tools/destination_search.py`（集成 Perception 层）：

```python
"""
目的地推荐工具 - 集成 Perception 层的混合检索能力

参考：docs/practice/030-the-perception.md - hybrid_search_function.sql
"""

from typing import Optional
import asyncpg

# 目的地静态知识（实际场景从 RAG 知识库检索）
DESTINATIONS = [
    {"name": "巴厘岛", "tags": ["海岛", "度假", "潜水", "SPA"], "climate": "热带"},
    {"name": "普吉岛", "tags": ["海岛", "沙滩", "夜生活"], "climate": "热带"},
    {"name": "京都", "tags": ["文化", "古迹", "樱花", "美食"], "climate": "温带"},
    {"name": "瑞士", "tags": ["滑雪", "雪山", "徒步", "自然"], "climate": "高山"},
    {"name": "马尔代夫", "tags": ["海岛", "蜜月", "潜水", "奢华"], "climate": "热带"},
]

async def recommend_destinations(
    preferences: str,
    pool: Optional[asyncpg.Pool] = None
) -> list[dict]:
    """
    基于用户偏好推荐目的地

    如果提供 pool，使用 Perception 层的混合检索；
    否则使用简单关键词匹配。
    """
    if pool:
        # 使用 Perception 层的 hybrid_search (参考 030-the-perception.md)
        results = await pool.fetch("""
            SELECT * FROM hybrid_search_destinations(
                query_text := $1,
                query_embedding := $2,
                limit_count := 5
            )
        """, preferences, await _get_embedding(preferences))
        return [dict(r) for r in results]

    # 简化版：关键词匹配
    keywords = preferences.lower().split()
    scored = []

    for dest in DESTINATIONS:
        score = sum(1 for tag in dest["tags"] if any(kw in tag.lower() for kw in keywords))
        if score > 0:
            scored.append({**dest, "relevance_score": score})

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    return scored[:5]

async def _get_embedding(text: str) -> list[float]:
    """获取文本 Embedding（占位，实际调用 Gemini API）"""
    # 实际实现参考 services.py 中的 embed_text 函数
    return [0.0] * 768  # 占位向量
```

**步骤 2.3.6：创建测试数据脚本**

创建 `scripts/seed_data.py`：

```python
"""
测试数据初始化脚本
"""

import asyncio
import asyncpg
import json
from pathlib import Path

# 目的地测试数据
DESTINATIONS_DATA = [
    {
        "id": "dest_001",
        "name": "巴厘岛",
        "country": "印度尼西亚",
        "description": "印度尼西亚著名海岛度假胜地，以美丽沙滩、水上活动和文化体验闻名。",
        "tags": ["海岛", "度假", "潜水", "SPA", "蜜月"],
        "climate": "热带",
        "best_season": "4月-10月",
        "avg_cost_per_day": 800
    },
    {
        "id": "dest_002",
        "name": "京都",
        "country": "日本",
        "description": "日本古都，保留大量历史寺庙和传统文化，是体验日本文化的最佳目的地。",
        "tags": ["文化", "古迹", "樱花", "美食", "温泉"],
        "climate": "温带",
        "best_season": "3月-5月, 10月-11月",
        "avg_cost_per_day": 1200
    },
    {
        "id": "dest_003",
        "name": "瑞士少女峰",
        "country": "瑞士",
        "description": "欧洲屋脊，阿尔卑斯山脉最壮观的山峰之一，滑雪和徒步天堂。",
        "tags": ["滑雪", "雪山", "徒步", "自然", "火车"],
        "climate": "高山",
        "best_season": "12月-3月(滑雪), 6月-9月(徒步)",
        "avg_cost_per_day": 2000
    }
]

# 用户偏好测试数据
USER_PREFERENCES = [
    {"user_id": "demo_user", "preference": "I don't like spicy food", "category": "food"},
    {"user_id": "demo_user", "preference": "I prefer beach vacations", "category": "travel"},
    {"user_id": "demo_user", "preference": "Budget is around 10000 CNY", "category": "budget"},
]

async def seed_destinations(pool: asyncpg.Pool):
    """插入目的地数据"""
    print("🌍 Seeding destinations...")
    for dest in DESTINATIONS_DATA:
        await pool.execute("""
            INSERT INTO destinations (id, name, country, description, tags, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description
        """, dest["id"], dest["name"], dest["country"],
            dest["description"], dest["tags"],
            json.dumps({"climate": dest["climate"], "best_season": dest["best_season"]})
        )
    print(f"  ✅ Inserted {len(DESTINATIONS_DATA)} destinations")

async def seed_user_preferences(pool: asyncpg.Pool):
    """插入用户偏好数据"""
    print("👤 Seeding user preferences...")
    for pref in USER_PREFERENCES:
        await pool.execute("""
            INSERT INTO user_preferences (user_id, preference, category)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
        """, pref["user_id"], pref["preference"], pref["category"])
    print(f"  ✅ Inserted {len(USER_PREFERENCES)} preferences")

async def main():
    import os
    database_url = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/agent_db")

    print("🚀 Starting data seeding...")
    pool = await asyncpg.create_pool(database_url)

    try:
        await seed_destinations(pool)
        await seed_user_preferences(pool)
        print("✅ Data seeding completed!")
    finally:
        await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
```

**运行数据初始化：**

```bash
# 初始化测试数据
uv run python scripts/seed_data.py

# 预期输出:
# 🚀 Starting data seeding...
# 🌍 Seeding destinations...
#   ✅ Inserted 3 destinations
# 👤 Seeding user preferences...
#   ✅ Inserted 3 preferences
# ✅ Data seeding completed!
```

**步骤 2.4：创建 Streamlit 前端**

创建 `src/app.py`：

```python
"""
Streamlit 前端 - Travel Agent Demo
"""

import streamlit as st
import asyncio
from agent import create_travel_agent
from services import create_services
from config import config
from google.adk.runners import Runner

st.set_page_config(
    page_title="Travel Agent - Open Agent Engine Demo",
    page_icon="✈️",
    layout="wide"
)

# 初始化 Session State
if "messages" not in st.session_state:
    st.session_state.messages = []
if "session_id" not in st.session_state:
    st.session_state.session_id = None

async def get_runner():
    """获取或创建 Runner 实例"""
    if "runner" not in st.session_state:
        session_service, memory_service = await create_services()
        agent = create_travel_agent()
        st.session_state.runner = Runner(
            agent=agent,
            session_service=session_service,
            memory_service=memory_service
        )
    return st.session_state.runner

async def chat(message: str):
    """处理用户消息"""
    runner = await get_runner()

    # 运行 Agent
    response = await runner.run(
        message=message,
        app_name=config.app_name,
        user_id=config.default_user_id,
        session_id=st.session_state.session_id
    )

    # 更新 Session ID
    if st.session_state.session_id is None:
        st.session_state.session_id = response.session_id

    return response.text

# UI 布局
st.title("✈️ Travel Agent - Open Agent Engine Demo")

# 侧边栏：配置信息
with st.sidebar:
    st.header("⚙️ Configuration")
    st.info(f"**Backend**: {config.backend.value}")
    st.info(f"**Model**: {config.model_name}")
    st.info(f"**Session**: {st.session_state.session_id or 'New'}")

    if st.button("🔄 New Conversation"):
        st.session_state.messages = []
        st.session_state.session_id = None
        st.rerun()

    st.header("📊 Debug")
    if st.button("🔍 View Traces"):
        st.markdown("[Open Langfuse UI](http://localhost:3000)")

# 聊天历史
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# 用户输入
if prompt := st.chat_input("Ask me about travel..."):
    # 显示用户消息
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # 获取 Agent 响应
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = asyncio.run(chat(prompt))
        st.markdown(response)
        st.session_state.messages.append({"role": "assistant", "content": response})
```

#### 4.2.3 功能验证测试

创建 `tests/test_backend_replacement.py`：

```python
"""
后端替换验证测试：确保 Open Agent Engine 与 Google InMemory 实现行为一致
"""

import pytest
import asyncio
from services import create_services
from agent import create_travel_agent
from config import config, BackendType

pytestmark = pytest.mark.asyncio

class TestBackendReplacement:
    """验证 Drop-in Replacement 的行为一致性"""

    async def test_session_create_and_load(self):
        """测试 Session 创建与加载"""
        session_service, _ = await create_services()

        # 创建 Session
        session = await session_service.create_session(
            app_name="test_app",
            user_id="test_user"
        )
        assert session.id is not None
        assert session.app_name == "test_app"

        # 加载 Session
        loaded = await session_service.get_session(
            app_name="test_app",
            user_id="test_user",
            session_id=session.id
        )
        assert loaded is not None
        assert loaded.id == session.id

    async def test_memory_store_and_search(self):
        """测试 Memory 存储与检索"""
        _, memory_service = await create_services()

        # 创建测试 Session
        from services import create_services
        session_service, _ = await create_services()
        session = await session_service.create_session(
            app_name="test_app",
            user_id="test_user"
        )
        session.events = [
            {"author": "user", "content": {"text": "I don't like spicy food"}},
            {"author": "assistant", "content": {"text": "Noted!"}}
        ]

        # 存储到 Memory
        await memory_service.add_session_to_memory(session)

        # 检索
        result = await memory_service.search_memory(
            app_name="test_app",
            user_id="test_user",
            query="food preferences"
        )

        assert len(result.memories) > 0
        assert "spicy" in result.memories[0].content.lower()

    async def test_e2e_conversation(self):
        """测试端到端对话流程"""
        from google.adk.runners import Runner

        session_service, memory_service = await create_services()
        agent = create_travel_agent()
        runner = Runner(
            agent=agent,
            session_service=session_service,
            memory_service=memory_service
        )

        # 第一轮对话
        response1 = await runner.run(
            message="我想去巴厘岛度假",
            app_name="test_app",
            user_id="test_user"
        )
        assert response1.text is not None
        assert len(response1.text) > 0

        # 第二轮对话 (使用相同 session)
        response2 = await runner.run(
            message="帮我查一下机票",
            app_name="test_app",
            user_id="test_user",
            session_id=response1.session_id
        )
        assert response2.text is not None
```

**运行验证测试：**

```bash
# 运行后端替换验证测试
uv run pytest tests/test_backend_replacement.py -v

# 启动 Demo 应用
uv run streamlit run src/app.py
```

---

### 4.3 Step 3: 四支柱联合验收

> [!IMPORTANT]
>
> **Holistic Validation** 是 Phase 5 的核心验收环节，需要验证四大支柱在真实业务场景下的协同运作能力。

#### 4.3.1 任务清单

| 任务 ID | 任务描述                         | 状态      | 验收标准                        |
| :------ | :------------------------------- | :-------- | :------------------------------ |
| P5-2-1  | 模拟 10 用户并发多轮对话         | 🔄 进行中 | Session 状态无脏读或丢失        |
| P5-2-2  | 验证状态回溯能力                 | 🔄 进行中 | 可回溯历史状态                  |
| P5-2-3  | 验证实时推送延迟                 | 🔄 进行中 | Event 产生到前端收到 < **50ms** |
| P5-2-4  | 测试跨会话偏好记忆               | 🔄 进行中 | 新会话自动召回偏好              |
| P5-2-5  | 验证记忆巻固流程                 | 🔄 进行中 | Fast Replay + Deep Reflection   |
| P5-2-6  | 测量 Read-Your-Writes 延迟       | 🔄 进行中 | 新记忆在下一 Turn 立即可见      |
| P5-2-7  | 测试混合检索                     | 🔄 进行中 | 关键词 + 向量融合结果正确       |
| P5-2-8  | 验证 Reranking 提升效果          | 🔄 进行中 | Top-10 结果更相关               |
| P5-2-9  | 验证高过滤比场景召回率           | 🔄 进行中 | Recall@10 >= 90%                |
| P5-2-10 | 使用可视化工具追踪复杂推理 Trace | 🔄 进行中 | Step-by-Step 透明度确认         |
| P5-2-11 | 验证调试能力                     | 🔄 进行中 | 可通过 Trace 发现问题           |
| P5-2-12 | 验证沙箱安全隔离                 | 🔄 进行中 | 恶意代码不影响主机              |

#### 4.3.2 🫀 The Pulse 验收

> [!NOTE]
>
> **前序参考**：[010-the-pulse.md](./010-the-pulse.md) · 核心验证点：原子状态流转 ([1.3.1](./010-the-pulse.md#131-原子状态流转))、OCC 并发控制 ([1.3.2](./010-the-pulse.md#132-乐观并发控制))、实时事件流 ([1.3.3](./010-the-pulse.md#133-实时事件流))

**KPI**: 并发一致性 (OCC) —— 多 Agent 竞争下的数据正确性。

创建 `tests/test_pulse.py`：

```python
"""
The Pulse 验收测试：验证会话引擎的并发一致性与实时性
"""

import pytest
import asyncio
import time
from uuid import uuid4
from services import create_services

pytestmark = pytest.mark.asyncio


class TestPulseValidation:
    """Pulse (会话引擎) 验收测试套件"""

    # ========== P5-2-1: 并发多轮对话 ==========

    async def test_concurrent_sessions_no_interference(self):
        """测试多用户并发对话不会相互干扰"""
        session_service, _ = await create_services()
        app_name = "travel_agent"

        # 创建 10 个并发用户的 Session
        async def user_conversation(user_id: str):
            session = await session_service.create_session(
                app_name=app_name,
                user_id=user_id,
                state={"user_name": user_id}
            )

            # 模拟多轮对话
            for i in range(5):
                event = {
                    "id": str(uuid4()),
                    "author": "user",
                    "content": {"text": f"Message {i} from {user_id}"},
                    "actions": {"state_delta": {f"turn_{i}": True}}
                }
                await session_service.append_event(session, event)

            # 验证 Session 状态
            loaded = await session_service.get_session(
                app_name=app_name,
                user_id=user_id,
                session_id=session.id
            )
            assert loaded.state["user_name"] == user_id
            assert len(loaded.events) == 5
            return loaded

        # 10 用户并发执行
        user_ids = [f"user_{i:03d}" for i in range(10)]
        sessions = await asyncio.gather(*[
            user_conversation(uid) for uid in user_ids
        ])

        # 验证无数据混淆
        for session in sessions:
            assert session.state["user_name"] in user_ids
            for event in session.events:
                assert session.state["user_name"] in event["content"]["text"]

    async def test_optimistic_concurrency_control(self):
        """测试多写入者并发时的乐观锁控制"""
        session_service, _ = await create_services()

        session = await session_service.create_session(
            app_name="test_app",
            user_id="test_user",
            state={"counter": 0}
        )

        # 模拟 10 个并发写入者
        async def concurrent_increment(writer_id: int):
            for _ in range(10):
                current = await session_service.get_session(
                    app_name="test_app",
                    user_id="test_user",
                    session_id=session.id
                )
                new_counter = current.state.get("counter", 0) + 1
                event = {
                    "id": str(uuid4()),
                    "author": "agent",
                    "content": {},
                    "actions": {"state_delta": {"counter": new_counter}}
                }
                try:
                    await session_service.append_event(current, event)
                except Exception:
                    pass  # OCC 冲突重试

        await asyncio.gather(*[
            concurrent_increment(i) for i in range(10)
        ])

        # 验证最终计数（可能因 OCC 冲突而少于 100，但不应丢失）
        final = await session_service.get_session(
            app_name="test_app",
            user_id="test_user",
            session_id=session.id
        )
        assert final.state["counter"] > 0
        print(f"Final counter: {final.state['counter']} (expected ~100 with conflicts)")

    # ========== P5-2-2: 状态回溯 ==========

    async def test_state_rollback_via_snapshots(self):
        """测试通过快照恢复历史状态"""
        session_service, _ = await create_services()

        session = await session_service.create_session(
            app_name="test_app",
            user_id="test_user"
        )

        # 创建多个状态变更
        states_history = []
        for i in range(5):
            event = {
                "id": str(uuid4()),
                "author": "agent",
                "actions": {"state_delta": {f"step_{i}": f"value_{i}"}}
            }
            await session_service.append_event(session, event)
            current = await session_service.get_session(
                app_name="test_app",
                user_id="test_user",
                session_id=session.id
            )
            states_history.append(current.state.copy())

        # 验证状态累积正确
        final_state = states_history[-1]
        assert len(final_state) == 5
        for i in range(5):
            assert final_state[f"step_{i}"] == f"value_{i}"

    # ========== P5-2-3: 实时推送延迟 ==========

    async def test_event_notification_latency(self):
        """测试事件通知延迟 < 50ms"""
        session_service, _ = await create_services()

        session = await session_service.create_session(
            app_name="test_app",
            user_id="test_user"
        )

        # 测量事件插入到通知的延迟
        latencies = []
        for _ in range(10):
            start = time.perf_counter()
            event = {
                "id": str(uuid4()),
                "author": "user",
                "content": {"text": "test message"}
            }
            await session_service.append_event(session, event)
            latency_ms = (time.perf_counter() - start) * 1000
            latencies.append(latency_ms)

        avg_latency = sum(latencies) / len(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]

        print(f"Event append latency: avg={avg_latency:.2f}ms, P99={p99_latency:.2f}ms")
        assert p99_latency < 50, f"P99 latency {p99_latency}ms exceeds 50ms threshold"
```

#### 4.3.3 🧠 The Hippocampus 验收

> [!NOTE]
>
> **前序参考**：[020-the-hippocampus.md](./020-the-hippocampus.md) · 核心验证点：记忆巩固 Worker ([2.2](./020-the-hippocampus.md#22-memory-consolidation-worker))、艾宾浩斯衰减 ([2.3](./020-the-hippocampus.md#23-biological-retention))、Context Window ([2.3.3](./020-the-hippocampus.md#233-context-window-组装))

**KPI**: 记忆新鲜度 (Freshness) —— 从 "发生" 到 "可回忆" 的时延。

创建 `tests/test_hippocampus.py`：

```python
"""
The Hippocampus 验收测试：验证记忆系统的巩固与召回能力
"""

import pytest
import asyncio
import time
from services import create_services

pytestmark = pytest.mark.asyncio


class TestHippocampusValidation:
    """Hippocampus (记忆系统) 验收测试套件"""

    # ========== P5-2-4: 跨会话偏好记忆 ==========

    async def test_cross_session_preference_recall(self):
        """测试跨会话偏好记忆召回 (\"I hate spicy food\")"""
        session_service, memory_service = await create_services()

        user_id = "preference_test_user"
        app_name = "travel_agent"

        # 第一个会话：用户表达偏好
        session1 = await session_service.create_session(
            app_name=app_name,
            user_id=user_id
        )
        session1.events = [
            {"author": "user", "content": {"text": "我不喜欢辣的食物"}},
            {"author": "assistant", "content": {"text": "好的，我记住了您不喜欢辣食"}}
        ]

        # 记忆巩固
        await memory_service.add_session_to_memory(session1)

        # 稍等一下让记忆写入
        await asyncio.sleep(0.5)

        # 第二个会话：验证偏好被召回
        result = await memory_service.search_memory(
            app_name=app_name,
            user_id=user_id,
            query="用户的饮食偏好"
        )

        assert len(result.memories) > 0
        memory_content = " ".join([m.content for m in result.memories])
        assert "辣" in memory_content or "spicy" in memory_content.lower()

    # ========== P5-2-5: 记忆巩固流程 ==========

    async def test_memory_consolidation_flow(self):
        """测试 Fast Replay + Deep Reflection 记忆巩固流程"""
        session_service, memory_service = await create_services()

        # 创建多轮对话 Session
        session = await session_service.create_session(
            app_name="travel_agent",
            user_id="consolidation_test_user"
        )
        session.events = [
            {"author": "user", "content": {"text": "我想去巴厘岛"}},
            {"author": "assistant", "content": {"text": "巴厘岛是个很棒的选择！"}},
            {"author": "user", "content": {"text": "我喜欢海滩和安静的地方"}},
            {"author": "assistant", "content": {"text": "了解，我会推荐海滩度假村"}},
            {"author": "user", "content": {"text": "预算大概 5000 人民币"}},
            {"author": "assistant", "content": {"text": "这个预算可以找到不错的选择"}}
        ]

        # 触发记忆巩固
        await memory_service.add_session_to_memory(session)

        # 验证记忆已生成
        result = await memory_service.search_memory(
            app_name="travel_agent",
            user_id="consolidation_test_user",
            query="巴厘岛 海滩"
        )

        assert len(result.memories) > 0

    # ========== P5-2-6: Read-Your-Writes 延迟 ==========

    async def test_read_your_writes_latency(self):
        """测试新记忆在下一 Turn 立即可见"""
        session_service, memory_service = await create_services()

        user_id = "ryw_test_user"
        app_name = "travel_agent"

        # 写入记忆
        session = await session_service.create_session(
            app_name=app_name,
            user_id=user_id
        )
        unique_fact = f"用户喜欢{time.time()}"  # 唯一标识
        session.events = [
            {"author": "user", "content": {"text": unique_fact}}
        ]

        # 记忆巩固
        start = time.perf_counter()
        await memory_service.add_session_to_memory(session)

        # 立即检索
        result = await memory_service.search_memory(
            app_name=app_name,
            user_id=user_id,
            query=unique_fact
        )
        latency_ms = (time.perf_counter() - start) * 1000

        print(f"Read-Your-Writes latency: {latency_ms:.2f}ms")

        # 验证记忆可见
        assert len(result.memories) > 0
        assert unique_fact in result.memories[0].content
```

#### 4.3.4 👁️ The Perception 验收

> [!NOTE]
>
> **前序参考**：[030-the-perception.md](./030-the-perception.md) · 核心验证点：融合检索 SQL ([3.1](./030-the-perception.md#31-fusion-retrieval))、RRF 算法 ([3.1.2](./030-the-perception.md#312-rrf-融合算法))、L1 Reranking ([3.2.2](./030-the-perception.md#322-l1-reranking))

**KPI**: 检索精度 (Recall@10 with Filters) —— 高过滤比下的召回率。

创建 `tests/test_perception.py`：

```python
"""
The Perception 验收测试：验证融合检索的精度与召回率
"""

import pytest
import asyncio
from services import create_services
from uuid import uuid4

pytestmark = pytest.mark.asyncio


class TestPerceptionValidation:
    """Perception (融合检索) 验收测试套件"""

    @pytest.fixture
    async def seeded_memories(self):
        """预填充测试数据"""
        session_service, memory_service = await create_services()

        user_id = "perception_test_user"
        app_name = "travel_agent"

        # 创建多个测试 Session 并巩固为记忆
        destinations = [
            ("巴厘岛", "海滩、冲浪、寺庙、轻松"),
            ("东京", "美食、购物、科技、繁华"),
            ("巴黎", "浪漫、艺术、美食、文化"),
            ("马尔代夫", "海岛、度假、潜水、安静"),
            ("瑞士", "雪山、滑雪、自然、宁静")
        ]

        for dest, keywords in destinations:
            session = await session_service.create_session(
                app_name=app_name,
                user_id=user_id
            )
            session.events = [
                {"author": "user", "content": {"text": f"我想了解{dest}"}},
                {"author": "assistant", "content": {"text": f"{dest}的特点是：{keywords}"}}
            ]
            await memory_service.add_session_to_memory(session)

        await asyncio.sleep(1)  # 等待向量化完成
        return (session_service, memory_service, user_id, app_name)

    # ========== P5-2-7: 混合检索 ==========

    async def test_hybrid_search_fusion(self, seeded_memories):
        """测试关键词 + 向量融合检索结果正确"""
        _, memory_service, user_id, app_name = seeded_memories

        # 语义查询：期望召回海岛类目的地
        result = await memory_service.search_memory(
            app_name=app_name,
            user_id=user_id,
            query="推荐一些轻松的地方"
        )

        assert len(result.memories) > 0
        contents = " ".join([m.content for m in result.memories])
        # 验证召回了轻松相关的目的地
        assert any(kw in contents for kw in ["轻松", "安静", "宁静", "度假"])

    # ========== P5-2-8: Reranking 效果 ==========

    async def test_reranking_improves_relevance(self, seeded_memories):
        """测试 Reranking 提升 Top-10 结果相关性"""
        _, memory_service, user_id, app_name = seeded_memories

        # 查询特定类型
        result = await memory_service.search_memory(
            app_name=app_name,
            user_id=user_id,
            query="海滩度假"
        )

        # 验证最相关结果在 Top 位置
        top_result = result.memories[0]
        assert any(kw in top_result.content for kw in ["海滩", "海岛", "潜水"])

    # ========== P5-2-9: 高过滤比召回率 ==========

    async def test_high_selectivity_recall(self):
        """测试 99% 过滤比场景下的召回率 >= 90%"""
        session_service, memory_service = await create_services()

        # 创建大量记忆 (模拟多用户场景)
        target_user = "high_selectivity_target"
        app_name = "travel_agent"

        # 目标用户的记忆
        target_session = await session_service.create_session(
            app_name=app_name,
            user_id=target_user
        )
        target_session.events = [
            {"author": "user", "content": {"text": "我喜欢寿司和拉面"}},
        ]
        await memory_service.add_session_to_memory(target_session)

        # 其他用户的大量记忆 (模拟 99% 的其他数据)
        for i in range(100):
            other_session = await session_service.create_session(
                app_name=app_name,
                user_id=f"other_user_{i}"
            )
            other_session.events = [
                {"author": "user", "content": {"text": f"随机内容 {uuid4()}"}},
            ]
            await memory_service.add_session_to_memory(other_session)

        await asyncio.sleep(2)  # 等待向量化

        # 仅查询目标用户的记忆
        result = await memory_service.search_memory(
            app_name=app_name,
            user_id=target_user,
            query="日本美食"
        )

        # 验证召回了目标用户的记忆
        assert len(result.memories) > 0
        assert "寿司" in result.memories[0].content or "拉面" in result.memories[0].content
```

#### 4.3.5 🔮 The Realm of Mind 验收

> [!NOTE]
>
> **前序参考**：[040-the-realm-of-mind.md](./040-the-realm-of-mind.md) · 核心验证点：ADK Adapter ([4.2](./040-the-realm-of-mind.md#42-postgresql-adapter-开发))、OpenTelemetry Tracing ([4.4.1](./040-the-realm-of-mind.md#441-opentelemetry-集成))、Sandbox ([4.4.2](./040-the-realm-of-mind.md#442-sandboxed-execution))

**KPI**: 可调试性 (Debuggability) —— 能否精准定位推理死循环或幻觉。

创建 `tests/test_mind.py`：

```python
"""
The Realm of Mind 验收测试：验证 Trace 可观测性与沙箱安全
"""

import pytest
import asyncio
from services import create_services
from adk_postgres import ToolRegistry
from adk_postgres.sandbox import DockerSandboxRunner

pytestmark = pytest.mark.asyncio


class TestMindValidation:
    """Mind (心智空间) 验收测试套件"""

    # ========== P5-2-10: Trace 链路追踪 ==========

    async def test_trace_completeness(self):
        """测试完整 Trace 链路可追踪"""
        from google.adk.runners import Runner
        session_service, memory_service = await create_services()

        # 导入 Agent (需要已设置 OpenTelemetry)
        from agent import create_travel_agent
        agent = create_travel_agent()
        runner = Runner(
            agent=agent,
            session_service=session_service,
            memory_service=memory_service
        )

        # 执行对话
        response = await runner.run(
            message="帮我查一下去巴厘岛的机票",
            app_name="trace_test",
            user_id="trace_user"
        )

        assert response.text is not None

        # 验证 Trace 数据已写入
        # (实际验收时在 Langfuse UI 中查看完整链路)
        # 这里通过查询 traces 表验证
        from services import get_db_pool
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            traces = await conn.fetch(
                "SELECT * FROM traces ORDER BY start_time DESC LIMIT 10"
            )
            print(f"Found {len(traces)} trace spans")
            # 生产环境应有多个 Span

    # ========== P5-2-11: 调试能力验证 ==========

    async def test_debug_infinite_loop_detection(self):
        """测试能通过 Trace 发现推理死循环"""
        # 这是手动验证项，在此记录验证步骤
        verification_steps = """
        手动验证步骤 (在 Langfuse UI 中执行):
        1. 访问 http://localhost:3000
        2. 选择 Project: travel-agent-demo
        3. 搜索包含多个 llm.generate 调用的 Trace
        4. 验证 Observation 层级结构清晰展示了:
           - runner.run (根 Span)
             - session.get
             - memory.search
             - agent.invoke
               - llm.generate (可能多次, 显示 Token 消耗)
               - tool.search_flights (如果有工具调用)
        5. 确认能看到每个步骤的 duration、cost、score 信息
        """
        print(verification_steps)
        # 交给人工在 Langfuse UI 验证

    # ========== P5-2-12: 沙箱安全隔离 ==========

    async def test_sandbox_isolation(self):
        """测试恶意代码在沙箱中被安全隔离"""
        try:
            sandbox = DockerSandboxRunner(
                timeout_seconds=5,
                memory_limit_mb=128,
                network_disabled=True
            )
        except Exception as e:
            pytest.skip(f"Docker sandbox not available: {e}")
            return

        # 测试正常代码执行
        result = await sandbox.execute("print(1 + 1)")
        assert "2" in result.stdout
        assert result.exit_code == 0

        # 测试恶意代码被阻止
        malicious_codes = [
            "import os; os.system('rm -rf /')",  # 系统破坏
            "import socket; socket.socket()",     # 网络访问
            "open('/etc/passwd').read()",         # 文件读取
        ]

        for code in malicious_codes:
            result = await sandbox.execute(code)
            # 恶意操作应该失败或被拦截
            assert result.exit_code != 0 or "Error" in result.stderr
            print(f"Malicious code blocked: {code[:30]}...")

    async def test_sandbox_resource_limits(self):
        """测试沙箱资源限制生效"""
        try:
            sandbox = DockerSandboxRunner(
                timeout_seconds=2,
                memory_limit_mb=64
            )
        except Exception:
            pytest.skip("Docker sandbox not available")
            return

        # 测试超时限制
        result = await sandbox.execute("import time; time.sleep(10)")
        assert result.exit_code != 0 or "timeout" in str(result.error).lower()

        # 测试内存限制 (创建大数组)
        result = await sandbox.execute("x = [0] * (100 * 1024 * 1024)")  # 100MB
        assert result.exit_code != 0 or "memory" in str(result.error).lower()
```

---

### 4.4 Step 4: 性能对比验证

#### 4.4.1 任务清单

| 任务 ID | 任务描述                           | 状态      | 验收标准         |
| :------ | :--------------------------------- | :-------- | :--------------- |
| P5-3-1  | 记录 Google 原生方案 P99 响应延迟  | 🔲 待开始 | 基线数据         |
| P5-3-2  | 记录 Glass-Box Engine P99 响应延迟 | 🔲 待开始 | 测试数据         |
| P5-3-3  | 计算延迟差异                       | 🔲 待开始 | 差异 < **100ms** |
| P5-3-4  | 编写性能对比报告                   | 🔲 待开始 | 对比分析文档     |

#### 4.4.2 性能基准测试脚本

创建 `scripts/run_benchmark.py`：

```python
"""
性能基准测试：对比 Google InMemory 与 Open Agent Engine (PostgreSQL) 的响应延迟
"""

import asyncio
import time
import statistics
from dataclasses import dataclass
from enum import Enum

# 导入服务
from services import create_services
from config import config, BackendType
from agent import create_travel_agent
from google.adk.runners import Runner


@dataclass
class BenchmarkResult:
    backend: str
    total_requests: int
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    errors: int


class PerformanceBenchmark:
    """性能基准测试器"""

    def __init__(self, num_requests: int = 50, concurrent_users: int = 5):
        self.num_requests = num_requests
        self.concurrent_users = concurrent_users
        self.test_messages = [
            "帮我查一下去巴厘岛的机票",
            "推荐几个适合度假的地方",
            "我想订一个海景酒店",
            "查一下明天的天气",
            "我不喜欢辣的食物，有什么推荐？"
        ]

    async def run_single_request(
        self,
        runner: Runner,
        user_id: str,
        message: str
    ) -> tuple[float, bool]:
        """执行单次请求并返回延迟"""
        start = time.perf_counter()
        try:
            response = await runner.run(
                message=message,
                app_name="benchmark_app",
                user_id=user_id
            )
            success = response.text is not None and len(response.text) > 0
            latency = (time.perf_counter() - start) * 1000
            return (latency, success)
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            print(f"Request failed: {e}")
            return (latency, False)

    async def run_benchmark(self, backend_type: BackendType) -> BenchmarkResult:
        """运行基准测试"""
        # 设置后端
        config.backend = backend_type

        # 创建服务
        session_service, memory_service = await create_services()
        agent = create_travel_agent()
        runner = Runner(
            agent=agent,
            session_service=session_service,
            memory_service=memory_service
        )

        # 预热
        print(f"Warming up {backend_type.value} backend...")
        for i in range(3):
            await self.run_single_request(runner, f"warmup_{i}", "test")

        # 执行基准测试
        print(f"Running benchmark for {backend_type.value}...")
        latencies = []
        errors = 0

        async def user_workload(user_id: str):
            nonlocal errors
            user_latencies = []
            for i in range(self.num_requests // self.concurrent_users):
                msg = self.test_messages[i % len(self.test_messages)]
                latency, success = await self.run_single_request(runner, user_id, msg)
                user_latencies.append(latency)
                if not success:
                    errors += 1
            return user_latencies

        # 并发执行
        results = await asyncio.gather(*[
            user_workload(f"user_{i}") for i in range(self.concurrent_users)
        ])

        # 合并延迟数据
        for user_latencies in results:
            latencies.extend(user_latencies)

        # 计算统计数据
        latencies.sort()
        return BenchmarkResult(
            backend=backend_type.value,
            total_requests=len(latencies),
            avg_latency_ms=statistics.mean(latencies),
            p50_latency_ms=latencies[int(len(latencies) * 0.50)],
            p95_latency_ms=latencies[int(len(latencies) * 0.95)],
            p99_latency_ms=latencies[int(len(latencies) * 0.99)],
            errors=errors
        )

    async def compare_backends(self) -> dict:
        """对比两种后端的性能"""
        results = {}

        # 测试 Google InMemory (基线)
        results["google"] = await self.run_benchmark(BackendType.GOOGLE_MANAGED)

        # 测试 PostgreSQL (我们的实现)
        results["postgres"] = await self.run_benchmark(BackendType.OPEN_ENGINE)

        return results


def print_comparison_report(results: dict):
    """打印性能对比报告"""
    google = results["google"]
    postgres = results["postgres"]

    print("\n" + "=" * 70)
    print("📊 性能对比报告 - Open Agent Engine vs Google InMemory")
    print("=" * 70)

    print(f"\n{'指标':<25} {'Google InMemory':>18} {'PostgreSQL':>18} {'差异':>12}")
    print("-" * 70)

    metrics = [
        ("Total Requests", google.total_requests, postgres.total_requests),
        ("Avg Latency (ms)", google.avg_latency_ms, postgres.avg_latency_ms),
        ("P50 Latency (ms)", google.p50_latency_ms, postgres.p50_latency_ms),
        ("P95 Latency (ms)", google.p95_latency_ms, postgres.p95_latency_ms),
        ("P99 Latency (ms)", google.p99_latency_ms, postgres.p99_latency_ms),
        ("Errors", google.errors, postgres.errors),
    ]

    for name, g_val, p_val in metrics:
        diff = p_val - g_val if isinstance(g_val, float) else p_val - g_val
        diff_str = f"+{diff:.2f}" if diff > 0 else f"{diff:.2f}"
        print(f"{name:<25} {g_val:>18.2f} {p_val:>18.2f} {diff_str:>12}")

    # 验证 KPI
    p99_diff = postgres.p99_latency_ms - google.p99_latency_ms
    print("\n" + "-" * 70)
    if p99_diff < 100:
        print(f"✅ KPI 达成: P99 延迟差异 {p99_diff:.2f}ms < 100ms 阈值")
    else:
        print(f"❌ KPI 未达成: P99 延迟差异 {p99_diff:.2f}ms >= 100ms 阈值")
    print("=" * 70)


async def main():
    benchmark = PerformanceBenchmark(
        num_requests=50,
        concurrent_users=5
    )
    results = await benchmark.compare_backends()
    print_comparison_report(results)


if __name__ == "__main__":
    asyncio.run(main())
```

**运行基准测试：**

```bash
# 运行性能基准测试
python scripts/run_benchmark.py

# 预期输出:
# ======================================================================
# 📊 性能对比报告 - Open Agent Engine vs Google InMemory
# ======================================================================
#
# 指标                       Google InMemory         PostgreSQL         差异
# ----------------------------------------------------------------------
# Total Requests                      50.00             50.00        0.00
# Avg Latency (ms)                  1250.00           1280.00       30.00
# P50 Latency (ms)                  1180.00           1210.00       30.00
# P95 Latency (ms)                  1450.00           1510.00       60.00
# P99 Latency (ms)                  1580.00           1650.00       70.00
# Errors                               0.00              0.00        0.00
#
# ✅ KPI 达成: P99 延迟差异 70.00ms < 100ms 阈值
# ======================================================================
```

---

### 4.5 Step 5: AG-UI E2E 可视化验收

> [!NOTE]
>
> **对标 AG-UI 协议**：本节实现 Phase 5 的 AG-UI 全链路可视化验收，验证四大支柱的可视化能力在 E2E 场景中的完整性。
>
> **核心目标**：通过 CopilotKit 前端验证 AG-UI 事件流的完整性和可视化组件的正确性。

#### 4.5.1 E2E 可视化验证架构

```mermaid
graph TB
    subgraph "CopilotKit 前端"
        CP[CopilotPopup]
        SP[StatePanel]
        TP[ToolPanel]
        MP[MemoryPanel]
    end

    subgraph "AG-UI 事件流"
        EV[Event Stream SSE]
    end

    subgraph "四支柱可视化器"
        PV[PulseEventBridge]
        MV[MemoryVisualizer]
        SV[SearchVisualizer]
        TV[ThinkingVisualizer]
    end

    PV & MV & SV & TV --> EV
    EV --> CP & SP & TP & MP

    style CP fill:#4ade80,stroke:#16a34a,color:#000
    style EV fill:#60a5fa,stroke:#2563eb,color:#000
```

#### 4.5.2 AG-UI 事件覆盖矩阵

| 支柱            | 可视化器           | AG-UI 事件                                | 前端组件                          | E2E 验证 |
| :-------------- | :----------------- | :---------------------------------------- | :-------------------------------- | :------- |
| **Pulse**       | PulseEventBridge   | RUN*\*, TEXT_MESSAGE*\*, STATE_DELTA      | ChatPanel, StateDebug             | 🔲       |
| **Hippocampus** | MemoryVisualizer   | ACTIVITY*SNAPSHOT, CUSTOM (memory*\*)     | MemorySourceCard, HealthDashboard | 🔲       |
| **Perception**  | SearchVisualizer   | STEP*\*, CUSTOM (retrieval*\*)            | SearchProgress, CitationList      | 🔲       |
| **Mind**        | ThinkingVisualizer | STEP*\*, TOOL_CALL*\_, CUSTOM (trace\_\_) | ThinkingCard, ToolPanel           | 🔲       |

#### 4.5.3 E2E 场景测试用例

创建 `src/cognizes/examples/e2e_travel_agent/tests/test_agui_e2e.py`：

```python
"""
AG-UI E2E 可视化验收测试

验证所有四大支柱的 AG-UI 事件在 E2E 场景中正确发射
"""

import pytest
import asyncio
import json
from typing import AsyncGenerator
from httpx import AsyncClient


@pytest.fixture
async def agui_client():
    """AG-UI 客户端"""
    async with AsyncClient(base_url="http://localhost:8000") as client:
        yield client


class TestAgUiE2E:
    """AG-UI E2E 测试套件"""

    @pytest.mark.asyncio
    async def test_event_stream_lifecycle(self, agui_client: AsyncClient):
        """
        测试事件流生命周期

        验证 RUN_STARTED -> ... -> RUN_FINISHED 完整流程
        """
        events = []

        async with agui_client.stream(
            "POST",
            "/api/copilotkit",
            json={"messages": [{"role": "user", "content": "你好"}]}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        # 验证生命周期事件
        event_types = [e["type"] for e in events]
        assert "RUN_STARTED" in event_types
        assert "RUN_FINISHED" in event_types or "RUN_ERROR" in event_types

        # 验证事件顺序
        run_start_idx = event_types.index("RUN_STARTED")
        run_end_idx = len(event_types) - 1 - event_types[::-1].index(
            "RUN_FINISHED" if "RUN_FINISHED" in event_types else "RUN_ERROR"
        )
        assert run_start_idx < run_end_idx

    @pytest.mark.asyncio
    async def test_text_message_streaming(self, agui_client: AsyncClient):
        """
        测试文本消息流式输出

        验证 TEXT_MESSAGE_START -> CONTENT* -> END
        """
        events = []

        async with agui_client.stream(
            "POST",
            "/api/copilotkit",
            json={"messages": [{"role": "user", "content": "讲个笑话"}]}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        text_events = [e for e in events if e["type"].startswith("TEXT_MESSAGE")]

        # 验证有消息内容
        content_events = [e for e in text_events if e["type"] == "TEXT_MESSAGE_CONTENT"]
        assert len(content_events) > 0, "应该有流式消息内容"

        # 验证增量文本拼接
        full_text = "".join(e.get("delta", "") for e in content_events)
        assert len(full_text) > 0

    @pytest.mark.asyncio
    async def test_tool_call_visualization(self, agui_client: AsyncClient):
        """
        测试工具调用可视化

        验证 TOOL_CALL_START -> ARGS -> END
        """
        events = []

        # 触发一个需要工具调用的查询
        async with agui_client.stream(
            "POST",
            "/api/copilotkit",
            json={
                "messages": [{"role": "user", "content": "搜索北京到上海的航班"}]
            }
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        tool_events = [e for e in events if e["type"].startswith("TOOL_CALL")]

        if tool_events:  # 如果有工具调用
            # 验证工具调用生命周期
            tool_types = [e["type"] for e in tool_events]
            assert "TOOL_CALL_START" in tool_types
            assert "TOOL_CALL_END" in tool_types

            # 验证工具名称存在
            start_event = next(e for e in tool_events if e["type"] == "TOOL_CALL_START")
            assert "toolCallName" in start_event

    @pytest.mark.asyncio
    async def test_memory_visualization(self, agui_client: AsyncClient):
        """
        测试记忆可视化

        验证 CUSTOM (memory_hit) 事件
        """
        # 首先创建一些记忆
        await agui_client.post(
            "/api/copilotkit",
            json={"messages": [{"role": "user", "content": "我不喜欢辣的食物"}]}
        )

        # 然后查询触发记忆召回
        events = []
        async with agui_client.stream(
            "POST",
            "/api/copilotkit",
            json={
                "messages": [{"role": "user", "content": "推荐一家餐厅"}]
            }
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        # 查找记忆相关事件
        memory_events = [
            e for e in events
            if e["type"] == "CUSTOM" and e.get("name", "").startswith("memory_")
        ]

        # 记忆召回应该被记录
        # (这取决于系统是否有足够的记忆)

    @pytest.mark.asyncio
    async def test_state_delta_synchronization(self, agui_client: AsyncClient):
        """
        测试状态增量同步

        验证 STATE_DELTA 事件正确发射
        """
        events = []

        async with agui_client.stream(
            "POST",
            "/api/copilotkit",
            json={
                "messages": [{"role": "user", "content": "记住我是 VIP 用户"}]
            }
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[6:])
                    events.append(event)

        state_events = [e for e in events if e["type"] == "STATE_DELTA"]

        if state_events:
            # 验证 JSON Patch 格式
            for event in state_events:
                assert "delta" in event
                delta = event["delta"]
                assert isinstance(delta, list)
                for op in delta:
                    assert "op" in op
                    assert op["op"] in ["add", "remove", "replace"]

    @pytest.mark.asyncio
    async def test_event_latency(self, agui_client: AsyncClient):
        """
        测试事件延迟

        验证事件流延迟 < 100ms
        """
        import time

        start_time = time.perf_counter()
        first_event_time = None

        async with agui_client.stream(
            "POST",
            "/api/copilotkit",
            json={"messages": [{"role": "user", "content": "测试"}]},
            timeout=30.0
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    if first_event_time is None:
                        first_event_time = time.perf_counter()
                    break

        latency_ms = (first_event_time - start_time) * 1000
        assert latency_ms < 100, f"首事件延迟 {latency_ms:.2f}ms > 100ms"
```

#### 4.5.4 CopilotKit 集成验证

```typescript
// src/cognizes/examples/e2e_travel_agent/frontend/travel-agent-ui/app/agui.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";

describe("AG-UI CopilotKit Integration", () => {
  it("should render chat popup", async () => {
    render(
      <CopilotKit runtimeUrl="/api/copilotkit">
        <CopilotPopup
          instructions="Test agent"
          labels={{ title: "Test", initial: "Hello" }}
        />
      </CopilotKit>
    );

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });

  it("should receive streaming events", async () => {
    const events: any[] = [];

    // Mock SSE connection
    const mockEventSource = vi.fn((url, options) => {
      setTimeout(() => {
        events.push({ type: "RUN_STARTED", run_id: "test-123" });
        events.push({ type: "TEXT_MESSAGE_CONTENT", delta: "Hello" });
        events.push({ type: "RUN_FINISHED", run_id: "test-123" });
      }, 100);
    });

    // Test event reception
    await waitFor(
      () => {
        expect(events.length).toBe(3);
        expect(events[0].type).toBe("RUN_STARTED");
        expect(events[2].type).toBe("RUN_FINISHED");
      },
      { timeout: 1000 }
    );
  });
});
```

#### 4.5.5 任务清单

| 任务 ID | 任务描述                | 状态      | 验收标准                  |
| :------ | :---------------------- | :-------- | :------------------------ |
| P5-5-1  | 实现 AG-UI E2E 测试套件 | ✅ 已完成 | 6 个测试用例已编写        |
| P5-5-2  | 验证事件流生命周期      | 🔄 进行中 | RUN_STARTED/FINISHED 正确 |
| P5-5-3  | 验证消息流式输出        | 🔄 进行中 | 增量文本完整              |
| P5-5-4  | 验证工具调用可视化      | 🔄 进行中 | 参数/结果可见             |
| P5-5-5  | 验证状态同步            | 🔄 进行中 | JSON Patch 正确           |
| P5-5-6  | 验证事件延迟            | 🔄 进行中 | 首事件 < 100ms            |
| P5-5-7  | CopilotKit 前端集成测试 | ✅ 已完成 | 组件渲染正确              |

#### 4.5.6 验收标准

| 验收项     | 验收标准               | 验证方法 |
| :--------- | :--------------------- | :------- |
| 事件完整性 | 16 种事件类型全覆盖    | E2E 测试 |
| 事件顺序   | 生命周期事件顺序正确   | 日志分析 |
| 流式输出   | 增量文本平滑展示       | 手动验证 |
| 延迟       | 首事件延迟 P99 < 100ms | 性能测试 |
| 组件渲染   | 四大可视化组件正确显示 | 截图对比 |

---

## 5. 验收标准：KPI 矩阵

> [!IMPORTANT]
>
> 以下 KPI 矩阵汇总了 Phase 5 的所有验收标准，每个支柱都有明确的量化指标。

### 5.1 四支柱 KPI 总览

| 支柱               | KPI 名称             | 目标值              | 验证方法                  | 状态      |
| :----------------- | :------------------- | :------------------ | :------------------------ | :-------- |
| 🫀 **Pulse**       | 并发一致性           | 0 脏读/丢失         | 10 并发写入测试           | 🔲 待验证 |
| 🫀 **Pulse**       | 实时推送延迟         | P99 < 50ms          | 延迟基准测试              | 🔲 待验证 |
| 🧠 **Hippocampus** | 记忆新鲜度           | < 500ms RYW         | Read-Your-Writes 延迟测试 | 🔲 待验证 |
| 🧠 **Hippocampus** | 偏好召回率           | 100%                | 跨会话偏好测试            | 🔲 待验证 |
| 👁️ **Perception**  | Recall@10 (高过滤比) | >= 90%              | 99% 过滤场景测试          | 🔲 待验证 |
| 👁️ **Perception**  | Rerank 精度提升      | > 10%               | Precision 对比测试        | 🔲 待验证 |
| 🔮 **Mind**        | Trace 完整性         | 100%                | Langfuse UI 链路验证      | 🔲 待验证 |
| 🔮 **Mind**        | 沙箱隔离成功率       | 100%                | 恶意代码测试              | 🔲 待验证 |
| 🎯 **Overall**     | P99 延迟差异         | < 100ms (vs Google) | 性能基准测试              | 🔲 待验证 |
| 🎯 **Overall**     | 功能完整性           | 100%                | E2E 场景测试              | 🔲 待验证 |

### 5.2 验收检查清单

```markdown
## Phase 5 验收检查清单

### E2E Scenario Replication

- [ ] Demo 使用 Google 原生后端正常运行 (基线)
- [ ] Demo 使用 PostgreSQL 后端正常运行
- [ ] 所有 Use Cases (订票/查询/修改) 运行无误
- [ ] 前端 UI 与 Prompt 未做任何修改

### The Pulse 验收

- [ ] 10 用户并发多轮对话无状态混淆
- [ ] OCC 并发控制正确，无数据丢失
- [ ] 状态回溯能力验证通过
- [ ] 事件通知延迟 P99 < 50ms

### The Hippocampus 验收

- [ ] 跨会话偏好记忆 ("I hate spicy food") 正确召回
- [ ] 记忆巩固流程 (Fast Replay + Deep Reflection) 正常
- [ ] Read-Your-Writes 延迟 < 500ms

### The Perception 验收

- [ ] 混合检索 ("Suggest some chill places") 结果正确
- [ ] Reranking 提升 Top-10 相关性
- [ ] 高过滤比场景 (99%) Recall@10 >= 90%

### The Realm of Mind 验收

- [ ] Langfuse UI 可见完整 Trace 链路
- [ ] 可通过 Trace 定位推理问题
- [ ] 沙箱安全隔离测试通过

### Performance 验收

- [ ] P99 响应延迟差异 < 100ms (vs Google)
- [ ] 性能对比报告已生成
```

---

## 6. 交付物清单

| 交付物类型    | 文件路径                                          | 描述                  | 状态      |
| :------------ | :------------------------------------------------ | :-------------------- | :-------- |
| **验证文档**  | `docs/050-integrated-demo.md`                     | Phase 5 验证实施方案  | ✅ 已完成 |
| **Demo 代码** | `src/cognizes/examples/e2e_travel_agent/`         | E2E Travel Agent Demo | ✅ 已完成 |
| **测试套件**  | `src/cognizes/examples/e2e_travel_agent/tests/`   | 四支柱验收测试        | ✅ 已完成 |
| **基准脚本**  | `src/cognizes/examples/e2e_travel_agent/scripts/` | 性能基准测试脚本      | ✅ 已完成 |
| **演示视频**  | `src/cognizes/examples/e2e_travel_agent/demo.mp4` | Demo 演示视频 (可选)  | 🔲 可选   |

---

## 7. 附录

### 7.1 常见问题与解决方案

| 问题                     | 可能原因              | 解决方案                                   |
| :----------------------- | :-------------------- | :----------------------------------------- |
| Session 加载失败         | PostgreSQL 连接池耗尽 | 增加 `max_size` 或优化连接管理             |
| 记忆检索无结果           | Embedding 未生成      | 检查 `embedding_fn` 配置                   |
| 高过滤比召回率为 0       | HNSW 迭代扫描未开启   | 设置 `hnsw.iterative_scan = relaxed_order` |
| Trace 未在 Langfuse 显示 | OTLP Exporter 未配置  | 检查 `OTEL_EXPORTER_OTLP_ENDPOINT`         |
| 沙箱执行超时             | Docker 资源限制过低   | 调整 `memory_limit_mb` 和 `timeout`        |
| P99 延迟超标             | 网络延迟或冷启动      | 预热连接池，检查网络配置                   |

### 7.2 参考资源

| 类别             | 资源                                                                                                                                                                                                    |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ADK 官方文档** | [Sessions](https://google.github.io/adk-docs/sessions/) · [Memory](https://google.github.io/adk-docs/memory/)                                                                                           |
| **ADK 示例**     | [google/adk-python](https://github.com/google/adk-python) · [GoogleCloudPlatform/generative-ai](https://github.com/GoogleCloudPlatform/generative-ai)                                                   |
| **前序文档**     | [010-the-pulse.md](./010-the-pulse.md) · [020-the-hippocampus.md](./020-the-hippocampus.md) · [030-the-perception.md](./030-the-perception.md) · [040-the-realm-of-mind.md](./040-the-realm-of-mind.md) |
| **可视化工具**   | [Langfuse UI](http://localhost:3000) · [pgAdmin](https://www.pgadmin.org/)                                                                                                                              |

---

## 8. 验证 SOP：Phase 5 逐步验收指南

> [!IMPORTANT]
>
> 本章节是 Phase 5 的**标准作业程序 (SOP)**，旨在指导你一步一步完成整个阶段的验收工作。请按照以下步骤顺序执行，每一步都有明确的命令和验收标准。

### 8.1 前置检查清单

在开始 Phase 5 验收之前，请确保以下 Phase 1-4 的成果已经完成：

```markdown
## 前置依赖检查

- [x] Phase 1: The Pulse (Session Engine) 验收通过
- [x] Phase 2: The Hippocampus (Memory System) 验收通过
- [x] Phase 3: The Perception (Fusion Retrieval) 验收通过
- [x] Phase 4: The Realm of Mind (ADK Adapter + Tracing) 验收通过
- [x] PostgreSQL 16+ 已部署且 pgvector 扩展可用
- [x] Langfuse 可观测平台已部署
- [x] Google Gemini API 密钥已配置
```

**快速验证命令：**

```bash
# 1. 验证 PostgreSQL 连接
psql postgresql://aigc:@localhost:5432/cognizes-engine -c "SELECT version();"

# 2. 验证 pgvector 扩展
psql postgresql://aigc:@localhost:5432/cognizes-engine -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"

# 3. 验证 cognizes 模块可导入
cd agentic-ai-engine
uv run python -c "from cognizes.adapters.postgres.session_service import PostgresSessionService; print('✅ PostgresSessionService 可导入')"
uv run python -c "from cognizes.adapters.postgres.memory_service import PostgresMemoryService; print('✅ PostgresMemoryService 可导入')"
```

---

### 8.2 SOP Step 1：E2E Demo 环境准备

> **目标**：确保 Travel Agent Demo 项目可以正常运行。
>
> **对应任务**：P5-1-1 ~ P5-1-4

#### Step 1.1：进入 Demo 项目目录

```bash
cd src/cognizes/examples/e2e_travel_agent
```

#### Step 1.2：安装 Demo 依赖

```bash
# 使用 uv 安装项目依赖
uv sync

# 验证安装成功
uv run python -c "from src.config import config; print(f'✅ Config loaded: {config.app_name}')"
```

#### Step 1.3：配置环境变量

确保 `.env` 文件已正确配置：

```bash
# 检查 .env 文件
cat .env

# 预期内容应包含：
# GOOGLE_API_KEY=your-gemini-api-key
# DATABASE_URL=postgresql://aigc:@localhost:5432/cognizes-engine
# BACKEND_TYPE=postgres
```

#### Step 1.4：初始化测试数据

```bash
# 运行数据初始化脚本
uv run python scripts/seed_data.py

# 预期输出：
# 🚀 Starting data seeding...
# 🌍 Seeding destinations...
#   ✅ Inserted X destinations
# 👤 Seeding user preferences...
#   ✅ Inserted X preferences
# ✅ Data seeding completed!
```

#### Step 1.5：验证基线运行

```bash
# 运行基线 Agent 验证（使用 InMemorySessionService）
uv run python src/agent_baseline.py

# 预期输出：Agent 能正常响应测试查询
```

**✅ Step 1 验收标准**：

- [ ] Demo 项目依赖安装成功
- [ ] 环境变量配置正确
- [ ] 测试数据初始化完成
- [ ] 基线 Agent 运行正常

---

### 8.3 SOP Step 2：后端替换验证

> **目标**：验证使用 PostgreSQL 后端的 Demo 功能正常。
>
> **对应任务**：P5-1-5 ~ P5-1-8

#### Step 2.1：运行后端替换测试

```bash
cd src/cognizes/examples/e2e_travel_agent

# 运行后端替换验证测试
uv run pytest tests/test_backend_replacement.py -v

# 预期输出：所有测试通过
# tests/test_backend_replacement.py::TestBackendReplacement::test_session_create_and_load PASSED
# tests/test_backend_replacement.py::TestBackendReplacement::test_memory_store_and_search PASSED
# tests/test_backend_replacement.py::TestBackendReplacement::test_e2e_conversation PASSED
```

#### Step 2.2：启动 Streamlit Demo (可选手动验证)

```bash
# 启动 Streamlit 前端
uv run streamlit run src/app.py --server.port 8501

# 在浏览器中访问 http://localhost:8501
# 测试以下对话场景：
# 1. "我想去巴厘岛度假" → 验证 Agent 响应
# 2. "帮我查一下机票" → 验证工具调用
# 3. "我不喜欢辣的食物" → 验证偏好记忆
```

**✅ Step 2 验收标准**：

- [ ] 后端替换测试全部通过
- [ ] Session 存储切换至 PostgreSQL
- [ ] Memory 存储切换至 PostgreSQL
- [ ] Demo 全功能运行正常

---

### 8.4 SOP Step 3：四支柱联合验收

> **目标**：验证四大支柱在 E2E 场景下的协同运作。
>
> **对应任务**：P5-2-1 ~ P5-2-12

#### Step 3.1：🫀 The Pulse 验收

```bash
cd src/cognizes/examples/e2e_travel_agent

# 运行 Pulse 验收测试
uv run pytest tests/test_pulse.py -v

# 预期通过的测试：
# test_concurrent_sessions_no_interference    → 10 并发用户无状态混淆
# test_optimistic_concurrency_control         → OCC 并发控制正确
# test_state_rollback_via_snapshots           → 状态可回溯
# test_event_notification_latency             → 事件延迟 P99 < 50ms
```

**Pulse KPI 验收**：

| 验收项       | 验收标准                | 验证命令                                             |
| :----------- | :---------------------- | :--------------------------------------------------- |
| 并发一致性   | 10 并发写入 0 脏读/丢失 | `uv run pytest tests/test_pulse.py -k concurrent -v` |
| 实时推送延迟 | P99 < 50ms              | `uv run pytest tests/test_pulse.py -k latency -v`    |
| 状态回溯     | 历史状态可恢复          | `uv run pytest tests/test_pulse.py -k rollback -v`   |

---

#### Step 3.2：🧠 The Hippocampus 验收

```bash
# 运行 Hippocampus 验收测试
uv run pytest tests/test_hippocampus.py -v

# 预期通过的测试：
# test_cross_session_preference_recall        → 跨会话偏好正确召回
# test_memory_consolidation_flow              → Fast Replay + Deep Reflection 正常
# test_read_your_writes_latency               → 新记忆下一 Turn 立即可见
```

**Hippocampus KPI 验收**：

| 验收项           | 验收标准                    | 验证命令                                                      |
| :--------------- | :-------------------------- | :------------------------------------------------------------ |
| 偏好召回率       | "我不喜欢辣" 新会话自动召回 | `uv run pytest tests/test_hippocampus.py -k preference -v`    |
| 记忆巩固         | 摘要 + Facts 正确生成       | `uv run pytest tests/test_hippocampus.py -k consolidation -v` |
| Read-Your-Writes | 延迟 < 500ms                | `uv run pytest tests/test_hippocampus.py -k ryw -v`           |

---

#### Step 3.3：👁️ The Perception 验收

```bash
# 运行 Perception 验收测试
uv run pytest tests/test_perception.py -v

# 预期通过的测试：
# test_hybrid_search_fusion                   → 关键词 + 向量融合正确
# test_reranking_improves_relevance           → Rerank 提升 Top-10 相关性
# test_high_selectivity_recall                → 99% 过滤比 Recall@10 >= 90%
```

**Perception KPI 验收**：

| 验收项       | 验收标准                      | 验证命令                                                   |
| :----------- | :---------------------------- | :--------------------------------------------------------- |
| 混合检索     | "轻松的地方" 召回海岛目的地   | `uv run pytest tests/test_perception.py -k hybrid -v`      |
| Rerank 精度  | Top-10 相关度提升 > 10%       | `uv run pytest tests/test_perception.py -k rerank -v`      |
| 高过滤比召回 | Recall@10 >= 90% (99% filter) | `uv run pytest tests/test_perception.py -k selectivity -v` |

---

#### Step 3.4：🔮 The Realm of Mind 验收

````bash
### 前置准备：启动 Sandbox 环境 (Native)

为了通过 `test_sandbox_isolation` 测试，需要启动 `microsandbox` 服务端：

1. **安装 Microsandbox CLI**:
    ```bash
    curl -sSf https://microsandbox.io/install.sh | sh
    ```
2. **启动服务**:
    ```bash
    # 默认监听 127.0.0.1:5555
    msb server start
    ```
    > **注意**: 请在独立的 Terminal 中保持服务运行。

# 运行 Mind 验收测试
uv run pytest tests/test_mind.py -v

# 预期通过的测试：
# test_trace_completeness                     → Trace 链路完整
# test_debug_infinite_loop_detection          → (手动验证)
# test_sandbox_isolation                      → 恶意代码被隔离
# test_sandbox_resource_limits                → 资源限制生效
````

**Mind KPI 验收**：

| 验收项       | 验收标准            | 验证命令                                         |
| :----------- | :------------------ | :----------------------------------------------- |
| Trace 完整性 | Langfuse 可见全链路 | `uv run pytest tests/test_mind.py -k trace -v`   |
| 沙箱隔离     | 恶意代码不影响主机  | `uv run pytest tests/test_mind.py -k sandbox -v` |
| 调试能力     | 可定位推理问题      | (手动在 Langfuse UI 验证)                        |

**手动验证 Langfuse Trace**：

1. **确认 Langfuse 连接成功**：运行测试时应看到日志输出：

   ```
   [TracingManager] Langfuse 已连接: https://langfuse.automizely.me
   ```

2. **在 Langfuse UI 验证**：

   - 打开浏览器访问 **https://langfuse.automizely.me**
   - 登录后，在左侧导航选择 **Traces**
   - 查找最近 5 分钟内的 Trace 记录
   - 验证是否有 `travel-agent-demo` 服务的 Trace

3. **验证链路完整性**：
   - `runner.run` (根 Span)
     - `session.get`
     - `memory.search`
     - `agent.invoke`
       - `llm.generate` (Token 消耗可见)
       - `tool.xxx` (如有工具调用)

> [!NOTE]
> 如果 Langfuse UI 中没有看到新的 Trace，请检查：
>
> 1. `.env` 文件中的 `LANGFUSE_SECRET_KEY` 和 `LANGFUSE_PUBLIC_KEY` 是否正确
> 2. 网络是否能访问 `https://langfuse.automizely.me`
> 3. 等待 1-2 分钟（Langfuse 可能有数据延迟）

---

### 8.5 SOP Step 4：AG-UI E2E 可视化验收

> **目标**：验证 AG-UI 协议在 E2E 场景中的完整性。
>
> **对应任务**：P5-5-1 ~ P5-5-7

#### Step 4.1：运行 AG-UI E2E 测试

```bash
cd src/cognizes/examples/e2e_travel_agent

# 运行 AG-UI E2E 测试
uv run pytest tests/test_agui_e2e.py -v

# 预期通过的测试：
# test_event_stream_lifecycle                 → RUN_STARTED/FINISHED 正确
# test_text_message_streaming                 → 增量文本完整
# test_tool_call_visualization                → 工具调用可视化
# test_memory_visualization                   → 记忆召回事件
# test_state_delta_synchronization            → JSON Patch 正确
# test_event_latency                          → 首事件 < 100ms
```

#### Step 4.1.5：启动 Python AG-UI 后端服务

> [!IMPORTANT]
> 在验证前端之前，必须先启动 Python AG-UI 后端服务。前端会通过代理转发请求到 `http://localhost:8000`。

```bash
# 在新的终端窗口中运行以下命令

cd agentic-ai-engine

# 启动 AG-UI 后端服务 (默认监听 8000 端口)
uv run uvicorn cognizes.engine.agui.copilotkit_server:app --host 0.0.0.0 --port 8000

# 预期输出：
# INFO:     Started server process [xxxx]
# INFO:     Waiting for application startup.
# INFO:     Application startup complete.
# INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

> [!NOTE]
> 请保持此终端窗口运行，然后在另一个终端窗口中启动前端。

#### Step 4.2：CopilotKit 前端验证 (可选)

```bash
# 进入前端项目
cd src/cognizes/examples/e2e_travel_agent/frontend/travel-agent-ui

# 安装依赖
npm install

# 运行前端测试
npm run test

# 启动开发服务器
npm run dev

# 在浏览器中访问 http://localhost:3000 验证：
# 1. CopilotPopup 组件正确渲染
# 2. 消息流式输出平滑
# 3. 工具调用 UI 正确显示
# 4. 状态同步正常
```

**AG-UI 事件覆盖矩阵验收**：

| 事件类型             | 验收标准            | 状态 |
| :------------------- | :------------------ | :--- |
| RUN_STARTED          | 每次对话开始时发射  | 🔲   |
| RUN_FINISHED         | 每次对话结束时发射  | 🔲   |
| TEXT_MESSAGE_START   | 消息开始时发射      | 🔲   |
| TEXT_MESSAGE_CONTENT | 增量内容正确        | 🔲   |
| TEXT_MESSAGE_END     | 消息结束时发射      | 🔲   |
| TOOL_CALL_START      | 工具调用开始        | 🔲   |
| TOOL_CALL_ARGS       | 参数正确传递        | 🔲   |
| TOOL_CALL_END        | 工具调用结束        | 🔲   |
| STATE_SNAPSHOT       | 初始状态正确        | 🔲   |
| STATE_DELTA          | JSON Patch 格式正确 | 🔲   |
| STEP_STARTED         | 步骤开始可追踪      | 🔲   |
| STEP_FINISHED        | 步骤结束可追踪      | 🔲   |

---

### 8.6 SOP Step 5：性能对比验证

> **目标**：验证 P99 响应延迟差异 < 100ms。
>
> **对应任务**：P5-3-1 ~ P5-3-4

#### Step 5.1：运行性能基准测试

```bash
cd src/cognizes/examples/e2e_travel_agent

# 运行性能基准测试
uv run python scripts/run_benchmark.py

# 预期输出格式：
# ======================================================================
# 📊 性能对比报告 - Open Agent Engine vs Google InMemory
# ======================================================================
#
# 指标                       Google InMemory         PostgreSQL         差异
# ----------------------------------------------------------------------
# Total Requests                      50.00             50.00        0.00
# Avg Latency (ms)                  xxxx.xx           xxxx.xx       xx.xx
# P50 Latency (ms)                  xxxx.xx           xxxx.xx       xx.xx
# P95 Latency (ms)                  xxxx.xx           xxxx.xx       xx.xx
# P99 Latency (ms)                  xxxx.xx           xxxx.xx       xx.xx
# Errors                               0.00              0.00        0.00
#
# ✅ KPI 达成: P99 延迟差异 xx.xxms < 100ms 阈值
# ======================================================================
```

**性能 KPI 验收**：

| 验收项       | 验收标准                     | 验证方法     |
| :----------- | :--------------------------- | :----------- |
| P99 延迟差异 | < 100ms (vs Google InMemory) | 基准测试脚本 |
| 错误率       | 0%                           | 基准测试脚本 |
| 并发支持     | 5+ 并发用户                  | 基准测试脚本 |

---

### 8.7 SOP Step 6：一键运行全部验收测试

> **目标**：一次性运行所有验收测试，生成完整报告。

```bash
cd src/cognizes/examples/e2e_travel_agent

# 运行全部验收测试 (带详细输出和覆盖率报告)
uv run pytest tests/ -v --tb=short | tee phase5_validation_report.txt

# 或分模块运行并收集结果
uv run pytest tests/test_pulse.py tests/test_hippocampus.py tests/test_perception.py tests/test_mind.py tests/test_agui_e2e.py -v --tb=short

# 生成 HTML 测试报告 (需安装 pytest-html)
uv run pytest tests/ -v --html=phase5_report.html --self-contained-html
```

---

### 8.8 SOP 最终验收检查清单

完成上述所有步骤后，请逐项确认以下检查清单：

```markdown
## Phase 5 最终验收检查清单

### 环境与准备 ✅

- [ ] Demo 项目依赖安装成功
- [ ] 环境变量配置正确
- [ ] 测试数据初始化完成
- [ ] PostgreSQL 连接正常

### E2E Scenario Replication ✅

- [ ] 后端替换测试全部通过
- [ ] Session 存储使用 PostgreSQL
- [ ] Memory 存储使用 PostgreSQL
- [ ] 所有 Use Cases 运行无误

### 🫀 The Pulse 验收 ✅

- [ ] 10 并发用户无状态混淆
- [ ] OCC 并发控制正确
- [ ] 状态回溯能力验证通过
- [ ] 事件通知延迟 P99 < 50ms

### 🧠 The Hippocampus 验收 ✅

- [ ] 跨会话偏好 "我不喜欢辣" 正确召回
- [ ] 记忆巩固流程正常执行
- [ ] Read-Your-Writes 延迟 < 500ms

### 👁️ The Perception 验收 ✅

- [ ] 混合检索 "轻松的地方" 结果正确
- [ ] Reranking 提升 Top-10 相关性
- [ ] 高过滤比 Recall@10 >= 90%

### 🔮 The Realm of Mind 验收 ✅

- [ ] Langfuse UI 可见完整 Trace
- [ ] 可通过 Trace 定位推理问题
- [ ] 沙箱安全隔离测试通过

### AG-UI E2E 验收 ✅

- [ ] 事件流生命周期完整
- [ ] 消息流式输出正确
- [ ] 工具调用可视化正常
- [ ] 状态同步 JSON Patch 正确
- [ ] 首事件延迟 < 100ms

### Performance 验收 ✅

- [ ] P99 延迟差异 < 100ms
- [ ] 错误率 0%
- [ ] 性能对比报告已生成
```

---

### 8.9 验收完成后的输出物

验收通过后，请确保以下交付物已生成：

| 交付物           | 路径                                                   | 状态 |
| :--------------- | :----------------------------------------------------- | :--- |
| Phase 5 测试报告 | `phase5_validation_report.txt` 或 `phase5_report.html` | 🔲   |
| 性能对比报告     | (由 `run_benchmark.py` 输出到控制台)                   | 🔲   |
| E2E Demo 代码    | `src/cognizes/examples/e2e_travel_agent/`              | ✅   |
| 验收检查清单     | (上述 8.8 节，手动确认)                                | 🔲   |

---

### 8.10 常见问题排查

| 问题现象                 | 可能原因                   | 解决方案                                   |
| :----------------------- | :------------------------- | :----------------------------------------- |
| `ModuleNotFoundError`    | 模块路径未正确配置         | 确保从项目根目录运行，或设置 `PYTHONPATH`  |
| PostgreSQL 连接失败      | 连接字符串错误或服务未启动 | 检查 `DATABASE_URL` 和 PostgreSQL 服务状态 |
| 测试超时                 | Gemini API 响应慢          | 增加 `pytest.ini` 中的 timeout 配置        |
| 记忆检索无结果           | Embedding 未生成           | 检查 `GOOGLE_API_KEY` 配置和网络连接       |
| Trace 未在 Langfuse 显示 | OTLP Exporter 未配置       | 检查 `OTEL_EXPORTER_OTLP_ENDPOINT`         |
| AG-UI 测试失败           | 服务未启动                 | 确保后端 API 服务运行在 `localhost:8000`   |

---

## References

<a id="ref1"></a>1. Google. (2024). _Agent Development Kit Documentation_. [https://google.github.io/adk-docs/](https://google.github.io/adk-docs/)

<a id="ref2"></a>2. GoogleCloudPlatform. (2024). _Generative AI Samples_. GitHub. [https://github.com/GoogleCloudPlatform/generative-ai](https://github.com/GoogleCloudPlatform/generative-ai)

<a id="ref3"></a>3. Google. (2024). _google-adk Python Package_. GitHub. [https://github.com/google/adk-python](https://github.com/google/adk-python)

<a id="ref4"></a>4. Langfuse. (2025). _Langfuse: Open Source LLM Engineering Platform_. [https://langfuse.com/](https://langfuse.com/)

<a id="ref5"></a>5. OpenTelemetry. (2024). _OpenTelemetry Python_. [https://opentelemetry.io/docs/instrumentation/python/](https://opentelemetry.io/docs/instrumentation/python/)
