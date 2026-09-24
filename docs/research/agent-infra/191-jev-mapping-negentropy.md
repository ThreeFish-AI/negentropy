---
sidebar_position: 7
title: "Jev ↔ negentropy 机制映射报告"
description: "Jev（TypeSafe System One Model，jev-1.13.0）与本仓 LLM 结构化决策点的 16 条机制映射：✅4 / 🔶6 / ⏸6——最大真增量不是接入模型，而是「闭合输出空间」纪律：Claude Code 自动作答不校验答案是否属于选项、Judge 与 PlanReviewer 解析失败静默降为 0 分、global_search 的「无相关信息」哨兵漏入 reduce；直接接入 Jev 暂缓（CJK 较弱、闭源、模型类型体系无位）；另附 7 处取证漂移"
---

# Jev ↔ negentropy 机制映射报告

> 声明：只分析不改码；锚点均经 `grep -n` 实测（工作区 HEAD `2edf3ed5`；`ng/` = `apps/negentropy/src/negentropy/`）。材料侧证据见 [190 精读笔记](./190-jev-system-one-model.md)，机制编号 M1–M4 与笔记一致：M1 闭合输出空间 / M2 一次编码·分支隔离 / M3 校准概率 / M4 快慢分工编排。

## 结论先行

1. **本仓没有一处决策是「System One 形」的**：全仓 `*.py` 零 `logprobs`、零 strict `json_schema`，没有任何 Agent 设置 `output_schema=`。13 处 `response_format={"type": "json_object"}` 调用中，10 处经 `loads_lenient` 宽松解析，解析失败返回 `{}`，调用方静默填默认值；另 3 处用 strict `json.loads`。16 条映射：✅4 / 🔶6 / ⏸6。
2. **最大真增量是纪律，不是模型**：Jev 最可迁移的一课是 M1——**答案空间先定、越界即拒**。它在本仓对应三个具体缺口，改动都很小：
   - Claude Code 自动作答的 prompt 写着「回答必须是选项之一」，代码却从不校验，非 `answers` 格式直接原样返回。
   - Judge 与 PlanReviewer 把「解析失败」和「模型真打了 0 分」混为一谈：前者得 `stalled`，后者得 `refine`。
   - `global_search` 的 map 阶段让模型说「无相关信息」，过滤器却只丢空串，哨兵因此进入 reduce。
3. **直接接入 Jev 暂缓（⏸）**，理由有三条：
   - 官方自认中文与其他 CJK 语言效果较差，而本仓内容以中文为主。
   - 闭源，且不提供客户专属权重。
   - 本仓模型类型只有 `llm` / `embedding` / `rerank`，task slot 只接受 `llm` / `embedding`。

   触发条件：出现**可自托管、且中文校准经本仓数据验证**的决策模型。候选是 Kev（Qwen 底座）与 Laya（多语言版）。
4. **校准的教训适用于现有 Judge**：本仓 Judge 输出单点分数，已知逐轮 ±20 振荡（ISSUE-128 / ISSUE-152）。Jev 的 M3/M4 说明，**点分数不能直接当自动执行阈值用**。落地方向是分布化或重复评分，不是换模型。
5. **取证副产物 7 处漂移**（§5），包括：
   - 3 个未注册的 task key 静默回落到默认模型，管理端也无法为它们绑定模型。
   - `auto_answer_model` / `auto_answer_timeout_seconds` 是死配置。
   - `global_search` 的 docstring 承诺置信度，实际未实现。

## 映射总表

| # | 材料机制（190 出处） | 本仓对应 | 锚点（实测） | 判定 |
| --- | --- | --- | --- | --- |
| 1 | M1 闭合输出空间：答案只能是 criteria 之一（§3） | Claude Code 自动作答：prompt 要求「必须从选项中选择」，代码不校验成员，非 `answers` 格式原样返回 | `ng/engine/claude_code/service.py:1192,1199` · `:1246-1248` · `:1255` | 🔶 做 · 最高优先 |
| 2 | M1 类型错误由构造消灭（§3） | Judge / PlanReviewer：`{}` → score 0 → `stalled` / `refine`；坏 verdict 由分数猜 | `ng/engine/routine/evaluator.py:546-558` · `ng/engine/routine/plan_reviewer.py:237-255` · `ng/engine/utils/json_extract.py:38-60` | 🔶 做 |
| 3 | M1 × 官方 adapter「校验失败即带错纠正重试 + 概率归一」（§3） | 10 处 `loads_lenient`、3 处 strict `json.loads`，全仓无 strict schema / 枚举约束 | `ng/engine/utils/json_extract.py:43-44` · `ng/knowledge/ingestion/extraction.py:1859-1868` · `ng/knowledge/graph/extractors.py:929` | 🔶 写 |
| 4 | M2 一次调用答多题（§4） | Judge 一次调用同时返回 `acceptance_met` / `score` / `verdict` / 反思 | `ng/engine/routine/evaluator.py:510-517,539-567` | ✅ |
| 5 | M2 隔离的代价：跨问题无不变量，须由编排补（§4） | 代码层不变量：验收未达成绝不判 pass（封顶，ISSUE-116） | `ng/engine/routine/evaluator.py:287-297` | ✅ |
| 6 | M3 概率可当错误率读（§5） | Judge 单点分数、无概率；逐轮 ±20 振荡由锚定 prompt（ISSUE-152）、容差带（ISSUE-128）、封顶（ISSUE-116）三处修补 | `ng/engine/routine/evaluator.py:548` · `ng/engine/routine/decision.py:147-150` · `docs/.agents/issue.md` ISSUE-128/152 | 🔶 写 |
| 7 | M3 阈值须落在噪声带之外（§5） | 进化门 `SKILL_GATE_VISIBLE_GAIN_MIN=2.0`、`SKILL_CASE_REGRESSION_DELTA=5.0`，比较的是多 case（≥5）均值，每 case 仅单次评分 | `ng/engine/evolution/decision.py:273,276` · `:317-339` | ⏸ |
| 8 | M3 confidence 必须有频率语义（§5） | 让 LLM 自报 0.5–1.0 confidence 并用于破平 / 过滤 | `ng/engine/consolidation/llm_fact_extractor.py:54,249` · `ng/engine/governance/conflict_resolver.py:140` · `ng/knowledge/graph/service.py:725-726` | 🔶 写 |
| 9 | M3 × 硬编码置信（§5） | 正则意图分类器写死 0.85/0.7/0.4/0.3，并以 τ=0.7 / 0.55 做门 | `ng/engine/utils/action_intent.py:77-103` · `ng/agents/agent.py:98-103` · `ng/engine/utils/query_intent.py:54-95` | ⏸ |
| 10 | M4 阈值三档：执行 / 升级 / 人工（§6） | PlanReviewer fail-open 放行、`max_refines` 上限强制批准；自动作答有固定兜底答案 | `ng/engine/routine/plan_review_hook.py:155-170,195-204` · `ng/engine/claude_code/service.py:1255` | ✅（结构）/ ⏸（置信触发） |
| 11 | M4 快慢分工：窄判断走快路径（§6） | FacultyBridge 把决策路由给完整 ADK agent（方向相反），默认关 | `ng/engine/routine/faculty_bridge.py:125,162` · `ng/config/routine.py:322-323` | ⏸ |
| 12 | System One 形空位：边界带是非判断（§6） | 实体消歧第 4 阶段 LLM 校验未实现；0.75–0.88 送人工复核队列 | `ng/knowledge/graph/entity_resolver.py:202,476` · `ng/knowledge/graph/canonical_linker.py:69-72` | ⏸ |
| 13 | System One 形空位：去重模糊带（§6） | 记忆写入 cos 0.80–0.85 再比 Jaccard ≥0.7（0.80 为硬编码字面量） | `ng/engine/adapters/postgres/memory_service.py:62-63,558-591` | ⏸ |
| 14 | M2 map-reduce 上的逐块相关性判定（§4） | `global_search` map 阶段让模型说「无相关信息」，过滤只丢空串 ⇒ 哨兵进入 reduce | `ng/knowledge/graph/global_search.py:51` · `:200-201` · `:431-435` | 🔶 做 |
| 15 | 接入 Jev 类决策模型（§1） | 模型类型枚举仅 LLM / EMBEDDING / RERANK；task slot 只允许 llm / embedding | `ng/models/model_config.py:18-23` · `ng/config/task_registry.py:28` | ⏸ |
| 16 | 最近邻同构：不生成、只打分（Tier 3） | LocalReranker（bge-reranker-v2-m3 cross-encoder）一次前向对 (query, doc) 打分，分数未校准 | `ng/knowledge/retrieval/reranking.py:84,159` · `ng/agents/tools/hybrid_planner.py:684,741-763` | ✅ |

> 计数口径：每行只计主判定（#10 为分裂判定「✅（结构）/ ⏸（置信触发）」，计入 ✅），故 ✅4 + 🔶6 + ⏸6 = 16。

## 逐条说明

### #1 自动作答不校验选项成员（🔶 做 · 最高优先）

- **材料怎么做**：Choice 的答案由构造保证属于 `criteria`，越界根本无法输出。官方 adapter 让 LLM 作答时，也先按逐请求 schema 校验，失败则带错误信息纠正重试（190 §3）。
- **本仓现状**：
  - `_auto_answer_question` 的 prompt 两次强调「必须从选项中选择」「回答必须是选项之一」（`service.py:1192,1199`）。
  - 返回时却直接 `"\n".join(str(a) for a in parsed["answers"])`（`:1246-1248`）；非 `answers` 格式的回复按 `return content` 原样返回（`:1248` 注释「非 answers 格式也返回纯文本」）。
  - 失败走固定兜底答案（`:1255`）。
- **差异**：模型写出「选项 A（推荐）」这类变体标签，会被当成合法答案写回 Claude Code 的 stdin。这正是 190 原型 B2 复现的「标签漂移越界」。
- **建议**：在返回前做成员校验，只接受与选项标签精确匹配（或归一化后精确匹配）的答案；不匹配则纠正重试一次，仍失败就走 `:1255` 兜底。改动约十几行。时机：下一次触及 `claude_code/service.py` 时顺手做，或单独起小 PR。

### #2 解析失败 ≠ 0 分（🔶 做）

- **材料怎么做**：错误形态在类型层面就不可能出现；LLM 基线里，adapter 把解析 / 校验失败作为显式错误处理（纠正重试），而不是填默认值。
- **本仓现状**：
  - Judge 的 `_parse` 先 `loads_lenient` 得到 `{}`，再 `raw_score = data.get("score", 0)`（`evaluator.py:546-548`），坏 verdict 按分数回退为 `progressing` / `stalled`（`:556-558`）。
  - PlanReviewer 同理：`{}` → score 0 → `refine`（`plan_reviewer.py:237,248`）。
  - 需要补充的细节：只有当模型返回**合法但非对象**的 JSON（如 list）时，`data.get` 抛 `AttributeError`，被 `_judge` 的 `except Exception` 捕获后退避重试（`evaluator.py:531-534`）；全部重试失败时，`evaluate` 返回 `ok=False`，计入 `eval_failure_patience`。真正**静默**的是「解析成空对象」这一支。
- **差异**：「模型打了 0 分」与「模型输出被截断」在下游看起来完全一样，都会推动 routine 走向 `stalled`。
- **建议**：`_parse` 在 `data == {}` 时返回显式的解析失败信号，交给现有重试环处理，而不是合成 0 分。改动小，建议与 #1 同一个 PR。

### #3 全仓结构化输出纪律（🔶 写）

- **本仓现状**：10 处 `loads_lenient` 与 3 处 strict `json.loads` 各自处理失败，没有统一约定。
  - 宽松侧：`json_extract.py:43-44` 的默认值是 `{}`。
  - 严格侧：`extraction.py:1859-1868` 失败返回 None，`extractors.py:929` 失败返回 `[]`。
- **建议**：写一页约定，内容分三点：
  - 什么决策必须闭合（枚举、分数、布尔），什么可以宽松（摘要、反思文本）。
  - 失败信号必须显式。
  - 枚举字段要校验成员。

  成本约半小时，放在 [Development](../../concepts/operations/development.md) 或 LLM 调用规范处。

### #4 / #5 一次多答与代码层不变量（✅）

- Judge 一次调用返回多个字段（`evaluator.py:510-517`），对应 M2 的「读一次、答多题」。
- 差别在于：本仓的多字段是**联合生成**，字段之间互相可见，恰好规避了 Jev「跨问题无不变量」的副作用，代价是串行生成。
- 同时，`evaluator.py:287-297`「验收未达成绝不判 pass」是一道由代码补上的不变量。这正是 190 §4 给出的编排解：互斥或蕴含约束交给代码或单个 Choice 保证，不指望判读器自觉。

### #6 / #7 点分数与阈值（🔶 写 / ⏸）

- **材料怎么做**：Jev 把「是否自动执行」建立在校准概率之上；第三方实测显示，一旦离开分布，概率也不再可信（190 §5）。
- **本仓现状**：
  - Judge 输出单点 0–100 分，`decide()` 按 `score >= threshold` 判成功（`decision.py:147-150`）。
  - 已知逐轮 ±20 振荡由三个 issue 分别修补：锚定 prompt 是 ISSUE-152，容差带是 ISSUE-128，封顶（`evaluator.py:287-297`）是 ISSUE-116。
  - 进化门的 2.0 / 5.0 分边距（`evolution/decision.py:273,276`）比较的是多 case 均值。
- **口径限定**：±20 是单个巡检 routine 的逐轮分。「门槛边距落在 Judge 噪声带内」是推断，需要对同一技能的 case 均值做重复评分才能坐实。
- **建议**：
  - #6 写一页「点分数不可直接当阈值」的设计备忘：同一输出重复评分 N 次，取中位数和四分位距，`decide()` 只在区间整体越线时判成功。
  - #7 暂缓。触发条件：进化 Phase 3 落地重复评分，或出现一次门槛误判的复盘。

### #8 / #9 自报与硬编码置信（🔶 写 / ⏸）

- **本仓现状**：
  - `llm_fact_extractor.py:54` 让模型「Assign confidence between 0.5 and 1.0」，缺省 0.7（`:249`）。该值用于 ConflictResolver 破平（`conflict_resolver.py:140`）与 KG 最低置信过滤（`graph/service.py:725-726`）。
  - 正则意图分类器写死 0.85 / 0.7 / 0.4 / 0.3（`action_intent.py:77-103`），并以 τ=0.7 做门（`agent.py:98-103`）。
- **差异**：两者都叫 confidence，但都没有频率语义。190 §5 的原型实测显示：未校准时直投决策自称错误率 0.7%，实际是 12%。
- **建议**：
  - #8 在字段注释与文档里标明「未校准启发式，仅作相对排序，不作绝对阈值」，成本一句话。
  - #9 暂缓。触发条件：意图分类误路由成为可观测问题。

### #10 / #11 分流结构（✅ 结构 / ⏸）

- **已有的分流结构**：PlanReviewer 已有「失败放行」与「`max_refines` 上限强制批准」（`plan_review_hook.py:155-170,195-204`），自动作答已有固定兜底（`service.py:1255`），即已具备「兜底去向」。
- **差别**：触发条件是**失败**或**次数**，而不是**置信度**。
- **FacultyBridge**：它把决策交给完整 ADK agent（`faculty_bridge.py:125,162`），是 System 2 化，与 M4 方向相反。默认关（`config/routine.py:322-323`），暂缓。

### #12 / #13 / #14 System One 形空位

- **#12**：`entity_resolver.py:202` 文档化的第 4 阶段 LLM 校验不存在（`:476`「边界区域暂不合并（LLM 验证留给后续迭代）」），`_borderline_high` 设置后从未被读取。这是一道标准的 Noul 题（「这两个实体是同一个吗」）。暂缓，触发条件：`canonical_linker` 人工复核队列积压成为瓶颈。
- **#13**：记忆去重 0.80–0.85 模糊带（`memory_service.py:558-591`）同样是 Noul 形。暂缓，与 [015 #8](../cognitive-context/015-openviking-mapping-negentropy.md) 的「LLM 档」判定一致。
- **#14（🔶 做）**：`global_search` 的 map prompt 让模型在无关时回答「无相关信息」（`global_search.py:51`），过滤器只丢空串（`:200-201`），哨兵因此随证据进入 reduce（`:431-435`），稀释了综合答案的输入。
  - 最小修复：过滤该哨兵串。
  - 中期方案：map 阶段改成「相关性是非 + 部分答案」两段，这正是 docstring 承诺而未实现的「置信度」（D3）。

### #15 / #16 接入与最近邻

- **#15（⏸）**：模型类型枚举只有 LLM / EMBEDDING / RERANK（`models/model_config.py:18-23`），task slot 只允许 llm / embedding（`task_registry.py:28`）。接入决策模型需要新增类型与 slot。
  - 暂缓理由：
    - 官方自认 CJK 较弱。
    - 闭源、同一权重服务所有客户。
    - 二手媒体称大陆不可用，未经一手核实。
  - 触发条件：可自托管、中文校准经本仓数据验证的决策模型出现。验证协议见 190 §10：自有切片重拟温度，再在分布外切片上测 ECE 与直投错误率。
- **#16（✅）**：`LocalReranker` 是仓内唯一「不生成、只打分」的模型（`reranking.py:84,159`，由 `hybrid_planner.py:684,741-763` 消费）。它证明本仓已有 System One 形组件的接入先例；将来接入决策模型，应沿用 rerank 的接入形态，而不是走 LLM task slot。

## 落地建议汇总

- **做**（建议合并为一个小 PR，下次触及 routine / claude_code 时落地）：
  1. #1 自动作答成员校验 + 纠正重试 + 兜底。
  2. #2 `_parse` 对 `{}` 返回显式解析失败信号，交给现有重试环。
  3. #14 `global_search` 过滤「无相关信息」哨兵。
- **写**：
  1. #3 结构化输出约定（半小时）。
  2. #6「点分数不可直接当阈值」设计备忘（一页）。
  3. #8 自报 confidence 字段注释「未校准启发式」（一句话）。
- **暂缓**（写明触发条件）：
  1. #7 进化门重复评分：进化 Phase 3。
  2. #9 意图分类校准：出现误路由问题。
  3. #11 FacultyBridge：保持默认关。
  4. #12 实体消歧 Noul：复核队列积压。
  5. #13 去重模糊带 Noul：与 015 #8 同步。
  6. #15 接入决策模型：可自托管 + 中文校准验证。

## 取证副产物：本仓漂移清单

| D# | 类别 | 现象 | 锚点 | 影响 |
| --- | --- | --- | --- | --- |
| D1 | 配置 | `routine.auto_answer` / `routine.memory_extract` / `eval.execute` 三个 task key 在用但未注册，静默回落默认模型；`config/routine.py` 注释却称「走 task_registry 解析」；管理端拒绑未知 key | `ng/engine/claude_code/service.py:1053` · `ng/engine/routine/memory_extractor.py:37` · `ng/engine/eval/runner.py:172` · `ng/config/routine.py:187,279` · `ng/interface/task_models_api.py:150-151` | 三条链路无法单独指定模型 |
| D2 | 死配置 | `auto_answer_model` / `auto_answer_timeout_seconds` 定义但无人读取；调用点不传 `model_override`、硬编码 `timeout=30.0` | `ng/config/routine.py:185-189` · `ng/engine/claude_code/service.py:1581-1585` | 用户改配置无效 |
| D3 | 文档 | `global_search` docstring 承诺「部分答案 + 置信度」，`GlobalSearchEvidence` 无 confidence 字段 | `ng/knowledge/graph/global_search.py:5-9,84-91` | 读者误以为已有相关性过滤 |
| D4 | 文档 | 意图 boost：docstring「+10% 分」vs 代码 `boost = 0.15` | `ng/engine/adapters/postgres/memory_service.py:1355,1368` | 调参依据失真 |
| D5 | 配置 | ingestion planner 未钉温度，经 `setdefault` 继承 0.7 做 choice + 是非判断 | `ng/knowledge/ingestion/extraction.py:1848-1854` · `ng/config/model_resolver.py:37-41` | 决策类调用不必要的随机性 |
| D6 | 死字段 | `entity_resolver` 的 `_borderline_high` 设置后从未读取，第 4 阶段只存在于 docstring | `ng/knowledge/graph/entity_resolver.py:202,212-214,476` | 同 D3 |
| D7 | 文档 | `issue.md` 存在两个 `## ISSUE-128` 标题 | `docs/.agents/issue.md:3076,3119` | 交叉引用歧义 |

> ConflictResolver docstring 宣称三阶段检测、实现只有规则，已由 [ISSUE-195](../../.agents/issue.md) D4 登记，此处不重复。

## 交叉引用

- 材料侧：[190 Jev 精读笔记](./190-jev-system-one-model.md)（机制 M1–M4、原型 [jev_lab.py](./assets/jev_lab.py)、破坏性实验 B1–B6）。
- 相关子系统：[Routine 系统](../../concepts/subsystems/039-the-routine-system.md)（Judge 与 `decide()`）· [Claude Code 集成](../../concepts/subsystems/038-claude-code-integration.md)（自动作答）· [自进化 Agents Team 方案](../../concepts/design/self-evolving-agents.md)（进化门）。
- 同类映射：[OpenViking ↔ negentropy](../cognitive-context/015-openviking-mapping-negentropy.md)（去重 LLM 档、ConflictResolver 漂移）· [Agent Skills ↔ negentropy](./091-agent-skills-mapping-negentropy.md)。
- Issue 登记：[ISSUE-196](../../.agents/issue.md)。
