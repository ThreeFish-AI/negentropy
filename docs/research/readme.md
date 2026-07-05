# 研究文献总览

> Negentropy 技术调研索引。34 篇原始调研按「认知 → 框架 → 存储 → 图谱 → 执行 → 进化」六段论归档，逐层递进；本页为各主题分组的阅读入口。

---

## 一、认知与上下文 · `cognitive-context/`

| 文档 | 主旨 |
|:---|:---|
| [智能认知增强](./cognitive-context/000-cognitive-enhancement.md) | Agentic 认知增强总览与理论基线 |
| [Context Engineering 通俗全解](./cognitive-context/010-context-engineering.md) | 上下文工程主流框架与论文精解 |

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

---

> 阅读建议：首次按一→六段论顺序通读；选型查阅直接跳到对应分组。各子目录的 `_category_.json` 提供分组级描述，wiki 左栏可折叠展开。
