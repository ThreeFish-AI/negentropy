# 系列信源地图——《Claude Code 的 20 个核心机制》（claude-code-chapters）

> 机读版：[claude-code-chapters.toml](./claude-code-chapters.toml)；与 [series.json](../series.json)（机器）/ [series.md](../series.md)（人读）同一配对纪律。本文件是本系列**章→集归属与钉选的唯一登记处**，各集 `research/gl-notes.md` 只链接、永不重述。§五–§七 承袭自旧系列《Claude Code Harness Engineering》信源地图（该系列 2026-11-10 退役，本文件为撞号防御、口播词表与片头锚定的唯一现行登记处）。

## 一、系列定位与拆集决策

- **信源**：[Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)，MIT；站点 [learn.shareai.run/zh](https://learn.shareai.run/zh/)（与已退役旧系列同源，三轨修订谱系见 §五）。
- **集制**：站点 20 章版 **1:1 拆集**（2026-10-29 用户决策）——每章一集、每集约 5 分钟、单章讲透。示例：旧系列第 1 集《工具与执行》= 本系列 ep1 Agent Loop + ep2 Tool Use + ep3 Permission + ep4 Hooks 四集。
- **与旧系列关系**：旧系列《Claude Code Harness Engineering》（5 集制）已于 2026-11-10 退役（内容被本系列 20 章完整吸收，git 历史可考）；其信源地图的承重节（修订分叉/撞号防御/两轨对照/口播词表/片头锚定）已并入本文件 §五–§七。
- **信源分析层**：继续沿用 [docs/research/agent-harness/171–176 精读族](../../../docs/research/agent-harness/)（C 型冻结进各集 `research/gl-notes.md`）；ep1 冻结现行 171（含 2026-10-23 I-234 词族整改后代次）。

## 二、钉选（双钉，与旧地图同款理由）

| 钉 | ref | 覆盖 | 理由 |
|---|---|---|---|
| main（17 章整合版，README.zh.md） | `7226f555`（2026-10-27） | ep1–ep4、ep6、ep8、ep9、ep19 | ep1/ep2：判据之争记忆点「认内容块别信停止标记」+「为什么还要加工具」接口论证的正源（2026-10-29 翻钉）。ep3–ep20 文案轮开工复核（2026-10-31）再翻钉四集：ep3/ep4/ep6（站点轨 s03/s04/s06 判据仍写 stop_reason、直引必与 ep1 所教自相矛盾，且 main 各有正源级增量——s03 词边界正则+测试点 5、s04 Stop 续跑写进教学正文、s06 子循环判据同款硬伤）、ep8（main s08 为全重写正源：四点论证与「为什么顺序固定」等机制级演进全部只在 main）、ep9（站点轨判据同款硬伤 + main 内容块判据）、ep19（main s14_mcp_plugin 有宿主策略/正源级三节增量）。完整证据链在各集 gl-notes 附录 B.1 |
| 站点同源修订（20 章版，README.md） | `67a9126c`（2026-07-29） | ep5、ep7、ep10–ep18、ep20 | 20 章版是本系列集制骨架；分支 HEAD 至 2026-10-31 未动，各站点页与 2026-10-07 基线零漂移（逐集复核）。维持站点轨的十二集理由：ep5/ep7（main 仅注释中文化与空输入守卫，站点轨独有「深入 CC 源码」附录族与本集叙事数字锚是正源）、ep10/ep11（main 无独立章，深潜只在站点轨）、ep12/ep13/ep14（「改号不改内容」复核成立，main 对照经 {slug}m-* 登记）、ep15–ep18（系列决策 20 章版单章成集，main s13_agent_teams 整合章仅作对照）、ep20（终章叙件「结束亦是开始」收束节与全量回归表只在站点轨） |

各集需要的另一轨独有材料——站点轨各章「深入 CC 源码」附录、main 轨对照章（s10_task_system / s11–s12 改号章 / s13_agent_teams 整合章 / s15_integrated_harness）——经各集台账 `{slug}f-*` / `{slug}m-*` 条目补登（字节归档随集），断言恒【三】级、归属由首尾署源位承接。

修订分叉全叙事（站点 20 章版 ↔ main 17 章整合版的章号不共用、I-165 根因）与撞号防御表见本文件 [§五](#五修订分叉与撞号防御承袭自旧系列地图全仓唯一展开层)。

## 三、章→集归属（20 章 × 20 集）

见机读版 `[[chapter]]` 表：`s01_agent_loop`→ep1 … `s20_comprehensive`→ep20，一集一章。ep1 已交付、ep2 文案轮待审批（2026-10-29）；ep3–ep20 已于 2026-10-31 完成脚手架与文案轮开工复核（钉选定案见 §二），文案轮 Stage ①–⑤ 推进中。

### 五大组归属（片头站点/进度点数据面的登记源）

组名与片头音频「五种核心机制」逐词对位（音频是系列级固定资产）；归属按章节主题定，在集轴上**不连续**——`harness-stack.tsx` 的 `EPISODE_GROUPS` 查表实现与本表同步：

| 组 | 章节 | 集号 |
|---|---|---|
| 工具与执行 | s01–s04 | 1–4 |
| 规划与协调 | s05–s07、s10、s11 | 5–7、10、11 |
| 记忆管理 | s08、s09 | 8、9 |
| 并发 | s13、s14 | 13、14 |
| 多 Agent | s12、s15–s20 | 12、15–20 |

## 四、口径与纪律（沿用并链接）

- 证据三级、数字复算、活数据不进口播：vibe-video skill [01-source-extraction](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/01-source-extraction.md) B/C 型；各集 `research/gl-notes.md` 头部冻结登记。
- 口播类比唯一准入：冻结件附录 A 类比登记表（一物一喻，不在视频阶段另造）；旧系列退役喻体（禁喻词表）继续禁用——清单在本文件 [§六](#六口播词表-ssot承袭自旧系列地图)。
- 观众层去站点化（check_series 规则 7）：按章节拆集只是编导结构，口播与画面零课程站痕迹；研究层具名归属照旧。
- 台账命名（自旧地图承袭）：条目名由 sync 派生 `{slug}-readme` / `{slug}-code` / `{slug}-site`（多 sitePath 时 `{slug}-site-{path}`），audit 拒绝改名后的漂移条目；新集开工先 `sync --episode N`、交付前 `audit --episode N` 零报警 + `verify` FAIL 0；课程再改版时已交付集的钉**默认不动**（逐字稿冻在录音时刻，台账指纹即物证）。

## 五、修订分叉与撞号防御（承袭自旧系列地图，全仓唯一展开层）

《Learn Claude Code》课程有**两轨现行修订 + 一轨历史遗产**，章号不共用（撞号防御见下表）。哪一章归哪一集、哪一集钉哪个提交，**全系列只在 §二/§三 登记**；各集 `research/gl-notes.md` 冻结登记只链接本文件取信源钉，章→集归属永不重述——重述即第二事实源，两轨章号错位时必然漂移。

| 轨 | 修订 | 章 | 中文章名 | 提交 |
|---|---|---|---|---|
| 站点 `learn.shareai.run/zh` | 2026-07 修订 | **20 章** | `README.md` | `67a9126c`（2026-07-29，分支 `fix/s08-s20-sync-frontmatter-parser`，站点内容与该分支逐字一致） |
| 仓库 `main` | 2026-08 整合 | **17 章** | `README.zh.md` | `7226f555`（2026-10-27；本系列钉选见 §二） |
| 旧 12 课轨（历史遗产） | 仓库 `docs/` + `agents/` | 12 课 | 三语 markdown | 两钉上均在，属最老一层，**仅作考古对照，禁止引用** |

I-165「站点 LOC 复算不出」的根因即此：**站点整站是课程的旧修订**，页面上的数字与旁边的代码本就不是同一时刻的产物，双钉因此是逐集的内容决策而非技术巧合。耐久性：`67a9126c` 在未合并分支上（分支被强推/删除则 raw URL 失效），`source_ledger.py verify` 在 raw 指纹漂移时 FAIL 报警，台账已登记全指纹 `raw_sha256` 兜底；每集取证字节另归档至 `research/source-archive/<pin>/`（MIT 许可）。

### 撞号防御（三轨编号不共用——本表是全仓唯一展开层）

**三轨三物（最危险区）**：

| 号 | 旧 12 课 | main 17 章 | 站点 20 课 |
|:---|:---|:---|:---|
| s10 | Team Protocols | Task System | System Prompt |
| s11 | Autonomous Agents | Background Tasks | Error Recovery |
| s12 | Worktree+Task Isolation | Cron Scheduler | Task System |

**双轨撞号（旧轨 vs 新轨，s03–s09 自 s03 起全部错位）**：s03（旧 TodoWrite ↔ 新 Permission）、s04（旧 Subagent ↔ 新 Hooks）、s05（旧 Skill ↔ 新 TodoWrite）、s06（旧 Compact ↔ 新 Subagent）、s07（旧 Task System ↔ 新 Skill）、s08（旧 Background ↔ 新 Compact）、s09（旧 Teams ↔ 新 Memory）。

**双轨撞号（main vs 站点，s13–s17 全部错位）**：

| 号 | main 17 章 | 站点 20 课 |
|:---|:---|:---|
| s13 | Agent Teams | Background Tasks |
| s14 | MCP Plugin | Cron Scheduler |
| s15 | Integrated Harness | Agent Teams |
| s16 | Workflow Runtime | Team Protocols |
| s17 | Goal Loop | Autonomous Agents |

s18–s20 仅存在于站点轨；main 无 s18+。**s01/s02 是唯一三轨同号同物安全区**（但旧轨是简化遗产实现）。另有一条**已消失的中间撞号层**：main 历史提交 `b36dbcd`（19 章态）曾有 `s16_mcp_plugin`/`s17_integrated_harness`/`s18_workflow_runtime`——引任何历史快照都须带 commit 号。**纪律：涉两轨同号一律「轨道 + 章全称」，禁止裸用编号。**

### 两轨对照（站点 20 章版 ↔ main 17 章版，`sync`/`audit` 只消费 [[pin]] 与 [[chapter]]，本表给人的导航）

| 站点 20 章版 | main 17 章版 | 关系 |
|---|---|---|
| s01–s09 | s01–s09（目录名逐一同名） | 两轨共有（内容仍有 2026-07→08 的演进，如 s01 循环判据；s08 在 main 有机制级演进——条件化 micro / fit_tool_results / 占位符幂等，站点轨均无） |
| s10 System Prompt | 隐式吸收进 `s15_integrated_harness` | 机制以 `assemble_system_prompt` 存续；s10 的独立课深潜（PROMPT_SECTIONS/缓存/CC 真实 prompt 解剖）只在站点轨 |
| s11 Error Recovery | 并入 `s15_integrated_harness` 尾部 | 恢复路径集一字不差纯并入；六节深潜只在站点轨 |
| s12 Task System | `s10_task_system` | 改号不改内容 |
| s13 Background Tasks | `s11_background_tasks` | 改号不改内容 |
| s14 Cron Scheduler | `s12_cron_scheduler` | 改号不改内容 |
| s15+s16+s17+s18（团队四课） | `s13_agent_teams`（单章 12 节） | 整合且有真增量：事件模型重构（结果与 IDLE 拆成两事件）、认领两步化（发现与认领分离+原子执行）、worktree 语义加固（收归宿主侧+租约）、约束闭环（assignment version 使旧审批失效） |
| s19 MCP Plugin | `s14_mcp_plugin` | 改号不改内容 |
| s20 Comprehensive | `s15_integrated_harness` | 对应并被扩写（diff ~218 行；main 增量 = s08 新压缩管线 + s13 加固语义回灌） |
| —— | `s16_workflow_runtime` | main 新增，本系列不覆盖（精读归 174 附录） |
| —— | `s17_goal_loop` | main 新增，本系列不覆盖（精读归 172 附录） |

## 六、口播词表 SSOT（承袭自旧系列地图）

观众可见层禁用「旧版隐喻系」意象（v1 世代剧场叙事遗产）。此前禁喻清单曾在多处各自抄录、互不一致，**本节为唯一收敛处**，各集引用一律指向这里：

- **共通禁喻（10 词）**：车间 / 作坊 / 传送带 / 工序卡 / 副台 / 台面 / 收台 / 叫号器 / 排工板 / 插线口
- **旧 ep5 补充禁用（差异纪律）**：收件格 / 派工单 / 班次 / 隔间 / 插口 / 「从一个到一群」句式
- **「师傅」**：登记分歧——ep5 头注口径为系列通用角色词（沿用）、ep1 v3 planning 并入禁用（ep1 v3 剧本实际零使用）；裁决归各集②审校，趋势从严口径。

五集域词登记（旧系列一集一域、跨集避让的差异化纪律；本系列各章类比准入以各集冻结件附录 A 为准，其中承袭条目即源出下表）：

| 旧集 | 域词 |
|---|---|
| ep1 工具与执行 | 急诊 / 病历 / 接诊 |
| ep2 规划与协调 | 视野错位 / 修正手法 / 焦距 |
| ep3 记忆管理 | 草稿纸 / 卡片册 / 台面 / 登记簿 |
| ep4 并发 | 工坊 / 清洗槽 / 滚筒 / 钟盘 |
| ep5 多 Agent | 走廊（集名意象） |

执法：词表挂入 check_series 属 RSI 候选（negentropy I-216），落地前各集④校验按本节逐词 grep。

## 七、系列片头口播锚定（承袭自旧系列地图）

片头《一个循环》三句口播压在每集成片头部（现行 `leadInSec=18.7`，I-255 压缩后口径；TTS 合同固定在 `series-assets/claude-code-harness/intro/series-intro.tsx` 的 NARRATION 常量，改文案先改那里——B-0 台本合同）。三句全文：

> 这套视频从 Harness Engineering 的视角，讲清 Claude Code 如何从一个简单循环，逐步进化为一套完整的工程体系。接下来，我们将依次拆解五种核心机制：工具与执行、规划与协调、记忆管理、并发，以及多 Agent。机制层层递进，工程体系持续进化。

锚定与对位：

- 「从一个简单循环，逐步进化为一套完整的工程体系」↔ 171 §9.1 规律 1+5：**进化指外圈（保护层与能力）生长，循环本体一行不改**——各集幕设计若引申须守此口径；
- 「五种核心机制」= 五大组分组（§三五大组归属表），单集计数与系列计数不冲突；衔接用「这一集管其中一种」句式（裁量移交②审校）；
- 片头属系列资产（series-assets 种子 + 孪生门执法，I-208/209），非各集 Stage ① 产物；本节为其唯一事实源锚定登记处。
