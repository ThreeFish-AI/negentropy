# 研究文献总览

> Negentropy 技术调研索引。调研按「认知 → 框架 → 存储 → 图谱 → 执行 → 进化」六段论归档，逐层递进（其中「认知与上下文」与「自进化与工具」两段兼收领域材料精读、对本仓的机制映射与由此派生的可复刻蓝图），另设独立主题分组（量化与投资科学、视频与动效生产、Agent Harness 工程、多模态模型）；本页为各主题分组的阅读入口。各篇精读对本仓的机制映射收拢在单一文档：[机制映射汇总：研究文献 ↔ negentropy](./mapping-negentropy.md)（按域给映射总表、逐条说明与统一落地 backlog）。

---

## 一、认知与上下文 · `cognitive-context/`

| 文档 | 主旨 |
|:---|:---|
| [智能认知增强](./cognitive-context/000-cognitive-enhancement.md) | Agentic 认知增强总览与理论基线 |
| [Context Engineering 通俗全解](./cognitive-context/010-context-engineering.md) | 上下文工程主流框架与论文精解 |
| [Snowflake Horizon Context 精读笔记](./cognitive-context/011-horizon-context.md) | 产业范本精读（2026-09-30 gen2 完全重写：新版 guided-learn 白话直讲教学法、零类比剧场、四维内生直讲）：三阶段演进全景（语义对象化→治理内嵌→生态开放，补 2026-09-30 实况）+ 七机制 M1–M7（语义视图口径单点×查询期重算 / 查询期行列级访问策略 / 语义级治理执行 / 应答层验证锚定 / 端到端列级血缘 / Agent Identity / 分类与标签驱动策略传播）+ §7 底层规律五条与核心争议三条（新章）+ 富化/检索/互操作三专章保留（§3.1–§3.3 降级挂靠、各带重评触发器）+ 实证数字纪律（自报/第三方分列、dbt 2026 双口径）+ 适用边界（成立条件+材料没有证明的事），含随笔记入库的 M1–M7 最小原型（十次破坏性实验）与 MCP 服务原型，M1–M7 各配一张 archify 动效工程图，§1 另配病因链与机制对位总览图、§4 另配组件全景与演进时间线两张总览图（共十五张，trace 动画） |
| [Context Layer 技术蓝图：Agent 系统的上下文供给与治理](./cognitive-context/013-context-layer-blueprint.md) | **设计蓝图 SSOT**：三面蓝图（问题登记簿十簇 × 资产/权威/装配/检索/沉淀五轴 × 生命周期六段两环 G1–G7）；机制＝多轴组合；四范本矩阵；16+4 映射 |
| [OpenViking 精读笔记](./cognitive-context/014-openviking.md) | volcengine 上下文数据库精读（换代重写；钉点 `6227af51`，v0.5.1.1，AGPL-3.0）：viking:// 树统一资源/记忆/技能与 User/Peer 归属（peer 无密钥非租户、写窄读宽）、目录级 L0/L1/L2 sidecar 自底向上生成与新鲜度冒泡（256/4000 字符、10% 判据）、**检索换代为全局召回 2×limit + 单遍精排 + 阈值后置**（上游 #5450 删除目录递归）、会话两阶段提交与 schema 身份判据记忆提炼（`.done` 提交点、宁重复不错并）、v0.5 新增 Gateway 模型代理（逐字节回放保缓存）与租户/ACL/加密/快照治理面；旧矛盾六条上游已修复、营销页与托管产品页滞后新列 N1–N8；五规律（第 3 条重铸为池边界）+ 三争议（争议 1 因上游自我改判重述）；clean-room 原型 v2（八场景 + B1/B3/B4/B6/B7 五破坏实验）；10 张信源原图（官方网关/基准/论文图与官网、托管版、博客实拍） |

> 本仓**内部**的实施入口（定位声明 + 章节指针 + 实施状态）原为 `docs/concepts/design/context-layer.md`：设计正文已于 2026-09-20 全量并入上方蓝图，该页于 2026-09-21 删除——013 自此为单一事实源。

## 二、Agent 框架与引擎 · `agent-runtime/`

| 文档 | 主旨 |
|:---|:---|
| [Agent Runtime & Frameworks 调研](./agent-runtime/020-agent-runtime-frameworks.md) | 主流 Agent 运行时框架横向对比 |
| [Agent Engine Fundamentals](./agent-runtime/020a-agent-engine-fundamentals.md) | Agent 引擎基础原理与 ADK 接口适配 |
| [Google ADK 2.0 升级调研](./agent-runtime/020b-adk-2.0-upgrade.md) | ADK 2.0 新特性、Breaking Changes 与升级路径 |

## 三、检索与存储 · `retrieval-storage/`

**向量算法 / 数据库**

| 文档 | 主旨 |
|:---|:---|
| [向量索引算法通俗全解](./retrieval-storage/030-vector-search-algorithm.md) | HNSW / IVF 等向量检索算法原理 |
| [向量数据库选型决策路径](./retrieval-storage/031-vector-databases-selection.md) | 选型方法论与决策树 |
| [向量数据库深度调研](./retrieval-storage/032-vector-databases.md) | 主流向量库能力矩阵 |

**OceanBase 簇**

| 文档 | 主旨 |
|:---|:---|
| [OceanBase 三位一体调研](./retrieval-storage/033-oceanbase.md) | HTAP + Vector + 强一致主调研 |
| [OceanBase Agent 场景评估摘要](./retrieval-storage/033a-oceanbase-evaluation.md) | Agentic 场景适配评估 |
| [Agentic AI Memory 基座选型对比](./retrieval-storage/033b-technology-comparison.md) | OceanBase / Cloud Native / Disaggregated / Generic SQL 四路线对比 |
| [OceanBase Phase 2：Memory Management 实施指引](./retrieval-storage/033c-oceanbase-memory-management.md) | 仿生 Google Memory Bank 的工程落地（含 Phase 3/4 Roadmap） |
| [OceanBase 执行阶段一：基座部署与 Unified Schema](./retrieval-storage/033d-oceanbase-schema-design.md) | 部署与统一 Schema 设计 |

**Snowflake**

| 文档 | 主旨 |
|:---|:---|
| [Snowflake 数据云平台深度调研](./retrieval-storage/034-snowflake-data-cloud.md) | 基于官方文档的 10 正交维度全景（架构/存储/计算/数据工程/开发/AI/安全治理/共享/容灾/成本）+ 主流方案横向对比与选型建议 |

## 四、知识与图谱 · `knowledge-graph/`

| 文档 | 主旨 |
|:---|:---|
| [Knowledge Base：RAG Pipeline & Hybrid Search](./knowledge-graph/034-knowledge-base.md) | KB 核心管道与混合检索 |
| [Knowledge Base Fundamentals](./knowledge-graph/034a-knowledge-base-fundamentals.md) | Chunking / Embedding / RAG 基础理论 |
| [腾讯 WeKnora 深度调研](./knowledge-graph/035-knowledge-base-platform.md) | WeKnora 与同类 RAG 框架对比 |
| [Cognee 深度调研](./knowledge-graph/040-cognee.md) | Cognee 记忆/知识框架 |
| [Neo4j 图数据库调研](./knowledge-graph/050-neo4j.md) | Neo4j 承载 KG 的能力评估 |
| [PostgreSQL 支撑 KG：Neo4j 替代路径](./knowledge-graph/051-postgres-neo4j.md) | 多模型 DB 全景与替代分析 |
| [BettaFish 微舆调研](./knowledge-graph/060-bettafish.md) | Bettafish 端侧推理框架 |

## 五、Agent 基础设施 · `agent-infra/`

| 文档 | 主旨 |
|:---|:---|
| [AG-UI 协议调研](./agent-infra/070-ag-ui.md) | Agent-to-UI 开放协议 |
| [Agent Sandbox 综述](./agent-infra/080-agent-sandbox.md) | 五大技术路线正交剖析 |
| [Agent Sandbox 正交分析](./agent-infra/081-agent-sandbox.md) | Microsandbox / Wasmtime / Firecracker / Vertex |
| [Agent Sandbox 信任架构深度研究](./agent-infra/082-agent-sandbox.md) | 微虚拟机到托管式执行环境 |
| [可观测性对比：Jaeger vs Langfuse](./agent-infra/100-agent-obser.md) | 生成式 AI 可观测性方案选型 |
| [Jev 精读笔记](./agent-infra/200-jev-system-one-model.md) | TypeSafe「System One Model」四机制：闭合输出空间 × 共享读·隔离问 × 校准概率与 confidence（adapter 固定公式，读数≠概率）× 快慢分工；官方口径与第三方实测逐项对账（193.6× 复算仅 97.8×、校准领地：分布内 ECE 0.031 / 密封集 0.220）；含纯标准库原型 S1–S11 + B1–B5 破坏实验与 laya 复刻本地实测 |
| [Agent Skills 开放标准精读与通俗拆解](./agent-infra/230-agent-skills-standard.md) | agentskills.io 精读（钉 69ef37e9 + 四家客户端口径实测）：三级渐进披露记账、description 独扛路由与触发评测法、规范↔参考实现↔客户端十三处分歧、四家对照表；配套 agent_skills_lab4.py（X1–X5）与 agent_skills_lab2.py（补充 X1/X3/X4/X5）两组破坏实验 |
| [客户域 Agent Long Memory · 2027 产品规划](./agent-infra/230-customer-domain-long-memory-2027-planning.md) | Context Layer 客户域（tenant / user 两级）长期记忆的年度产品规划：5 条能力线 × 18 个功能点（写入沉淀 / 治理合规 / 读取注入 / 可见可改与运营 / 评估与扩展），含用户场景、验收标准、Gate-0 + 四个季度里程碑、成功指标与待决策项；不含人力与成本估算 |

## 六、自进化与工具 · `self-evolution/`

| 文档 | 主旨 |
|:---|:---|
| [Routine：Agent 迭代模式调研](./self-evolution/110-routine-agent-iteration.md) | ReAct / Reflexion / Self-Refine / LATS + 停止护栏 |
| [浏览器操作 MCP 调研](./self-evolution/120-browser-automation-mcp.md) | Playwright / Chrome DevTools / claude-in-chrome 选型 |
| [自进化 Agents Team 调研](./self-evolution/130-self-evolving-agents-team.md) | DGM / ADAS / AlphaEvolve + GEPA / ACE 进化算子 |
| [经验时代的自驱迭代进化智能体](./self-evolution/140-experience-era-self-improvement.md) | 88 页综述精读 + Routine 闭环诊断 |
| [Skill 进化闭环 × 自我改进评测](./self-evolution/141-skills-evolution-and-si-measurement.md) | Skills 三阶段进化 + SI 六目标度量 |
| [Procedural Graph 论文精读](./self-evolution/142-procedural-graphs.md) | arXiv:2609.09153：程序性知识外置为带 condition/guidance/pitfalls 属性的有向图 + 邻域定位软指导 + 过验证门的自进化，含最小原型与破坏性实验 |
| [Dream-RSI 论文精读](./self-evolution/144-dream-rsi.md) | arXiv:2609.14858：发现历史即重放模拟器、离线「做梦」确定性重放评估改进探索策略、argmax 含当前策略防回退、只改策略层不动底座，含最小原型与五次破坏性实验 |

## 七、量化与投资科学 · `quant-finance/`

| 文档 | 主旨 |
|:---|:---|
| [凯利公式与股市投资的数学基石](./quant-finance/150-kelly-criterion-and-investment-math.md) | 七块严格成立的定理（凯利仓位 / 统计功效 / 破产风险 / 波动拖累 / 复利年金 / Markowitz 分散化 / Sharpe 算术）+ 经核验的实证数据（SPIVA / 上交所账户研究等）+ 中国市场可执行操作路径与避坑清单 |

## 八、视频与动效生产 · `video-production/`

| 文档 | 主旨 |
|:---|:---|
| [视频动效建模与 Web 可视化搭建工具全景调研](./video-production/160-video-motion-modeling-web-visual-tooling.md) | 以现役 Remotion 科普视频管线为基线的全网与 GitHub 全景调研（54+9 候选、四路深评、87 条主张双反驳核验）：A 轨 `@remotion` 官方增强簇即刻提升表达力、B 轨 HyperFrames（Apache-2.0、agent 原生）平行试点、C 轨 Cavalry/Jitter→Lottie 设计师资产管线，附四道击穿门评估框架、迁移成本口径与 POC 验收清单 |

---

## 九、Agent Harness 工程 · `agent-harness/`

> 一手材料：① 170–175 以 Learn Claude Code 课程站点修订与 [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 仓库 main 整合版（MIT，固定提交取证：main `ce8f9f18` / 站点 `67a9126c`，2026-10-07 换钉）与 Anthropic 官方文档（code.claude.com，轨 C 产品现状口径）为信源；② 180 以阿里巴巴《AI Native 研发范式实践手册》（2026-09，68 页）为信源；③ 190 以 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) 固定提交 `068db016`（MIT）与其官方文档站为信源。④ 176 是 s13/s14「并发」两节的独立重学篇，以站点轨源文件固定提交 `67a9126c`（main 平行轨 `ce8f9f18` 对照）与 Anthropic 官方文档为信源，不继承 170–175 的叙事与结论。⑤ 177 以 claude.dev 全站快照（sitemap 20 URL + RSS 16 篇 + 5 条视频官方英文字幕，2026-10-23 抓取）与 7 组 Anthropic 官方文档（Claude Tag / Managed Agents / mods / effort / prompt caching / 发布页 / workflows）为信源。
>
> **SSOT 边界（170–175）**：逐章原文引语、可调参数、生产版行号与口播判据在科普视频工程各集 `research/gl-notes.md`（冻结登记 + 附录 C 穿透明细；ep5 例外：其 gl-notes 为 2026-10-07 换代前 175 的冻结快照——成片 v2 取证口径）；章→集归属与固定提交选择只登记在[系列信源地图](../../apps/negentropy-influence/source-map/claude-code-explained.md)。本分部只做**跨层综观、main 轨净增量与本仓机制对位**，冲突一律以上述两处为准。

| 文档 | 主旨 |
|:---|:---|
| [五层 Harness 精读总览](./agent-harness/170-claude-code-harness-overview.md) | 执行→规划→记忆→时机→协作五层的依赖链与层间缺口、四级证据分级（【一】【二】【三】【官】）、SSOT 边界、三轨撞号防御与 main 轨视频未取材两章的落位（唯一展开层在系列信源地图）、换钉复验的批判边界与 025 消歧办结记录、与本仓机制对位（decision.py 标量阈值 vs s17 目标闸门一等状态）；总纲保索引职能＋§9 换代说明（旧版总类比剧场叙事与共用原型 cc_harness_lab.py 的 D1–D6 实验随 2026-10-07 换代废止，新原型为各篇 lcc_<part>_lab.py） |
| [① 工具与执行](./agent-harness/171-claude-code-tooling-execution.md) | 一个回喂工具结果的 while 循环（30 行 vs CC query.ts 1729 行）加上工具查表分发、三道权限闸门、钩子注册表三层装置；两轨判据对照（站点轨 stop_reason vs main 轨内容块）、官方文档三方核证（33 个 hook 事件、六种权限模式、hook allow 压不过 deny/ask）、五路破坏性实验实测退化，配套可运行原型 lcc_tooling_lab.py |
| [② 规划与协调](./agent-harness/172-claude-code-planning-coordination.md) | 以「LLM 每轮看到什么」为统一视角串起五个装置：计划外显与提醒、子代理过程隔离只回结论、技能两级加载的 token 经济学、系统提示按真实状态组装、错误三路径分类恢复；五条底层规律、三个核心争议，配套 lcc_planning_lab.py 五次破坏性实验实测退化，附录 main 轨 s17_goal_loop 目标闸门对照 |
| [③ 记忆管理](./agent-harness/173-claude-code-memory-management.md) | 四步压缩管线的顺序经济学、tool_use/tool_result 配对不变式、seen/unseen 可恢复占位、记忆四件套（存储/门控提取/选择性召回/原子整理）；双轨钉点（站点 67a9126c / main ce8f9f18）差异并陈，配套纯标准库原型 lcc_memory_lab.py 与五次破坏性实验实测退化 |
| [④ 并发与时机](./agent-harness/174-claude-code-concurrency.md) | 「不等它」与「没人按开始也照跑」两种时间机制：占位回执＋通知注入、调度/队列/交付/消费四层解耦、durable 定义跨重启与节拍随进程分离；五次破坏性实验实测退化（60 倍重复入队、回合穿插 9 次等），双轨（站点 s13_background_tasks / s14_cron_scheduler ↔ main s11_background_tasks / s12_cron_scheduler / s16_workflow_runtime @ ce8f9f18）差异并陈与官方文档对账 |
| [⑤ 多 Agent 平台](./agent-harness/175-claude-code-multi-agent-platform.md) | 文件任务板、消费式收件箱、带编号的请求-响应协议、空闲自认领、任务绑定 worktree、外部工具发现-命名-组装，最后全部挂回同一个循环（「机制很多、循环一个」）；五条底层规律、三个核心争议，配套约 500 行确定性原型与五组破坏性实验实测退化 |
| [精读：AI Native 研发范式实践手册](./agent-harness/180-ai-native-handbook.md) | 企业级 Harness 视角：三案例 → 五挑战 → 四层基础设施（Harness / 运行环境 / 可信安全 / 可观测）的全貌解剖、五条底层规律（模型提意图·确定性系统决策 / 证据先于结论 / 权限逐级收敛 / 结论绑定现场·不确定即拒 / 环境与知识是第一类上下文）、两个核心争议与批判性边界五条（含度量示例 SQL 多对多扇出实测复现）；≤2000 字精炼版，配套原型六次破坏性实验 |
| [精读：Daily Stock Analysis（DSA）](./agent-harness/178-daily-stock-analysis.md) | 67k star 的 LLM 股票研究系统首读（repo 钉 4e622643 + 站点 12 原生页 + arXiv:2608.26990 三源）：五段证据到报告流水线与双执行路径、八态证据状态与六块质量评分（缺数据≠中性）、多源回退三层防护（回退链/熔断/冷却）、模型路由三层配置×两层路由与能力准入（可替换≠等价）、15 策略技能与信号资格分选、分歧显式化+RiskGuard 只降不升、决策信号 1d–10d 后验与 Beta(15,15) 收缩权重自校准、论文 1457 契约测试只证软件一致性的边界；配套五机制原型 [dsa_lab.py](./agent-harness/assets/dsa_lab.py) 与五次破坏性实验 |
| [精读：Nous Research Hermes Agent](./agent-harness/190-hermes-agent.md) | 自学习闭环 Harness 视角：缓存优先的三段式提示装配（会话内唯一计划内断点是压缩）、有界常驻记忆（2200/1375 字符）+ 按需技能两级记忆、交付后旁路 review 自写技能（分派侧白名单 · 先读后写 · 署名保护）+ Curator 只归档不删除、FTS5 零 LLM 会话检索 + 工具组不拆的四阶段压缩、委派/定时/命令守卫的受控扩张；五条规律（缓存/容量/写回/历史/边界）、三个争议、21 处文档↔代码漂移与「无学习效果评测」的批判性边界，配套原型六次破坏性实验与两张 archify 图 |
| [Learn Claude Code 并发与调度重学精读](./agent-harness/176-claude-code-concurrency-relearn.md) | s13 后台任务 × s14 定时调度的**独立重学篇**（最新版 guided-learn，零继承旧篇）：占位回执守住「一次调用配一个结果」的协议名额、通知由主循环每轮收集后以新消息身份回注；cron 四层解耦（判时/队列/非阻塞交付/执行）与三道保险；教学版三处边界实测（后台复用 120 秒超时、摘要截 200 字、通知未转义）；官方文档逐项对账（印证清单 + 抖动上限硬分歧 + 超时自动转后台三路径）；确定性原型 + 五次破坏性实验 + 两张 archify 图 |
| [claude.dev 全站精读与通俗拆解](./agent-harness/177-anthropic-claude-dev-blog.md) | Anthropic 开发者博客 claude.dev **全站首读**（2026-10-23 快照：16 文 + Mods + 5 视频官方字幕）：轮数×重发×缓存前缀的账单模型、effort 买彻底不买聪明、脚手架生灭律（80% 系统提示删减与 todo 消亡）、七层评审防线与确定性计数棘轮、无人值守自动化三件套（书签/确认记账/硬预算）、执行环境三级跳（云会话/Managed Agents/Claude Tag）、mods hook 链与 dynamic workflows；7 组官方文档补读对齐口径，五机制原型 + 四次破坏性实验 + 两张 archify 图 |
| [精读：Harness 到 Harness²](./agent-harness/179-harness-to-harness2.md) | 双源合并精读（Harness-Zero arXiv:2609.24974v1 × Harness² arXiv:2610.14224v1，互不引用、非换代）：同一问题「harness 收益放哪」的两条互补路线——训练期 agent-as-harness 审阅门蒸馏进权重、部署期卸载（23.3→44.3 反超外挂 41.7；监督源消融 K 30 vs oracle 15 vs 错配 3；28 模式恢复 82.3%）与部署期冻结模型的对比式 Propose–Probe–Compose + 双层递归库（单步最高 +11.5、库反哺与跨模型迁移 +17.3）；公式链 (1)-(5)/(1)-(4) 逐条白话拆解、4 张论文原图（CC BY 4.0）、五条规律三个争议与批判边界（均无独立复现）；配套纯标准库原型 harness2_lab.py 与五组破坏性实验实测退化 |

---

## 十、多模态模型 · `multimodal-models/`

| 文档 | 主旨 |
|:---|:---|
| [Can Visual Generation Expand What Unified Multimodal Models Know? 精读与通俗拆解](./multimodal-models/240-visual-generation-knowledge-transfer.md) | arXiv:2610.21459v1（Tsinghua × Z.AI）首读：KTP 用只藏在训练图里的虚构事实做探针，测统一多模态模型学画图学到的知识能否在纯文字问答里说出来——直接迁移画得出远多于说得出（BAGEL / GLM-Omni / SenseNova-U1 平均落差 +22.57 / +39.43 / +41.14 个百分点），一半实体加问答样本能让另一半在多数模型上平均更会说，同一回答里先画、再看、再答的交错样本平均最好且很大一部分来自图像损失（GLM-Omni 消融 26.86% → 13.71%），推理时先画再读把号码从 0% 拉到 4% / 36% / 20%；补读八篇对齐口径，五条规律、两个争议与「材料没有证明的事」五条（样本粒度、表 2 分母、全合成数据、两把尺子松紧、跨模型混杂）；配表格复算与玩具模型原型（E1–E5 破坏实验）、两张 archify 图与 7 张论文原图 |

---

> 阅读建议：首次按一→六段论顺序通读；选型查阅直接跳到对应分组。各子目录的 `_category_.json` 提供分组级描述，wiki 左栏可折叠展开。
