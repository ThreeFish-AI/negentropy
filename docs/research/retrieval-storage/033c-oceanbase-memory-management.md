---
sidebar_position: 7
title: "OceanBase Phase 2：Memory Management 实施指引"
---
# Phase 2: Memory Management 实施指引 (Google Memory Bank 仿生)

本文档基于对 **Google Agent Engine: Memory Bank** 的深度调研（参考官方文档 [Overview](https://cloud.google.com/agent-builder/agent-engine/memory-bank/overview)) 及 **OceanBase V4.5.0** 特性的研究，旨在为 `task.md` 中 **Phase 2** 的执行提供详细的理论基础与操作指南。

## 1. Google Memory Bank 架构体系

Google Agent Engine 的 Memory Bank 是一个**动态演进 (Evolving)** 的长期记忆系统，其核心价值在于解决 "Stateless" AI 的局限，提供跨 Session 的个性化体验。

### 1.1 核心概念 (Key Concepts)

- **Memory Scope (记忆作用域)**: 记忆并非全局共享，而是被隔离在特定的 Scope 中（通常绑定 `user_id`）。
- **Raw Session Data**: 原始的对话日志，位于 "Agent Engine Sessions" 层，是记忆的**来源**而非**本体**。
- **Extraction (提取)**: 一个**异步 (Async)** 后台过程。利用 LLM (如 Gemini 2.5 Flash) 从 Raw Logs 中识别并提取 "Meaningful Information"（有意义的信息）。
- **Consolidation (巩固)**: 记忆库的“守门人”。提取出的信息**不直接写入**，而是必须经过 Consolidation 过程：
  - **Deduplication**: 检查是否已存在。
  - **Conflict Resolution**: 检查是否与旧记忆矛盾（例如用户更改偏好）。
  - **Merge**: 将零散信息合并为完整画像。
- **Retrieval (检索)**: 运行时通过 Vector Search (Embeddings) + Metadata Filtering 召回相关记忆。

### 1.2 架构映射表 (Architecture Mapping)

我们将使用 OceanBase 的特性来一一复刻上述组件：

| Google Concept            | Our Unified Schema Entities                 | Technology Stack                     |
| :------------------------ | :------------------------------------------ | :----------------------------------- |
| **Agent Engine Sessions** | `memory_sessions` + `memory_logs`           | OceanBase Tables (LSM-Tree)          |
| **Memory Extraction**     | `src/simulation/memory_worker.py` (Stage 1) | Python Process + LLM (OpenAI/Gemini) |
| **Memory Consolidation**  | `src/simulation/memory_worker.py` (Stage 2) | **Acid Transactions (Serializable)** |
| **Memory Storage**        | `memory_artifacts`                          | **OB Vector** + **JSON**             |
| **Retrieval**             | `Task 3.1` (Phase 3)                        | Hybrid Search (SQL + Vector)         |

---

## 2. Task 2.1: 异步记忆巩固 (Async Consolidation)

**目标**: 开发 `src/simulation/memory_worker.py`，实现 "Extraction -> Consolidation" 的完整 Pipeline。

### 步骤 2.1.1: 定义 Extraction Prompt

我们需要定义一个 LLM Prompt，用于从对话中提取 Structured Memory Operation。

**输入**: 最近的 N 条对话日志。
**输出 (JSON)**:

```json
{
  "operations": [
    {
      "action": "CREATE",
      "type": "semantic",
      "content": "User is a vegetarian",
      "tags": ["diet", "preference"]
    },
    {
      "action": "UPDATE",
      "target_query": "User diet preference", // 用于检索旧记忆
      "new_content": "User transitioned to vegan",
      "reason": "User explicitly stated change"
    }
  ]
}
```

### 步骤 2.1.2: 实现 Atomic Consolidation Transaction

这是本阶段的核心工程挑战。为了保证记忆的一致性，必须利用 OceanBase 的事务能力。

**伪代码逻辑 (`memory_worker.py`)**:

```python
def consolidate_memory(session_id, user_id, extracted_ops):
    with oceanbase_connection.cursor() as cursor:
        cursor.execute("START TRANSACTION") # 开启事务

        try:
            for op in extracted_ops:
                if op['action'] == 'CREATE':
                    # 1. 查重 (Deduplication)
                    # 使用 Vector 检索相似度极高 (>0.95) 的现有记忆
                    existing = vector_search(cursor, user_id, op['content'])
                    if not existing:
                        cursor.execute("INSERT INTO memory_artifacts ...")

                elif op['action'] == 'UPDATE':
                    # 2. 冲突解决 (Conflict Resolution)
                    # 检索目标记忆并在数据库层面锁定 (SELECT ... FOR UPDATE)
                    candidates = cursor.execute(
                        "SELECT id FROM memory_artifacts WHERE user_id=? AND ... FOR UPDATE",
                        (user_id,)
                    )

                    # 标记旧记忆失效 (Soft Delete) 或 更新内容
                    for old_mem in candidates:
                        cursor.execute(
                            "UPDATE memory_artifacts SET importance_score=0.1, valid_to=NOW() WHERE id=?",
                            (old_mem.id,)
                        )

                    # 插入新记忆
                    cursor.execute("INSERT INTO memory_artifacts ...")

            cursor.execute("COMMIT") # 提交事务

        except Exception as e:
            cursor.execute("ROLLBACK")
            log_error(e)
```

> **Design Note**: 这里使用了 `SELECT ... FOR UPDATE`。在 OceanBase 中，这会加上行锁，确保在并发场景下（例如用户同时在两个设备聊天），同一时刻只有一个 Worker 能修改该用户的记忆，完美复刻 Google 的 Consolidation 安全性。

---

## 3. Task 2.2: 一致性验证 (Consistency Verification)

**目标**: 验证 OceanBase 的 "Read-Your-Writes" 能力。在 Google 架构中，Logs 写入后应立即可见，Consolidated Memory 可以有秒级延迟（Async），但系统必须保证最终一致性。

### 步骤 2.2.1: 验证数据安全性 (Scenario 9 Extension)

针对 `docs/001` 中的 **Scenario 9 (Fact Update)** 进行高并发压力测试。

**测试指引**:

1.  **构造冲突**:
    - Worker A 接收到: "I love cats."
    - Worker B 接收到: "I hate cats." (几乎同时发生)
2.  **执行**: 同时运行两个 Worker 实例尝试 Consolidate。
3.  **验证**:
    - 数据库不应报错 Deadlock (如果在合理重试范围内)。
    - 最终状态应符合逻辑时序（例如后提交的覆盖先提交的，或者保留两者但在 meta 中标记冲突），决不能出现数据库层面的脏数据。

### 步骤 2.2.2: 验证可见性延迟 (Latency Benchmark)

编写 `src/simulation/benchmark_consistency.py`：

- **Metric 1: Session Log Latency (Short-term)**
  - 写入 Log -> 立即读取。
  - 标准: OceanBase 强一致性下应为 **0ms lag**。
- **Metric 2: Memory Retrieval Latency (Long-term)**
  - 发送 Log -> Worker 轮询 -> Consolidation 完成 -> Vector Index 生效 -> RAG 召回。
  - 记录全链路耗时 (E2E Latency)。这反映了 "Memory Freshness" (记忆新鲜度)。

---

## 4. 后续 Phase 工程验证 Roadmap

> 以下为 OceanBase 仿生 Agent Engine 的 Phase 3/4 工程化要点（自 `033e-oceanbase-task-checklist` 合并）。Phase 2 详见本文 §1-3。

### 4.1 Phase 3: Unified Retrieval（Context Engineering）

- **Google 做法**：ADK 的 `MemoryService.search_memory()` 返回相关记忆，开发者需手动拼接到 Prompt。
- **OB 优势**：可通过 SQL View 或 Stored Procedure 封装 `DBMS_HYBRID_SEARCH`，在单次 SQL 查询中同时检索 Session Context + Long-term Memory。
- **行动**：在 `OceanBaseMemoryService.search_memory()` 实现中，直接返回包含 Session State 和 Long-term Insights 的 **Fused Context**。
- **上下文压缩**：参考 ADK 的 `EventsCompactionConfig`，在 OB 中通过 Stored Procedure 或应用层实现滑动窗口摘要；在数据库层估算 Token 大小，实现 Top-K 截断，确保不超过 Context Window。

### 4.2 Phase 4: Framework Integration（ADK Adapter）

- **现状**：Google ADK 的 `VertexAiSessionService` 和 `VertexAiMemoryBankService` 强绑定 Vertex AI API。
- **机会**：社区缺乏 "On-Premises / Private Cloud" 的 ADK Service 实现。
- **行动**：
  1. 开发 `adk-oceanbase` Python 包，提供 `OceanBaseSessionService` 与 `OceanBaseMemoryService`。
  2. 让开发者复用 Google ADK 的 Agent/Tool 定义，仅通过配置切换底层 Storage 到 OceanBase。
  3. 关注 Google A2A Protocol 预研，评估 OB 作为 Agent 间上下文共享中央存储。**战略价值**："Google's Framework, Your Data"。

### 4.3 结论

1. **架构可行性**：用 OB/PG 物理架构承载 Google Agent Builder 的逻辑架构（Session + State + Memory 三层抽象，以及 `SessionService` / `MemoryService` 接口）。
2. **核心差异**：最大 gap 是 **Async Memory Consolidation** 的实现——Google 有托管 Memory Bank，自建需在应用层（Python Worker）或数据库层（Scheduled Task）构建异步提炼机制（本文 §2 已给出实施指引）。
3. **下一步行动**：Phase 2 设计 `agent_sessions` / `agent_memories` 表 + Memory Consolidation Worker；Phase 4 开发 `adk-oceanbase` 包（与 Phase 1 统一包名），将 ADK 的 `SessionService` / `MemoryService` 接口适配到 OceanBase/PG。

## 5. References

1.  **Google Cloud Documentation**
    - [Agent Builder: Memory Bank Overview](https://cloud.google.com/agent-builder/agent-engine/memory-bank/overview)
    - [Agent Builder: Managing Memory](https://cloud.google.com/agent-builder/docs/manage-memory)
2.  **OceanBase Technical Documentation**

    - [Transaction Isolation & Locking](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000218335)
    - [Vector Search Indexing](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000001050212)

3.  **Project Documentation**
    - `docs/001-foundation-unified-schema-design.md`: 基础 Schema 定义（规划文档，截至 2026-05 尚未创建）。
