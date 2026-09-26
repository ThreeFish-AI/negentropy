---
sidebar_position: 7
---

# Jev（TypeSafe System One Model）↔ negentropy 机制映射报告

> 声明：只分析不改码；锚点均经实际代码核验（核验日 2026-09-26，HEAD `95f5a532e`）。锚点路径仓库相对 `apps/negentropy/src/negentropy/`，写法 `文件:行号`。

## 结论先行

本仓已实现的有三样：**编排级**的快慢分工（四阶段检索级联、失败降级链）、确定性决策守卫对 LLM 读数的封顶与旁路开关，以及一处孤例式的「弃权」解析姿势（evolution proposer）。材料的真增量不在「接入一个更便宜的判断模型」，而在四条可直接落地的纪律：

1. 闭合输出空间的弃权语义：解析失败应显式弃权而非注入默认合法值（proposer 的 `None` 弃权 vs evaluator 的静默 0 分是本仓内部现成对照）。
2. 失败可观测性：矫正与兜底要有 counter，不是零日志（两个 judge 解析器矫正时一行日志都没有）。
3. 置信默认值的方向：缺 confidence 默认 1.0 叠加 0.5 阈值等于自动通过，方向反了。
4. 口头 confidence 不可比：启发式常数置信与 LLM 口头置信同列存储、同样被消费，量纲不同。

16 条映射中：5 条 ✅ 已对齐、9 条 🔶 值得落地（多数是「写」级一句话成本或绑明确时机的 counter）、2 条 ⏸ 暂缓（触发条件见文末）。接入 Jev 本体一类建议一律暂缓：官方对中文可用性零量化，且本仓尚无任何校准验证数据可支撑阈值搬家。

## 映射总表

| # | 材料机制（出处） | 本仓对应 | 锚点 | 判定 |
|---|---|---|---|---|
| 1 | M1 三原语把答案空间钉死在 criteria 内（§M1，规律 1） | 13 处 LLM 调用全部「prompt 散文枚举 + `response_format=json_object`」，零严格 schema | engine/routine/evaluator.py:514、knowledge/graph/extractors.py:885 等 13 处 | 🔶 |
| 2 | M1 弃权语义：解析失败 ≠ 默认合法值 | proposer 解析失败/越界失控/`no_change` → `None` 弃权 + warn（「宁可不提不乱提」） | engine/evolution/proposer.py:9,218-257 | ✅ |
| 3 | M1 越界事后矫正须可观测 | judge 族解析矫正全静默：垃圾 JSON → score=0 + verdict 兜底，零日志零计数；FacultyBridge 非空文本直接当命中 | engine/routine/evaluator.py:508-563、engine/routine/plan_reviewer.py:195-206,238-255 | 🔶 |
| 4 | M1 选择题只认选项原文 | `_auto_answer_question` 非 JSON 时**原样返回 content 作答案**，自由文本冒充闭合选项 | engine/claude_code/service.py:1192,1199,1248 | 🔶 |
| 5 | M1 枚举层闭合的兜底姿势 | KG 严格 `json.loads` 失败 → warn + `[]`（chunk 静默零实体）vs entity_normalization 的 raise → 重试 → degraded 标记 | knowledge/graph/extractors.py:929-932、engine/consolidation/pipeline/steps/entity_normalization_step.py:71-77,131-140 | 🔶 |
| 6 | M2 共享一次读、多问一次调用 | evaluator 单合并 prompt 同答 4-5 问（acceptance/score/verdict/reflection），锚定规则显式声明 | engine/routine/evaluator.py:58-88,121-127 | ✅ |
| 7 | M2 题与题隔离、互不可见 | plan_reviewer N 个模块评审 + 总评 + 分数一次调用，模块间互相污染 | engine/routine/plan_reviewer.py:96-109 | 🔶 |
| 8 | M2 共享前缀把多问变便宜（12.2×） | map-reduce 每社区独立调用；全仓无 `cache_control`/prompt caching（仅进化 prompt 文本 TTL） | knowledge/graph/global_search.py:183-209、engine/evolution/weights.py:88-104 | ⏸ |
| 9 | M3 概率可对账、confidence 是派生读数 | KG 抽取 confidence 缺省 **1.0 且不 clamp**，下游 `metadata.get("confidence", 1.0) >= 0.5` 过滤 → 缺失自动通过 | knowledge/graph/extractors.py:972、knowledge/graph/service.py:725-726、knowledge/types.py:784 | 🔶 |
| 10 | M3 读数只是统计，量纲须可比 | LLM 口头置信（fact 0.7 缺省 / KG 1.0 缺省）与启发式常数置信（0.3-0.85）同列存储、被 avg 与门控同样消费 | engine/consolidation/llm_fact_extractor.py:249-252、engine/utils/query_intent.py:54-95、knowledge/graph/quality.py:157-163 | 🔶 |
| 11 | M3 阈值是校准曲线上的索引 | 量纲错配已文档化并以 `accept_verdict_pass` 缓解；引擎侧对 judge 输出做确定性封顶 | engine/routine/decision.py:118-123,148、engine/routine/evaluator.py:287-297、models/routine.py:110 | ✅ |
| 12 | M4 收益在编排不在模型 | 检索级联 cheap-first：混合检索 → 图扩展 → RRF → cross-encoder 重排；rerank 失败降级原序 | agents/tools/hybrid_planner.py:1-8,766、knowledge/retrieval/reranking.py:32-34,158-163,290 | ✅ |
| 13 | M4 按任务选判断模型 | 按任务静态选模型档（「高风险用更强模型」），非运行时置信分流；3 个在用 task key 未注册、静默落全局默认 | config/routine.py:137-140,185-188,209-212、engine/claude_code/service.py:1053、config/model_resolver.py:37,1097 | 🔶 |
| 14 | M4 廉价先行、昂贵兜底 | FacultyBridge **贵先**：全 ADK agent 优先、失败降级 litellm 直连，仅 contextvar 预算封顶 | engine/routine/faculty_bridge.py:59-78、engine/routine/evaluator.py:486-498 | ⏸ |
| 15 | M4 门槛随风险伸缩 | HITL 静态 `HIGH_RISK_TOOLS` 列表 + plan review 轮次封顶后强制放行（fail-open 已注释文档化，下游 gate+judge 兜底） | agents/approval.py:46-61、engine/routine/plan_review_hook.py:154-170,196 | ✅ |
| 16 | M4 失败要有预算 | `eval_failure_patience=3` 只覆盖基础设施失败；垃圾输出（score=0）零预算且计入 eval 均值/通过率 | config/routine.py:85-88、engine/routine/orchestrator.py:845、engine/eval/runner.py:990-997 | 🔶 |

## 逐条说明

**1｜🔶 枚举只活在 prompt 散文里。** 材料 M1 用 Choice/Score/Noul 三原语把答案空间钉死，规律 1 点破 JSON schema 只管格式不管枚举。本仓 13 处 LLM 调用（`grep` 实测计数，分布于 engine/knowledge 共 12 个文件）全部是「枚举写进 prompt 散文 + `response_format={"type":"json_object"}`」。也就是说，只有词法层约束、没有枚举层约束，也没有任何受约束解码。差异是结构性的；但材料自己也承认枚举层闭合需要专用判断模型，通用 LLM 场景下的替代品只有「解析纪律」。建议按「写」级落地：把这一既定姿势与新调用最低三件套（loads_lenient + 字段校验 + 矫正日志）写进一处权威注释。

**2｜✅ proposer 是全仓唯一正确姿势的孤例。** 材料的弃权语义是「解析失败宁可不作答」；proposer 对非 dict、`no_change`、非法权重、越界失控四种失败一律 `return None` 并记 warn（proposer.py:222,226,234,245），模块头注明「宁可不提不乱提」。它还强制 `keyword = round(1.0 - semantic, 4)` 重算（:249），不信任模型的伴生输出。这是本仓离材料 M1 最近的一处。它的价值在于证明该姿势在本仓工程成本上完全可负担，问题只是没有推广。

**3｜🔶 judge 族矫正零观测。** 材料 M1 承诺「答案不可能越界」的同时，要求越界之外的错可被看见；本仓正好相反。`evaluator._parse` 里 `data.get("score", 0)` 把缺失/垃圾 score 静默变 0（evaluator.py:548-552）。verdict 越界按分数兜底成 progressing/stalled（:558），整个 `_parse` 没有一行 logger（实测 `grep -c logger` 为 0）；plan_reviewer 同款（plan_reviewer.py:238-255，亦零日志）。重试环只看传输异常（:508-534），垃圾 JSON 不触发重试、变 score=0+stalled 直接落库。更隐蔽的是 FacultyBridge。faculty 返回非空但不可解析的文本，会被 `loads_lenient → {}` 洗成 score=0 并当命中返回、不回退 litellm（evaluator.py:486-498、plan_reviewer.py:195-206）。对照同文件 auto-answer 路径有键存在检查（claude_code/service.py:1218-1219）。差异核心：解析失败被伪装成「低分真实判断」。建议绑 evaluator/plan_reviewer 下次触碰时加矫正 counter 与一条 warn。

**4｜🔶 自由文本冒充选项答案。** 材料 M1 的 Choice 要求答案只能是选项之一。`_auto_answer_question` 在 prompt 里两处强调「必须是选项之一的 label 原文」（claude_code/service.py:1192,1199），但解析失败时 `return content`（:1248）把模型原样输出直接回传给 CC 的 AskUserQuestion。约束只存在于 prompt，兜底路径恰好把约束击穿。仅传输异常才走 `_FALLBACK_ANSWER`（:1254,1255）。差异：闭合选项的失败语义应是「落回中性默认」而非「放行任意文本」。建议该模块下次触碰时把非 JSON 分支改走 fallback。

**5｜🔶 同一问题两种姿势并存。** KG 实体抽取用严格 `json.loads`，失败 warn 后 `return []`（extractors.py:929-932）。该 chunk 的静默零实体没有任何 counter，下游不可区分「无实体」与「解析失败」。而 entity_normalization_step 的注释直接点破：`loads_lenient` 返回 `{}` 会「把脏输出伪装成空实体成功」。因此它先校验 `entities` 键、失败 raise 触发重试、最终标 `degraded`（entity_normalization_step.py:131-140，degraded 标记 :71-77）。这说明本仓已在局部识别此问题并给出正解，只是两处姿势相反。建议以 entity_normalization 的「校验-重试-降级标记」为范本，KG 侧补一个 parse-failure counter。

**6｜✅ 合并 prompt 是共享读的正例。** 材料 M2 的「state 读一遍、多问合一」在本仓 evaluator 已是事实标准。一个 prompt 同答 acceptance_met/score/verdict/reflection（锚定版再加 progress_evidence），1 次调用（evaluator.py:58-88）。且锚定规则把「证据先于给分」「分数与轨迹相容」写成显式条款（:121-127），这与材料用 criteria 锚定答案空间的思路同构。这是本仓与材料在「便宜的多问」上成本结构最近的一条。

**7｜🔶 plan_reviewer 的互相污染。** 材料用「题与题互不可见」换隔离；plan_reviewer 反其道，N 个模块评审 + 总 verdict + 分数一次调用（plan_reviewer.py:96-109），总评分数会被前面模块的措辞情绪污染，模块间也无隔离。差异：本仓只有「合并省钱」没有「隔离防污染」的另一半。建议「写」级：在该 prompt 处注明已知污染、模块结论以 status 而非总分定夺（现状已部分如此），暂不拆调用。

**8｜⏸ 前缀缓存零利用。** 材料 M2 的 12.2× 便宜一半来自「输入计一次、输出免费」的计费形状与共享前缀。本仓 `grep cache_control/prompt_cach/cached_tokens` 全仓零命中（仅进化 prompt 文本 TTL 缓存，weights.py:88-104，与推理侧缓存无关）。judge prompt 前缀（角色设定 + 评审要求）跨迭代高度稳定，是天然的缓存候选。暂缓理由：无 LLM 成本占比数据支撑优先级，且 litellm 跨 provider 的缓存开关行为不一。

**9｜🔶 置信缺省方向反了。** 材料 M3 的 confidence 是分布形状的派生读数、缺省即低集中度。本仓 KG 链路是 `confidence=float(entity_data.get("confidence", 1.0))`（extractors.py:972，无 clamp 无范围检查）。下游过滤 `e.metadata.get("confidence", 1.0) >= min_conf`，且 `min_entity_confidence` 默认 0.5（service.py:725-726、types.py:784）。结果是字段缺失时自动以满置信通过门槛。同向例证还有 `acceptance_met` 非 bool → `None` → 不施加封顶（evaluator.py:563,287-297）：安全信号缺失时选择宽容。对照 fact extractor 缺省 0.7 至少落在中间。建议绑 KG 抽取链下次触碰时改缺省为显式低值或标记 missing。

**10｜🔶 两种量纲同库同列。** 材料规律 3 强调「读数只是统计」，其前提是量纲统一。本仓同一 `confidence` 列里同时存在三种来源：LLM 口头置信（fact 0.7 缺省、KG 1.0 缺省）、正则兜底常数（strategy.py:199,217 的 0.5/0.6，0.5 恰在阈值上）与手定启发式常数（query_intent.py:54-95 的 0.3-0.7、action_intent.py:77-103 的 0.3-0.85）。消费端不分来源：quality.py:157-163 对全列做 avg 当语料质量指标，agent.py:31,99-103 用 0.7 门控翻转 ingest 路由。差异：材料的 confidence 有固定派生公式保证可比，本仓的常数们没有任何对账基准。建议「写」级：在字段语义处注明三种来源不可比，聚合须分组。

**11｜✅ 量纲错配的自觉。** 材料 M3 说阈值是校准曲线的索引。本仓 decision.py:118-123 把 `success_score_threshold=100` 与 judge「全部满足≈90-100」的结构性失配写成文档，并以 `accept_verdict_pass` 显式 opt-in 旁路（:148）；巡检任务阈值 99/100 正是这个错配的产物。引擎侧还有确定性封顶：`acceptance_met=False` 时 cap score 且 pass 纠正为 progressing（evaluator.py:287-297），即代码不信任 judge 的自洽性。这与材料「代码拥有控制流、模型只交读数」的分工一致。

**12｜✅ 编排收益已在。** 材料 M4/规律 5 的核心是「同一模型放进 workflow 更准更快更便宜」。本仓检索栈是教科书式 cheap-first 级联：意图正则 → 多路 hybrid → 图扩展 → RRF 融合 → cross-encoder 重排（hybrid_planner.py:1-8）。reranker 推理失败回退原序（reranking.py:158-163），CompositeReranker 按 Cohere → 本地 BGE → Noop 降级（:290）。升级靠流水线位置而非分数门控，且 `score_threshold=0.0`（reranking.py:32-34、hybrid_planner.py:766）使重排退化为纯排序。这与材料的置信门控不同，但在「廉价先行」的骨架上已经对齐（threshold 语义另记一笔即可）。

**13｜🔶 静态模型档与幽灵 task key。** 材料 M4 按风险分档用模型；本仓以静态配置实现同一目标（evaluator/plan_review/auto_answer 三档，config/routine.py:137-140,185-188,209-212，evaluator.py:152-153 注明高风险用更强模型的动机），这是合理近似。缺口在治理：`routine.auto_answer`（service.py:1053）、`routine.memory_extract`（memory_extractor.py:37）、`eval.execute`（runner.py:172,217）在用但未注册进 `ALL_TASKS`（task_registry.py:58-178）。`is_valid_task_key` 仅在 API 写入时执法（interface/task_models_api.py:150,198,317），resolver 静默落全局默认 `openai/gpt-5-nano`（model_resolver.py:37），唯一信号是 `task_model_resolved` 日志的 "default" 标签（:1097）。运行时置信分流则暂缓（见 #14 与文末）。建议绑 task_registry 下次加槽时补注册或前移校验。

**14｜⏸ 贵先的反向级联。** 材料的级联是便宜模型先行、按读数升级。FacultyBridge 是全 ADK agent（贵）先行、失败降级 litellm 直连，成本失控仅靠 contextvar 预算封顶（faculty_bridge.py:59-78）。方向相反但动机明确：bridge 买的是 faculty 的内化质量而非省钱，且失败路径有日志。暂缓理由：仓内没有 faculty vs 直连的输出质量/成本 A/B 数据，「贵先是否反模式」无法裁决。

**15｜✅ 风险分级的工程近似。** 材料 M4 让门槛随风险伸缩。本仓 HITL 用静态 `HIGH_RISK_TOOLS` 按副作用类别分级（写库/执行/外发，approval.py:46-61），加 allow/block 列表（:122-125），粒度粗但方向一致。plan review 达 5 轮上限后强制放行（plan_review_hook.py:154-170），judge 不可用时 fail-open（:196），在材料视角都是「门槛归零」。但两处都有显式注释说明权衡（放行后仍有 gate+judge+审批兜底、死锁代价更高），是文档化的自觉选择而非疏漏。

**16｜🔶 垃圾输出没有预算。** 材料 M4 给每类失败设预算与门槛；本仓 `eval_failure_patience=3` 只数「评估器抛异常」（config/routine.py:85-88、orchestrator.py:845）——基础设施失败有预算，解析垃圾（不抛异常的 score=0）零预算且照常推进决策。离线 eval 更进一步：judge 不可用时 `score=0.0` 计入均值与通过率（runner.py:990-997），`DEFAULT_PASS_THRESHOLD=70.0`（:55）下真实 0 分与垃圾 0 分不可区分。这与 #3 是同一建议的两面：先有 counter，才谈得上预算。

## 落地建议汇总

**做**（绑明确时机）：
- 给 judge 族解析器（`evaluator._parse` / `plan_reviewer._parse` / FacultyBridge 消费点）加「矫正发生」counter 与一条 warn。绑 evaluator 或 plan_reviewer 下次触碰（锚定/阈值调整）时；counter 落 metrics，使垃圾 0 分可与真实 0 分区分（#3、#16）。
- 修 KG 置信缺省方向：`extractors.py:972` 与 `service.py:725-726` 的 `metadata.get("confidence", 1.0)` 缺省改显式低值或 missing 标记。绑 knowledge/graph 抽取链下次触碰时；注意存量实体无该字段的回填影响（#9）。
- `_auto_answer_question` 解析失败分支改走 `_FALLBACK_ANSWER`，绑 claude_code service 下次触碰（#4）。
- 补注册或前移校验在用未注册的 task key，绑 task_registry 下次加槽时（#13）。

**写**（一句话成本）：
- 在 task_registry 或 ADR 写明「枚举只存在于 prompt 散文 + 事后矫正」是全仓既定姿势（含 13 处清单），新 judge 类调用至少沿用 loads_lenient + 字段校验 + 矫正日志三件套（#1）。
- 在 confidence 字段语义处写一句：LLM 口头置信 / 正则常数 / 启发式常数三种来源不可比，聚合须分组（#10）。
- plan_reviewer prompt 处注明模块互评污染已知、以 status 为准（#7）；rerank `score_threshold=0` 的「纯排序」语义注一笔（#12）。

**暂缓**（写明 YAGNI 触发条件）：
- prompt 前缀缓存：触发条件 = LLM 成本可观测且 judge/抽取前缀占比显著（#8）。
- 运行时置信分流（按读数升降模型档）：触发条件 = 本域有校准验证的置信信号。材料规律 4 表明曲线一换阈值即作废，本仓无任何校准数据（#13）。
- FacultyBridge 改 cheap-first：触发条件 = faculty 与直连的输出质量/成本 A/B 数据（#14）。
- 接入 Jev 本体或增设 judge/rerank 类决策模型槽位：触发条件 = 官方给出中文量化，或可自托管复刻且经本仓数据校准验证（材料批判边界 5：中文可用性零量化；`TaskModelType` 现无此槽位）。
- 严格 JSON-schema / 受约束解码：触发条件 = 矫正 counter 显示某链路脏输出率高到值得工程化（#1 的升级路径）。

## 交叉引用

- 材料机制定义与证据链：[200-jev-system-one-model.md](./200-jev-system-one-model.md) 的 §M1（闭合输出空间，§3）、§M2（共享 state 与隔离，§4）、§M3（校准概率，§5）、§M4（快慢分工，§6）及规律 1-5、争议 3（校准的领地）各节（§7）。
- 落地建议中「做」档四项建议将在 [issue.md](../../.agents/issue.md) 登记条目，并回链本报告（锚点以本文「文件：行号」为准）。
