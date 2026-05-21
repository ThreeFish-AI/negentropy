## 5. 工程验证 Roadmap

### 5.1 Phase 2: Memory Management

**论文指导**：记忆分层架构 + 记忆迁移机制

**行动建议**：

1. **短期记忆 (Session Log)**

   - 使用 PG 表存储 `session_events`（append-only）
   - 利用 PG 事务保证 `state_delta` 的原子应用

2. **长期记忆 (Insights)**

   - 设计 `agent_memories` 表，包含向量列
   - 实现 Memory Transfer 函数：
     ```python
     def consolidate_memory(session: Session) -> List[Memory]:
         # 1. 提取 session.events 中的关键信息
         # 2. 使用 LLM 生成 Insight
         # 3. 向量化 Insight
         # 4. 原子写入 agent_memories 表
     ```

3. **记忆选择策略**
   - 实现基于 Recency + Frequency + Semantic Similarity 的混合检索
   - 利用 `DBMS_HYBRID_SEARCH` 实现 SQL 层面的混合检索

### 5.2 Phase 3: Context Engineering (RAG & Assembler)

**论文指导**：Context Compression + Context Isolation + Proactive Inference

**行动建议**：

1. **统一检索链路**

   - 在单次 SQL 查询中同时检索 Session Context + Long-term Memory
   - 实现 `PGMemoryService.search_memory()` 返回 Fused Context

2. **上下文压缩**

   - 参考 ADK 的 EventsCompactionConfig 设计
   - 在 PG 中可通过 Stored Procedure 或应用层实现滑动窗口摘要

3. **动态上下文组装 (Context Budgeting)**
   - 在数据库层估算 Token 大小
   - 实现 Top-K 截断，确保不超过 Context Window

### 5.3 Phase 4: Framework Integration

**论文指导**：上下文共享 + 跨 Agent 通信

**行动建议**：

1. **ADK Adapter 优先**

   - 实现 `PGSessionService` 和 `PGMemoryService`
   - 遵循 ADK 的 Service 抽象，确保与 Google 生态的兼容性

2. **多框架支持**

   - 为 LangGraph 实现 `Checkpointer` + `VectorStore` 双角色
   - 为 Agno 实现 `Database` 接口

3. **A2A Protocol 预研**
   - 关注 Google 的 Agent-to-Agent 开放协议
   - 考虑 PG 作为 Agent 间上下文共享的中央存储

## 5. 结合 Roadmap 的课题与行动建议

基于上述调研，对 `docs/000-roadmap.md` 的主要课题进行细化：

### 5.1 Phase 2: Memory Management (仿生 Google Memory Bank)

- **Google 做法**:
  1.  `SessionService` 管理 Session 生命周期。
  2.  `MemoryService.add_session_to_memory()` 或 `generate_memories()` 触发异步 Extraction/Consolidation。
  3.  Memory Bank 使用 LLM 提取 Insights，支持 TTL 和 Memory Revisions。
- **Adoption**:
  1.  在 OceanBase 中设计 `agent_sessions` 表存储 Events 和 State。
  2.  设计 `agent_memories` 表存储提炼后的 Insights (包含向量列)。
  3.  实现一个后台 Worker（或 OceanBase Trigger/Scheduled Task），定期从 `sessions` 提取数据，调用 LLM 生成 Insight，写入 `memories`。
- **验证点**: 验证 OceanBase 的 **事务** 能否保证 "Session 更新 + Memory 更新" 的原子性，避免 "记忆分裂"。

### 5.2 Phase 3: Unified Retrieval (Context Engineering)

- **Google 做法**: ADK 的 `MemoryService.search_memory()` 返回相关记忆，开发者需手动拼接到 Prompt。
- **OB 优势**: 可通过 SQL View 或 Stored Procedure 封装 `DBMS_HYBRID_SEARCH`，在单次 SQL 查询中同时检索 Session Context + Long-term Memory。
- **行动**: 在 `OceanBaseMemoryService.search_memory()` 的实现中，直接返回一个包含 Session State 和 Long-term Insights 的 **Fused Context**。

### 5.3 Phase 4: Framework Integration (ADK Adapter)

- **现状**: Google ADK 的 `VertexAiSessionService` 和 `VertexAiMemoryBankService` 强绑定 Vertex AI API。
- **机会**: 社区缺乏 "On-Premises / Private Cloud" 的 ADK Service 实现。
- **行动**:
  1.  开发 `adk-oceanbase` Python 包，提供 `OceanBaseSessionService` 和 `OceanBaseMemoryService`。
  2.  让开发者使用 Google 的 ADK 框架代码（Agent 定义、Tool 定义），仅通过配置切换底层 Storage 到 OceanBase。
  3.  **战略价值**: **"Google's Framework, Your Data"**。

## 7. 结论

1.  **架构可行性**: 尝试使用 PG 的物理架构承载 Google Agent Builder 的逻辑架构（Session + State + Memory 三层抽象，以及 `SessionService` / `MemoryService` 接口）。
2.  **核心差异**: 最大的 gap 在于 **"Async Memory Consolidation"** 的实现。Google 有现成的托管服务 (Memory Bank)，而利用 PG 需要我们在应用层（Python Worker）或数据库层（Scheduled Task）构建这套异步提炼机制。
3.  **下一步行动**:
    - **Phase 2**: 设计 `agent_sessions` 和 `agent_memories` 表，实现 Memory Consolidation Worker。
    - **Phase 4**: 开发 `adk-pg` Python 包，将 ADK 的 `SessionService` 和 `MemoryService` 接口适配到 PG。
