# Agentic AI Engine: Memory Manager 架构设计方案

## 1. 架构总览

本方案基于 **OceanBase (Pro Edition / SeekDB)** 构建统一的 Agent 记忆基座。核心设计思想是实现 **"Sensory to Memory"** (从即时感知到长期记忆) 的自动化流转闭环。

### 1.1. 核心组件

- **SessionManager**: 负责高频、低延迟的交互日志写入 (Append-only)。
- **MemoryBank**: 负责结构化知识的存储与向量检索。
- **Consolidator (Reflector)**: 异步后台进程，负责从 Session 中 "提炼" Memory。
- **ContextInjector**: 负责在 Agent 思考前组装 Context (Session Head + Relevant Memories)。

## 2. 数据 Schema 设计 (OceanBase)

### 2.1. 表结构：`agent_sessions` (LSM-Tree 优化)

```sql
CREATE TABLE agent_sessions (
    session_id VARCHAR(64) NOT NULL,
    event_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) COMMENT 'user_msg, agent_thought, tool_call',
    content TEXT, -- JSON payload
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding VECTOR(1536) COMMENT 'Optional: 对单条消息的 Embedding',
    PRIMARY KEY (session_id, event_id)
) PARTITION BY HASH(session_id) PARTITIONS 16;
-- 利用 OceanBase 的分区表特性，保证高并发写入
```

### 2.2. 表结构：`agent_memories` (Vector Store)

```sql
CREATE TABLE agent_memories (
    memory_id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    memory_type VARCHAR(32) COMMENT 'fact, preference, summary',
    text_content TEXT,
    vector_emb VECTOR(1536), -- 核心向量列
    importance_score DOUBLE,
    last_accessed TIMESTAMP,
    -- 创建向量索引 (IVF or HNSW)
    VECTOR INDEX idx_memory_vec (vector_emb) WITH (distance=L2, type=HNSW)
);
```

## 3. 关键流程设计 (The Memory Loop)

### 3.1. 写入路径 (Fast Path)

1.  用户发送消息 -> Runtime。
2.  Runtime 调用 `SessionManager.append_event()`。
3.  **OceanBase**: 写入 `agent_sessions` 表。由于是 Append 操作，LSM-Tree 引擎提供极高的吞吐量。
4.  返回 ACK 给用户 (可选项，流式输出时可并行)。

### 3.2. 记忆整合路径 (Background Path)

1.  **Trigger**: `Consolidator` 检测到 Sessiontoken 超过阈值 或 会话结束。
2.  **Extract**: 调用 LLM (e.g., Gemini/Claude) 分析最近 N 条 Session Logs。
    - _Prompt_: "Extract key facts about user preferences from this conversation."
3.  **Upsert**: 将提取的事实 (Facts) 写入 `agent_memories`。
    - _Hybrid Logic_: 先查是否存在相似事实 (Hybrid Search)，若存在则 Update (Merging)，否则 Insert。
    - **Transaction**: 这是一个 ACID 事务，保证 Memory Bank 的状态一致性。

### 3.3. 回忆路径 (Recall Path)

1.  Agent 收到新 Query。
2.  **Intent Analysis**: 生成 Query Embedding。
3.  **Hybrid Search (OceanBase)**:
    ```sql
    SELECT text_content, importance_score,
           VECTOR_DISTANCE(vector_emb, :query_vec) as dist
    FROM agent_memories
    WHERE agent_id = :current_agent
      AND importance_score > 0.5 -- SQL Filter
    ORDER BY dist ASC -- Vector Search
    LIMIT 5;
    ```
4.  **Context Construction**:
    - Top-K Memories
    - \+ Last-N Session Events
    - \+ System Prompt
    - => **Infinite Context Window**

## 4. 为什么选择 OceanBase?

1.  **Simplified Stack**: 不需要维护 Redis (Session) + Milvus (Memory) 两套系统。
2.  **Transactional Consolidation**: 在 3.2 步骤中，"合并旧记忆"和"插入新记忆"必须是原子的。OceanBase 的事务引擎完美解决此问题。
3.  **Real-time Visibility**: Consolidator 刚由于 "Read-your-writes" 特性，能立刻读到最新的 Session 数据，没有任何同步延迟。

## 5. 后续实施建议

- 建立 `MemoryManager` 抽象类。
- 实现 `OceanBaseMemoryProvider`。
- 编写集成测试：模拟 "用户告知名字 -> Agent 记住 -> 后续对话直接称呼名字" 的 End-to-End 流程。
