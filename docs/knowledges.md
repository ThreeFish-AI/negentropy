# Knowledge 设计与工程落地（Knowledge Base / Knowledge Graph / User Memory）

> 目标：在最小干预前提下，围绕 Perception 的 Knowledge 存储模型，落地可演进的 Knowledge 后端工程方案，并为 UI 的未来扩展预留稳定接口与流程入口。

## 0. 范围与事实源（Single Source of Truth）

- **底层存储模型**：[apps/negentropy/src/negentropy/models/perception.py](../apps/negentropy/src/negentropy/models/perception.py)（`Corpus` / `Knowledge`）。
- **Memory 模型**：[apps/negentropy/src/negentropy/models/internalization.py](../apps/negentropy/src/negentropy/models/internalization.py)（`Memory` / `Fact` / `MemoryAuditLog`）。
- **数据库权威定义**：[docs/schema/perception_schema.sql](./schema/perception_schema.sql)（`corpus` / `knowledge` 表、索引、触发器、`kb_hybrid_search` / `kb_rrf_search`）。
- **前端扩展约束**：[docs/negentropy-ui-plan.md](./negentropy-ui-plan.md) 的「11. 未来扩展：知识库/知识图谱/用户记忆管理」。
- **调研文档**：[034-knowledge-base.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/research/034-knowledge-base.md)、[035-knowledge-base-platform.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/research/035-knowledge-base-platform.md)。
- **设计文档**：[020-the-hippocampus.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/design/020-the-hippocampus.md)（Memory 遗忘曲线设计）。

## 1. 目标与边界

- **Knowledge Base**：可索引、可检索的静态知识块（文档/FAQ/配置/操作手册）。共享、持久、不受遗忘曲线影响。
- **Knowledge Graph**：基于 Knowledge Base 的抽取结果，提供实体与关系视角。使用 Strategy Pattern 支持可替换的抽取策略。
- **User Memory**：面向用户的长期记忆治理。动态、个人化、受遗忘曲线影响、支持 GDPR 审计。
- **原则**：严格复用现有模型与 DB Schema，新增逻辑仅围绕"索引 → 检索 → 回滚/更新"闭环。

> **Knowledge 与 Memory 的本质区别**：
>
> | 维度 | Knowledge Base | User Memory |
> |------|---------------|-------------|
> | 性质 | 静态文档 | 动态记忆 |
> | 归属 | 共享（按 Corpus） | 个人（按 User） |
> | 生命周期 | 持久存在 | 遗忘曲线衰减 |
> | 治理 | 版本控制 | 审计（Retain/Delete/Anonymize） |
> | 检索 | 混合检索（Semantic + BM25 + RRF） | 语义 + 时间衰减 |

## 2. 领域模型与职责拆分

- **Corpus**：知识库容器（按 app_name + name 唯一），承载检索与索引策略配置。
- **Knowledge**：可检索知识块，包含内容、向量、来源与 metadata。
- **Knowledge Graph**：实体/关系/证据三元组，通过 Strategy Pattern 支持多种抽取策略（正则/LLM）。
- **Memory**：面向用户的情景记忆（Episodic Memory），受遗忘曲线影响，支持 `TimestampMixin` 追踪更新。
- **Fact**：面向用户的语义记忆（Semantic Memory），结构化键值对，同样支持审计治理。
- **MemoryAuditLog**：审计日志，支持幂等性和版本控制。

> 采用 Service + Repository 分层隔离持久化细节，降低后续 Graph/Memory 接入成本。<sup>[[1]](#ref1)</sup>

## 3. 系统架构（后端落地）

```mermaid
%%{init: {"themeVariables": {"primaryColor": "#0b3d91", "primaryTextColor": "#ffffff", "primaryBorderColor": "#0b3d91", "secondaryColor": "#0f5132", "secondaryTextColor": "#ffffff", "secondaryBorderColor": "#0f5132", "tertiaryColor": "#842029", "tertiaryTextColor": "#ffffff", "tertiaryBorderColor": "#842029"}}}%%
flowchart LR
  subgraph API[API Layer]
    KAPI[Knowledge API]
  end

  subgraph Service[Service Layer]
    KSvc[KnowledgeService]
    Rerank[Reranker L1]
    MGov[MemoryGovernance]
  end

  subgraph Repo[Repository Layer]
    KRepo[KnowledgeRepository]
    MemSvc[MemoryService]
  end

  subgraph Storage[Storage Layer]
    Corpus[(corpus)]
    Knowledge[(knowledge)]
    Memory[(memory / fact)]
    HybridFn["kb_hybrid_search()"]
    RRFFn["kb_rrf_search()"]
  end

  KAPI --> KSvc --> KRepo --> Corpus
  KSvc --> Rerank
  KRepo --> Knowledge
  KRepo --> HybridFn
  KRepo --> RRFFn
  MGov --> MemSvc --> Memory

  classDef api fill:#0b3d91,stroke:#0b3d91,color:#ffffff;
  classDef svc fill:#0f5132,stroke:#0f5132,color:#ffffff;
  classDef repo fill:#0f5132,stroke:#0f5132,color:#ffffff;
  classDef store fill:#842029,stroke:#842029,color:#ffffff;

  class KAPI api
  class KSvc,Rerank,MGov svc
  class KRepo,MemSvc repo
  class Corpus,Knowledge,Memory,HybridFn,RRFFn store
```

## 4. 存储模型映射

- **Corpus**：`corpus(app_name, name, description, config)`
- **Knowledge**：`knowledge(corpus_id, app_name, content, embedding, source_uri, chunk_index, metadata)`
- **索引**：HNSW 向量索引 + GIN 全文索引 + JSONB 索引（见 [docs/schema/perception_schema.sql](./schema/perception_schema.sql)）。

## 5. 核心流程

### 5.1 Ingestion（索引构建）

1. `Corpus` 选择/创建
2. 文本分块（Chunking）
3. 向量化（Embedding）
4. 批量写入 `knowledge`
5. 触发器更新 `search_vector`

```mermaid
%%{init: {"themeVariables": {"primaryColor": "#0b3d91", "primaryTextColor": "#ffffff", "primaryBorderColor": "#0b3d91", "actorBorder": "#0b3d91", "actorTextColor": "#ffffff"}}}%%
sequenceDiagram
  participant Client
  participant KnowledgeService
  participant KnowledgeRepository
  participant DB

  Client->>KnowledgeService: ingest_text(corpus_id, text, source_uri)
  KnowledgeService->>KnowledgeService: chunk_text + embed
  KnowledgeService->>KnowledgeRepository: add_knowledge(chunks)
  KnowledgeRepository->>DB: INSERT knowledge
  DB-->>KnowledgeRepository: rows committed
  KnowledgeRepository-->>KnowledgeService: KnowledgeRecords
```

### 5.2 Retrieval（两阶段检索）

采用 **L0 Recall + L1 Reranking** 两阶段检索架构<sup>[[3]](#ref3)</sup>：

**L0 召回阶段**（四种模式）:

- **Semantic**：向量距离排序（`embedding <=> query_embedding`）
- **Keyword**：`search_vector` + BM25 (`ts_rank_cd`)
- **Hybrid**：语义 + 关键词加权融合（`semantic_weight * semantic_score + keyword_weight * keyword_score`）
- **RRF** (Reciprocal Rank Fusion)：对分数尺度不敏感的排名融合算法，公式 `RRF(d) = Σ 1/(k + rank)`<sup>[[4]](#ref4)</sup>

**L1 精排阶段**:

- 使用 Cross-Encoder 对 L0 结果进行精排
- 支持 `LocalReranker`（BGE-Reranker）、`APIReranker`（Cohere）、`CompositeReranker`（多级回退）
- 默认使用 `NoopReranker` 确保向后兼容

```mermaid
%%{init: {"themeVariables": {"primaryColor": "#0b3d91"}}}%%
flowchart LR
  Query["Query"] --> L0["L0: 混合召回"]
  L0 --> Semantic["Semantic<br/>(pgvector)"]
  L0 --> Keyword["Keyword<br/>(BM25)"]
  L0 --> RRF["RRF<br/>(Rank Fusion)"]
  Semantic --> Merge["Score Merge"]
  Keyword --> Merge
  RRF --> Merge
  Merge --> L1["L1: Cross-Encoder<br/>Reranking"]
  L1 --> Results["Top-K Results"]
```

## 6. 工程落地（本次实现）

### 6.1 模块结构

**Knowledge 模块** (`negentropy.knowledge`):

- [types.py](../apps/negentropy/src/negentropy/knowledge/types.py) - 领域类型（SearchMode, ChunkingConfig, SearchConfig, GraphNode/Edge 等）
- [chunking.py](../apps/negentropy/src/negentropy/knowledge/chunking.py) - 文本分块（Fixed/Recursive/Semantic 三种策略）
- [repository.py](../apps/negentropy/src/negentropy/knowledge/repository.py) - 数据访问（CRUD + 四种检索模式），使用 `NEGENTROPY_SCHEMA` 常量
- [service.py](../apps/negentropy/src/negentropy/knowledge/service.py) - 业务逻辑（Ingestion + Search + L1 Reranking 集成）
- [api.py](../apps/negentropy/src/negentropy/knowledge/api.py) - REST API（Dashboard/Base CRUD/Graph/Pipelines）
- [embedding.py](../apps/negentropy/src/negentropy/knowledge/embedding.py) - 向量化（支持指数退避重试 + 超时控制）
- [reranking.py](../apps/negentropy/src/negentropy/knowledge/reranking.py) - L1 精排（Noop/Local/API/Composite 四种策略）
- [graph.py](../apps/negentropy/src/negentropy/knowledge/graph.py) - 知识图谱（Strategy Pattern: EntityExtractor/RelationExtractor）
- [dao.py](../apps/negentropy/src/negentropy/knowledge/dao.py) - 运行记录 DAO（Graph/Pipeline Run，DRY 重构）
- [exceptions.py](../apps/negentropy/src/negentropy/knowledge/exceptions.py) - 统一异常体系
- [constants.py](../apps/negentropy/src/negentropy/knowledge/constants.py) - 常量定义

**Memory 模块** (`negentropy.engine`):

- [engine/governance/memory.py](../apps/negentropy/src/negentropy/engine/governance/memory.py) - 记忆治理（审计决策 + 遗忘曲线 + GDPR）
- [engine/adapters/postgres/memory_service.py](../apps/negentropy/src/negentropy/engine/adapters/postgres/memory_service.py) - 记忆存储（混合检索 + 访问计数追踪）
- [engine/adapters/postgres/fact_service.py](../apps/negentropy/src/negentropy/engine/adapters/postgres/fact_service.py) - 事实存储
- [engine/factories/memory.py](../apps/negentropy/src/negentropy/engine/factories/memory.py) - 工厂
- [engine/summarization.py](../apps/negentropy/src/negentropy/engine/summarization.py) - 会话摘要（从 knowledge/ 迁移至此）

**Models**:

- [models/perception.py](../apps/negentropy/src/negentropy/models/perception.py) - Corpus / Knowledge ORM
- [models/internalization.py](../apps/negentropy/src/negentropy/models/internalization.py) - Memory / Fact / MemoryAuditLog ORM（含 TimestampMixin）
- [models/base.py](../apps/negentropy/src/negentropy/models/base.py) - `NEGENTROPY_SCHEMA`, `TimestampMixin`, `UUIDMixin`

### 6.2 关键职责

- **KnowledgeRepository**：对 `Corpus/Knowledge` 的 CRUD + 四种检索模式（Semantic/Keyword/Hybrid/RRF）。SQL 调用统一使用 `NEGENTROPY_SCHEMA` 常量。
- **KnowledgeService**：编排 ingestion 与检索策略，集成 L1 Reranking（默认 `NoopReranker`），提供扩展点（chunking/embedding/reranker）。
- **MemoryGovernanceService**：记忆审计（Retain/Delete/Anonymize）+ 遗忘曲线计算（指数衰减模型）。审计操作同时覆盖 Memory 和关联 Fact（GDPR 合规）。
- **PostgresMemoryService**：记忆混合检索 + 访问计数自动更新（`access_count += 1`, `last_accessed_at = now()`），使遗忘曲线动态生效。
- **GraphProcessor**：知识图谱构建，委托 `EntityExtractor` / `RelationExtractor`（Strategy Pattern），便于从正则方案迁移到 LLM 方案。
- **ChunkingConfig/SearchConfig**：将策略参数显式化，避免散落在调用侧。<sup>[[1]](#ref1)</sup>
- **Knowledge API**：提供 Dashboard/Base CRUD（含 DELETE 级联删除）/Graph/Pipelines 入口，对齐 UI 结构。
- **Embedding 模块**：内置指数退避重试（max_retries=3, backoff=exponential）和超时控制（30s），通过 `EmbeddingFailed` 异常上报。

### 6.3 异常处理体系

**异常层次结构**（正交分解）：
```
KnowledgeError
├── DomainError
│   ├── CorpusNotFound - 语料库不存在 (404)
│   ├── KnowledgeNotFound - 知识块不存在 (404)
│   └── VersionConflict - 版本冲突 (409)
├── InfrastructureError
│   ├── EmbeddingFailed - 向量化失败 (500)
│   ├── SearchError - 检索失败 (500)
│   └── DatabaseError - 数据库错误 (500)
└── ValidationError
    ├── InvalidChunkSize - 无效分块大小 (400)
    ├── InvalidSearchConfig - 无效搜索配置 (400)
    └── InvalidMetadata - 无效元数据 (400)
```

**HTTP 状态码映射**：
- `400 Bad Request`: 参数验证失败
- `404 Not Found`: 资源不存在
- `409 Conflict`: 版本冲突
- `500 Internal Server Error`: 基础设施错误

### 6.4 性能优化

**批量插入优化**：
- 使用 PostgreSQL 原生 `INSERT` 批量插入
- 替代逐条 ORM 操作，预期提升 3-5 倍写入性能

**混合检索优化**：
- 优先使用数据库原生 `kb_hybrid_search()` 函数
- 自动降级到 Python 端混合检索（回退方案）
- 预期减少 20% 检索延迟

### 6.5 配置验证

**ChunkingConfig 验证规则**：
- `chunk_size`: 1 ~ 100000
- `overlap`: 0 ~ chunk_size * 0.5
- `preserve_newlines`: true/false

**SearchConfig 验证规则**：
- `mode`: 'semantic' | 'keyword' | 'hybrid' | 'rrf'
- `limit`: 1 ~ 1000
- `semantic_weight`, `keyword_weight`: 0.0 ~ 1.0
- `rrf_k`: 平滑常数（默认 60），仅用于 RRF 模式

## 7. Memory 治理与遗忘曲线

### 7.1 遗忘曲线模型

基于 Ebbinghaus 遗忘曲线<sup>[[5]](#ref5)</sup>的指数衰减模型：

```
retention_score = min(1.0, time_decay × frequency_boost / 5.0)
time_decay = e^(-λ × days_elapsed)
frequency_boost = 1 + ln(1 + access_count)
```

- `λ`（衰减常数）：默认 0.1，可自定义。值越大衰减越快。
- `days_elapsed`：距最后访问的天数。
- `access_count`：累计访问次数。频率因子使用对数增长，避免高频访问过度膨胀分数。
- 分数范围：[0.0, 1.0]。

**典型衰减曲线**（λ=0.1, access_count=0）:

| days | time_decay | retention_score |
|------|-----------|----------------|
| 0    | 1.00      | 0.20           |
| 7    | 0.50      | 0.10           |
| 14   | 0.25      | 0.05           |
| 30   | 0.05      | 0.01           |

### 7.2 访问计数追踪

检索记忆时自动记录访问行为，使遗忘曲线动态生效：

```python
# search_memory() 返回结果后，异步更新被召回记忆
UPDATE memories SET
    access_count = access_count + 1,
    last_accessed_at = now()
WHERE id IN (recalled_memory_ids);
```

### 7.3 审计决策

Memory 和关联 Fact 同步处理，确保 GDPR 合规：

- **Retain**：保留记忆，不做操作。
- **Delete**：物理删除 Memory + 关联 Fact（通过 thread_id 关联）。
- **Anonymize**：Memory 内容替换为 `[ANONYMIZED]`，清除 embedding 和 metadata；Fact 值替换为 `{"anonymized": True}`，清除 embedding。

### 7.4 版本控制与幂等性

- 乐观锁：`expected_versions` 参数用于检测版本冲突。
- 幂等性键：`idempotency_key` 防止重复提交。
- 审计历史：每次决策创建 `MemoryAuditLog` 记录。

## 8. 扩展点与策略接口

- **EntityExtractor**（ABC）：实体提取策略。当前实现 `RegexEntityExtractor`（正则），预留 `LLMEntityExtractor` 接口。
- **RelationExtractor**（ABC）：关系提取策略。当前实现 `CooccurrenceRelationExtractor`（共现），预留 `LLMRelationExtractor` 接口。
- **Reranker**（ABC）：L1 精排策略。已实现 `NoopReranker` / `LocalReranker` (BGE) / `APIReranker` (Cohere) / `CompositeReranker`（多级回退）。
- **Pipeline Jobs**：支持"全量重建 / 增量更新 / 回滚"，与 UI 的 Pipelines 视图对齐。DAO 层已消除重复代码（通用 `_upsert_run()` 方法）。

## 9. 可观测与反馈闭环

- **日志**：ingestion 起止、chunk 数量、写入耗时。
- **指标**：检索命中率、向量检索耗时、索引失败数。
- **验证**：最小回归（写入 + 检索 + 回滚）。

### 9.1 结构化日志

**索引流程日志**：
```python
logger.info("ingestion_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            text_length=len(text),
            source_uri=source_uri,
            chunk_size=config.chunk_size,
            overlap=config.overlap)

logger.info("chunks_created",
            corpus_id=str(corpus_id),
            chunk_count=len(chunks))

logger.info("embeddings_attached",
            corpus_id=str(corpus_id),
            chunk_count=len(chunks))

logger.info("ingestion_completed",
            corpus_id=str(corpus_id),
            record_count=len(records))
```

**检索流程日志**：
```python
logger.info("search_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            mode=config.mode,
            limit=config.limit,
            query_preview=query[:100])

logger.info("search_completed",
            corpus_id=str(corpus_id),
            mode=config.mode,
            semantic_count=len(semantic_matches),
            keyword_count=len(keyword_matches),
            merged_count=len(results))
```

### 9.2 错误追踪

**API 层错误日志**：
```python
logger.warning("corpus_not_found", details=exc.details)
logger.warning("version_conflict", details=exc.details)
logger.warning("validation_error", details=exc.details)
logger.error("infrastructure_error", details=exc.details)
logger.error("database_error", details=exc.details)
```

### 9.3 性能监控

**关键指标**：
- 索引速度: chunks/秒
- 搜索延迟: P95 < 100ms
- 向量化延迟: P95 < 500ms
- 数据库查询延迟: P95 < 50ms

**监控集成**：
- Langfuse 追踪（利用现有 `ObservabilitySettings`）
- Prometheus 指标（可选）
- 结构化日志解析（Elasticsearch/Loki）

## 10. 风险与边界控制

- **向量模型变更**：不同 embedding 维度需隔离或重建 corpus。
- **检索漂移**：混合检索权重需可配置化并可回滚。
- **元数据污染**：`metadata` 需严格约束 schema 与来源。
- **Embedding API 不稳定**：已内置指数退避重试（3 次）和超时控制（30s），通过 `EmbeddingFailed` 异常上报。
- **SQL 注入**：Memory 混合检索的 embedding 参数已改为参数化绑定（非字符串拼接），并统一使用 schema 前缀。

## 参考文献

<a id="ref1"></a>[1] E. Gamma, R. Helm, R. Johnson, and J. Vlissides, "Design Patterns: Elements of Reusable Object-Oriented Software," _Addison-Wesley Professional_, 1994.

<a id="ref2"></a>[2] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," arXiv:2005.11401, 2020.

<a id="ref3"></a>[3] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks," _arXiv preprint arXiv:1908.10084_, 2019.

<a id="ref4"></a>[4] G. V. Cormack, C. L. A. Clarke, and S. Buettcher, "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods," _SIGIR'09_, 2009.

<a id="ref5"></a>[5] H. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," _Teachers College, Columbia University_, 1885/1913.

## 11. User Guide (使用指南)

本节介绍 Knowledge 系统的核心功能与操作流程。

### 11.1 Knowledge Base (知识库管理)

作为静态知识的容器，支持对非结构化文档的索引与混合检索。

- **Corpus 创建**：定义知识库边界（如 `product-manuals`），配置切片策略（Chunk Size / Overlap）。
- **Corpus 删除**：`DELETE /knowledge/base/{corpus_id}`，级联删除所有关联 Knowledge 记录。
- **Ingestion (写入)**：将文本/文件切片并向量化。
  - _Chunking_: 支持 Fixed/Recursive/Semantic 三种策略，自动按配置切分。
  - _Embedding_: 调用配置模型（如 `text-embedding-3-small`），内置重试机制。
- **Search (检索)**：提供四种模式调试检索效果。
  - `Semantic`: 纯向量相似度（召回语义相关）。
  - `Keyword`: BM25 关键词匹配（召回精确匹配）。
  - `Hybrid`: 加权融合（默认），兼顾语义与精准度。
  - `RRF`: Reciprocal Rank Fusion，对分数尺度不敏感的融合算法。

### 11.2 Knowledge Graph (知识图谱视图)

提供实体关系的动态可视化与人工修正能力。

- **Visualization**: 力导向图（Force-Directed Graph）展示实体（Entity）与关系（Edge）。
  - _交互_: 支持缩放、平移、节点拖拽固定。
- **Extraction & Write-back**:
  - 系统自动从 Knowledge Base 抽取三元组（当前使用正则抽取，可通过 Strategy Pattern 替换为 LLM 抽取）。
  - **写回 (Upsert)**: 用户可在 UI 上确认图谱状态，点击"写回图谱"将其固化到后端版本库。

### 11.3 User Memory (用户记忆治理)

面向 User ID 的长期记忆审计与干预。

- **Timeline**: 按时间轴展示用户相关的记忆片段（来源于交互或文档）。
- **Retention Score**: 基于遗忘曲线计算记忆保留分数（0.0 ~ 1.0），分数越低表示记忆越可能被遗忘。
- **Audit (审计)**: 对记忆片段进行治理，操作同时影响 Memory 和关联 Fact：
  - `Retain`: 保留（默认）。
  - `Delete`: 物理删除 Memory + 关联 Fact。
  - `Anonymize`: 匿名化处理（保留统计价值但移除 PII）。
- **Policy**: 展示当前生效的记忆保留策略（遗忘曲线参数 λ / 访问频率权重）。

### 11.4 Pipelines (流水线监控)

监控 Knowledge 系统内部的异步任务与数据流转。

- **Runs**: 查看所有触发的任务（如 Ingestion, Graph Extraction, Memory Sync）。
  - _状态_: `Completed` (绿), `Running` (黄), `Failed` (红).
- **Debug**: 点击任务可查看详细的 Input / Output / Error 堆栈，辅助定位构建失败原因（如 Embedding API 超时、数据库约束冲突）。

## 12. 测试覆盖

### 12.1 单元测试

```bash
cd apps/negentropy
uv run pytest tests/unit_tests/knowledge/ -v        # Knowledge 模块
uv run pytest tests/unit_tests/engine/ -v            # Memory 治理
```

- **Knowledge**: chunking / types / reranking 测试
- **Memory Governance**: 遗忘曲线（新鲜记忆/高频访问/长期未访问/指数衰减公式/边界值/自定义 λ）

### 12.2 集成测试（需要 PostgreSQL）

```bash
uv run pytest tests/integration_tests/knowledge/ -v
uv run pytest tests/integration_tests/engine/adapters/postgres/ -v
```
