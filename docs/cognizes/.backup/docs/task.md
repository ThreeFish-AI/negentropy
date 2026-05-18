# Task Checklist: Agentic AI Engine Research & Roadmap

> **版本**: 1.1 (Fine-tuned based on research reports)  
> **更新日期**: 2025-12-22  
> **对应 Roadmap**: [docs/000-roadmap.md](docs/000-roadmap.md)

## Phase 0: 调研与理论基础 ✅

- [x] **Research: Context Engineering 深度调研** <!-- id: r1 -->
  - [x] 阅读《Context Engineering 2.0》论文，提取核心定义与理论框架 <!-- id: r1a -->
  - [x] 调研 Google ADK、Agno、LangChain/LangGraph 的 Context 实现 <!-- id: r1b -->
  - [x] 产出: `research/001-context-engineering.md` <!-- id: r1c -->
- [x] **Research: Google Agent Builder & ADK 调研** <!-- id: r2 -->
  - [x] 分析 Vertex AI Agent Engine 核心服务架构 <!-- id: r2a -->
  - [x] 提取 Session/State/Memory 概念映射 <!-- id: r2b -->
  - [x] 识别 ADK Service 接口抽象 (SessionService, MemoryService) <!-- id: r2c -->
  - [x] 产出: `research/002-google-agent-builder.md` <!-- id: r2d -->

## Phase 1: Foundation & Unified Schema Design ✅

- [x] **Task 1.1: 部署与环境准备** <!-- id: 5 -->
  - [x] 部署 OceanBase V4.5.0 (Docker/K8s) <!-- id: 6 -->
  - [x] 验证 `VECTOR` 类型与 HNSW 索引参数 <!-- id: 7 -->
- [x] **Task 1.2: "Unified Memory Bank" Schema 设计** <!-- id: 8 -->
  - [x] 设计 Short-term/Episodic/Semantic 三层统一 Schema <!-- id: 9 -->
  - [x] 验证 SQL Join 性能 <!-- id: 10 -->
  - [x] 设计 10 个验证场景 (含 Mock 数据与查询脚本) <!-- id: 10a -->
  - [x] 产出: `docs/001-foundation-unified-schema-design.md` <!-- id: 10b -->

## Phase 2: Memory Management (仿生 Google Memory Bank)

### 核心目标: 实现 Memory Transfer 函数 $f_{transfer}: M_s \rightarrow M_l$

- [ ] **Task 2.1: 异步记忆巩固 (Async Consolidation)** <!-- id: 12 -->
  - [ ] **2.1.1** 开发 `src/simulation/memory_worker.py` <!-- id: 13 -->
    - [ ] 实现 `consolidate_memory(session) -> List[Memory]` 核心函数 <!-- id: 13a -->
    - [ ] 集成 LLM 调用 (OpenAI/Gemini) 提取 Insight <!-- id: 13b -->
    - [ ] 实现向量化 (Embedding) 流程 <!-- id: 13c -->
  - [ ] **2.1.2** 自动化验证场景 <!-- id: 14 -->
    - [ ] 自动化 `docs/001` 场景 2 (User Profiling) <!-- id: 14a -->
    - [ ] 自动化 `docs/001` 场景 3 (Conversation Summarization) <!-- id: 14b -->
  - [ ] **2.1.3** 验证原子化 Consolidation <!-- id: 14c -->
    - [ ] 基于 OceanBase 事务实现 CAS 或原子合并 <!-- id: 14d -->
    - [ ] 验证 `docs/001` 场景 9 (Concurrent Write) 的并发冲突解决 <!-- id: 14e -->
- [ ] **Task 2.2: 一致性验证 (Consistency Verification)** <!-- id: 15 -->
  - [ ] 开发 `src/simulation/benchmark_consistency.py` <!-- id: 16 -->
    - [ ] 压测 "Read-Your-Writes" 可见性延迟 <!-- id: 16a -->
    - [ ] 对比 OceanBase (强一致) vs "PG + Milvus" (最终一致) <!-- id: 16b -->
  - [ ] 产出: `docs/003-oceanbase-evaluation.md` (实测数据报告) <!-- id: 16c -->

## Phase 3: Context Engineering (RAG & Assembler)

### 核心目标: 验证 Context Collection → Management → Usage 全链路

- [ ] **Task 3.1: 统一检索链路 (Unified Retrieval)** <!-- id: 18 -->
  - [ ] **3.1.1** Hybrid Search 基准测试 <!-- id: 19 -->
    - [ ] 实现 SQL+Vector 混合查询 (Semantic + Recency + Frequency) <!-- id: 19a -->
    - [ ] 测量 Recall@10, Latency P50/P99 <!-- id: 19b -->
  - [ ] **3.1.2** 对比测试 <!-- id: 20 -->
    - [ ] Unified (单次 SQL 完成) vs Two-Stage (Vector→SQL) 延迟对比 <!-- id: 20a -->
  - [ ] 产出: `docs/004-context-engineering-benchmark.md` <!-- id: 20b -->
- [ ] **Task 3.2: 动态上下文组装 (Context Budgeting)** <!-- id: 21 -->
  - [ ] 原型: 数据库层 Token 估算 (添加 `estimated_tokens` 列或 UDF) <!-- id: 22a -->
  - [ ] 原型: Top-K 截断逻辑 <!-- id: 22b -->

## Phase 4: Architecture & Ops & DX

- [ ] **Task 4.1: TCO 对比分析** <!-- id: 24 -->
  - [ ] 对比资源消耗: OceanBase vs (Redis+Milvus+MySQL) <!-- id: 25 -->
  - [ ] 模拟单节点故障 & RTO <!-- id: 26 -->
- [ ] **Task 4.2: 跨区验证 (Cross-Region)** <!-- id: 27 -->
  - [ ] 验证 Geo-Replication / 跨区可见性 <!-- id: 28 -->
- [ ] **Task 4.3: Agent Framework 集成 (DX)** <!-- id: 29 -->
  - [ ] **Priority 1: ADK Adapter** <!-- id: 30 -->
    - [ ] 开发 `src/adapters/adk-oceanbase/session_service.py` <!-- id: 30a -->
    - [ ] 开发 `src/adapters/adk-oceanbase/memory_service.py` <!-- id: 30b -->
    - [ ] 实现 `OceanBaseSessionService` (CRUD, state_delta, events) <!-- id: 30c -->
    - [ ] 实现 `OceanBaseMemoryService` (add_session_to_memory, search_memory) <!-- id: 30d -->
  - [ ] **Priority 2: LangGraph Adapter** <!-- id: 31 -->
    - [ ] 实现 `Checkpointer` (State Persistence) <!-- id: 31a -->
    - [ ] 实现 `VectorStore` (Memory Retrieval) <!-- id: 31b -->
  - [ ] **Priority 3: Agno / LlamaIndex** <!-- id: 32 -->
    - [ ] 评估 Agno `Database` 接口兼容性 <!-- id: 32a -->
    - [ ] 评估 LlamaIndex `VectorStoreIndex` 接口兼容性 <!-- id: 32b -->
  - [ ] 产出: `docs/005-dev-experience-report.md` <!-- id: 32c -->

## Phase 5: Demo & Delivery

- [ ] **Task 5.1: "Unified Agent Engine" Demo** <!-- id: 35 -->
  - [ ] 实现端到端 Demo (Session → Memory → Retrieval) <!-- id: 36 -->
    - [ ] Traceability: Session 回放功能 <!-- id: 36a -->
    - [ ] Memory Scope: 用户级 vs 会话级记忆隔离 <!-- id: 36b -->
    - [ ] Context Assembly: 动态上下文组装展示 <!-- id: 36c -->
  - [ ] 产出: `src/prototype/unified_agent_backend.py` <!-- id: 37 -->
- [ ] **Task 5.2: 架构决策白皮书** <!-- id: 38 -->
  - [ ] 综合各阶段验证结果 <!-- id: 38a -->
  - [ ] 产出: `docs/006-architecture-proposal.md` <!-- id: 38b -->

---

## 进度汇总

| 阶段                         | 状态      | 完成度 |
| :--------------------------- | :-------- | :----- |
| Phase 0: 调研                | ✅ 完成   | 100%   |
| Phase 1: Foundation          | ✅ 完成   | 100%   |
| Phase 2: Memory Management   | 🔲 待开始 | 0%     |
| Phase 3: Context Engineering | 🔲 待开始 | 0%     |
| Phase 4: Architecture & DX   | 🔲 待开始 | 0%     |
| Phase 5: Demo & Delivery     | 🔲 待开始 | 0%     |
