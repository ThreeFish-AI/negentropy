# 研究文献总览

> Negentropy 技术调研索引。调研按「认知 → 框架 → 存储 → 图谱 → 执行 → 进化」六段论归档，逐层递进（其中「认知与上下文」与「自进化与工具」两段兼收领域材料精读、对本仓的机制映射与由此派生的可复刻蓝图），另设独立主题分组（量化与投资科学、视频与动效生产）；本页为各主题分组的阅读入口。

---

## 一、认知与上下文 · `cognitive-context/`

| 文档 | 主旨 |
|:---|:---|
| [智能认知增强](./cognitive-context/000-cognitive-enhancement.md) | Agentic 认知增强总览与理论基线 |
| [Context Engineering 通俗全解](./cognitive-context/010-context-engineering.md) | 上下文工程主流框架与论文精解 |
| [Snowflake Horizon Context 精读笔记](./cognitive-context/011-horizon-context.md) | 产业范本精读：三阶段演进全景（语义对象化→治理内嵌→生态开放）+ 七机制 M1–M7（五段式对象模型 / 查询时聚合安全与按需物化 / 引擎原生治理 / 双轨富化与自纠 / 检索激活 / 四因子信号排序 / OSI+MCP 互操作）+ 实证数字与批判性边界，含随笔记入库的 M1–M6 最小原型与 MCP 服务原型，M1–M7 各配一张 archify 动效工程图，§1 另配病因链与机制对位总览图、§2 另配组件全景与演进时间线两张总览图（共十张，trace 动画） |
| [Horizon Context ↔ negentropy 机制映射](./cognitive-context/012-horizon-context-mapping-negentropy.md) | 12 条机制逐条对照本仓 definitions registry / patrol-Judge / skills_injector / Catalog（✅ 已对齐 4 · 🔶 值得落地 5 · ⏸ 暂缓 3），锚点均经代码核验 |
| [Context Layer 基础设施设计蓝图](./cognitive-context/013-context-layer-blueprint.md) | 由上述精读派生的通用可复刻治理上下文层：对象存储 / 目录 / 富化自纠 / 治理 / 激活五正交层 + 业界四路线格局对照 + MCP 供给面威胁模型 + 评测标尺与组织运营对策，含「治理≠验证」边界对策与独立部署演进路线 |

> 本仓**内部**的上下文治理织物方案见 [Context Layer · 上下文治理层技术方案](../concepts/design/context-layer.md)（统领 Memory / KB / KG / Tools / Skills 的上下文契约）——它是上方[基础设施设计蓝图](./cognitive-context/013-context-layer-blueprint.md)在 negentropy 的一次实例化，两者互补互链。

## 二、Agent 框架与引擎 · `agent-runtime/`

| 文档 | 主旨 |
|:---|:---|
| [Agent Runtime & Frameworks 调研](./agent-runtime/020-agent-runtime-frameworks.md) | 主流 Agent 运行时框架横向对比 |
| [Agent Engine Fundamentals](./agent-runtime/020a-agent-engine-fundamentals.md) | Agent 引擎基础原理与 ADK 接口适配 |
| [Google ADK 2.0 升级调研](./agent-runtime/020b-adk-2.0-upgrade.md) | ADK 2.0 新特性、Breaking Changes 与升级路径 |

## 三、检索与存储 · `retrieval-storage/`

**向量算法 / 数据库**

| 文档 | 主旨 |
|:---|:---|
| [向量索引算法通俗全解](./retrieval-storage/030-vector-search-algorithm.md) | HNSW / IVF 等向量检索算法原理 |
| [向量数据库选型决策路径](./retrieval-storage/031-vector-databases-selection.md) | 选型方法论与决策树 |
| [向量数据库深度调研](./retrieval-storage/032-vector-databases.md) | 主流向量库能力矩阵 |

**OceanBase 簇**

| 文档 | 主旨 |
|:---|:---|
| [OceanBase 三位一体调研](./retrieval-storage/033-oceanbase.md) | HTAP + Vector + 强一致主调研 |
| [OceanBase Agent 场景评估摘要](./retrieval-storage/033a-oceanbase-evaluation.md) | Agentic 场景适配评估 |
| [Agentic AI Memory 基座选型对比](./retrieval-storage/033b-technology-comparison.md) | OceanBase / Cloud Native / Disaggregated / Generic SQL 四路线对比 |
| [OceanBase Phase 2：Memory Management 实施指引](./retrieval-storage/033c-oceanbase-memory-management.md) | 仿生 Google Memory Bank 的工程落地（含 Phase 3/4 Roadmap） |
| [OceanBase 执行阶段一：基座部署与 Unified Schema](./retrieval-storage/033d-oceanbase-schema-design.md) | 部署与统一 Schema 设计 |

**Snowflake**

| 文档 | 主旨 |
|:---|:---|
| [Snowflake 数据云平台深度调研](./retrieval-storage/034-snowflake-data-cloud.md) | 基于官方文档的 10 正交维度全景（架构/存储/计算/数据工程/开发/AI/安全治理/共享/容灾/成本）+ 主流方案横向对比与选型建议 |

## 四、知识与图谱 · `knowledge-graph/`

| 文档 | 主旨 |
|:---|:---|
| [Knowledge Base：RAG Pipeline & Hybrid Search](./knowledge-graph/034-knowledge-base.md) | KB 核心管道与混合检索 |
| [Knowledge Base Fundamentals](./knowledge-graph/034a-knowledge-base-fundamentals.md) | Chunking / Embedding / RAG 基础理论 |
| [腾讯 WeKnora 深度调研](./knowledge-graph/035-knowledge-base-platform.md) | WeKnora 与同类 RAG 框架对比 |
| [Cognee 深度调研](./knowledge-graph/040-cognee.md) | Cognee 记忆/知识框架 |
| [Neo4j 图数据库调研](./knowledge-graph/050-neo4j.md) | Neo4j 承载 KG 的能力评估 |
| [PostgreSQL 支撑 KG：Neo4j 替代路径](./knowledge-graph/051-postgres-neo4j.md) | 多模型 DB 全景与替代分析 |
| [BettaFish 微舆调研](./knowledge-graph/060-bettafish.md) | Bettafish 端侧推理框架 |

## 五、Agent 基础设施 · `agent-infra/`

| 文档 | 主旨 |
|:---|:---|
| [AG-UI 协议调研](./agent-infra/070-ag-ui.md) | Agent-to-UI 开放协议 |
| [Agent Sandbox 综述](./agent-infra/080-agent-sandbox.md) | 五大技术路线正交剖析 |
| [Agent Sandbox 正交分析](./agent-infra/081-agent-sandbox.md) | Microsandbox / Wasmtime / Firecracker / Vertex |
| [Agent Sandbox 信任架构深度研究](./agent-infra/082-agent-sandbox.md) | 微虚拟机到托管式执行环境 |
| [可观测性对比：Jaeger vs Langfuse](./agent-infra/100-agent-obser.md) | 生成式 AI 可观测性方案选型 |

## 六、自进化与工具 · `self-evolution/`

| 文档 | 主旨 |
|:---|:---|
| [Routine：Agent 迭代模式调研](./self-evolution/110-routine-agent-iteration.md) | ReAct / Reflexion / Self-Refine / LATS + 停止护栏 |
| [浏览器操作 MCP 调研](./self-evolution/120-browser-automation-mcp.md) | Playwright / Chrome DevTools / claude-in-chrome 选型 |
| [自进化 Agents Team 调研](./self-evolution/130-self-evolving-agents-team.md) | DGM / ADAS / AlphaEvolve + GEPA / ACE 进化算子 |
| [经验时代的自驱迭代进化智能体](./self-evolution/140-experience-era-self-improvement.md) | 88 页综述精读 + Routine 闭环诊断 |
| [Skill 进化闭环 × 自我改进评测](./self-evolution/141-skills-evolution-and-si-measurement.md) | Skills 三阶段进化 + SI 六目标度量 |
| [Procedural Graph 论文精读](./self-evolution/142-procedural-graphs.md) | arXiv:2609.09153：程序性知识外置为带 condition/guidance/pitfalls 属性的有向图 + 邻域定位软指导 + 过验证门的自进化，含最小原型与破坏性实验 |
| [PG ↔ negentropy 机制映射](./self-evolution/143-pg-mapping-negentropy.md) | 五条机制对照本仓 Routine / 巡检 / evolution 门控：验证门平局接受与报告纪律已对齐，编辑级拒绝记忆值得落地，边属性按 YAGNI 暂缓 |

## 七、量化与投资科学 · `quant-finance/`

| 文档 | 主旨 |
|:---|:---|
| [凯利公式与股市投资的数学基石](./quant-finance/150-kelly-criterion-and-investment-math.md) | 七块严格成立的定理（凯利仓位 / 统计功效 / 破产风险 / 波动拖累 / 复利年金 / Markowitz 分散化 / Sharpe 算术）+ 经核验的实证数据（SPIVA / 上交所账户研究等）+ 中国市场可执行操作路径与避坑清单 |

## 八、视频与动效生产 · `video-production/`

| 文档 | 主旨 |
|:---|:---|
| [视频动效建模与 Web 可视化搭建工具全景调研](./video-production/160-video-motion-modeling-web-visual-tooling.md) | 以现役 Remotion 科普视频管线为基线的全网与 GitHub 全景调研（54+9 候选、四路深评、87 条主张双反驳核验）：A 轨 `@remotion` 官方增强簇即刻提升表达力、B 轨 HyperFrames（Apache-2.0、agent 原生）平行试点、C 轨 Cavalry/Jitter→Lottie 设计师资产管线，附四道击穿门评估框架、迁移成本口径与 POC 验收清单 |

---

> 阅读建议：首次按一→六段论顺序通读；选型查阅直接跳到对应分组。各子目录的 `_category_.json` 提供分组级描述，wiki 左栏可折叠展开。
