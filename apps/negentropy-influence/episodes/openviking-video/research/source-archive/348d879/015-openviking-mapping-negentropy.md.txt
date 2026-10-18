---
sidebar_position: 8
title: "OpenViking ↔ negentropy 机制映射报告"
description: "OpenViking（volcengine 上下文数据库，钉点 14a7b81）与本仓记忆/上下文子系统的 13 条机制映射：✅4 / 🔶5 / ⏸4——最大真增量是 M-d 会话两阶段提交对准本仓「交互式对话 → 长期记忆」断链；另附 8 处取证发现的文档/代码漂移与 AGPL 引入约束"
---

# OpenViking ↔ negentropy 机制映射报告

> 声明：只分析不改码；锚点均经 `grep -n` 实测（工作区 HEAD `a924fadd`；`ng/` = `apps/negentropy/src/negentropy/`）。材料侧证据见 [014 精读笔记](./014-openviking.md)，上游钉点 `volcengine/OpenViking@14a7b812`（2026-09-23，AGPL-3.0）。

## 结论先行

1. **对齐面比预想宽，只是形态不同**：OpenViking 用「路径 + sidecar 文件」表达的能力，本仓大多已有等价物，只是做成「Postgres 表 + JSONB 元数据」——去重合并、审计、幂等、检索轨迹、九类记忆都能找到落点。13 条映射中 ✅4 / 🔶5 / ⏸4。
2. **最大真增量在 M-d（会话两阶段提交），不在 M-a（统一 URI）**：本仓交互式对话的「会话 → 长期记忆」链路**零触发方**——`add_session_to_memory` 无任何调用方（含 ADK Runner 与 UI/BFF，本次已逐一核验），`consolidation_jobs` 只入队、无消费者。OpenViking 的「同步归档 + 异步提炼 + `.done` 水位」正好对准这个断点，且本仓 `title_inspector` 已有可复用的水位范式。
3. **M-a 不宜照搬**：`viking://` 背后是副本式文件系统（AGFS），与 [013 蓝图](./013-context-layer-blueprint.md) ADR-1「目录只 UNION 指针、不复制数据」正面冲突。可借鉴的只是**寻址格式**，不是**存储形态**。
4. **取证顺带发现 8 处本仓漂移/缺陷**（§5），其中 D2（断链）、D3（`force_refresh` 被 TypeError 静默吞掉）、D6（`_fetch_memory` 不校验用户，ISSUE-194 方案落地前的必须前置修复）优先级最高。
5. **许可证约束**：上游 2026-03-30（`ce998873`，v0.2.15 起）由 Apache-2.0 改为 **AGPL-3.0**（`crates/ov_cli`、`crates/ragfs`、`examples/` 仍为 Apache-2.0）。本仓 Apache-2.0：**不得 vendoring/改写其主体代码**；以独立进程网络调用（若引入）不触发 AGPL 传染，但任何「改造后对外提供网络服务」的场景都需法务评估。

## 映射总表

| # | OpenViking 机制（014 出处） | 本仓对应 | 锚点（实测） | 判定 |
| --- | --- | --- | --- | --- |
| 1 | M-a 统一 URI 命名空间 `viking://{resources,user,agent}`（§2） | 无路径式 URI；多维分面寻址 `app_name × user_id × memory_type × metadata`；异构资源靠 typed pointer `{type,ref}` | `ng/engine/routine/patrol_memory.py:61` · `ng/agents/tools/skill_resources.py:84` | ⏸ |
| 2 | M-b 目录级 L0/L1/L2 分层 sidecar（§3） | 四种「两级形态」：Skills L1/L2/L3、画像摘要→原文、KB parent/child chunk、KG 多 level 社区摘要 | `ng/agents/skills_injector.py:342` · `ng/engine/consolidation/memory_summarizer.py:93` · `ng/knowledge/service.py:3680` | 🔶（部分） |
| 3 | M-b 自底向上生成 + 父级按变化比例刷新（§3.3） | 画像摘要是 24h TTL（不感知源变化）；KG 摘要二值 dirty + 全量重建；会话标题已有「事件增量 ≥20 才刷新」水位范式 | `ng/engine/consolidation/memory_summarizer.py:38,95` · `ng/engine/title_inspector.py:99,191` | 🔶 |
| 4 | M-c 意图分析拆 typed query（§4.1） | 单意图分类：记忆侧 `primary+boost_types` 加权；KB 侧五意图正则路由；不拆子查询 | `ng/engine/utils/query_intent.py:54` · `ng/knowledge/retrieval/unified_search.py:28` | ⏸ |
| 5 | M-c 全局定起点 → 优先队列下钻 → 分数传播 → 收敛 → rerank（§4.2） | 无目录递归；最近等价物：KB child→parent lift（单层）、HybridPlanner 四阶段、记忆 PPR `alpha^d` 衰减 | `ng/knowledge/service.py:3692` · `ng/agents/tools/hybrid_planner.py:218` · `ng/engine/adapters/postgres/association_service.py:518` | ⏸ |
| 6 | M-d 同步归档消息（§5.1） | `append_event` 同步写 `events`（全局 `sequence_num`） | `ng/engine/adapters/postgres/session_service.py:228` · `ng/models/pulse.py:48` | ✅ |
| 7 | M-d 异步摘要 + 记忆提炼（commit 第二阶段，§5.2） | **交互式对话零触发**：`add_session_to_memory` 无调用方；`consolidation_jobs` 只入队无消费者；仅 Routine 路径有 fire-and-forget 提炼 | `ng/engine/adapters/postgres/memory_service.py:84` · `ng/db/migrations/versions/0043_memory_automation_sql_functions_static.py:104` · `ng/engine/routine/orchestrator.py:1393` | 🔶（最高优先） |
| 8 | M-d 候选去重合并（§5.3） | 全阈值/规则、无 LLM 裁决：写入期 cos≥0.85（0.80–0.85 加 Jaccard≥0.7）判重；写后 DedupMerge cos≥0.90 合并 soft-delete；事实同 key 规则化 supersede/keep_both | `ng/engine/adapters/postgres/memory_service.py:62,558` · `ng/engine/consolidation/pipeline/steps/dedup_merge_step.py:191` · `ng/engine/governance/conflict_resolver.py:134` | ✅ 主干 / ⏸ LLM 档 |
| 9 | M-d memory_diff 审计（§5.4） | 审计分三处且不覆盖自动巩固：`memory_audit_logs`（人工）、`memory_conflicts`（事实）、`metadata.merged_from`（合并） | `ng/engine/governance/memory.py:298` · `ng/engine/tools/memory_tools.py:223` | 🔶 |
| 10 | M-d `.done` 幂等水位（§5.5） | per-thread advisory lock 防并发，但**无「已巩固到第 N 条事件」水位**，重跑整段重做 LLM 提取 | `ng/engine/adapters/postgres/memory_service.py:221` · `ng/engine/title_inspector.py:191`（可复用范式） | 🔶 |
| 11 | 九类记忆类型学（§5.3 表） | 6 类 `memory_type` + 4 类 `fact_type` + `subtype=reflection` + Core Block label + Patrol tag，逐项见 014 §5.3 对照表 | `ng/engine/governance/memory.py:37,69` | ✅ |
| 12 | M-e 检索轨迹可追溯（§4.5） | 分通道齐全：`memory_retrieval_logs` 落库含每条 `search_level/score_type/raw_score/intent_boost`；KB PlannerResult 回传延迟与桥接证据链 | `ng/engine/adapters/postgres/retrieval_tracker.py:58` · `ng/memory_service.py:1411` · `ng/agents/tools/hybrid_planner.py:129` | ✅ |
| 13 | M-f experiences → Agent Evolution（§5.6） | 两端都在、无桥接：经验侧 Routine 提炼 procedural 记忆已回注；进化侧 6 个 handler 不读经验记忆 | `ng/engine/routine/memory_extractor.py:40` · `ng/engine/evolution/handlers/skill.py:120` | ⏸ |

## 逐条说明（判定理由与建议）

**#1 ⏸ 统一 URI**：`viking://` 是「把一切导入自有 AGFS」的副本式设计；013 §5.3 ADR-1 明确拒绝该形态（新表=副本=Split-Brain 引信）。**触发条件**：013 三视图/`context_catalog_unified` 落地时，把 `{item_type}:{uuid}` 定为统一指针格式——只取其寻址语法（scope 语义、确定性 ID），不取其存储。
**#2 🔶 分层披露**：本仓已有四种两级形态但无「每节点 sidecar」。值得做的只是**新鲜度**子集（#3）；逐目录 sidecar 与本仓「目录=人工 Wiki 组织」的现状不匹配，且 Skills L2/L3 实际不可达（ISSUE-194），先修激活层再谈分层。
**#3 🔶 新鲜度**：`get_or_generate_summary` 的 24h TTL 不感知源数据变化；且 SummarizeStep 传入的 `force_refresh` 因签名不符抛 TypeError 被降级吞掉（D3）——**绑定 #7 同批**：#7 落地后 summarize step 每次巩固真实执行，TTL 失真随即暴露；修法是把 TTL 换成「源水位差」判据，范式直接复用 `title_inspector.py:191`。
**#4 ⏸ typed query**：拆分收益取决于「多源统一检索」先存在。**触发**：013 §8.5 ADR-2（HybridPlanner 接 Memory 第 4 路种子）落地后，把 intent 升级为「按源 typed sub-query」。OpenViking 自己的教训（014 §4.1：priority/intent 字段不参与排序、无会话即不触发）说明这条机制的实际收益并未被验证，不必抢跑。
**#5 ⏸ 目录递归**：需要一棵「语义化的深层目录树」。本仓记忆扁平、KB 目录是人工组织、`navigation` 意图只返回 corpus 列表——现在引入递归等于先造树再检索，YAGNI。**触发**：检索评测出现「建错目录/选错 corpus」类失败占比显著，或 catalog 深度 ≥3 且 Agent 需要按目录浏览。OpenViking 的两条实测教训（014 §4.2：默认部署不触发递归；α=1.0 后层级只影响可达性不影响排序）是引入前必读的反例。
**#6 ✅ 同步归档**：`events.sequence_num` 全局序 + `append_event` 同步落库，与 Phase 1「归档是事实」等价。
**#7 🔶 会话→记忆触发（本报告最高优先）**：断链修复而非新特性。最小方案：① 复用 inspector 范式选「事件水位差 ≥Δ 且空闲 ≥T」的会话；② 入队 `consolidation_jobs`（表与部分索引已存在，迁移 0043/0044）；③ 消费者 `FOR UPDATE SKIP LOCKED` 取任务执行 `_simple_consolidate`，成功推进水位。零新表。二阶风险：每会话新增一次 embedding + LLM 提取（用 Δ、T 封顶）；单 uvicorn worker 下消费者必须是异步限流后台任务；巩固后 preload 检索到更多 episodic 行，需观察 `memory_retrieval_logs` 噪声率。
**#8 ✅/⏸ 去重合并**：主干等价且更可审计（阈值可解释）。LLM 裁决档（OpenViking 的原子写集）只值得用于**模糊带** cos 0.80–0.90。**触发**：模糊带误合并/漏合并被 retrieval 反馈证实（`outcome_feedback=irrelevant` 聚集在 `merged_from` 行）。OpenViking 的反例（014 §5.3：topic 命名漂移即产生矛盾并存、跨会话单条新文件直通不查语义）说明 LLM 裁决不是银弹。
**#9 🔶 巩固 diff 审计**：消费者把本轮 `{created_ids, merged:[{loser, primary}], superseded_facts, steps:[StepResult]}` 写入已有的 `consolidation_jobs.result` JSONB（`ng/models/internalization.py:323`），不新建表；人工审计继续走 `memory_audit_logs`，两者正交。注意 OpenViking 的教训：`memory_diff` 只写不读等同摆设——审计必须接一个消费方（UI `/memory/audit` 展示即可）。
**#10 🔶 幂等水位**：`threads.metadata` 增加 `consolidated_at_event_seq`，同构 `title_generated_at_event_seq`。OpenViking 的两条细则值得抄：水位只记「到哪了」不记「做了什么」（重跑靠内容去重兜底）；`.done` 最后写（提交点语义）。
**#11 ✅ / #12 ✅ / #13 ⏸**：类型学覆盖完整（trajectories 以日志形态存在是本仓的合理取舍）；检索轨迹分通道已比 OpenViking 落地更实（它的 `ThinkingTrace` 无生产者，014 §4.5）；经验进化闭环已按 Reflexion 方式成立，**触发**：ISSUE-194 修复后若 skill_template proposer 长期无证据不提案，再把同 skill 相关的 procedural 失败教训接为证据源。

## 013 蓝图五层对位（回写建议）

| 013 层 | OpenViking 机制印证 | 对 013 的影响 |
| --- | --- | --- |
| §4 对象层 | 九类记忆只是另一种分面 | 无新增缺口 |
| §5 目录层 | M-a 副本式 = ADR-1 的反面教材 | **强化 ADR-1**：统一指针格式随 §5.3 一并定 |
| §6 富化层 | M-d 提炼是富化层的「供给入口」 | **新增真缺口**：对话路径供给入口断开（#7），013 §6.3 未覆盖 |
| §7 治理层 | memory_diff / .done | 新增 🔶：巩固 diff 落 `result` 字段（#9）、会话水位（#10） |
| §8 激活层 | M-c 递归 / M-e 轨迹 | **校正 #9 状态行**：`013 §12.7` 的「L1/L2/L3 ✅」应改为「L1 ✅ / L2·L3 🔶（ISSUE-194）」；§8.5「自动注入通道 = `ContextAssembler.assemble()`」与事实不符（见 D1） |

## 落地建议汇总

- **做**（绑定 #7 一批，建议独立 PR，先于 013 Phase 1）：① 会话巩固触发器 + `consolidation_jobs` 消费者 + 水位（#7/#10）；② 巩固 diff 写 `result` 并接 UI（#9）；③ 修 D3 `force_refresh` 签名并改源水位判据（#3）。
- **写**（一句话成本）：④ 013 §12.7 #9 状态行校正 + §8.5 宿主更正（D1/D7）；⑤ 本报告登记进 issue.md（D2/D3/D6）。
- **暂缓**（写明触发条件）：#1（013 三视图落地时）、#4（ADR-2 统一检索后）、#5（目录深度 ≥3 且评测出现选错目录类失败）、#8-LLM 档（模糊带误判被反馈证实）、#13（ISSUE-194 修复后 proposer 仍无证据）。

## 取证副产物：本仓漂移与风险清单

| # | 类别 | 现象 | 锚点 | 影响 |
| --- | --- | --- | --- | --- |
| D1 | 文档漂移 | `ContextAssembler.assemble()` 只有单测调用；生产读取仅 `get_memory_summary()`（perception 回退） | `ng/engine/adapters/postgres/context_assembler.py:61` · `ng/agents/tools/perception.py:283` | Core Block 与 Reflection 在交互链路不注入；013 ADR-3「自动通道加 KB 接地」挂错宿主 |
| D2 | 链路断开 | `add_session_to_memory` 零调用方（本仓 + ADK Runner + UI/BFF 的 PATCH memory 路由均无）；`consolidation_jobs` 只入队 | `ng/engine/adapters/postgres/memory_service.py:84` · 025 §4.1 图注与事实不符 | 对话内容不自动沉淀长期记忆，仅靠 Agent 主动 `save_to_memory` |
| D3 | 代码缺陷 | SummarizeStep 的 `force_refresh` 抛 TypeError 被降级吞掉，强制刷新从未生效 | `ng/engine/consolidation/pipeline/steps/summarize_step.py:40` · `memory_summarizer.py:93` | 摘要最多 24h 陈旧；D2 修复后每次巩固空转一次 |
| D4 | 文档漂移 | ConflictResolver docstring 称三阶段检测（key/embedding/LLM），实现只有按 fact_type 的规则 | `ng/engine/governance/conflict_resolver.py:6` 对照 `:110` | 高估冲突检测能力 |
| D5 | 写路径分叉 | `save_to_memory` 直写 `embedding=None`：不去重、无 PII 检测、不写审计，且全仓无 embedding 回填 | `ng/agents/tools/internalization.py:72` | 这些行对 vector/hybrid 与 DedupMerge 不可见 |
| D6 | 授权风险 | `_fetch_memory` 按 UUID 读 Memory，不校验 user/app | `ng/agents/tools/skill_resources.py:167` | 当前因工具未挂载不可达；**ISSUE-194 方案 (a) 落地前必须先修**，否则成为跨用户读取通道 |
| D7 | 状态表失真 | 013 §12.7 #9「L1/L2/L3 ✅」与 ISSUE-194 结论矛盾 | `docs/research/cognitive-context/013-context-layer-blueprint.md:436` | 待回写 |
| D8 | 部分接线 | memory_pipeline_prompt 进化面只有 fact extractor 读取；summarizer/reflection 仍用硬编码 prompt | `ng/engine/evolution/weights.py:91` | 这两个 scope 的晋升在运行时是 no-op |

## 交叉引用

- [OpenViking 精读笔记](./014-openviking.md)（机制载荷与证据分级）· [Context Layer 蓝图](./013-context-layer-blueprint.md)（五层 SSOT）· [Horizon ↔ negentropy 映射](./012-horizon-context-mapping-negentropy.md)（同为「材料机制 ↔ 本仓」先例）
- ISSUE-194（expand_skill 未挂载）见 [issue.md](../../.agents/issue.md)；本报告 D1–D8 已按精读流程登记为 ISSUE-195。
