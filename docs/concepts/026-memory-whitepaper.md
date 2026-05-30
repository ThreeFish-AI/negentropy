---
id: memory-whitepaper
sidebar_position: 2.6
title: Memory 模块白皮书 —— 理论基础与设计取舍
last_update:
  author: Aurelius Huang
tags:
  - Memory System
  - Whitepaper
  - Cognitive Science
  - Information Retrieval
---

# Memory 模块白皮书 —— 理论基础与设计取舍

> 本文档是 [`025-the-memory-system.md`](./025-the-memory-system.md) 的理论补丁，集中沉淀 Memory 模块的认知科学/信息检索/Agent 系统三类引文，附跨框架对比矩阵。日常使用请直接参考 [`memory-basics`](./user-guide/memory-basics.md)。

---

## 1. 设计哲学：从认知科学到 Agent 工程

### 1.1 类型分层：Episodic / Semantic / Procedural

Tulving 1972 年的经典二分法（Episodic / Semantic）<sup>[[1]](#ref1)</sup>，经 Squire 1987 等后续扩展为包含 Procedural 的多分类体系，是 Phase 4 类型分层的理论锚点：
- **Episodic**：情景记忆（发生在何时何地）
- **Semantic**：语义记忆（事实与概念）
- **Procedural**：程序性记忆（如何完成任务）

我们在 Phase 4 将业界普遍使用但缺乏差异化的 `memory_type` 字段从「枚举占位」演进到「差异化机制」：每类记忆有独立的衰减率（`_MEMORY_TYPE_DECAY_RATES`）、重要性权重（`_MEMORY_TYPE_IMPORTANCE_WEIGHT`）和检索路由偏好。

### 1.2 互补学习系统（CLS）：长期巩固 + 工作记忆

McClelland 等 1995 年的 CLS 理论<sup>[[2]](#ref2)</sup>将「快速情景学习」（海马）与「慢速语义巩固」（皮层）解耦。Phase 4 引入的 **Core Memory Block** 与 **Episodic** 记忆形成对偶：
- Core Block 充当工作记忆 + 显性常驻摘要（人为/Agent 主控、不衰减）
- Episodic Memory 持续涌入并按 Ebbinghaus 衰减<sup>[[8]](#ref8)</sup>，重要的内容由 Summarizer 自动凝练或被 Self-edit 工具升格到 Core Block

### 1.3 ACT-R 与基础水平激活

Anderson 等的 ACT-R<sup>[[9]](#ref9)</sup>提供了 `importance_score` 五因子公式的理论基础（base-level activation 方程）：
$$
B_i = \ln\!\left(\sum_{j=1}^{n}{t_j^{-d}}\right)
$$
其中 \(t_j\) 是历次访问距今的时间，\(d\) 是衰减常数。我们的实现见 [`engine/governance/memory.py`](../../../../apps/negentropy/src/negentropy/engine/governance/memory.py) `calculate_importance_score`，扩展了类型权重 + 时效性加成。

### 1.4 AGM 信念修正：冲突消解的形式基础

Alchourrón-Gärdenfors-Makinson 框架<sup>[[10]](#ref10)</sup>定义了 contraction（移除）/ revision（修正）/ expansion（扩展）三种信念集变换。Phase 3 的冲突消解（`engine/governance/conflict_resolver.py`）正是 revision 的工程化：当新事实与现有事实矛盾，按置信度差择一并保留 supersede 链。

---

## 2. Phase 4 增强的理论支撑速览

| Phase 4 增强                      | 理论 / 论文                                                                                       | 工程参考                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 类型分层差异化                    | Tulving 1972<sup>[[1]](#ref1)</sup>；CLS<sup>[[2]](#ref2)</sup>                                   | LangGraph Memory（Semantic/Episodic/Procedural） |
| Core Memory Block                 | MemGPT<sup>[[3]](#ref3)</sup> Hierarchical Memory                                                 | Letta MemGPT 的 core / archival 三层             |
| Self-editing Memory Tools         | MemGPT<sup>[[3]](#ref3)</sup>；Reflexion<sup>[[4]](#ref4)</sup>                                   | Letta `core_memory_replace` / archival_insert    |
| LoCoMo / LongMemEval 评测         | Maharana 2024<sup>[[5]](#ref5)</sup>；Wu 2024<sup>[[6]](#ref6)</sup>；mem0<sup>[[7]](#ref7)</sup> | mem0 论文 baseline 对比                          |
| Query Intent 路由                 | Tulving 三分法<sup>[[1]](#ref1)</sup>                                                             | 自研启发式                                       |
| Episodic 快衰减 / Semantic 慢衰减 | Ebbinghaus<sup>[[8]](#ref8)</sup>；FadeMem<sup>[[21]](#ref21)</sup>                               | mem0 多衰减率                                    |
| KG 双向同步                       | HippoRAG<sup>[[11]](#ref11)</sup>；GraphRAG<sup>[[12]](#ref12)</sup>                              | HippoRAG 神经符号检索                            |

---

## 3. 跨框架对比矩阵

| 维度         | mem0                                                              | cognee                                                     | LangGraph                          | Letta (MemGPT)             | Google ADK                       | Negentropy（本项目）                                            |
| ------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- | -------------------------- | -------------------------------- | --------------------------------------------------------------- |
| **写入策略** | 早期 LLM ADD/UPDATE/DELETE/NOOP，新版退化为 ADD-only + 检索期排序 | DataPoint 抽象 + Cognify 管线（chunk→entity→graph→memify） | 显式 namespace + JSON Patch update | self-editing tools 主控    | `add_session_to_memory` 显式归档 | **巩固管线** + Phase 4 self-edit 工具，二者并存                 |
| **检索策略** | Hybrid search（vector + BM25 + recency）                          | GraphRAG-style 多跳                                        | namespace 内向量检索               | recall + archival 检索分层 | RAG 风 + LoadMemory tool         | **Hybrid (BM25+pgvector) + Query-Aware + 类型加权 + 关联多跳**  |
| **记忆分层** | user / agent / session / app                                      | DataPoint type system                                      | Semantic / Episodic / Procedural   | Core / Recall / Archival   | Session vs Memory                | **Core / Episodic / Semantic / Procedural / Preference / Fact** |
| **衰减机制** | retention_score + 用户访问频率                                    | 默认无（依赖 LLM 重判定）                                  | 默认无（用户管理）                 | 由 Agent 自主 archive      | 无                               | **多因子 Ebbinghaus + 类型差异化 λ**                            |
| **评测指标** | LoCoMo + LongMemEval baseline                                     | 无标准 benchmark                                           | 无                                 | 无                         | 无                               | **LoCoMo-mini + LongMemEval-mini（CI 触发）**                   |
| **KG 集成**  | 可选 Neo4j                                                        | DataPoint → graph 一等公民                                 | 无                                 | 无                         | 无                               | **PostgreSQL 一等公民 + association.entity 双向同步**           |
| **隐私治理** | 无                                                                | 无                                                         | 无                                 | 无                         | 无                               | **PII 占位 + audit_log + idempotency**                          |
| **可观测性** | 简易                                                              | 无                                                         | 无                                 | 无                         | 无                               | **search_level / score_type / 检索反馈闭环 + Rocchio**          |

> 数据采集时间：2026-05；mem0/cognee 处于活跃迭代，能力可能再演进。

---

## 4. Phase 5 四方向落地记录（2026-05 启动）

> Phase 5 聚焦白皮书既定的四个高/中优先级缺口。这些特性自 Phase 8（§4.10）起**默认启用、开箱即用**（各带运行时安全闸，可一键关闭），工程契约见 [`025-the-memory-system.md`](./025-the-memory-system.md) §10 与 [`memory-basics`](./user-guide/memory-basics.md) "高级特性（默认开箱即用）"。

### 4.1 F1 — HippoRAG 神经符号检索（PPR-Boosted Hybrid）

**原理**：海马体记忆索引启发的神经符号检索<sup>[[11]](#ref11)</sup>——将 query 经 entity linking 锚定到知识图谱（KG）种子节点，沿语义/关联/时序边做 Personalized PageRank<sup>[[15]](#ref15)</sup>加权扩散，把图遍历得到的高激活记忆作为新通道与现有 Hybrid（BM25 + pgvector）结果用 Reciprocal Rank Fusion (RRF)<sup>[[16]](#ref16)</sup>融合。

**工程参考**：HippoRAG 官方实现复用 NetworkX；本项目复用 Apache AGE 的 Cypher 直接做 BFS 加权扩散，不引入新依赖。集成点为 `engine/adapters/postgres/memory_service.py:search_memory()` 与 `association_service.py:expand_via_ppr()`，作为现有 4 级回退之上的"第 5 通道"。

**状态**：✅ 已交付（默认 `MEMORY_HIPPORAG_ENABLED=false`，超时 / 0 种子 / KG 数据不足三种降级路径）。

### 4.2 F2 — Reflexion Episodic Replay（失败反思 + Few-Shot 召回）

**原理**：Reflexion 范式<sup>[[4]](#ref4)</sup>把语言模型的失败反馈转化为"语言形式的强化信号"——本项目复用现有 RetrievalTracker 的 `helpful/irrelevant/harmful` 反馈通道：当 outcome ∈ {irrelevant, harmful} 时异步生成反思（LLM + Pattern 兜底），以 `episodic` 子类型（`metadata.subtype='reflection'`）回写记忆库；下次同类查询（Query Intent ∈ {procedural, episodic}）自动 few-shot 注入 ContextAssembler。

**工程参考**：复用 `LLMFactExtractor` 的 retry + JSON output + pattern fallback 模式；不改 schema（仅扩展 metadata）；新增 `reflection_dedup`（`sha1(query) + 7 天内 cosine ≥ 0.92` 跳过）防止反思过载。

**状态**：✅ 已交付（默认 `MEMORY_REFLECTION_ENABLED=false`，dedup + 单用户日上限防过载，LLM 失败 pattern 兜底）。

### 4.3 F3 — Memify 后处理插件管线（Consolidation Plugin Pipeline）

**原理**：cognee Memify<sup>[[13]](#ref13)</sup>把"事实抽取 → 结构化 → 推理"解耦为可组合的 cognify-step。本项目把 `add_session_to_memory` 中硬编码的 "fact_extract → summarize" 两步重构为 `ConsolidationPipeline + ConsolidationStep` 协议（GoF Strategy + Chain of Responsibility<sup>[[17]](#ref17)</sup>），支持 serial / parallel / fail_tolerant 三策略，新增 step（实体规范化、主题聚类、PII Scrub）通过注册即可生效。

**工程参考**：默认行为不回归——老的 fact_extract / summarize 包装为内置 step，按原顺序执行；feature flag `memory.consolidation.legacy=true` 一键回退。

**状态**：✅ 已交付（默认 `policy=serial`、`steps=[fact_extract, auto_link]`，与 Phase 4 行为等价；`legacy=true` 一键回退）。

### 4.4 F4 — Presidio 生产级 PII（合规级隐私治理）

**原理**：将 Phase 4 的 regex 占位升级为 Microsoft Presidio<sup>[[18]](#ref18)</sup>双引擎（NER + Pattern + Context 三段融合），覆盖 NIST SP 800-122<sup>[[19]](#ref19)</sup>定义的 identifying / linkable PII 类别；写入路径接入 `mark / mask / anonymize` 三策略；检索路径增加 `PIIGatekeeper` 按 ACL 决定低权限用户是否看到 anonymized 副本，落实 GDPR Art. 17 / Art. 25<sup>[[20]](#ref20)</sup>合规闭环。

**工程参考**：`PIIDetectorBase` 抽象 + `RegexPIIDetector`（保留）+ `PresidioPIIDetector`（新）适配器模式；Presidio 作为 `[project.optional-dependencies] pii-presidio` 可选依赖；导入失败 factory 自动 fallback regex。

**状态**：✅ 已交付（默认 `memory.pii.engine=regex`，Presidio 作为 `[project.optional-dependencies] pii-presidio` 可选依赖；导入失败 factory 自动 fallback）。

### 4.5 路线表（Phase 5 + 后续）

| 方向                                  | 价值                                   | 复杂度 | 论文 / 资源      | 状态     |
| ------------------------------------- | -------------------------------------- | ------ | ---------------- | -------- |
| F1 HippoRAG 神经符号检索（PPR on KG） | KG ↔ Memory 联合检索，长尾召回         | 中-大  | [11], [15], [16] | ✅ 已交付 |
| F2 Reflexion Episodic Replay          | 失败反思 → few-shot 召回               | 小-中  | [4]              | ✅ 已交付 |
| F3 Memify 后处理插件管线              | 巩固后多 LLM 任务可组合（cognee 风格） | 中     | [13], [17]       | ✅ 已交付 |
| F4 Presidio PII 引擎                  | 合规级 PII 检测/掩码                   | 中     | [18], [19], [20] | ✅ 已交付 |
| F5 Rocchio 相关性反馈闭环             | 反馈驱动排序优化 + PRF 查询扩展        | 小-中  | [22], [23]       | ✅ 已交付 |
| F6 巩固管线 Step 补全                 | 6-step 完整管线（聚类/去重/规范化）    | 中     | [3], [13]        | ✅ 已交付 |
| LongMem 全量评测                      | 1000+ 样本规模化对比                   | 小     | [14]             | 📋 未启动 |
| 英文版本 user-guide                   | 国际化                                 | 小     | —                | 📋 未启动 |

> ✅ 已交付：契约已固化（配置项、API 签名、降级策略），代码实施迭代式推进。

### 4.6 F5 — Rocchio 相关性反馈闭环（Phase 6 G1）

**原理**：Rocchio (1971)<sup>[[22]](#ref22)</sup>相关性反馈将累积的 helpful/irrelevant 反馈转化为 per-memory 排序权重。权重公式 `weight = 1.0 + β·helpful_ratio - γ·irrelevant_ratio`，clamp 到 [0.5, 2.0] 防止极端值。周期性聚合任务从 `memory_retrieval_logs` 表统计反馈，写入 `memories.metadata_.relevance_weight`；搜索路径在 intent rerank 后乘以该权重。

此外引入 Pseudo-Relevance Feedback (PRF)<sup>[[23]](#ref23)</sup>查询扩展：取 top-K 初检结果的 embedding 质心，与原始查询向量按 `prf_alpha` 融合后重跑向量检索。

**工程参考**：mem0 使用访问频率排序；Elasticsearch LTR 插件。

**状态**：✅ 已交付（默认 `NE_MEMORY_RELEVANCE__ENABLED=false`，权重由异步聚合任务预计算，搜索路径仅乘法操作 <1ms 开销）。

### 4.7 F6 — 巩固管线 Step 补全（Phase 6 G2）

**原理**：CLS 理论<sup>[[3]](#ref3)</sup>要求碎片记忆经多阶段提炼。Phase 5 F3 仅注册 2 step（fact_extract + auto_link），Phase 6 补全为 6 step 完整管线：

1. **fact_extract** — LLM/Pattern 事实提取（已有）
2. **entity_normalization** — 实体规范化（已有，Phase 6 注册到默认列表）
3. **topic_cluster** — 基于 pgvector 余弦距离的 single-linkage 聚类，生成主题标签写入 `metadata_.topics`（新增）
4. **dedup_merge** — 近重复合并（cosine >= 0.90），保留高 retention 版本，soft-delete 低分版本，内容追加到 `metadata_.merged_from`（新增）
5. **summarize** — 用户画像摘要（已有，Phase 6 注册到默认列表）
6. **auto_link** — 自动关联建立（已有）

**工程参考**：cognee Cognify 多步管线；Google ADK checkpointing。

**状态**：✅ 已交付（默认 policy 升级为 `fail_tolerant`，新 step 失败不阻塞主流程；`legacy=true` 一键回退 Phase 4 行为）。

### 4.8 Phase 6 G3/G4 — 测试覆盖 + 可观测性

**G3 测试覆盖**：从 ~62 个测试扩展到 ~420+，覆盖率 ~15% → ~19%（engine 模块）。新增覆盖：RRF 融合、巩固管线辅助方法、去重检测、重要性/Retention 评分、Rocchio 权重、PipelineContext 协议。

**G4 可观测性**：新增 `GET /memory/health`（无需鉴权）和 `GET /memory/metrics`（需 admin）端点。指标基于 SRE 四大黄金信号<sup>[[24]](#ref24)</sup>从现有表聚合，无 schema 变更。配置：`NE_MEMORY_OBSERVABILITY__HEALTH_ENABLED=true`、`NE_MEMORY_OBSERVABILITY__METRICS_ENABLED=true`。

### 4.9 Phase 7: 闭环验证 + 冲突桥接 + Rocchio 自动化

| Gap | 变更                                                                                                              | 理论基础                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| G1  | Consolidation Pipeline 3 个核心 Step（EntityNormalization / TopicCluster / DedupMerge）补全单元测试，覆盖率 ≥ 80% | CLS (McClelland 1995)<sup>[[2]](#ref2)</sup> 巩固正确性验证       |
| G2  | DedupMergeStep ↔ ConflictResolver 桥接：近重复合并前检测事实冲突，偏好反转等场景通过 AGM 信念修正显式解决         | AGM (Alchourrón 1985)<sup>[[10]](#ref10)</sup> + Doyle TMS (1979) |
| G3  | Rocchio 重加权自动化调度：新增 `reweight_relevance` Job，每 6h 聚合反馈并更新 `metadata_.relevance_weight`        | Rocchio (1971)<sup>[[22]](#ref22)</sup> 反馈闭环                  |
| G4  | 端到端集成测试：全 Pipeline 巩固、去重、Rocchio 反馈、审计追踪                                                    | "Verification Before Done" 工程准则                               |

### 4.10 Phase 8: 开箱即用化 + 接线缺陷修复（2026-05）

承接 Phase 5-7「实现完成但默认关闭」的现状，本轮把全部高级特性翻为**默认启用**（开箱即用），并修复验证中暴露的多处「实现完成但未真正生效」缺陷。运行时事实源是 `config.default.yaml`（YAML 优先级高于 Python field 默认，见 `config/_base.py`）——这正是此前 6-step Memify「代码就绪却被 YAML 锁在 2 步」的根因。

**默认状态翻转**（`config.default.yaml`）：F1 HippoRAG / F2 Reflexion / F4 Presidio / Rocchio 读侧 + Memify 6-step 全部 `enabled: true`；各自保留运行时安全闸（HippoRAG `min_kg_associations` 数据闸、Reflexion `max_inflight_tasks` 并发上限、Presidio `allow_engine_fallback` 缺模型降级），既开箱即用又自保护。

**接线缺陷修复**（详见 [`issue.md`](../.agents/issue.md) ISSUE-098~101）：

| 缺陷 | 根因 | 修复 |
| --- | --- | --- |
| Hybrid 检索长期静默回退纯向量 | `hybrid_search()` SQL 函数从未迁移（仅在 schema 文件）+ `:embedding::vector` 被 SQLAlchemy 误解析报语法错 | 迁移 `0047` 创建函数 + `search_vector`/GIN；改 `CAST(:embedding AS vector(1536))` |
| F4 Presidio 在热路径是死代码 | 写侧硬编码 legacy regex `detect_pii`，绕过 `engine` 工厂；`PIIGatekeeper` 零调用点 | 写侧改 `detect_pii_for_storage`（工厂引擎，落 `pii_spans`）；检索出口接 `PIIGatekeeper` |
| Presidio 中文分析失效 | `AnalyzerEngine` 未装配 zh NLP 引擎，CN 识别器全失效 | `_build_nlp_engine` 按语言显式映射 spaCy 模型（en→lg、zh→sm）+ 优雅降级 |
| 测试隔离污染 | `test_runner_artifacts` 模块级永久替换 `sys.modules` 工厂 | 改「临时 mock + try/finally 还原」 |

**依赖默认化**：presidio-analyzer/anonymizer + spaCy 从可选 extra 提升为主依赖；新增 `negentropy bootstrap-pii-models` CLI 下载 NER 模型（独立下载产物，缺失时按 fallback 降级 regex，`/memory/health` 可观测实际引擎）。

**验证**：全 Memory 测试套件（unit + integration，单会话）667+ 例绿；实机经 `add_session_to_memory` 跑通 6-step Memify（`statuses=[success×6]`，真实 LLM）+ Presidio 检出 person/email/CN-mobile + Hybrid 检索生效；浏览器逐页核对 Timeline/Facts/Conflicts/Audit/Scheduler。

### 4.11 未来工作：业界前沿的演进方向

本项目当前架构（PostgreSQL 单栈 + 类型分层 Ebbinghaus 衰减 + 6-step Memify + HippoRAG PPR）已覆盖生产记忆系统的核心能力。结合 2025–2026 年最新文献，以下方向可作为后续迭代的循证参考（均为前瞻性 inspiration，非当前实现）：

- **多图正交检索**：MAGMA<sup>[[25]](#ref25)</sup>将记忆跨语义/时序/因果/实体四张正交图表征，把检索建模为意图感知的策略化遍历，解耦表征与检索逻辑。本项目的关联网络（`memory_associations`）与 KG 已具雏形，可演进为显式多图视图选择。
- **段落级 PPR 整合**：HippoRAG 2<sup>[[26]](#ref26)</sup>在原 HippoRAG 基础上引入更深的 passage 整合与在线 LLM 相关性校验，关联记忆任务提升 7%。本项目 F1 当前为实体级 seeding，可借鉴其 passage 整合提升 RRF 融合质量。
- **检索期时序推理**：mem0<sup>[[27]](#ref27)</sup>在检索排序中显式引入时序信号（区分"当前状态 vs 历史事件 vs 未来计划"）。本项目当前依赖 `created_at` 排序，可在评分公式中补充时序维度。
- **睡眠启发的巩固遗忘**：SleepGate<sup>[[28]](#ref28)</sup>以"睡眠微周期"对 KV cache 做冲突感知标记、选择性遗忘与摘要合并，缓解 proactive interference。本项目的 `cleanup_low_value_memories` 当前为纯阈值删除，可借鉴 LLM 引导的融合决策替代硬删除。

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

<a id="ref9"></a>[9] J. R. Anderson et al., "An integrated theory of the mind," *Psychological Review*, vol. 111, no. 4, pp. 1036–1060, 2004.

<a id="ref10"></a>[10] C. E. Alchourrón, P. Gärdenfors, and D. Makinson, "On the logic of theory change: Partial meet contraction and revision functions," *J. Symbolic Logic*, vol. 50, no. 2, pp. 510–530, 1985.

<a id="ref11"></a>[11] B. Jiménez-Gutiérrez et al., "HippoRAG: Neurobiologically inspired long-term memory for large language models," in *Proc. NeurIPS*, 2024.

<a id="ref12"></a>[12] D. Edge et al., "From local to global: A graph RAG approach to query-focused summarization," arXiv:2404.16130, 2024.

<a id="ref13"></a>[13] cognee documentation, "Memify post-processing pipeline," <https://docs.cognee.ai/core-concepts/main-operations/memify> (accessed 2026-05).

<a id="ref14"></a>[14] J. Wang et al., "LongMem: Augmenting language models with long-term memory," in *Proc. NeurIPS*, vol. 36, 2023.

<a id="ref15"></a>[15] L. Page, S. Brin, R. Motwani, and T. Winograd, "The PageRank citation ranking: Bringing order to the web," Stanford Univ., Tech. Rep. SIDL-WP-1999-0120, Nov. 1999.

<a id="ref16"></a>[16] G. V. Cormack, C. L. A. Clarke, and S. Buettcher, "Reciprocal rank fusion outperforms Condorcet and individual rank learning methods," in *Proc. 32nd Int. ACM SIGIR Conf. Res. Develop. Inf. Retr.*, 2009, pp. 758–759.

<a id="ref17"></a>[17] E. Gamma, R. Helm, R. Johnson, and J. Vlissides, *Design Patterns: Elements of Reusable Object-Oriented Software*. Reading, MA, USA: Addison-Wesley, 1994.

<a id="ref18"></a>[18] O. Mendels, C. Peled, N. Vaisman Levy, T. Rosenthal, L. Lahiani, and others, "Microsoft Presidio: Context-aware, pluggable and customizable data protection service," <https://microsoft.github.io/presidio/> (accessed 2026-05).

<a id="ref19"></a>[19] E. McCallister, T. Grance, and K. Scarfone, "Guide to protecting the confidentiality of personally identifiable information (PII)," *NIST Special Publication 800-122*, Apr. 2010.

<a id="ref20"></a>[20] European Parliament and Council, "Regulation (EU) 2016/679 (General Data Protection Regulation), Articles 17 and 25," *Official Journal of the European Union*, L 119, pp. 1–88, May 2016.

<a id="ref21"></a>[21] L. Wei, X. Peng, D. Xu, N. Xie, and B. Wang, "FadeMem: Biologically-Inspired Forgetting for Efficient Agent Memory," arXiv:2601.18642, 2026.

<a id="ref22"></a>[22] J. J. Rocchio, "Relevance feedback in information retrieval," in *The SMART Retrieval System*, Prentice-Hall, 1971, pp. 313-323.

<a id="ref23"></a>[23] Y. Lv and C. Zhai, "A comparative study of methods for estimating query language models," in *Proc. 32nd Int. ACM SIGIR Conf.*, 2009, pp. 289-296.

<a id="ref24"></a>[24] B. Beyer, C. Jones, J. Petoff, and N. R. Murphy, *Site Reliability Engineering: How Google Runs Production Systems*. O'Reilly, 2016.

<a id="ref25"></a>[25] D. Jiang *et al.*, "MAGMA: A multi-graph based agentic memory architecture for AI agents," in *Proc. ACL*, 2026. (arXiv:2601.03236)

<a id="ref26"></a>[26] B. J. Gutiérrez, Y. Shu, W. Qi, S. Zhou, and Y. Su, "From RAG to memory: Non-parametric continual learning for large language models," in *Proc. 42nd Int. Conf. Machine Learning (ICML)*, PMLR 267:21497–21515, 2025. (HippoRAG 2)

<a id="ref27"></a>[27] P. Chhikara, D. Khant, S. Aryan, T. Singh, and D. Yadav, "Mem0: Building production-ready AI agents with scalable long-term memory," in *Proc. ECAI*, 2025. (arXiv:2504.19413)

<a id="ref28"></a>[28] Y. Xie, "Learning to forget: Sleep-inspired memory consolidation for resolving proactive interference in large language models," arXiv:2603.14517, Mar. 2026. (SleepGate)

---

## 6. 附录：Phase 4 评测基线快照

> 首次 BM25 baseline（2026-05-02 跑出）见 `.temp/eval/baseline_*.md`。CI 触发参考 [`memory-eval` workflow](../../.github/workflows/memory-eval.yml)。

| Dataset          | N   | MRR@10 | NDCG@10 | Hit@10 | F1    |
| ---------------- | --- | ------ | ------- | ------ | ----- |
| LoCoMo-mini      | 30  | 0.933  | 0.947   | 1.000  | 0.216 |
| LongMemEval-mini | 30  | 0.867  | 0.902   | 1.000  | 0.257 |

> 这是 **算法层**（BM25-only）基线；后续与 PostgresMemoryService 的 Hybrid 对比应有 5%+ 提升。
