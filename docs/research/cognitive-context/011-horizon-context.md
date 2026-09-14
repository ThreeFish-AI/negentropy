---
sidebar_position: 4
title: "Snowflake Horizon Context 精读笔记"
description: "「嵌入治理引擎、查询时强制执行」的 Context Layer 六机制精读：五段式对象模型 / 查询时聚合安全 / 引擎级双层 RBAC / 显式隐式双轨富化与冲突裁决 / 四因子信号排序 / OSI+MCP 互操作，含实证数字、批判性边界与随笔记入库的 M1–M6 最小原型"
---

> [!NOTE]
>
> **核心精读范围**：
>
> - [Snowflake, "Horizon Context — Governed Semantic Layer & Data Catalog," 产品页, 2026](https://www.snowflake.com/en/product/features/horizon-context/)
> - [公告博客 "The Governed Context Layer for AI, BI and Apps," 2026-06](https://www.snowflake.com/en/blog/horizon-context-governed-context/)
> - [Summit 26 新闻稿, 2026-06-02](https://www.snowflake.com/en/news/press-releases/snowflake-advances-trusted-ai-with-snowflake-horizon-catalog-centralizing-governance-context-and-security-across-the-enterprise/)
> - [docs: 语义视图](https://docs.snowflake.com/en/user-guide/views-semantic/overview) / [CREATE SEMANTIC VIEW](https://docs.snowflake.com/en/sql-reference/sql/create-semantic-view) / [validation-rules](https://docs.snowflake.com/en/user-guide/views-semantic/validation-rules)
> - [Cortex Sense 博客, 2026-06-30](https://www.snowflake.com/en/blog/enterprise-ai-agents-grounded-context/)
> - [工程博客 "Why Do We Need Semantic Views?", 2026-03](https://www.snowflake.com/en/blog/engineering/why-we-need-semantic-views/)
> - [OSI→Apache Ossie](https://www.snowflake.com/en/blog/apache-ossie-open-semantic-interchange-incubator/)

**一句话定位**：Snowflack Horizon Context 是 **嵌在 Data 治理引擎层、在查询时强制执行** 的 Context Layer —— 把业务定义、指标、关系、血缘、用法沉淀为受治理的元数据对象，让人、BI 工具、AI Agent 从同一份定义推理，而不是各自猜测。

> [!TIP]
>
> **怎么读笔记**：每个子主题是按「类比 → 机制 → 原型」三拍进行记录和实践。其中实践取自配套的最小原型 [`assets/horizon_context_lab.py`](./assets/horizon_context_lab.py)（约 916 行纯标准库代码，M1–M6 六机制 + 场景矩阵 + 破坏性实验；另有 MCP 服务原型 [`assets/horizon_context_mcp.py`](./assets/horizon_context_mcp.py) 验证平台集成路径）。

配套产物：[Context Layer 基础设施设计蓝图](./013-context-layer-blueprint.md) · [Horizon Context ↔ negentropy 机制映射报告](./012-horizon-context-mapping-negentropy.md)。

---

## 1. 解决什么问题：为天才实习生配发「终极入职包」，让他秒变业务老司机

企业底层数据库躺着的，往往是密码般的物理列名（如毛收入叫 `amt_ttl_pre_dsc`）；真实业务指标（如净利润）的计算口径也散落在不同报表各自的 `CASE WHEN` 逻辑里。各业务域子系统自说自话，谁也不懂谁。

据 Snowflake 实测，**让缺乏 Context Layer 治理的初级 Data Agent 直接回答企业数据问题，准确率仅有 ~25%（Snowflake 内测）/ 21%（Anthropic 独立复测）**。这并非初级 Data Agent 所使用的模型笨，而是缺了 Context Layer 对语义的有效治理。具体体现为这三个不可自愈的系统性病灶：

1. **口径打架（含义散落）**：指标口径写在各自的散落业务里，同一个业务指标问两个子系统，能得出两套不同数字；
2. **定义漂移（脱节失效）**：外挂语义层独立于 Context Layer，底层数据表的变更会令语义立即脱节，Agent 会按过期的语义手册瞎猜；
3. **门禁穿透（治理虚设）**：权限规则只浮在外部系统，拦不住绕过中间层直查物理底表，安全防线形同虚设。

初级 Data Agent 就像一位智商超群的天才实习生，他满腹经纶、理解力极强，但完全不懂贵司的标准流程与方言黑话。

要把这位天才实习生真正培养成懂业务、守规矩的“业务老司机”，Horizon Context 的解法是，**把业务 Context 与安全守则铸入底层引擎，使其无法被篡改与绕过**。Horizon Context 为此确立了五条硬核设计：

| 设计规格                 | 底层机制                   | 大白话                                                                |
| :----------------------- | :------------------------- | :-------------------------------------------------------------------- |
| **定义一次、处处生效**   | M1 五段式 Context 对象模型 | 权威术语手册只印一份，人、报表与 Agent 全部照章引用，不再各自抄写抄错 |
| **动态现算、保真不走样** | M2 查询时语义正确性        | 发智能公式按需现算，绝不拿预先拼凑的二手死报表将就应付                |
| **原生治理、杜绝穿透**   | M3 引擎原生治理            | 门禁直接装在机房承重墙上，无论谁走哪条路查数据，安全锁底层强制生效    |
| **行为挖掘、覆盖长尾**   | M4 富化与自纠              | 手册没写全的暗规则，系统通过日常观察老分析师的用数习惯自动补全自愈    |
| **标准开放、随处插拔**   | §7 开放互操作              | 入职包采用通用插头与开放格式，任何外部智能体和工具拿来就能立刻用      |

> [!TIP]
>
> 初级 Data Agent 就像一个 **每天都在重新入职、毫无经验沉淀的天才实习生**；Horizon Context 要做的，是给这位天才员工配备一份 **永远最新的入职包**：
>
> - 公司术语表：Semantic Views 显式定义；
> - 前台问询处：CoCo 混合检索；
> - 门禁卡与权限：引擎级 RBAC；
> - 「大家实际都在用什么」的行为统计：Cortex Sense 隐式挖掘；
> - 前辈验证过的 FAQ：AI_VERIFIED_QUERIES 带署名与日期。
>
> 用官方的话讲：*Without context, an agent guesses. With context built natively into the platform, an agent acts. With context that is also governed natively, an agent can be trusted.*

## 2. M1 · 五段式 Context 对象模型：把语义便利贴装订成册

> [!TIP] **类比**
>  
> 初级 Data Agent 系统所面对的 Context 就像钉满墙面的便利贴，上面记录了散落的 SQL/prompt 硬编码等；而 Context Layer 负责为这些便利贴标记 Owner、版本、权限属性等，装订成一本规章制度手册。手册里甚至夹着「agent 使用说明」（AI_SQL_GENERATION）和「前辈验证过的 FAQ」（AI_VERIFIED_QUERIES）等。

> [!NOTE] **机制**
>
> 五段式声明：TABLES（带 PRIMARY KEY/UNIQUE 约束）、RELATIONSHIPS（声明式 join，FK 必须指向键列）、FACTS（行级量，可 `PRIVATE`）、DIMENSIONS（切片维度，可挂 Cortex Search）、METRICS（命名聚合）。
>
> 语义视图（`SEMANTIC VIEW`）：**官方明确定义为元数据**（"Semantic views are considered metadata"），与数据同库同治理。
>
> 对象字段里藏着的五个设计：
>
> 1. **`WITH SYNONYMS`**：Agent 召回所需的别名本身就是受治理上下文（「毛收入/营收/sales」写进定义）；
> 2. **`AI_VERIFIED_QUERIES`**：人验证过的问答对成为一等资产：`QUESTION + SQL + VERIFIED_AT + VERIFIED_BY (purpose=contact)`，**答案样例带审计溯源**；
> 3. **`AI_SQL_GENERATION / AI_QUESTION_CATEGORIZATION`**：给 Agent 的提示词内嵌在定义里，随定义分发、随定义治理；
> 4. **`PRIVATE | PUBLIC`**：事实与指标级可见性；
> 5. **`NON ADDITIVE BY (dims)`**：半可加性声明（§3）。
>
> 四层 Context（官方 FAQ）：
>
> - **Structural**：有什么、怎么连
> - **Operational**：查询、新鲜度、性能
> - **Semantic**：定义、指标、本体
> - **Behavioral**：热度、用法模式
>
> 这四层 Context 是在 Collect → Enrich → Activate 三段式流水线上流转的原料。

![Horizon Context 三段流水线：三路元数据并列汇入统一目录，显式/隐式双轨富化（同名冲突浮出人工裁决），经四因子混合排序后供给 CoCo、BI 工具与 MCP 外部 Agent。](../../assets/architecture/cognitive-context/horizon-context--collect-enrich-activate-dark.png)

> 图源（可 diff 文本）：[`horizon-context--collect-enrich-activate.mmd`](../../assets/mermaid/cognitive-context/horizon-context--collect-enrich-activate.mmd) · 交互版（下载到本地打开）：[`horizon-context--collect-enrich-activate.html`](../../assets/architecture/cognitive-context/horizon-context--collect-enrich-activate.html)

> [!IMPORTANT] **原型实践**
>
> 结构校验门拦下「指向非键列的 relationship」（D6 实验，实际运行输出）：
>
> ```text
> [PASS] D6: 拆结构校验（relationship 指向非键列）→ relationship bad: referenced column
> customers.plan is not PRIMARY KEY/UNIQUE—— 无门则垃圾定义静默入库（行数失控的注册期引信）
> ```

## 3. M2 · 查询时语义正确性：发「防错公式」不发「死报表」，保现场推导不保原料残缺

> [!TIP] **类比**
>
> 指标在系统里不是预先算好的存储值（死报表），而是一套**现场按需推导的智能算式（命名聚合）**。无论分析师或 Agent 想要哪个维度的切片，系统都拿着底层原始明细、按当下的统计需求现场套用公式重算。
>
> 就像入职包里给实习生配发了一台**「内置财务防错逻辑的智能计算器」**：无论老板要查哪条业务线，实习生只要套用标准公式现场算，绝不会算错；但若上游交接工作时早已把原始凭证碎掉、只扔来一张粗暴汇总好的二手旧账（如 dbt 已把日活预聚合成日汇总），计算器再聪明也逆向推导不出明细流水。
>
> **这套机制确保「只要给出的原始单据与查询粒度合理，系统底层自动算对」，但无法拯救「上游预处理过早丢失明细的残缺数据」**。

> [!NOTE] **机制**
>
> 为什么让初学者或 LLM 自己写关联查询（JOIN）极易翻车？因为数据分析领域存在一个隐蔽杀手：**“语法完全合法，但业务答案全错”（*valid SQL, but not valid analytics*）**。大模型在工业级基准测试（如 TPC-DS）中也频频踩坑。为此，Horizon Context 在底层内嵌了“四大聚合保障 + 一个消歧路径”，彻底封堵常见算错陷阱：
>
> 1. **先聚后连（agg-before-join）**：防“金额被动翻倍”。两表关联时，各自指标先在本地汇总再做拼接；防止一笔 $100 的订单因关联了 3 条送货记录而被机械复制放大成 $300（行业经典的 **fan trap / 扇形陷阱**，如 Sam Waters 案）；
> 2. **按集合去重（distinct 聚合跨 join 安全）**：防“重复虚增人数”。`COUNT(DISTINCT)` 跨表关联时，严格按去重集合而非物理行数统计，即使底层因连接膨胀出多行，活跃客户等去重指标依然准确；
> 3. **先合总数再相除（derived 先聚后除）**：防“平均数的平均数”。计算客单价或利润率等派生指标时，强制先汇总总分子与总分母再做除法 `DIV0(total_revenue, total_cost)`，防止各部门平均值直接相加求二次平均产生荒谬失真（如真实平均为 4.8，朴素均值却算成 16.0 的 **average of averages 陷阱**）；
> 4. **半可加性末快照（NON ADDITIVE BY）**：防“账户余额跨天累加”。银行账户余额可以跨部门相加，但绝不能把 30 天的余额当流水相加；系统识别半可加指标，按时间序列自动取**最新期末快照**而非机械求和；
> 5. **显式指定关联路径（USING relationship）**：防“笛卡尔积爆炸”。当两张表之间存在多条连接通道（如订单表同时包含“发货地址”与“收货地址”）时，显式指定唯一关系路径，消除歧义，避开两眼一抹黑的 **chasm trap（深渊陷阱）**。

![语义视图声明相与执行相：五段式声明经结构校验门（非法定义注册期被拒），通过后进入执行相——执行层 RBAC 拒绝 PRIVATE 资产，策略 A 零复制聚合后按查询 grain 重算。](../../assets/architecture/cognitive-context/horizon-context--declaration-execution-dark.png)

> 图源（可 diff 文本）：[`horizon-context--declaration-execution.mmd`](../../assets/mermaid/cognitive-context/horizon-context--declaration-execution.mmd) · 交互版（下载到本地打开）：[`horizon-context--declaration-execution.html`](../../assets/architecture/cognitive-context/horizon-context--declaration-execution.html)

> [!IMPORTANT] **原型实践**
>
> B 场景 5 组陷阱破坏性实验实际运行输出（对照值均为引擎正确路径）：
>
> ```text
> [PASS] B1: fan trap: 引擎 Jan=200 vs 朴素 Jan=440（o1 的 3 条事件把 $100 变 $300）
> [PASS] B2: average of averages: 先聚后除 108.33 vs 月均值的均值 122.22
> [PASS] B3: 拆 distinct: 退化为数事件行 [6,1,2]（对照 [3,1,2]）
> [PASS] B4: NON ADDITIVE: 末快照 [5,6,7] vs 求和 [11,6,7]；全期 7 vs 24
> [PASS] A3: distinct 跨 join 安全: 正常 [3,1,2]；fan-join 下 SUM=440 而 distinct 仍 [3,1,2]；月格相加 6 ≠ 总体重算 5
> ```

## 4. M3 · 引擎原生治理：门禁焊在大楼承重墙，杜绝任何绕道直查

> [!TIP] **类比**
>
> 传统的第三方外挂治理，就像在公司大堂摆了一块“闲人免进”的塑料告示牌，或者雇了个外包保安在门口登记。表面看似合规，但只要有人从后门直接溜进地下机房与档案室（直查物理底表），里面的商业机密就能被看个精光。
>
> Horizon Context 则是直接把**生物识别门禁焊进了机房承重墙**——不管是老员工、BI 分析软件，还是 AI 实习生，任何人只要调取数据，都必须在数据库引擎底层刷卡验身，没有任何“后门”可抄。

> [!NOTE] **机制**
>
> 官方给出的核心准则是：**治理策略直接在查询引擎层执行，而不是在应用层做样子**（*Governance policies execute at the query engine layer, not the application layer. They apply automatically to every caller: human analyst, BI tool, or AI agent. There is no separate governance configuration for AI workloads.*）。系统对人与 AI 一视同仁，不设立孤立脆弱的“AI 专用防线”，并在底层铸造了三重刚性约束：
>
> 1. **权限同源（统一 RBAC 与私密隔离）**：AI Agent 与真实员工共享同一套权限体系；被标记为 `PRIVATE` 的敏感指标在底层对无权者直接不可见、不可查；
> 2. **出口安检（AI Guardrails 实时脱敏）**：在数据离开引擎的最终出口处，自动检测并屏蔽个人身份证、手机号等隐私信息（PII / PHI）；权限与安全标签随数据产品一路携带（即使分享到外部 Marketplace 也不会丢失策略）；
> 3. **底层兜底不可绕过（跨引擎一致执行）**：无论是本地查询还是通过开放格式（如 Iceberg REST 兼容引擎）调用，所有安全策略均在引擎深处刚性生效。官方一针见血指出：第三方外挂层根本拦不住直接查物理表，而内嵌于引擎的治理谁也绕不过去（*cannot be circumvented*，具体性能边界见 §10 第 3 条）。

> [!IMPORTANT] **原型实践**
>
> 实际运行输出的双层防御自证（C2 破坏性实验）：
>
> ```text
> [PASS] C2: RBAC 双层: 检索层对 intern 过滤 plan 建议（["dim_filtered (PRIVATE): ['plan']"]，
> 降级总量 {(): 650}）；直闯执行层 → AccessDenied（引擎是最后防线）
> ```

## 5. M4 · 富化与自纠：手册写不全看习惯补，两轨冲突绝不盲猜

> [!TIP] **类比**
>
> 入职包里的官方手册（手工 Semantic Views）就像专家定期编撰的《百科全书》：权威严谨，但耗时耗力，在庞大企业里往往只能覆盖不到 5% 的核心业务，绝大多数长尾提问都在手册外。
>
> 真正的老司机必须像持续演化的 Wikipedia 一样走向群智进化。系统不仅读死手册，更会从老分析师们每天提的查询历史、常用报表里“观察习惯、偷师学艺”（行为挖掘），自动补齐剩下的 95%。
>
> 但这套偷师机制有一条**绝不可破的纪律底线**：当发现专家手册与民间习惯口径打架时，系统**绝对不准自作主张瞎蒙一个**，必须老老实实把冲突摆上台面交由人工裁定。

> [!NOTE] **机制**
>
> Snowflake 内部实测揭示了一个残酷现实：全司 9,685 张数据表中，人工构建的语义视图覆盖率**不足 5%**——“手册内的问题答得极好，但大多数日常提问都落在手册外的荒原”。为此，Cortex Sense（2026-07 私有预览）从日常查询历史、转换工具模型和 BI 指标中自动拼装隐式理解。
>
> 为了彻底防范“自动挖掘会导致系统自信满满地胡说八道（confidently wrong）”，系统构筑了三层防线：
>
> 1. **反馈自纠环（Eval Loop）**：接入金标准问答集、用户点赞/点踩反馈与系统自检薄弱区三路输入，一旦识别出理解错配即自动修正；
> 2. **冲突强制浮出（Conflict Escalation）**：当挖掘出互相矛盾的指标口径（如不同团队对活跃用户的定义冲突）时，系统主动拒答，并向数据团队弹出冲突卡片，由人工自然语言指认归属。官方强调：*这种敢于承认不知道的诚实底线，彻底拉开了它与那些“搜到什么就硬答什么”的普通 RAG 之间的本质差距*；
> 3. **信号分层排序**：赋予受治理金标准更高的权威权重（详见 §6）。
>
> **实证成效**：在“口径过时”与“未人工覆盖”两个长尾地带，自动化富化的准确率反超纯人工标注 10 个百分点；整套上下文底座的搭建耗时从数月缩短至单日内。

> [!IMPORTANT] **原型实践**
>
> C3 冲突隔离拦截与 C4 自纠环实际运行输出：
>
> ```text
> [PASS] C3: 冲突浮出: CONFLICT 卡片 [('governed', 'count_distinct(orders.customer_id)'),
> ('inferred', 'count(events.id) by total')]（无数值）；agent 拒答；compile → ConflictingDefinitionError
> [PASS] C3b: 人工裁决（governed 胜）后恢复: [3, 1, 2]
> [PASS] C4: 自纠环: 错配前 top1=active_users（sum(dau)=[11,6,7] 错）→ 补 synonym + 调信号
> → top1=active_customers（count_distinct=[3,1,2] 对）
> ```

## 6. M5 · 检索激活与信号排序：懂分寸的智能前台，按需精选绝不填鸭

> [!TIP] **类比**
>
> 面对浩瀚的公司规章手册与海量的历史用数记录，前台向导绝不会把整栋档案库一股脑全塞给实习生——那不仅会把新人撑爆（上下文窗口超载、产生严重的混淆幻觉），还会浪费极高的算力成本。
>
> 这位经验老到的前台极有分寸：当你提问时，他会飞速综合「跟问题多贴近、谁盖章更权威、平时多少人用、最近有没有更新」四个维度，只撕下最精准的两页递给你；更聪明的是，如果发现这道题前辈早已核准过标准答案（带署名的权威 FAQ），前台直接“抄作业”原样报出，连推导计算都免了。

> [!NOTE] **机制**
>
> 当 Agent 提出自然语言数据问题时，系统采用 **“关键词 + 语义向量”混合匹配**（Universal Search 混合排名），在海量元数据中精选出 top-k 的上下文知识包（包含字段定义、分析指令与验证问答），据此激活 Agent 生成精准 SQL。
>
> 为了在显式手册与隐式行为的汪洋大海中挑出真金，Cortex Sense 引入了类似顶级网页检索的 **四因子信号排序体系**：
>
> 1. **相关性（Relevance）**：字面关键词与深层业务意图双重高契合；
> 2. **权威度（Authority）**：数据团队人工治理的正式语义视图，权重压倒性高于从零星查询推断出的民间口径；
> 3. **流行度（Popularity）**：在 500 条生产 SQL 中千锤百炼的高频关联模式，权重远重于只出现过 3 次的偶发写法；
> 4. **新鲜度（Freshness）**：本月新修订的最新指标定义，果断压制两年前早已失效的历史旧逻辑（Legacy）。
>
> **关键边缘与抄作业机制**：
> - **盖戳短路（Verified Query）**：凡命中带审计署名与日期的人工验证问答对，系统直接短路返回已知答案，实现 100% 审计可信与毫秒级响应；
> - **新表冷启动兜底**：面对两周前刚上线、尚无人工语义视图覆盖的新表，纯 Semantic View 路径的 Agent 会直接“拒答”，通用 Agent 会“自信答错”，而本机制能以推断口径结合风险告警（`no_governed_coverage`）平稳破局。

> [!IMPORTANT] **原型实践**
>
> A1 验证问答短路重放、C1 无手工覆盖推断胜出与 C5 新鲜度隔离实际运行输出：
>
> ```text
> [PASS] A1: verified 短路重放 + 溯源: verified_query {'2026-01': 200, '2026-02': 150,
> '2026-03': 300} by ( data_governance = data-team@acme.com )
> [PASS] A1b: 引擎重算 == 验证答案（对账一致）: [200, 150, 300]
> [PASS] C1: 新表无 SV: inferred 条目胜出 + 警告 ['no_governed_coverage']；覆盖 4/5 表
> [PASS] C5: freshness 隔离: 'sales' → governed revenue(fresh=0.96) 压过 legacy(0.00):
> [('revenue', 'governed', 0.854), ('revenue', 'legacy', 0.826)]
> ```

## 7. 开放互操作：配发「通用转换插头」，打破厂商私有围墙

> [!TIP] **类比**
>
> 如果这套权威的入职包（受治理语义层）被锁死在特定品牌的专用办公电脑里，外部优秀的专家智囊或现代智能工具（如 Claude、Cursor 等外部 Agent）就根本无法接入，沦为封闭的“数据孤岛”。
>
> 真正的老司机必须配发**「通用的国际护照与万能转换插头」**：
> - **护照通用（标准文件规范）**：业务术语手册不写成厂商加密的私房暗号，而是采用全球通行的开源开放格式，无论走到哪个系统都能直接翻阅；
> - **插座通用（标准连接协议）**：在数据中心安装标准的万能通信插座，任何外部先进工具只要插上插头，就能在戴着安全锁链的前提下与企业数据自由对话。

> [!NOTE] **机制**
>
> 语义可携带性已成为跨厂商的行业共识。Horizon Context 通过两条开放路径，彻底打破了厂商锁定（Vendor Lock-in）：
>
> 1. **静态定义互通：OSI → Apache Ossie（开源通用语义规范）**：
>    由 Snowflake、Salesforce、dbt Labs 等 17 家联合发起、现已汇聚 50+ 组织的 Apache 孵化器项目（Ossie）。它通过开放的 YAML/JSON 规范统一了指标、维度与关联关系的定义，并下设 Metric Language、Catalog、Ontology 3 个工作组，已交付 dbt MetricFlow、Apache Polaris 和 Snowflake Semantic Model 三个转换器；语义视图可直接通过 `SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML` 跨平台自由迁徙、导入即用；
> 2. **运行时动态互通：模型上下文协议（MCP）标准连接器**：
>    官方部署的标准 MCP Server，将受治理的语义视图（经 Cortex Analyst）与 Cortex Search 直接向外部智能体生态开放。无论是桌面端的 Claude Desktop，还是开发环境中的 Claude Code、Cursor，添加自定义连接器即可在受控前提下直接问数。
>
> **闭环安全保障**：外部工具调用绝不等于“安全裸奔”。即使通过外部 MCP 跨协议调用，底层引擎的 RBAC 与私密过滤（PRIVATE）依然刚性生效；同时外部交互产生的使用反馈，会实时回流反哺内部热度排序。

> [!IMPORTANT] **原型实践**
>
> MCP 服务原型跨进程通信与安全内控实际运行输出（assets/horizon_context_mcp.py）：
>
> ```text
> [PASS] T3: resolve_context: {'name': 'spend', 'score': 0.73, 'source': 'inferred'} + ['no_governed_coverage']
> [PASS] T5: 引擎层 RBAC 经 MCP 仍生效: plan is a PRIVATE fact
> [PASS] T6: 行为反馈闭环: feedback down 后 'sales' 解析 governed → legacy（popularity 参与排序）
> [PASS] T8: 子进程 stdio 往返: 2 响应行, active_customers=[3, 1, 2]
> ```

## 8. 关键实证数据

| 实验                                 | 关键数据                                                  | 一句话读法                                                        |
| ------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------- |
| 无 Context 基线（Cortex Sense 博客） | ~25%（Snowflake 内测）；21%（Anthropic 独立复测）         | 两家独立测出同一结论：缺业务含义时 agent 就是瞎猜                 |
| CoCo + Cortex Sense（同上）          | 准确率 24.1% → 86.3%；成本 $1.76 → $0.59/query            | Context Layer 把准确率抬 3.6 倍、成本砍 2/3（自家基准，见 §10-1） |
| 覆盖率现实（同上）                   | 9,685 表 semantic view 覆盖 <5%                           | 纯手工金标准覆盖不动——隐式轨道的存在理由                          |
| fan trap（工程博客）                 | $100 → $300（join 复制后）                                | valid SQL ≠ valid analytics                                       |
| average of averages（同上）          | 16.0 vs 4.8                                               | 无加权平均把大小团队同权                                          |
| distinct 跨时间相加（Typedef 复现）  | 玩具 4 vs 3；生产 477 vs 48                               | governed 定义在塌缩 grain 上照样错——治理 ≠ 验证                   |
| OSI → Apache Ossie                   | 17 创始伙伴 → 50+ 组织；100+ commits / 35 PRs             | 语义可携带已成行业共识，非单一厂商私产                            |
| 本原型                               | 200 vs 440；7 vs 24；[3,1,2] vs [6,1,2]；108.33 vs 122.22 | 六机制在玩具域的逐点复现（§9）                                    |

## 9. 动手实践

把机制亲手拆坏七次，运行方式（秒级，仓库根目录执行）：

```bash
uv run --no-project python docs/research/cognitive-context/assets/horizon_context_lab.py --selftest
uv run --no-project python docs/research/cognitive-context/assets/horizon_context_mcp.py --selftest
```

机制 → 代码位置速查（`horizon_context_lab.py`）：

| 机制                     | 位置                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| M1 五段式对象 + 验证问答 | `SemanticView` :157 · `VerifiedQuery` :148 · `build_sales_view` :170                                                |
| M1 结构校验门            | `validate_view` :232（FK→键列 / ≥1 dim+metric / 重名 / NON ADDITIVE 维度存在）                                      |
| M2 查询引擎 + 破坏开关   | `compile_query` :375 · `_naive_joined_rows` :316（策略 B 反事实）· `_aggregate` :342 · USING 消歧 `_dim_value` :288 |
| M3 双层 RBAC             | 执行层 `compile_query` :375 内 `enforce_rbac` 分支；检索层 `resolve` :532 的 `dim_filtered`                         |
| M4 冲突隔离 + 自纠环     | `Catalog.detect_conflicts` :493 · `adjudicate` :509 · `eval_loop` :629                                              |
| M5 检索 + mock agent     | `resolve` :532 · `mock_agent` :596（verified 短路 / compile / cannot_answer）                                       |
| M6 四因子排序            | `rank` :463 · `freshness` :452（REF_DATE 固定字面量）                                                               |

**破坏性实验**（均为实测，每个只改一个 flag / 一行）：

| #   | 拆什么                       | 实测退化                                              | 教训                                                          |
| --- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| D1  | `agg_before_join=False`      | Jan 收入 440（对照 200）                              | join-then-aggregate 是 fan trap 的标准死法，LLM 也会踩        |
| D2  | `distinct_safe=False`        | [6,1,2]（对照 [3,1,2]）                               | distinct 的安全性来自「数集合不数行」，退化即双计             |
| D3  | `last_snapshot=False`        | DAU [11,6,7]（对照 [5,6,7]）                          | 半可加指标求和 = 同一台服务器按天重复计数（477 vs 48 的机制） |
| D4  | 冲突策略改 `auto_popularity` | 推断层 count(events) 胜出 [6,1,2]（对照 [3,1,2]）     | 「不自动选」保住的正是多数派错误不碾压正确口径                |
| D5  | `enforce_rbac=False`         | intern 按 plan 拿到 [90,560]（泄露发生）              | 检索层过滤是体验，执行层拒绝才是治理                          |
| D6  | 跳过 validate 注册坏视图     | relationship 指向非键列被拦下；无门则垃圾定义静默入库 | 结构校验是行数失控的注册期前置防线                            |
| D7  | `derived_post_agg=False`     | aov 122.22（对照 108.33）                             | 平均的平均不是平均——derived 必须先聚后除                      |

七次实验合起来的实践心得与 PG 一致：每个组件单拎出来都不神奇，**拆掉任何一个都有具体的、可复现的坏法**——这是判别「工程组合创新」成色的试金石。

## 10. 批判性边界（材料没有证明的事）

1. **86.3% 是 Snowflake 自家基准**——自家数据、自家评测口径；Anthropic 只独立复现了 21% 的**基线端**，增益端无第三方复现。
2. **整体处于 preview**（2026-06 时点）——5 个元数据连接器与 Semantic Studio 私预、OpenLineage 公预、Business Glossary 在 H2 2026 路线图；BlackRock 是早期采用证言，不是效果数据；官方博客自带 forward-looking 声明。
3. **「不可绕过」只在引擎周界内成立**——直查底层数据库、导出数据即绕过；OSI 解决定义**携带**，不解决定义在别家引擎的**执行**。
4. **governance ≠ verification**——`NON ADDITIVE BY` 是人填的声明非系统推导；上游 dbt 已把 grain 塌缩（日汇总）后，semantic view 的正确算式照样产出 477 vs 48 的错误数字；lineage 是查询日志观察到的「谁喂谁」记录，不是「这么算合法吗」的校验（Cortex Agent Evaluations 是独立 opt-in 的事后评分，不在 Horizon Context 内）。
5. **信号排序可能放大多数派错误**——popularity 权重下，被 500 条查询使用的错误 join 模式压过 3 条查询的正确模式；per-role context 未交付（私测期单角色全量）。

## 11. 验收问答（自测答案要点）

1. **为什么语义层必须住进治理引擎**：外挂层每次查询对账两套系统→漂移；治理外挂可被直查绕过；引擎级执行对每个调用方自动生效、无单独 AI 配置（官方博客 + docs 原话；原型 C2 演示双层防线）。
2. **为什么按查询 grain 重算**：存储的总数冻结了粒度与过滤条件；按 grain 重算让 distinct 聚合跨 join 安全（数集合不数行）、derived 先聚后除；而 SUM 在复制行上必然膨胀（B1/B3/A3 实测）。
3. **为什么冲突必须浮出人工**：自动选择（哪怕按 popularity）会让多数派错误碾压正确口径（D4 实测 [6,1,2]）；「诚实度」正是与 RAG「找到什么用什么」的分界（官方原话）。
4. **OSI 没解决什么**：可携带 ≠ 可执行（别家引擎不替你 enforce）；可携带 ≠ 已验证（validator 只查 schema 合法性，不查计算合法性）。
5. **预测题（两周前新表）**：纯 SV 路径的 Cortex Agent 拒答（无覆盖即不猜）；CoCo+Sense 给推断口径的答案（authority 低、可带 warning）；直连库的通用 agent 可能自信错。第一步观察：Sense 给推断定义的 authority 与警告（原型 C1：`no_governed_coverage` + inferred 条目胜出）。

## 12. 与本仓的关联

- 机制级对照（definitions registry ↔ context objects、patrol/Judge ↔ eval 自纠环、三层渐进披露 ↔ verified query 分发等 10 条）见 [Horizon Context ↔ negentropy 机制映射报告](./012-horizon-context-mapping-negentropy.md)。
- 本仓的上下文治理织物方案（Collect/Enrich/Activate 三相 × 四信号层 × Context Catalog/Router/Guard）见 [Context Layer 技术方案](../../concepts/design/context-layer.md)；通用可复刻基础设施的架构设计见 [Context Layer 基础设施设计蓝图](./013-context-layer-blueprint.md)。
- Snowflake 数据云调研中的 Horizon Catalog 章节见 [研究文档 §D7](../retrieval-storage/034-snowflake-data-cloud.md)。

## 参考

[1] Snowflake, "Horizon Context — Governed Semantic Layer & Data Catalog," *Snowflake Product*, 2026. [Online]. Available: https://www.snowflake.com/en/product/features/horizon-context/

[2] Snowflake, "Snowflake Horizon Context: The Governed Context Layer for AI, BI and Apps," *Snowflake Blog*, Jun. 2026. [Online]. Available: https://www.snowflake.com/en/blog/horizon-context-governed-context/

[3] Snowflake, "Snowflake Advances Trusted AI with Snowflake Horizon Catalog Centralizing Governance, Context, and Security Across the Enterprise," *Press Release*, Snowflake Summit 26, Jun. 2, 2026. [Online]. Available: https://www.snowflake.com/en/news/press-releases/snowflake-advances-trusted-ai-with-snowflake-horizon-catalog-centralizing-governance-context-and-security-across-the-enterprise/

[4] Snowflake Documentation, "Overview of semantic views," "CREATE SEMANTIC VIEW," "How Snowflake validates semantic views," "Snowflake Horizon Catalog," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/user-guide/views-semantic/overview

[5] Snowflake, "Introducing Cortex Sense: Grounded Context for the Data You Never Modeled," *Snowflake Blog*, Jun. 30, 2026. [Online]. Available: https://www.snowflake.com/en/blog/enterprise-ai-agents-grounded-context/

[6] Snowflake, "Why Do We Need Semantic Views? Avoiding Subtle Mistakes in Complex Calculations," *Snowflake Engineering Blog*, Mar. 2026. [Online]. Available: https://www.snowflake.com/en/blog/engineering/why-we-need-semantic-views/

[7] Snowflake, "Snowflake Unites Industry Leaders to Unlock AI's Potential with the Open Semantic Interchange Initiative," *Snowflake Blog*, Nov. 2025; "Apache Ossie (Incubating): The New Name for Open Semantic Interchange," *Snowflake Blog*, Jul. 2026. [Online]. Available: https://www.snowflake.com/en/blog/apache-ossie-open-semantic-interchange-incubator/

[8] Typedef, "What Is Horizon Context? Snowflake's Governed Context Layer Explained," Jun. 12, 2026. [Online]. Available: https://www.typedef.ai/blog/what-is-horizon-context-snowflakes-governed-context-layer-explained

[9] Atlan, "Snowflake Horizon Context vs the Enterprise Context Layer," Jun. 2026. [Online]. Available: https://atlan.com/know/snowflake/snowflake-horizon-context/

[10] A. K. Dey, "Understanding and Using Context," *Personal and Ubiquitous Computing*, vol. 5, no. 1, pp. 4–7, 2001.（上下文的经典学术定义）
