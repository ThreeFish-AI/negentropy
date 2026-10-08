# 研究文献总览

> Negentropy 技术调研索引。调研按「认知 → 框架 → 存储 → 图谱 → 执行 → 进化」六段论归档，逐层递进（其中「认知与上下文」与「自进化与工具」两段兼收领域材料精读、对本仓的机制映射与由此派生的可复刻蓝图），另设独立主题分组（量化与投资科学、视频与动效生产、Agent Harness 工程）；本页为各主题分组的阅读入口。

---

## 一、认知与上下文 · `cognitive-context/`

| 文档 | 主旨 |
|:---|:---|
| [智能认知增强](./cognitive-context/000-cognitive-enhancement.md) | Agentic 认知增强总览与理论基线 |
| [Context Engineering 通俗全解](./cognitive-context/010-context-engineering.md) | 上下文工程主流框架与论文精解 |
| [Snowflake Horizon Context 精读笔记](./cognitive-context/011-horizon-context.md) | 产业范本精读：三阶段演进全景（语义对象化→治理内嵌→生态开放）+ 重评选校准后七机制 M1–M7（语义视图口径单点×查询期重算 / 查询期行列级访问策略 / 语义级治理执行 / 应答层验证锚定 / 端到端列级血缘 / Agent Identity / 分类与标签驱动策略传播）+ 富化/检索/互操作三专章保留（降级理由与重评触发器随文）+ 实证数字与批判性边界，含随笔记入库的 M1–M7 最小原型（十次破坏性实验）与 MCP 服务原型，M1–M7 各配一张 archify 动效工程图，§1 另配病因链与机制对位总览图、§2 另配组件全景与演进时间线两张总览图，§10–§12 降级章四张沿用（共十四张，trace 动画） |
| [Horizon Context ↔ negentropy 机制映射](./cognitive-context/012-horizon-context-mapping-negentropy.md) | 16 条机制逐条对照本仓 definitions registry / patrol-Judge / skills_injector / Catalog（✅ 已对齐 4 · 🔶 值得落地 8 含部分对齐 1 · ⏸ 暂缓 4；2026-09-17 随 M 集重评选重审，新晋四机制补映射），锚点均经代码核验 |
| [Context Layer 技术蓝图：Agent 系统的上下文供给与治理](./cognitive-context/013-context-layer-blueprint.md) | **设计蓝图 SSOT（2026-09-27 完全重铸，542 行）**：三轴蓝图（ADR-4/5 五源对象 × 五正交层 × CGAVE 生命周期）× 八失效模式验收面 × 四范本矩阵（Horizon M1–M7 / OpenViking / Claude Code / Hermes·Jev）+ 业界格局与供给面威胁模型 + 装配经济学（ADR-6）+ negentropy 实例化总装（16+4 条映射 as-of @57987b28b 重核；ISSUE-195④/196/191 M2/015 §6 五路回写销账落地）+ 双轨演进；三级证据徽逐数字定级 |
| [OpenViking 精读笔记](./cognitive-context/014-openviking.md) | volcengine 上下文数据库精读（钉点 `14a7b81`，AGPL-3.0）：viking:// 文件系统范式统一资源/记忆/技能、目录级 L0/L1/L2 sidecar 自底向上生成与新鲜度冒泡（256/4000 字符、L0 从 L1 裁出零 LLM、10% 判据）、两档检索（find 固定平铺 / search+rerank 目录递归、α=1.0）、会话两阶段提交与确定性身份记忆提炼（`.done` 提交点、add_only 只增）；代码实值裁决文档旧口径 8 组、厂商基准证据分级（LoCoMo 24.20%→82.08% 全自报、单轮 RAG 66.87%<LightRAG 76.00% 反例、ClawWork 算术错）、五条底层规律与三个争议、双 Agent 费曼对抗实录；含编目/检索两相 archify 图与 clean-room 最小原型（`--selftest` + 六次破坏性实验） |
| [OpenViking ↔ negentropy 机制映射](./cognitive-context/015-openviking-mapping-negentropy.md) | 13 条机制对照本仓记忆/上下文子系统（✅4 · 🔶5 · ⏸4）：最大真增量 = M-d 会话两阶段提交对准「交互式对话→长期记忆」断链（`add_session_to_memory` 零调用方、`consolidation_jobs` 只入队无消费者）；M-a 副本式 URI 与 013 ADR-1 冲突只取寻址不取存储；取证副产物 8 处本仓漂移（D1–D8，ISSUE-195）与 AGPL 引入约束 |

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
| [Agent Skills 开放规范精读](./agent-infra/090-agent-skills-spec.md) | agentskills.io 规范（固定提交 `69ef37e9`）：目录即技能包、name 借文件系统拿唯一性、description 独扛触发、三级渐进披露的上下文成本结构；skills-ref 参考实现与规范 13 处分歧（6 处经真实参考实现复现），含最小原型与五次破坏性实验 |
| [Agent Skills ↔ negentropy 机制映射](./agent-infra/091-agent-skills-mapping-negentropy.md) | 13 条机制对照本仓三套 skill 载体：盘上 11 技能全合规、结构化包裹与同名优先级已对齐；头号发现为 Layer 1 指示的 `expand_skill` 从未挂载（连带 R6-b 在线 canary 门恒被跳过），name/description 规范校验与目录注入防护等 9 条值得落地 |
| [可观测性对比：Jaeger vs Langfuse](./agent-infra/100-agent-obser.md) | 生成式 AI 可观测性方案选型 |
| [Jev 精读笔记](./agent-infra/200-jev-system-one-model.md) | TypeSafe「System One Model」四机制：闭合输出空间 × 共享读·隔离问 × 校准概率与 confidence（adapter 固定公式，读数≠概率）× 快慢分工；官方口径与第三方实测逐项对账（193.6× 复算仅 97.8×、校准领地：分布内 ECE 0.031 / 密封集 0.220）；含纯标准库原型 S1–S11 + B1–B5 破坏实验与 laya 复刻本地实测 |
| [Jev ↔ negentropy 机制映射](./agent-infra/201-jev-mapping-negentropy.md) | 16 条映射（✅5/🔶9/⏸2）：真增量是四条纪律——解析失败应弃权而非注入默认值（proposer 对照 judge 静默 0 分）、矫正要有 counter、置信缺省方向（KG 缺省 1.0 叠 0.5 阈值=自动通过）、口头置信与启发式常数不可比；接入 Jev 本体暂缓 |

## 六、自进化与工具 · `self-evolution/`

| 文档 | 主旨 |
|:---|:---|
| [Routine：Agent 迭代模式调研](./self-evolution/110-routine-agent-iteration.md) | ReAct / Reflexion / Self-Refine / LATS + 停止护栏 |
| [浏览器操作 MCP 调研](./self-evolution/120-browser-automation-mcp.md) | Playwright / Chrome DevTools / claude-in-chrome 选型 |
| [自进化 Agents Team 调研](./self-evolution/130-self-evolving-agents-team.md) | DGM / ADAS / AlphaEvolve + GEPA / ACE 进化算子 |
| [经验时代的自驱迭代进化智能体](./self-evolution/140-experience-era-self-improvement.md) | 88 页综述精读 + Routine 闭环诊断 |
| [Skill 进化闭环 × 自我改进评测](./self-evolution/141-skills-evolution-and-si-measurement.md) | Skills 三阶段进化 + SI 六目标度量 |
| [Procedural Graph 论文精读](./self-evolution/142-procedural-graphs.md) | arXiv:2609.09153：程序性知识外置为带 condition/guidance/pitfalls 属性的有向图 + 邻域定位软指导 + 过验证门的自进化，含最小原型与破坏性实验 |
| [PG ↔ negentropy 机制映射](./self-evolution/143-pg-mapping-negentropy.md) | 五条机制对照本仓 Routine / 巡检 / evolution 门控：验证门平局接受与报告纪律已对齐，编辑级拒绝记忆值得落地，边属性按 YAGNI 暂缓 |
| [Dream-RSI 论文精读](./self-evolution/144-dream-rsi.md) | arXiv:2609.14858：发现历史即重放模拟器、离线「做梦」确定性重放评估改进探索策略、argmax 含当前策略防回退、只改策略层不动底座，含最小原型与五次破坏性实验 |
| [Dream-RSI ↔ negentropy 机制映射](./self-evolution/145-dream-rsi-mapping-negentropy.md) | 六条机制对照本仓 evolution / routine / eval 体系：候选包含保证与策略层分离已同构、Judge 锚定方向一致，历史重放模拟器按 YAGNI 暂缓并绑定触发条件，语义注入的 over-constrain 边界须知 |

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

> 一手材料：① 170–175 以 Learn Claude Code 课程站点修订与 [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 仓库 main 整合版（MIT，固定提交取证：main `ce8f9f18` / 站点 `67a9126c`，2026-10-07 换钉）与 Anthropic 官方文档（code.claude.com，轨 C 产品现状口径）为信源；② 180–181 以阿里巴巴《AI Native 研发范式实践手册》（2026-09，68 页）为信源；③ 190–191 以 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) 固定提交 `068db016`（MIT）与其官方文档站为信源。④ 176 是 s13/s14「并发」两节的独立重学篇，以站点轨源文件固定提交 `67a9126c`（main 平行轨 `ce8f9f18` 对照）与 Anthropic 官方文档为信源，不继承 170–175 的叙事与结论。

>
> **SSOT 边界（170–175）**：逐章原文引语、可调参数、生产版行号与口播判据在科普视频工程各集 `research/gl-notes.md`（冻结登记 + 附录 C 穿透明细）；章→集归属与固定提交选择只登记在[系列信源地图](../../apps/negentropy-influence/source-map/claude-code-explained.md)。本分部只做**跨层综观、main 轨净增量与本仓机制对位**，冲突一律以上述两处为准。

| 文档 | 主旨 |
|:---|:---|
| [五层 Harness 精读总览](./agent-harness/170-claude-code-harness-overview.md) | 执行→规划→记忆→时机→协作五层的依赖链与层间缺口、四级证据分级（【一】【二】【三】【官】）、SSOT 边界、三轨撞号防御与 main 轨视频未取材两章的落位（唯一展开层在系列信源地图）、换钉复验的批判边界与 025 消歧办结记录、与本仓机制对位（decision.py 标量阈值 vs s17 目标闸门一等状态）；总纲保索引职能＋§9 换代说明（旧版总类比剧场叙事与共用原型 cc_harness_lab.py 的 D1–D6 实验随 2026-10-07 换代废止，新原型为各篇 lcc_<part>_lab.py） |
| [① 工具与执行](./agent-harness/171-claude-code-tooling-execution.md) | 一个回喂工具结果的 while 循环（30 行 vs CC query.ts 1729 行）加上工具查表分发、三道权限闸门、钩子注册表三层装置；两轨判据对照（站点轨 stop_reason vs main 轨内容块）、官方文档三方核证（33 个 hook 事件、六种权限模式、hook allow 压不过 deny/ask）、五路破坏性实验实测退化，配套可运行原型 lcc_tooling_lab.py |
| [② 规划与协调](./agent-harness/172-claude-code-planning-coordination.md) | 以「模型每轮看到什么」为统一视角串起五个装置：计划外显与提醒、子代理过程隔离只回结论、技能两级加载的 token 经济学、系统提示按真实状态组装、错误三路径分类恢复；五条底层规律、三个核心争议，配套 lcc_planning_lab.py 五次破坏性实验实测退化，附录 main 轨 s17_goal_loop 目标闸门对照 |
| [③ 记忆管理](./agent-harness/173-claude-code-memory-management.md) | 四步压缩管线的顺序经济学、tool_use/tool_result 配对不变式、seen/unseen 可恢复占位、记忆四件套（存储/门控提取/选择性召回/原子整理）；双轨钉点（站点 67a9126c / main ce8f9f18）差异并陈，配套纯标准库原型 lcc_memory_lab.py 与五次破坏性实验实测退化 |
| [④ 并发与时机](./agent-harness/174-claude-code-concurrency.md) | 「不等它」与「没人按开始也照跑」两种时间机制：占位回执＋通知注入、调度/队列/交付/消费四层解耦、durable 定义跨重启与节拍随进程分离；五次破坏性实验实测退化（60 倍重复入队、回合穿插 9 次等），双轨（站点 s13_background_tasks / s14_cron_scheduler ↔ main s11_background_tasks / s12_cron_scheduler / s16_workflow_runtime @ ce8f9f18）差异并陈与官方文档对账 |
| [⑤ 多 Agent 平台](./agent-harness/175-claude-code-multi-agent-platform.md) | 文件任务板、消费式收件箱、带编号的请求-响应协议、空闲自认领、任务绑定 worktree、外部工具发现-命名-组装，最后全部挂回同一个循环（「机制很多、循环一个」）；五条底层规律、三个核心争议，配套约 500 行确定性原型与五组破坏性实验实测退化 |
| [精读：AI Native 研发范式实践手册](./agent-harness/180-ai-native-handbook.md) | 企业级 Harness 视角：三案例 → 五挑战 → 四层基础设施（Harness / 运行环境 / 可信安全 / 可观测）的全貌解剖、五条底层规律（模型提意图·确定性系统决策 / 证据先于结论 / 权限逐级收敛 / 结论绑定现场·不确定即拒 / 环境与知识是第一类上下文）、两个核心争议与批判性边界五条（含度量示例 SQL 多对多扇出实测复现）；≤2000 字精炼版，配套原型六次破坏性实验 |
| [AI Native 手册 ↔ negentropy 机制映射](./agent-harness/181-ai-native-mapping-negentropy.md) | 十七条机制对照（✅8 / 🔶3 / ⏸6）：闭环骨架已同构，真增量为凭据边界（占位值 + 出站注入）、授权第三态 Challenge 与生产门控对象，均绑定「触达生产或不可信代码」触发条件暂缓 |
| [精读：Nous Research Hermes Agent](./agent-harness/190-hermes-agent.md) | 自学习闭环 Harness 视角：缓存优先的三段式提示装配（会话内唯一计划内断点是压缩）、有界常驻记忆（2200/1375 字符）+ 按需技能两级记忆、交付后旁路 review 自写技能（分派侧白名单 · 先读后写 · 署名保护）+ Curator 只归档不删除、FTS5 零 LLM 会话检索 + 工具组不拆的四阶段压缩、委派/定时/命令守卫的受控扩张；五条规律（缓存/容量/写回/历史/边界）、三个争议、21 处文档↔代码漂移与「无学习效果评测」的批判性边界，配套原型六次破坏性实验与两张 archify 图 |
| [Hermes Agent ↔ negentropy 机制映射](./agent-harness/191-hermes-agent-mapping-negentropy.md) | 十六条机制对照（✅4 / 🔶6 / ⏸6）：真增量=交互式对话零压缩（未启用 ADK 原生 EventsCompactionConfig）、记忆写入与注入两端无防注入、历史会话不可检索；取证副产物=中文关键词检索失效（english tsvector 整段汉字单 token，ISSUE-196）、审批门只接线两个工具（ISSUE-197）与 0001 RFC 的 Hermes 口径校正；运行中自写技能按争议一暂缓 |
| [Learn Claude Code 并发与调度重学精读](./agent-harness/176-claude-code-concurrency-relearn.md) | s13 后台任务 × s14 定时调度的**独立重学篇**（最新版 guided-learn，零继承旧篇）：占位回执守住「一次调用配一个结果」的协议名额、通知由主循环每轮收集后以新消息身份回注；cron 四层解耦（判时/队列/非阻塞交付/执行）与三道保险；教学版三处边界实测（后台复用 120 秒超时、摘要截 200 字、通知未转义）；官方文档逐项对账（印证清单 + 抖动上限硬分歧 + 超时自动转后台三路径）；确定性原型 + 五次破坏性实验 + 两张 archify 图 |

---

> 阅读建议：首次按一→六段论顺序通读；选型查阅直接跳到对应分组。各子目录的 `_category_.json` 提供分组级描述，wiki 左栏可折叠展开。
