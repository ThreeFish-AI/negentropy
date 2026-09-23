# 事实源：《自己动手，给 AI 搭一个上下文层》（Context Layer 篇 · v3 重制）

> **本集口播的单一事实源**。逐字稿（[../script/narration.md](../script/narration.md)）中每一条断言都必须能回溯到本文件的某一节；回溯不到的断言不得进入口播。
>
> **信源轨（B 型 · 仓内固定提交 @ `6f643c216dee`，2026-09-23）**
> - **A 轨 · 蓝图 SSOT**：[013-context-layer-blueprint.md](../../../../../docs/research/cognitive-context/013-context-layer-blueprint.md)（603 行，内容面重铸版）——设计与判定：五正交层规格、M1–M7、状态、决策、路线；含 §12 negentropy 实例化总装（原 `docs/concepts/design/context-layer.md` 352 行已于 2026-09-21 并入后删除，v2 取证的 D 轨独立条目随之取消）。
> - **B 轨 · 精读笔记**：[011-horizon-context.md](../../../../../docs/research/cognitive-context/011-horizon-context.md)（771 行，冻结）——机制详解、组件全景、时间线与实证载荷（经它的 IEEE 引用链间接可溯 Snowflake 上游；系列规则：上游官方页不直接取证）。
> - **C 轨 · 原型实测**：[horizon_context_lab.py](../../../../../docs/research/cognitive-context/assets/horizon_context_lab.py)（1,195 行）+ [horizon_context_mcp.py](../../../../../docs/research/cognitive-context/assets/horizon_context_mcp.py)（328 行），`--selftest` 本 worktree 复跑双绿（2026-09-23；A/B/C/E 组 + D1–D10 + T1–T8 全 PASS）。
> - **D 轨**：已并入 A 轨 §12（见上）。
>
> **证据四级**：【一】原型实测可复跑 / 【二】仓内文档讲法（蓝图的设计主张与判定）/ 【三】厂商自家基准或官方口径（须归属）/ 【四】第三方分析（须归属）。
>
> **证据纪律（013 §13.1 钉死）**：除 **21%（Anthropic 复测）** 与 **477 vs 48（typedef 复现）** 外，全部增益数字为**厂商官方自报——增益端无独立复现**；口播引用任何【三】级数字必须带归属语（「Snowflake 官方内测 / 官方自报 / 自家基准」）。「营销 agent 查财务表」句是**本文编译期共识**（非引语），口播不得安到任何厂商头上。
>
> **本集特有纪律**：讲的是「可复刻的通用蓝图」，凡说「能落地」「已验证」必须区分——【一】原型验证过什么（P0–P1 全绿）/【二】蓝图设计主张什么 / 什么只在路线图上（Phase 1–3 未实现，严禁口播为已做到）。

---

## P0 两答案事故（§0）

- 【三】同一份数据两个答案：销售报 \$14.2M、CFO 报 \$12.8M——Snowflake 官方开场叙事；「没有人算错数，错的是语义无人治理」。
- 【三】物理列名如密码：毛收入叫 `amt_ttl_pre_dsc`，口径散落各报表 `CASE WHEN`——官方文档举例。
- 【三】+独立 基线端两家独立实测：缺乏语义治理的 agent 裸问企业数据准确率 **~25%（Snowflake 内测）/ 21%（Anthropic 复测）**——增益端无独立复现，但「裸问会自信地猜数」是两端共识。
- 【二】三个不可自愈病灶：①口径打架（含义散落，两部门两套数字）；②定义漂移（外挂语义层与底表脱节且无从察觉）；③门禁穿透（权限浮在外部中间层，拦不住 agent 直查底表）。
- 【三】官方判词三段（引语，带中译）："Without context, an agent guesses. With context built natively into the platform, an agent acts. With context that is also governed natively, an agent can be trusted."
- 【二】七件承重装备（M1–M7）：语义视图 / 行列级策略 / 语义级治理 / 应答层验证锚定 / 端到端血缘 / Agent Identity / 分类标签——重评选见 §14.3（五判据：承重性/不可替代性/跨源共识/独立实证/正交性）。
- ANALOGY 主角设定：初级 Data Agent=每天重新入职、毫无业务常识的天才实习生；数据平台=受治理大厦；终极入职包=受治理上下文层。

## P1 格局与五层（§1–§3）

- 【四】semantic layer 由 Business Objects 在 1990s 创立；2020–23 headless BI 幻灭，结构性死因「不在执行路径上」。
- 【四】2026-03-10 a16z 定名 **context layer**（context ⊃ semantic）；随后 Gartner 称 "new critical infrastructure"；2026-06-02 Snowflake 发布 Horizon Context。
- 【四】三派定义并存：超集（Atlan）/ 并行（Airbyte）/ 内核（Cube，必须可执行）；行业自嘲「每个厂商的 context layer 都长成它已经在卖的那个产品」（业界转述）。本文立场：术语收 a16z 宽定义，工程落 Cube 纪律。
- 【二】格局判据：四条路线的功能清单越来越像，真正分野在**治理这道工序发生在哪一层**——平台内嵌（Databricks/Fabric/Looker/AWS）/ 定义即代码（dbt MetricFlow，治理在转换层）/ 独立可执行层（Cube/AtScale）/ 元数据平面（Atlan/Alation/DataHub）；异类 Palantir Ontology（semantic+kinetic 双层）。
- 【四】Cube 立场引语：「治理在 SQL 产生之前；post-hoc 扫描被子查询/CTE 绕过」。四路线在同一处收敛：**把治理往 SQL 生成之前挪**（本文编译期判定）。
- 【三】Gartner：2028 年 60% 纯 MCP 项目因缺语义层失败、40%+ agentic 项目 2027 年底前取消（付费墙转引，原始出处 2025-06 勿当新预测）。
- 【二】五正交层口诀：**对象（放什么）、目录（怎么找）、富化（怎么养）、治理（怎么信）、激活（怎么用）**——依次是规章手册、统一索引总账、双轨编纂、焊入承重墙的风控、前台向导与标准插座。拆五层理由：五个维度各自独立变化（换检索算法不动权限模型），机制与策略分离。
- 【二】三相流水线 Collect→Enrich→Activate（与 Context Engineering 三段同构）；四层信号是流经三段的原料：Structural（有什么怎么连）/Operational（查询与新鲜度）/Semantic（定义与指标）/Behavioral（热度与用法）。
- 【三】Horizon 范本：围绕 Horizon Catalog（"the agentic catalog"）长出，目标把 Catalog 从资产登记簿升维为「理解系统」（"a working model of your entire business"）；演进三阶段：语义对象化→治理内嵌与双轨富化→生态开放。
- 【二】spine 判定：M4 双落点（登记在对象层、出示在激活层）；M5 血缘归位目录层 Structural 信号位——归位非降格。

## P2 对象层：规章手册（§4）

- 【二】M1 = **双不变量**：前半本「口径单点」（权威规章只印一本）× 后半本「查询期重算」（手册本身就是计算器，翻到哪条当场按原始凭证套算）。一机制两不变量的理由：Snowflake 把两半铸进同一 DDL 对象不可分售。
- 【三】五段式：`TABLES / RELATIONSHIPS / FACTS / DIMENSIONS / METRICS`；语义视图官方定位为元数据、与数据同库同治理。
- 【二】先祖自然实验（定义合法而执行算错是已文档化状态）：Looker 对称聚合参数可显式关闭；dbt MetricFlow 遇 fan-out 拒答；Cube 无匹配预聚合回退底表——四家定义层趋同，差异化全在执行半边。
- 【四】typedef："A layer that recomputes from base data is better than one that stores frozen totals."
- 【二】fan trap（扇形陷阱）因果：\$100 订单关联 3 条送货记录，先 join 再求和按行数放大成 \$300——**聚合必须先于 join**。【一】D1 实测：拆 `agg_before_join` → Jan 440（对照 200）。
- 【三】引语："that was valid SQL, but it was not valid analytics"（语法合法而业务答案全错）。
- 【二】半可加末快照：余额类指标跨天相加没有业务含义，`NON ADDITIVE BY` 让引擎期末取末快照而非求和。【一】D3 实测：拆 → [11,6,7]（对照 [5,6,7]）；477 vs 48 事故同机制（【四】typedef 生产复现）。
- 【三】字段五设计：`WITH SYNONYMS`（别名是受治理上下文）/ `AI_VERIFIED_QUERIES` / `AI_SQL_GENERATION` / `PRIVATE|PUBLIC` / `NON ADDITIVE BY`。
- 【二】三条字段纪律：①synonyms 必填意识（无别名即检索面隐形）；②instructions 随对象走（写死 prompt=治理外开第二个口径源）；③verified Q&A 带溯源（信任最便宜的来源）。
- 【二】通用对象模型：任何「agent 推理所需的受治理含义」都是对象（kind: definition|metric|doc|skill|qa|policy）；对齐 Apache Ossie YAML（【三】50+ 组织）。结构校验门：引用命中键约束、至少一个可用面、名字唯一——非法结构注册期被拒。【一】D6 实测：拆校验 → 垃圾定义静默入库。
- 【二】对象生命周期：draft→governed；同名异义→conflict；人工裁决；被取代→superseded（保留参与排序、freshness 衰减）。
- 【二】Data Contract 五件套：schema+质量阈值+语义+lineage+访问；没有结构性工具原生在推理时强制语义契约——锁必须焊在执行路径上。
- 【二】negentropy 实例化（核验 2026-09-20）：definitions 表已是 4 类定义 SSOT ✅、注册期领域校验 422 拒入库 ✅、物化渲染 ✅；三字段纪律 🔶（meta JSONB 可承载无纪律）。
- 【三】物化（把算好的结果预存成物理表）官方定位："an insurance policy for your data's integrity"——性能后手非正确性保障。

## P3 目录与富化（§5–§6）

- 【二】M5 血缘=大厦机房的**出入库台账**：谁产出、经谁转手、被谁领用；记录由搬运动作本身触发；记到列级（页级）非表级（箱级）。守护**事后问责链**：预防类机制拦事前，台账管事后。
- 【三】①原生列级血缘（引擎执行语句自动沉淀，`GET_LINEAGE` 程序化取数）；②OpenLineage 外部摄取汇入同一本台账，三道门（INGEST 权限/只收 COMPLETE/对象可解析）；③内外单一账本是差异化；④盲区如实：ML notebook 不进血缘。【一】E1/E1b 实测同构（含三道闸整事件拒绝）；D8：拆解析闸 → ghost 入账。
- 【二】ADR-1：目录用 PostgreSQL VIEW 实现逻辑视图，不新建物理表——新表=副本=Split-Brain 引信；只 UNION 元数据与指针，不复制数据行。
- 【二】信任归一：各子系统信号归一到 0–1（Memory/KB/KG/Tool/Skill 各有公式；staleness=min(1,days/90)）；三纪律：authority 区分 governed/inferred、popularity log1p 有界、freshness 单一 staleness。
- 【三】显式轨道 Autopilot（GA 2026-02-03）：六路输入、候选过验证门，"from days to minutes"（官方口径）=**速记秘书**；隐式轨道 Cortex Sense（预告期）从查询习惯偷师提炼暗知识、只摄取元数据与使用模式不碰数据行=**见习助教**。
- 【三】Snowflake 内部实测：全司 9,685 张表人工语义视图覆盖 **<5%**——正确读法：Autopilot GA 之后的现态，证明显式轨道单独不闭合供给缺口。
- 【二】**冲突契约**（本层核心）：同名异义→两个定义双双置 conflict→CONFLICT 卡片（并列两定义、无数值、拒答待裁）→人工裁决后恢复；**禁按 popularity 自动选**。【一】C3/C3b 实测（卡片无数值+裁决恢复 [3,1,2]）；D4：改 auto_popularity → 错误口径（数事件 [6,1,2]）胜出（对照 [3,1,2]）。
- 【四】DataHub 同向：「被看到 50 次的 join 是晋升候选，不是自动答案」——热度只能提名，不能拍板。
- 【二】negentropy 实例化：eval 自纠环同构 ✅（patrol/Judge 全链）；冲突浮出面 🔶（有 unfixable 记忆无裁决面）；验证问答供给侧 🔶。

## P4 治理层：焊入承重墙的风控（§7）

- 【二】四机构各守一条正交不变量，每条都配亲手拆坏它的破坏实验：闸机（M2，客体可见性，D5）/ 承重墙（M3，定义出口必经同一执法点，C2）/ 贴标（M7，发现→标记→执行不断链，D10）/ 工牌（M6，代理会话权限只减不增，D9）。
- 【二】易混点消歧：**闸机的规则**（客体轴）与**闸机的焊位**（定义出口轴）是同一台闸机的两件事。
- 【三】M2 官方准则（引语）："Governance policies execute at the query engine layer, not the application layer. They apply automatically to every caller: human analyst, BI tool, or AI agent. There is no separate governance configuration for AI workloads."——掩码列打码、行过滤整行扣下，策略所有者角色查询期求值。
- 【一】C2 双层防线实测：检索层对 intern 过滤建议（体验）+ 直闯执行层 → AccessDenied（底线）。【一】D5：拆执行面 → intern 按 plan 拿到 [90,560]（泄露发生）。
- 【三】M3 五条：defined-once-enforced-everywhere（"semantics live inside the governance engine and are enforced at query time, not copied or cached"）；定义出口约束不弱于数据本体（底表策略自动传播到语义视图）；对人与 AI 一视同仁；跨引擎一致；变更纪律刚性（不可原地 ALTER）。
- 【三】M7 一次性映射（官方限制要写准）：掩码策略**不能直绑系统标签**，须用户标签→系统分类标签映射、策略绑用户标签——新敏感数据进楼即自动纳管。【一】E3 实测（新列 phone/ssn 自动分类→MASK_FULL；plan 未映射=显式缺口）；D10：拆映射 → 已贴标签仍明文出楼。
- 【四】ABAC 多账号规模天花板（社区判语 "virtually worthless in a real enterprise"）。
- 【三】M6 RSS 官方定义（引语）："a privilege ceiling that limits what an agent can do on behalf of a user. An RSS doesn't replace RBAC and can't grant privileges the user doesn't already have"——只做交集、绝不做并集。【一】E2/E2b 实测（会话权限=用户∩岗位面；审计 agent_type）；D9：快照式天花板 → 回收后旧会话仍持权（越权窗口）。
- 【二】置信度分轴：M6 重要性 4/4 入集、独立走查已现、**具名生产案例为零**。
- 【四】MCP 供给面威胁模型：三级链路「客户端→供给面→执行层」；2025 六起具名安全事件；最重要教训——**官方/受信组件也必须当不可信组件对待**（Anthropic 官方 Git MCP Server 缺陷）。四类威胁与拦截位：工具描述投毒/rug pull（定义哈希钉住）、间接注入（指令式语言告警）、confused deputy（动作分级强确认）、token 透传（禁 passthrough）。
- 【四】2026 加码（逐条归属）：LiteLLM CVE-2026-30623 衍生 42271 已入 CISA KEV（已武器化）；`.mcp.json` 零点击 RCE 向量（Checkmarx）；MCPTox 实测平均投毒成功率约 36.5%（8.5% 涉 OAuth）；NSA 设计指南；MCP 协议 revision 2026-07-28 硬化（Token Passthrough MUST NOT）。
- 【二】「营销 agent 若有全库 SELECT，会顺理成章查财务表——不是恶意，是不知道边界」=**本文编译期共识，非引语**。引用防错：Anthropic 2026-09-10 报告未提及 MCP 投毒，不得引作证据。

## P5 激活层：前台、题库与插座（§8–§9）

- 【二】M4 核准题库：**命中核准题出示底稿作答，未核准可现场推算但必须显式标注「未经核准」、绝不冒充已背书**。与 M1 正交——「语义视图完全正确，但 LLM 生成的 SQL 错引它」是独立失效面；企业敢不敢把 agent 接进决策流，分的就是「哪个数字有人背书」。
- 【四】typedef 最重批判："Governing a definition, and labeling it, is still not the same as verifying the calculation an agent runs against it."——M4 是这道验证缺口已交付的一半。
- 【三】VQR（Verified Query Repository）载体：`name/question/verified_at/verified_by/sql`+confidence；候选三标准（高频/有信息量/新颖）；**>20 条反噬**（验证题参与匹配与生成，超过二十条反而拖慢优化）；社区双向（正向：从业者只信命中 VQ；负向：版本混乱迁 dbt/CICD）；跨厂商同构（Looker verified queries 核心已 GA 2026-07 口径、Genie certified、ThoughtSpot curated）。
- 【二】检索前台：智能调度员绝不把整座档案库砸向实习生（上下文超载诱发幻觉），只撕最精准的两三页。**检索是正确性的前置环节，不是可选优化**。
- 【四】三条独立证据：Spider 2.0 最强通用模型崩崖 86.6%→10.1%，最难失败不是语法错而是**建错表**（Colrows 分析，"queries built on the wrong tables"）；Anthropic 工程实践：检索增强+重排把检索失败率再降 49%→67%（口径：降幅区间非终值）；Glean 估值 \$7.2B（企业检索第一预算优先级的市场定价）。
- 【三】机制面（Snowflake 自报，降级依据如实）：Universal Search 混合匹配 GA；四因子信号排序；**top-k 硬约束**（整视图 ~100K token，超限被剪枝、延迟与质量双伤）；NDCG 0.22→0.59 自报。
- 【二】resolve 契约（agent 侧唯一入口）：`resolve(question, role) → ContextPackage{top-k, instructions, verified_query?, warnings, conflict_card?}`；无 governed 覆盖显式返回 `no_governed_coverage` 而非静默用推断。排序 `0.4·relevance+0.3·authority+0.2·popularity+0.1·freshness`。四工具：list/resolve/compile（引擎层 RBAC 兜底）/report_feedback。【一】T2–T6 实测（RBAC 过滤、no_governed_coverage、compile [200,150,300]、T5 私有事实经 MCP 仍拒、T6 反馈改排序）。
- 【二】互操作三重边界（公理）：**可携带 ≠ 可执行 ≠ 已验证 ≠ 已普及**；导出必带 provenance/authority，导入一律降 authority 过校验门。【四】Ossie：成员 17→50+、首 release 未切出、Datus 实测静默丢 ASOF（"The export succeeded; the AI behavior diverged."——导出成功而 AI 行为已变）。
- 【三】官方 MCP Server（GA 2025-11-04）：5 类工具面；官方建议只暴露单个 Cortex Agent 作为唯一工具；≤50 工具；250KB 截断。出口安检两指称分开：拦 prompt 注入=Guardrails（GA 2026-04-20）；PII/PHI 脱敏=AI_REDACT（GA 2025-12-08，4096/1024 token 上限）——均属概率性卫星设施非承重机制。
- 【四】降级定位与金句："transport war vs meaning war"（Colrows）；dbt 分工金句 "Use dbt to transform; use Horizon Context to govern meaning."；「可自关的沙箱不承重」（HN 社区，CoCo 命令门）。
- 【四】**治理≠验证**（§9）：上游 dbt 已把 grain 塌缩成日汇总，semantic view 里完全正确的算式照样算出 **477 vs 48**（typedef 复现，独立于厂商）；governed 定义在塌缩粒度上照样错。三级对策：①表达式级 derived 校验（注册期标记）；②verified Q&A 出口对账（不一致即告警）；③eval 事后评分+血缘回溯兜底。行业命名 compiler in the loop——编译期推导计算合法性尚无成熟方案，以 eval 环兜底，不假装解决。

## P6 总装与路线（§10–§13、§16）

- 【二】评测四原则（known-answer 考题集）：考题=业务问题×人工签字期望值；用例四类齐全（歧义/隐晦 join/空结果/**越权**——越权用例期望「拒绝+审计」而非数值）；golden queries 一等资产；覆盖内/外分开判卷。**KPI 唯一：报错优于错数**。~10 题起步即可建闭环。
- 【二】两条警示：基准自身会错（Spider2-Snow 错标 62.8%、修正前后排名 Spearman 相关仅 0.32——CIDR 论文口径）；eval 集会腐化，当活资产运营。
- 【二】组织侧：metric owner=Accountable、steward=Responsible、全程留审计；反模式 glossary theatre（术语表剧场）/影子查询/无主指标；失败史三死因（BI 厂商激励相悖/迁移数学不成立/**不在执行路径上**——最结构性）。
- 【二】negentropy 总装：**不从零造上下文引擎，把已有子系统收敛到一个治理织物（Context Fabric）之下**——五系部（Engine/Perception+KB+KG/Internalization+Memory/Contemplation/Action+Tools）信号已分散存在，缺的是统一治理与编排层。三缺口：检索未统一、双通道割裂、信任未归一。ADR-2：升级 HybridPlanner 为统一检索骨架（Memory 第 4 路种子源）；ADR-3：自动通道给接地摘要、按需通道给深度检索。
- 【一】**D1–D10 十次破坏性实验**（每个只改一个 flag，本 worktree 2026-09-23 复跑全 PASS）：D1 fan trap 440 vs 200 / D2 distinct [6,1,2] vs [3,1,2] / D3 末快照 [11,6,7] vs [5,6,7] / D4 自动选错误口径胜出 / D5 拆 RBAC intern 泄露 [90,560] / D6 拆校验垃圾入库 / D7 先聚后除 122.22 vs 108.33 / D8 ghost 入账 / D9 快照越权窗口 / D10 标签映射断链明文出楼。心得：每个组件单拎出来都不神奇，但拆掉任何一个都有具体、可复现的坏法——判别「工程组合创新」成色的试金石。
- 【三】关键实证表（§13.1）：无 Context 基线 ~25%/21%；CoCo+Sense 24.1→86.3%、\$1.76→\$0.59/query（自家基准）；语义层中介 547 任务 94.15%（arXiv 2606.31041，中立锚，注明骨干）；OSI→Ossie 17→50+（孵化早期）。
- 【二】双轨演进路线（§16）：同一张图纸两种施工——**样板间**（P0–P3 零依赖种子原型：先在独立小屋把七机制全验证一遍）×**本楼改造**（Phase 1–3 全部 additive 只增不改+特性开关+fail-soft 出错降级——在住着人的生产仓里动工，每步可回退）。P0 ✅ 全绿（【一】selftest）；P1 🔶；Phase 1 目录+归一+Memory（低风险）/ Phase 2 Router+接地+Guard（核心中险）/ Phase 3 深度治理+溯源（中高险）——**P1–P3 与 Phase 1–3 口播一律「路线图上」，不得说成已实现**。
- 【二】独立部署形态：对象层落 PostgreSQL、激活层以单进程 stdio/HTTP MCP server 起步——「可独立部署」的兑现，也是终极入职包的交付形态。

## 分歧与迁移记录（v2 → v3）

- v2 取证锚 `cf6724d688d6`（2026-09-12）指向旧路径 `docs/reference/context-layer-blueprint.md`（150 行电报体）；v3 锚 `6f643c216dee`（2026-09-23）指向重铸版 013（603 行，三拍叙事）。v2 sources.toml 的 `internal-fabric` 条目（原 `docs/concepts/design/context-layer.md`）已删除——该文件 2026-09-21 并入 013 §12。
- 013 §0 实证引导语归属修正（6f643c21）：21% 系 **Anthropic 独立复测**（非 Snowflake 口径），本文件与口播均按此执行。
- B 轨 011 于 2026-09-22 裁撤过程性内容（审计存 git 史），精读笔记终稿冻结；本文件引用的机制详解均在其冻结版上。
- v2 代码实景引用清单（十一节）随 v3 分镜重写重建，见 storyboard.md 各幕「代码走廊」标注。

## v3 代码实景引用清单（随分镜增补）

> v3 口播中「屏幕上的代码/实测输出/对话记录」逐处锚定（全部【一】仓内可复跑，2026-09-23 本 worktree 复跑）：

| 画面代码/输出 | 锚点 |
|---|---|
| `✗ relationship bad: … not PRIMARY KEY/UNIQUE` | lab D6 输出 |
| D1 `拆 agg-before-join → Jan 440（对照 200）` | lab D1 输出 |
| D3 `拆 NON ADDITIVE → [11,6,7] vs [5,6,7]` | lab D3 输出 |
| C3 CONFLICT 卡片（并列两定义、无数值）→ C3b 裁决恢复 | lab C3/C3b 输出 |
| C2 `直闯执行层 → AccessDenied` / D5 `intern 拿到 [90,560]` | lab C2/D5 输出 |
| E2 `会话权限=用户∩代理面` / D9 `回收后旧会话仍持 select:orders` | lab E2/D9 输出 |
| E3 `phone/ssn 自动分类→pii→MASK_FULL` / D10 `明文出楼` | lab E3/D10 输出 |
| T2b `PRIVATE 指标对 intern 不下发` / T4 `compile → [200,150,300]` / T5 `plan is a PRIVATE fact` | mcp selftest 输出 |
