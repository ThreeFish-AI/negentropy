---
sidebar_position: 10
title: "机制映射汇总：研究文献 ↔ negentropy"
description: "九篇研究文献与 negentropy 本仓实现的机制映射汇总，按五个域组织：认知与上下文（Horizon、OpenViking）、Agent 基础设施 Skills（Agent Skills 规范与供应链）、Agent 基础设施 Jev、自进化（Procedural Graph、Dream-RSI）、Agent Harness（AI Native 手册、Hermes）。每域给出核验基线、映射总表（✅ 已对齐 / 🔶 值得落地 / ⏸ 暂缓）、逐条说明与落地建议；文首有跨域结论与统一落地 backlog。锚点均为各域核验基线时点的 grep 实测，只分析不改码。"
---

# 机制映射汇总：研究文献 ↔ negentropy

本文把研究文献与 negentropy 本仓实现的机制对照收拢为一个入口：每域一节，给出核验基线、映射总表、逐条说明与落地建议。判定符号：✅ 已对齐、🔶 值得落地（做 = 绑时机，写 = 一句话成本）、⏸ 暂缓（写明触发条件）。各域锚点均为其核验基线时点的 `grep -n` 实测，本文不改码、不重核行号；某条是否仍然成立，以该域基线戳与本仓现行代码对读为准。

## 前缀登记

条目编号以「域前缀 + 原编号」全局唯一，本表是编号的唯一事实源；跨域引用一律用前缀编号（如 `SK-M5`），不用「某文档 §某节」。

| 域（H2） | 前缀 | 来源精读 | 基线概要 |
| --- | --- | --- | --- |
| 认知与上下文 | `HZ`（Horizon）、`OV`（OpenViking）、`OV-D`（漂移清单） | [011](./cognitive-context/011-horizon-context.md)、[014](./cognitive-context/014-openviking.md) | HZ：分支重评选，2026-09-17；OV：HEAD `a924fadd`，上游钉 `14a7b812` |
| Agent 基础设施：Skills | `SK-M`（规范映射）、`SK-A`（供应链） | [230](./agent-infra/230-agent-skills-standard.md)（含 090 一代吸收）、[220](./agent-infra/220-skills-supply-chain.md) | 091：分支无哈希；211：`95f5a532` @ 2026-09-26；221：2026-09-28 + 外部钉点 |
| Agent 基础设施：Jev | `JV` | [200](./agent-infra/200-jev-system-one-model.md) | HEAD `95f5a532e` @ 2026-09-26 |
| 自进化 | `PG`、`DR` | [142](./self-evolution/142-procedural-graphs.md)、[144](./self-evolution/144-dream-rsi.md) | 均为分支名，无本仓基线哈希与核验日 |
| Agent Harness | `AN`（AI Native）、`HM`（Hermes）、`HM-D`（取证副产物） | [180](./agent-harness/180-ai-native-handbook.md)、[190](./agent-harness/190-hermes-agent.md) | AN：`161d6244`；HM：`2edf3ed5`，Hermes 钉 `068db016` |

## 跨域结论

- **Skills**：对齐面最宽（三级披露、空集省略、宽容加载、离线 eval 门均 ✅，两处强于参考实现）；真增量集中在目录与激活契约（`expand_skill` 未挂载，ISSUE-194）与目录注入面无转义。
- **Jev**：编排级快慢分工与弃权孤例已在；真增量是四条纪律（弃权语义、矫正 counter、置信缺省方向、量纲分组），多数是「写」级成本。
- **Agent Harness**：闭环骨架与审批底座已在；交互式对话的压缩为零（HM-M11，最高优先）与记忆链路防注入（HM-M3）是主链路缺口；凭据边界与生产门控绑定「触达生产」触发条件。
- **认知与上下文**：定义注册、评估闭环、渐进披露已有同构物；真增量是验证问答资产、定义内嵌同义词与指令、冲突浮出人工裁决、信任归一。
- **自进化**：门控进化骨架已备且部分更完备；唯一「做」是编辑级拒绝记忆（PG-M2），其余对齐或绑触发条件。

## 统一落地 backlog

各域「落地建议」的跨域索引，判定与绑时机以对应域的节为准。

### 做

| 条目 | 内容 | 关联 |
| --- | --- | --- |
| OV-7 | 会话→记忆触发：巩固触发器 + consolidation_jobs 消费者 + 水位，独立 PR 先于 013 Phase 1 | ISSUE-195 |
| OV-9 | 巩固 diff 审计：审计面接 UI，merge loser 可追溯 | ISSUE-195 |
| OV-10 | 幂等水位：threads.metadata.consolidated_at_event_seq，与 OV-7 同 PR | ISSUE-195 |
| OV-3 | 修 OV-D3 `force_refresh` 签名并改源水位判据，独立 PR 先于 013 Phase 1 | ISSUE-195 |
| SK-M3 + SK-M5 | `expand_skill` 挂载 TOOL_REGISTRY + 目录块行级清洗，同一 PR，先做 (a)/(b) 二选一决策 | ISSUE-194 |
| SK-M14/M15/M19 | 写入链路规范校验：name 正则、description ≤1024 拒换行、盘上合规单测 | ISSUE-194 |
| SK-M20 | 翻译物化 frontmatter 改 `yaml.safe_dump`，一行 | — |
| SK-M22 | materializer 清扫盘上孤儿目录（生成标记区分手写目录） | — |
| JV-3、JV-16 | judge 族解析矫正 counter + warn，绑 evaluator/plan_reviewer 下次触碰 | ISSUE-198 |
| JV-9 | KG 置信缺省方向修正（`extractors.py:972`） | ISSUE-198 |
| JV-4 | 自动作答解析失败改走 `_FALLBACK_ANSWER` | ISSUE-198 |
| JV-13 | 在用未注册 task key 补注册或前移校验 | ISSUE-198 |
| PG-M2 | 自进化提案回路增加编辑级拒绝记忆 | — |
| HM-M11 | 交互式对话启用 `EventsCompactionConfig`，验收含无孤儿 function_response | — |
| HM-M3 | 记忆写入过威胁模式表、注入块补数据声明，与 SK-M5 同批 | ISSUE-195 |
| HM-M10 | 中文关键词检索修复（CJK 分词），绑 hybrid search 触碰 | ISSUE-196 |
| HM-M9 | 事件全文索引 + 只读会话检索，ISSUE-195 评审同场决定 | ISSUE-195 |
| HM-M14 | 审批覆盖面与文档对齐（补接线或收窄清单） | ISSUE-197 |
| HZ-6 | ContextGuard 出口守卫随蓝图 Phase 2 落地 | — |
| HZ-10 | 验证问答资产沉淀（绑 patrol done 文档） | — |
| HZ-11 | 信任归一实现（authority 分层 + log1p + 单一 staleness） | — |
| HZ-15 | 守卫上下文纳入调用方身份 | — |
| AN-15 | 推断 verdict 加 `verdict_inferred` 审计标记 | — |
| AN-12 | ContextGuard 纳入调用方身份（与 HZ-15 同时机） | — |

### 写

| 条目 | 内容 |
| --- | --- |
| SK-M8 | 校验断言补「allowed-tools 空格分隔」；设计文档区分 `required_tools` 与 `allowed-tools` |
| SK-M18 | `harness_materializer.py:4` 头注释校正 |
| SK-M15 | 3 个缺「何时用」的技能补 description 子句 |
| SK-M20 | registry 解析 YAML 错误详情透传 422（做半项 `yaml.safe_dump` 见做表） |
| SK 漂移清单 | 「模型驱动激活已实现」表述随 SK-M3 修复订正 |
| JV-1 / JV-10 / JV-7 / JV-12 | 枚举姿势 ADR、confidence 量纲分组注记、plan_reviewer 污染注记、rerank 纯排序语义注记 |
| PG-M3 / DR-M1 | 自进化方案补「报告返回态」纪律；补「元级评估重放化」候选方向与触发条件 |
| HZ-1 / HZ-5 | 蓝图对象层章交叉引用 synonyms/instructions/verified-QA 字段；治理实例化补策略对象化 |
| OV-D6 | 取证漂移：_fetch_memory 用户校验登记（先于巩固上线，ISSUE-195；OV-D1 通道表述订正已销账、OV-D2 修复由做表 OV-7 承载） |
| AN-9 | `ToolStatsDaily` 聚合查询产出低成功率能力清单，接入巡检报告 |

### 暂缓（触发条件见各域节）

| 条目 | 触发条件（概要） |
| --- | --- |
| SK-M7 / SK-M9 / SK-M10 / SK-M17 | 盘上/多租户技能源；上下文压缩层；确定性触发诉求；技能分发可执行脚本用例 |
| JV-8 / JV-13 运行时分流 / JV-14 / JV-1 升级 / 接入 Jev 本体 | LLM 成本可观测；有校准置信信号；faculty A/B 数据；脏输出率高到值得工程化；官方中文量化或可自托管校准 |
| PG-M4 / DR-M1 重放模拟器 / DR-M6 | 步骤乱序成主因；序列决策编排层成为进化对象等三条件；语义注入边界警示 |
| HZ-4 / HZ-7 / HZ-12 / HZ-14 / HZ-16 | 派生口径资产；显式定义覆盖不足；跨系统语义模型；定义派生血缘需求；对外供给治理 |
| AN-10/11 / AN-13 / AN-14/17 / AN-7 | 第三方依赖与不可信代码或跨用户；拒绝文本反复猜测；生产动作与凭证；知识库过期冲突条目 |
| OV-1 / OV-4 / OV-5 / OV-8 档 / OV-13 | 统一 URI 与 013 ADR-1 冲突只取寻址；typed query 待多源统一检索；目录递归待深层语义目录；去重 LLM 档待规模；目录递归同前 |

## 认知与上下文

> 核验基线：
>
> - Horizon | 分支 `ThreeFish-AI/horizon-context-recalibrate`，无本仓基线哈希 | 2026-09-17 | 源文档未标注外部钉点
> - OpenViking | 工作区 HEAD `a924fadd` | 源文档未标注核验日 | `volcengine/OpenViking@14a7b812`（2026-09-23，AGPL-3.0）
>
> 两份锚点均经 `grep -n` 实测，只分析不改码；OV 锚点中 `ng/` = `apps/negentropy/src/negentropy/`。材料出处：Horizon 见 [Horizon Context 精读笔记](./cognitive-context/011-horizon-context.md)（机制详解、实验室、批判性边界、重评审记录），HZ 条目内的 M1–M7 标记取自该笔记经全局重评选后的新口径，背景调研见 [Snowflake 数据云调研 §D7 Horizon Catalog](./retrieval-storage/034-snowflake-data-cloud.md)；OpenViking 见 [OpenViking 精读笔记](./cognitive-context/014-openviking.md)（机制载荷与证据分级）。设计 SSOT 是 [Context Layer 技术蓝图：Agent 系统的上下文供给与治理](./cognitive-context/013-context-layer-blueprint.md)（三轴蓝图 + 本仓治理织物实例化，是 HZ-13、HZ-1 的展开；2026-09-27 完全重铸）。

Horizon 的 16 条映射为 ✅4 / 🔶8（含部分对齐 1）/ ⏸4：骨架同构物本仓已有（definitions registry 与 parse_definition 422 门、patrol/Judge 评估-修正闭环、skills_injector 三层渐进披露、CatalogService/GlobalSearchService），真增量集中在验证问答、定义内嵌同义词与指令、冲突浮出人工裁决、四因子信任归一、代理会话权限天花板、MCP 供给面六处。OpenViking 的 13 条映射为 ✅4 / 🔶5 / ⏸4：能力大多已有等价物，只是形态为 Postgres 表加 JSONB 元数据；最大真增量是 OV-7 会话两阶段提交，对准「交互式对话 → 长期记忆」链路零触发方的断链（OV-D2），OV-1 统一 URI 因副本式存储与 013 ADR-1 冲突而只取寻址格式。取证副产物中 OV-D2、OV-D3、OV-D6 优先级最高，OV-D6 须在 ISSUE-194 方案落地前先修。两份映射的落点都在 013 蓝图：HZ-1、HZ-13 是其展开，OV 的回写建议见 OV 蓝图对位。

### HZ 与 OV 映射总表

**Horizon**

| # | 材料机制（出处，新口径） | 本仓对应 | 锚点（实际核验 2026-09-17） | 判定 |
| --- | --- | --- | --- | --- |
| HZ-1 | M1 口径单点：semantic view 五段式（CREATE SEMANTIC VIEW） | definitions registry SSOT（4 类定义 + 版本/checksum 派生列） | [`models/definition.py:40`](../../apps/negentropy/src/negentropy/models/definition.py) · [`registry.py:117`](../../apps/negentropy/src/negentropy/agents/definitions/registry.py) · 迁移 0095–0099 | 🔶 部分对齐 |
| HZ-2 | M1 注册期结构校验门（validation-rules：FK→键列/≥1 dim+metric） | parse_definition 解析+领域校验，失败 422 拒落库 | [`registry.py:117`](../../apps/negentropy/src/negentropy/agents/definitions/registry.py) | ✅ 已对齐 |
| HZ-3 | M1 定义激活物化（semantic view 即查即用） | harness_materializer：DB SSOT → `.agent/skills/<key>/SKILL.md` 渲染 | [`harness_materializer.py:137`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py)（materialize_all） | ✅ 已对齐 |
| HZ-4 | M1 查询期重算（agg-before-join/distinct/derived/半可加） | 无对应（本仓非数据指标栈） | — | ⏸ 暂缓（YAGNI） |
| HZ-5 | M2 查询期行列级访问策略（策略对象 + 执行面强制） | API 层鉴权 + `accessible_corpus_ids` 过滤（非独立策略对象） | [`hybrid_planner.py:189`](../../apps/negentropy/src/negentropy/agents/tools/hybrid_planner.py) · [`hybrid_planner.py:223`](../../apps/negentropy/src/negentropy/agents/tools/hybrid_planner.py) | 🔶 值得落地 |
| HZ-6 | M3 语义级治理执行（双层防线：检索过滤+执行拒绝） | RBAC 检索过滤已有（`scoped & accessible`）；出口守卫 ContextGuard 仅在方案中 | [`hybrid_planner.py:322`](../../apps/negentropy/src/negentropy/agents/tools/hybrid_planner.py)（_seed_retrieval）· 方案 [`013 §7.3`](./cognitive-context/013-context-layer-blueprint.md) | 🔶 值得落地 |
| HZ-7 | §10 富化 eval 自纠环（金标准问答→修正理解→重排） | patrol/Judge 巡检闭环：评分→终态沉淀→失败记忆→reconcile | [`evaluator.py:188`](../../apps/negentropy/src/negentropy/engine/routine/evaluator.py)（RoutineEvaluator）· [`pdf_fidelity_patrol.py:655`](../../apps/negentropy/src/negentropy/engine/schedulers/handlers/pdf_fidelity_patrol.py) | ✅ 已对齐（机制同构） |
| HZ-8 | §10 富化 冲突浮出人工裁决（CONFLICT 卡片，不许自动选） | 无显式对应（patrol_memory 有 unfixable 记忆，但无「同名定义冲突→人工裁决」面） | [`patrol_memory.py:42`](../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) TAG 常量群 | 🔶 值得落地 |
| HZ-9 | §11 检索激活（top-k 上下文包：定义+指令+验证问答） | 三层渐进披露：L1 描述常驻 / L2 模板按需 / L3 资源挂载 | [`skills_injector.py:342`](../../apps/negentropy/src/negentropy/agents/skills_injector.py)（format_skills_block）· [`context_assembler.py:43`](../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) | ✅ 已对齐 |
| HZ-10 | M4 应答层验证锚定（AI_VERIFIED_QUERIES + VERIFIED_BY/AT 溯源） | 无对应（巡检通过的文档未沉淀为「验证问答对」资产） | — | 🔶 值得落地 |
| HZ-11 | §11 四因子信号排序（R/A/P/F） | 信任归一公式已设计未实现；缺 freshness 单一 staleness | [`013 §5.2`](./cognitive-context/013-context-layer-blueprint.md)（三视图与信任归一）· Memory 缺口见 013 §11.3 | 🔶 值得落地 |
| HZ-12 | §12 生态 Ossie YAML 互操作 | 无对应 | — | ⏸ 暂缓（YAGNI） |
| HZ-13 | §12 生态 MCP 激活面（对外供给外部 agent） | 方向相反：本仓是 MCP **客户端**（perceives 经 McpClientService 接入） | [`mcp_client.py:307`](../../apps/negentropy/src/negentropy/interface/mcp_client.py)（McpClientService） | 🔶 值得落地（供给面） |
| HZ-14 | M5 端到端列级血缘（引擎沉淀 + OpenLineage 摄取） | 无对应（routine 执行史是运行日志，非资产依赖图） | — | ⏸ 暂缓（YAGNI） |
| HZ-15 | M6 Agent Identity（代理会话权限天花板 + agent 归因审计） | 部分对应：agent 类型元数据有（preset 描述用），「代理会话权限只减不增」无 | [`agents_api.py:44`](../../apps/negentropy/src/negentropy/interface/agents_api.py)（agent_type 字段）· [`agent_presets.py:109`](../../apps/negentropy/src/negentropy/interface/agent_presets.py)（_agent_type） | 🔶 值得落地 |
| HZ-16 | M7 分类与标签驱动策略传播（自动分类→标签→策略） | 无对应（definitions.meta JSONB 可承载标签，但无分类扫描与标签驱动策略链） | — | ⏸ 暂缓（YAGNI） |

**OpenViking**

| # | OpenViking 机制（014 出处） | 本仓对应 | 锚点（实测） | 判定 |
| --- | --- | --- | --- | --- |
| OV-1 | M-a 统一 URI 命名空间 `viking://{resources,user,agent}`（§2） | 无路径式 URI；多维分面寻址 `app_name × user_id × memory_type × metadata`；异构资源靠 typed pointer `{type,ref}` | `ng/engine/routine/patrol_memory.py:61` · `ng/agents/tools/skill_resources.py:84` | ⏸ |
| OV-2 | M-b 目录级 L0/L1/L2 分层 sidecar（§3） | 四种「两级形态」：Skills L1/L2/L3、画像摘要→原文、KB parent/child chunk、KG 多 level 社区摘要 | `ng/agents/skills_injector.py:342` · `ng/engine/consolidation/memory_summarizer.py:93` · `ng/knowledge/service.py:3680` | 🔶（部分） |
| OV-3 | M-b 自底向上生成 + 父级按变化比例刷新（§3.3） | 画像摘要是 24h TTL（不感知源变化）；KG 摘要二值 dirty + 全量重建；会话标题已有「事件增量 ≥20 才刷新」水位范式 | `ng/engine/consolidation/memory_summarizer.py:38,95` · `ng/engine/title_inspector.py:99,191` | 🔶 |
| OV-4 | M-c 意图分析拆 typed query（§4.1） | 单意图分类：记忆侧 `primary+boost_types` 加权；KB 侧五意图正则路由；不拆子查询 | `ng/engine/utils/query_intent.py:54` · `ng/knowledge/retrieval/unified_search.py:28` | ⏸ |
| OV-5 | M-c 全局定起点 → 优先队列下钻 → 分数传播 → 收敛 → rerank（§4.2） | 无目录递归；最近等价物：KB child→parent lift（单层）、HybridPlanner 四阶段、记忆 PPR `alpha^d` 衰减 | `ng/knowledge/service.py:3692` · `ng/agents/tools/hybrid_planner.py:218` · `ng/engine/adapters/postgres/association_service.py:518` | ⏸ |
| OV-6 | M-d 同步归档消息（§5.1） | `append_event` 同步写 `events`（全局 `sequence_num`） | `ng/engine/adapters/postgres/session_service.py:228` · `ng/models/pulse.py:48` | ✅ |
| OV-7 | M-d 异步摘要 + 记忆提炼（commit 第二阶段，§5.2） | **交互式对话零触发**：`add_session_to_memory` 无调用方；`consolidation_jobs` 只入队无消费者；仅 Routine 路径有 fire-and-forget 提炼 | `ng/engine/adapters/postgres/memory_service.py:84` · `ng/db/migrations/versions/0043_memory_automation_sql_functions_static.py:104` · `ng/engine/routine/orchestrator.py:1393` | 🔶（最高优先） |
| OV-8 | M-d 候选去重合并（§5.3） | 全阈值/规则、无 LLM 裁决：写入期 cos≥0.85（0.80–0.85 加 Jaccard≥0.7）判重；写后 DedupMerge cos≥0.90 合并 soft-delete；事实同 key 规则化 supersede/keep_both | `ng/engine/adapters/postgres/memory_service.py:62,558` · `ng/engine/consolidation/pipeline/steps/dedup_merge_step.py:191` · `ng/engine/governance/conflict_resolver.py:134` | ✅ 主干 / ⏸ LLM 档 |
| OV-9 | M-d memory_diff 审计（§5.4） | 审计分三处且不覆盖自动巩固：`memory_audit_logs`（人工）、`memory_conflicts`（事实）、`metadata.merged_from`（合并） | `ng/engine/governance/memory.py:298` · `ng/engine/tools/memory_tools.py:223` | 🔶 |
| OV-10 | M-d `.done` 幂等水位（§5.5） | per-thread advisory lock 防并发，但**无「已巩固到第 N 条事件」水位**，重跑整段重做 LLM 提取 | `ng/engine/adapters/postgres/memory_service.py:221` · `ng/engine/title_inspector.py:191`（可复用范式） | 🔶 |
| OV-11 | 九类记忆类型学（§5.3 表） | 6 类 `memory_type` + 4 类 `fact_type` + `subtype=reflection` + Core Block label + Patrol tag，逐项见 014 §5.3 对照表 | `ng/engine/governance/memory.py:37,69` | ✅ |
| OV-12 | M-e 检索轨迹可追溯（§4.5） | 分通道齐全：`memory_retrieval_logs` 落库含每条 `search_level/score_type/raw_score/intent_boost`；KB PlannerResult 回传延迟与桥接证据链 | `ng/engine/adapters/postgres/retrieval_tracker.py:58` · `ng/memory_service.py:1411` · `ng/agents/tools/hybrid_planner.py:129` | ✅ |
| OV-13 | M-f experiences → Agent Evolution（§5.6） | 两端都在、无桥接：经验侧 Routine 提炼 procedural 记忆已回注；进化侧 6 个 handler 不读经验记忆 | `ng/engine/routine/memory_extractor.py:40` · `ng/engine/evolution/handlers/skill.py:120` | ⏸ |

### HZ 与 OV 逐条说明

**Horizon**

**HZ-1 对象模型（🔶）**。本仓 definitions 表已是 4 类定义的 SSOT（source 为源，meta/version/checksum 为派生冗余列），与 semantic view「元数据对象」定位同构。差异在字段面：Horizon 把**agent 检索面**做成了对象字段，包括 `WITH SYNONYMS`（召回别名）、`AI_SQL_GENERATION`（随定义分发的指令）、`AI_VERIFIED_QUERIES`（验证问答）；本仓定义的 `meta` JSONB 可承载等价信息但尚无此纪律。建议：在 Context Layer 落地时为上下文对象补「synonyms + instructions + verified Q&A」三字段约定（见蓝图对象层章）。

**HZ-2/HZ-3 注册与激活（✅）**。parse_definition 的领域校验（validator/meta_extractor 注册表 + 422 拒入库）与 validate_view 的结构校验门同构；harness_materializer「DB→.agent/skills 按内容幂等渲染」与 semantic view「定义即查即用」同构。定义不复制、消费端只持指针，符合 SSOT。

**HZ-4 声明式聚合（⏸）**。本仓无指标栈，agg-before-join 等聚合纪律暂无落点。触发条件：当仓内出现「派生口径」类资产（如多 routine 评估分汇总、跨文档质量聚合）时，引入「口径声明 + 出口校验」纪律，防 average-of-averages 型错误。重评选注记：材料侧该能力已并入 M1 双不变量的「查询期重算」半边，本条映射语义不变。

**HZ-5 行列级策略（🔶，新晋机制）**。Horizon 把可见性规则铸成 schema 级**策略对象**在查询期强制；本仓的等价物是 `accessible_corpus_ids` 传入检索管线过滤（作用等同行访问策略的行级过滤），但它是**调用约定而非策略对象**，策略与代码耦合、无独立生命周期。建议：Context Layer 落地时把「谁能看哪些 corpus/定义」提升为带版本与审计的策略资产。

**HZ-6 双层治理（🔶）**。Horizon 的关键论点是检索层过滤只是体验、执行层拒绝才是治理。本仓 HybridPlanner 已做 `scoped & accessible` 过滤（第一层），但「代码回退路径必经的出口守卫」尚停留在 013 §7.3 方案的 ContextGuard（第二层）。建议随 013 §15 Phase 2 落地，勿降级为可选检查。

**HZ-7 自纠环（✅，机制同构）**。patrol/Judge 的「评分→终态→失败记忆→reconcile」与 Cortex Sense 的「eval 错配→修正理解→重排」机制同构（✅ 部分）。

**HZ-8 冲突浮出人工裁决（🔶）**。真缺口是**冲突浮出**：当两个来源对同一对象给出矛盾断言（如巡检结论 vs memory 信念），本仓无「并列呈现 + needs_adjudication + 不自动选」的显式契约。Horizon 的教训（D4 实验：auto_popularity 让错误口径胜出）说明这层不是锦上添花。重评选注记：冲突纪律随富化降入 §10 专章，但作为**智识资产完整保留**，映射价值不减。

**HZ-9 渐进披露（✅）**。L1/L2/L3 三层与「top-k 上下文包（定义+指令+验证问答）」同构：常驻描述≈条目摘要，按需展开≈上下文包，资源挂载≈verified query 重放。

**HZ-10 验证问答（🔶，重评选后升格为独立机制 M4）**。本仓巡检通过（done）的文档是天然的「已验证资产」，但目前止步于状态列；把它们沉淀为「问题→答案/文档锚点→验证人/时间」的问答对，agent 命中即短路重放并携带溯源，是本仓最便宜的信任度来源（Horizon 把它做成了 DDL 一等公民，且重评选把它升格为应答层独立承重机制）。

**HZ-11 四因子归一（🔶）**。013 §5.2 的复合信任分（0.4 retention + 0.3 importance + 0.3 freshness 等）与 R/A/P/F 同构，但未实现且各子系统量纲未一。落地时建议采纳 Horizon 口径的三个纪律：①**authority 区分 governed/inferred**；②**popularity 用有界变换**（log1p/上限，防全局 max 漂移，原型 `rank` :467 的实现即此）；③**freshness 必须是单一 staleness 量**（直击 Memory 子系统已知缺口）。

**HZ-12 Ossie（⏸）**。触发条件：上下文对象需要跨系统携带（导入/导出第三方语义模型）时，对齐 Apache Ossie YAML 而非自造格式。

**HZ-13 MCP 供给面（🔶）**。本仓 McpClientService 已有 MCP 协议工程经验（perceives FileResource 生命周期不变量等），但角色是消费者。Context Layer 若要「广泛应用于 Agents 研发与平台集成」，需要**供给面**，即把目录/检索/编译/反馈经 MCP 暴露给任意外部 agent。原型 [`assets/horizon_context_mcp.py`](./cognitive-context/assets/horizon_context_mcp.py) 已验证纯标准库 stdio 可行（四工具 + 引擎层 RBAC 经 MCP 仍生效）。重评选注记：MCP 在材料侧降入 §12 专章并记为「第一顺位晋级候选」，本条「值得落地」判定不受影响（供给面价值与本仓路线独立成立）。

**HZ-14 血缘（⏸，新晋机制）**。本仓 grep 全仓无 lineage 实现；routine/巡检的执行史是运行日志（谁跑了什么），不是资产依赖图（什么派生自什么）。触发条件：当出现「定义/文档资产间的派生关系图」需求（如定义变更影响面分析、跨文档口径溯源）时，优先引入「写入时自动沉淀依赖边」的引擎副产品模式，而非事后扫描。

**HZ-15 Agent Identity（🔶，新晋机制）**。本仓 `agent_type`/`_agent_type` 是 **preset 描述元数据**（区分 routine agent 类型），不是 Horizon M6 的「代理会话身份」，后者守护的是**代理代表用户行事时的权限天花板与归因审计**。本仓引擎任务以服务身份运行（权限天然收束），但用户触发的 agent 会话（如 ad-hoc 工具调用链）无「会话权限=用户权限∩代理允许面」的显式契约。建议：Context Layer Phase 2 的 ContextGuard 设计中把「调用方身份（人/代理/服务）」纳入守卫上下文，归因写入审计日志。

**HZ-16 分类标签（⏸，新晋机制）**。本仓定义资产暂无敏感分级需求（非数据资产栈）。触发条件：当 definitions 出现「哪些定义可对外供给、哪些仅内部」的规模化治理需求时，先做「标签字段纪律」（definitions.meta 承载），再考虑自动分类。

**OpenViking**

**OV 引入约束（许可证）**。上游 2026-03-30（`ce998873`，v0.2.15 起）由 Apache-2.0 改为 **AGPL-3.0**（`crates/ov_cli`、`crates/ragfs`、`examples/` 仍为 Apache-2.0）。本仓 Apache-2.0：**不得 vendoring/改写其主体代码**；以独立进程网络调用（若引入）不触发 AGPL 传染，但任何「改造后对外提供网络服务」的场景都需法务评估。

**OV-1 统一 URI（⏸）**。`viking://` 是「把一切导入自有 AGFS」的副本式设计；013 §5.2 ADR-1 明确拒绝该形态（新表=副本=Split-Brain 引信）。**触发条件**：013 三视图/`context_catalog_unified` 落地时，把 `{item_type}:{uuid}` 定为统一指针格式，只取其寻址语法（scope 语义、确定性 ID），不取其存储。

**OV-2 分层披露（🔶）**。本仓已有四种两级形态但无「每节点 sidecar」。值得做的只是**新鲜度**子集（OV-3）；逐目录 sidecar 与本仓「目录=人工 Wiki 组织」的现状不匹配，且 Skills L2/L3 实际不可达（ISSUE-194），先修激活层再谈分层。

**OV-3 新鲜度（🔶）**。`get_or_generate_summary` 的 24h TTL 不感知源数据变化；且 SummarizeStep 传入的 `force_refresh` 因签名不符抛 TypeError 被降级吞掉（OV-D3）。**绑定 OV-7 同批**：OV-7 落地后 summarize step 每次巩固真实执行，TTL 失真随即暴露；修法是把 TTL 换成「源水位差」判据，范式直接复用 `title_inspector.py:191`。

**OV-4 typed query（⏸）**。拆分收益取决于「多源统一检索」先存在。**触发**：013 §8.4 ADR-2（HybridPlanner 接 Memory 第 4 路种子）落地后，把 intent 升级为「按源 typed sub-query」。OpenViking 自己的教训（014 §4.1：priority/intent 字段不参与排序、无会话即不触发）说明这条机制的实际收益并未被验证，不必抢跑。

**OV-5 目录递归（⏸）**。需要一棵「语义化的深层目录树」。本仓记忆扁平、KB 目录是人工组织、`navigation` 意图只返回 corpus 列表，现在引入递归等于先造树再检索，YAGNI。**触发**：检索评测出现「建错目录/选错 corpus」类失败占比显著，或 catalog 深度 ≥3 且 Agent 需要按目录浏览。OpenViking 的两条实测教训（014 §4.2：默认部署不触发递归；α=1.0 后层级只影响可达性不影响排序）是引入前必读的反例。

**OV-6 同步归档（✅）**。`events.sequence_num` 全局序 + `append_event` 同步落库，与 Phase 1「归档是事实」等价。

**OV-7 会话→记忆触发（🔶，OV 内最高优先）**。断链修复而非新特性。最小方案：① 复用 inspector 范式选「事件水位差 ≥Δ 且空闲 ≥T」的会话；② 入队 `consolidation_jobs`（表与部分索引已存在，迁移 0043/0044）；③ 消费者 `FOR UPDATE SKIP LOCKED` 取任务执行 `_simple_consolidate`，成功推进水位。零新表。二阶风险：每会话新增一次 embedding + LLM 提取（用 Δ、T 封顶）；单 uvicorn worker 下消费者必须是异步限流后台任务；巩固后 preload 检索到更多 episodic 行，需观察 `memory_retrieval_logs` 噪声率。

**OV-8 去重合并（✅/⏸）**。主干等价且更可审计（阈值可解释）。LLM 裁决档（OpenViking 的原子写集）只值得用于**模糊带** cos 0.80–0.90。**触发**：模糊带误合并/漏合并被 retrieval 反馈证实（`outcome_feedback=irrelevant` 聚集在 `merged_from` 行）。OpenViking 的反例（014 §5.3：topic 命名漂移即产生矛盾并存、跨会话单条新文件直通不查语义）说明 LLM 裁决不是银弹。

**OV-9 巩固 diff 审计（🔶）**。消费者把本轮 `{created_ids, merged:[{loser, primary}], superseded_facts, steps:[StepResult]}` 写入已有的 `consolidation_jobs.result` JSONB（`ng/models/internalization.py:323`），不新建表；人工审计继续走 `memory_audit_logs`，两者正交。注意 OpenViking 的教训：`memory_diff` 只写不读等同摆设，审计必须接一个消费方（UI `/memory/audit` 展示即可）。

**OV-10 幂等水位（🔶）**。`threads.metadata` 增加 `consolidated_at_event_seq`，同构 `title_generated_at_event_seq`。OpenViking 的两条细则值得抄：水位只记「到哪了」不记「做了什么」（重跑靠内容去重兜底）；`.done` 最后写（提交点语义）。

**OV-11 类型学（✅）**。类型学覆盖完整（trajectories 以日志形态存在是本仓的合理取舍）。

**OV-12 检索轨迹（✅）**。检索轨迹分通道已比 OpenViking 落地更实（它的 `ThinkingTrace` 无生产者，014 §4.5）。

**OV-13 经验进化（⏸）**。经验进化闭环已按 Reflexion 方式成立，**触发**：ISSUE-194 修复后若 skill_template proposer 长期无证据不提案，再把同 skill 相关的 procedural 失败教训接为证据源。

### HZ 与 OV 落地建议

**Horizon**

**做**（绑时机）：

- HZ-6：ContextGuard 出口守卫随 013 §15 Phase 2 落地，两路径（含代码回退）必经。
- HZ-10：验证问答资产。绑 patrol 终态 done 的文档，沉淀「问题→锚点→验证人/时间」问答对，agent 预载短路。
- HZ-11：信任归一实现，采纳 authority 分层 + log1p 有界 + 单一 staleness 三纪律。
- HZ-15：守卫上下文纳入调用方身份。ContextGuard 设计时把「人/代理/服务」身份纳入归因审计。

**写**（一句话成本）：

- HZ-1：在 013 对象层章（§4.2，2026-09-27 重铸版）交叉引用 HZ-1 的 synonyms/instructions/verified-QA 字段设计，详细设计由[蓝图](./cognitive-context/013-context-layer-blueprint.md)对象层章承载。
- HZ-5：在 013 §7.3 治理实例化补「策略对象化」建议，把 accessible_corpus_ids 从调用约定升为带版本策略资产。

**暂缓**（写明触发条件）：

- HZ-4：声明式聚合纪律。触发条件：出现派生口径资产时。
- HZ-12：Ossie YAML 对齐。触发条件：需要跨系统携带语义模型时。
- HZ-7：隐式挖掘轨道（Cortex Sense 类）。本仓规模未到「显式定义覆盖不动」的瓶颈（<5% 现象），先吃透 eval 自纠环即可（已有同构物）。
- HZ-14：资产依赖图（血缘）。触发条件：出现定义派生关系分析需求时。
- HZ-16：定义敏感分级。触发条件：出现对外供给治理需求时。

**OpenViking**

**做**（绑定 OV-7 一批，建议独立 PR，先于 013 Phase 1）：

- OV-7/OV-10：会话巩固触发器 + `consolidation_jobs` 消费者 + 水位。
- OV-9：巩固 diff 写 `result` 并接 UI。
- OV-3：修 OV-D3 `force_refresh` 签名并改源水位判据。

**写**（一句话成本）：

- OV-D1/OV-D7：013 旧版 §12.7 #9 状态行校正 + §8.5 宿主更正，**已销账（2026-09-27，013 完全重铸落地为 §11.5/§8.4）**。
- OV-D2/OV-D3/OV-D6：登记进 issue.md。

**暂缓**（写明触发条件）：

- OV-1 统一 URI。触发条件：013 三视图落地时。
- OV-4 typed query。触发条件：ADR-2 统一检索后。
- OV-5 目录递归。触发条件：目录深度 ≥3 且评测出现选错目录类失败。
- OV-8 LLM 档。触发条件：模糊带误判被反馈证实。
- OV-13 经验进化。触发条件：ISSUE-194 修复后 proposer 仍无证据。

### OV 蓝图对位

OV 对 [013 Context Layer 蓝图](./cognitive-context/013-context-layer-blueprint.md) 五层的回写建议如下。

| 013 层 | OpenViking 机制印证 | 对 013 的影响 |
| --- | --- | --- |
| §4 对象层 | 九类记忆只是另一种分面 | 无新增缺口 |
| §5 目录层 | M-a 副本式 = ADR-1 的反面教材 | **强化 ADR-1**：统一指针格式随 §5.3 一并定 |
| §6 富化层 | M-d 提炼是富化层的「供给入口」 | **新增真缺口**：对话路径供给入口断开（OV-7），重铸版 013 §6.2 已并入巩固三件套设计（2026-09-27） |
| §7 治理层 | memory_diff / .done | 新增 🔶：巩固 diff 落 `result` 字段（OV-9）、会话水位（OV-10） |
| §8 激活层 | M-c 递归 / M-e 轨迹 | **校正 013 旧版 §12.7 #9 状态行**：已销账（2026-09-27 重铸落地为 §11.5：L1 ✅ / L2·L3 🔶 ISSUE-194）；旧版 §8.5「自动注入通道 = `ContextAssembler.assemble()`」宿主更正亦已落地（现行 §8.4，见 OV-D1） |

### OV 取证副产物

OV-D1 至 OV-D8 为取证时发现的本仓漂移与风险，已按精读流程登记为 ISSUE-195；ISSUE-194（expand_skill 未挂载）见 [issue.md](../.agents/issue.md)。

| # | 类别 | 现象 | 锚点 | 影响 |
| --- | --- | --- | --- | --- |
| OV-D1 | 文档漂移 | `ContextAssembler.assemble()` 只有单测调用；生产读取仅 `get_memory_summary()`（perception 回退） | `ng/engine/adapters/postgres/context_assembler.py:61` · `ng/agents/tools/perception.py:283` | Core Block 与 Reflection 在交互链路不注入；013 ADR-3「自动通道加 KB 接地」挂错宿主 |
| OV-D2 | 链路断开 | `add_session_to_memory` 零调用方（本仓 + ADK Runner + UI/BFF 的 PATCH memory 路由均无）；`consolidation_jobs` 只入队 | `ng/engine/adapters/postgres/memory_service.py:84` · 025 §4.1 图注与事实不符 | 对话内容不自动沉淀长期记忆，仅靠 Agent 主动 `save_to_memory` |
| OV-D3 | 代码缺陷 | SummarizeStep 的 `force_refresh` 抛 TypeError 被降级吞掉，强制刷新从未生效 | `ng/engine/consolidation/pipeline/steps/summarize_step.py:40` · `memory_summarizer.py:93` | 摘要最多 24h 陈旧；OV-D2 修复后每次巩固空转一次 |
| OV-D4 | 文档漂移 | ConflictResolver docstring 称三阶段检测（key/embedding/LLM），实现只有按 fact_type 的规则 | `ng/engine/governance/conflict_resolver.py:6` 对照 `:110` | 高估冲突检测能力 |
| OV-D5 | 写路径分叉 | `save_to_memory` 直写 `embedding=None`：不去重、无 PII 检测、不写审计，且全仓无 embedding 回填 | `ng/agents/tools/internalization.py:72` | 这些行对 vector/hybrid 与 DedupMerge 不可见 |
| OV-D6 | 授权风险 | `_fetch_memory` 按 UUID 读 Memory，不校验 user/app | `ng/agents/tools/skill_resources.py:167` | 当前因工具未挂载不可达；**ISSUE-194 方案 (a) 落地前必须先修**，否则成为跨用户读取通道 |
| OV-D7 | 状态表失真 | 013 旧版 §12.7 #9「L1/L2/L3 ✅」与 ISSUE-194 结论矛盾 | 013 §11.5 #9 行（2026-09-27 完全重铸后旧行号 :436 失效，以 § 锚为准） | 已回写闭环（重铸版口径：L1 ✅ / L2·L3 🔶） |
| OV-D8 | 部分接线 | memory_pipeline_prompt 进化面只有 fact extractor 读取；summarizer/reflection 仍用硬编码 prompt | `ng/engine/evolution/weights.py:91` | 这两个 scope 的晋升在运行时是 no-op |

## Agent 基础设施：Skills

> 核验基线：
>
> - 091（090 精读配套规范映射，090 现已并入 230）：分支 ThreeFish-AI/agent-skills-spec-study，无本仓基线哈希；核验日源文档未标注；外部钉点：agentskills.io 规范仓固定提交 `69ef37e9`。
> - 211（230 精读配套规范映射）：工作区 `dar-es-salaam-v2` @ `95f5a532`；2026-09-26；外部钉点未单列（上游材料为 [230 精读](./agent-infra/230-agent-skills-standard.md)）。
> - 221（供应链映射）：本 worktree，无本仓基线哈希；2026-09-28；外部钉点：`69ef37e9`（规范仓固定提交）、`b0b3272f`（SEP-2640 SSOT）、`1bd11679`（RFC PR#8 合入提交）。
> - 上游材料：[230 精读](./agent-infra/230-agent-skills-standard.md)（090 精读已并入其内）、[220 精读](./agent-infra/220-skills-supply-chain.md)；问题登记：[ISSUE-194](../.agents/issue.md)；实验室副本：[assets/agent_skills_lab2.py](./agent-infra/assets/agent_skills_lab2.py)。

本仓已结构性实现对齐面：三级渐进披露、目录空集省略、宽容加载 fail-soft、离线 eval 门、metadata 正门、同名唯一约束、盘上技能格式合规均判 ✅，其中目录空集省略优于 skills-ref 参考实现、同名唯一约束强于规范。真增量集中在目录与激活契约（`expand_skill` 未挂载 TOOL_REGISTRY，ISSUE-194）与目录注入面无转义；写入侧规范校验、盘上校验门、翻译物化引号与 materializer 清扫仍缺。供应链层 6 条判定本仓与上游同构地停在 digest 半步：version 槽位闲置、checksum 只作变更检测，无外部下载面属侥幸而非设计，注入层零校验。遮蔽告警、压缩豁免、防自触发、Tier 3 文件型资源按触发条件暂缓。

### SK 映射总表

**Agent Skills 开放规范（22 条）**：上游材料为 230 精读（SK-M13 至 SK-M22 的取证出自其吸收的 090 精读，原文经 git 历史可溯）。行内 `S:` / `G:` / `T:` 行号指针与「原型 B1–B5」沿用 090 的引用记号（分别指规范 `specification.mdx`、客户端指南 `adding-skills-support.mdx`、skills-ref `prompt.py`，均以固定提交 `69ef37e9` 为准；「原型」指 `agent_skills_lab.py`）。

| # | 材料机制（出处） | 本仓对应 | 锚点（grep 实测） | 判定 |
| --- | --- | --- | --- | --- |
| SK-M1 | 三级渐进披露（spec §Progressive disclosure） | Layer 1 目录常驻 / Layer 2 模板按需 / Layer 3 资源懒载 | `agents/skills_injector.py:342`（format_skills_block）/ `agents/tools/skill_registry.py:120`（expand_skill）/ `agents/tools/__init__.py:14`（skill_resources） | ✅ |
| SK-M2 | 无技能时省略目录块（client guide Step 3：omit, don't show empty） | 空列表 → 空字符串 | `agents/skills_injector.py:347-348` | ✅（优于 skills-ref：`skills_ref/prompt.py:32` 空集仍输出空 `<available_skills>` 块，与自家指南相悖） |
| SK-M3 | 模型自主激活依赖工具真实挂载（client guide Step 4） | 目录末行教模型调用 `expand_skill`，但该工具从未进 TOOL_REGISTRY（ISSUE-194，2026-09-23 登记，至今未修） | `agents/skills_injector.py:357` / `agents/tools/__init__.py:28`（已导出）/ `agents/tools/registry.py:66,91`（仅 log_activity + preload_memory_tool）、`:105` | 🔶 做 |
| SK-M4 | R6-b 在线门依赖真实调用样本（SK-M3 二阶影响） | **已重设计**：离线 eval-suite holdout 门优先；在线门仅在 `expand_skill` 有数据时叠加，无数据 → None 交离线门 | `engine/evolution/handlers/skill.py:11`（「离线 held-out 优于噪声在线 canary」）、`:353`、`:428-433`（候选桶无数据 → 跳过在线门） | ✅（重设计落地；在线门成待激活死代码，SK-M3 修复后自动复活） |
| SK-M5 | 目录是注入面：需转义/行锚定（230 lab4·X3 主证 + lab2·X4 补充 + client guide） | `format_skills_block` 直插 name/description，无 escape、无换行防御（对照 skills-ref `prompt.py` html.escape） | `agents/skills_injector.py:353-355` | 🔶 做 |
| SK-M6 | 宽容加载 fail-soft（client guide：warn & load，deliberately relaxes） | `enforcement_mode="warning"` 默认；任何异常记录警告并跳过该条，不冒泡 | `agents/skills_injector.py:93`、`:117-118` | ✅ |
| SK-M7 | 多作用域遮蔽 + shadowed 告警（client guide Step 1） | DB-first 单源解析（skills 表/definitions 表），无盘上多作用域扫描——遮蔽场景结构性不存在 | `db/migrations/versions/0098_seed_harness_skill_definitions.py:888`（DB 即唯一作用域） | ⏸（触发条件：引入盘上技能源或多租户技能库时须实现 project>user + 告警） |
| SK-M8 | allowed-tools 空格分隔（spec，实验性） | 物化链提取 allowed-tools 入盘 frontmatter；但 CC CLI 调用层 `--allowed-tools` 是**逗号** join——同一概念两种语法分层并存 | `agents/definitions/harness_materializer.py:53` / `engine/claude_code/service.py:1025` / `db/migrations/versions/0026_skill_enforcement_and_resources.py:12`（enforcement 对应 Anthropic Skills allowed-tools） | 🔶 写 |
| SK-M9 | 技能内容豁免上下文压缩（client guide Step 5） | 本仓交互式对话零压缩（Hermes 精读已证），无压缩器即无豁免需求 | 本文 HM-M11（对话零压缩结论） | ⏸（触发条件：引入上下文压缩/摘要层时必须同步实现豁免标记，否则技能静默降级） |
| SK-M10 | disable-model-invocation / 用户显式点名（生态扩展字段） | 无此开关；Layer 1 目录恒注入 | `agents/skills_injector.py:342`（无开关参数） | ⏸（YAGNI：单 owner 场景无确定性触发诉求） |
| SK-M11 | 描述/技能质量用 eval 驱动迭代（optimizing-descriptions / evaluating-skills） | 技能进化：离线 EvalSuite holdout 零回归门 + visible_results_query 结构性排除 holdout（防 Goodhart）+ 无绑定 EvalSuite → reject | `engine/evolution/handlers/skill.py:7-15`、`:351` | ✅（形态不同、机理同构：离线验证优于在线噪声，与指南「trigger rate 协议」同一纪律） |
| SK-M12 | metadata 是私货唯一正门（spec §metadata） | definitions 表 schema 专列承载（content/typing 等），私货不走 SKILL.md metadata 字段 | `db/migrations/versions/0098_seed_harness_skill_definitions.py:888`（仅提取三键）/ `agents/definitions/harness_materializer.py:53` | ✅（DB schema 即正门，强于规范层的弱约定） |
| SK-M13 | 技能 = 目录 + `SKILL.md`（YAML 头 + Markdown 正文）（`S:6-21`） | 盘上 `.agent/skills/*/SKILL.md` ×11 为 materializer 生成物；运行时载体是 DB 行 | [`harness_materializer.py:114-134`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) · [`models/skill.py:27-68`](../../apps/negentropy/src/negentropy/models/skill.py) | ✅ 盘上格式合规；运行时 DB-first 属[有意取舍](../concepts/design/skills.md) |
| SK-M14 | `name`：1–64、小写字母数字连字符、首尾无 `-`、无 `--`、等于目录名（`S:58-65`） | 盘上 11/11 合规；但 API / DB / UI / definitions 校验器均不校验格式 | [`harness_materializer.py:41-47`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) · [`skills_api.py:43`](../../apps/negentropy/src/negentropy/interface/skills_api.py) · [`SkillFormDrawer.tsx:313-321`](../../apps/negentropy-ui/app/interface/skills/_components/SkillFormDrawer.tsx) | 🔶 做 |
| SK-M15 | `description`：1–1024，写「做什么 + 何时用」（`S:91-96`） | 盘上 3/11 缺「何时用」；`skills.description` 为无上限 `Text`，全量注入目录 | [`models/skill.py:29`](../../apps/negentropy/src/negentropy/models/skill.py) · [`skills_injector.py:353-355`](../../apps/negentropy/src/negentropy/agents/skills_injector.py) | 🔶 做 |
| SK-M16 | Tier 2：结构化包裹、harness 侧显式注入、去重（`G:258-262`、`G:274-302`） | `format_skill_invocation` 以 `<skill name=…>` 包裹，Jinja2 沙箱渲染；REST / 调度器 / 翻译为显式注入路径 | [`skills_injector.py:361-384`](../../apps/negentropy/src/negentropy/agents/skills_injector.py) · [`skills_api.py:825`](../../apps/negentropy/src/negentropy/interface/skills_api.py) · [`skill_scheduler.py:94`](../../apps/negentropy/src/negentropy/agents/skill_scheduler.py) | ✅ 已对齐 |
| SK-M17 | Tier 3：`scripts/` `references/` `assets/` 文件按需读取（`S:187-237`） | typed resources（kg_node / memory / corpus / url / inline）+ `fetch_skill_resource` 路由；非文件，且同样未挂载 | [`tools/skill_resources.py:46-125`](../../apps/negentropy/src/negentropy/agents/tools/skill_resources.py) | ⏸ 暂缓（语义正交） |
| SK-M18 | 发现路径：`.agents/skills/` 跨客户端约定 + 客户端原生目录（`G:45-58`，非规范） | 盘上路径 `.agent/skills`（单数）；头注释称「供 Claude Code harness 文件 glob 发现」 | [`harness_materializer.py:1-5`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) | 🔶 写（校正注释）/ ⏸ 迁移 |
| SK-M19 | 校验：`skills-ref validate`（`S:239-247`） | 盘上技能无 CI / pre-commit / 单测校验；materializer 测试探针键名本身违反命名规则 | [`test_harness_materializer.py`](../../apps/negentropy/tests/unit_tests/agents/definitions/test_harness_materializer.py)（`_test_materialize_probe`） | 🔶 做 |
| SK-M20 | frontmatter 解析与生成的健壮性（`G:103-141`） | 翻译物化以 f-string 写入**未加引号**的 description；registry 解析吞掉 YAML 错误细节 | [`translation/service.py:376-378`](../../apps/negentropy/src/negentropy/knowledge/translation/service.py) · [`definitions/registry.py:47-77`](../../apps/negentropy/src/negentropy/agents/definitions/registry.py) | 🔶 做（转义）/ 写（报错） |
| SK-M21 | 同名冲突：确定性优先级 + 告警（`G:81-87`，非规范） | `skills.name` 唯一约束；from-template 撞名自动加后缀；显式技能优先于全局技能的确定性合并 | [`models/skill.py:71`](../../apps/negentropy/src/negentropy/models/skill.py) · [`skills_api.py:317-322`](../../apps/negentropy/src/negentropy/interface/skills_api.py) · [`skills_injector.py:533-543`](../../apps/negentropy/src/negentropy/agents/skills_injector.py) | ✅ 已对齐（强于规范） |
| SK-M22 | 过滤：禁用 / 无权技能应整条隐藏（`G:220-228`） | 物化只写 `is_enabled` 行，但**禁用或删除后盘上旧目录不清理** | [`harness_materializer.py:88`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) · [`definitions_api.py:281-301`](../../apps/negentropy/src/negentropy/interface/definitions_api.py) | 🔶 做 |

**Skills 供应链（6 条）**：SK-A1 至 SK-A6 以 220 精读为上游材料；全部仓内行号为 `rg -n` 于 2026-09-28 在本 worktree 实测，非推测。

| # | 220 机制 | 本仓锚点（实测） | 判定 | 说明 |
| --- | --- | --- | --- | --- |
| SK-A1 | 注入层完整性/签名校验（220 §7） | `apps/negentropy/src/negentropy/agents/skills_injector.py:342`（`format_skills_block`）：全文 `rg "digest\|sha256\|hashlib\|signature\|verify_signature\|checksum"` **零命中**；正文经 Jinja2 沙箱渲染、渲染失败 fail-soft 返回原文 | ⏸ | description/模板注入零校验，与上游客户端同构（230 §6 基线）；信任判定完全依赖 DB 内部信任域 |
| SK-A2 | 物化外部资源时的传输校验（220 §3） | `apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py`：校验词与网络下载词（`requests./httpx/urlopen/urlretrieve/download`）**双零命中**；物化路径 DB（kind=harness_skill）→ `.agent/skills/<key>/SKILL.md`，fail-soft | ✅ | 无外部资源下载面=无传输完整性攻击面；这是「没接外部分发」的幸运而非「验了」的设计——接入外部源之日即 SK-A1 同款缺口 |
| SK-A3 | 版本/校验存储位（220 §5） | `apps/negentropy/src/negentropy/db/migrations/versions/0095_create_definitions_registry.py:59-60`：`version String(50) nullable` / `checksum String(64) nullable` 两列齐备 | 🔶 | 槽位在（比上游 SKILL.md 六字段更进一步）；语义用没用看 SK-A4/SK-A5 |
| SK-A4 | semver 槽位闲置（220 §5「编号牌」） | `apps/negentropy/src/negentropy/db/migrations/versions/0098_seed_harness_skill_definitions.py:889`（`checksum = hashlib.sha256(source.encode()).hexdigest()`）、`:896`（`"version": None  # harness SKILL.md 无 version 字段`） | ⏸ | digest 有、semver 无——上游生态结构（220 §5）的仓内镜像；definitions SSOT 架构（见 MEMORY/0095-0099）继承上游同款留白 |
| SK-A5 | checksum 消费面=变更检测（220 §6「降维」） | `apps/negentropy/src/negentropy/agents/definitions/registry.py:42-44`（`compute_checksum` docstring：「物化器据此跳过未变行、前端据此判定 dirty」） | 🔶 | checksum 唯一用途=变更检测，非来源证明；同域自算自存（DB 写 DB 读），与 SEP-2640「Hosts MUST NOT treat a digest match as a security boundary」同款边界 |
| SK-A6 | seed 幂等 vs 活文档静默变脑（220 §5 双门） | `0098_seed_harness_skill_definitions.py:871`（`ON CONFLICT (kind, key) DO NOTHING`，文件头注释「可重入；已存在则跳过」）；升级先例=0094 显式 reseed | ✅ | 首次落库即钉死，重跑 migration 不覆盖——无上游「computed version 双门失效」面；内容升级走新 migration 显式重种（0094 先例），可审计、可回溯 alembic 版本 |

### SK 逐条说明

**SK-M1 三级渐进披露（✅）。** 规范要求 Layer 1 目录常驻、Layer 2 模板按需、Layer 3 资源懒载。本仓对应：`agents/skills_injector.py:342`（format_skills_block）注入 Layer 1 目录，`agents/tools/skill_registry.py:120`（expand_skill）承接 Layer 2 模板展开，`agents/tools/__init__.py:14`（skill_resources）承接 Layer 3 资源。

**SK-M2 目录空集省略（✅）。** client guide Step 3 要求无技能时省略目录块（omit, don't show empty）。本仓空列表直接输出空字符串（`agents/skills_injector.py:347-348`）；对照 skills-ref，`skills_ref/prompt.py:32` 在空集时仍输出空 `<available_skills>` 块，与自家指南相悖，本仓行为优于参考实现。

**SK-M3 expand_skill 悬空（🔶 做）。** 复核成立，严重度降级：R6-b 已重设计为离线门优先（SK-M4），悬空不再阻塞技能晋升，只剩「目录承诺的能力不可用」与文档漂移两层。材料怎么做：模型自主激活有 file-read 与专用工具两条实现路径，前提是目录承诺的调用路径真实存在；client guide Step 4 还要求目录旁写简短行为说明、专用激活工具的 name 参数做枚举约束、无技能时不注册工具也不出空目录。本仓现状（全链核验）：`agents/skills_injector.py:357` 在每个注入目录末行写死「To use a skill, call expand_skill(name) to retrieve its full template.」；`expand_skill` / `list_available_skills` / `fetch_skill_resource` 只在 `agents/tools/__init__.py:28-29` 导出，不在 TOOL_REGISTRY 符号表（`agents/tools/registry.py:64-92`；其中 `:66,91` 附近仅 log_activity + preload_memory_tool，`:105` 为注册表构建行）；六翼 `NegentropyToolset` 先按白名单过滤（`agents/_dynamic_tools.py:121`），再经 `TOOL_REGISTRY.get()` 解析（`registry.py:129`），即使 DB `agents.tools` 写上名字也解析不到；根 Agent 实挂 `tools=[log_activity, preload_memory_tool]`（`agents/agent.py:248`）；`git log -S "expand_skill"` 在 faculties / agent.py / registry.py / `_dynamic_tools.py` 零命中，历史上从未绑定（问题登记：[ISSUE-194](../.agents/issue.md)，2026-09-23 登记，至今未修）。后果：目录是只能看、不能用的菜单，模型照指示调用会撞上不存在的工具；指南防的是「有工具无技能」，本仓是「有技能无工具」。建议（二选一，须显式决策）：(a) 兑现契约，把三件工具纳入 TOOL_REGISTRY，挂载到消费 Layer 1 的 Agent，`name` 参数按当前 owner 可见技能做枚举约束（无技能时既不出目录也不注册工具），并在 `_dynamic_tools.py` 白名单同步；或 (b) 收回承诺，删掉 Layer 1 末行指令，把目录降级为信息性，并在 [141 号笔记](./self-evolution/141-skills-evolution-and-si-measurement.md)与设计文档注明 R6-b 在线门不可用。时机：下一个触碰 `skills_injector` 或 agent tools 的 PR；也可在「模型驱动激活」路线重启时一并做。落地 (a) 前须补一条集成测试，断言「目录里出现的激活工具名 ∈ 该 Agent 实际挂载的工具名」，把契约固化成机器门禁。

**SK-M4 R6-b 在线门离线优先（✅）。** R6-b 在线门依赖 `expand_skill` 真实调用样本（该二阶影响见 SK-M3）：以窗口内 `expand_skill` 真实调用为样本（`engine/evolution/handlers/skill.py:428-480`，遥测打点见 `engine/observability/tool_telemetry.py:161`），样本不足 `SKILL_RUNTIME_CANARY_MIN_SAMPLES = 10` 时返回 hold（`engine/evolution/decision.py:282`、`:444-445`）。已重设计：离线 eval-suite holdout 门优先；在线门仅在 `expand_skill` 有数据时叠加，无数据返回 None 交离线门（`engine/evolution/handlers/skill.py:11`「离线 held-out 优于噪声在线 canary」、`:353`、`:428-433` 候选桶无数据即跳过在线门）。在线门当前是待激活死代码，SK-M3 修复后自动复活。

**SK-M5 目录注入面（🔶 做）。** 材料怎么做：客户端指南把「目录构建转义」列为客户端责任，规范对 description 内容零约束；官方 demo `skills-ref/src/skills_ref/prompt.py` 对 name/description 做 `html.escape`；230 §10 的 lab4·X3 实验证明目录块不转义时 description 可伪造出新技能，lab2·X4 补充证明按行切分的朴素解析器还会把 description 通道的 `allowed-tools: Bash(rm:*)` 伪字段混进元数据（真实 YAML 解析器直接抛 `ScannerError`，见 230 §8）；一代精读对同型推演（location 顺序致伪造条目继承真实路径，见 230 §8 分歧 4）也未在本仓实测。本仓现状：`format_skills_block` 把 name/description 原样拼进 `- {name}: {desc}` 行，无转义、无换行拦截，一条带换行的 description 可在目录里伪造第二行指令（`agents/skills_injector.py:353-355`）；`html.escape` 不处理换行，XML 转义对列表格式无效。差异：仓内现有技能全部来自 DB 种子（受控），但写入通道本身开放，用户可经 `skills_api` 创建自有技能，`is_global` 技能会进入所有 Agent（`agents/skills_injector.py:466-500` 的 `resolve_global_skills` 不按 Agent 过滤），注入面当下即可被触达，并不以「未来开放用户/项目级技能源」为前提；definitions 链路的创建与更新有 `require_admin` 门（`interface/definitions_api.py:188`），受控的是这一条链路。建议：做：在 `format_skills_block` 加行级清洗（换行折叠为空格 + 控制字符过滤），成本一行，防 lab4·X3 / lab2·X4 型注入；写入侧同时拒绝或折叠 description 中的换行与控制字符（与 SK-M15 同一校验器），注入侧再做一次空白规范化作纵深防御；若 SK-M3 走方案 (a)，枚举约束会让幽灵条目无法被调用，但语义诱导仍在。绑时机：注入侧清洗与 SK-M3 同一 PR（都在 skills 触发层）；写入侧校验随 SK-M14 / SK-M15 的写入链路 PR。

**SK-M6 宽容加载 fail-soft（✅）。** client guide 口径是 warn & load（deliberately relaxes）。本仓 `enforcement_mode="warning"` 为默认；任何异常记录警告并跳过该条，不冒泡（`agents/skills_injector.py:93`、`:117-118`）。

**SK-M7 多作用域遮蔽（⏸）。** client guide Step 1 要求多作用域遮蔽配 shadowed 告警。本仓 DB-first 单源解析（skills 表 / definitions 表），无盘上多作用域扫描，遮蔽场景结构性不存在（`db/migrations/versions/0098_seed_harness_skill_definitions.py:888`：DB 即唯一作用域）。触发条件：引入盘上技能源或多租户技能库时，须实现 project>user 加告警。

**SK-M8 allowed-tools 双语法（🔶 写）。** 规范面：SKILL.md frontmatter 要求空格分隔（实验性），语义为「预授权」；真实 skills-ref 实测不校验该字段，逗号分隔照样 Valid。本仓现状：CC CLI 调用层（`engine/claude_code/service.py:1025`）按 Claude Code CLI 自身约定逗号 join，两层各自正确，但盘上物化的 frontmatter 必须按规范空格写（`agents/definitions/harness_materializer.py:53` 只透传不校验，把它存进 metadata，运行时不消费）。盘上 10/11 用逗号分隔，值里混着 MCP server 名（`filesystem`、`zai-mcp-server`）与不同 harness 的工具名；DB 技能 frontmatter 亦有逗号分隔写法的审计记录（10/11），盘上 `.agent/skills` 复核经 230 §10 lab2 `--audit-repo` 实测全 OK（该口径指规范字段校验通过，校验器不检查 allowed-tools 分隔符，与逗号写法并存），DB 存量无法离库复核，按复核结论标注。语义分辨：运行时 `required_tools` + `enforcement_mode`（`models/skill.py:42`）是「缺工具则降级」的先决条件检查，与「预授权」不是同一语义，而设计文档 §2 对照表把两者并列为「工具白名单 ✓」。建议：写：在已登记的 SK-M14（name）/ SK-M15（description）/ SK-M8（allowed-tools）校验断言里补「allowed-tools 空格分隔」一条，一句话成本，触发即写；设计文档把 `required_tools`（先决条件）与 `allowed-tools`（预授权）分开表述；盘上技能改为空格分隔（改 DB 定义源），成本为一次文档改动加 11 条定义的格式化，不涉及运行时行为。

**SK-M9 压缩豁免（⏸）。** client guide Step 5 要求技能内容豁免上下文压缩。本仓交互式对话零压缩（HM-M11 已核：`num_recent_events` 零调用方、`EventsCompactionConfig` 未启用），无压缩器即无豁免需求。触发条件：引入上下文压缩 / 摘要层时必须同步实现豁免标记，否则技能静默降级。

**SK-M10 disable-model-invocation（⏸）。** 生态扩展字段 disable-model-invocation / 用户显式点名在本仓无对应开关，Layer 1 目录恒注入（`agents/skills_injector.py:342` 无开关参数）。YAGNI：单 owner 场景无确定性触发诉求。

**SK-M11 描述/技能质量 eval 驱动（✅）。** 规范侧做法是 optimizing-descriptions / evaluating-skills。本仓以技能进化承接：离线 EvalSuite holdout 零回归门 + visible_results_query 结构性排除 holdout（防 Goodhart）+ 无绑定 EvalSuite 即 reject（`engine/evolution/handlers/skill.py:7-15`、`:351`）。形态不同、机理同构：离线验证优于在线噪声，与指南「trigger rate 协议」同一纪律。

**SK-M12 metadata 正门（✅）。** 规范把 SKILL.md §metadata 定为私货唯一正门。本仓由 definitions 表 schema 专列承载（content / typing 等），私货不走 SKILL.md metadata 字段（`db/migrations/versions/0098_seed_harness_skill_definitions.py:888` 仅提取三键、`agents/definitions/harness_materializer.py:53`）；DB schema 即正门，强于规范层的弱约定。

**SK-M13 技能载体（✅）。** 规范口径：一个技能是一个目录，至少含 `SKILL.md`（YAML 头 + Markdown 正文）。本仓与规范相关的载体有三套：运行时 `skills` 表（DB-first，存 Jinja2 `prompt_template` 与 JSONB typed `resources`，由 `skills_injector` 做三层披露）、Definition Registry `harness_skill`（DB 为 SSOT，`harness_materializer` 渲染出 `.agent/skills/<key>/SKILL.md`）、翻译 workdir 物化（写出 `.claude/skills/document-translate/SKILL.md` 供 Claude Code 子进程使用）；规范只描述其中盘上一种形态。盘上 11 个 `SKILL.md` 由 materializer 从 `definitions(kind=harness_skill)` 渲染、按内容幂等写盘；运行时 Agent 读的是 `skills` 表，`prompt_template` 是 Jinja2 模板而非 Markdown 正文；[Skills 设计 §4](../concepts/design/skills.md) 明确选择「DB-first，非 file-first」，理由是在线协作与 RBAC。差异：本仓把规范格式当导出格式而非运行时格式，规范只管「包里装什么」，本不强制运行时形态，属合理产品取舍。建议：维持，唯一要守住的是导出物本身合规，由 SK-M19 兜底。

**SK-M14 name 约束（🔶 做）。** 规范给出五条约束（`S:58-65`）；原型 B2 实测拔掉「等于目录名」后，身份由扫描顺序决定。本仓现状：盘上 11/11 合规，`--audit-repo` 与真实 skills-ref 均通过（0098 种子令 `key = frontmatter name`）；但写入链路全程不校验格式：harness 校验器只查非空（[`harness_materializer.py:41-47`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py)）、`SkillCreate.name: str` 无约束（[`skills_api.py:43`](../../apps/negentropy/src/negentropy/interface/skills_api.py)）、DB 列是 `String(255)`、UI 的 Name 输入框只有 `required`（[`SkillFormDrawer.tsx:313-321`](../../apps/negentropy-ui/app/interface/skills/_components/SkillFormDrawer.tsx)）。materializer 按 definitions 的 key 建目录而 name 来自 frontmatter，种子之后的编辑可使两者漂移，一旦漂移盘上就出现「目录名 ≠ name」，即原型 B2 的前提；规范的命名约束在本仓只是种子时碰巧满足，没有被强制执行。建议：在 `harness_skill` 校验器补规范五条并加 `key == name` 断言；`skills_api` 的 name 用同一正则约束（`^[a-z0-9]+(-[a-z0-9]+)*$`，≤64）；UI 加 `pattern` 与 `maxLength`。时机：下一次触碰 skills / definitions 写入链路的 PR；已有数据先只读审计再决定是否迁移，禁止直接改名（改名会断开 Agent 的 skill 引用）。

**SK-M15 description 约束与写法（🔶 做）。** 规范要求 1–1024 字符、写「做什么 + 何时用」；原型 B3 实测一条 12,159 字符的描述让目录常驻成本 +255%。本仓现状：盘上 3/11（doc-review / doc-translator / heartfelt）缺「何时用」子句，属 230 §6 所说的「合规却难触发」；运行时 `skills.description` 是无上限 `Text`（[`models/skill.py:29`](../../apps/negentropy/src/negentropy/models/skill.py)），`format_skills_block` 原样全量注入（[`skills_injector.py:353-355`](../../apps/negentropy/src/negentropy/agents/skills_injector.py)）；`is_global` 技能被注入每一个 Agent（[`skills_injector.py:486-530`](../../apps/negentropy/src/negentropy/agents/skills_injector.py)），任何一条全局技能描述膨胀都会乘以 Agent 数量。建议：写入侧加 1024 上限，与 SK-M5 同一批校验器落地；3 个缺「何时用」的技能补子句，改 DB 定义源、走 definitions 编辑，不直接改盘上文件。时机：与 SK-M14 同 PR。

**SK-M16 Tier 2 结构化包裹与显式注入（✅）。** 指南要求专用激活工具以标签包裹技能内容、便于压缩时识别（`G:274-302`），用户或 harness 可绕过模型直接注入（`G:258-262`）。本仓现状：`format_skill_invocation` 用 Jinja2 沙箱 + `StrictUndefined` 渲染并包进 `<skill name=…>`（[`skills_injector.py:361-384`](../../apps/negentropy/src/negentropy/agents/skills_injector.py)）；三条显式注入路径真实可达：REST `POST /skills/{id}/invoke`（[`skills_api.py:825`](../../apps/negentropy/src/negentropy/interface/skills_api.py)）、调度器（[`skill_scheduler.py:94`](../../apps/negentropy/src/negentropy/agents/skill_scheduler.py)）、翻译服务（[`translation/service.py:344-355`](../../apps/negentropy/src/negentropy/knowledge/translation/service.py)）。差异：翻译路径在任务消息里嵌入完整模板，同时又往 workdir 物化同一技能（`service.py:202`），Claude Code 子进程若再自行激活，同一份指令会进上下文两次；指南建议去重（`G:327-329`），但 docstring 已声明物化是 fail-soft 的冗余兜底，风险低。建议：维持；如观察到重复注入的 token 成本，再在子进程侧去重。

**SK-M17 Tier 3 资源（⏸ 暂缓）。** 规范的资源是技能目录里的文件，被正文引用时按相对路径读取（`S:187-237`）。本仓现状：资源是 JSONB typed 引用（kg_node / memory / corpus / url / inline），由 `fetch_skill_resource(skill_name, index)` 路由到 KG / Memory / Knowledge corpus（[`skill_resources.py:46-125`](../../apps/negentropy/src/negentropy/agents/tools/skill_resources.py)）；该工具同样未挂载（见 SK-M3）。差异：两者语义正交，规范的资源是「包内附件」，本仓的资源是「指向平台数据的指针」；[设计 §4](../concepts/design/skills.md) 已因文件 IO 与沙箱复杂度明确不引入资源目录。建议：暂缓同构。触发条件：[设计 §3.4](../concepts/design/skills.md) 的「SKILL.md 双向同步」立项，或出现需要随技能分发可执行脚本的真实用例；届时按 `G:304-312` 做「只列清单不预读 + 技能目录读权限白名单」。

**SK-M18 发现路径（🔶 写 / ⏸ 迁移）。** 规范不规定技能放在哪里；指南推荐同时扫描 `.agents/skills/`（跨客户端约定）与客户端原生目录，部分实现为兼容也扫 `.claude/skills/`（`G:45-58`）。本仓现状：materializer 头注释称 `.agent/skills/*/SKILL.md`「供 Claude Code harness 文件 glob 发现」（[`harness_materializer.py:4`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py)）；但 Claude Code 原生扫描的是 `.claude/skills/`，本机主仓 `.claude/` 下也没有指向 `.agent/skills` 的链接（`.claude/` 已被 gitignore）；`.agent/skills`（单数）实际是 Google Antigravity 的旧工作区路径，Antigravity 现默认 `.agents/skills`，对单数仅保持向后兼容（[Antigravity Docs](https://antigravity.google/docs/skills)）。建议：写：校正头注释，如实说明当前路径被哪些客户端发现；暂缓：迁移到 `.agents/skills/`，触发条件是确有第二个客户端需要读取本仓技能（例如团队在仓库内直接用 Claude Code / Codex 消费这些技能），届时迁移并按需为 `.claude/skills` 建链接。

**SK-M19 校验门（🔶 做）。** 规范提供 `skills-ref validate` 检查 frontmatter 与命名约定（`S:239-247`）。本仓现状：盘上技能没有任何 CI、pre-commit 或单测校验，当前 11/11 合规是「种子时碰巧满足」；[`test_harness_materializer.py`](../../apps/negentropy/tests/unit_tests/agents/definitions/test_harness_materializer.py) 的探针键 `_test_materialize_probe` 以下划线开头、含下划线，本身就违反命名规则，它只用于测幂等、不影响生产，但说明规则从未进入开发者视野。建议：做：在 `apps/negentropy/tests/unit_tests/` 加一条纯文件单测，遍历 `.agent/skills/*/SKILL.md` 断言规范规则（规则集可直接照搬原型 [`validate()`](./agent-infra/assets/agent_skills_lab.py#L105)）；不引入 skills-ref 依赖，它自称 demo 且已与规范漂移。成本约 40 行，随 SK-M14 同 PR。

**SK-M20 解析与生成健壮性（🔶 做 / 写）。** 指南指出未加引号的值里出现冒号是最常见的 malformed YAML（`G:117-126`）。本仓现状，生成侧：翻译物化以 `f"---\nname: {SKILL_NAME}\ndescription: {description}\n---"` 写盘（[`translation/service.py:376-378`](../../apps/negentropy/src/negentropy/knowledge/translation/service.py)），description 只去了换行、未加引号，只要 DB 中的描述出现「冒号 + 空格」，生成的 `SKILL.md` 就是非法 YAML；当前盘上同名技能的描述不含 ASCII 冒号（审计核对），但 DB 行不受这个约束；该路径 fail-soft，损坏的只是 Claude Code 子进程侧的技能发现。解析侧：`definitions/registry.py` 的 `parse_frontmatter` 遇 YAML 错误返回 `({}, text)`（[`registry.py:47-77`](../../apps/negentropy/src/negentropy/agents/definitions/registry.py)），上层只报通用的「缺少合法 YAML frontmatter」（`registry.py:138`），丢失行列信息。建议：做：生成侧改用 `yaml.safe_dump` 生成 frontmatter，一行改动；写：解析侧把 YAML 错误详情透传进 422 响应，便于 UI 定位。

**SK-M21 同名冲突（✅ 强于规范）。** 格式层唯一的唯一性来自「目录名唯一」，跨作用域靠非规范的「项目级优先 + 告警」（`G:81-87`）。本仓现状：`skills.name` 有 DB 唯一约束（[`models/skill.py:71`](../../apps/negentropy/src/negentropy/models/skill.py)）；from-template 撞名时自动追加用户短 ID、再撞则加随机后缀（[`skills_api.py:317-322`](../../apps/negentropy/src/negentropy/interface/skills_api.py)）；显式技能与全局技能合并时「先出现者优先」（[`skills_injector.py:533-543`](../../apps/negentropy/src/negentropy/agents/skills_injector.py)），规则确定、可复现。差异：全局唯一约束比规范的「单父目录唯一」更强，原型 B2 的扫描顺序问题在运行时路径上不存在。建议：维持。

**SK-M22 过滤与清盘（🔶 做）。** 指南要求禁用或无权的技能「Hide filtered skills entirely」（`G:228`）。本仓现状：materializer 只取 `is_enabled` 行写盘（[`harness_materializer.py:88`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py)）；但禁用或删除定义后（[`definitions_api.py:281-301`](../../apps/negentropy/src/negentropy/interface/definitions_api.py)），盘上旧的 `<key>/SKILL.md` 不会被删除，读取该目录的客户端仍能发现已下线的技能。建议：做：materializer 增加「清扫」，对比 DB 已启用的 key 集合与盘上目录，删除由物化器生成、且已不在集合内的目录；须用生成标记（如 frontmatter 中的 metadata 键）区分手写目录，严禁盲删。时机：下一次改动 materializer 时。

**SK-A1 注入层完整性/签名校验（⏸）。** 220 §7 机制。本仓 `format_skills_block`（`apps/negentropy/src/negentropy/agents/skills_injector.py:342`）全文 `rg "digest\|sha256\|hashlib\|signature\|verify_signature\|checksum"` 零命中；正文经 Jinja2 沙箱渲染、渲染失败 fail-soft 返回原文。description / 模板注入零校验，与上游客户端同构（230 §6 基线），信任判定完全依赖 DB 内部信任域。触发条件：未来接入外部 skill 分发（如 `.well-known` / MCP `skills/list`）时，本条与 SK-A4 两条 ⏸ 即刻转为真实缺口。

**SK-A2 物化外部资源传输校验（✅）。** 220 §3 机制。`harness_materializer.py` 校验词与网络下载词（`requests.` / `httpx` / `urlopen` / `urlretrieve` / `download`）双零命中；物化路径 DB（kind=harness_skill）→ `.agent/skills/<key>/SKILL.md`，fail-soft。无外部资源下载面等于无传输完整性攻击面；这是「没接外部分发」的幸运而非「验了」的设计，接入外部源之日即 SK-A1 同款缺口。

**SK-A3 版本/校验存储位（🔶）。** 220 §5。definitions 表（0095）`version String(50) nullable` 与 `checksum String(64) nullable` 两列齐备（`apps/negentropy/src/negentropy/db/migrations/versions/0095_create_definitions_registry.py:59-60`）；槽位在，比上游 SKILL.md 六字段更进一步，语义是否用上看 SK-A4 / SK-A5。

**SK-A4 semver 槽位闲置（⏸）。** 220 §5「编号牌」。`0098_seed_harness_skill_definitions.py:889` 写 `checksum = hashlib.sha256(source.encode()).hexdigest()`，`:896` 写 `"version": None  # harness SKILL.md 无 version 字段`。digest 有、semver 无，是上游生态结构（220 §5）的仓内镜像；「版本被降维成变更检测」这一上游规律（220 §5/§6）在本仓 DB schema 层有精确对应，definitions SSOT 架构（见 MEMORY/0095-0099）继承上游同款留白。

**SK-A5 checksum 消费面（🔶）。** 220 §6「降维」。`registry.py:42-44` 的 `compute_checksum` docstring：物化器据此跳过未变行、前端据此判定 dirty。checksum 唯一用途是变更检测而非来源证明；同域自算自存（DB 写 DB 读），与 SEP-2640「Hosts MUST NOT treat a digest match as a security boundary」同款边界：匹配只证明一致，不证明可信。

**SK-A6 seed 幂等（✅）。** 220 §5 双门。`0098_seed_harness_skill_definitions.py:871` 用 `ON CONFLICT (kind, key) DO NOTHING`（文件头注释「可重入；已存在则跳过」），升级先例是 0094 显式 reseed。首次落库即钉死，重跑 migration 不覆盖，无上游「computed version 双门失效」面；内容升级走新 migration 显式重种，可审计、可回溯 alembic 版本。

### SK 落地建议

**做（绑定时机）。**

- SK-M3 + SK-M5（注入侧）同一 PR：`expand_skill` 挂载 TOOL_REGISTRY + `format_skills_block` 行级清洗，`_dynamic_tools.py` 白名单同步。SK-M3 先做 (a)/(b) 二选一决策（(a) 兑现契约并挂载，(b) 收回承诺并删末行指令），并补「目录声明激活工具 ∈ 实际挂载工具」集成测试。时机：下一个触碰 `skills_injector` / agent tools 的 PR；SK-M3 落 (a) 后 SK-M4 的在线门自动复活。
- SK-M14 + SK-M15 + SK-M5（写入侧）+ SK-M19 同一 PR：name 正则 + ≤64 + `key == name`；description ≤1024 并拒绝换行与控制字符；UI 表单加 `pattern` / `maxLength`；`.agent/skills` 合规单测（不引入 skills-ref 依赖）。时机：下一次触碰 skills / definitions 写入链路；存量数据先只读审计再决定是否迁移，禁止直接改名。
- SK-M20：翻译物化 YAML 改用 `yaml.safe_dump` 生成 frontmatter，一行改动，随手可做。
- SK-M22：materializer 清扫，对比 DB 已启用 key 集合与盘上目录，删除由物化器生成、且已不在集合内的目录；须用生成标记区分手写目录，严禁盲删。时机：下一次改动 materializer。

**写（一句话成本）。**

- SK-M8：在 SK-M14（name）/ SK-M15（description）/ SK-M8（allowed-tools）校验断言里补「allowed-tools 空格分隔」；设计文档把 `required_tools`（先决条件）与 `allowed-tools`（预授权）分开表述；盘上 11 条定义改空格分隔。
- SK-M18：校正 `harness_materializer.py:4` 头注释，一行。
- SK-M20：解析错误详情透传 422，小改动。
- SK-M15：给 3 个缺「何时用」的技能补子句，改 3 条 DB 定义。
- 「SK 文档漂移」清单所列「模型驱动激活已实现」表述，随 SK-M3 修复一并订正。

**暂缓（YAGNI，写明触发条件）。**

- SK-M7：引入盘上 / 多租户技能源时，实现 project>user + shadowed 告警。
- SK-M9：引入上下文压缩 / 摘要层时，实现技能内容豁免标记。
- SK-M10：出现确定性触发诉求时，加 disable-model-invocation 开关。
- SK-M17：「SKILL.md 双向同步」立项，或出现随技能分发可执行脚本的真实用例；届时按「只列清单不预读 + 技能目录读权限白名单」实现。
- SK-M18（迁移档）：确有第二个客户端需要读取本仓技能时，迁移到 `.agents/skills/` 并按需为 `.claude/skills` 建链接。
- SK-A1 / SK-A4：接入外部 skill 分发（如 `.well-known` / MCP `skills/list`）时，两条 ⏸ 即转为真实缺口，需补注入校验与版本语义。

### SK 文档漂移

以下文档把「模型驱动的 Layer 2/3 激活」写成已实现，与 SK-M3 的核验事实矛盾：

- [Skills 设计](../concepts/design/skills.md) §2 对照表「模板按需（Layer 2）」「资源文件挂载（Layer 3）」两行与 §3.2 首条（已加校正指针）；
- [skills-advanced.md](../concepts/user-guide/skills-advanced.md) 与 [skills-paper-hunter.md](../concepts/user-guide/skills-paper-hunter.md) 中「LLM 自主调用 `expand_skill`」的流程描述；
- [172 规划与协调](./agent-harness/172-claude-code-planning-coordination.md)：换代重写后的现行版不含「技能两层加载」表述（§11 现为「适用边界」），091 时代在该文所加的 ISSUE-194 校正指针已不在现行文本中，SK-M3 选方案 (a) 时须评估是否需要补教学性说明；
- HZ-9 与 [013 Context Layer 蓝图](./cognitive-context/013-context-layer-blueprint.md) 状态表（重铸版 §11.5 #9 行已校正口径：L1 ✅ / L2·L3 🔶 ISSUE-194，2026-09-27）。

SK-M3 落地方案 (a) 后，这些表述将自动重新成立；选 (b) 则须同步改写。为避免与 SK-M3 决策打架，校正指针只落在设计 SSOT 一处，其余登记于 [ISSUE-194](../.agents/issue.md) 统一处理。

## Agent 基础设施：Jev

> 核验基线：Jev | 本仓 HEAD `95f5a532e` | 2026-09-26 | 无外部钉点
>
> 声明：只分析不改码；锚点均经实际代码核验。锚点路径仓库相对 `apps/negentropy/src/negentropy/`，写法 `文件:行号`。

Jev 对本仓的真增量不在接入更便宜的判断模型，而在四条可直接落地的纪律：解析失败应显式弃权而非注入默认合法值（proposer 的 `None` 弃权与 evaluator 的静默 0 分是本仓内部现成对照），矫正与兜底要有 counter（两个 judge 解析器矫正时一行日志都没有），缺 confidence 的默认值方向反了（默认 1.0 叠加 0.5 阈值等于自动通过），口头 confidence 不可比（启发式常数置信与 LLM 口头置信同列存储、同样被消费，量纲不同）。本仓已实现的是编排级的快慢分工（四阶段检索级联、失败降级链）、确定性决策守卫对 LLM 读数的封顶与旁路开关，以及 evolution proposer 一处孤例式的弃权解析。16 条映射中 5 条 ✅ 已对齐、9 条 🔶 值得落地（多数是「写」级一句话成本或绑明确时机的 counter）、2 条 ⏸ 暂缓。接入 Jev 本体一类建议一律暂缓：官方对中文可用性零量化，且本仓尚无任何校准验证数据可支撑阈值搬家。

### JV 映射总表

| # | 材料机制（出处） | 本仓对应 | 锚点 | 判定 |
|---|---|---|---|---|
| JV-1 | M1 三原语把答案空间钉死在 criteria 内（§M1，规律 1） | 13 处 LLM 调用全部「prompt 散文枚举 + `response_format=json_object`」，零严格 schema | engine/routine/evaluator.py:514、knowledge/graph/extractors.py:885 等 13 处 | 🔶 |
| JV-2 | M1 弃权语义：解析失败 ≠ 默认合法值 | proposer 解析失败/越界失控/`no_change` → `None` 弃权 + warn（「宁可不提不乱提」） | engine/evolution/proposer.py:9,218-257 | ✅ |
| JV-3 | M1 越界事后矫正须可观测 | judge 族解析矫正全静默：垃圾 JSON → score=0 + verdict 兜底，零日志零计数；FacultyBridge 非空文本直接当命中 | engine/routine/evaluator.py:508-563、engine/routine/plan_reviewer.py:195-206,238-255 | 🔶 |
| JV-4 | M1 选择题只认选项原文 | `_auto_answer_question` 非 JSON 时**原样返回 content 作答案**，自由文本冒充闭合选项 | engine/claude_code/service.py:1192,1199,1248 | 🔶 |
| JV-5 | M1 枚举层闭合的兜底姿势 | KG 严格 `json.loads` 失败 → warn + `[]`（chunk 静默零实体）vs entity_normalization 的 raise → 重试 → degraded 标记 | knowledge/graph/extractors.py:929-932、engine/consolidation/pipeline/steps/entity_normalization_step.py:71-77,131-140 | 🔶 |
| JV-6 | M2 共享一次读、多问一次调用 | evaluator 单合并 prompt 同答 4-5 问（acceptance/score/verdict/reflection），锚定规则显式声明 | engine/routine/evaluator.py:58-88,121-127 | ✅ |
| JV-7 | M2 题与题隔离、互不可见 | plan_reviewer N 个模块评审 + 总评 + 分数一次调用，模块间互相污染 | engine/routine/plan_reviewer.py:96-109 | 🔶 |
| JV-8 | M2 共享前缀把多问变便宜（12.2×） | map-reduce 每社区独立调用；全仓无 `cache_control`/prompt caching（仅进化 prompt 文本 TTL） | knowledge/graph/global_search.py:183-209、engine/evolution/weights.py:88-104 | ⏸ |
| JV-9 | M3 概率可对账、confidence 是派生读数 | KG 抽取 confidence 缺省 **1.0 且不 clamp**，下游 `metadata.get("confidence", 1.0) >= 0.5` 过滤 → 缺失自动通过 | knowledge/graph/extractors.py:972、knowledge/graph/service.py:725-726、knowledge/types.py:784 | 🔶 |
| JV-10 | M3 读数只是统计，量纲须可比 | LLM 口头置信（fact 0.7 缺省 / KG 1.0 缺省）与启发式常数置信（0.3-0.85）同列存储、被 avg 与门控同样消费 | engine/consolidation/llm_fact_extractor.py:249-252、engine/utils/query_intent.py:54-95、knowledge/graph/quality.py:157-163 | 🔶 |
| JV-11 | M3 阈值是校准曲线上的索引 | 量纲错配已文档化并以 `accept_verdict_pass` 缓解；引擎侧对 judge 输出做确定性封顶 | engine/routine/decision.py:118-123,148、engine/routine/evaluator.py:287-297、models/routine.py:110 | ✅ |
| JV-12 | M4 收益在编排不在模型 | 检索级联 cheap-first：混合检索 → 图扩展 → RRF → cross-encoder 重排；rerank 失败降级原序 | agents/tools/hybrid_planner.py:1-8,766、knowledge/retrieval/reranking.py:32-34,158-163,290 | ✅ |
| JV-13 | M4 按任务选判断模型 | 按任务静态选模型档（「高风险用更强模型」），非运行时置信分流；3 个在用 task key 未注册、静默落全局默认 | config/routine.py:137-140,185-188,209-212、engine/claude_code/service.py:1053、config/model_resolver.py:37,1097 | 🔶 |
| JV-14 | M4 廉价先行、昂贵兜底 | FacultyBridge **贵先**：全 ADK agent 优先、失败降级 litellm 直连，仅 contextvar 预算封顶 | engine/routine/faculty_bridge.py:59-78、engine/routine/evaluator.py:486-498 | ⏸ |
| JV-15 | M4 门槛随风险伸缩 | HITL 静态 `HIGH_RISK_TOOLS` 列表 + plan review 轮次封顶后强制放行（fail-open 已注释文档化，下游 gate+judge 兜底） | agents/approval.py:46-61、engine/routine/plan_review_hook.py:154-170,196 | ✅ |
| JV-16 | M4 失败要有预算 | `eval_failure_patience=3` 只覆盖基础设施失败；垃圾输出（score=0）零预算且计入 eval 均值/通过率 | config/routine.py:85-88、engine/routine/orchestrator.py:845、engine/eval/runner.py:990-997 | 🔶 |

### JV 逐条说明

**JV-1 枚举只活在 prompt 散文里（🔶）**。 材料 M1 用 Choice/Score/Noul 三原语把答案空间钉死，规律 1 点破 JSON schema 只管格式不管枚举。本仓 13 处 LLM 调用（`grep` 实测计数，分布于 engine/knowledge 共 12 个文件）全部是「枚举写进 prompt 散文 + `response_format={"type":"json_object"}`」。也就是说，只有词法层约束、没有枚举层约束，也没有任何受约束解码。差异是结构性的；但材料自己也承认枚举层闭合需要专用判断模型，通用 LLM 场景下的替代品只有「解析纪律」。建议按「写」级落地：把这一既定姿势与新调用最低三件套（loads_lenient + 字段校验 + 矫正日志）写进一处权威注释。

**JV-2 proposer 是全仓唯一正确姿势的孤例（✅）**。 材料的弃权语义是「解析失败宁可不作答」；proposer 对非 dict、`no_change`、非法权重、越界失控四种失败一律 `return None` 并记 warn（proposer.py:222,226,234,245），模块头注明「宁可不提不乱提」。它还强制 `keyword = round(1.0 - semantic, 4)` 重算（:249），不信任模型的伴生输出。这是本仓离材料 M1 最近的一处。它的价值在于证明该姿势在本仓工程成本上完全可负担，问题只是没有推广。

**JV-3 judge 族矫正零观测（🔶）**。 材料 M1 承诺「答案不可能越界」的同时，要求越界之外的错可被看见；本仓正好相反。`evaluator._parse` 里 `data.get("score", 0)` 把缺失/垃圾 score 静默变 0（evaluator.py:548-552）。verdict 越界按分数兜底成 progressing/stalled（:558），整个 `_parse` 没有一行 logger（实测 `grep -c logger` 为 0）；plan_reviewer 同款（plan_reviewer.py:238-255，亦零日志）。重试环只看传输异常（:508-534），垃圾 JSON 不触发重试、变 score=0+stalled 直接落库。更隐蔽的是 FacultyBridge。faculty 返回非空但不可解析的文本，会被 `loads_lenient → {}` 洗成 score=0 并当命中返回、不回退 litellm（evaluator.py:486-498、plan_reviewer.py:195-206）。对照同文件 auto-answer 路径有键存在检查（claude_code/service.py:1218-1219）。差异核心：解析失败被伪装成「低分真实判断」。建议绑 evaluator/plan_reviewer 下次触碰时加矫正 counter 与一条 warn。

**JV-4 自由文本冒充选项答案（🔶）**。 材料 M1 的 Choice 要求答案只能是选项之一。`_auto_answer_question` 在 prompt 里两处强调「必须是选项之一的 label 原文」（claude_code/service.py:1192,1199），但解析失败时 `return content`（:1248）把模型原样输出直接回传给 CC 的 AskUserQuestion。约束只存在于 prompt，兜底路径恰好把约束击穿。仅传输异常才走 `_FALLBACK_ANSWER`（:1254,1255）。差异：闭合选项的失败语义应是「落回中性默认」而非「放行任意文本」。建议该模块下次触碰时把非 JSON 分支改走 fallback。

**JV-5 同一问题两种姿势并存（🔶）**。 KG 实体抽取用严格 `json.loads`，失败 warn 后 `return []`（extractors.py:929-932）。该 chunk 的静默零实体没有任何 counter，下游不可区分「无实体」与「解析失败」。而 entity_normalization_step 的注释直接点破：`loads_lenient` 返回 `{}` 会「把脏输出伪装成空实体成功」。因此它先校验 `entities` 键、失败 raise 触发重试、最终标 `degraded`（entity_normalization_step.py:131-140，degraded 标记 :71-77）。这说明本仓已在局部识别此问题并给出正解，只是两处姿势相反。建议以 entity_normalization 的「校验-重试-降级标记」为范本，KG 侧补一个 parse-failure counter。

**JV-6 合并 prompt 是共享读的正例（✅）**。 材料 M2 的「state 读一遍、多问合一」在本仓 evaluator 已是事实标准。一个 prompt 同答 acceptance_met/score/verdict/reflection（锚定版再加 progress_evidence），1 次调用（evaluator.py:58-88）。且锚定规则把「证据先于给分」「分数与轨迹相容」写成显式条款（:121-127），这与材料用 criteria 锚定答案空间的思路同构。这是本仓与材料在「便宜的多问」上成本结构最近的一条。

**JV-7 plan_reviewer 的互相污染（🔶）**。 材料用「题与题互不可见」换隔离；plan_reviewer 反其道，N 个模块评审 + 总 verdict + 分数一次调用（plan_reviewer.py:96-109），总评分数会被前面模块的措辞情绪污染，模块间也无隔离。差异：本仓只有「合并省钱」没有「隔离防污染」的另一半。建议「写」级：在该 prompt 处注明已知污染、模块结论以 status 而非总分定夺（现状已部分如此），暂不拆调用。

**JV-8 前缀缓存零利用（⏸）**。 材料 M2 的 12.2× 便宜一半来自「输入计一次、输出免费」的计费形状与共享前缀。本仓 `grep cache_control/prompt_cach/cached_tokens` 全仓零命中（仅进化 prompt 文本 TTL 缓存，weights.py:88-104，与推理侧缓存无关）。judge prompt 前缀（角色设定 + 评审要求）跨迭代高度稳定，是天然的缓存候选。暂缓理由：无 LLM 成本占比数据支撑优先级，且 litellm 跨 provider 的缓存开关行为不一。

**JV-9 置信缺省方向反了（🔶）**。 材料 M3 的 confidence 是分布形状的派生读数、缺省即低集中度。本仓 KG 链路是 `confidence=float(entity_data.get("confidence", 1.0))`（extractors.py:972，无 clamp 无范围检查）。下游过滤 `e.metadata.get("confidence", 1.0) >= min_conf`，且 `min_entity_confidence` 默认 0.5（service.py:725-726、types.py:784）。结果是字段缺失时自动以满置信通过门槛。同向例证还有 `acceptance_met` 非 bool → `None` → 不施加封顶（evaluator.py:563,287-297）：安全信号缺失时选择宽容。对照 fact extractor 缺省 0.7 至少落在中间。建议绑 KG 抽取链下次触碰时改缺省为显式低值或标记 missing。

**JV-10 两种量纲同库同列（🔶）**。 材料规律 3 强调「读数只是统计」，其前提是量纲统一。本仓同一 `confidence` 列里同时存在三种来源：LLM 口头置信（fact 0.7 缺省、KG 1.0 缺省）、正则兜底常数（strategy.py:199,217 的 0.5/0.6，0.5 恰在阈值上）与手定启发式常数（query_intent.py:54-95 的 0.3-0.7、action_intent.py:77-103 的 0.3-0.85）。消费端不分来源：quality.py:157-163 对全列做 avg 当语料质量指标，agent.py:31,99-103 用 0.7 门控翻转 ingest 路由。差异：材料的 confidence 有固定派生公式保证可比，本仓的常数们没有任何对账基准。建议「写」级：在字段语义处注明三种来源不可比，聚合须分组。

**JV-11 量纲错配的自觉（✅）**。 材料 M3 说阈值是校准曲线的索引。本仓 decision.py:118-123 把 `success_score_threshold=100` 与 judge「全部满足≈90-100」的结构性失配写成文档，并以 `accept_verdict_pass` 显式 opt-in 旁路（:148）；巡检任务阈值 99/100 正是这个错配的产物。引擎侧还有确定性封顶：`acceptance_met=False` 时 cap score 且 pass 纠正为 progressing（evaluator.py:287-297），即代码不信任 judge 的自洽性。这与材料「代码拥有控制流、模型只交读数」的分工一致。

**JV-12 编排收益已在（✅）**。 材料 M4/规律 5 的核心是「同一模型放进 workflow 更准更快更便宜」。本仓检索栈是教科书式 cheap-first 级联：意图正则 → 多路 hybrid → 图扩展 → RRF 融合 → cross-encoder 重排（hybrid_planner.py:1-8）。reranker 推理失败回退原序（reranking.py:158-163），CompositeReranker 按 Cohere → 本地 BGE → Noop 降级（:290）。升级靠流水线位置而非分数门控，且 `score_threshold=0.0`（reranking.py:32-34、hybrid_planner.py:766）使重排退化为纯排序。这与材料的置信门控不同，但在「廉价先行」的骨架上已经对齐（threshold 语义另记一笔即可）。

**JV-13 静态模型档与幽灵 task key（🔶）**。 材料 M4 按风险分档用模型；本仓以静态配置实现同一目标（evaluator/plan_review/auto_answer 三档，config/routine.py:137-140,185-188,209-212，evaluator.py:152-153 注明高风险用更强模型的动机），这是合理近似。缺口在治理：`routine.auto_answer`（service.py:1053）、`routine.memory_extract`（memory_extractor.py:37）、`eval.execute`（runner.py:172,217）在用但未注册进 `ALL_TASKS`（task_registry.py:58-178）。`is_valid_task_key` 仅在 API 写入时执法（interface/task_models_api.py:150,198,317），resolver 静默落全局默认 `openai/gpt-5-nano`（model_resolver.py:37），唯一信号是 `task_model_resolved` 日志的 "default" 标签（:1097）。运行时置信分流则暂缓（见 JV-14 与 JV 落地建议）。建议绑 task_registry 下次加槽时补注册或前移校验。

**JV-14 贵先的反向级联（⏸）**。 材料的级联是便宜模型先行、按读数升级。FacultyBridge 是全 ADK agent（贵）先行、失败降级 litellm 直连，成本失控仅靠 contextvar 预算封顶（faculty_bridge.py:59-78）。方向相反但动机明确：bridge 买的是 faculty 的内化质量而非省钱，且失败路径有日志。暂缓理由：仓内没有 faculty vs 直连的输出质量/成本 A/B 数据，「贵先是否反模式」无法裁决。

**JV-15 风险分级的工程近似（✅）**。 材料 M4 让门槛随风险伸缩。本仓 HITL 用静态 `HIGH_RISK_TOOLS` 按副作用类别分级（写库/执行/外发，approval.py:46-61），加 allow/block 列表（:122-125），粒度粗但方向一致。plan review 达 5 轮上限后强制放行（plan_review_hook.py:154-170），judge 不可用时 fail-open（:196），在材料视角都是「门槛归零」。但两处都有显式注释说明权衡（放行后仍有 gate+judge+审批兜底、死锁代价更高），是文档化的自觉选择而非疏漏。

**JV-16 垃圾输出没有预算（🔶）**。 材料 M4 给每类失败设预算与门槛；本仓 `eval_failure_patience=3` 只数「评估器抛异常」（config/routine.py:85-88、orchestrator.py:845）。基础设施失败有预算，解析垃圾（不抛异常的 score=0）零预算且照常推进决策。离线 eval 更进一步：judge 不可用时 `score=0.0` 计入均值与通过率（runner.py:990-997），`DEFAULT_PASS_THRESHOLD=70.0`（:55）下真实 0 分与垃圾 0 分不可区分。这与 JV-3 是同一建议的两面：先有 counter，才谈得上预算。

### JV 落地建议

**做**（绑明确时机）：

- JV-3、JV-16：给 judge 族解析器（`evaluator._parse` / `plan_reviewer._parse` / FacultyBridge 消费点）加「矫正发生」counter 与一条 warn。绑 evaluator 或 plan_reviewer 下次触碰（锚定/阈值调整）时；counter 落 metrics，使垃圾 0 分可与真实 0 分区分。
- JV-9：修 KG 置信缺省方向：`extractors.py:972` 与 `service.py:725-726` 的 `metadata.get("confidence", 1.0)` 缺省改显式低值或 missing 标记。绑 knowledge/graph 抽取链下次触碰时；注意存量实体无该字段的回填影响。
- JV-4：`_auto_answer_question` 解析失败分支改走 `_FALLBACK_ANSWER`，绑 claude_code service 下次触碰。
- JV-13：补注册或前移校验在用未注册的 task key，绑 task_registry 下次加槽时。

**写**（一句话成本）：

- JV-1：在 task_registry 或 ADR 写明「枚举只存在于 prompt 散文 + 事后矫正」是全仓既定姿势（含 13 处清单），新 judge 类调用至少沿用 loads_lenient + 字段校验 + 矫正日志三件套。
- JV-10：在 confidence 字段语义处写一句：LLM 口头置信 / 正则常数 / 启发式常数三种来源不可比，聚合须分组。
- JV-7：plan_reviewer prompt 处注明模块互评污染已知、以 status 为准；JV-12：rerank `score_threshold=0` 的「纯排序」语义注一笔。

**暂缓**（写明 YAGNI 触发条件）：

- JV-8：prompt 前缀缓存：触发条件 = LLM 成本可观测且 judge/抽取前缀占比显著。
- JV-13：运行时置信分流（按读数升降模型档）：触发条件 = 本域有校准验证的置信信号。材料规律 4 表明曲线一换阈值即作废，本仓无任何校准数据。
- JV-14：FacultyBridge 改 cheap-first：触发条件 = faculty 与直连的输出质量/成本 A/B 数据。
- 接入 Jev 本体或增设 judge/rerank 类决策模型槽位：触发条件 = 官方给出中文量化，或可自托管复刻且经本仓数据校准验证（材料批判边界 5：中文可用性零量化；`TaskModelType` 现无此槽位）。
- JV-1 的升级路径：严格 JSON-schema / 受约束解码：触发条件 = 矫正 counter 显示某链路脏输出率高到值得工程化。

**材料与登记**：

- 材料机制定义与证据链：[200-jev-system-one-model.md](./agent-infra/200-jev-system-one-model.md) 的 §M1（闭合输出空间，§3）、§M2（共享 state 与隔离，§4）、§M3（校准概率，§5）、§M4（快慢分工，§6）及规律 1-5、争议 3（校准的领地）各节（§7）。
- 落地建议中「做」档四项建议将在 [issue.md](../.agents/issue.md) 登记条目，并回链本节（锚点以本节「文件：行号」为准）。

## 自进化

> 核验基线（来源简称 | 本仓基线提交或分支 | 核验日 | 外部钉点）：
>
> - **PG** | 分支 `ThreeFish-AI/agent-graph-paper-guided-study`，无本仓基线哈希 | 核验日：无 | [Procedural Graph 论文精读笔记](./self-evolution/142-procedural-graphs.md)（arXiv:2609.09153）。只分析不改码，锚点经实际代码核验。
> - **Dream-RSI** | 分支 `ThreeFish-AI/guided-learn-arxiv-2609-14858`，无本仓基线哈希 | 核验日：无 | [Dream-RSI 论文精读笔记](./self-evolution/144-dream-rsi.md)（arXiv:2609.14858）。只分析不改码，锚点经 `grep -n` 实际代码核验。

两份映射共 11 条，7 条已对齐，2 条部分对齐（PG-M2、DR-M1），2 条暂缓或仅作警示（PG-M4、DR-M6）。PG-M1 与 DR-M3 指向同一个模式：验证门「不退化即接受」，本仓与两篇论文各自独立收敛到它，均无需动作。唯一判为「做」的是 PG-M2 的编辑级拒绝记忆；PG-M3 与 DR-M1 的落地项都只是在自进化方案里补一句文档，PG-M4 与 DR-M1 的实现等触发条件出现再评估。DR-M6 提示经验注入有 over-constrain 边界，与 PG-M2 同属「负证据/经验的正确用法」主题。

### PG-DR 映射总表

**PG**

| # | 材料机制（出处） | 本仓对应 | 锚点 | 判定 |
| --- | --- | --- | --- | --- |
| PG-M1 | 验证门：候选 ≥ 缓存分才接受，**平局也接受**（§3.3 式 5） | 金丝雀双窗判定；routine 成功/停滞判定 | [`evolution/decision.py:228`](../../apps/negentropy/src/negentropy/engine/evolution/decision.py) · [`routine/decision.py:96`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 已对齐 |
| PG-M2 | 拒绝记忆：被拒编辑连同轨迹作负证据注入下一轮提案（§3.3 式 6） | 巡检记忆的正/负证据标签体系；进化提案回路缺编辑级负证据 | [`routine/patrol_memory.py:42-45`](../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) | 🔶 部分对齐，**值得落地** |
| PG-M3 | 报告纪律：报「返回图 85%」而非「搜索最优 95%」，杜绝测试集选优（§5.4） | `decide()` 以最新迭代判成功、`best_score` 仅作停滞参照 | [`routine/decision.py:34`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 天然对齐，宜显式成文 |
| PG-M4 | 边属性 `condition`/`guidance`/`pitfalls`：转移级操作知识（§3.1） | definitions SSOT → harness_materializer 渲染 skill/routine 定义 | [`agents/definitions/harness_materializer.py`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) | ⏸ 暂缓（YAGNI） |
| PG-M5 | 结构校验先于验证 rollout：非法候选不花预算、直接沉淀负证据（Algorithm 1 L11-13） | 决策纯函数边界（不读 settings、参数显式注入）+ 门控语义（门控超时/失败 ≠ 门控通过，ISSUE-115） | [`routine/decision.py:96-170`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 已对齐 |

**Dream-RSI**

| # | 材料机制（出处） | 本仓对应 | 锚点 | 判定 |
| --- | --- | --- | --- | --- |
| DR-M1 | 历史即重放模拟器：发现树 → 确定性重放 → 元策略离线评估（§2-§3.3） | eval 四表版本链 + holdout 复跑 + `memory_retrieval_logs` 窗口重放 + `fire_reason ∈ {tick, manual, replay}` 已有 replay 语义 | [`models/eval_suite.py:242-260`](../../apps/negentropy/src/negentropy/models/eval_suite.py) · [`models/internalization.py:168-170`](../../apps/negentropy/src/negentropy/models/internalization.py) · [`models/scheduled_task.py:129`](../../apps/negentropy/src/negentropy/models/scheduled_task.py) | 🔶 部分对齐，**暂缓**（YAGNI） |
| DR-M2 | 离线锚定评估：评估基于历史记录而非每轮独立重打分（§3.3 + §5.1） | Judge 锚定版 prompt（trajectory + progress_evidence 先证据后给分）——140 号双支柱之一已落地 | [`engine/routine/evaluator.py:93`](../../apps/negentropy/src/negentropy/engine/routine/evaluator.py)（锚定版在 :252 条件启用） | ✅ 方向已对齐，论文是更强形式 |
| DR-M3 | 候选包含保证 V\*≥V⁰：argmax 池含当前策略，防回退下界（§3.5） | canary 门「不退化即接受（平局接受）、任一退化即 rollback」+ 配置版本 promote/rollback 指针翻转 | [`engine/evolution/decision.py:228`](../../apps/negentropy/src/negentropy/engine/evolution/decision.py) · [`models/evolution.py:192-221`](../../apps/negentropy/src/negentropy/models/evolution.py) | ✅ 已对齐 |
| DR-M4 | 重放目标三分量：质量 − 成本 + 并行度，目标函数设计决定选出什么（§3.4 Eq.1） | routine 成功判定的目标口径：score 阈值 OR verdict=pass 旁路（历史坑：阈值不可达致收敛成功态被误杀） | [`engine/routine/decision.py:96-150`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 教训已吸收（旁路存在） |
| DR-M5 | 只改策略层、底座冻结：模型/评估器/执行接口不动，仅策略代码可变（§3） | definitions SSOT → TargetHandler 六面 → harness_materializer 渲染：进化只改定义层，agent 运行时不动 | [`models/evolution.py:53-66`](../../apps/negentropy/src/negentropy/models/evolution.py)（六面白名单） · [`agents/definitions/harness_materializer.py`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) | ✅ 已对齐 |
| DR-M6 | 语义引导 over-constrain 警示：历史摘要注入 prompt 劣于无引导（§5.1 实证） | Reflexion episodic replay / `routine.reflections` 注入 / patrol_memory pattern 注入——全是「语义摘要注入」型 | [`config/memory.py:31`](../../apps/negentropy/src/negentropy/config/memory.py) · [`engine/routine/prompt_builder.py`](../../apps/negentropy/src/negentropy/engine/routine/prompt_builder.py) · [`engine/routine/patrol_memory.py:42-47`](../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) | ⏸ 批判性警示（无须改码） |

### PG-DR 逐条说明

**PG-M1 验证门与「平局接受」（✅ 已对齐）**。存量已对齐。PG 的门是「单一权威信号（验证分）+ 缓存参考分 + 平局接受」。本仓 [`decide_canary`](../../apps/negentropy/src/negentropy/engine/evolution/decision.py) 已实现同型语义：**「helpful_ratio 允许 0 改进（只要不下降）」即平局接受，任一退化则 rollback**，且比 PG 多了样本充足性检查（`hold` 而非立即定夺）。routine 侧 [`decide()`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) 的停滞判定同样吸收了「平局含信息」：ISSUE-128 引入的 `no_progress_score_tolerance` 容差带（经 [`orchestrator.py:905-911`](../../apps/negentropy/src/negentropy/engine/routine/orchestrator.py) per-routine 注入）把「评分落在 [历史最优 − tolerance, +∞)」视为有进展，这正是对 Judge 聚合分天然 ± 振荡的「平局语义」处理，与 PG 面对小验证集时的谨慎同源。**无需落地**；价值在于交叉确认：两套独立系统在同一个坑位收敛到同一个解法，说明该模式已是领域共识（PG 之外，金丝雀发布、进化计算 elitism 亦然）。

**PG-M2 拒绝记忆（🔶 部分对齐，值得落地）**。巡检侧已结构化，进化侧是真空区。本仓巡检记忆已有一套**正/负证据双轨**：[`patrol_memory.py`](../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) 的 `pdf-fidelity-unfixable`（区域级不可修复标记 = 负证据，会话内避让）、`pdf-fidelity-pattern`（有效修法 = 正证据，向后传播）、`pdf-fidelity-baseline`（回归基线集 + `DEFAULT_REGRESSION_DROP_THRESHOLD = 3` 的非回归门）。这与 PG「被拒候选 + 成功 pattern 分轨沉淀」的设计同构，且以 tag 键定的确定性查询实现了 SSOT。**差异在进化回路**：PG 的拒绝记忆是**编辑级**的，记录「哪个结构变更提案、在哪个验证集上、掉了多少分」，并作为负证据注入下一轮提案器（式 6）。本仓 [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md) 的 GEPA 反思回路目前从**执行反馈**提案，尚无「历史被拒提案」的结构化沉淀；若提案器重复生成等价坏提案，没有机制层阻断。**建议落地**（对应方案落地阶段实施）：`evolution_proposals` 增加 `rejection_evidence` 沉淀（提案 diff + 验证指标 delta + 拒绝原因），提案器上下文注入最近 N 条负证据。PG 的经验是这能拦住「训练集动机未泛化」型重复提案（论文 R3/R10 均为实例）。

**PG-M3 报告纪律（✅ 天然对齐，宜显式成文）**。实现已对齐，宜显式成文。PG 明确区分「返回图」（部署产物）与「搜索最优」（过程观测），只报前者。本仓 `decide()` 判成功用 `latest.score`（返回态），`best_score` 仅在 [`_is_no_progress`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) 内作窗口外基线参照（窗口语义见该函数注释），不存在「挑历史最优轮交付」的选优路径，纪律天然对齐。风险在未来：自进化方案上线后若引入「保留历史最优版本」语义（版本库挑拣），须显式区分「部署返回态」与「搜索最优态」两个口径，避免测试集选优。建议在 [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md) 评测节补一句该纪律：**一句话成本，防一类评估事故**。

**PG-M4 边属性三件套（⏸ 暂缓，YAGNI）**。暂缓，等真实痛点。PG 把「何时走 / 怎么走 / 别踩什么坑」字段化到**转移级**。本仓 definitions SSOT → [`harness_materializer`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) 渲染的是 skill/routine 定义的文本与结构化字段，步骤间依赖以叙述存在。借鉴形态：给 routine preset / harness skill 的步骤定义加 `condition`/`pitfalls` 显式字段（不必引入完整图）。**判定暂缓**：当前 routine 失败模式中未见「步骤乱序」主导的案例（Judge 振荡/命名门控才是主痛点），按最小干预原则等真实痛点出现再动（论文自己也证明：错误位置的结构先验会把 MultiChallenge 从 87.5 拖到 58.9，结构是双刃剑）。

**PG-M5 结构校验先于 rollout（✅ 已对齐）**。存量已对齐。PG：结构非法的候选不进验证 rollout，直接入拒绝记忆（省预算 + 负证据沉淀）。本仓同型模式两处：① 决策层纯函数边界（`decide()` 不读 settings、阈值/容差显式注入，非法输入在类型层即被拒）；② 门控语义（ISSUE-115：`gate_exit_code ∉ {None, 0}` 时整块跳过成功判定，即「门控超时/失败 ≠ 门控通过」）。原则一致：**不可用候选在进入昂贵验证之前拦截**。

**DR-M1 历史即重放模拟器（🔶 部分对齐，暂缓，YAGNI）**。离线门已有，「历史→模拟器」是真空区。论文把「已完成的历史」升级为**可交互对象**：候选策略在发现树上走替代轨迹，评估只读记录、零执行成本。本仓最接近的对照是 eval 体系：[`EvalRun`](../../apps/negentropy/src/negentropy/models/eval_suite.py) 的 `baseline_version` parent 边构成版本链，`is_frozen` 切出可见/holdout 集，`longitudinal_recheck` 每日对已晋升对象复跑 holdout；retrieval 侧 `memory_retrieval_logs.config_version` 让 [`eval_runner`](../../apps/negentropy/src/negentropy/engine/evolution/eval_runner.py) 能按版本分桶**重放聚合**历史窗口指标。甚至 [`scheduled_task.fire_reason`](../../apps/negentropy/src/negentropy/models/scheduled_task.py) 已含 `replay` 枚举（为审计与回放区分调度源）。**差异在交互性**：本仓的「重放」都是**重放聚合/复跑验证**（对既有数据算指标、对既有版本再打分），不是「让一个候选**策略/编排**在录制好的历史上走替代路径并为其打分」。Dream-RSI 评估的对象是「会做序列决策的策略」，本仓 evolution 的提案是「一组配置参数」，后者没有序列决策面，也就不需要模拟器。**判定暂缓（YAGNI）**：本仓当前没有「可编程探索策略」这一层可被重放评估。触发条件成文见落地建议。

**DR-M2 离线锚定评估（✅ 方向已对齐，论文是更强形式）**。140 号双支柱已同向，论文给出极端形式。论文的评估信号全部来自历史记录（重放分），绝不每轮从零独立打分。本仓 [140 号调研](./self-evolution/140-experience-era-self-improvement.md)诊断的正是反面病症：Judge 无历史锚点、评分天然 ±20 振荡（[ISSUE-128](../.agents/issue.md) 容差带治标），随后落地的 [`_JUDGE_PROMPT_ANCHORED`](../../apps/negentropy/src/negentropy/engine/routine/evaluator.py)（轨迹锚定 + progress_evidence 先证据后给分）就是锚定支柱。论文比本仓走得更远的地方：锚定不止用于「评得稳」，还闭环进「改得对」（策略修订看重放轨迹）。对本仓的启示按 Dream-RSI 保真度光谱读：锚定 prompt（弱形式，无新信息）→ 轨迹证据锚定（中形式，本仓现状）→ 历史重放模拟器（强形式，DR-M1）。**无须立刻行动**；若未来 Judge 振荡再次成为主痛点，沿光谱升级是现成路径。

**DR-M3 候选包含保证（✅ 已对齐）**。两套系统在同一个坑位收敛到同一个解法。论文 argmax 候选集包含当前策略 ⇒ V\*≥V⁰；本仓 [`decide_canary`](../../apps/negentropy/src/negentropy/engine/evolution/decision.py) 的语义是「helpful_ratio 不下降即接受（平局接受），任一退化则 rollback」，且 [`MemoryConfigVersion`](../../apps/negentropy/src/negentropy/models/evolution.py) 的 promote/rollback = 新写一行 + 翻 `is_active` 指针，「改不动就不换」的防回退下界两边同构。交叉确认价值：与 PG-M1（验证门平局接受）构成**三套独立系统的同构收敛**（Dream-RSI / PG / 本仓 + 金丝雀发布与进化计算 elitism），该模式已是领域共识，本仓无需动作。

**DR-M4 重放目标三分量（✅ 教训已吸收，旁路存在）**。本仓的历史坑恰是「目标函数设计错误」的实例。论文 V 的三分量各管一事：max s 管质量、β₁·N 管成本、β₂·N/k 管并行效率；[原型 D2/D3 实测](./self-evolution/144-dream-rsi.md#7-动手实验室把机制亲手拆坏五次)证明拆掉任何一项都会选出错误的东西。本仓的对应教训是 routine 成功判定口径：`decide()` 历史上只看 `score >= threshold`，阈值不可达时收敛成功态被 `no_progress` 误杀（[记忆中的历史 issue]），后来引入 [`accept_verdict_pass` 旁路](../../apps/negentropy/src/negentropy/engine/routine/decision.py)（verdict=pass 亦可判成功）。两侧共同的教学点：**代理指标的设计决定进化方向，写门之前先验证门可达**。本仓已吸收（旁路存在）；Dream-RSI 补充的增量是「成本与并行度也须入目标」。本仓 routine 的预算控制（max_cost_usd/max_iterations）是硬截断而非目标函数分量，语义不同但各得其所，无须合并。

**DR-M5 只改策略层、底座冻结（✅ 已对齐）**。本仓的定义层分离与之同构。论文整个 RSI 闭环里只有探索策略代码可变。本仓 [`EvolutionProposal.target_kind`](../../apps/negentropy/src/negentropy/models/evolution.py) 白名单六面（retrieval_config / skill_template / memory_pipeline_prompt / builtin_tool_config / knowledge_strategy / agent_prompt）全部是**定义层**，经 [`harness_materializer`](../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) 渲染生效，agent 运行时与引擎本体不在进化面内，「进化不碰底座」的边界管理两边一致。

**DR-M6 语义引导 over-constrain（⏸ 批判性警示，无须改码）**。对本仓三类经验注入的边界警示。论文 §5.1 实证：把历史摘要成方向性洞见注入 prompt，两种范式下都**劣于**无引导版。长程、多并行线程的探索中，强语义偏置会把搜索空间框死。本仓的经验注入恰有三类同型设计：F2 Reflexion episodic replay（[`config/memory.py:31`](../../apps/negentropy/src/negentropy/config/memory.py)）、`routine.reflections` 累积反思注入下一轮 prompt、patrol_memory 的 pattern 正证据向后传播。**判定为批判性警示而非行动项**：论文的伤害条件是「长视野 × 并行多样探索 × 组合空间巨大 × 验证一条洞见就要烧掉想省的预算」的发现型任务；本仓的注入多服务于「重复性巡检/流程执行」类任务（教训便宜可证伪、动作空间小），恰在论文承认小抄有效的区间。**须知边界**：若未来某 Routine 的核心价值是发散探索（如自动调参、方案发现），对其 reflections 注入应主动克制，多样性的优先级高于教训密度。

### PG-DR 落地建议

**PG**

1. **做**（PG-M2）：自进化方案的提案回路增加编辑级拒绝记忆（提案 diff + 指标 delta + 原因，注入下一轮提案上下文）。
2. **写**（PG-M3）：自进化方案评测节补「报告返回态而非搜索最优」纪律一句。
3. **暂缓**（PG-M4）：`condition`/`pitfalls` 字段化，待「步骤乱序」成为可观测的 routine 失败主因再评估。

**Dream-RSI**

- **做**（绑时机；DR-M1 至 DR-M6）：无，六条映射中没有需要立即动码的项。
- **写**（DR-M1，一句话成本）：在 [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md) 的演进路线节补一句「元级评估重放化」的候选方向与触发条件（即下条），防止未来重新调研。
- **暂缓**（DR-M1，写明触发条件）：重放模拟器。触发条件有三，满足任一即重开评估：① 本仓出现「可编程的序列决策编排层」（如 routine 的调度策略本身成为进化对象，而非 preset 参数）；② 元级试错成本成为可观测瓶颈（多个候选编排的在线 A/B 各需完整 Routine 轮次）；③ patrol/evolution 的历史轨迹已结构化到能支撑确定性重放（`RoutineIterationEvent` 全转录 + 分数链）。在此之前，论文的锚定思想以 DR-M2 的既有形式（轨迹锚定 Judge）为已足。

相关文档：[Procedural Graph 论文精读笔记](./self-evolution/142-procedural-graphs.md) · [Dream-RSI 论文精读笔记](./self-evolution/144-dream-rsi.md)（机制三拍详解、五次破坏性实验、批判性边界） · [140 经验时代的自驱迭代进化智能体](./self-evolution/140-experience-era-self-improvement.md)（Judge 锚定双支柱的出处） · [130 自进化 Agents Team 调研](./self-evolution/130-self-evolving-agents-team.md)（AlphaEvolve/GEPA 谱系与 DR-M5 的进化面白名单语境） · [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md) · [Routine 子系统](../concepts/subsystems/039-the-routine-system.md) · [PDF 巡检状态落库方案](../.agents/pdf-fidelity-patrol-status.md)。PG 与 Dream-RSI 互为对象级与元级的姊妹篇：PG-M2「编辑级拒绝记忆」与 DR-M6 的注入边界同属「负证据/经验的正确用法」主题。

## Agent Harness

> 核验基线：
>
> - AI Native | 分支 `feature/1.x.x`，基线提交 `161d6244` | 无日期 | 页码为手册印刷页码；后端路径以 `apps/negentropy/src/negentropy/` 为根；精读笔记 [180](./agent-harness/180-ai-native-handbook.md)
> - Hermes | 工作区 HEAD `2edf3ed5`（`feature/1.x.x` 基线） | 无日期（文内 2026-09-27 是 HM-M2 销账注记的日期） | Hermes 固定提交 `068db016`；`ng/` = `apps/negentropy/src/negentropy/`；精读笔记 [190](./agent-harness/190-hermes-agent.md)

AI Native 手册的 17 条映射为 ✅8 / 🔶3 / ⏸6，真增量集中在凭据边界（AN-11）、授权第三态 Challenge（AN-13）、生产门控对象（AN-14）三处，都绑定在「Agent 触达生产或不可信代码」的前提上，本仓是单用户本机部署，所以判为暂缓。Hermes 的 16 条映射为 ✅4 / 🔶6 / ⏸6，真增量是交互式对话的上下文压缩（HM-M11）、记忆写入与注入两端防注入（HM-M3）、零 LLM 原文会话检索（HM-M9），取证副产物是中文关键词检索失效（HM-M10，ISSUE-196）与审批门只接线两个工具（HM-M14，ISSUE-197）。两份材料在「CC 最大权限」取舍上一致，AN-17 与 HM-M14 都判 ⏸，HM-M14 同时记下 AN-17 成文时的前提「没有通用 shell」已不成立，触发条件实际已满足。

相邻材料：[170 五层 Harness 总览](./agent-harness/170-claude-code-harness-overview.md)（循环本体的机制对位）；[039 Routine 系统](../concepts/subsystems/039-the-routine-system.md)（闭环与决策的现役设计）；[013 Context Layer 技术蓝图：Agent 系统的上下文供给与治理](./cognitive-context/013-context-layer-blueprint.md)（2026-09-27 完全重铸版）；进化路线 [130 自进化 Agents Team](./self-evolution/130-self-evolving-agents-team.md) 与 [141 Skill 进化闭环](./self-evolution/141-skills-evolution-and-si-measurement.md)；Hermes 原型 [`assets/hermes_lab.py`](./agent-harness/assets/hermes_lab.py)。180 笔记提供规律 R1–R5 与破坏性实验 D1–D6；SK 域的目录注入面条目与 `expand_skill`、OV 域 M-d 会话两阶段提交（ISSUE-195）是 HM 条目的相邻域。

### AN 与 HM 映射总表

**AI Native**

| # | 手册机制（出处） | 本仓对应 | 锚点 | 判定 |
|---|---|---|---|---|
| AN-1 | 行动—验证—纠错闭环，完成要有客观证据（p35–36） | Routine 命令门控 + Judge 评估 + 决策纯函数 | [`evaluator.py:407`](../../apps/negentropy/src/negentropy/engine/routine/evaluator.py) `_run_gate` · [`decision.py:96`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) `decide` | ✅ |
| AN-2 | 门禁由程序执行，门控失败不等于通过（p37、p58） | 只有 `gate_exit_code ∈ {None, 0}` 才可能判成功（ISSUE-115） | [`decision.py:147`](../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ |
| AN-3 | 上下文按需加载，超预算时裁剪或压缩（p36） | token 预算装配 + 上下文耗尽后压缩重试 | [`context_assembler.py:353`](../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) · [`runner.py:69`](../../apps/negentropy/src/negentropy/engine/routine/runner.py) | ✅ |
| AN-4 | 规划、状态与恢复，中断后从可信位置继续（p36） | 引擎确定性检查点提交 + 迭代全过程事件 | [`workspace.py:522`](../../apps/negentropy/src/negentropy/engine/routine/workspace.py) · [`routine.py:283`](../../apps/negentropy/src/negentropy/models/routine.py) | ✅ |
| AN-5 | 人只放在需要判断的位置（p36） | 审批模式 every / first / auto + 高风险工具审批 | [`orchestrator.py:1220`](../../apps/negentropy/src/negentropy/engine/routine/orchestrator.py) · [`approval.py:128`](../../apps/negentropy/src/negentropy/agents/approval.py) | ✅ |
| AN-6 | 知识按场景供给（p40） | 知识库以只读 MCP 工具供给 CC | [`mcp_server.py:97`](../../apps/negentropy/src/negentropy/knowledge/mcp_server.py) | ✅ |
| AN-7 | 使用反馈回流到知识治理（p39–40） | 已采集检索反馈，尚未驱动「过期 / 冲突」治理 | [`unified_search.py:495`](../../apps/negentropy/src/negentropy/knowledge/retrieval/unified_search.py) | ⏸ |
| AN-8 | 在正确时机选对能力（p33、p41） | 三层渐进披露；strict 模式缺工具即阻断 | [`skills_injector.py:423`](../../apps/negentropy/src/negentropy/agents/skills_injector.py) | ✅ |
| AN-9 | 工具评测：命中率 + 成功率（p42） | 只有成功率，没有命中率 | [`tool_telemetry.py:148`](../../apps/negentropy/src/negentropy/models/tool_telemetry.py) `success_count` | 🔶 |
| AN-10 | Sandbox 四边界：生命周期 / 执行 / 网络 / 凭据（p43–45） | worktree 隔离 + re-anchor；容器沙箱 Docker 后端未实现，网络默认关闭 | [`workspace.py:315`](../../apps/negentropy/src/negentropy/engine/routine/workspace.py) · [`sandbox/__init__.py:30`](../../apps/negentropy/src/negentropy/engine/sandbox/__init__.py) | ⏸ |
| AN-11 | 凭据边界：占位值 + 出站代理注入（p45、p53） | CC 子进程经环境变量拿到真实凭证；`ANTHROPIC_BASE_URL` 已指向本地 coding-proxy | [`service.py:479`](../../apps/negentropy/src/negentropy/engine/claude_code/service.py) `_credential_env` | ⏸ |
| AN-12 | 有效权限取交集，资源侧重验（p51–53） | RBAC 只有 admin / user 两个角色，没有 Agent 独立身份和委托收敛 | [`rbac.py:82`](../../apps/negentropy/src/negentropy/auth/rbac.py) | 🔶 |
| AN-13 | 授权第三态 Challenge（p54） | 审批决策只有 approved / denied 两态 | [`approval.py:186`](../../apps/negentropy/src/negentropy/agents/approval.py) | ⏸ |
| AN-14 | Guardrail：规则版本 + 动作快照摘要 + 时效（p55–58） | 定义有版本指针，但没有生产变更门控对象 | [`agent.py:40`](../../apps/negentropy/src/negentropy/models/agent.py) `active_version` | ⏸ |
| AN-15 | UNKNOWN 必须显式记录（p58） | Judge 返回非法 verdict 时，按分数推断为 progressing 或 stalled | [`evaluator.py:556`](../../apps/negentropy/src/negentropy/engine/routine/evaluator.py) | 🔶 |
| AN-16 | System + Trajectory 双层可观测（p59–61） | OTel GenAI 语义约定 + 迭代锚点审计 | [`instrumentation.py:38`](../../apps/negentropy/src/negentropy/instrumentation.py) · [`trajectory.py:213`](../../apps/negentropy/src/negentropy/engine/routine/trajectory.py) | ✅ |
| AN-17 | 风险拦截独立于模型（p37） | 只有 Plan Review 的 PreToolUse 钩子；危险命令没有硬拦截 | [`orchestrator.py:229`](../../apps/negentropy/src/negentropy/engine/routine/orchestrator.py) | ⏸ |

**Hermes**

| # | Hermes 机制（190 出处） | 本仓对应 | 锚点 | 判定 |
|---|---|---|---|---|
| HM-M1 | 缓存优先三段式装配 + 冻结快照（§3） | 每请求动态 instruction；每轮检索记忆注入 system instruction；LLM 请求侧未配置提供方前缀缓存 | `ng/agents/_dynamic_instruction.py:80` `_provider` · `:97-99` · `ng/agents/tools/memory.py:6` · `:161` `append_instructions` | ⏸ 触发条件见下 |
| HM-M2 | 有界常驻、Agent 可自编的声明式记忆（§4） | `MemoryCoreBlock` + 30% 记忆预算；核心块只能经 REST `/core-blocks` 写，Agent 无编辑工具（`core_block_replace` 全仓零调用方） | `ng/models/internalization.py:250` · `ng/engine/api.py:1206` · `ng/engine/tools/memory_tools.py:236` · `ng/agents/tools/registry.py:64` · `ng/engine/adapters/postgres/context_assembler.py:38` | 🔶 写 |
| HM-M3 | 记忆写入与加载两端威胁扫描、快照 `[BLOCKED]` 占位（§4） | `save_to_memory` 只做 JSON 格式校验后直接 ORM 落库，不经 memory_service，PII 与注入检测都不覆盖；注入块只说「无关时忽略」 | `ng/agents/tools/internalization.py:23` · `:71-80` · `ng/engine/governance/content_validator.py:21` · `ng/agents/tools/memory.py:52-56` | 🔶 做 |
| HM-M4 | 技能渐进披露：目录常驻、正文按需（§4） | 目录注入已对齐；`expand_skill` 未挂载 | `ng/agents/skills_injector.py:342` · `:357` · `ng/agents/tools/registry.py:64` | 🔶（部分）ISSUE-194 已登记 |
| HM-M5 | 交付后旁路 review 自写技能（§5） | 交互式无；Routine 有迭代后记忆提炼；技能进化走离线门控 | `ng/engine/routine/orchestrator.py:1393` · `ng/engine/evolution/handlers/skill.py:96` · `ng/engine/evolution/decision.py:120` | ⏸ 争议一 |
| HM-M6 | 分派侧白名单、「广播不等于许可」（§5） | 按翼 `allowed_names` 许可上界 + Faculty `read_only` 白名单 | `ng/agents/_dynamic_tools.py:38` · `ng/engine/routine/faculty_bridge.py:43` · `:81` | ✅ |
| HM-M7 | 署名边界 + 只归档不删除（§5） | `Skill.owner_id` / `is_system` + `SkillVersion` 快照可恢复 | `ng/models/skill.py:21` · `:48` · `:114-119` | ✅ 前置齐备 |
| HM-M8 | Curator 按使用信号的生命周期（§5） | 技能无使用遥测字段 | `ng/models/skill.py:15-68` | ⏸ 同 HM-M5 |
| HM-M9 | 零 LLM 原文会话检索 + 谱系去重（§6） | 事件表无全文索引；会话 API 无检索路由 | `ng/models/pulse.py:36` · `:45` · `ng/engine/sessions_api.py:119-202` | 🔶 做 |
| HM-M10 | CJK bigram / trigram 分词索引（§6） | `memories` 与知识库的 `search_vector` 均按 english 配置生成与查询 | `ng/db/migrations/versions/0047_memory_hybrid_search_function.py:58` · `:146` · `ng/db/migrations/versions/0001_init_schema.py:914` · `ng/engine/adapters/postgres/memory_service.py:1255` · `ng/knowledge/retrieval/repository.py:841` | 🔶 做（ISSUE-196） |
| HM-M11 | 交互式上下文压缩：结构不变式 + 唯一断点（§6） | 零压缩：`num_recent_events` 零调用方，未启用 `EventsCompactionConfig`（ADK 2.2.0 标 `@experimental`）；仅 Routine 有 compact 重试 | `ng/engine/adapters/postgres/session_service.py:146-156` · `ng/engine/routine/runner.py:69` · ADK 2.2.0 `google/adk/apps/_configs.py:49-50` | 🔶 做 |
| HM-M12 | 隔离委派：新上下文、只回摘要、深度 1、子代理禁记忆（§7） | `transfer_to_agent` 是控制权移交，不是隔离执行；`run_faculty` 的 `read_only` 近似 | `ng/agents/agent.py:126-130` · `:249` · `ng/engine/routine/faculty_bridge.py:125` | ⏸ |
| HM-M13 | cron 不许自排程（§7） | Agent 工具注册表内无排程类工具，排程只经 REST / UI | `ng/agents/tools/registry.py:64-92` · `ng/models/scheduled_task.py:31` | ✅ 结构性对齐 |
| HM-M14 | 命令内容级 hardline（连 yolo 也拦）（§7） | 工具级审批清单 `HIGH_RISK_TOOLS` + `ApprovalPolicy`，但只接线两个工具；`invoke_claude_code` 给主机 Bash（CC 自身 `permission_mode` 默认 auto），不在清单内；无命令内容级硬拦截 | `ng/agents/approval.py:46` · `:118` · `:128` · `ng/agents/tools/claude_code.py:23` · `ng/agents/tools/ingest.py:119` · `ng/agents/tools/paper.py:343` | ⏸ 同 AN-17（CC 最大权限取舍） |
| HM-M15 | 容器后端跳过审批（§7） | `execute_code` 在 microsandbox 内执行，未因沙箱豁免审批（但审批本身未接线，见 HM-M14） | `ng/agents/tools/action.py:44` · `ng/engine/sandbox/__init__.py:9` | ✅ 仅就 `execute_code` 而言；不照抄「容器即边界」 |
| HM-M16 | 30+ 平台消息网关 / 7 种终端后端（Tier 3） | 无；Docker 后端 `NotImplementedError` | `ng/engine/sandbox/__init__.py:30` | ⏸ YAGNI |

### AN 与 HM 逐条说明

**AI Native**：只列出判定需要解释的条目。

**AN-2 门禁由程序执行（✅）**。与手册「UNKNOWN 不当 PASS」同构，门控超时或失败都不会误判为成功。原型 D3 实测了违反这一点的代价：撞上监控故障的批次被照常恢复发布。

**AN-9 工具评测：命中率 + 成功率（🔶）**。`ToolStatsDaily` 已有 `success_count` / `error_count`，可以直接产出手册 p42 要求的「长期低成功率能力」清单。命中率需要「本该选哪个工具」的标注数据，成本高，暂不纳入。

**AN-11 凭据边界：占位值 + 出站代理注入（⏸）**。这正是手册 p45 点名「最常见也最危险」的形态。原型 D5 实测：出站拦截即使守住，令牌仍会经构建日志泄露。本仓的前提不同：单用户本机部署，CC 本身就是用户的代理，所以判为暂缓。落地路径现成：已有 coding-proxy，届时由它注入凭证，子进程只留占位值。

**AN-12 有效权限取交集（🔶）**。与 HZ-15 是同一缺口（代理会话权限天花板），沿用其 🔶 判定与落地时机，不重复立项。

**AN-15 UNKNOWN 必须显式记录（🔶）**。推断 verdict 本身合理，它保证决策层总有合法输入。但它抹掉了「这一轮评估其实没读懂」的信号，属于 UNKNOWN 被静默转写。

**AN-17 风险拦截独立于模型（⏸）**。这是既定设计取舍，不是遗漏。CC 以最大权限运行，Routine 的不变量由 workspace 机制保障，不靠禁用工具（[PR #998](https://github.com/ThreeFish-AI/negentropy/pull/998)）。手册的硬拦截针对的是触达生产的 Agent，二者的前提不同。

**Hermes**

**HM-M1 缓存优先装配（⏸）**。

- **本仓现状**：
  - instruction 每次请求由 `InstructionProvider` 从 DB 解析（60 秒 TTL 缓存），并追加全局技能块（`_dynamic_instruction.py:80`、`:97-99`）。
  - 检索记忆每轮注入 system instruction，同一 invocation 内去重复用（`memory.py:151-161`）。
  - LLM 请求侧没有设置任何 `cache_control`（grep 仅命中 HTTP 下载头，`knowledge/_http_range.py:145`）。
- **判定理由**：本仓目前不付前缀缓存的钱，也不收它的折扣，所以「每轮注入」在今天没有额外代价。这是[争议三](./agent-harness/190-hermes-agent.md#争议三缓存优先还是每轮相关性注入)的相关性一侧，是合理选址。
- **触发条件**：一旦为 Anthropic 或 Gemini 路由启用前缀或上下文缓存，就须把 `<RELEVANT_MEMORIES>` 从 system instruction 移到本轮用户消息一侧，或者按会话冻结。否则每个新用户轮都会让整段历史按原价重算。

**HM-M2 Agent 可自编的有界核心记忆（🔶 写）**。

- **Hermes 怎么做**：`MEMORY.md` / `USER.md` 由 Agent 用 add / replace / remove 自编，硬上限 2200 / 1375 字符，写满必须合并。
- **本仓现状**：`MemoryCoreBlock`（`internalization.py:250`）具备「常驻、按作用域分块」的形态；上下文装配给记忆 30% 预算（`context_assembler.py:38`）。但核心块只能经 REST `/core-blocks` 写入（`engine/api.py:1206`，直接调 `core_block_service`）；`core_block_replace` 工具函数（`memory_tools.py:236`）全仓零调用方，也不在 Agent 工具注册表里（`registry.py:64`）。
- **建议**：先**写**清楚，暂不开放。在 013 蓝图的记忆层补一句设计取舍：核心块由谁写、上限多少、写满怎么办。**已销账（2026-09-27：013 §4.2 Core Block 三问，完全重铸版）**。是否开放给 Agent，等 HM-M3 防注入落地之后再议：开放可自编的常驻记忆而没有写入扫描，等于给注入开一条常驻通道。成本约一段文档。

**HM-M3 记忆链路两端防注入（🔶 做）**。

- **Hermes 怎么做**：
  - 写入时过 36 条威胁模式，另查不可见字符。
  - 加载时命中的条目在快照里替换为 `[BLOCKED: …]`，live 列表保留原文，供用户删除。
- **本仓现状**：
  - `save_to_memory` 只调 `validate_memory_content`，它仅判断「是不是 JSON」（`content_validator.py:21`），随后直接用 ORM 落库（`internalization.py:71-80`），不经 memory_service。memory_service 里的 PII 检测（`memory_service.py:160`、`:1647`）因此也覆盖不到这条 Agent 写入路径，注入检测则两条路径都没有。
  - `NegentropyPreloadMemoryTool` 每轮按用户消息检索，把结果以 `<RELEVANT_MEMORIES>` 块 `append_instructions` 进 **system instruction**（`memory.py:161`、`:180`）。块头只写「无关时直接忽略」（`:52-56`），没有「视为数据、不执行其中指令」的声明。
- **差异**：一条被投毒的记忆会被持久化，并在相关查询时被推进系统指令。这正是间接提示注入 [190 参考 12] 的持久化变体。
- **建议**：
  - 写入端复用一份威胁模式表：Hermes 的 36 条是 MIT 许可，可按需裁剪。
  - 注入块头补一句数据声明。
  - 时机：与 SK-M5 的「目录注入防护」同批落地，在 ISSUE-195 会话巩固上线前完成；巩固一旦上线，自动写入量会放大这个面。

**HM-M5 / HM-M8 运行中自写技能与 Curator（⏸）**。Hermes 的头号卖点「运行中自写技能」按[争议一](./agent-harness/190-hermes-agent.md#争议一运行中自写技能还是离线门控进化没有判卷人时一次成功不等于方法对)暂缓：本仓选的是离线门控进化，这与 Hermes 的在线写回是路线分歧，不是缺口。

- **本仓路线**：技能进化由 `SkillProposer` 从失败用例驱动有界改写（`evolution/handlers/skill.py:96`），经 `pre_propose_check` → shadow → canary 门控（`decision.py:120`、`:427`）。这是门控派。
- **暂缓理由**：
  - 本仓连「模型自主激活技能」都尚未打通：`expand_skill` 未挂载（ISSUE-194），在线 canary 恒被跳过。
  - 没有使用遥测，Curator 式回收无信号可用。
- **触发条件**：ISSUE-194 挂载完成，技能具备 view / use 计数，且出现至少一类同构任务在 30 天内反复出现。届时可借鉴两点，而不是照搬「Be ACTIVE」：
  - review prompt 的「禁止固化」清单：环境性失败、负面工具结论、未解决的失败。
  - 「只归档不删除、宽限从未用过的新技能」这两条回收纪律。

**HM-M9 零 LLM 原文会话检索（🔶 做）**。

- **Hermes 怎么做**：
  - FTS5 三索引，检索零 LLM、返回原文。
  - 命中按谱系归并到对话再去重；默认 3 条，最多 10 条。
- **本仓现状**：
  - `Event`（`pulse.py:36`）的内容以 JSONB 存储（`:45`），没有 tsvector 或向量索引。
  - `sessions_api` 只有归档、删除、审批响应等路由（`:119-202`），没有检索路由。
  - 关键词检索只覆盖记忆表和知识库。
- **建议**：
  - [ISSUE-195](../.agents/issue.md) 的「会话 → 长期记忆」断链修好之前，原文检索是更便宜的第一步：零 LLM、没有巩固 worker 的一致性问题，而且与 OV 域 M-d 会话两阶段提交不冲突，二者互补。
  - 做法：在事件文本上建 GIN 索引，挂一个只读检索工具，结果按 thread 去重。
  - 时机：与 ISSUE-195 方案评审同场决定。
  - 前置：先修 HM-M10，否则中文检索仍然失效。

**HM-M10 中文关键词检索失效（🔶 做 · ISSUE-196）**。

- **Hermes 怎么做**：专门加了 `cjk_unicode61` bigram 索引与 trigram 回退。原因是 unicode61 会把一串连续汉字当作一个 token。
- **本仓现状**：迁移 0047 为 `memories` 建的触发器是 `to_tsvector('english', content)`（`:58`），查询用 `plainto_tsquery('english', …)`（`:146`、`memory_service.py:1255`）；知识库由 0001 的 `tsvector_update_trigger(search_vector, 'pg_catalog.english', content)` 生成（`0001_init_schema.py:914`），查询同款（`repository.py:841`）。
- **实测**（本机 PostgreSQL 16.14，只读查询）：

  ```text
  to_tsvector('english','用户偏好先给结论，少铺垫')  →  '少铺垫':2 '用户偏好先给结论':1
  …@@ plainto_tsquery('english','先给结论')        →  f
  …@@ plainto_tsquery('english','用户偏好先给结论')  →  t
  ```

- **差异**：中文内容的 tsvector 关键词腿只能命中「整段原串」，混合检索实际退化为纯向量检索，BM25 融合权重对中文是空转。记忆检索在没有 embedding 时会回退到 `ILIKE '%query%'`（`memory_service.py:808`、`:1290`），中文子串能命中；知识库没有这层回退。
- **建议**：先登记 ISSUE-196，方案另行评审，本节不预设。候选是 `pg_trgm` 或 `pg_bigm`，或在入库时做 bigram 预切分写入 `simple` 配置；须在 PG16/17/18 上核扩展可用性（见本机多版本漂移经验）。时机：下一次触及 hybrid search 的 PR。

**HM-M11 交互式上下文压缩（🔶 做 · 最高优先）**。

- **Hermes 怎么做**：
  - 50% 阈值（小于 512K 的窗口抬到 75%）触发四阶段压缩。
  - 对齐工具组、清洗孤儿对两道保险。
  - 摘要在上一版上迭代更新；压缩后重建提示并重读记忆，是会话内唯一计划内的缓存断点。
- **本仓现状**：
  - `get_session` 只在调用方传 `num_recent_events` 时截尾（`session_service.py:146-156`），而全仓没有任何调用方传这个参数。
  - 也没有启用 ADK 2.2.0 已提供的 `App(events_compaction_config=…)`（`google/adk/apps/_configs.py:50`、`apps/app.py:84`）；该配置在 2.2.0 仍标 `@experimental`（`_configs.py:49`），接入时须锁版本并跟踪 ADK 变更。
  - 交互式对话每轮都全量回放历史。
- **差异**：会话越长，每轮成本越高，最终撞窗口报错；没有任何环节保证工具调用对不被截断拆开。
- **建议**：
  - 复用 ADK 原生 `EventsCompactionConfig`，不自造压缩器。
  - 验收加一条原型 D3 同款断言：压缩后不存在孤儿 `function_response`。
  - 时机：绑定下一次交互式长会话稳定性工作，或 [013 Phase 1](./cognitive-context/013-context-layer-blueprint.md)，二者取先。

**HM-M12 隔离委派（⏸）**。`transfer_to_agent`（`agent.py:126-130`）把控制权交给子 Faculty，子 Faculty 在同一会话上下文里继续工作，而不是「新上下文执行、只回摘要」。触发条件：出现需要并行扇出子任务的场景。届时优先评估 ADK 原生的 AgentTool 形态，并照 Hermes 的子代理禁用清单来限权：禁记忆写、禁再委派、禁直接找用户。

**HM-M14 命令内容级硬拦截（⏸）**。

- **本仓现状**：
  - 主机级命令执行已经存在。`invoke_claude_code`（`claude_code.py:23`）默认给 Claude Code 开 `Bash,Read,Write,Edit,Glob,Grep`，在主机 cwd 上运行，权限由 CC 自身的 `permission_mode`（默认 auto）决定，且不在 `HIGH_RISK_TOOLS` 内。
  - 审批门本身只在 `ingest_to_corpus`、`ingest_paper` 两处接线（`ingest.py:119`、`paper.py:343`），全局 `before_tool_callback` 只做遥测。`HIGH_RISK_TOOLS` 列出的 `save_to_memory`、`execute_code`、`write_file`、`publish_content`、`send_notification` 并未调用 `should_request_approval`。
- **判定理由**：维持 ⏸，与 AN-17 的「CC 最大权限」取舍保持一致：这是既定的产品选择，不是缺口。但 AN-17 成文时的前提「没有通用 shell」已不成立，触发条件实际已满足，是否把 `invoke_claude_code` 纳入审批清单或加命令级硬拦截，需要单独决策。
- **需先修的事实层问题**：`HIGH_RISK_TOOLS` 与[用户指南](../concepts/user-guide/chat-essentials.md)（称 `always` 模式「任何工具调用前都弹审批」）都高估了审批覆盖面，已登记 ISSUE-197。

### AN 与 HM 落地建议

**AI Native**

- **做**
  - **AN-15**：下次修改 `evaluator.py` 解析逻辑时，为推断出的 verdict 加 `verdict_inferred` 审计标记，并计入「连续评估失败」。
  - **AN-12**：沿用 HZ-15 的时机，在 Context Layer Phase 2 的 ContextGuard 中纳入「调用方身份」。
- **写**
  - **AN-9**：一条 `ToolStatsDaily` 聚合查询，产出「近 30 天成功率 <50% 的能力」清单，接入巡检报告。成本约 1 个查询函数。
- **暂缓**（写明触发条件）
  - **AN-10 / AN-11**：Routine 开始安装第三方依赖、执行不可信代码，或引擎跨用户共享时。
  - **AN-13**：出现 Agent 反复猜测拒绝文本、重试同一越权操作时。
  - **AN-14 / AN-17**：Routine 被授予生产发布、配置变更类动作，或持有生产凭证时。
  - **AN-7**：知识库出现过期或冲突条目，导致 Judge 反思中出现「引用失效」时。

**Hermes**

- **做**
  1. HM-M11：交互式对话启用 ADK 原生 `EventsCompactionConfig`，验收加「无孤儿 function_response」断言。时机：下一次长会话稳定性工作或 013 Phase 1，二者取先。
  2. HM-M3：记忆写入过威胁模式表，注入块头补数据声明。时机：与 SK-M5 目录注入防护同批，先于 ISSUE-195 巩固上线。
  3. HM-M10：修中文关键词检索（ISSUE-196）。时机：下一次触及 hybrid search 的 PR。
  4. HM-M9：事件文本全文索引 + 只读会话检索工具，结果按 thread 去重。时机：ISSUE-195 方案评审同场决定，前置 HM-M10。
  5. ISSUE-197（HM-M14）：把审批覆盖面与文档对齐，要么为清单内工具补接线，要么收窄清单与用户指南的说法。时机：下一次触及 approval 的 PR。
- **写**
  - HM-M2：013 记忆层补「核心块由谁写、上限、写满策略」的设计取舍，约一段。已销账（013 §4.2，2026-09-27）。
  - 本次同批：校正 [0001 RFC](../concepts/design/0001-conversation-architecture-refactor.md) 的 Hermes 口径（见 HM 取证副产物）。
- **暂缓**
  - HM-M1：启用提供方前缀缓存时。
  - HM-M5 / HM-M8：ISSUE-194 挂载、有使用遥测、同构任务反复出现时。
  - HM-M12：需要并行扇出时。
  - HM-M14：维持「CC 最大权限」取舍；若改变该取舍，或 ISSUE-197 决定补接线，再评估命令级硬拦截。
  - HM-M16：出现消息平台接入需求时。

### HM 取证副产物

1. **HM-D1 · ISSUE-196**：中文关键词检索失效，详见 [issue.md](../.agents/issue.md)。
2. **HM-D2 · 0001 RFC 口径校正**：[`0001-conversation-architecture-refactor.md`](../concepts/design/0001-conversation-architecture-refactor.md) §1.2 表把 Hermes 的刷新语义写成「session lineage 跨 compression」。按固定提交，默认 `in_place: True` 是**同一会话 ID 原地压缩、旧行软归档**，只有旧式轮换路径才生成 `parent_session_id` 续接会话。已就地校正并注明钉点；该表「服务端去重」的结论不受影响。
3. **HM-D3 · ISSUE-197**：审批门只接线两个工具，`HIGH_RISK_TOOLS` 与用户指南高估了覆盖面，详见 [issue.md](../.agents/issue.md)。
