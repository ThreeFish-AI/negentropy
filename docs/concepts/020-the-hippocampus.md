---
id: the-hippocampus-implementation
sidebar_position: 2.0
title: Phase 2：The Hippocampus 验证实施方案
last_update:
  author: Aurelius Huang
  created_at: 2026-01-08
  updated_at: 2026-01-12
  version: 1.1
  status: Pending Review
tags:
  - The Hippocampus
  - Memory System
  - Implementation Plan
  - PostgreSQL
  - Zero-ETL
---

> [!NOTE]
>
> **文档定位**：本文档是 [000-roadmap.md](./000-roadmap.md) Phase 2 的详细工程实施方案，用于指导「**The Hippocampus (仿生记忆)**」的完整落地验证工作。涵盖技术调研、架构设计、代码实现、测试验证等全流程。
>
> **前置依赖**：本阶段依赖 [010-the-pulse.md](./010-the-pulse.md) Phase 1 的完成，需复用其统一存储基座 (Unified Schema) 和会话管理能力。

---

## 1. 执行摘要

### 1.1 定位与目标 (Phase 2)

**Phase 2: The Hippocampus** 是整个验证计划的记忆核心阶段，对标人类大脑的**海马体 (Hippocampus)** —— 负责将短期记忆转化为长期记忆的关键脑区。核心目标是：

1. **实现 Zero-ETL 记忆架构**：摒弃传统 `Redis (App)` + `VectorDB (Mem)` 的割裂架构，Session Log 与 Semantic Memory 同库存储
2. **验证记忆巩固机制**：实现从 Short-term 到 Long-term 的无缝流转（Fast Replay + Deep Reflection）
3. **验证生物遗忘机制**：实现艾宾浩斯衰减算法，自动清理低价值记忆
4. **验证 Context Budgeting**：实现动态上下文组装，精准控制 Token 预算

```mermaid
graph LR
    subgraph "Phase 2: The Hippocampus"
        F[Phase 1 基座<br>Session Engine] --> H1[Memory Consolidation<br>记忆巩固]
        F --> H2[Biological Retention<br>遗忘与保持]
        F --> H3[Context Budgeting<br>上下文预算]
    end

    H1 & H2 & H3 --> V[Verification<br>验收通过]
    V --> Phase3[Phase 3: Perception]

    style F fill:#065f46,stroke:#34d399,color:#fff
    style H1 fill:#7c2d12,stroke:#fb923c,color:#fff
    style H2 fill:#7c2d12,stroke:#fb923c,color:#fff
    style H3 fill:#7c2d12,stroke:#fb923c,color:#fff
```

### 1.2 核心认知架构 (Core Cognitive Architecture)

为了构建具备"长期心智"的 Agent，我们参照认知心理学模型，设计了更加体系化的记忆系统。该系统不仅是数据的存储库，更是信息流转与升维的加工厂。

#### 1.2.1 记忆模型：正交的三维视图 (Static View)

我们将长期记忆解耦为三个正交维度，分别解决"经历"、"知识"与"技能"的持久化问题：

| 记忆维度 (Dimension)                  | 认知隐喻 (Metaphor) | 数据形态 (Schema)                               | 核心职能 (Function)                                            | 存储实体       |
| :------------------------------------ | :------------------ | :---------------------------------------------- | :------------------------------------------------------------- | :------------- |
| **Episodic Memory**<br>(情景记忆)     | **"自传体流"**      | **时序片段** + 向量嵌入<br>(Time-Series Chunks) | 记录"发生了什么"。提供连续的交互上下文，维护对话的历史连贯性。 | `memories`     |
| **Semantic Memory**<br>(语义记忆)     | **"概念网络"**      | **结构化事实** + 关系<br>(Structured Facts)     | 记录"是什么"。沉淀用户偏好、画像与世界知识，跨会话复用。       | `facts`        |
| **Procedural Memory**<br>(程序性记忆) | **"肌肉记忆"**      | **指令集** + 版本控制<br>(Instructions)         | 记录"怎么做"。固化 Agent 的行为模式、SOP 与工具使用策略。      | `instructions` |

#### 1.2.2 动态机制：海马体循环 (Dynamic View)

模仿人脑的海马体 (Hippocampus) 功能，我们在系统中引入了**记忆巩固 (Consolidation)** 与**再激活 (Reactivation)** 的动态循环：

```mermaid
graph TB
    subgraph WM_Scope ["Working Memory (工作记忆)"]
        direction TB
        WM[Context Window<br>当前上下文]
    end

    subgraph Processes ["Cognitive Processes (认知)"]
        direction TB
        Encoding(Encoding<br>双重编码)
        Retrieval(Retrieval<br>联想检索)
        Consolidation(Consolidation<br>后台巩固)
        Decay(Decay<br>生物衰减)
    end

    subgraph Hippocampus ["Hippocampus (LTM)"]
        direction TB
        EM[(Episodic<br>情景记忆)]
        SM[(Semantic<br>语义记忆)]
        PM[(Procedural<br>程序性记忆)]
    end

    %% Flows
    Input(User Input) --> WM
    WM -->|实时写入| Encoding
    Encoding -->|存储| Hippocampus

    WM -.->|异步提炼| Consolidation
    Consolidation -->|提取事实| Hippocampus
    Consolidation -->|压缩归档| Hippocampus

    Retrieval -->|注入| WM
    Hippocampus -.->|向量索引| Retrieval
    Hippocampus -.->|定期清理| Decay

    style WM_Scope fill:#065f46,stroke:#34d399,color:#fff
    style Hippocampus fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style Processes fill:#7c2d12,stroke:#fb923c,color:#fff
```

1. **Working Memory (工作记忆)**：作为系统的"前额叶"，接收用户输入并维护当前的上下文窗口 (`Context Window`)。
2. **Hippocampus (海马体/LTM)**：长时记忆的存储中心，由情景 (`Episodic`)、语义 (`Semantic`) 和程序性 (`Procedural`) 三个正交的记忆区组成。
3. **Cognitive Processes (认知过程)**：连接 WM 与 LTM 的动态机制，通过以下四个关键过程维持系统的"新陈代谢"：
   - **Encoding (编码)**：将实时的短期交互转化为可存储的记忆痕迹。
   - **Consolidation (巩固)**：在后台异步运行，将碎片化的对话历史提炼为结构化的事实与知识。
   - **Retrieval (检索)**：基于语义相关性，在需要时将沉睡的长期记忆"再激活"并加载回工作记忆。
   - **Decay (衰减)**：模拟生物遗忘机制，定期清理低价值或长期未被访问的记忆，防止记忆库臃肿。

#### 1.2.3 关键特性 (Key Features)

1. **双重路径 (Dual Pathways)**:
   - **快路径 (Fast Path)**: 实时对话流直接进入工作记忆，保证响应速度。
   - **慢路径 (Slow Path)**: 异步进程在后台进行"反思"与"巩固"，将碎片化对话转化为结构化知识。

2. **联想召回 (Associative Recall)**:
   - 摒弃单纯的关键词匹配，利用 **Embedding Vector** 实现基于语义相似度的模糊召回，模拟"触景生情"的认知体验。

3. **生物性遗忘 (Biological Decay)**:
   - 引入基于 Ebbinghaus 遗忘曲线的 `Retention Score`，让低价值记忆随时间自然消退，保持记忆库的"信噪比"与鲜活性。

### 1.3 执行导图 (Execution Map)

为了确保系统的**正交性 (Orthogonality)** 与**自洽性 (Self-consistency)**，我们将执行计划重构为分层递进的实施路径，确保每一层都在坚实的基础上构建。

#### 1.3.1 任务-文档锚定

我们将工程任务映射到架构的三个正交切面：**基础架构 (Infra)**、**认知过程 (Process)** 与 **服务集成 (Service)**。

> [!NOTE]
>
> **版本对照**：本计划属于 **Engine Roadmap (Phase 2)**，对应 **Project Roadmap ([002-task-checklist](../002-task-checklist.md))** 中的 **Phase 3 (T3.3 记忆持久化)**。

| 架构切面 (Layer)                  | 核心组件 (Component)               | 关键职责 (Responsibility)                                                           | 对应任务集 (Engine)                                                           | 对应任务集 (Project)                                 |
| :-------------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :--------------------------------------------------- |
| **L0: Foundation**<br>静态存储层  | **Unified Schema**<br>Repositories | 定义记忆的三维形态 (`Episodic`, `Semantic`, `Procedural`) 及其持久化接口。          | **P2-2 (Part)**<br>- Schema Definition<br>- Repository Implementation         | **T3.3.1 - T3.3.3**<br>- 短期/长期/情景记忆存储      |
| **L1: Inflow**<br>动态生成层      | **Consolidation Worker**           | 实现记忆的**双重编码**：<br>- Fast Replay (摘要)<br>- Deep Reflection (事实提取)    | **P2-2 (Main)**<br>- Worker Skeleton<br>- Prompt Engineering<br>- Async Queue | **T3.3.7**<br>- 记忆固化机制                         |
| **L2: Lifecycle**<br>动态维护层   | **Retention Manager**              | 实现记忆的**生物周期**：<br>- Ebbinghaus Decay (遗忘)<br>- Context Budgeting (组装) | **P2-3**<br>- Scoring Algorithm<br>- Window Assembly                          | **T3.3.7**<br>- 自动维护与清理                       |
| **L3: Integration**<br>服务适配层 | **Memory Service**                 | 实现与 ADK 的**标准契约**：<br>- Interface Adapter<br>- Hybrid Search               | **P2-4**<br>- ADK Integration<br>- E2E Verification                           | **T3.3.5, T3.3.6**<br>- 记忆管理器<br>- 记忆检索功能 |

#### 1.3.2 工期安排 (2.5 Days)

| 阶段          | 里程碑定义 (Milestone)                   | 关键交付物 (Deliverables)                                             | 预估工期 |
| :------------ | :--------------------------------------- | :-------------------------------------------------------------------- | :------- |
| **Phase 2.1** | **Cognitive Alignment**<br>(认知对齐)    | ✅ 记忆机制调研报告<br>✅ 技术选型对比表                              | 0.25 Day |
| **Phase 2.2** | **Memory Formation**<br>(记忆生成机制)   | ✅ Hippocampus Schema DDL<br>✅ `ConsolidationWorker` (Alpha)         | 1.0 Day  |
| **Phase 2.3** | **Memory Dynamics**<br>(记忆动力学)      | ✅ `retention_score` 算法实现<br>✅ `get_context_window` 存储过程     | 0.5 Day  |
| **Phase 2.4** | **Cortex Integration**<br>(全脑集成验收) | ✅ `PostgresMemoryService` (ADK compliant)<br>✅ 记忆系统验收测试报告 | 0.25 Day |
| **Phase 2.5** | 测试                                     | 测试代码 + 验证文档                                                   | 0.5 Day  |

---

## 2. 核心参考模型：仿生记忆机制

### 2.1 Google ADK

#### 2.1.1 对标分析：Google ADK MemoryService

基于 Google ADK 官方文档<sup>[[3]](#ref3)</sup>，我们将复刻其核心能力，并映射到 PostgreSQL 生态：

| ADK 核心概念      | 定义                          | 我们的复刻实现 (PostgreSQL)                 | 锚定代码                                                                                   |
| :---------------- | :---------------------------- | :------------------------------------------ | :----------------------------------------------------------------------------------------- |
| **MemoryService** | 跨会话的可搜索知识库管理接口  | `PostgresMemoryService`                     | [memory_service.py](file:///src/cognizes/adapters/postgres/memory_service.py)              |
| **Memory**        | 从对话中提取的结构化知识片段  | `memories` 表 (向量)<br>`facts` 表 (结构化) | [schema/hippocampus_schema.sql](file:///src/cognizes/engine/schema/hippocampus_schema.sql) |
| **add_session**   | 将 Session 转化为可搜索的记忆 | `ConsolidationWorker` (异步)                | [consolidation_worker.py](file:///src/cognizes/engine/hippocampus/consolidation_worker.py) |
| **search_memory** | 基于 Query 检索相关记忆       | 混合检索 (Vector + JSONB)                   | `search_memory()`                                                                          |

#### 2.1.2 接口契约 (Interface Contract)

我们遵循 ADK 的 `BaseMemoryService` 标准接口，确保 **Drop-in Compatible**：

```python
class BaseMemoryService(ABC):
    @abstractmethod
    async def add_session_to_memory(self, session: Session) -> None:
        """Trigger: 异步触发记忆巩固 (Inflow)"""
        ...

    @abstractmethod
    async def search_memory(self, *, app_name: str, user_id: str, query: str) -> SearchMemoryResponse:
        """Trigger: 实时检索相关记忆 (Retrieval)"""
        ...
```

#### 2.1.3 工作流参考 (Workflow Reference)

Memory Bank 的核心价值在于将 **写入 (Consolidation)** 与 **读取 (Retrieval)** 解耦：

```mermaid
sequenceDiagram
    participant User
    participant Agent
    participant Session as SessionService
    participant Memory as MemoryService
    participant Worker as ConsolidationWorker

    Note over Agent, Memory: Hot Path (实时响应)
    User->>Agent: 用户消息
    Agent->>Session: append_event()
    Agent->>Memory: search_memory(query)
    Memory-->>Agent: 相关记忆 (Context)
    Agent->>User: 返回回复

    Note over Session, Worker: Background Path (异步巩固)
    Session-)Memory: add_session_to_memory()
    Memory-)Worker: dispatch_job()
    Worker->>Worker: LLM Extraction (Facts/Insights)
    Worker->>Memory: Persist (Vector + Struct)
```

**关键洞察**：

1. **正交性**: 记忆生成 (Worker) 与 记忆使用 (Agent) 互不阻塞。
2. **双向流**: Session 数据流入 Memory，Memory 知识流回 Agent。
3. **白盒化**: 我们将原版黑盒的 Vertex AI 逻辑替换为可观测的 `ConsolidationWorker`。

#### 2.1.4 写入策略 (Writing Strategy)

结合 LangGraph 的设计理念<sup>[[2]](#ref2)</sup>，我们在时序图中明确区分了两种写入路径：

| 路径 (Path)    | 模式 (Mode)  | 对应机制                       | 优势 (Pros)                   | 劣势 (Cons)                |
| :------------- | :----------- | :----------------------------- | :---------------------------- | :------------------------- |
| **Hot Path**   | 同步 (Sync)  | `append_event()` (Session)     | 立即一致性 (Read-Your-Writes) | 增加用户等待延迟           |
| **Background** | 异步 (Async) | `ConsolidationWorker` (Memory) | 高吞吐，不阻塞用户体验        | 存在短暂的"记忆不一致窗口" |

**我们的决策**：

- **Fast Replay**: 作为热路径的补充，通过 Session 快速回溯。
- **Deep Reflection**: **必须异步**。因为 Fact Extraction 需要昂贵的 LLM 推理，绝不能阻塞用户对话。

### 2.2 LangGraph Memory 设计模式

LangGraph 的 Memory 设计为我们提供了重要的**实现参考**<sup>[[2]](#ref2)</sup>。

#### 2.2.1 持久化机制对照

LangGraph 提供两套互补的持久化机制，与我们的实现形成清晰映射：

| LangGraph 机制   | 存储范围    | 对应我们的实现                               | 锚定表/模块                         |
| :--------------- | :---------- | :------------------------------------------- | :---------------------------------- |
| **Checkpointer** | 单个 Thread | Phase 1 短期记忆 (Session State)             | `threads`, `events`                 |
| **Store**        | 跨 Thread   | Phase 2 长期记忆 (Consolidated Memory/Facts) | `memories`, `facts`, `instructions` |

#### 2.2.2 三类记忆的实现参考

LangGraph 的三类记忆在我们的方案中通过**统一的 Repository 接口**实现：

| 记忆类型                  | LangGraph 用途       | 我们的存储表   | Repository 接口                                                                  |
| :------------------------ | :------------------- | :------------- | :------------------------------------------------------------------------------- |
| **Semantic** (语义记忆)   | 用户偏好、Profile    | `facts`        | [FactsRepository](file:///src/cognizes/core/repositories/facts.py)               |
| **Episodic** (情景记忆)   | 对话切片、Few-shot   | `memories`     | [MemoryRepository](file:///src/cognizes/core/repositories/memory.py)             |
| **Procedural** (程序记忆) | Agent 指令、行为规则 | `instructions` | [InstructionsRepository](file:///src/cognizes/core/repositories/instructions.py) |

<details>
<summary>📖 LangGraph 原始代码参考 (点击展开)</summary>

```python
# Semantic Memory: 用户偏好存储
store.put(namespace=(user_id, "preferences"), key="food", value={"likes": ["pizza"], "dislikes": ["spicy"]})

# Episodic Memory: 情景记忆检索
memories = store.search(namespace=(user_id, "episodes"), query="similar task")

# Procedural Memory: Agent 自我进化
store.put(("agent_instructions",), "main", {"instructions": new_instructions})
```

</details>

### 2.3 综合对比分析 (Comparative Analysis)

基于上述调研，我们将取长补短，构建 **The Hippocampus** 引擎：

| 维度         | Google ADK MemoryService       | LangGraph Store                  | Open Memory Engine (我们)        |
| :----------- | :----------------------------- | :------------------------------- | :------------------------------- |
| **存储后端** | Vertex AI Vector Search        | InMemory / Postgres / Redis      | PostgreSQL + PGVector            |
| **记忆类型** | 单一 Memory 类型               | Semantic / Episodic / Procedural | 三种记忆类型 + 统一存储          |
| **写入机制** | 异步 `add_session_to_memory()` | Hot Path / Background 可选       | Fast Replay + Async Worker       |
| **检索方式** | `search_memory()` 向量检索     | `store.search()` 语义检索        | 混合检索 (Vector + JSONB + Time) |
| **巩固策略** | LLM 提取 → 自动向量化          | 应用层控制                       | 两阶段巩固 + 艾宾浩斯衰减        |
| **开放程度** | 黑盒 (依赖 Vertex AI)          | 白盒 (完全可控)                  | 白盒 (PostgreSQL 原生)           |

### 2.4 调研交付物摘要

> [!NOTE]
> 本节汇总任务 **P2-1-1 ~ P2-1-5** 的调研成果。详细的技术分析已在前文展开，此处仅做索引索引与交付确认。

#### 2.4.1 核心交付物索引

| 任务 ID    | 任务描述                         | 交付内容索引                                                 |
| :--------- | :------------------------------- | :----------------------------------------------------------- |
| **P2-1-1** | ADK `MemoryService` 接口分析     | 见 [2.1.2 接口契约](#212-接口契约-interface-contract)        |
| **P2-1-2** | Memory Bank 工作流分析           | 见 [2.1.3 工作流参考](#213-工作流参考-workflow-reference)    |
| **P2-1-3** | LangGraph `Checkpointer` 分析    | 见 [2.2.1 持久化机制对照](#221-持久化机制对照)               |
| **P2-1-4** | LangGraph `Store` 跨 Thread 分析 | 见 [2.2.2 三类记忆的实现参考](#222-三类记忆的实现参考)       |
| **P2-1-5** | 综合对比分析表                   | 见 [2.3 综合对比分析](#23-综合对比分析-comparative-analysis) |

#### 2.4.2 关键技术选型确认

基于上述调研，我们确认以下核心技术栈映射：

| 组件层级         | Google ADK (原版)       | The Hippocampus (我们)          | 选型依据                                     |
| :--------------- | :---------------------- | :------------------------------ | :------------------------------------------- |
| **Vector Store** | Vertex AI Vector Search | **PostgreSQL + PGVector**       | 统一技术栈，减少运维熵增 (Entropy Reduction) |
| **Embedding**    | `textembedding-gecko`   | **Gemini `text-embedding-005`** | 高性能且成本可控                             |
| **Extraction**   | Gemini Pro              | **Gemini 3.0 Flash**            | 更快的推理速度，适合后台批处理               |
| **Index Algo**   | ScaNN                   | **HNSW**                        | PGVector 标配，兼顾召回率与性能              |

---

## 3. 架构设计：Hippocampus Schema 扩展

### 3.1 Schema 扩展设计

在 Phase 1 的 Unified Schema 基础上，新增以下记忆相关表：

```mermaid
erDiagram
    %% Core Relationships
    threads ||--o{ events : contains
    threads ||--o{ consolidation_jobs : triggers

    %% Process Flow: Inflow
    consolidation_jobs ||--o{ memories : generates
    consolidation_jobs ||--o{ facts : extracts
    consolidation_jobs }o..o| instructions : "updates (implicit)"

    %% Data Ownership (FKs)
    threads ||--o{ memories : "source of"
    threads ||--o{ facts : "source of"

    memories {
        uuid id PK "记忆唯一标识"
        uuid thread_id FK "来源会话"
        varchar user_id "用户标识"
        varchar app_name "应用名称"
        varchar memory_type "记忆类型: episodic/semantic"
        text content "记忆内容"
        vector embedding "向量嵌入 (1536维)"
        jsonb metadata "元数据"
        float retention_score "保留分数"
        integer access_count "访问次数"
        timestamp last_accessed_at "最后访问时间"
        timestamp created_at "创建时间"
    }

    facts {
        uuid id PK "事实唯一标识"
        uuid thread_id FK "来源会话"
        varchar user_id "用户标识"
        varchar app_name "应用名称"
        varchar fact_type "事实类型: preference/rule/profile"
        varchar key "事实键"
        jsonb value "事实值"
        vector embedding "向量嵌入"
        float confidence "置信度"
        timestamp valid_from "生效时间"
        timestamp valid_until "失效时间"
        timestamp created_at "创建时间"
    }

    consolidation_jobs {
        uuid id PK "任务唯一标识"
        uuid thread_id FK "目标会话"
        varchar status "状态: pending/running/completed/failed"
        varchar job_type "任务类型: fast_replay/deep_reflection"
        jsonb result "处理结果"
        text error "错误信息"
        timestamp started_at "开始时间"
        timestamp completed_at "完成时间"
        timestamp created_at "创建时间"
    }

    instructions {
        uuid id PK "指令唯一标识"
        varchar app_name "应用名称"
        varchar instruction_key "指令键"
        text content "指令内容"
        integer version "版本号"
        jsonb metadata "元数据"
        timestamp created_at "创建时间"
    }
```

### 3.2 记忆模型职责边界 (Memory Responsibilities)

遵循 **AGENTS.md** 的 **Orthogonal Decomposition (正交分解)** 原则，我们将三种记忆严格映射到三张表中，确保职责互不重叠且自洽。

#### 3.2.1 职责正交矩阵

| 维度         | **memories** (情景流)            | **facts** (事实态)                        | **instructions** (行为规)      |
| :----------- | :------------------------------- | :---------------------------------------- | :----------------------------- |
| **核心职责** | **Store Experience** (经历)      | **Store Knowledge** (知识)                | **Store Behavior** (行为)      |
| **数据形态** | **Unstructured Text** (非结构化) | **Structured KV** (结构化)                | **System Prompt** (指令文本)   |
| **时序特征** | **Time-Series** (流式追加)       | **Current State** (状态覆盖)              | **Versioned** (版本控制)       |
| **典型内容** | 对话切片、阶段性总结 (`summary`) | 用户画像 (`profile`)、偏好 (`preference`) | Agent 人设、交互准则           |
| **检索模式** | 语义相似度 (`search_vector`)     | 精确键值匹配 + 语义 (`get` + `search`)    | 键值加载 (`load_instructions`) |

#### 3.2.2 关于 `memory_type='semantic'` 的消歧

在 `memories` 表的定义中，`memory_type` 包含 `semantic` 枚举，这与 `facts` 表看似重叠。为了消除歧义 (Entropy Reduction)，我们做出以下 **明确界定**：

1. **`facts` 表 (Primary Semantic)**:
   - **定义**: 经过**深度固化**、**去重**且**结构化**的确切知识。
   - **场景**: "用户不喜欢吃辣", "用户的职业是工程师"。这是系统认为"为真"的事实。

2. **`memories` 表中的 `semantic` 类型 (Secondary/Transient)**:
   - **定义**: 尚未完全结构化，或难以用 KV 表达的**泛化知识片段**。也可以理解为"关于某个知识点的非结构化描述"。
   - **场景**: "用户详细阐述了他对人工智能未来的看法"（一段 500 字的观点）。这不适合存为 KV Fact，但它是一段具备"语义价值"的记忆，比单纯的"对话切片 (`episodic`)"更抽象。
   - **推荐策略**: 初期 **优先使用 `episodic` 和 `summary`**。仅当需要存储大段非结构化知识（如文档片段 RAG）时使用 `semantic` 类型。此时 `memories` 充当了轻量级的 Vector DB。

> [!TIP]
>
> **设计心法**:
>
> - **memories** 是 Agent 的 **"日记本"** (叙事)。
> - **facts** 是 Agent 的 **"档案库"** (画像)。
> - **instructions** 是 Agent 的 **"员工手册"** (规则)。

### 3.3 核心 Schema 定义 (Single Source of Truth)

为了遵循 **Entropy Reduction (熵减)** 原则，避免文档与代码的 drift，所有的 DDL 和 SQL 函数定义已收敛至统一的 Schema 文件维护。

> [!IMPORTANT]
>
> **Source of Truth**: [src/cognizes/engine/schema/hippocampus_schema.sql](file:///src/cognizes/engine/schema/hippocampus_schema.sql)
>
> 该文件包含：
>
> 1. **Tables**: `memories`, `facts`, `consolidation_jobs`, `instructions`
> 2. **Indexes**: PGVector HNSW 索引与 B-Tree 辅助索引
> 3. **Functions**: `calculate_retention_score` (艾宾浩斯衰减), `cleanup_low_value_memories` (自动清理), `get_context_window` (上下文组装)

---

## 4. 实施指南

### 4.1 Step 1: 记忆 Schema 扩展部署

#### 4.1.1 部署执行 (Deployment Execution)

本 Schema 设计具备 **幂等性 (Idempotency)**，可重复执行。

```bash
# 确保位于项目根目录，并正确配置 PSQL 环境变量
# export PGPASSWORD=your_password

# 执行部署 (包含 Tables, Indexes, Functions)
psql -d 'cognizes-engine' -f src/cognizes/engine/schema/hippocampus_schema.sql
```

#### 4.1.2 验收验证 (Verification SOP)

执行以下 SOP 确保对象创建正确：

```bash
# 1. 验证核心表结构 (4 Tables)
psql -d 'cognizes-engine' -c "\dt" | grep -E 'memories|facts|consolidation_jobs|instructions'

# 2. 验证向量索引 (HNSW)
psql -d 'cognizes-engine' -c "SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_memories_embedding';"

# 3. 验证功能函数 (3 Functions)
psql -d 'cognizes-engine' -c "\df calculate_retention_score"
psql -d 'cognizes-engine' -c "\df cleanup_low_value_memories"
psql -d 'cognizes-engine' -c "\df get_context_window"

# 4. 功能冒烟测试 (Function Smoke Test)
psql -d 'cognizes-engine' -c "SELECT calculate_retention_score(5, NOW() - INTERVAL '3 days') AS score;"
# 预期结果: score < 1.0 (e.g., ~0.95)
```

#### 4.1.3 定时任务配置 (pg_cron) - P2-2-8

我们通过 PostgreSQL 内建的定时任务来实现记忆系统的**自维护 (Self-Maintenance)**。

**前提条件**: 需先安装并启用 `pg_cron` 扩展（详见 [010-the-pulse.md](../engine/010-the-pulse.md#pg_cron)）。

**Step 1: 注册定时任务 (Execution)**

```sql
-- 1. 记忆清理 (每日凌晨 02:00)
-- 清理访问率低且陈旧的记忆，保持 Context 清爽
SELECT cron.schedule(
    'cleanup_memories',
    '0 2 * * *',
    $$SELECT cleanup_low_value_memories(0.1, 7)$$
);

-- 2. 周期性巩固 (每小时)
-- 扫描最近活跃的会话，生成 consolidate 任务
SELECT cron.schedule(
    'trigger_consolidation',
    '0 * * * *',
    $$SELECT trigger_maintenance_consolidation('1 hour'::interval)$$
);
```

**Step 2: 任务验证 (Verification)**

```bash
# 1. 验证任务是否注册
psql -d 'cognizes-engine' -c "SELECT jobid, schedule, command FROM cron.job;"

# 2. 手动触发测试 (验证函数逻辑)
psql -d 'cognizes-engine' -c "SELECT trigger_maintenance_consolidation('1 day'::interval);"
# 预期: 返回生成的 job 数量
```

### 4.2 Step 2: Memory Consolidation Worker 实现

#### 4.2.1 核心架构设计

Memory Consolidation Worker 采用**两阶段巩固**策略，模拟人类大脑的记忆巩固过程：

```mermaid
graph TB
    subgraph "Fast Replay (快回放)"
        E[Events 事件流] --> ER[extract_recent_events]
        ER --> GS[generate_summary]
        GS --> SS[store_summary]
    end

    subgraph "Deep Reflection (深反思)"
        E --> EF[extract_facts]
        EF --> VI[vectorize_insights]
        VI --> SM[store_to_memories]
    end

    SS --> M[(memories 表)]
    SM --> F[(facts 表)]

    style E fill:#065f46,stroke:#34d399,color:#fff
    style M fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style F fill:#7c2d12,stroke:#fb923c,color:#fff
```

#### 4.2.2 核心代码实现 (Source of Truth)

为了遵循 **Entropy Reduction (熵减)** 原则，具体的业务逻辑代码已收敛至源文件维护。

> [!IMPORTANT]
>
> **Source of Truth**: [src/cognizes/engine/hippocampus/consolidation_worker.py](../../src/cognizes/engine/hippocampus/consolidation_worker.py)
>
> 该模块实现了 `MemoryConsolidationWorker` 类，负责：
>
> 1. **Fast Replay**: 使用 `_generate_summary` 快速生成对话摘要。
> 2. **Deep Reflection**: 使用 `_extract_facts` 深度提取结构化事实 (Facts) 和洞察 (Insights)。
> 3. **Vectorization**: 调用 `_generate_embedding` (Gemini `text-embedding-004`) 生成向量。
> 4. **Storage**: 将处理结果分别存入 `memories` (Summary/Insight) 和 `facts` (Preference/Proflie) 表。

#### 4.2.3 使用示例 (SDK)

```python
# 使用示例: 手动触发记忆巩固
import asyncio
import asyncpg
from cognizes.engine.hippocampus.consolidation_worker import MemoryConsolidationWorker, JobType

async def main():
    # 1. 创建数据库连接池 (通常由 DatabaseManager 管理)
    pool = await asyncpg.create_pool("postgresql://aigc:@localhost/cognizes-engine")

    # 2. 初始化 Worker
    worker = MemoryConsolidationWorker(pool)

    # 3. 执行完整巩固 (Full Consolidation)
    # 包含: Fast Replay (摘要) + Deep Reflection (事实提取)
    job = await worker.consolidate(
        thread_id="your-thread-id",
        job_type=JobType.FULL_CONSOLIDATION
    )

    print(f"Job completed: {job.result}")
    await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
```

### 4.3 Step 3: Biological Retention 实现

#### 4.3.1 艾宾浩斯遗忘曲线原理

艾宾浩斯遗忘曲线描述了记忆随时间衰减的规律。我们将其应用于 Agent 记忆系统：

```mermaid
graph LR
    subgraph "遗忘曲线模型"
        T[Time 时间] --> D[Decay 衰减]
        F[Frequency 访问频率] --> B[Boost 加成]
        D & B --> R[Retention Score 保留分数]
    end

    R --> C{Score 阈值}
    C -->|>= 0.1| K[保留]
    C -->|< 0.1| DEL[清理]

    style R fill:#7c2d12,stroke:#fb923c,color:#fff
```

**公式**：

$$
    \text{retention\_score} = \min(1.0, \frac{\text{time\_decay} \times \text{frequency\_boost}}{5.0})
$$

其中：

- $\text{time\_decay} = e^{-\lambda \times \text{days\_elapsed}}$ (指数衰减)
- $\text{frequency\_boost} = 1 + \ln(1 + \text{access\_count})$ (对数加成)
- $\lambda = 0.1$ (默认衰减系数)

#### 4.3.2 Memory Retention Manager 实现

> [!IMPORTANT]
>
> **Source of Truth**: [src/cognizes/engine/hippocampus/retention_manager.py](../../src/cognizes/engine/hippocampus/retention_manager.py)

负责实现艾宾浩斯遗忘曲线算法，自动管理记忆的保持与清理：

1. **Retention Score Calculation**: 根据时间衰减和访问频率计算分值。
2. **Access Recording**: 记录访问历史 (`record_access`)，提升高频记忆的权重。
3. **Low Value Cleanup**: 周期性清理低价值 (`score < 0.1`) 且陈旧的记忆 (`cleanup_low_value_memories`)。

#### 4.3.3 Context Window 组装器实现

> [!IMPORTANT]
>
> **Source of Truth**: [src/cognizes/engine/hippocampus/context_assembler.py](../../src/cognizes/engine/hippocampus/context_assembler.py)

负责根据 Token 预算动态组装 LLM 上下文窗口。该模块 (`ContextAssembler` 类) 实现了 Python 侧的预算分配逻辑，而非单纯依赖 SQL：

1. **Budgeting**: 根据配置比例 (System 10%, Memory 30%, History 40%...) 分配 Token 预算。
2. **Assembly**: 检索并筛选 System Prompt, Top-K Memories, Recent History, 和 Facts。
3. **Truncation**: 确保总 Token 数不超过模型限制。

### 4.4 Step 4: OpenMemoryService 实现 (ADK 适配器)

本服务作为 ADK MemoryService 的 **PostgreSQL 适配器**，对外提供统一的记忆读写接口。

> [!IMPORTANT]
>
> **Source of Truth**: [src/cognizes/adapters/postgres/memory_service.py](../../src/cognizes/adapters/postgres/memory_service.py)

#### 4.4.1 核心能力 (Capabilities)

该服务封装了底层的 Worker 和 Manager，提供以下核心 API：

1. **`add_session_to_memory(session_id, consolidation_type)`**:
   - **功能**: 触发记忆巩固流程。
   - **实现**: 委托给 `MemoryConsolidationWorker` 异步执行。
   - **ADK 映射**: 对应 ADK `MemoryService.add_memory()`.

2. **`search_memory(query, user_id, app_name)`**:
   - **功能**: 语义检索相关记忆。
   - **实现**: 调用 Gemini `retrieval_query` 模型生成向量，在 `memories` 表执行 HNSW 相似度搜索。
   - **结果**: 返回 `SearchMemoryResponse` 对象，包含匹配的记忆片段及其相关度分数。

3. **`get_context_window(user_id, app_name, query)`**:
   - **功能**: 构建 LLM 上下文窗口。
   - **实现**: 调用 `ContextAssembler` (Python 类) 动态组装 System Prompt (Instructions) + Facts + Memories + History，确保严格遵守 Token 预算。
   - **说明**: 虽然底层存在 SQL 函数 `get_context_window`，但为了更精细的控制，应用层逻辑是主要的组装者。

#### 4.4.2 接口契约验证

为了确保适配器符合 ADK 标准，请执行以下集成测试：

```bash
# 运行 Memory Service 集成测试
pytest tests/integration/engine/test_memory_service.py
```

---

### 4.5 Step 5: AG-UI 记忆系统可视化接口

> [!NOTE]
>
> **对标 AG-UI 协议**：本节实现 The Hippocampus 与 AG-UI 可视化层的集成，提供记忆巩固状态、记忆召回来源和记忆健康度的可视化能力。
>
> **参考资源**：
>
> - [AG-UI 协议调研](../../research/070-ag-ui.md)
> - [AG-UI 官方文档](https://docs.ag-ui.com/)

#### 4.5.1 记忆可视化架构

```mermaid
graph TB
    subgraph "Hippocampus 存储层"
        MEM[memories 表]
        FACTS[facts 表]
        CONS[consolidation_jobs 表]
    end

    subgraph "可视化接口层"
        CS[ConsolidationStatus]
        MH[MemoryHit]
        MD[MemoryDashboard]
    end

    subgraph "AG-UI 事件"
        ACT[ACTIVITY_SNAPSHOT]
        CUST[CUSTOM Events]
    end

    CONS -->|巩固状态| CS
    MEM -->|召回来源| MH
    MEM & FACTS -->|健康度| MD

    CS --> ACT
    MH --> CUST
    MD --> CUST

    style CS fill:#a78bfa,stroke:#7c3aed,color:#000
    style MH fill:#4ade80,stroke:#16a34a,color:#000
    style MD fill:#fbbf24,stroke:#d97706,color:#000
```

#### 4.5.2 AG-UI 事件映射表

| Hippocampus 功能 | 触发条件                  | AG-UI 事件类型          | 展示组件     |
| :--------------- | :------------------------ | :---------------------- | :----------- |
| 记忆巩固进度     | Consolidation Worker 执行 | `ACTIVITY_SNAPSHOT`     | 巩固进度条   |
| 记忆召回         | search_memory() 返回结果  | `CUSTOM (memory_hit)`   | 来源标注卡片 |
| 遗忘曲线更新     | API 轮询 (Scheduled)      | N/A (Dashboard Polling) | 记忆热力图   |
| 上下文预算       | Context Budgeting 执行    | `STATE_DELTA`           | Token 仪表盘 |

#### 4.5.3 MemoryVisualizer 实现

> [!IMPORTANT]
>
> **Source of Truth**: [src/cognizes/engine/hippocampus/memory_visualizer.py](../../src/cognizes/engine/hippocampus/memory_visualizer.py)

#### 4.5.4 前端展示组件规范

| 组件名称                   | 数据源              | 展示内容                           |
| :------------------------- | :------------------ | :--------------------------------- |
| `ConsolidationProgressBar` | ACTIVITY_SNAPSHOT   | 进度百分比、提取事实数             |
| `MemorySourceCard`         | CUSTOM (memory_hit) | 记忆类型图标、内容预览、相关性分数 |
| `MemoryHealthDashboard`    | API 轮询            | 总数、类型分布、衰减曲线           |
| `TokenBudgetMeter`         | STATE_DELTA         | 已用/总量进度条                    |

#### 4.5.5 任务清单

| 任务 ID | 任务描述                   | 状态      | 验收标准         |
| :------ | :------------------------- | :-------- | :--------------- |
| P2-6-1  | 实现 `MemoryVisualizer` 类 | 🔲 待开始 | 4 种事件类型支持 |
| P2-6-2  | 实现巩固进度事件发射       | 🔲 待开始 | 进度实时更新     |
| P2-6-3  | 实现记忆召回来源标注       | 🔲 待开始 | 来源可追溯       |
| P2-6-4  | 实现健康度指标接口         | 🔲 待开始 | 指标计算正确     |
| P2-6-5  | 编写可视化接口测试         | 🔲 待开始 | 覆盖率 > 80%     |

#### 4.5.6 验收标准

| 验收项     | 验收标准                    | 验证方法 |
| :--------- | :-------------------------- | :------- |
| 巩固进度   | 实时展示巩固进度百分比      | 集成测试 |
| 来源标注   | 召回的记忆显示来源会话      | E2E 测试 |
| 健康度     | 正确计算衰减率和分类统计    | 单元测试 |
| Token 预算 | 实时更新上下文 Token 使用量 | 集成测试 |

---

## 5. 验证 SOP (Phase 2)

> [!IMPORTANT]
>
> 本节提供 Phase 2: The Hippocampus 完整验收流程，请按顺序逐步执行。

Phase 2 验证是一次深入的**认知功能评估 (Cognitive Assessment)**。我们需要依次确认记忆中枢结构完备 (Schema Anatomy)、神经单元逻辑自洽 (Unit Logic)、记忆回路畅通 (Memory Circuit) 以及海马体承载极限 (Performance Capacity)。

### 5.1 Step 1: Schema 部署验证

```bash
# 1.1 确保 Phase 1 Schema 已部署
psql -d 'cognizes-engine' -c "\dt threads"
# 应显示 threads 表

# 1.2 部署 Hippocampus Schema
psql -d 'cognizes-engine' -f src/cognizes/engine/schema/hippocampus_schema.sql

# 1.3 验证表创建
psql -d 'cognizes-engine' -c "\dt"
# 应显示: memories, facts, consolidation_jobs, instructions

# 1.4 验证索引
psql -d 'cognizes-engine' -c "\di" | grep -E "(memories|facts)"

# 1.5 验证函数
psql -d 'cognizes-engine' -c "\df calculate_retention_score"
psql -d 'cognizes-engine' -c "\df cleanup_low_value_memories"

# 1.6 测试衰减函数
psql -d 'cognizes-engine' -c "SELECT calculate_retention_score(5, NOW() - INTERVAL '3 days', 0.1);"
# 应返回 0.x 的浮点数
```

**验收标准**：

- [ ] `memories`, `facts`, `consolidation_jobs`, `instructions` 表存在
- [ ] HNSW 向量索引已创建
- [ ] `calculate_retention_score` 函数可正常调用
- [ ] `cleanup_low_value_memories` 函数存在

---

#### 5.1.1 Step 1.1: pg_cron 定时任务配置 (P2-2-8, P2-3-4)

> [!IMPORTANT]
>
> pg_cron 定时任务用于自动触发记忆巩固和低价值记忆清理，需配置后 Phase 2 验收才能完整通过。

```bash
# 1.1 检查 pg_cron 扩展是否已安装 (Phase 1 已完成)
psql -d 'cognizes-engine' -c "SELECT * FROM pg_extension WHERE extname = 'pg_cron';"
# 应返回 1 行记录

# 1.2 配置定时任务 - 每天凌晨 2 点清理低价值记忆 (P2-3-4)
psql -d 'cognizes-engine' -c "
SELECT cron.schedule(
    'cleanup_memories',
    '0 2 * * *',
    \$\$SELECT cleanup_low_value_memories(0.1, 7)\$\$
);
"
# 应返回任务 ID (如 1)

# 1.3 配置定时任务 - 每小时触发记忆巩固检查 (P2-2-8)
psql -d 'cognizes-engine' -c "
SELECT cron.schedule(
    'trigger_consolidation',
    '0 * * * *',
    \$\$SELECT trigger_maintenance_consolidation('1 hour'::interval)\$\$
);
"
# 应返回任务 ID (如 2)

# 1.4 验证定时任务创建成功
psql -d 'cognizes-engine' -c "SELECT jobid, jobname, schedule, command FROM cron.job;"
# 应显示 cleanup_memories 和 trigger_consolidation 两个任务

# 1.5 查看任务执行日志 (首次配置后可能为空)
psql -d 'cognizes-engine' -c "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;"

# 1.6 手动测试清理函数 (可选)
psql -d 'cognizes-engine' -c "SELECT cleanup_low_value_memories(0.1, 7);"
# 应返回清理的记录数 (可能为 0)
```

**验收标准**：

- [ ] pg_cron 扩展已安装
- [ ] `cleanup_memories` 定时任务已创建 (每天 02:00)
- [ ] `trigger_consolidation` 定时任务已创建 (每小时)
- [ ] `cron.job` 表显示 2 个任务

**删除任务 (如需重新配置)**：

```bash
# 删除指定任务
psql -d 'cognizes-engine' -c "SELECT cron.unschedule('cleanup_memories');"
psql -d 'cognizes-engine' -c "SELECT cron.unschedule('trigger_consolidation');"
```

---

### 5.2 Step 2: 单元测试验证

> [!NOTE]
>
> 验证 Memory Consolidation Worker 的核心逻辑 (P2-4-3)。

#### 5.2.1 运行单元测试

对应测试文件：

- 单元测试: `tests/unittests/engine/hippocampus/test_consolidation_worker.py`
- 测试配置: `tests/unittests/engine/hippocampus/conftest.py`

```bash
# 2.1 运行 Hippocampus 单元测试
uv run pytest tests/unittests/engine/hippocampus/ -v --tb=short
uv run pytest tests/unittests/engine/hippocampus/test_consolidation_worker.py -v
```

**关键验证点**:

1. **Fast Replay**: 应生成 Summary
2. **Deep Reflection**: 应提取 Facts
3. **Full Consolidation**: 应执行两个阶段
4. **Mock Isolation**: 外部依赖 (LLM, DB) 均使用 Mock

#### 5.2.2 覆盖率检查 (可选)

```bash
# 2.2 查看测试覆盖率 (需先安装 pytest-cov)
# uv add pytest-cov --dev
uv run pytest tests/unittests/engine/hippocampus/ -v --cov=src/cognizes/engine/hippocampus --cov-report=term-missing
```

**验收标准**：

- [ ] 35 个单元测试全部通过
- [ ] 覆盖以下模块:
  - `consolidation_worker.py` (数据类、枚举、格式化逻辑)
  - `retention_manager.py` (保留分数分布)
  - `context_assembler.py` (Token 估算、上下文格式化)
  - `memory_service.py` (服务参数验证)
  - `memory_visualizer.py` (事件类型、进度计算)

---

### 5.3 Step 3: 集成测试验证

```bash
# 3.1 运行 Hippocampus 集成测试
uv run pytest tests/integration/engine/hippocampus/ -v -s --tb=short

# 3.2 查看详细输出 (含性能指标)
uv run pytest tests/integration/engine/hippocampus/ -v -s
```

**验收标准**：

- [ ] 16 个集成测试全部通过
- [ ] Schema 测试通过: 表结构、索引、函数、约束
- [ ] Read-Your-Writes 延迟 < 100ms
- [ ] 情景分块检索性能 P99 < 50ms (1K 规模)
- [ ] 保留分数分布统计正确
- [ ] 访问计数递增正确
- [ ] Fact Upsert 约束生效

---

### 5.4 Step 4: 性能与一致性测试 (10 万规模)

> [!NOTE]
>
> 验证系统的核心性能指标 (P2-3-7) 和一致性保证 (P2-2-13)。

#### 5.4.1 Step 4.1: Read-Your-Writes 延迟测试

验证新写入的记忆能否在下一个 Turn 立即可见，确保 Zero-ETL 架构的即时性。

对应测试文件：`tests/integration/engine/hippocampus/test_read_your_writes.py`

```bash
# 运行 Read-Your-Writes 测试
uv run pytest tests/integration/engine/hippocampus/test_read_your_writes.py -v -s
```

**关键验证点**:

1. 执行记忆巩固 (写入)
2. 立即执行记忆检索 (读取)
3. 验证新写入的记忆立即可见
4. 延迟 < 100ms (P99)

#### 5.4.2 Step 4.2: 情景分块检索性能测试

验证在 10 万记忆规模下，按时间切片检索的性能。

对应测试文件：`tests/integration/engine/hippocampus/test_episodic_performance.py`

```bash
# 1. 准备性能测试数据 (自动清理旧数据并生成 100K 新数据)
uv run python tests/performance/hippocampus/seed_data.py --action all --count 100000

# 2. 运行完整性能测试
uv run pytest tests/integration/engine/hippocampus/test_episodic_performance.py -v -s -k "full"
```

**关键验证点**:

1. 10 万条记忆规模
2. 随机生成 7 天窗口查询
3. 验证复合索引使用 (Index Scan)
4. 延迟 < 100ms (P99)

**验收标准**：

- [ ] 10 万规模时间切片查询 P99 < 100ms
- [ ] 查询使用索引扫描 (非全表扫描)

---

### 5.5 Step 5: 模块导入验证

```bash
# 5.1 验证模块可导入
uv run pytest tests/integration/engine/hippocampus/test_imports_check.py -v
```

**验收标准**：

- [ ] 所有模块可正常导入 (tests passed)
- [ ] 无循环依赖错误

---

### 5.6 Step 6: 全量测试验证

```bash
# 6.1 运行所有测试 (包括 Phase 1)
uv run pytest tests/ -v --tb=line

# 6.2 查看测试统计
uv run pytest tests/ -v --tb=line 2>&1 | tail -5
```

**验收标准**：

- [ ] Phase 1 测试: All passed
- [ ] Phase 2 单元测试: All passed
- [ ] Phase 2 集成测试: All passed
- [ ] **总计: All tests passed**

---

### 5.7 验收总结清单

| 验收项           | 状态 | 说明                          |
| :--------------- | :--: | :---------------------------- |
| Schema 部署      |  ⬜  | 4 张表 + 2 个函数 + HNSW 索引 |
| pg_cron 定时任务 |  ⬜  | 2 个任务 (清理 + 巩固)        |
| 单元测试         |  ⬜  | All passed                    |
| 集成测试         |  ⬜  | All passed                    |
| Read-Your-Writes |  ⬜  | P99 < 100ms                   |
| 模块导入         |  ⬜  | tests passed                  |
| 全量回归         |  ⬜  | All passed                    |

> [!TIP]
>
> 完成上述所有验收项后，勾选状态为 ✅，Phase 2: The Hippocampus 验收通过，可进入 Phase 3: The Perception。

---

## 6. 验收基准

### 6.1 功能验收矩阵

| 验收项                | 任务 ID           | 验收标准                                                 | 验证方法                |
| :-------------------- | :---------------- | :------------------------------------------------------- | :---------------------- |
| **Schema 部署**       | P2-2-1 ~ P2-2-2   | `memories`, `facts`, `consolidation_jobs` 表创建成功     | `\dt` 查看表列表        |
| **Fast Replay**       | P2-2-5 ~ P2-2-8   | 对话摘要生成成功，存入 `memories` 表                     | 单元测试                |
| **Deep Reflection**   | P2-2-9 ~ P2-2-12  | Facts 提取成功，存入 `facts` 表 (Upsert 逻辑正确)        | 单元测试 + 重复插入测试 |
| **Read-Your-Writes**  | P2-2-13 ~ P2-2-14 | 新记忆在下一 Turn 立即可检索                             | 延迟测试 (< 100ms)      |
| **艾宾浩斯衰减**      | P2-3-1 ~ P2-3-4   | `retention_score` 随时间衰减，高频访问提升分数           | 衰减曲线验证            |
| **情景分块**          | P2-3-5 ~ P2-3-7   | 按时间切片检索 P99 < 100ms (10 万记忆规模)               | 性能测试                |
| **Context Window**    | P2-3-8 ~ P2-3-11  | 动态组装 Context 不超出 Token 预算，超限时自动截断       | Token 统计测试          |
| **OpenMemoryService** | Phase 2 综合      | 实现 `add_session_to_memory()` 和 `search_memory()` 接口 | 接口兼容性测试          |

### 6.2 性能验收指标

| 指标                 | 目标值    | 测试条件                      |
| :------------------- | :-------- | :---------------------------- |
| **记忆写入延迟**     | < 500ms   | 单次 `consolidate()` 调用     |
| **记忆检索延迟**     | < 50ms    | `search_memory()` Top-10 结果 |
| **向量索引 QPS**     | > 100 QPS | 10 万向量规模                 |
| **Read-Your-Writes** | < 100ms   | 新记忆可见延迟                |
| **Context 组装延迟** | < 100ms   | 8000 Token 预算               |

### 6.3 兼容性验收

| 验收项                     | 验收标准                                                |
| :------------------------- | :------------------------------------------------------ |
| **ADK MemoryService 兼容** | `OpenMemoryService` 可作为 ADK `MemoryService` 替代使用 |
| **Phase 1 兼容**           | 与 `threads`/`events` 表无缝关联                        |
| **向量格式兼容**           | 使用与 Phase 1 相同的 1536 维向量 (Gemini embedding)    |

---

### 6.5. 交付物清单

#### 6.5.1 Schema 文件

| 文件路径                                            | 描述                    | 状态      |
| :-------------------------------------------------- | :---------------------- | :-------- |
| `src/cognizes/engine/schema/hippocampus_schema.sql` | Hippocampus 扩展 Schema | ✅ 已完成 |

#### 6.5.2 代码文件

| 文件路径                                                  | 描述              | 状态      |
| :-------------------------------------------------------- | :---------------- | :-------- |
| **Core Repositories**                                     |                   |           |
| `src/cognizes/core/repositories/memory.py`                | Memory Repository | ✅ 已完成 |
| `src/cognizes/core/repositories/facts.py`                 | Facts Repository  | ✅ 已完成 |
| **Engine Components**                                     |                   |           |
| `src/cognizes/engine/hippocampus/consolidation_worker.py` | 记忆巩固 Worker   | ✅ 已完成 |
| `src/cognizes/engine/hippocampus/memory_service.py`       | OpenMemoryService | ✅ 已完成 |
| `src/cognizes/engine/hippocampus/retention_manager.py`    | 记忆保持管理器    | ✅ 已完成 |
| `src/cognizes/engine/hippocampus/context_assembler.py`    | 上下文组装器      | ✅ 已完成 |
| `src/cognizes/engine/hippocampus/memory_visualizer.py`    | 记忆可视化工具    | ✅ 已完成 |

#### 6.5.3 测试文件

| 文件路径                                                                   | 描述                      | 状态      |
| :------------------------------------------------------------------------- | :------------------------ | :-------- |
| **Unit Tests**                                                             |                           |           |
| `tests/unittests/engine/hippocampus/test_consolidation_worker.py`          | Worker 单元测试           | ✅ 已完成 |
| `tests/unittests/engine/hippocampus/test_memory_service.py`                | Service 单元测试          | ✅ 已完成 |
| `tests/unittests/engine/hippocampus/test_retention_manager.py`             | 保持管理器单元测试        | ✅ 已完成 |
| `tests/unittests/engine/hippocampus/test_context_assembler.py`             | 上下文组装器单元测试      | ✅ 已完成 |
| **Integration Tests**                                                      |                           |           |
| `tests/integration/engine/hippocampus/test_read_your_writes.py`            | Read-Your-Writes 延迟测试 | ✅ 已完成 |
| `tests/integration/engine/hippocampus/test_episodic_performance.py`        | 情景分块性能测试          | ✅ 已完成 |
| `tests/integration/engine/hippocampus/test_consolidation_repo_refactor.py` | 巩固流程集成测试          | ✅ 已完成 |
| `tests/integration/engine/hippocampus/test_imports_check.py`               | 模块导入检查              | ✅ 已完成 |

#### 6.5.4 目录结构

```
src/cognizes/
├── core/
│   └── repositories/          # Core Data Access Layer
│       ├── memory.py
│       └── facts.py
├── engine/
│   ├── schema/
│   │   └── hippocampus_schema.sql
│   └── hippocampus/           # Phase 2: The Hippocampus
│       ├── consolidation_worker.py
│       ├── retention_manager.py
│       ├── context_assembler.py
│       ├── memory_service.py
│       └── memory_visualizer.py
tests/
├── unittests/
│   └── engine/
│       └── hippocampus/       # Unit Tests
└── integration/
    └── engine/
        └── hippocampus/       # Integration & Performance Tests
```

---

## 7. 风险与缓解策略

### 7.1 技术风险

| 风险                        | 影响 | 概率 | 缓解策略                                   | 状态       |
| :-------------------------- | :--- | :--- | :----------------------------------------- | :--------- |
| **LLM 提取不稳定**          | 中   | 中   | `MemoryService` 解析时增加 Fallback 逻辑   | ✅ 已实施  |
| **向量检索精度不足**        | 高   | 低   | 引入 Reranker (Phase 3)，调优 HNSW 参数    | 🔲 Phase 3 |
| **艾宾浩斯衰减参数不合理**  | 中   | 中   | SQL 函数参数化设计，支持 A/B 测试调优      | ✅ 已实施  |
| **Context Window 组装偏差** | 中   | 低   | 暂用估算，Phase 3 引入 `tiktoken` 精确统计 | ⚠️ 需优化  |

### 7.2 工程风险

| 风险                        | 影响 | 概率 | 缓解策略                                  | 状态        |
| :-------------------------- | :--- | :--- | :---------------------------------------- | :---------- |
| **Gemini API 限流**         | 高   | 中   | 需增加指数退避重试 (Exponential Backoff)  | 🔲 Phase 3  |
| **大规模记忆清理阻塞**      | 中   | 低   | `pg_cron` 错峰执行，后续增加 Batch Delete | ⚠️ 部分实施 |
| **Phase 1 Schema 变更影响** | 低   | 低   | `REFERENCES` 外键约束确保一致性           | ✅ 已实施   |

---

## 8. 附录

### 8.1 Prompt 模板参考

请见独立文档: [`prompt_template.md`](../../src/cognizes/engine/hippocampus/prompt_template.md)

### 8.2 衰减算法参数调优指南

| 场景               | 推荐 λ (decay_rate) | 推荐阈值 (threshold) | 说明                       | 配置方式 (Configuration Action)                                                                         |
| :----------------- | :------------------ | :------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------ |
| **高交互频率 App** | 0.15                | 0.15                 | 加速遗忘，保持记忆新鲜度   | Python Config: `RetentionManager(decay_rate=0.15)`<br>SQL Cron: `cleanup_low_value_memories(0.15, ...)` |
| **低交互频率 App** | 0.05                | 0.05                 | 减缓遗忘，保留更多历史记忆 | Python Config: `RetentionManager(decay_rate=0.05)`<br>SQL Cron: `cleanup_low_value_memories(0.05, ...)` |
| **敏感信息场景**   | 0.3                 | 0.2                  | 快速清理，减少隐私风险     | Python Config: `RetentionManager(decay_rate=0.3)`<br>SQL Cron: `cleanup_low_value_memories(0.2, ...)`   |
| **知识积累场景**   | 0.02                | 0.02                 | 长期保留，构建知识图谱     | Python Config: `RetentionManager(decay_rate=0.02)`<br>SQL Cron: `cleanup_low_value_memories(0.02, ...)` |

> [!TIP]
>
> **Configuration Locations**:
>
> 1. **Runtime App**: Update `src/config.py` (passed to `RetentionManager`).
> 2. **Periodic Cleanup**: Update `pg_cron` schedule or SQL function defaults in `hippocampus_schema.sql`.

---

## 9. 参考文献

<a id="ref1"></a>[1] Psychology Today, "Types of Memory," _Psychology Today_, 2024. [Online]. Available: https://www.psychologytoday.com/us/basics/memory/types-of-memory

<a id="ref2"></a>[2] LangChain, "LangGraph Memory Overview," _LangChain Documentation_, 2025. [Online]. Available: https://docs.langchain.com/oss/python/langgraph/memory

<a id="ref3"></a>[3] Google, "ADK Memory Documentation," _Google ADK Docs_, 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/memory/

<a id="ref4"></a>[4] Google, "ADK Sessions Documentation," _Google ADK Docs_, 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/

<a id="ref5"></a>[5] LangChain, "LangGraph Memory Agent," _GitHub Repository_, 2024. [Online]. Available: https://github.com/langchain-ai/memory-agent

<a id="ref6"></a>[6] LangChain, "LangGraph Memory Template," _GitHub Repository_, 2024. [Online]. Available: https://github.com/langchain-ai/memory-template

<a id="ref7"></a>[7] SII-GAIR, "Context Engineering 2.0: The Context of Context Engineering," _SII-GAIR Technical Report_, 2025.

<a id="ref8"></a>[8] H. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," _Teachers College, Columbia University_, 1913.
