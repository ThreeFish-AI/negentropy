---
sidebar_position: 5
title: "Horizon Context ↔ negentropy 机制映射报告"
description: "把 Horizon Context 重评选后的 M1–M7 与三个专章机制逐条对照本仓 definitions registry / patrol-Judge / skills_injector / Catalog：16 条映射判定为已对齐 4、值得落地 8（含部分对齐 1）、YAGNI 暂缓 4，锚点均经代码核验（2026-09-17 随 M 集重评选重审）"
---

> 声明：只分析不改码；锚点均经 `grep -n` 实际核验（分支 `ThreeFish-AI/horizon-context-recalibrate`，2026-09-17）。材料机制出处见 [Horizon Context 精读笔记](./011-horizon-context.md)（其 M 集已于同日经全局重评选校准，本报告按新口径重审——旧 12 条逐条重锚、新晋四机制补映射）。

## 结论先行

本仓已具备 Horizon Context 的**骨架同构物**：受治理定义注册与校验（definitions registry + parse_definition 422 门）、评估-修正闭环（patrol/Judge）、三层渐进披露的上下文注入（skills_injector）、目录与全局搜索（CatalogService/GlobalSearchService）。材料的**真增量**集中在六处：①**验证问答（AI_VERIFIED_QUERIES）作为带溯源的一等资产**（重评选后升格为独立机制 M4，分量更重）；②**同义词/agent 指令内嵌进定义对象**；③**冲突浮出人工裁决**（本仓质量信号会回流但无显式裁决机制）；④**四因子信任归一**（已设计未实现）；⑤**代理会话权限天花板**（M6 新晋：本仓有 agent 类型元数据、无「代理会话权限只减不增」机制）；⑥**MCP 供给面**。16 条映射中：✅ 已对齐 4 / 🔶 值得落地 8（含部分对齐 1）/ ⏸ 暂缓 4。

## 映射总表

| #   | 材料机制（出处，新口径）                                        | 本仓对应                                                                       | 锚点（实际核验 2026-09-17）                                                                                                                                                  | 判定                 |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | M1 口径单点：semantic view 五段式（CREATE SEMANTIC VIEW）       | definitions registry SSOT（4 类定义 + 版本/checksum 派生列）                   | [`models/definition.py:40`](../../../apps/negentropy/src/negentropy/models/definition.py) · [`registry.py:117`](../../../apps/negentropy/src/negentropy/agents/definitions/registry.py) · 迁移 0095–0099 | 🔶 部分对齐           |
| 2   | M1 注册期结构校验门（validation-rules：FK→键列/≥1 dim+metric）  | parse_definition 解析+领域校验，失败 422 拒落库                                | [`registry.py:117`](../../../apps/negentropy/src/negentropy/agents/definitions/registry.py)                                                                                                                                                  | ✅ 已对齐             |
| 3   | M1 定义激活物化（semantic view 即查即用）                       | harness_materializer：DB SSOT → `.agent/skills/<key>/SKILL.md` 渲染            | [`harness_materializer.py:137`](../../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py)（materialize_all）                                                                                                       | ✅ 已对齐             |
| 4   | M1 查询期重算（agg-before-join/distinct/derived/半可加）        | 无对应（本仓非数据指标栈）                                                     | —                                                                                                                                                                            | ⏸ 暂缓（YAGNI）      |
| 5   | M2 查询期行列级访问策略（策略对象 + 执行面强制）                | API 层鉴权 + `accessible_corpus_ids` 过滤（非独立策略对象）                    | [`hybrid_planner.py:189`](../../../apps/negentropy/src/negentropy/agents/tools/hybrid_planner.py) · [`hybrid_planner.py:223`](../../../apps/negentropy/src/negentropy/agents/tools/hybrid_planner.py)                                          | 🔶 值得落地           |
| 6   | M3 语义级治理执行（双层防线：检索过滤+执行拒绝）                | RBAC 检索过滤已有（`scoped & accessible`）；出口守卫 ContextGuard 仅在方案中   | [`hybrid_planner.py:322`](../../../apps/negentropy/src/negentropy/agents/tools/hybrid_planner.py)（_seed_retrieval）· 方案 [`013 §7.7`](./013-context-layer-blueprint.md)                                                  | 🔶 值得落地           |
| 7   | §10 富化 eval 自纠环（金标准问答→修正理解→重排）                | patrol/Judge 巡检闭环：评分→终态沉淀→失败记忆→reconcile                        | [`evaluator.py:188`](../../../apps/negentropy/src/negentropy/engine/routine/evaluator.py)（RoutineEvaluator）· [`pdf_fidelity_patrol.py:655`](../../../apps/negentropy/src/negentropy/engine/schedulers/handlers/pdf_fidelity_patrol.py)      | ✅ 已对齐（机制同构） |
| 8   | §10 富化 冲突浮出人工裁决（CONFLICT 卡片，不许自动选）          | 无显式对应（patrol_memory 有 unfixable 记忆，但无「同名定义冲突→人工裁决」面） | [`patrol_memory.py:42`](../../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) TAG 常量群                                                                                                                                   | 🔶 值得落地           |
| 9   | §11 检索激活（top-k 上下文包：定义+指令+验证问答）               | 三层渐进披露：L1 描述常驻 / L2 模板按需 / L3 资源挂载                          | [`skills_injector.py:342`](../../../apps/negentropy/src/negentropy/agents/skills_injector.py)（format_skills_block）· [`context_assembler.py:43`](../../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py)      | ✅ 已对齐             |
| 10  | M4 应答层验证锚定（AI_VERIFIED_QUERIES + VERIFIED_BY/AT 溯源）  | 无对应（巡检通过的文档未沉淀为「验证问答对」资产）                             | —                                                                                                                                                                            | 🔶 值得落地           |
| 11  | §11 四因子信号排序（R/A/P/F）                                    | 信任归一公式已设计未实现；缺 freshness 单一 staleness                          | [`013 §5.3`](./013-context-layer-blueprint.md)（三视图与信任归一）· Memory 缺口见 013 §12.3                                                                                                                                       | 🔶 值得落地           |
| 12  | §12 生态 Ossie YAML 互操作                                       | 无对应                                                                         | —                                                                                                                                                                            | ⏸ 暂缓（YAGNI）      |
| 13  | §12 生态 MCP 激活面（对外供给外部 agent）                        | 方向相反：本仓是 MCP **客户端**（perceives 经 McpClientService 接入）          | [`mcp_client.py:307`](../../../apps/negentropy/src/negentropy/interface/mcp_client.py)（McpClientService）                                                                                                                                    | 🔶 值得落地（供给面） |
| 14  | M5 端到端列级血缘（引擎沉淀 + OpenLineage 摄取）                 | 无对应（routine 执行史是运行日志，非资产依赖图）                               | —                                                                                                                                                                            | ⏸ 暂缓（YAGNI）      |
| 15  | M6 Agent Identity（代理会话权限天花板 + agent 归因审计）        | 部分对应：agent 类型元数据有（preset 描述用），「代理会话权限只减不增」无       | [`agents_api.py:44`](../../../apps/negentropy/src/negentropy/interface/agents_api.py)（agent_type 字段）· [`agent_presets.py:109`](../../../apps/negentropy/src/negentropy/interface/agent_presets.py)（_agent_type）                        | 🔶 值得落地           |
| 16  | M7 分类与标签驱动策略传播（自动分类→标签→策略）                  | 无对应（definitions.meta JSONB 可承载标签，但无分类扫描与标签驱动策略链）       | —                                                                                                                                                                            | ⏸ 暂缓（YAGNI）      |

## 逐条说明

**#1 对象模型（🔶）**：本仓 definitions 表已是 4 类定义的 SSOT（source 为源，meta/version/checksum 为派生冗余列），与 semantic view「元数据对象」定位同构。差异在字段面：Horizon 把**agent 检索面**做成了对象字段——`WITH SYNONYMS`（召回别名）、`AI_SQL_GENERATION`（随定义分发的指令）、`AI_VERIFIED_QUERIES`（验证问答）；本仓定义的 `meta` JSONB 可承载等价信息但尚无此纪律。建议：在 Context Layer 落地时为上下文对象补「synonyms + instructions + verified Q&A」三字段约定（见蓝图对象层章）。

**#2/#3 注册与激活（✅）**：parse_definition 的领域校验（validator/meta_extractor 注册表 + 422 拒入库）与 validate_view 的结构校验门同构；harness_materializer「DB→.agent/skills 按内容幂等渲染」与 semantic view「定义即查即用」同构——定义不复制、消费端只持指针，符合 SSOT。

**#4 声明式聚合（⏸）**：本仓无指标栈，agg-before-join 等聚合纪律暂无落点。触发条件：当仓内出现「派生口径」类资产（如多 routine 评估分汇总、跨文档质量聚合）时，引入「口径声明 + 出口校验」纪律，防 average-of-averages 型错误。重评选注记：材料侧该能力已并入 M1 双不变量的「查询期重算」半边，本条映射语义不变。

**#5 行列级策略（🔶，新晋机制）**：Horizon 把可见性规则铸成 schema 级**策略对象**在查询期强制；本仓的等价物是 `accessible_corpus_ids` 传入检索管线过滤（作用等同行访问策略的行级过滤），但它是**调用约定而非策略对象**——策略与代码耦合、无独立生命周期。建议：Context Layer 落地时把「谁能看哪些 corpus/定义」提升为带版本与审计的策略资产。

**#6 双层治理（🔶）**：Horizon 的关键论点是检索层过滤只是体验、执行层拒绝才是治理。本仓 HybridPlanner 已做 `scoped & accessible` 过滤（第一层），但「代码回退路径必经的出口守卫」尚停留在 013 §7.7 方案的 ContextGuard（第二层）。建议随 013 §16 Phase 2 落地，勿降级为可选检查。

**#7/#8 自纠环与冲突（🔶）**：patrol/Judge 的「评分→终态→失败记忆→reconcile」与 Cortex Sense 的「eval 错配→修正理解→重排」机制同构（✅ 部分）。真缺口是**冲突浮出**：当两个来源对同一对象给出矛盾断言（如巡检结论 vs memory 信念），本仓无「并列呈现 + needs_adjudication + 不自动选」的显式契约。Horizon 的教训（D4 实验：auto_popularity 让错误口径胜出）说明这层不是锦上添花。重评选注记：冲突纪律随富化降入 §10 专章，但作为**智识资产完整保留**，映射价值不减。

**#9 渐进披露（✅）**：L1/L2/L3 三层与「top-k 上下文包（定义+指令+验证问答）」同构——常驻描述≈条目摘要，按需展开≈上下文包，资源挂载≈verified query 重放。

**#10 验证问答（🔶，重评选后升格为独立机制 M4）**：本仓巡检通过（done）的文档是天然的「已验证资产」，但目前止步于状态列；把它们沉淀为「问题→答案/文档锚点→验证人/时间」的问答对，agent 命中即短路重放并携带溯源——是本仓最便宜的信任度来源（Horizon 把它做成了 DDL 一等公民，且重评选把它升格为应答层独立承重机制）。

**#11 四因子归一（🔶）**：013 §5.3 的复合信任分（0.4 retention + 0.3 importance + 0.3 freshness 等）与 R/A/P/F 同构，但未实现且各子系统量纲未一。落地时建议采纳 Horizon 口径的三个纪律：①**authority 区分 governed/inferred**；②**popularity 用有界变换**（log1p/上限，防全局 max 漂移，原型 `rank` :467 的实现即此）；③**freshness 必须是单一 staleness 量**（直击 Memory 子系统已知缺口）。

**#12 Ossie（⏸）**：触发条件——上下文对象需要跨系统携带（导入/导出第三方语义模型）时，对齐 Apache Ossie YAML 而非自造格式。

**#13 MCP 供给面（🔶）**：本仓 McpClientService 已有 MCP 协议工程经验（perceives FileResource 生命周期不变量等），但角色是消费者。Context Layer 若要「广泛应用于 Agents 研发与平台集成」，需要**供给面**：把目录/检索/编译/反馈经 MCP 暴露给任意外部 agent——原型 [`assets/horizon_context_mcp.py`](./assets/horizon_context_mcp.py) 已验证纯标准库 stdio 可行（四工具 + 引擎层 RBAC 经 MCP 仍生效）。重评选注记：MCP 在材料侧降入 §12 专章并记为「第一顺位晋级候选」，本条「值得落地」判定不受影响（供给面价值与本仓路线独立成立）。

**#14 血缘（⏸，新晋机制）**：本仓 grep 全仓无 lineage 实现；routine/巡检的执行史是运行日志（谁跑了什么），不是资产依赖图（什么派生自什么）。触发条件：当出现「定义/文档资产间的派生关系图」需求（如定义变更影响面分析、跨文档口径溯源）时，优先引入「写入时自动沉淀依赖边」的引擎副产品模式，而非事后扫描。

**#15 Agent Identity（🔶，新晋机制）**：本仓 `agent_type`/`_agent_type` 是 **preset 描述元数据**（区分 routine agent 类型），不是 Horizon M6 的「代理会话身份」——后者守护的是**代理代表用户行事时的权限天花板与归因审计**。本仓引擎任务以服务身份运行（权限天然收束），但用户触发的 agent 会话（如 ad-hoc 工具调用链）无「会话权限=用户权限∩代理允许面」的显式契约。建议：Context Layer Phase 2 的 ContextGuard 设计中把「调用方身份（人/代理/服务）」纳入守卫上下文，归因写入审计日志。

**#16 分类标签（⏸，新晋机制）**：本仓定义资产暂无敏感分级需求（非数据资产栈）。触发条件：当 definitions 出现「哪些定义可对外供给、哪些仅内部」的规模化治理需求时，先做「标签字段纪律」（definitions.meta 承载），再考虑自动分类。

## 落地建议汇总

**做**（绑时机）：
1. ContextGuard 出口守卫——随 013 §16 Phase 2，两路径（含代码回退）必经（#6）。
2. 验证问答资产——绑 patrol 终态 done 的文档：沉淀「问题→锚点→验证人/时间」问答对，agent 预载短路（#10）。
3. 信任归一实现——采纳 authority 分层 + log1p 有界 + 单一 staleness 三纪律（#11）。
4. 守卫上下文纳入调用方身份——ContextGuard 设计时把「人/代理/服务」身份纳入归因审计（#15）。

**写**（一句话成本）：
5. 在 013 对象层章（§4.2）交叉引用本笔记的 synonyms/instructions/verified-QA 字段设计（#1，由[蓝图](./013-context-layer-blueprint.md)对象层章承载详细设计）。
6. 在 013 §7.7 治理实例化补「策略对象化」建议：accessible_corpus_ids 从调用约定升为带版本策略资产（#5）。

**暂缓**（写明触发条件）：
7. 声明式聚合纪律——出现派生口径资产时（#4）。
8. Ossie YAML 对齐——需要跨系统携带语义模型时（#12）。
9. 隐式挖掘轨道（Cortex Sense 类）——本仓规模未到「显式定义覆盖不动」的瓶颈（<5% 现象），先吃透 eval 自纠环即可（#7 已有同构物）。
10. 资产依赖图（血缘）——出现定义派生关系分析需求时（#14）。
11. 定义敏感分级——出现对外供给治理需求时（#16）。

## 交叉引用

- [Horizon Context 精读笔记](./011-horizon-context.md)（机制详解 + 实验室 + 批判性边界 + 重评审记录）
- [Context Layer 技术蓝图与方案](./013-context-layer-blueprint.md)（设计 SSOT：通用可复刻基础设施 + 本仓内部织物实例化，本报告 #13/#1 的展开；原 `concepts/design/context-layer.md` 已于 2026-09-21 并入）
- [Snowflake 数据云调研 §D7 Horizon Catalog](../retrieval-storage/034-snowflake-data-cloud.md)
