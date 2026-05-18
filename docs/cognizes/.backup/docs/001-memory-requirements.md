# Agentic AI Engine: Memory Layer Requirements

## 1. 核心概念定义

基于 Google Agent Engine 架构与 Agentic AI 学术研究，我们定义以下核心记忆组件：

### 1.1. Sessions (会话流 / Episodic Stream)

- **定义**: 原始的、不可变的交互日志流。它是 Agent 的"感官输入"记录。
- **性质**:
  - **Append-only**: 只能追加，不可修改历史。
  - **High Throughput**: 必须支持高并发写入 (e.g., Every token/message).
  - **Short-term Context**: 通常作为 Context Window 的直接来源。
- **Schema 示例**:
  ```json
  {
    "event_id": "uuid",
    "session_id": "uuid",
    "timestamp": "ISO8601",
    "type": "user_message" | "agent_action" | "tool_output",
    "content": "raw_text_or_json",
    "metadata": { "latency": 120, "tokens": 45 }
  }
  ```

### 1.2. Memory Bank (记忆库 / Consolidated Memory)

- **定义**: 经过加工、压缩、结构化的长期记忆。它是 Agent 的"知识"与"经验"。
- **性质**:
  - **Mutable**: 可以被更新、合并、遗忘。
  - **Semantic & Vectorized**: 必须支持语义检索 (Vector Search) 和结构化查询 (SQL)。
  - **Reflective**: 包含从 Sessions 中提炼的高层见解 (Reflections)。
- **Schema 示例**:
  ```json
  {
    "memory_id": "uuid",
    "entity_id": "user_123", // 关联实体
    "memory_type": "fact" | "preference" | "experience",
    "content": "User prefers concise python code.",
    "embedding": [0.12, -0.45, ...], // Vector
    "confidence": 0.95,
    "source_sessions": ["session_id_1", "session_id_5"], // Lineage
    "last_accessed": "ISO8601"
  }
  ```

## 2. 关键流程: The Memory Loop

从 Sessions 到 Memory Bank 的转化是 Agent 进化的关键：

1.  **Observation (Write)**: 所有交互实时写入 **Sessions**。
2.  **Reflection (Async Process)**: 后台 Worker 定期或基于事件触发扫描 Sessions。
    - _Trigger_: Token count > N 或 会话结束。
    - _Action_: LLM 总结最近会话，提取关键事实。
3.  **Consolidation (Merge/Upsert)**:
    - 将提取的事实写入 **Memory Bank**。
    - **Entity Resolution**: 识别是“新知识”还是“更新旧知识”（如：用户从 Python 转为 Go 开发者）。
4.  **Recall (Read)**:
    - Agent 响应前，根据当前 Query 生成 Embedding。
    - 混合检索 **Memory Bank** (Top-K) 和最近的 **Sessions**。
    - 注入 Context Window。

## 3. ACID 与一致性需求

在多 Agent (Multi-Agent) 协作场景下（基于 A2A 协议），存储层需满足：

- **Read-Your-Writes**: 单个 Agent 必须能立即读到自己刚写入的 Session log。
- **Isolation (快照隔离)**: 当后台 Worker 正在进行 Memory Consolidation (读取 Session -> 写入 Bank) 时，不应阻塞前台 Agent 的写入。
- **Atomicity**: 在更新 Memory Bank 时，如果涉及多条事实的合并（例如：删除旧事实 + 插入新事实），必须保证原子性，防止记忆分裂。

## 4. Google Agent Engine 参考

- **A2A Protocol**: 主要关注 Agent 间的 **通信标准** (Message Passing)，而非共享存储。
- **Implication**: 每个 Agent 实例应维护自己独立的 Memory Slice，或通过基于权限的共享 Memory Bank 访问。

## 5. 结论

存储选型 (OceanBase vs Others) 必须同时满足：

1.  **Log Store**: 高性能 Append (Sessions)。
2.  **Vector Store**: 高维向量检索 (Memory Bank)。
3.  **Consistency**: 能够处理上述的一致性模型，最好能在单一引擎内闭环，以减少 ETL 延迟。
