---
sidebar_position: 4
title: "Horizon Context ↔ negentropy 机制映射报告"
description: "把 Horizon Context 六机制逐条对照本仓 definitions registry / patrol-Judge / skills_injector / Catalog：12 条映射判定为已对齐 4、值得落地 5、YAGNI 暂缓 3，锚点均经代码核验"
---

# Horizon Context ↔ negentropy 机制映射报告

> 声明：只分析不改码；锚点均经 `grep -n` 实际核验（分支 `ThreeFish-AI/snowflake-horizon-context-layer-research`，2026-09-12）。材料机制出处见 [Horizon Context 精读笔记](./011-horizon-context.md)。

## 结论先行

本仓已具备 Horizon Context 的**骨架同构物**：受治理定义注册与校验（definitions registry + parse_definition 422 门）、评估-修正闭环（patrol/Judge）、三层渐进披露的上下文注入（skills_injector）、目录与全局搜索（CatalogService/GlobalSearchService）。材料的**真增量**集中在四处：①**验证问答（AI_VERIFIED_QUERIES）作为带溯源的一等资产**；②**同义词/agent 指令内嵌进定义对象**；③**冲突浮出人工裁决**（本仓质量信号会回流但无显式裁决机制）；④**四因子信任归一**（本仓 `context-layer.md` §4.2 已设计复合信任分但未实现，且缺 freshness 维度）。12 条映射中：✅ 已对齐 4 / 🔶 值得落地 5 / ⏸ 暂缓 3。

## 映射总表

| #   | 材料机制（出处）                                                | 本仓对应                                                                       | 锚点（实际核验）                                                                                                                                                                                                                         | 判定                 |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | M1 上下文对象模型：semantic view 五段式（CREATE SEMANTIC VIEW） | definitions registry SSOT（4 类定义 + 版本/checksum 派生列）                   | [`models/definition.py:40`](../../../apps/negentropy/src/negentropy/models/definition.py) · [`registry.py:117`](../../../apps/negentropy/src/negentropy/agents/definitions/registry.py) · 迁移 0095–0099                                 | 🔶 部分对齐           |
| 2   | M1 结构校验门（validation-rules：FK→键列/≥1 dim+metric）        | parse_definition 解析+领域校验，失败 422 拒落库                                | [`registry.py:117`](../../../apps/negentropy/src/negentropy/agents/definitions/registry.py)                                                                                                                                              | ✅ 已对齐             |
| 3   | M1 定义激活物化（semantic view 即查即用）                       | harness_materializer：DB SSOT → `.agent/skills/<key>/SKILL.md` 渲染            | [`harness_materializer.py:137`](../../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py)（materialize_all）                                                                                                   | ✅ 已对齐             |
| 4   | M2 查询时语义正确性（agg-before-join/distinct/derived/半可加）  | 无对应（本仓非数据指标栈）                                                     | —                                                                                                                                                                                                                                        | ⏸ 暂缓（YAGNI）      |
| 5   | M3 治理内嵌引擎（双层防线：检索过滤+执行拒绝）                  | RBAC 检索过滤已有（`scoped & accessible`）；出口守卫 ContextGuard 仅在方案中   | [`hybrid_planner.py:322`](../../../apps/negentropy/src/negentropy/agents/tools/hybrid_planner.py)（_seed_retrieval）· 方案 [`context-layer.md §5.3`](../../concepts/design/context-layer.md)                                             | 🔶 值得落地           |
| 6   | M4 eval 自纠环（金标准问答→修正理解→重排）                      | patrol/Judge 巡检闭环：评分→终态沉淀→失败记忆→reconcile                        | [`evaluator.py:188`](../../../apps/negentropy/src/negentropy/engine/routine/evaluator.py)（RoutineEvaluator）· [`pdf_fidelity_patrol.py:655`](../../../apps/negentropy/src/negentropy/engine/schedulers/handlers/pdf_fidelity_patrol.py) | ✅ 已对齐（机制同构） |
| 7   | M4 冲突浮出人工裁决（CONFLICT 卡片，不许自动选）                | 无显式对应（patrol_memory 有 unfixable 记忆，但无「同名定义冲突→人工裁决」面） | [`patrol_memory.py`](../../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) 四 TAG 常量                                                                                                                                | 🔶 值得落地           |
| 8   | M5 检索激活（top-k 上下文包：定义+指令+验证问答）               | 三层渐进披露：L1 描述常驻 / L2 模板按需 / L3 资源挂载                          | [`skills_injector.py:342`](../../../apps/negentropy/src/negentropy/agents/skills_injector.py)（format_skills_block）· [`context_assembler.py:43`](../../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) | ✅ 已对齐             |
| 9   | M5 AI_VERIFIED_QUERIES（人验证问答 + VERIFIED_BY/AT 溯源）      | 无对应（巡检通过的文档未沉淀为「验证问答对」资产）                             | —                                                                                                                                                                                                                                        | 🔶 值得落地           |
| 10  | M6 四因子信号排序（R/A/P/F）                                    | 信任归一公式已设计未实现；缺 freshness 单一 staleness                          | [`context-layer.md §4.2`](../../concepts/design/context-layer.md)（复合信任分表）· Memory 缺口同文 §6.1                                                                                                                                  | 🔶 值得落地           |
| 11  | M7 OSI/Ossie YAML 互操作                                        | 无对应                                                                         | —                                                                                                                                                                                                                                        | ⏸ 暂缓（YAGNI）      |
| 12  | M7 MCP 激活面（对外供给外部 agent）                             | 方向相反：本仓是 MCP **客户端**（perceives 经 McpClientService 接入）          | [`interface/mcp_client.py:307`](../../../apps/negentropy/src/negentropy/interface/mcp_client.py)（McpClientService）                                                                                                                     | 🔶 值得落地（供给面） |

## 逐条说明

**#1 对象模型（🔶）**：本仓 definitions 表已是 4 类定义的 SSOT（source 为源，meta/version/checksum 为派生冗余列），与 semantic view「元数据对象」定位同构。差异在字段面：Horizon 把**agent 检索面**做成了对象字段——`WITH SYNONYMS`（召回别名）、`AI_SQL_GENERATION`（随定义分发的指令）、`AI_VERIFIED_QUERIES`（验证问答）；本仓定义的 `meta` JSONB 可承载等价信息但尚无此纪律。建议：在 Context Layer 落地时为上下文对象补「synonyms + instructions + verified Q&A」三字段约定（见蓝图 §2）。

**#2/#3 注册与激活（✅）**：parse_definition 的领域校验（validator/meta_extractor 注册表 + 422 拒入库）与 validate_view 的结构校验门同构；harness_materializer「DB→.agent/skills 按内容幂等渲染」与 semantic view「定义即查即用」同构——定义不复制、消费端只持指针，符合 SSOT。

**#4 声明式聚合（⏸）**：本仓无指标栈，agg-before-join 等聚合纪律暂无落点。触发条件：当仓内出现「派生口径」类资产（如多 routine 评估分汇总、跨文档质量聚合）时，引入「口径声明 + 出口校验」纪律，防 average-of-averages 型错误。

**#5 双层治理（🔶）**：Horizon 的关键论点是检索层过滤只是体验、执行层拒绝才是治理。本仓 HybridPlanner 已做 `scoped & accessible` 过滤（第一层），但「代码回退路径必经的出口守卫」尚停留在 context-layer.md 方案的 ContextGuard（第二层）。建议随该方案 Phase 2 落地，勿降级为可选检查。

**#6/#7 自纠环与冲突（🔶）**：patrol/Judge 的「评分→终态→失败记忆→reconcile」与 Cortex Sense 的「eval 错配→修正理解→重排」机制同构（✅ 部分）。真缺口是**冲突浮出**：当两个来源对同一对象给出矛盾断言（如巡检结论 vs memory 信念），本仓无「并列呈现 + needs_adjudication + 不自动选」的显式契约。Horizon 的教训（D4 实验：auto_popularity 让错误口径胜出）说明这层不是锦上添花。

**#8 渐进披露（✅）**：L1/L2/L3 三层与「top-k 上下文包（定义+指令+验证问答）」同构——常驻描述≈条目摘要，按需展开≈上下文包，资源挂载≈verified query 重放。

**#9 验证问答（🔶）**：本仓巡检通过（done）的文档是天然的「已验证资产」，但目前止步于状态列；把它们沉淀为「问题→答案/文档锚点→验证人/时间」的问答对，agent 命中即短路重放并携带溯源——是本仓最便宜的信任度来源（Horizon 把它做成了 DDL 一等公民）。

**#10 四因子归一（🔶）**：context-layer.md §4.2 的复合信任分（0.4 retention + 0.3 importance + 0.3 freshness 等）与 R/A/P/F 同构，但未实现且各子系统量纲未一。落地时建议采纳 Horizon 口径的三个纪律：①**authority 区分 governed/inferred**（受治理定义 > 行为信号推断）；②**popularity 用有界变换**（log1p/上限，防全局 max 漂移，原型 `rank` :463 的实现即此）；③**freshness 必须是单一 staleness 量**（直击 Memory 子系统已知缺口）。

**#11 Ossie（⏸）**：触发条件——上下文对象需要跨系统携带（导入/导出第三方语义模型）时，对齐 Apache Ossie YAML 而非自造格式。

**#12 MCP 供给面（🔶）**：本仓 McpClientService 已有 MCP 协议工程经验（perceives FileResource 生命周期不变量等），但角色是消费者。Context Layer 若要「广泛应用于 Agents 研发与平台集成」，需要**供给面**：把目录/检索/编译/反馈经 MCP 暴露给任意外部 agent——原型 [`assets/horizon_context_mcp.py`](./assets/horizon_context_mcp.py) 已验证纯标准库 stdio 可行（四工具 + 引擎层 RBAC 经 MCP 仍生效）。详见[蓝图](./013-context-layer-blueprint.md) §5。

## 落地建议汇总

**做**（绑时机）：
1. ContextGuard 出口守卫——随 context-layer.md Phase 2，两路径（含代码回退）必经（#5）。
2. 验证问答资产——绑 patrol 终态 done 的文档：沉淀「问题→锚点→验证人/时间」问答对，agent 预载短路（#9）。
3. 信任归一实现——采纳 authority 分层 + log1p 有界 + 单一 staleness 三纪律（#10）。

**写**（一句话成本）：
4. 在 context-layer.md 的对象模型讨论处交叉引用本笔记的 synonyms/instructions/verified-QA 字段设计（#1，由[蓝图](./013-context-layer-blueprint.md) §2 承载详细设计）。

**暂缓**（写明触发条件）：
5. 声明式聚合纪律——出现派生口径资产时（#4）。
6. Ossie YAML 对齐——需要跨系统携带语义模型时（#11）。
7. 隐式挖掘轨道（Cortex Sense 类）——本仓规模未到「显式定义覆盖不动」的瓶颈（<5% 现象），先吃透 eval 自纠环即可（#6 已有同构物）。

## 交叉引用

- [Horizon Context 精读笔记](./011-horizon-context.md)（机制详解 + 实验室 + 批判性边界）
- [Context Layer · 上下文治理层技术方案](../../concepts/design/context-layer.md)（本仓内部织物设计 SSOT）
- [Context Layer 基础设施设计蓝图](./013-context-layer-blueprint.md)（通用可复刻基础设施，本报告 #12/#1 的展开）
- [Snowflake 数据云调研 §D7 Horizon Catalog](../retrieval-storage/034-snowflake-data-cloud.md)
