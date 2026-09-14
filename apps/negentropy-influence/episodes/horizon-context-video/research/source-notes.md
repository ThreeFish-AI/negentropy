# 事实源：《AI 为什么答不对你公司的数据》（Horizon Context 篇）

> **本集口播的单一事实源**。逐字稿（[../script/narration.md](../script/narration.md)）中每一条断言都必须能回溯到本文件的某一节；回溯不到的断言不得进入口播。
>
> **信源轨（本集为 B 型 · 仓内固定提交）**
> - **A 轨 · 精读笔记**：本仓 [docs/research/cognitive-context/011-horizon-context.md](../../../../../docs/research/cognitive-context/011-horizon-context.md) @ `cf6724d688d6`（2026-09-12，见 [sources.toml](./sources.toml) `paper-note`）——对 Snowflake Horizon Context 产品页/博客/docs 的系统精读，上游 IEEE 引用链完整落在笔记「参考」节。
> - **B 轨 · 最小原型实测**：[assets/horizon_context_lab.py](../../../../../docs/research/cognitive-context/assets/horizon_context_lab.py)（916 行）与 [assets/horizon_context_mcp.py](../../../../../docs/research/cognitive-context/assets/horizon_context_mcp.py)（328 行）@ 同一提交，`--selftest` 全绿（2026-09-12 本机复跑，30 项断言）。
> - ⚠ **文档已迁址（2026-09-14）**：上述仓内链接指向迁移后的现址（`docs/research/cognitive-context/`）；取证仍锚定 `cf6724d688d6`，该提交上的原路径为 `docs/reference/paper-notes/` 与 `docs/reference/context-layer-blueprint.md`——[sources.toml](./sources.toml) 的 pinned raw URL 与成片尾幕署名保持原样，均仍可解析。
> - 上游 Snowflake 官方页**不直接取证**：所有官方口径经 A 轨笔记转述，笔记 §10 已对每条官方数字标批判性边界。
>
> **证据四级（本集最重要的真实性纪律）**
> | 级 | 含义 | 口播允许的表述 |
> |---|---|---|
> | 【一】 | 原型实测（可复跑 `--selftest`） | 可直接断言 |
> | 【二】 | 精读笔记转述的官方机制（docs/博客机制性描述） | 可断言，属「官方的讲法」 |
> | 【三】 | **厂商自家基准数字**（基准口径自家定，无第三方复现增益端） | **必须**带归属（「Snowflake 自己测的」「官方说法」），画面压角标 |
> | 【四】 | 第三方分析（Typedef 复现等） | 必须带归属句（「有家第三方公司复现说…」） |
>
> **数字纪律**：所有百分比/金额先在本文件登记证据级；自家基准与第三方复现**不得混说成同一口径**。原型玩具数字（200/440 等）口播须带「我们用玩具数据复现了一遍」框架。

---

## 一、问题与基线：含义不在数据里

- 【三】**无上下文基线**：agent 回答企业数据问题的准确率约 **25%**（Snowflake 内测口径）/ **21%**（Anthropic 独立复测的基线端）——两家独立测出同一量级。口播框架：「不是模型笨，是含义不在数据里」。
- 【二】**含义散落的具象**：库里毛收入叫 `amt_ttl_pre_dsc`；「净收入」口径散落在 20 个看板的 `CASE WHEN` 里。同一问题两个分析师两个答案。
- 【二】**三病灶归因**（官方博客）：①含义散落；②外挂语义层必然漂移（「层不在引擎里，每次查询要对账两套系统，agent 跟着错的定义走」）；③治理外挂可被绕过（第三方层拦不住直查物理表）。
- 【二】**官方三句话递进**：*Without context, an agent guesses. With context built natively into the platform, an agent acts. With context that is also governed natively, an agent can be trusted.*（无上下文，agent 在猜；上下文进平台，agent 能干活；上下文受治理，agent 才可信。）
- 【二】一句话定位：Horizon Context 是「**住进治理引擎、在查询时强制执行**」的上下文层——把业务定义、指标、关系、血缘、用法沉淀为受治理的元数据对象，让人、BI 工具、AI Agent 从同一份定义推理。

## 二、总类比系统（贯穿全片的比喻）

- 【一】**总类比**（笔记原创，可放心用作本片叙事骨架）：AI Agent 是**每天都失忆、重新入职的天才实习生**——能力极强但不记得昨天；Context Layer 是**永远最新的入职包**：公司术语手册（显式定义）+「大家实际在用什么」的观察笔记（隐式挖掘）+ 门禁卡（权限）+ 前台问询处（检索）+ 前辈签过名的 FAQ（验证问答）。
- 面向普通人的类比强化（制片自创，不涉事实断言，只作修辞）：复印机陷阱 / 班级平均分的平均 / 银行卡余额 / 门禁装在电梯里 / Wikipedia 争议条目 / USB-C 插头。

## 三、M1 上下文对象模型：便利贴 → 装订成册的手册

- 【二】`CREATE SEMANTIC VIEW` **五段式**：TABLES（带 PK/UNIQUE 约束）→ RELATIONSHIPS（声明式 join，FK 必须指向键列）→ FACTS（行级量，可 PRIVATE）→ DIMENSIONS（切片维度）→ METRICS（命名聚合）。
- 【二】语义视图被官方明确定义为**元数据**（"Semantic views are considered metadata"），与数据同库同治理。
- 【二】五个易被低估的字段设计：①`WITH SYNONYMS`（召回别名是受治理上下文：「毛收入/营收/sales」写进定义）；②`AI_VERIFIED_QUERIES`（人验证过的问答对：QUESTION + SQL + VERIFIED_AT + VERIFIED_BY，答案样例带审计溯源）；③`AI_SQL_GENERATION`（给 agent 的提示词内嵌定义里，随定义分发与治理）；④`PRIVATE | PUBLIC`（事实与指标级可见性）；⑤`NON ADDITIVE BY (dims)`（半可加性声明）。
- 【二】**四层上下文分类法**（官方 FAQ）：Structural（有什么、怎么连）/ Operational（查询、新鲜度、性能）/ Semantic（定义、指标、本体）/ Behavioral（热度、用法模式）。
- 【一】**结构校验门**（原型 D6 实测）：relationship 指向非键列（`customers.plan`）→ 注册即拒（"referenced column customers.plan is not PRIMARY KEY/UNIQUE"）。无门则垃圾定义静默入库——「行数失控的注册期引信」。

## 四、M2 查询时语义正确性：菜谱写「临出锅再勾芡」

- 【二】**机制总纲**：指标是**命名聚合**（一段算式）不是存储值——每次查询按你要的粒度现场重算。官方工程博客判词：**"valid SQL, but not valid analytics"**（合法的 SQL，不合法的分析）。
- 【三】**fan trap 官方案例**（Sam Waters 案，工程博客）：一笔 $100 订单被 join 复制成 3 行 → 算成 $300。LLM 在 TPC-DS 上同样踩坑。
- 【三】**average of averages 官方案例**：16.0 vs 真实 4.8（无加权平均把大小团队同权）。
- 【二】chasm trap（共享维度的笛卡尔爆炸）——三大经典陷阱之一，口播可点名不展开。
- 【二】四个聚合保障 + 一个消歧：①agg-before-join（先各自聚合到目标粒度再合并）；②distinct 聚合跨 join 安全（数集合不数行）；③derived 先聚后除（分子分母各自聚合，防 average of averages）；④NON ADDITIVE BY（按声明维度排序取**末快照**而非求和——余额可跨账户相加、不可跨天相加）；⑤USING (relationship)（多 join 路径显式消歧）。
- 【一】**原型实测**（玩具月度订单数据，selftest B1/B2/B3/B4/A3/A4）：
  - fan trap：引擎 Jan=200 vs 朴素 join-then-agg Jan=440（$100 订单被 3 条事件复制）。
  - average of averages：先聚后除 108.33 vs 月均值的均值 122.22。
  - distinct 安全：fan-join 下 SUM 膨胀到 440 而 COUNT(DISTINCT customer) 仍 [3,1,2]；月格相加 6 ≠ 总体重算 5。
  - 半可加：DAU 末快照 [5,6,7] vs 求和 [11,6,7]；全期 7 vs 24。
  - 消歧：省略 USING → AmbiguousJoinPath 异常（引擎拒绝猜）。
- 【一】**破坏实验 D1–D7**（selftest 全绿，逐条实测退化）：D1 拆 agg-before-join → 440；D2 拆 distinct → [6,1,2]；D3 拆半可加 → [11,6,7]；D4 冲突改自动选 → 错误口径胜出；D5 拆 RBAC → 越权拿到 [90,560]；D6 拆校验门 → 坏定义入库；D7 拆先聚后除 → 122.22。教训句：「每个组件拆掉都有具体的、可复现的坏法」。

## 五、M3 治理内嵌引擎：门禁装在楼里

- 【二】官方文档原话：*"Governance policies execute at the query engine layer, not the application layer. They apply automatically to every caller: human analyst, BI tool, or AI agent. There is no separate governance configuration for AI workloads."*（治理策略在查询引擎层执行，不在应用层；对每个调用方自动生效——人、BI 工具、AI agent；AI 工作负载没有单独的治理配置。）
- 【二】官方 FAQ 对第三方层的判词：*"Governance can be bypassed by querying tables directly. Horizon Context enforces security and business logic at the engine level — it cannot be circumvented."*（直查物理表即绕过外挂治理；引擎级执行不可绕过。）⚠ 边界：只在引擎周界内成立（笔记 §10-3）。
- 【二】配套：AI Guardrails 在**出口**检测/脱敏/拦截 PII 与 PHI；标签与权限随数据产品携带（Marketplace 分享自带策略）；跨引擎（Iceberg REST 兼容引擎）策略一致执行。
- 【一】**原型双层防线**（C2 实测）：检索层把 PRIVATE 维度建议过滤只是第一层（体验）；绕过检索直闯执行层 → AccessDenied（引擎是最后防线）。D5 实测：拆掉执行层 RBAC → intern 按 plan 拿到 [90,560]，泄露发生。

## 六、M4 富化与自纠：百科全书 → Wikipedia

- 【三】**覆盖率现实**：Snowflake 内部实测，9,685 张表的 semantic view 覆盖**不到 5%**——「手册内的问题答得好，但大多数问题落在手册外」。官方总类比：专家百科全书 → 持续演化的 Wikipedia。
- 【二】Cortex Sense（2026-07 私预）从查询历史、转换工具模型、BI 指标里自动拼装「与 semantic view 同类的理解」。
- 【二】三层机制对抗「自动挖掘会 confidently wrong」：①**eval 自纠环**（金标准问答/用户反馈/自检薄弱区三路输入，错配即修正）；②**冲突浮出**（挖到几十个互相矛盾的 DAU 定义时不自动选，浮出给数据团队指认——官方自评 *"forcing this level of honesty separates it from RAG that simply retrieve whatever is found"*：这种诚实度正是与「找到什么用什么」的 RAG 的分界）；③**信号排序**。
- 【三】**战绩**（官方口径）：在定义过时与未覆盖两个区域反超人工 10 个百分点；整站搭建从数月缩到一天。
- 【一】**原型实测**（C3/C3b/C4）：同名冲突（governed `count_distinct(orders.customer_id)` vs inferred `count(events.id)`）→ CONFLICT 卡片并列两定义**无数值**、agent 拒答、执行层拒绝；人工裁决 governed 胜 → 恢复 [3,1,2]。eval 自纠环：错配 top1=sum(dau) 错 → 补 synonym + 调信号 → top1=count_distinct 对。
- 【一】**D4 破坏实验**：冲突策略改 auto_popularity → 推断层 count(events) 胜出 [6,1,2]（对照正确 [3,1,2]）——「自动选让多数派错误碾压正确口径」的玩具复现。

## 七、M5+M6 检索激活与信号排序：前台问询处

- 【二】流程：agent 问自然语言问题 → 混合匹配（关键词 + 语义，Universal Search 的 "hybrid keyword and semantic ranking"）选 top-k 上下文包（定义 + 指令 + 验证问答）→ agent 据此生成查询。
- 【二】**四因子排序**（官方自比 web search 排网页）：*relevance / authority / popularity / freshness*——受治理定义 authority 高于少量查询推断；出现在 500 条生产 SQL 的 join 模式重于出现 3 次的；上月更新的定义压过两年前的。
- 【二】**verified query 短路**：命中验证问答直接重放结果 + 溯源（verified_by/verified_at）。
- 【二]**新表边缘**（经典预测题）：两周前上线的定价方案无 SV 覆盖——纯 SV 路径拒答，通用 agent 可能自信错，Sense 给推断口径答案（authority 低、带警告）。
- 【一】**原型实测**（A1/A1b/C1/C5 + MCP T3/T6/T6b）：verified 短路重放 {'2026-01': 200, …} 带署名溯源；引擎重算 == 验证答案（对账一致）；新表 inferred 条目胜出 + `no_governed_coverage` 警告；freshness 隔离：governed revenue(fresh=0.96) 0.854 压过 legacy(0.00) 0.826；feedback down 后 governed→legacy 易位（popularity 参与排序）、up 恢复。

## 八、实证数字总表（口播引用前查级）

| 数字                                                  | 证据级                       | 一句话读法                                        |
| ----------------------------------------------------- | ---------------------------- | ------------------------------------------------- |
| ~25% / 21% 无上下文基线                               | 【三】/第三方基线端          | 两家独立测出同一结论：缺业务含义时 agent 就是瞎猜 |
| 24.1% → 86.3%                                         | 【三】（Snowflake 自家基准） | 上下文层把准确率抬 3.6 倍（增益端无第三方复现）   |
| $1.76 → $0.59/query                                   | 【三】（同上）               | 每次查询成本砍 2/3                                |
| 9,685 表 / 覆盖 <5%                                   | 【三】（Snowflake 内部实测） | 纯手工金标准覆盖不动——隐式轨道的存在理由          |
| $100 → $300 fan trap                                  | 【三】（工程博客案例）       | join 复制行，valid SQL ≠ valid analytics          |
| 16.0 vs 4.8                                           | 【三】（工程博客案例）       | 平均的平均不是平均                                |
| 反超人工 10 pct / 数月→一天                           | 【三】（官方口径）           | 隐式轨道的战绩（无第三方复现）                    |
| 17 创始 → 50+ 组织（OSI→Ossie）                       | 【二】                       | 语义可携带已成行业共识                            |
| 玩具 200/440 · 7/24 · [3,1,2]/[6,1,2] · 108.33/122.22 | 【一】                       | 六机制在玩具域的逐点复现                          |

## 九、批判性边界（口播收尾的「它没证明什么」，笔记 §10 全五条）

1. 【三】86.3% 是**自家基准**——自家数据自家口径；Anthropic 只独立复现了 21% 的基线端，增益端无第三方复现。
2. 【二】整体处于 **preview**（2026-06 时点）；BlackRock 是早期采用证言不是效果数据。
3. 【二】「不可绕过」只在**引擎周界内**成立——直查底层数据库、导出数据即绕过。
4. 【四】**治理 ≠ 验证**（Typedef 批评 + 复现）：`NON ADDITIVE BY` 是人填的声明非系统推导；上游 dbt 已把 grain 塌缩（日汇总）后，正确算式照样产出 **477 vs 48** 的错误数字（生产复现，Typedef）。lineage 是「谁喂谁」的观察记录，不是「这么算合法吗」的校验。
5. 【二】信号排序可能放大多数派错误：popularity 权重下，500 条查询使用的错误 join 模式压过 3 条查询的正确模式（原型 D4 玩具复现）。

## 十、开放互操作（上篇点到，细节归下篇）

- 【二】**OSI → Apache Ossie（Incubating）**：YAML/JSON 语义模型规范，2025-11 由 Snowflake + Salesforce + dbt Labs 等 17 家发起，进 Apache 孵化器后 50+ 组织、3 工作组（Metric Language / Catalog / Ontology）；语义视图可 `SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML` 导入。
- 【二】**MCP**：官方管理的 MCP server 把语义视图（经 Cortex Analyst）与 Cortex Search 暴露给外部 agent——Claude Desktop / Claude Code / Cursor 添加 custom connector 即可「受治理地」问数。
- 【一】**本仓 MCP 原型**（T1–T8 全绿）：纯标准库 stdio JSON-RPC 四工具（list_context_objects / resolve_context / compile_metric / report_feedback）；引擎层 RBAC 经 MCP 仍生效（T5）；行为反馈改变排序可复现（T6/T6b）；子进程 stdio 往返冒烟（T8）。

## 十一、v2 代码实景引用清单（2026-09-13 改版增补）

> v2 口播中「屏幕上的代码/实测输出」逐处锚定（全部【一】仓内可复跑）：

| 口播位置             | 画面代码/输出                                                                                                                 | lab 锚点                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| p2-06..08 五段式声明 | `SemanticView("sales_sv", tables=(...), relationships=(Relationship("buyer", ...)), metrics=(Metric("revenue", "sum", ...)))` | `build_sales_view()` :170                                                            |
| p2-11 注册被拒       | `✗ relationship bad: referenced column customers.plan is not PRIMARY KEY/UNIQUE`                                              | D6 实测输出                                                                          |
| p3-11 一行分岔       | `spec_rows = [...] if agg_before_join else _naive_joined_rows(...)`                                                           | `compile_query` 内 :383-385                                                          |
| p3-21 实测输出       | `[PASS] B1: fan trap: 引擎 Jan=200 vs 朴素 Jan=440`                                                                           | selftest B1                                                                          |
| p4-10..12 三行 RBAC  | `if metric.visibility == "PRIVATE" and role not in PRIVATE_ALLOWED: raise AccessDenied`                                       | `compile_query` M3 防线 :394-396；C2 输出同屏                                        |
| p5-27 热度一行       | `pop = math.log1p(popularity) / math.log1p(POP_CAP)`                                                                          | `rank()` :463                                                                        |
| archify 回放         | declaration-execution / collect-enrich-activate 两段 Play 录制                                                                | `docs/assets/architecture/cognitive-context/` + `pipeline/scripts/record_archify.py` |
