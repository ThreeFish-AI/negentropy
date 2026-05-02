# Memory 模块白皮书 —— 理论基础与设计取舍

> 本文档是 [`memory.md`](./memory.md) 的理论补丁，集中沉淀 Memory 模块的认知科学/信息检索/Agent 系统三类引文，附跨框架对比矩阵。日常使用请直接参考 [`user-guide/memory-basics.md`](./user-guide/memory-basics.md)。

---

## 1. 设计哲学：从认知科学到 Agent 工程

### 1.1 三分法：Episodic / Semantic / Procedural

Tulving 1972 年的经典三分类<sup>[[1]](#ref1)</sup>是 Phase 4 类型分层的理论锚点：
- **Episodic**：情景记忆（发生在何时何地）
- **Semantic**：语义记忆（事实与概念）
- **Procedural**：程序性记忆（如何完成任务）

我们在 Phase 4 将业界普遍使用但缺乏差异化的 `memory_type` 字段从「枚举占位」演进到「差异化机制」：每类记忆有独立的衰减率（`_MEMORY_TYPE_DECAY_RATES`）、重要性权重（`_MEMORY_TYPE_IMPORTANCE_WEIGHT`）和检索路由偏好。

### 1.2 互补学习系统（CLS）：长期巩固 + 工作记忆

McClelland 等 1995 年的 CLS 理论<sup>[[2]](#ref2)</sup>将「快速情景学习」（海马）与「慢速语义巩固」（皮层）解耦。Phase 4 引入的 **Core Memory Block** 与 **Episodic** 记忆形成对偶：
- Core Block 充当工作记忆 + 显性常驻摘要（人为/Agent 主控、不衰减）
- Episodic Memory 持续涌入并按 Ebbinghaus 衰减<sup>[[8]](#ref8)</sup>，重要的内容由 Summarizer 自动凝练或被 Self-edit 工具升格到 Core Block

### 1.3 ACT-R 与基础水平激活

Anderson 等的 ACT-R<sup>[[9]](#ref9)</sup>提供了 `importance_score` 五因子公式的理论支撑：
$$
B_i = \ln\!\left(\sum_{j=1}^{n}{t_j^{-d}}\right)
$$
其中 \(t_j\) 是历次访问距今的时间，\(d\) 是衰减常数。我们的实现见 [`engine/governance/memory.py`](../apps/negentropy/src/negentropy/engine/governance/memory.py) `calculate_importance_score`，扩展了类型权重 + 时效性加成。

### 1.4 AGM 信念修正：冲突消解的形式基础

Alchourrón-Gärdenfors-Makinson 框架<sup>[[10]](#ref10)</sup>定义了 contraction（移除）/ revision（修正）/ expansion（扩展）三种信念集变换。Phase 3 的冲突消解（`engine/governance/conflict_resolver.py`）正是 revision 的工程化：当新事实与现有事实矛盾，按置信度差择一并保留 supersede 链。

---

## 2. Phase 4 增强的理论支撑速览

| Phase 4 增强 | 理论 / 论文 | 工程参考 |
|----|----|----|
| 类型分层差异化 | Tulving 1972<sup>[[1]](#ref1)</sup>；CLS<sup>[[2]](#ref2)</sup> | LangGraph Memory（Semantic/Episodic/Procedural）|
| Core Memory Block | MemGPT<sup>[[3]](#ref3)</sup> Hierarchical Memory | Letta MemGPT 的 core / archival 三层 |
| Self-editing Memory Tools | MemGPT<sup>[[3]](#ref3)</sup>；Reflexion<sup>[[4]](#ref4)</sup> | Letta `core_memory_replace` / archival_insert |
| LoCoMo / LongMemEval 评测 | Maharana 2024<sup>[[5]](#ref5)</sup>；Wu 2024<sup>[[6]](#ref6)</sup>；mem0<sup>[[7]](#ref7)</sup> | mem0 论文 baseline 对比 |
| Query Intent 路由 | Tulving 三分法<sup>[[1]](#ref1)</sup> | 自研启发式 |
| Episodic 快衰减 / Semantic 慢衰减 | Ebbinghaus<sup>[[8]](#ref8)</sup>；FadeMem<sup>[[19]](#ref19)</sup> | mem0 多衰减率 |
| KG 双向同步 | HippoRAG<sup>[[11]](#ref11)</sup>；GraphRAG<sup>[[12]](#ref12)</sup> | HippoRAG 神经符号检索 |

---

## 3. 跨框架对比矩阵

| 维度 | mem0 | cognee | LangGraph | Letta (MemGPT) | Google ADK | Negentropy（本项目）|
|----|----|----|----|----|----|----|
| **写入策略** | 早期 LLM ADD/UPDATE/DELETE/NOOP，新版退化为 ADD-only + 检索期排序 | DataPoint 抽象 + Cognify 管线（chunk→entity→graph→memify）| 显式 namespace + JSON Patch update | self-editing tools 主控 | `add_session_to_memory` 显式归档 | **巩固管线** + Phase 4 self-edit 工具，二者并存 |
| **检索策略** | Hybrid search（vector + BM25 + recency）| GraphRAG-style 多跳 | namespace 内向量检索 | recall + archival 检索分层 | RAG 风 + LoadMemory tool | **Hybrid (BM25+pgvector) + Query-Aware + 类型加权 + 关联多跳** |
| **记忆分层** | user / agent / session / app | DataPoint type system | Semantic / Episodic / Procedural | Core / Recall / Archival | Session vs Memory | **Core / Episodic / Semantic / Procedural / Preference / Fact** |
| **衰减机制** | retention_score + 用户访问频率 | 默认无（依赖 LLM 重判定）| 默认无（用户管理）| 由 Agent 自主 archive | 无 | **多因子 Ebbinghaus + 类型差异化 λ** |
| **评测指标** | LoCoMo + LongMemEval baseline | 无标准 benchmark | 无 | 无 | 无 | **LoCoMo-mini + LongMemEval-mini（CI 触发）** |
| **KG 集成** | 可选 Neo4j | DataPoint → graph 一等公民 | 无 | 无 | 无 | **PostgreSQL 一等公民 + association.entity 双向同步** |
| **隐私治理** | 无 | 无 | 无 | 无 | 无 | **PII 占位 + audit_log + idempotency** |
| **可观测性** | 简易 | 无 | 无 | 无 | 无 | **search_level / score_type / 检索反馈闭环 + Rocchio**|

> 数据采集时间：2026-05；mem0/cognee 处于活跃迭代，能力可能再演进。

---

## 4. 未来路线（Phase 5+）

| 方向 | 价值 | 复杂度 | 论文 |
|---|---|---|---|
| HippoRAG 神经符号检索（PPR on KG）| KG ↔ Memory 联合检索，长尾召回 | 中-大 | [11] |
| Reflexion Episodic Replay | 失败反思 → few-shot 召回 | 小-中 | [4] |
| Memify 后处理插件管线 | 巩固后多 LLM 任务并行（cognee 风格）| 中 | [13] |
| LongMem 全量评测 | 1000+ 样本规模化对比 | 小 | [14] |
| Presidio PII 引擎 | 真正合规级的 PII 检测/掩码 | 中 | NIST SP 800-122 |
| 英文版本 user-guide | 国际化 | 小 | — |

---

## 5. 引文清单（IEEE）

<a id="ref1"></a>[1] E. Tulving, "Episodic and semantic memory," in *Organization of Memory*, E. Tulving and W. Donaldson, Eds. New York: Academic Press, 1972, pp. 381–403.

<a id="ref2"></a>[2] J. L. McClelland, B. L. McNaughton, and R. C. O'Reilly, "Why there are complementary learning systems in the hippocampus and neocortex: Insights from the successes and failures of connectionist models of learning and memory," *Psychological Review*, vol. 102, no. 3, pp. 419–457, 1995.

<a id="ref3"></a>[3] C. Packer et al., "MemGPT: Towards LLMs as Operating Systems," arXiv:2310.08560, 2023.

<a id="ref4"></a>[4] S. Yao et al., "Reflexion: Language agents with verbal reinforcement learning," *Adv. Neural Inf. Process. Syst.*, vol. 36, pp. 8634–8652, 2023.

<a id="ref5"></a>[5] A. Maharana et al., "Evaluating very long-term conversational memory of LLM agents," in *Proc. ACL*, 2024.

<a id="ref6"></a>[6] D. Wu et al., "LongMemEval: Benchmarking chat assistants on long-term memory," arXiv:2410.10813, 2024.

<a id="ref7"></a>[7] T. Chhikara et al., "Mem0: Building production-ready AI agents with scalable long-term memory," arXiv:2504.19413, 2025.

<a id="ref8"></a>[8] H. Ebbinghaus, *Memory: A Contribution to Experimental Psychology*. New York: Teachers College, Columbia University, 1885 (Ruger and Bussenius transl., 1913).

<a id="ref9"></a>[9] J. R. Anderson, "ACT: A simple theory of complex cognition," *American Psychologist*, vol. 51, no. 4, pp. 355–365, 1996.

<a id="ref10"></a>[10] C. E. Alchourrón, P. Gärdenfors, and D. Makinson, "On the logic of theory change: Partial meet contraction and revision functions," *J. Symbolic Logic*, vol. 50, no. 2, pp. 510–530, 1985.

<a id="ref11"></a>[11] B. Jiménez-Gutiérrez et al., "HippoRAG: Neurobiologically inspired long-term memory for large language models," in *Proc. NeurIPS*, 2024.

<a id="ref12"></a>[12] D. Edge et al., "From local to global: A graph RAG approach to query-focused summarization," arXiv:2404.16130, 2024.

<a id="ref13"></a>[13] cognee documentation, "Memify post-processing pipeline," <https://docs.cognee.ai/core-concepts/main-operations/memify> (accessed 2026-05).

<a id="ref14"></a>[14] J. Wang et al., "LongMem: Augmenting language models with long-term memory," in *Proc. NeurIPS*, vol. 36, 2023.

<a id="ref19"></a>[19] FadeMem authors, "Multi-factor adaptive forgetting curves for autonomous agents," arXiv:2601.18642, 2026.

---

## 6. 附录：Phase 4 评测基线快照

> 首次 BM25 baseline（2026-05-02 跑出）见 `.temp/eval/baseline_*.md`。CI 触发参考 [`memory-eval` workflow](../.github/workflows/memory-eval.yml)。

| Dataset | N | MRR@10 | NDCG@10 | Hit@10 | F1 |
|----|----|----|----|----|----|
| LoCoMo-mini | 30 | 0.933 | 0.947 | 1.000 | 0.216 |
| LongMemEval-mini | 30 | 0.867 | 0.902 | 1.000 | 0.257 |

> 这是 **算法层**（BM25-only）基线；后续与 PostgresMemoryService 的 Hybrid 对比应有 5%+ 提升。
