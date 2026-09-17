---
sidebar_position: 4
title: "Snowflake Horizon Context 精读笔记"
description: "「嵌入治理引擎、查询时强制执行」的 Context Layer 七机制（M1–M7）精读：五段式对象模型 / 查询时聚合安全 / 引擎级原生治理 / Autopilot+Cortex Sense 双轨富化 / 检索激活 / 四因子信号排序 / OSI+MCP 开放互操作，附三阶段演进全景、实证数字、批判性边界与随笔记入库的 M1–M6 最小原型"
---

> [!NOTE] **核心精读范围**
>
> - [Snowflake, "Horizon Context — Governed Semantic Layer & Data Catalog," 产品页, 2026](https://www.snowflake.com/en/product/features/horizon-context/)
> - [公告博客 "The Governed Context Layer for AI, BI and Apps," 2026-06](https://www.snowflake.com/en/blog/horizon-context-governed-context/)
> - [Summit 26 新闻稿, 2026-06-02](https://www.snowflake.com/en/news/press-releases/snowflake-advances-trusted-ai-with-snowflake-horizon-catalog-centralizing-governance-context-and-security-across-the-enterprise/)
> - [docs: 语义视图](https://docs.snowflake.com/en/user-guide/views-semantic/overview) / [CREATE SEMANTIC VIEW](https://docs.snowflake.com/en/sql-reference/sql/create-semantic-view) / [validation-rules](https://docs.snowflake.com/en/user-guide/views-semantic/validation-rules)
> - [docs: Autopilot](https://docs.snowflake.com/en/user-guide/views-semantic/autopilot) / [Verified Query Repository](https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository) / [建模与开发最佳实践](https://docs.snowflake.com/en/user-guide/views-semantic/best-practices-modeling)
> - [docs: Snowflake 官方 MCP Server](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp)
> - [Cortex Sense 博客, 2026-06-30](https://www.snowflake.com/en/blog/enterprise-ai-agents-grounded-context/)
> - [工程博客 "Why Do We Need Semantic Views?", 2026-03](https://www.snowflake.com/en/blog/engineering/why-we-need-semantic-views/)
> - [Cortex Search 检索工程博客（混合排序基准）](https://www.snowflake.com/en/engineering-blog/cortex-search-and-retrieval-enterprise-ai/)
> - [OSI 创立新闻稿, 2025-09-23](https://www.snowflake.com/en/news/press-releases/snowflake-salesforce-dbt-labs-and-more-revolutionize-data-readiness-for-ai-with-open-semantic-interchange-initiative/)
> - [OSI → Apache Ossie](https://www.snowflake.com/en/blog/apache-ossie-open-semantic-interchange-incubator/)

**一句话定位**：Snowflake Horizon Context 是 **嵌在 Data 治理引擎层、在查询时强制执行** 的 Context Layer —— 把业务定义、指标、关系、血缘、用法沉淀为受治理的元数据对象，让人、BI 工具、AI Agent 从同一份定义推理，而不是各自猜测。

> [!TIP] **怎么读笔记**
>
> 每个机制节按「类比 → 机制 → 原型」三拍进行记录和实践，M1–M7 七个机制节各配一张动效工程图，§2 另配组件全景与演进时间线两张总览图（交互版下载到本地打开，默认经典视图可切主题/缩放/聚焦，trace 动画按主路径逐边点亮）。其中实践取自配套的最小原型 [`assets/horizon_context_lab.py`](./assets/horizon_context_lab.py)（约 916 行纯标准库代码，M1–M6 六机制 + 场景矩阵 + 破坏性实验；另有 MCP 服务原型 [`assets/horizon_context_mcp.py`](./assets/horizon_context_mcp.py) 验证平台集成路径）。

配套产物：[Context Layer 基础设施设计蓝图](./013-context-layer-blueprint.md) · [Horizon Context ↔ negentropy 机制映射报告](./012-horizon-context-mapping-negentropy.md)。

---

## 1. Horizon Context 解决了什么问题？

> [!TIP] **Horizon Context 解决了什么问题？**
>
> 初级 Data Agent 就像一位 **每天都在重新入职、毫无业务常识的天才实习生**：他满腹经纶、数学和逻辑推理满分，但完全不懂企业的方言黑话与合规底线。
>
> Horizon Context 要做的，是为这位天才实习生配备一套嵌入大厦基座的「受治理带教中枢」（终极入职包：全套规章、工具与安防体系），让他秒变懂业务、守规矩的业务老司机：
>
> - 权威业务规章手册：Semantic Views 显式结构建模（M1）；
> - 内置财务防错计算器：查询时按需动态聚合推导（M2）；
> - 生物识别物理闸机：存储计算引擎原生 RBAC 与策略强制执行（M3）；
> - 速记秘书起草与助教偷师自纠：Autopilot 显式起草与 Cortex Sense 隐式挖掘自纠（M4）；
> - 智能前台问询调度：Universal Search 混合检索与考证 FAQ 精准分发（M5）；
> - 前台四维评估尺：四因子信号加权排序（M6）；
> - 全球通用工作护照与标准安全插座：Ossie 开放语义与 Snowflake 官方 MCP 互操作（M7）。
>
> 用 Snowflake 官方的话讲：*Without context, an agent guesses. With context built natively into the platform, an agent acts. With context that is also governed natively, an agent can be trusted.*

销售负责人说 Q3 收入 **\$14.2M**，CFO 报的却是 **\$12.8M** —— Snowflake 官方拿这组对账数字开场：同一份数据，两个答案。

没有人算错数，错的是 **语义无人治理**。

企业底层数据库躺着的，往往是密码般的物理列名（如毛收入叫 `amt_ttl_pre_dsc`）；真实业务指标（如净利润）的计算口径也散落在不同报表各自的 `CASE WHEN` 逻辑里。不同业务域子系统各有一套方言黑话，谁也不懂谁。

据 Snowflake 实测，**让缺乏语义治理的初级 Data Agent 直接回答企业数据问题，准确率仅有 ~25%（Snowflake 内测）/ 21%（Anthropic 独立复测）**。这并非初级 Data Agent 所使用的模型笨，而是语义没有对齐。具体体现为这三个不可自愈的系统性病灶：

1. **口径打架（含义散落）**：指标口径写在各自的散落业务里，同一个业务指标问两个子系统，能得出两套不同数字；
2. **定义漂移（脱节失效）**：外挂语义层独立于 Context Layer，底层数据表的变更会令语义立即脱节，Agent 会按过期的语义手册瞎猜；
3. **门禁穿透（治理虚设）**：权限规则只浮在外部系统，拦不住绕过中间层直查物理底表，安全防线形同虚设。

初级 Data Agent 就像一位智商超群的天才实习生，他满腹经纶、理解力极强，但完全不懂贵司的标准流程与方言黑话。

要把这位天才实习生真正培养成懂业务、守规矩的“业务老司机”，Snowflake Horizon Context 的解法是，**把业务 Context 与安全守则铸入底层引擎，使其无法被篡改与绕过**。Horizon Context 为此确立了七条贯通的 Context Layer 机制：

| 设计规格                 | 底层机制                   | 大白话                                                                       |
| :----------------------- | :------------------------- | :--------------------------------------------------------------------------- |
| **定义一次、处处生效**   | M1 五段式 Context 对象模型 | 权威业务规章只印一本，人、报表与实习生全照章引用，不再各自抄写抄错           |
| **动态现算、保真不走样** | M2 查询时语义正确性        | 配发内置防错计算器按需现场套算，绝不拿预先汇总的二手死账将就应付             |
| **原生治理、杜绝穿透**   | M3 引擎原生治理            | 门禁焊在调取底层档案库的唯一必经闸口上，物理封死所有后门，底层强制生效       |
| **行为挖掘、覆盖长尾**   | M4 双轨富化与自纠          | 秘书速记起草与助教偷师补全长尾，起草与习惯打架绝不盲猜、立即亮红灯交人工裁决 |
| **按需分发、精准激活**   | M5 检索激活                | 智能前台懂分寸精准发卷，绝不撑爆大脑；若遇资深前辈考证 FAQ 直接调出核准底稿  |
| **权威优先、压制噪声**   | M6 信号排序                | 前台四维评估尺四秤齐压，权威压过声量，越稳妥权威排越前，绝不让流行偏方误导   |
| **标准开放、随处插拔**   | M7 开放互操作              | 配发通用工作护照与标准安全插座，任何外部特聘专家工具插上就能立刻用           |

## 2. Horizon Context 全景与三阶段演进

> [!TIP] **Horizon Context 的演进**
>
> 这套带教体系的演进，是大厦知识与风控中枢的三次认知升维：
>
> - **阶段一（起草规章：从找得到到算得准）**：起初大厦只有一本冰冷的「机房资产登记簿」（只记录底层有哪些物理表）；后来为拯救四处碰壁的实习生，编制了第一部装订成册的《业务规章手册》（把含义做成受治理元数据对象）；
> - **阶段二（筑牢闸机与配强助手：守得住、填得满、送得出）**：光有手册不够，大厦直接把生物识别门禁焊进了机房承重墙（引擎原生治理杜绝绕道），同时配备速记秘书与见习助教协同补全长尾规章（双轨富化）；
> - **阶段三（跨企盟约：随处用）**：带教体系走出单一企业，与行业盟友签署通用的国际工作协议（Ossie）并装上标准工业安全插座（MCP），让任何外部智囊专家拿着护照都能无缝进驻协同（生态开放）。

### 2.1 定位：从「登记簿」到「业务的 Working Model」

Horizon Context 并非一款孤立的单点产品，而是围绕 **Horizon Catalog**（Snowflake 官方定位为 "the agentic catalog"）长出的一整套能力底座。Snowflake 给这条演进线确立的核心目标只有一个：把 Catalog 从「记录有哪些表的登记簿」升维为「真正理解业务含义的认知中枢」（**"from a system of record into a system of understanding"**）。

其背后的野心边界更为直白：为整套业务运转构建可计算、自解释的活模型，而不仅是给冷冰冰的数据表建索引（*"building a working model of your entire business, not just a catalog of your tables"*）。

![Horizon Context 组件全景：14 组件按「定义与执法 M1–M3 / 进料与富化 M4 / 检索与分发 M5–M6 / 互联与出口 M7」四簇分组，基座角色（Agent Identity · OpenLineage 摄取）与 External Lineage（Structural 全景）托底，消费端为 CoCo / CoWork / Cortex Agents 官方 Agent 矩阵。](../../assets/architecture/cognitive-context/horizon-context--component-panorama-dark.png)

> 图源（可 diff 文本）：[`horizon-context--component-panorama.mmd`](../../assets/mermaid/cognitive-context/horizon-context--component-panorama.mmd) · 交互版（下载到本地打开）：[`horizon-context--component-panorama.html`](../../assets/architecture/cognitive-context/horizon-context--component-panorama.html)

Horizon Context 所含组件与七大机制（M1–M7）的对应关系如下：

| 组件                                                                        | 一句话职责                                                     | 机制锚点           |
| :-------------------------------------------------------------------------- | :------------------------------------------------------------- | :----------------- |
| **Semantic Views**（五段式对象）                                            | 把表、关系、事实、维度、指标固化为带校验门的受治理元数据       | M1                 |
| **查询时执行**（standard SQL）                                              | 按查询 grain 动态现算聚合，以四大机制拦截「合法 SQL 错误答案」 | M2                 |
| **引擎原生治理**（RBAC / Masking / Row Access / AI Guardrails / AI_REDACT） | 策略下沉至存储计算引擎层，对所有调用方强制执行                 | M3                 |
| **Autopilot / Semantic Studio**                                             | 聚合多路信号自动起草并验证语义视图，将建模周期从数天压至数分钟 | M4                 |
| **Metadata Connectors**（源自 Select Star）                                 | 将 Tableau、Power BI、dbt 等外部存量语义资产统一摄取进目录     | M4                 |
| **Cortex Sense**                                                            | 从真实查询历史与 BI 行为中无感提炼隐式上下文并自动纠偏         | M4                 |
| **AI_VERIFIED_QUERIES**（VQR）                                              | 将专家审核通过的基准问答对沉淀为一等资产，供检索优先激活复用   | M5                 |
| **Universal Search / Cortex Search**                                        | 关键词与向量混合检索，精准定位元数据及高基数文本列             | M5                 |
| **四因子信号排序**                                                          | 融合相关性、权威度、流行度与新鲜度综合评分，压出精准 top-k     | M6                 |
| **Snowflake 官方 MCP Server**                                               | 将语义视图与检索能力打包为标准受控工具面，无缝对接外部 Agent   | M7                 |
| **Ossie**（原 OSI）                                                         | 开放统一的 YAML/JSON 语义规范，支持跨平台自由互导              | M7                 |
| **CoCo / CoWork / Cortex Agents**                                           | 消费这份 Context 的 Snowflake 官方原生 Agent 矩阵              | M5 / M7            |
| **Automatic Data Agents**                                                   | 针对 Marketplace 共享数据一键自动生成语义视图与配套 Agent      | M7                 |
| **External Lineage**                                                        | 跨异构系统完整记录「谁产出、谁消费」的端到端数据血缘           | 全景（Structural） |

**系统解构与阅读心法**：
- **定义与执法（M1–M3）**：体系的承重骨架。定义业务语义，守住数学正确与数据安全底线；
- **进料与富化（M4）**：体系的自愈血液。显式导入与隐式挖掘双轨并行，让 Context 持续自我进化；
- **检索与分发（M5–M6）**：体系的触达神经。多路召回与四因子精准排序，确保高质量输出；
- **互联与出口（M7）**：体系的开放抓手。以开放协议与标准接口，使受控 Context 随处即插即用。

此外，体系外围还配有两个关键基座角色：**Agent Identity**（为智能体签发独立审计身份，纳进统一 RBAC）与 **OpenLineage 摄取**（承载 External lineage 输入侧的标准协议）。

### 2.2 演进 Timeline：先造对象，再装治理与富化，最后开生态

**纵观全景**：两年半的演进轨迹呈现出清晰的重心迁移——前期重在**寻址召回（找得到）**，中期深耕**语义对象与引擎治理（算得准、守得住）**，后期聚焦**跨端互通与全域血缘（信得过、带得走）**。

![三阶段演进时间线：阶段一「找得到 → 算得准」（检索先行 → Semantic Views GA）、阶段二「守得住、填得满、送得出」（OSI/MCP 通道 → Select Star/Autopilot 富化 → AI_REDACT/Guardrails 治理 → Summit 整体发布）、阶段三「随处用」（Cortex Sense/Ossie/全域血缘运营），16 项里程碑零丢失、机制锚点逐一标注。](../../assets/architecture/cognitive-context/horizon-context--evolution-timeline-dark.png)

> 图源（可 diff 文本）：[`horizon-context--evolution-timeline.mmd`](../../assets/mermaid/cognitive-context/horizon-context--evolution-timeline.mmd) · 交互版（下载到本地打开）：[`horizon-context--evolution-timeline.html`](../../assets/architecture/cognitive-context/horizon-context--evolution-timeline.html)

**阶段一 · 语义对象化（2024-02 → 2025-08）：从「找得到」到「算得准」**

Snowflake 早期的 Universal Search（2024-02-20 预览）与 Cortex Search（2024-08-08 预览）共同暴露了一个痛点：Agent 面对物理裸表就像盲人摸象，哪怕找得到表名与列名，依然会编造出漏洞百出的 SQL。这促成了它们一个关键认知升级：**检索仅是起点，业务含义本身必须变成带严格校验门的受治理元数据对象**。

随着 Semantic Views 完成 GA（2025-08），M1（对象建模）与 M2（查询时执行保障）正式成形，彻底封堵了指标口径打架与跨粒度扇形陷阱。这精准契合了企业客户的刚性诉求：“我们不需要更多看花眼的仪表盘，我们需要一套能确保数学绝对正确的统一语言”（*don't need more dashboards — we need a unified language that ensures the math is right*）。

**阶段二 · 治理内嵌与双轨富化（2025-09 → 2026-06-02）：守得住、填得满、送得出**

有了语义对象后，系统必须正面回答工程落地的三个核心挑战：

- **守得住（引擎原生合规）**：治理规则从表级下沉至语义层（AI_REDACT GA 2025-12-08、Cortex AI Guardrails GA 2026-04-20），做到 Snowflake 官方强调的 *“enforced at the meaning level, not just the table level”*，无论何种查询通道均无法穿透；
- **填得满（双轨加速供给）**：人工建模成本高昂，显式轨道借力 Select Star（2025-11-24）技术整合与 Autopilot GA（2026-02-03），将建模周期从数天压缩至数分钟（*“from days to minutes”*）；隐式轨道则交由 Cortex Sense，直接从企业全量真实查询行为中逆向萃取沉睡的暗知识；
- **送得出（通道标准成形）**：OSI（2025-09-23）跨厂商语义联盟创立，Snowflake 官方 MCP Server 正式 GA（2025-11-04），双向打通外部 Agent 交互通道。在 2026-06-02 Summit 上，这一切被正式整合收拢并定名为 **Horizon Context**。如分析机构 HFS 所断言：*“AI 工作负载之战，最终将赢在元数据、血缘与信任（metadata、lineage and trust）。”*

**阶段三 · 生态开放与运营化（2026-06-30 → 至今）：走向跨生态**

完成单仓闭环后，Context 进一步升维为**随数据流动且可审计的生态通货**：

- **标准开源沉淀**：Cortex Sense 亮相（2026-07 预览）；OSI 捐赠至 Apache 基金会孵化为 Ossie（2026-07-08），联合 50+ 顶级组织共建开放语义格式；
- **原生终端就位**：面向开发者的 CoCo 与面向业务分析的 CoWork 全面就位，Cortex Analyst 顺利平滑演进为 Cortex Agents（2026-08-28）；
- **全链路血缘运营**：Power BI（2026-08-18）资产摄取与 External Lineage（2026-09-03）全面 GA，不仅把「谁在用、谁喂谁」沉淀为清晰的运营资产，更依托 Automatic Data Agents 实现“数据产品出厂即自带 Context 与 Agent”。

Snowflake 官方的运营哲学是：上下文只有在真实业务流中高频流转，才能真正释放价值（*“Context only works if it gets used.”*）。

> [!TIP] **两个 Snowflake 官方 Agent 的分工与定位**
>
> - **CoCo**：数据原生 AI 编程代理（前身 Cortex Code，2026-02-03 发布；提供 Snowsight / Desktop / CLI 三种交互形态）；
> - **CoWork**：面向知识工作者的日常业务分析助手（前身 Snowflake Intelligence，2025-11-04 GA）；
>
> - **协同定位**：二者是 Cortex Sense 隐式上下文的核心验证者与直接消费者。Sense 从历史轨迹中提炼出的隐式规则，正是在这类 Agent 的实际交互闭环中被验证与消耗。

下表归纳了两年半间 Horizon Context 演进的关键里程碑（机制详解参见 M1–M7 各节）：

| 时点                     | 里程碑                                                        | 一句话意义                                         | 笔记落点 |
| :----------------------- | :------------------------------------------------------------ | :------------------------------------------------- | :------- |
| **2024-02-20**           | Universal Search 预览                                         | 检索先行：解决「Agent 找不到表和列」的基础寻址问题 | M5       |
| **2024-08-08**           | Cortex Search 公开预览 + 检索基准发布                         | 确立文本列检索与混合排序基准                       | M5 / M6  |
| **2025-04 → 2025-08**    | Semantic Views 预览 → Summit GA → 查询 GA                     | 语义正式铸造为带校验门的受治理元数据对象           | M1 / M2  |
| **2025-09-23**           | 联合 17 家厂商发起 OSI 倡议                                   | 「语义可携带」成为跨厂商开放共识                   | M7       |
| **2025-10-02**           | Snowsight 管理面 GA + MCP Server 预览                         | 统一管理控制台就绪，开放接口起跑                   | M7       |
| **2025-11-04**           | Snowflake 官方 MCP GA + Snowflake Intelligence (后 CoWork) GA | 以标准工具面安全开放给外部 Agent                   | M7       |
| **2025-11-24**           | 宣布收购 Select Star                                          | 将外部存量语义资产摄取能力收入囊中                 | M4       |
| **2025-12**              | VQR 调优预览（12-02）；AI_REDACT GA（12-08）                  | 专家问答对资产化；出口端敏感数据脱敏上线           | M5 / M3  |
| **2026-01**              | AI 提示词内嵌语法落地；External Lineage 预览                  | Prompt 纳入受治理定义；数据血缘向仓外延伸          | M1       |
| **2026-01-27**           | OSI v1 规范定稿（33 家联盟，Databricks 入局）                 | 跨厂商语义格式定稿，核心竞对加入共建               | M7       |
| **2026-02-03**           | BUILD London：Autopilot GA + Cortex Code 发布                 | 显式建模周期实现 "from days to minutes" 跨越       | M4       |
| **2026-03**              | standard SQL 查询 GA；半可加性支持；USING 语法                | 语义执行面成熟，聚合安全保障全面齐备               | M2       |
| **2026-04**              | AI_VERIFIED_QUERIES 进 DDL；Cortex AI Guardrails GA           | 人工验证问答成为一等资产；Prompt 安全护栏就绪      | M1 / M3  |
| **2026-06-02**           | Summit：**Horizon Context 整体发布** (Agent Identity GA)      | 整合收拢为能力伞：从「登记簿」蜕变为「理解系统」   | 全景     |
| **2026-06-30 → 2026-07** | Cortex Sense 发布与私测；OSI 捐赠为 Apache Ossie              | 隐式行为挖掘亮相；开放规范迈入顶级开源基金会       | M4 / M7  |
| **2026-08 → 2026-09**    | Power BI 摄取 GA；External Lineage GA；Agent 血缘上线         | 跨系统血缘与多端消费全面落地，生态运营常态化       | M4 / M7  |

## 3. M1 · 五段式 Context 对象模型：把语义便利贴装订成册

> [!TIP] **类比**
>
> 过去企业散落的业务口径，就像工位隔板上贴满的私人便利贴与杂乱草稿，写满了硬编码的 SQL 片段，天才实习生看一眼就晕头转向；
>
> M1 机制要做的，就是把这些便利贴全部撕下、规范归档，统一装订成一本**官方核准的《标准业务规章手册》**：
>
> - 明确界定核准账本（TABLES）、勾稽路径（RELATIONSHIPS）、原始凭证量（FACTS）、切片维度（DIMENSIONS）与官方指标（METRICS）；
> - 每条规章都标明责任人与版本号，手册附录里甚至贴心地附带了「实习生提示指南」（AI_SQL_GENERATION）与「资深前辈考证过的经典 FAQ」（AI_VERIFIED_QUERIES）。

> [!NOTE] **机制**
>
> 五段式声明：
>
> - **TABLES**（带 PRIMARY KEY/UNIQUE 约束）
> - **RELATIONSHIPS**（声明式 join，FK 必须指向键列）
> - **FACTS**（行级量，可 `PRIVATE`）
> - **DIMENSIONS**（切片维度，可挂 Cortex Search）
> - **METRICS**（命名聚合）
>
> 语义视图（`SEMANTIC VIEW`）：**Snowflake 官方明确定义为元数据**（"Semantic views are considered metadata"），与数据同库同治理。
>
> 对象字段里藏着的五个设计：
>
> 1. **`WITH SYNONYMS`**：Agent 召回所需的别名本身就是受治理上下文（「毛收入/营收/sales」写进定义）。Snowflake 官方最佳实践对此相当克制：synonyms "generally add little accuracy"，自动生成的别名常降质、须人工精修；真正第一位的是 descriptions——"the single most important element for accuracy"；
> 2. **`AI_VERIFIED_QUERIES`**：人验证过的问答对成为一等资产：`QUESTION + SQL + VERIFIED_AT + VERIFIED_BY (purpose=contact)`，**答案样例带审计溯源**（完整激活口径见 M5）；
> 3. **`AI_SQL_GENERATION / AI_QUESTION_CATEGORIZATION`**：给 Agent 的提示词内嵌在定义里，随定义分发、随定义治理；
> 4. **`PRIVATE | PUBLIC`**：事实与指标级可见性；
> 5. **`NON ADDITIVE BY (dims)`**：半可加性声明（见 M2）。
>
> **注册校验门的完整规则面**（validation-rules 文档）：
>
> - FK 必须指向键列（原型 D6 演示的就是这道门）；
> - 传递关系自动推导：line_items → orders → customer 一跳可达；基数合成有律——1-1 链保持 1-1，1-1 + 多对一 → 多对一；
> - 自引用暂不支持（employee/manager 一类的层级）；
> - 两表间存在多条关系路径时，两表互相不可引用对方的语义表达式，metric 必须显式指定路径（与 M2 的 USING 消歧同源）；
> - 跨粒度引用须嵌套聚合（如 `AVG(SUM(orders.o_totalprice))`）；维度可引用更高粒度表，metric 不能引用本表 metric；
> - 窗口函数 metric 不可行级计算、不可被引用。
>
> 这套规则的价值要倒过来读：校验门不是为了拒绝而拒绝，而是把「语义注册」从自由文本变成**可判定的结构**——M2 的执行保障全部依赖这里注册的基数与路径信息。
>
> **DDL 治理位（一行式）**：`CREATE OR ALTER`（幂等更新定义）· `TAG`（治理标签）· `COPY GRANTS`（重建时保留授权）· `LABELS=(FILTER)`（指标可过滤标签，2026-05 落地）· relationship 支持 `ASOF` 与 range join（时点对齐类关联）。
>
> 四层 Context（Snowflake 官方 FAQ）：
>
> - **Structural**：有什么、怎么连
> - **Operational**：查询、新鲜度、性能
> - **Semantic**：定义、指标、本体
> - **Behavioral**：热度、用法模式
>
> 这四层 Context 是在 Collect → Enrich → Activate 三段式流水线上流转的原料。最后一个伏笔：这套对象的输入面后来被一场收购大幅拓宽——Snowflake 官方明说 Horizon Context 的相关能力「建立在 Select Star 收购之上」（2025-11-24 宣布；Wave 1 五个元数据连接器 PostgreSQL、SQL Server、Tableau、Power BI、dbt 即源于此，见 M4 与时间线）。

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

## 4. M2 · 查询时语义正确性：发「防错公式」不发「死报表」，保现场推导不保原料残缺

> [!TIP] **类比**
>
> 规章手册里的业务指标不是预先抄死在纸上的固定数字（死报表），而是配发给实习生的一台**「内置财务勾稽防错逻辑的智能计算器」**。无论主管需要哪个维度的业务切片，实习生都拿着机房里最底层的原始单据凭证、按当下的统计需求现场套算。
>
> 这台计算器在底层焊死了四大防错逻辑（先汇总再拼接、按人头去重、先合总盘再求商、期末结余末快照），无论怎么切，实习生按键套算绝不会踩进金额被动翻倍或均值失真的陷阱；但若上游交接时早已把原始凭证粉碎、只扔来一张粗暴汇总好的二手旧账（如 dbt 已把日活预聚合成日汇总），计算器再聪明也逆向推导不出原始明细流水。
>
> **这套机制确保「只要底层原始凭证与查询切片合理，实习生按计算器现场套算绝不会错」，但无法拯救「上游粗暴预处理导致的原料残缺」**。

> [!NOTE] **机制**
>
> 为什么让初学者或 LLM 自己写关联查询（JOIN）极易翻车？Snowflake 官方的定性一针见血："SQL is a literal language, but business logic is contextual."——数据分析领域存在一个隐蔽杀手：**“语法完全合法，但业务答案全错”（*that was valid SQL, but it was not valid analytics*）**。大模型在工业级基准测试（如 TPC-DS）中也频频踩坑。为此，Horizon Context 在底层内嵌了“四大聚合保障 + 一个消歧路径 + 一条性能后手”，彻底封堵常见算错陷阱：
>
> 1. **先聚后连（agg-before-join）**：防“金额被动翻倍”。两表关联时，各自指标先在本地汇总再做拼接；防止一笔 $100 的订单因关联了 3 条送货记录而被机械复制放大成 $300（行业经典的 **fan trap / 扇形陷阱**，如 Sam Waters 案）；
> 2. **按集合去重（distinct 聚合跨 join 安全）**：防“重复虚增人数”。`COUNT(DISTINCT)` 跨表关联时，严格按去重集合而非物理行数统计，即使底层因连接膨胀出多行，活跃客户等去重指标依然准确；
> 3. **先合总数再相除（derived 先聚后除）**：防“平均数的平均数”。计算客单价或利润率等派生指标时，强制先汇总总分子与总分母再做除法 `DIV0(total_revenue, total_cost)`，防止各部门平均值直接相加求二次平均产生荒谬失真（如真实平均为 4.8，朴素均值却算成 16.0 的 **average of averages 陷阱**）；
> 4. **半可加性末快照（NON ADDITIVE BY）**：防“账户余额跨天累加”。银行账户余额可以跨部门相加，但绝不能把 30 天的余额当流水相加；系统识别半可加指标，按时间序列自动取**最新期末快照**而非机械求和（该子句出自 CREATE SEMANTIC VIEW 文档、2026-03-05 落入 DDL，工程博客并未提及）；
> 5. **显式指定关联路径（USING relationship）**：防“笛卡尔积爆炸”。当两张表之间存在多条连接通道（如订单表同时包含“发货地址”与“收货地址”）时，显式指定唯一关系路径，消除歧义，避开两眼一抹黑的 **chasm trap（深渊陷阱）**；
> 6. **按需物化与自动改写（Advanced Semantics，私有预览）**：解「重算保正确 vs 物化保性能」的两难。同一份定义可以有两个执行策略——默认按查询 grain 重算（保正确）；用户自定义物化 + 引擎自动改写查询、无感命中物化（保性能），另含 level-of-detail 计算与可组合定义。代价受 `MAX_STALENESS` 约束：最小 120 秒、一旦配置物化便不可取消——用受控的过期容忍换性能，业务定义始终只有一份。
>
> Snowflake 官方对这套对象的一句话定位："A semantic view isn't just a technical layer; it's an insurance policy for your data's integrity."

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

## 5. M3 · 引擎原生治理：门禁焊在大楼承重墙，杜绝任何绕道直查

> [!TIP] **类比**
>
> 传统的外挂治理，就像在公司大堂立了一块“闲人免进”的塑料易拉宝，或者雇了个外包保安在门口查工牌。表面看似合规，但只要有人绕过大堂从侧门溜进地下原始凭证机房（直查物理底表），核心机密就会被看个精光；
>
> Horizon Context 则是直接把**生物识别闸机焊死在机房唯一的承重墙入口处**——无论是资深前辈、BI 分析软件还是新来的天才实习生，任何人调取底层原始凭证都必须在数据库引擎底层刷卡验身；被标记为绝密（PRIVATE）的账目连目录都不予展示，彻底封死所有绕道后门。

> [!NOTE] **机制**
>
> Snowflake 官方给出的核心准则是：**治理策略直接在查询引擎层执行，而不是在应用层做样子**（*Governance policies execute at the query engine layer, not the application layer. They apply automatically to every caller: human analyst, BI tool, or AI agent. There is no separate governance configuration for AI workloads.*）。系统对人与 AI 一视同仁，不设立孤立脆弱的“AI 专用防线”，并在底层铸造了四重刚性约束：
>
> 1. **权限同源（owner's rights + 统一 RBAC 与私密隔离）**：AI Agent 与真实员工共享同一套权限体系；语义视图按 owner's rights 执行——查询者无需逐个底表授权；被标记为 `PRIVATE` 的敏感指标在底层对无权者直接不可见、不可查。一个例外要记牢：Cortex Agents 走语义视图时须同时持有语义视图与底表的 SELECT；
> 2. **策略随含义传播**：底表的 masking / row-access policy 自动传播到语义视图并强制执行——治理是 "enforced at the meaning level, not just the table level"；语义“住”在治理引擎里、查询时执行而非拷贝缓存（"semantics live inside the governance engine and are enforced at query time, not copied or cached"）。权限与安全标签随数据产品一路携带（即使分享到外部 Marketplace 也不会丢失策略）；
> 3. **出口安检（两个指称要分开）**：拦 prompt injection / jailbreak 攻击面的是 **Cortex AI Guardrails**（GA 2026-04-20，2026-05-14 扩展）；PII / PHI 实时脱敏是 **AI_REDACT**（GA 2025-12-08，单次 4096 token 上限）与 Cortex Guard 的职责——两件事常被混为一谈，实际是两套机制；
> 4. **底层兜底不可绕过（跨引擎一致执行）**：无论是本地查询还是通过开放格式（如 Iceberg REST 兼容引擎）调用，所有安全策略均在引擎深处刚性生效。Snowflake 官方一针见血指出：第三方外挂层根本拦不住直接查物理表，而内嵌于引擎的治理谁也绕不过去（*cannot be circumvented*，具体边界见批判性边界第 3 条）。定义变更的纪律同样刚性：除 `COMMENT` 外不可原地 ALTER，改定义须 `CREATE OR REPLACE` 重建（配合 `COPY GRANTS` 保留授权）；semantic models 亦无批量转换路径。
>
> 一条例外要盯住：**sample values 是元数据、不脱敏**——它经 `GET_DDL WITH EXTENSION` 暴露，Snowflake 官方仅「建议」放代表性非敏感值而无强制（见批判性边界第 6 条）。

![引擎原生治理双层防线：人/BI/AI Agent 以同一套 RBAC 进入，检索层过滤 PRIVATE 维度（体验），引擎内底表 masking/row-access 策略自动传播、执行层 RBAC 拒绝 PRIVATE 资产（底线），直查物理底表的绕行同样被引擎拦截；出口经 Cortex AI Guardrails 安检与 AI_REDACT 脱敏后交付受治理结果。](../../assets/architecture/cognitive-context/horizon-context--engine-governance-dark.png)

> 图源（可 diff 文本）：[`horizon-context--engine-governance.mmd`](../../assets/mermaid/cognitive-context/horizon-context--engine-governance.mmd) · 交互版（下载到本地打开）：[`horizon-context--engine-governance.html`](../../assets/architecture/cognitive-context/horizon-context--engine-governance.html)

> [!IMPORTANT] **原型实践**
>
> 实际运行输出的双层防御自证（C2 破坏性实验）：
>
> ```text
> [PASS] C2: RBAC 双层: 检索层对 intern 过滤 plan 建议（["dim_filtered (PRIVATE): ['plan']"]，
> 降级总量 {(): 650}）；直闯执行层 → AccessDenied（引擎是最后防线）
> ```

## 6. M4 · 双轨富化与自纠：手册写不全看习惯补，两轨冲突绝不盲猜

> [!TIP] **类比**
>
> 仅靠资深专家手写规章手册（Semantic Views）权威严谨，但耗时耗力，在庞大的大厦里往往只能覆盖不到 5% 的核心业务，绝大多数长尾提问在手册里根本翻不到。
>
> 为此，大厦为规章编撰配备了「一明一暗」两条自动化富化轨道：
>
> - **显式速记起草（Autopilot）**：如同高效的速记秘书，自动把现成的外部报表模型与历史问答对快速起草成规章草案，经校验后补充入册；
> - **隐式随行偷师（Cortex Sense）**：如同一位见习助教，在绝不窥探机密凭证（不碰真实数据行）的前提下，默默观察资深前辈每天调用的上千条查询习惯和常用报表，把沉睡的暗知识提炼成册，补齐剩下的 95%；
>
> 但整个带教体系有一条**铁打的纪律底线**：当起草的规章与助教提炼的民间习惯口径打架时，系统**绝对不准自作主张瞎蒙一个**，必须老老实实向业务主管亮起红灯（冲突浮出），交由人工裁定归属。

> [!NOTE] **机制**
>
> Snowflake 内部实测揭示了一个残酷现实：全司 9,685 张数据表中，人工构建的语义视图覆盖率**不足 5%**——“手册内的问题答得极好，但大多数日常提问都落在手册外的荒原”。为此，Horizon Context 给「把手册写厚」配了两条轨道。
>
> **显式轨道的加速器：Autopilot（GA 2026-02-03）**。专家手写 YAML 的产能是瓶颈，Autopilot 以六路输入面接管起草：
>
> 1. 从零开始；
> 2. 与 CoCo 对话生成 YAML，以 inline diff 逐条接受或拒绝；
> 3. 导入 Tableau 文件（TWB/TWBX/TDS/TDSX）；
> 4. 导入 Power BI 文件（.pbit/.pbix）；
> 5. 自然语言问题 + SQL 对（或两列 CSV）；
> 6. YAML 上传。
>
> 起草不是终点，每条候选都过**验证门**：自动验证并丢弃无效查询、提取表/列/关系，**有效者自动入库 verified queries**；主键靠元数据分析或 distinct 计数推断；还会从创建角色的查询历史建议常用查询。Snowflake 官方口径的收益："from days to minutes"。规模护栏：首个视图 <10 表、≤50 列；其管理面 Semantic Studio 已于 2026-08-26 公开预览。（文件级导入之外，目录级的外部资产摄取走 Metadata Connectors——Wave 1 五连接器源自 Select Star 收购，见 M1。）
>
> **隐式轨道：Cortex Sense（2026-07 私有预览）**。从日常查询历史、转换工具模型和 BI 指标中自动拼装隐式理解。Snowflake 官方对其定位说得很清楚——"designed to work alongside semantic views, not instead of them"。
>
> 隐私边界同样明确："will only ingest metadata and usage patterns, not your actual data rows"（只摄取元数据与使用模式，不碰真实数据行）。
>
> 两条轨道的交汇点是 verified queries：Autopilot 把验证过的问答直接铸进语义视图，Sense 把行为里挖出的候选提交 Suggestions；一显一隐，最终汇入同一份受治理资产（候选入选标准见 M5）。
>
> 为了彻底防范“自动挖掘会导致系统自信满满地胡说八道（confidently wrong）”，两轨共享三层纪律防线：
>
> 1. **反馈自纠环（Eval Loop）**：接入金标准问答集、用户点赞/点踩反馈与系统自检薄弱区三路输入，一旦识别出理解错配即自动修正；
> 2. **冲突强制浮出（Conflict Escalation）**：当挖掘出互相矛盾的指标口径（如不同团队对活跃用户的定义冲突）时，系统主动拒答，并向数据团队弹出冲突卡片，由人工自然语言指认归属。Snowflake 官方强调：*这种敢于承认不知道的诚实底线，彻底拉开了它与那些“搜到什么就硬答什么”的普通 RAG 之间的本质差距*；
> 3. **信号分层排序**：赋予受治理金标准更高的权威权重（详见 M6）。
>
> **实证成效**：在“口径过时”与“未人工覆盖”两个长尾地带，自动化富化的准确率反超纯人工标注 10 个百分点；整套上下文底座的搭建耗时从数月缩短至单日内。

![Autopilot 创作闭环：六路输入面汇入验证门（无效查询被丢弃），有效者铸成受治理的语义视图与验证问答对，经激活供给 agent，使用反馈回流富化信号。](../../assets/architecture/cognitive-context/horizon-context--autopilot-loop-dark.png)

> 图源（可 diff 文本）：[`horizon-context--autopilot-loop.mmd`](../../assets/mermaid/cognitive-context/horizon-context--autopilot-loop.mmd) · 交互版（下载到本地打开）：[`horizon-context--autopilot-loop.html`](../../assets/architecture/cognitive-context/horizon-context--autopilot-loop.html)

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

## 7. M5 · 检索激活：懂分寸的智能前台，按需精选绝不填鸭

> [!TIP] **类比**
>
> 面对浩瀚的规章手册与海量的历史用数记录，带教大厅的**「智能前台调度员」**绝不会把整座档案库一股脑砸向实习生——那不仅会瞬间撑爆新人的大脑（上下文窗口超载并诱发严重幻觉），还会浪费极高的沟通与算力成本；
>
> 前台调度员极懂分寸：当实习生领着业务问题跑来问询时，调度员迅速从海量规章中撕下最精准的 2~3 页递给新人；更省心的是，如果发现这道题资深前辈早已核准过标准业务范式（AI_VERIFIED_QUERIES 经典 FAQ），调度员直接调出盖章核准的底稿让新人作答，连现场推算都省了。

> [!NOTE] **机制**
>
> 当 Agent 提出自然语言数据问题时，系统采用 **“关键词 + 语义向量”混合匹配**（Universal Search 混合排名），在海量元数据中精选出 top-k 的上下文知识包（包含字段定义、分析指令与验证问答），据此激活 Agent 生成精准 SQL。
>
> 精选不是优化项而是硬约束：Snowflake 官方建模实践给整视图设了 ~100,000 token 上限（见动手实践），超出即被 Cortex Agents 剪枝、延迟与质量双伤。
>
> **验证问答（VQR）的 Snowflake 官方口径**：相似问题命中已验证问答对时，系统**以已验证查询为生成依据**——Snowflake 官方原话是 "leverages relevant SQL queries ... to generate the SQL query"，即拿验证过的 SQL 作底稿生成，而非盲目照抄重放。
>
> 每条 VQR 的完整字段：`QUESTION + SQL + VERIFIED_AT + VERIFIED_BY (purpose=contact) + ONBOARDING_QUESTION`（引导期问题标志，2026-04-05 进 DDL）；REST 响应带 confidence 字段可查命中情况。VQR Suggestions 的三条入选标准：高频使用、有语义信息量（剔除极简单问题）、相对存量新颖。
>
> **新表冷启动兜底**：面对两周前刚上线、尚无人工语义视图覆盖的新表，纯 Semantic View 路径的 Agent 会直接“拒答”，通用 Agent 会“自信答错”，而本机制能以推断口径结合风险告警（`no_governed_coverage`）平稳破局。
>
> **第二组 Snowflake 官方基准（注意口径）**：CoWork 博客（2026-06-02）给出 "83% accuracy rate when using Cortex Sense compared to 47% for CoCo and CoWork alone, and 23% for Frontier Coding Agents"（using Snowflake MCP；internal testing、complex enterprise queries）——它与 Cortex Sense 博客的 24.1% → 86.3% 是**两组不同口径的自报基准**，读法见关键实证数据与批判性边界第 1 条。

![检索激活时序：Agent 提问经 Universal Search 关键词+向量混合检索目录，命中已验证问答（VQR）即以已验证查询为生成依据（confidence 可查），未命中则取 top-k 上下文包生成 SQL 交引擎按查询 grain 重算；新表冷启动显式 no_governed_coverage 警告而非静默推断。](../../assets/architecture/cognitive-context/horizon-context--resolve-activation-dark.png)

> 图源（可 diff 文本）：[`horizon-context--resolve-activation.mmd`](../../assets/mermaid/cognitive-context/horizon-context--resolve-activation.mmd) · 交互版（下载到本地打开）：[`horizon-context--resolve-activation.html`](../../assets/architecture/cognitive-context/horizon-context--resolve-activation.html)

> [!IMPORTANT] **原型实践**
>
> A1 验证问答命中、A1b 引擎重算对账与 C1 无手工覆盖推断胜出实际运行输出（原型实现为直接复用验证答案，故 lab 输出沿用「短路重放」字样；Snowflake 官方产品口径是「以已验证查询为生成依据」）：
>
> ```text
> [PASS] A1: verified 短路重放 + 溯源: verified_query {'2026-01': 200, '2026-02': 150,
> '2026-03': 300} by ( data_governance = data-team@acme.com )
> [PASS] A1b: 引擎重算 == 验证答案（对账一致）: [200, 150, 300]
> [PASS] C1: 新表无 SV: inferred 条目胜出 + 警告 ['no_governed_coverage']；覆盖 4/5 表
> ```

## 8. M6 · 信号排序：前台四维评估尺，权威压过声量

> [!TIP] **类比**
>
> 前台案头堆着成百上千条可选的规章条目与历史用数经验，究竟该把哪条指引递给实习生？调度员心里有一套严格的**「四维权衡评估尺」**：
>
> - **契合度（Relevance）**：跟实习生当下的业务提问贴得有多紧；
> - **权威度（Authority）**：是合规委员会盖红章的正式法条，还是见习助教挖掘出的民间习惯；
> - **流行度（Popularity）**：在资深前辈过去数百次实战中是不是大家公认好用的标准套路；
> - **新鲜度（Freshness）**：是本月刚修订生效的新规，还是两年前早已作废的老黄历。
>
> 四杆秤齐压，权威压过声量——越稳妥、越权威的指引越排在前面，绝不让声量大的民间偏方误导新人。

> [!NOTE] **机制**
>
> 先正一个归属：这套混合排序的工程出处是 **Universal Search / Cortex Search 的检索栈**（Snowflake 工程博客给出完整量化曲线）；CoCo 与 CoWork 是消费这套排序的代理，不是排序器本身。
>
> 在此之上，Cortex Sense 引入类似顶级网页检索的 **四因子信号排序体系**：
>
> 1. **相关性（Relevance）**：字面关键词与深层业务意图双重高契合；
> 2. **权威度（Authority）**：数据团队人工治理的正式语义视图，权重压倒性高于从零星查询推断出的民间口径；
> 3. **流行度（Popularity）**：在 500 条生产 SQL 中千锤百炼的高频关联模式，权重远重于只出现过 3 次的偶发写法；
> 4. **新鲜度（Freshness）**：本月新修订的最新指标定义，果断压制两年前早已失效的历史旧逻辑（Legacy）。
>
> 为什么排序值得单列一机制：富化解决「有没有」，检索解决「给多少」，排序解决「先给谁」——三件事正交，且排序的权重错配会直接放大 M4 警惕的多数派错误。
>
> **四因子有效性的唯一 Snowflake 官方量化证据**（Cortex Search 工程博客）：NDCG@10（前 10 名结果的排序质量分）从 0.22（纯词法）→ 0.49（向量）→ 0.53（混合）→ 0.59（+重排器）步步抬升；hit rate@1（首位命中率）从 0.79 → 0.83（+流行度）→ 0.86（+新鲜度）。
>
> 每加一层信号就涨一截——这就是把排序独立成机制的实证理由。
>
> 权威度权重与 M4 的冲突纪律互为双保险：即便某条民间口径流行度更高，governed 定义仍排其前；真到了口径打架的地步，则交 M4 的冲突浮出机制人工裁决，排序绝不代裁。

![四因子信号排序数据流：问题信号、governed/inferred 条目权威度、查询日志热度与更新时钟分别流入 relevance(0.4)/authority(0.3)/popularity(0.2)/freshness(0.1) 四个评估因子，加权合成后经显式 tie-break 输出有序 top-k 上下文包。](../../assets/architecture/cognitive-context/horizon-context--four-factor-ranking-dark.png)

> 图源（可 diff 文本）：[`horizon-context--four-factor-ranking.mmd`](../../assets/mermaid/cognitive-context/horizon-context--four-factor-ranking.mmd) · 交互版（下载到本地打开）：[`horizon-context--four-factor-ranking.html`](../../assets/architecture/cognitive-context/horizon-context--four-factor-ranking.html)

> [!IMPORTANT] **原型实践**
>
> C5 新鲜度隔离实际运行输出；排序对行为反馈的动态响应见 M7 原型实践的 T6：
>
> ```text
> [PASS] C5: freshness 隔离: 'sales' → governed revenue(fresh=0.96) 压过 legacy(0.00):
> [('revenue', 'governed', 0.854), ('revenue', 'legacy', 0.826)]
> ```

## 9. M7 · 开放互操作：通用工作护照与安全插座，打破厂商私有围墙

> [!TIP] **类比**
>
> 如果这套精密的带教体系被锁死在企业内网定制的特制终端机里，外部聘请的高级智囊专家（如 Claude、Cursor 等外部高级 Agent）就根本无法接入大厦协同作战，沦为封闭的“认知孤岛”；
>
> 真正的现代企业必须配发**「全球通用工作护照与标准工业安全插座」**：
>
> - **护照通用（Ossie 开放语义规范）**：规章手册不写成厂商私有的加密暗号，而是采用行业通行的国际标准语言，外部特聘专家一翻即懂；
> - **插座通用（Snowflake 官方 MCP Server）**：在机房前装配标准的工业安全接口，外部特聘专家插上插头就能与大厦数据无缝对话，同时依然全程佩戴安全缰绳，严格受物理承重墙闸机（M3）监管。

> [!NOTE] **机制**
>
> 语义可携带性已成为跨厂商的行业共识。Horizon Context 通过两条开放路径，彻底打破了厂商锁定（Vendor Lock-in）：
>
> 1. **静态定义互通：OSI → Apache Ossie（开源通用语义规范）**：
>    - **起点是 2025-09-23**：Snowflake、Salesforce、dbt Labs 等 17 家联合创立 Open Semantic Interchange，Tableau CPO 称其为 "the Rosetta Stone for business data"；
>    - **增长曲线**：17 → 28（2025-11-13，AWS/Collibra/DataHub/JPMC/Starburst 等加入）→ 33（2026-01-27 v1 定稿，AtScale/Databricks/JetBrains/Qlik 等加入）→ 54（2026-06 Summit）→ 50+（2026-07-08 捐入 Apache 孵化器更名 Ossie）；
>    - **组织形态**：下设 Metric Language、Catalog、Ontology 三个工作组（2025-10-17 首次工作组会议）；
>    - **治理转轨**：入 Apache 后交由 foundation-led governance；dbt MetricFlow 以 Apache 2.0 许可成为初始参考实现（已交付的转换器还有 Apache Polaris 与 Snowflake Semantic Model）；Snowflake 官方迁移承诺："If you've been building on Open Semantic Interchange, nothing breaks. The name changed, but the spec didn't."；
>    - 语义视图可经 `SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML` 从规范 YAML 创建（转换是工具级操作，别按「导入即用」预期）；
> 2. **运行时动态互通：模型上下文协议（MCP）标准连接器（GA 2025-11-04）**：
>    - **5 类工具面**：`CORTEX_AGENT_RUN` / `CORTEX_SEARCH_SERVICE_QUERY` / `CORTEX_ANALYST_MESSAGE` / `SYSTEM_EXECUTE_SQL` / `GENERIC`；Snowflake 官方推荐只暴露单个 Cortex Agent 作为面向客户端的唯一工具；
>    - **安全边界**（这组限制的共同逻辑：把「能经 MCP 做的事」收窄到可审计的最小面）：协议随 MCP revision 2025-11-25 对齐；OAuth scopes（`session:role:*`，建议 `OAUTH_USE_SECONDARY_ROLES=NONE`）；每 server ≤50 个工具；GENERIC/SQL 响应 250KB 截断；2026-08-20 起 tools/call 走 SSE 流；server 不随 failover 组复制；Native Apps 可携带 MCP（2026-07/08 GA）；
>    - **能力边界**：只支持 semantic views、不支持 semantic models（Snowflake 官方原话 "only supports using semantic views with Cortex Analyst. It does not support semantic models."）；Snowflake 官方并建议 Cortex Analyst 用户迁移到 Cortex Agents（2026-08-28，语义视图与 VQR 沿用）；
>    - 无论是桌面端的 Claude Desktop，还是开发环境中的 Claude Code、Cursor，添加自定义连接器即可在受控前提下直接问数。
>
> **生态分发面：Automatic Data Agents（Preview Open）**——对 Marketplace 清单/共享数据一键生成 semantic view + Cortex Agent，生成约 10 分钟、重建会覆盖手工修改：context 首次成为随数据产品自带的「出厂附件」。
>
> 与 dbt 的分工，Snowflake 官方给了一句干净话术："Use dbt to transform; use Horizon Context to govern meaning."
>
> **闭环安全保障**：外部工具调用绝不等于“安全裸奔”。即使通过外部 MCP 跨协议调用，底层引擎的 RBAC 与私密过滤（PRIVATE）依然刚性生效。
>
> 同时外部交互产生的使用反馈，会实时回流反哺内部热度排序——M6 的 popularity 因子在开放生态里继续积累训练样本。

![开放互操作双路径：引擎内语义视图经 SYSTEM$ 函数与 Ossie 开放规范（dbt MetricFlow 参考实现）实现静态定义互通，经 Snowflake 官方 MCP Server（OAuth scopes、每 server ≤50 工具、SSE 流）向外部 Agent 受控供给；RBAC/PRIVATE 随调用刚性生效，使用反馈回流 popularity 排序。](../../assets/architecture/cognitive-context/horizon-context--open-interop-dark.png)

> 图源（可 diff 文本）：[`horizon-context--open-interop.mmd`](../../assets/mermaid/cognitive-context/horizon-context--open-interop.mmd) · 交互版（下载到本地打开）：[`horizon-context--open-interop.html`](../../assets/architecture/cognitive-context/horizon-context--open-interop.html)

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

## 10. 关键实证数据

读表先记一条：除 21%（Anthropic 复测）与 477 vs 48（Typedef 复现）外，其余数字均为 Snowflake 官方或原厂自报——两组第三方数字恰好都打在「基线与陷阱」上，增益端始终没有独立复现（见批判性边界第 1 条）。

| 实验                                         | 关键数据                                                                    | 一句话读法                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 无 Context 基线（Cortex Sense 博客）         | ~25%（Snowflake 内测）；21%（Anthropic 独立复测）                           | 两家独立测出同一结论：缺业务含义时 agent 就是瞎猜                            |
| CoCo + Cortex Sense（同上）                  | 准确率 24.1% → 86.3%；成本 $1.76 → $0.59/query                              | Context Layer 把准确率抬 3.6 倍、成本砍 2/3（自家基准，见批判性边界第 1 条） |
| Sense 第二组基准（CoWork 博客，2026-06-02）  | 83%（Sense 加持）vs 47%（CoCo/CoWork 裸用）vs 23%（Frontier Coding Agents） | internal testing、complex enterprise queries 口径——与上一行不是同一组实验    |
| 覆盖率现实（Cortex Sense 博客）              | 9,685 表 semantic view 覆盖 <5%                                             | 纯手工金标准覆盖不动——隐式轨道的存在理由                                     |
| 检索分层增益（Cortex Search 工程博客）       | NDCG@10 0.22→0.49→0.53→0.59；hit rate@1 0.79→0.83→0.86                      | 词法→向量→混合→重排，每加一层涨一截（M6 四因子的量化底座）                   |
| fan trap（工程博客）                         | $100 → $300（join 复制后）                                                  | valid SQL ≠ valid analytics                                                  |
| average of averages（同上）                  | 16.0 vs 4.8                                                                 | 无加权平均把大小团队同权                                                     |
| distinct 跨时间相加（Typedef 复现）          | 玩具 4 vs 3；生产 477 vs 48                                                 | governed 定义在塌缩 grain 上照样错——治理 ≠ 验证                              |
| OSI → Apache Ossie                           | 17（2025-09-23 创立）→ 28 → 33（v1 定稿）→ 54 → 50+；100+ commits / 35 PRs  | 语义可携带已成行业共识，非单一厂商私产                                       |
| Automatic Data Agents（Snowflake 官方 docs） | 一键生成语义视图 + Cortex Agent；生成约 10 分钟；重建会覆盖手工修改         | context 随 Marketplace 数据产品分发的生态通货                                |
| 本原型                                       | 200 vs 440；7 vs 24；[3,1,2] vs [6,1,2]；108.33 vs 122.22                   | M1–M6 机制在玩具域的逐点复现（见动手实践）                                   |

## 11. 动手实践

把机制亲手拆坏七次，运行方式（秒级，仓库根目录执行）：

```bash
uv run --no-project python docs/research/cognitive-context/assets/horizon_context_lab.py --selftest
uv run --no-project python docs/research/cognitive-context/assets/horizon_context_mcp.py --selftest
```

机制 → 代码位置速查（`horizon_context_lab.py`；M7 的原型在 MCP 文件）：

| 机制                     | 位置                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| M1 五段式对象 + 验证问答 | `SemanticView` :157 · `VerifiedQuery` :148 · `build_sales_view` :170                                                |
| M1 结构校验门            | `validate_view` :232（FK→键列 / ≥1 dim+metric / 重名 / NON ADDITIVE 维度存在）                                      |
| M2 查询引擎 + 破坏开关   | `compile_query` :375 · `_naive_joined_rows` :316（策略 B 反事实）· `_aggregate` :342 · USING 消歧 `_dim_value` :288 |
| M3 双层 RBAC             | 执行层 `compile_query` :375 内 `enforce_rbac` 分支；检索层 `resolve` :532 的 `dim_filtered`                         |
| M4 冲突隔离 + 自纠环     | `Catalog.detect_conflicts` :493 · `adjudicate` :509 · `eval_loop` :629                                              |
| M5 检索 + mock agent     | `resolve` :532 · `mock_agent` :596（verified 短路 / compile / cannot_answer）                                       |
| M6 四因子排序            | `rank` :463 · `freshness` :452（REF_DATE 固定字面量）                                                               |
| M7 MCP 开放互操作        | `horizon_context_mcp.py`（stdio 服务 + T1–T8 场景自测，运行命令见上）                                               |

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

七次实验与 Snowflake 官方规则面一一对应：D1/D2/D7 打 M2 的保障 1–3，D3 打 NON ADDITIVE BY，D4 打冲突纪律，D5 打引擎执法，D6 打注册校验门。

玩具域之外，Snowflake 官方「建模最佳实践」给了真上生产的七条护栏：

| Snowflake 官方建议                              | 一句话理由                                  |
| ----------------------------------------------- | ------------------------------------------- |
| 首个语义视图 5–10 表、≤50 列起步                | 小闭环先跑通，巨无霸视图是反模式            |
| 整视图控制在 ~100,000 token 内                  | 超限会被 Cortex Agents 剪枝——延迟与质量双伤 |
| 生产规模按 50+ 视图规划                         | 分域拆视图，不是一个视图装天下              |
| eval 集准备 ~10 题                              | 先建小而准的验收闭环                        |
| VQR 不是越多越好：>20 条会拖慢优化              | 验证问答参与匹配与生成，过量反噬            |
| Cortex Search 只挂高基数文本列（>~10 distinct） | 低基数列挂检索是浪费                        |
| 首个用例避开 Finance/Legal                      | 高敏域试点等于自找最严审查                  |

上线后的可观测性也有 Snowflake 官方面板：

| 面板         | 入口                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| 语义对象清单 | INFORMATION_SCHEMA / ACCOUNT_USAGE 各 6 张 `SEMANTIC_*` 系统表（VIEWS/TABLES/RELATIONSHIPS/FACTS/DIMENSIONS/METRICS） |
| 指标维度展开 | `SHOW SEMANTIC DIMENSIONS FOR METRIC`                                                                                 |
| 治理随行     | 随 schema 克隆、随账号复制、可经 Marketplace 共享                                                                     |

## 12. 批判性边界（材料没有证明的事）

1. **86.3% 是 Snowflake 自家基准**——自家数据、自家评测口径；Anthropic 只独立复现了 21% 的**基线端**，增益端无第三方复现。**83/47/23 同为 Snowflake 官方自报**（CoWork 博客，internal testing、complex enterprise queries），且与 24.1% → 86.3% 口径不同——两组数字都只能当「Snowflake 官方能力演示」读，不能当中立评测。
2. **状态时点（2026-09）**——Metadata Connectors 仍在私预（Wave 1 五连接器；Summit 架构图上画了 Iceberg/Delta/Glue/Unity Catalog/OneLake 等更多来源，但承诺集只有 5 个，Atlan 核对；一个考据细节：Select Star 收购带来的是 MySQL 连接器，产品化后重做成了 SQL Server）、Advanced Semantics 私预；已 GA/公预的有 External lineage GA（2026-09-03）、Semantic Studio 公开预览（2026-08-26）、Power BI 摄取 GA（2026-08-18）、OpenLineage 摄取公开预览。此前笔记所记 Business Glossary「H2 2026」为第三方转述、无一手出处，此处降级存疑。BlackRock 是早期采用证言，不是效果数据；Snowflake 官方博客自带 forward-looking 声明。
3. **「不可绕过」只在引擎周界内成立**——直查底层数据库、导出数据即绕过；OSI 决定定义**携带**，不解决定义在别家引擎的**执行**。
4. **governance ≠ verification**——`NON ADDITIVE BY` 是人填的声明非系统推导；上游 dbt 已把 grain 塌缩（日汇总）后，semantic view 的正确算式照样产出 477 vs 48 的错误数字；lineage 是查询日志观察到的「谁喂谁」记录，不是「这么算合法吗」的校验（Cortex Agent Evaluations 是独立 opt-in 的事后评分，不在 Horizon Context 内）。
5. **信号排序可能放大多数派错误**——popularity 权重下，被 500 条查询使用的错误 join 模式压过 3 条查询的正确模式；per-role context 未交付（私测期单角色全量）。
6. **出口安检有两条缝**——sample values 是元数据、不脱敏（经 `GET_DDL WITH EXTENSION` 暴露，Snowflake 官方仅建议放代表性非敏感值、无强制）；AI_REDACT 单次 4096 token 上限，超长文本的脱敏覆盖存疑。

## 13. 验收问答（自测答案要点）

1. **为什么语义层必须住进治理引擎**：外挂层每次查询对账两套系统→漂移；治理外挂可被直查绕过；引擎级执行对每个调用方自动生效、无单独 AI 配置（Snowflake 官方博客 + docs 原话；原型 C2 演示双层防线）。
2. **为什么按查询 grain 重算**：存储的总数冻结了粒度与过滤条件；按 grain 重算让 distinct 聚合跨 join 安全（数集合不数行）、derived 先聚后除；而 SUM 在复制行上必然膨胀（B1/B3/A3 实测）。
3. **为什么冲突必须浮出人工**：自动选择（哪怕按 popularity）会让多数派错误碾压正确口径（D4 实测 [6,1,2]）；「诚实度」正是与 RAG「找到什么用什么」的分界（Snowflake 官方原话）。
4. **OSI 没解决什么**：可携带 ≠ 可执行（别家引擎不替你 enforce）；可携带 ≠ 已验证（validator 只查 schema 合法性，不查计算合法性）。
5. **预测题（两周前新表）**：纯 SV 路径的 Cortex Agent 拒答（无覆盖即不猜）；CoCo+Sense 给推断口径的答案（authority 低、可带 warning）；直连库的通用 agent 可能自信错。第一步观察：Sense 给推断定义的 authority 与警告（原型 C1：`no_governed_coverage` + inferred 条目胜出）。
6. **Autopilot 与 Cortex Sense 怎么分工**：Autopilot 是显式轨道的加速器——六路输入面起草、验证门丢弃无效查询、有效者自动入库 verified queries、元数据推断主键，产出仍是受治理对象（"from days to minutes"）；Sense 是隐式轨道——从查询历史与 BI 指标拼装理解、eval loop 自纠、冲突浮出人工。交汇点在 VQR：Autopilot 直接铸造入库，Sense 从行为里建议候选；口径冲突时 governed 胜出（原型 C3/C3b）。
7. **重算与物化矛盾吗**：不矛盾，Snowflake 官方解法是「同一份定义、两个执行策略」——默认按查询 grain 重算保正确（M2）；Advanced Semantics（私预）允许用户自定义物化 + 自动查询改写保性能，代价受 `MAX_STALENESS` 约束（最小 120 秒、配了物化不可取消）。物化的是执行策略，不是第二套业务定义。

## 14. 与本仓的关联

- 机制级对照（definitions registry ↔ context objects、patrol/Judge ↔ eval 自纠环、三层渐进披露 ↔ verified query 分发等 10 条）见 [Horizon Context ↔ negentropy 机制映射报告](./012-horizon-context-mapping-negentropy.md)。
- 本仓的上下文治理织物方案（Collect/Enrich/Activate 三相 × 四信号层 × Context Catalog/Router/Guard）见 [Context Layer 技术方案](../../concepts/design/context-layer.md)；通用可复刻基础设施的架构设计见 [Context Layer 基础设施设计蓝图](./013-context-layer-blueprint.md)。
- Snowflake 数据云调研中的 Horizon Catalog 章节见 [研究文档 §D7](../retrieval-storage/034-snowflake-data-cloud.md)。

## 参考

[1] Snowflake, "Horizon Context — Governed Semantic Layer & Data Catalog," *Snowflake Product*, 2026. [Online]. Available: https://www.snowflake.com/en/product/features/horizon-context/

[2] Snowflake, "Snowflake Horizon Context: The Governed Context Layer for AI, BI and Apps," *Snowflake Blog*, Jun. 2026. [Online]. Available: https://www.snowflake.com/en/blog/horizon-context-governed-context/

[3] Snowflake, "Snowflake Advances Trusted AI with Snowflake Horizon Catalog Centralizing Governance, Context, and Security Across the Enterprise," *Press Release*, Snowflake Summit 26, Jun. 2, 2026. [Online]. Available: https://www.snowflake.com/en/news/press-releases/snowflake-advances-trusted-ai-with-snowflake-horizon-catalog-centralizing-governance-context-and-security-across-the-enterprise/

[4] Snowflake Documentation, "Overview of semantic views," "CREATE SEMANTIC VIEW," "How Snowflake validates semantic views," "Snowflake Horizon Catalog," "External lineage," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/user-guide/views-semantic/overview; "External lineage," https://docs.snowflake.com/en/user-guide/external-lineage

[5] Snowflake, "Introducing Cortex Sense: Grounded Context for the Data You Never Modeled," *Snowflake Blog*, Jun. 30, 2026. [Online]. Available: https://www.snowflake.com/en/blog/enterprise-ai-agents-grounded-context/

[6] Snowflake, "Why Do We Need Semantic Views? Avoiding Subtle Mistakes in Complex Calculations," *Snowflake Engineering Blog*, Mar. 2026. [Online]. Available: https://www.snowflake.com/en/blog/engineering/why-we-need-semantic-views/

[7] Snowflake, "Snowflake, Salesforce, dbt Labs and More Revolutionize Data Readiness for AI with Open Semantic Interchange Initiative," *Press Release*, Sep. 23, 2025. [Online]. Available: https://www.snowflake.com/en/news/press-releases/snowflake-salesforce-dbt-labs-and-more-revolutionize-data-readiness-for-ai-with-open-semantic-interchange-initiative/; "Apache Ossie (Incubating): The New Name for Open Semantic Interchange," *Snowflake Blog*, Jul. 2026. [Online]. Available: https://www.snowflake.com/en/blog/apache-ossie-open-semantic-interchange-incubator/

[8] Typedef, "What Is Horizon Context? Snowflake's Governed Context Layer Explained," Jun. 12, 2026. [Online]. Available: https://www.typedef.ai/blog/what-is-horizon-context-snowflakes-governed-context-layer-explained

[9] Atlan, "Snowflake Horizon Context vs the Enterprise Context Layer," Jun. 2026. [Online]. Available: https://atlan.com/know/snowflake/snowflake-horizon-context/

[10] A. K. Dey, "Understanding and Using Context," *Personal and Ubiquitous Computing*, vol. 5, no. 1, pp. 4–7, 2001.（上下文的经典学术定义）

[11] Snowflake Documentation, "Semantic view Autopilot," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/user-guide/views-semantic/autopilot; Snowflake, "Snowflake Delivers Semantic View Autopilot as the Foundation for Trusted, Scalable, Enterprise-Ready AI," *Press Release*, Feb. 3, 2026. [Online]. Available: https://www.snowflake.com/en/news/press-releases/snowflake-delivers-semantic-view-autopilot-as-the-foundation-for-trusted-scalable-enterprise-ready-AI/

[12] Snowflake Documentation, "Verified query repository," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/user-guide/views-semantic/verified-query-repository

[13] Snowflake Documentation, "Cortex Agents MCP server," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp

[14] Snowflake Documentation, "Best practices for modeling semantic views," "Best practices for developing with semantic views," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/user-guide/views-semantic/best-practices-modeling; "Best practices for developing with semantic views," https://docs.snowflake.com/en/user-guide/views-semantic/best-practices-dev

[15] Snowflake, "Cortex Search and Retrieval for Enterprise AI," *Snowflake Engineering Blog*, 2026. [Online]. Available: https://www.snowflake.com/en/engineering-blog/cortex-search-and-retrieval-enterprise-ai/

[16] Snowflake, "Snowflake CoWork: Your Personal Work Agent," *Snowflake Blog*, Jun. 2026. [Online]. Available: https://www.snowflake.com/en/blog/snowflake-cowork-personal-work-agent/

[17] Snowflake, "Snowflake to Acquire Select Star," *Snowflake Blog*, Nov. 24, 2025. [Online]. Available: https://www.snowflake.com/en/blog/snowflake-acquire-select-star/; InfoWorld, "Snowflake to acquire Select Star to enhance its Horizon Catalog," Nov. 2025. [Online]. Available: https://www.infoworld.com/article/4095809/snowflake-to-acquire-select-star-to-enhance-its-horizon-catalog.html

[18] Snowflake, "Trusted Data, Trusted AI," *Snowflake Blog*, 2026. [Online]. Available: https://www.snowflake.com/en/blog/trusted-data-trusted-ai/

[19] Snowflake Documentation, "Automatically generated data agents," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/collaboration/auto-generated-data-agents
