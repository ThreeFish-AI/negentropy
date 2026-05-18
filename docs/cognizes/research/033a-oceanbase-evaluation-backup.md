# OceanBase Agent Scenario Evaluation

## 1. 核心结论

OceanBase (V4.3.3+ 及 SeekDB) 是 **极具竞争力的 Agentic AI 统一存储方案**。其核心优势在于 **"单库闭环"** —— 同时满足 Sessions 的高频写入 (LSM-Tree) 和 Memory Bank 的向量检索 (Vector Index)，并提供业界罕见的 **Strong Consistency (Read-your-writes)** 保证。

## 2. 深度能力调研

### 2.1. Vector & AI 能力 (SeekDB)

- **版本**: V4.3.3 引入向量支持，Nov 2025 发布独立 **SeekDB** (AI 专用库)。
- **向量规格**: 支持最高 **16,000 维** 向量 (Dense/Sparse)。
- **索引支持**:
  - **HNSW**: 适合高精度、低延迟的内存检索（Memory Bank 热数据）。
  - **IVF (Inverted File)**: 适合大规模数据的磁盘检索。
- **性能优化**: 引入 "Vectorized Engine" (向量化引擎)，利用 SIMD 指令集加速距离计算。

### 2.2. Hybrid Search (混合检索)

- **机制**: 提供 `DBMS_HYBRID_SEARCH` 包，在数据库内核层对 SQL 过滤结果和 Vector 相似度进行联合排序。
- **场景价值**:
  - 解决了 _"查找关于 'Project X' 的记忆 [SQL] 且语义类似 'Deployment failed' [Vector]"_ 的典型 Agent 回忆场景。
  - 相比 "Elasticsearch (Keyword) + Milvus (Vector)" 的组合方案，减少了数据搬运和打分对齐的复杂度。
- **Benchmark**: 支持使用 **VectorDBBench** 进行标准化测试。

### 2.3. 一致性模型 (The "Read-Your-Writes" Advantage)

在 Agent 快速交互环 (Loop) 中，Agent 刚生成的 Thought/Action 必须立即对下一次 Token 生成可见。

- **强一致性 (Strong Consistency)**: OceanBase 默认的 **Leader Lease** 机制保证 Read-your-writes。
- **优势对比**:
  - **Milvus/Pinecone**: 通常是最终一致性 (Eventual Consistency)，刚插入的向量可能需要几秒索引构建后才能搜到。
  - **OceanBase**: 写入提交即通过 Paxos 同步，且 Leader 提供线性一致性读。这对 **Session -> Insight** 的实时流转至关重要。

## 3. 架构适配性分析

| Agent 组件         | OceanBase 解决方案     | 优势                                                    |
| :----------------- | :--------------------- | :------------------------------------------------------ |
| **Sessions (Log)** | 普通表 (Heap/LSM-Tree) | 写入吞吐高，压缩比高 (LSM-Tree)，天然支持 Append-only。 |
| **Memory Bank**    | 向量列 (Vector Column) | 原生 SQL 关联，无需跨库 Join。                          |
| **Entity State**   | 关系型表 (Relational)  | 完整的 ACID 事务，保证多 Agent 状态更新不冲突。         |

## 4. 潜在挑战与风险

- **资源开销**: HNSW 索引构建对内存消耗较大，需关注 `ob_vector_memory_limit_percentage` 参数调优。
- **生态成熟度**: 相比 pgvector，在 LangChain/LlamaIndex 中的默认适配器可能较少，需自行封装 (但 SeekDB 正在快速补齐)。

## 5. 结论

推荐将 OceanBase 作为 Agentic AI Engine 的 **Primary Storage** (主存储)，承载 Sessions 和 Memory Bank。

- **Next Step**: 在技术选型对比中，重点对比 **OceanBase SeekDB vs AlloyDB (pgvector)**。
