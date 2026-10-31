# 科普视频作品总览

> 机读 SSOT：[series.json](./series.json)（顶层 `seriesList[]`，多系列并列）。顺序变更只改它 + 视觉层；
> 口播永不携带序号，校验器 [check_series.py](https://github.com/ThreeFish-AI/vibe-video/blob/main/pipeline/scripts/check_series.py) 保证散文/组件与清单一致。
>
> **多系列执法语义**：反串线（规则 1）**跨系列全局生效**——两个系列各自独立成片，口播互不引用；
> 顺序类规则（2/3/4）**按系列内判定**——不同系列的发布顺序互相无关，`episode` 的 `1..N`
> 连续性也只在系列内成立。

制作统一走[公共管线](https://github.com/ThreeFish-AI/vibe-video/blob/main/pipeline/README.md)（九阶段）；配音经 IndexTTS-2.5 本人音色克隆
（样本指纹见 [voices/refs.toml](./voices/refs.toml)，手册 [VOICE-CLONING.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/pipeline/VOICE-CLONING.md)）。

## 自进化系列（论文型选题）

事实源是论文（综述与研究论文），取证走 `paper_extract.py`。

| #   | 作品                                                                                          | 一句话主题         | 视觉契约（主色） | 源论文                                         | 状态                                                                                           |
| --- | --------------------------------------------------------------------------------------------- | ------------------ | ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | [《上线之后，AI 才开始上学》](./episodes/self-evolution/experience-era-agents/README.md)               | 部署之后经验怎么攒 | 金/青/紫         | 清华×Frontis 88 页综述（无 arXiv 号），2026-06 | **v3 就绪**（内容校准 + sunny-steady 全片重配，成片 14:01；源码含未重渲改动：P3 格阵落格校准） |
| 2   | [《AI 如何自己变强？》](./episodes/self-evolution/self-improving-agents/README.md)                     | 自我进化改什么     | 蓝/橙            | arXiv:2607.13104（Schmidhuber 团队），2026-07  | 就绪（待升级 sunny-steady，未排期）                                                            |
| 3   | [《会写代码的 AI，开始给自己写代码》](./episodes/self-evolution/self-evolving-coding-agents/README.md) | 代码领域全图       | 绿/洋红          | arXiv:2608.03392（NJUST×NJU），2026-08         | 就绪（源码含未重渲改动；待升级 sunny-steady）                                                  |
| 4   | [《翻旧账不花钱：AI 在梦里改章程》](./episodes/self-evolution/dream-rsi/README.md)                   | 元探索策略怎么改   | 冰蓝/暖白/嫩绿   | arXiv:2609.14858（UMD×DeepMind×UVA），2026-09  | **v2 终渲待审**（章节导航条版 10:30.87 · archify 混合 16 图；2026-09-23，归档 ~/Documents/video）｜旁白/屏上字已改（I-234）、成片待重制 |

## Claude Code Harness Engineering（文档/代码型选题）

拆解 Claude Code 的 **harness 工程**：内容准绳是官方文档（code.claude.com）与 Anthropic 工程实践，
开源课程仓库的 20 章/5 阶段结构只作组织骨架（观众层匿名化——`check_series.py` 规则 7）；
取证走 `source_ledger.py`（固定提交 + 双指纹 + 取数日期），断言按**证据三级**分层标注——
第三方对闭源产品源码的分析必须带归属句，不得当作产品既成事实。

| #   | 作品                                                                                  | 一句话主题                    | 视觉契约（主色）                         | 信源                                                                                              | 状态                                                                        |
| --- | ------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | [《工具与执行：一个循环，三层装置》](./episodes/claude-code-explained/claude-code-explained/README.md) | 循环不变式与三层挂载装置 | core #D97757 恒定/mech 石青 | 站点 s01–s04 钉 main `ce8f9f18`（MIT）＋官方文档轨 C；台账 15 条 audit FAIL 0 | 🟡 **剧本 v3 待审**（2026-10-07 信源换代）｜前代 v1 成片 14:02.6 · 164 句 · 12 图 65 章｜I-234 用词整改 |
| 2   | [《规划与协调：视野错位的五种修正手法》](./episodes/claude-code-explained/claude-code-planning/README.md) | 五件安排台面的装置 | mech 鸢紫 #9C90EE | s05–s07·s10·s11 @ `67a9126c` ＋轨 C | 🟡 **剧本 v3 待审**（2026-10-07 信源换代）｜前代 v1 成片 14:12.2 · 12 图 68 章｜I-234 用词整改 |
| 3   | [《记忆管理：会丢的和不能丢的》](./episodes/claude-code-explained/claude-code-memory/README.md) | 两套咬合的机制 | mech 苔绿 #A9C46C | s08·s09 @ `67a9126c` ＋轨 C（main 演进彩蛋） | 🟡 **剧本 v3 待审**（2026-10-07 信源换代）｜前代 v1 成片 14:13.3 · 12 图 62 章｜I-234 用词整改 |
| 4   | [《并发与调度：一张回执和四层钟》](./episodes/claude-code-explained/claude-code-concurrency/README.md) | 一张回执＋四层钟 | mech 霜蓝 #7FB2E0 | C 型信源＝174 新精读（v3 换代） | 🟡 **剧本 v3 待审**（2026-10-07 信源换代）｜前代＝本分支完全重制 v1 交付（14:26.8 · 149 句 · 13 图 47 章 · edge 草声）＋系列片头挂载已接｜I-234 用词整改 |
| 5   | [《多 Agent 平台：从一个到一群》](./episodes/claude-code-explained/claude-code-multiagent/README.md) | 从一个到一群的五物件 | mech 协作金 #D9B36B | s12·s15–s20 @ `67a9126c` ＋轨 C 八校准 | 🟡 **剧本 v3 待审**（2026-10-07 信源换代·终集收束）｜前代 v1 成片 13:42.8 · 13 图 67 章｜旁白/屏上字已改（I-234）、成片待重制 |
| 4   | [《并发：谁来按下开始》](./episodes/claude-code-explained/claude-code-concurrency/README.md) | 后台不等＋定时钟自动 | mech 霜蓝 #7FB2E0 | s13·s14 @ `67a9126c` ＋轨 C | 🟡 **剧本 v3 待审**（2026-10-07 信源换代）｜前代 v1 成片 14:10.8 · 12 图 59 章｜I-234 用词整改 |
| 5   | [《多 Agent 平台：七件设施，一条走廊》](./episodes/claude-code-explained/claude-code-multiagent/README.md) | 七件设施与一条走廊（终集） | mech 协作金 #D9B36B | s12·s15–s20 @ `67a9126c`（C 型=175 冻结快照） | ✅ **换题重制 v2 交付**（edge 终声版 14:17.8 · 147 句 4015 字 · 14 图 49 章 · 六实验入片 · 评审修复 9 commits 80 项入片 · indextts 重配待触发）｜旁白/屏上字已改（I-234）、成片待重制 |

> 章节→集归属与**站点/仓库修订分叉**（站点为 20 章旧修订、仓库 main 已整合为 17 章，故双钉）：
> 系列级登记见 [source-map/claude-code-explained.md](./source-map/claude-code-explained.md)。

**系列纪律**：各集独立成片，口播互不引用、不出现集数序号——顺序只存在于本清单与片尾视觉卡片，
发布顺序变更的 TTS 代价恒为零。

**系列片头《一个循环》**（2026-10-06 上线、2026-10-08 独立化并铺开五集）：约 23.5s 统一开场（口播
为独立音轨不入各集 narration，逐集差异=本集 mech 授色与本集站定格，全数据驱动）；种子与同步纪律见
[series-assets/claude-code-explained/intro/README.md](./series-assets/claude-code-explained/intro/README.md)，
台账见 [I-209](../../docs/.agents/issue.md)。

## Claude Code 的 20 个核心机制（文档/代码型选题 · 20 集制）

与上系列同信源的**按章拆集**新系列（2026-10-29 建档）：课程站点 20 章 1:1 拆集、每集约 5 分钟、单章讲透（例：上系列第 1 集《工具与执行》= 本系列前四集 Agent Loop / Tool Use / Permission / Hooks）。两系列并行，本系列建成后旧系列退役；取证纪律与上系列一致（固定提交 + 双指纹 + 证据三级）。

| #   | 作品                                                                          | 一句话主题                   | 视觉契约（主色）      | 信源                                                                        | 状态                                                                          |
| --- | ----------------------------------------------------------------------------- | ---------------------------- | --------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | [《Agent Loop：一个循环，让 Agent 开始了心跳》](./episodes/claude-code-harness/chapters-01-loop/README.md) | 三十行循环如何让模型长出手 | core #D97757 / 青碧   | s01 钉 main `7226f555` + 站点轨附录（s01f-*）@ `67a9126c`；C 型=现行 171 冻结 | 🟢 **已交付**（2026-10-30 制作轮收官：25 镜六场景 + 系列片头孪生挂载 + 本人克隆声 TTS，终渲 289.3s/4.8 分落窗，QA 机器门+五帧高风险目检全绿，交付 v1；同日 v2：p1-13「装置→程序」术语修订；v3：p2-03 拆两句改写「模型要求调用写文件」+ 参数句独立成字幕） |
| 2   | [《Tool Use：多加一个工具，只加一行》](./episodes/claude-code-harness/chapters-02-tooluse/README.md) | 查表分发与编号配对：加能力不动核心 | core #EFB13C（查表）/ #EF6461 | s02 翻钉 main `7226f555`（判据措辞与 ep1 同口径 + 接口论证新节）+ 站点轨附录（s02f-*）@ `67a9126c`；C 型=现行 171 同代次冻结；实验 2 复算【一】 | 🔵 **文案轮待审批**（2026-10-29：Stage ①–⑤ 完成，首尾署源制沿用） |

| 3   | [《Permission：三道闸门，动手之前的裁决》](./episodes/claude-code-harness/chapters-03-permission/README.md) | Permission：三道闸门——动手之前的裁决 | core #7C6FF0（裁决紫）/ #4E9EFF | s03 翻钉 main `7226f555`（判据硬伤+词边界正则增量）+ 站点轨附录（s03f-*）；C 型=现行 171 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 4   | [《Hooks：扩展不进循环》](./episodes/claude-code-harness/chapters-04-hooks/README.md) | Hooks：钩子注册表——扩展不进循环 | core #8B7CF6（挂点紫）/ #58A6FF | s04 翻钉 main `7226f555`（判据口径+Stop 续跑入正文）+ 站点轨附录（s04f-*）；C 型=现行 171 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 5   | [《TodoWrite：把计划摆回模型眼前》](./episodes/claude-code-harness/chapters-05-todowrite/README.md) | TodoWrite：计划外显——把计划摆回模型眼前 | core #6E9BFF（规划蓝）/ #B48CF2 | s05 钉 20 章版轨 `67a9126c`（附录族正源在站点轨）；C 型=现行 172 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 6   | [《Subagent：过程隔离，只回结论》](./episodes/claude-code-harness/chapters-06-subagent/README.md) | Subagent：过程隔离——子任务独立上下文干活，只回结论 | core #9B8AFB（隔离紫）/ #4EA8DE | s06 翻钉 main `7226f555`（子循环判据同款硬伤）+ 站点轨附录（s06f-*）；C 型=现行 172 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 7   | [《Skill Loading：目录常驻，全文按需》](./episodes/claude-code-harness/chapters-07-skillloading/README.md) | Skill Loading：两级加载——目录常驻、全文按需 | core #7E77E8（目录紫）/ #4E9DF5 | s07 钉 20 章版轨 `67a9126c`（叙事数字锚只在站点轨）；C 型=现行 172 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 8   | [《Context Compact：先整理，再总结》](./episodes/claude-code-harness/chapters-08-contextcompact/README.md) | Context Compact：上下文压缩——四步管线腾地方，便宜的先跑贵的后跑 | core #4E9FFF（落盘蓝）/ #7C6BE8 | s08 翻钉 main `7226f555`（全重写正源（四点论证新节））+ 站点轨附录（s08f-*）；C 型=现行 173 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 9   | [《Memory：索引与按需加载》](./episodes/claude-code-harness/chapters-09-memory/README.md) | Memory：持久记忆——索引常驻与正文按需 | core #8B7EC8（记忆库紫）/ #5FA8E0 | s09 翻钉 main `7226f555`（判据硬伤+内容块判据）+ 站点轨附录（s09f-*）；C 型=现行 173 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 10   | [《System Prompt：提示是拼出来的，不是写死的》](./episodes/claude-code-harness/chapters-10-systemprompt/README.md) | System Prompt：按真实状态组装——分段、拼装、缓存三步 | core #A78BFA（分段紫）/ #5CA8FF | s10 钉 20 章版轨 `67a9126c`（独立章只在站点轨（main 并入 s15））；C 型=现行 172 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 11   | [《Error Recovery：报错先分类，循环不亡》](./episodes/claude-code-harness/chapters-11-errorrecovery/README.md) | Error Recovery：分类恢复——报错先分类走三条有界退路，循环不亡 | core #6C8CFF（恢复蓝）/ #B48EF5 | s11 钉 20 章版轨 `67a9126c`（六节深潜只在站点轨（main 并入 s15 尾））；C 型=现行 172 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 12   | [《Task System：从执行清单到可认领的契约》](./episodes/claude-code-harness/chapters-12-tasksystem/README.md) | Task System：任务板契约——大目标拆卡落盘、依赖挡在认领前 | core #9B8CFF（任务卡紫）/ #58B7FF | s12 钉 20 章版轨 `67a9126c`（改号不改内容复核成立）；C 型=现行 175 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 13   | [《Background Tasks：慢命令丢后台，结果走通知》](./episodes/claude-code-harness/chapters-13-backgroundtasks/README.md) | Background Tasks：慢命令后台化——占位回执与通知回注 | core #7C9EFF（后台蓝）/ #C084FC | s13 钉 20 章版轨 `67a9126c`（附录六段+判时首节只在站点轨）；C 型=现行 176 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 14   | [《Cron Scheduler：按时间表生产工作》](./episodes/claude-code-harness/chapters-14-cronscheduler/README.md) | Cron Scheduler：定时调度——到点与有空，分给四个角色 | core #8B93F8（判时蓝）/ #56C8FF | s14 钉 20 章版轨 `67a9126c`（四层解耦叙事与站点轨逐节对应）；C 型=现行 176 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 15   | [《Agent Teams：文件收件箱与持久队友》](./episodes/claude-code-harness/chapters-15-agentteams/README.md) | Agent Teams：文件收件箱——队友不共享对话，只递信 | core #D946EF（品红）/ #3EB6E8 | s15 钉 20 章版轨 `67a9126c`（20 章版单章成集（main s13 整合章对照））；C 型=现行 175 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 16   | [《Team Protocols：对上号，才改状态》](./episodes/claude-code-harness/chapters-16-teamprotocols/README.md) | Team Protocols：请求-响应协议——对上号才改状态 | core #7D91FF（请求蓝）/ #C792EA | s16 钉 20 章版轨 `67a9126c`（协议课唯一独立章形态）；C 型=现行 175 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 17   | [《Autonomous Agents：自己看板，自己认领》](./episodes/claude-code-harness/chapters-17-autonomousagents/README.md) | Autonomous Agents：空闲自认领与认领原子性——没人派活，活也能分下去 | core #38BDF8（轮询紫）/ #E879F9 | s17 钉 20 章版轨 `67a9126c`（自治单章只在站点轨（main s17 撞号异物））；C 型=现行 175 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 18   | [《Worktree Isolation：一个任务，一个房间》](./episodes/claude-code-harness/chapters-18-worktreeisolation/README.md) | Worktree Isolation：目录隔离——一个任务一间房、收尾默认拒绝 | core #C15AE8（分支紫）/ #3FA4C4 | s18 钉 20 章版轨 `67a9126c`（worktree 单章为 20 章版独有）；C 型=现行 175 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 19   | [《MCP 与插件：发现、命名、组装》](./episodes/claude-code-harness/chapters-19-mcpplugin/README.md) | MCP 与插件：外部工具接入——发现、命名、组装，池变缓存作废 | core #A855F7（协议紫）/ #3B82F6 | s19 翻钉 main `7226f555`（宿主策略等三节机制级增量）+ 站点轨附录（s19f-*）；C 型=现行 175 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |
| 20   | [《综合回合：机制很多，循环一个》](./episodes/claude-code-harness/chapters-20-comprehensive/README.md) | Comprehensive：机制挂点——全部机制挂回同一个循环 | core #8260E8（深空紫）/ #5B8DEF | s20 钉 20 章版轨 `67a9126c`（终章叙件（结束亦是开始+回归表）只在站点轨）；C 型=现行 175 冻结 | 🔵 **文案轮待审批**（2026-10-31：Stage ①–⑤ 完成，实验复算升【一】，首尾署源制沿用） |

## Context Layer · 上下文层系列（doc 型 · 3 集）

信源为本仓研究文档族（B 型 · 固定提交取证）：前两集上游 Snowflake 官方页不直接取证、只经 011 精读笔记的 IEEE 引用链间接可溯；第三集上游 volcengine/OpenViking 官方页与代码仓不直接取证、只经 014 精读笔记的 `path:line@14a7b81` 锚点链间接可溯。系列纪律同前（口播互不引用、无集数序号）。

| #   | 作品                                                                              | 一句话主题                     | 视觉契约（主色）              | 信源                                                                                     | 状态                                                          |
| --- | --------------------------------------------------------------------------------- | ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | [《拆解 Horizon Context》](./episodes/context-layer/horizon-context/README.md)            | Snowflake Horizon Context：怎么治理 Agent Context  | 琥珀金/青碧/淡紫              | 011 gen2 冻结 @ `192ae6ca9` + 双 selftest 复算，2026-10-02                              | **v2 终渲待审**（完全重制 · 15:06 · story 档 · archify 47 图 106 cue · 锚定 67.9%；10-16 直述化 2 句旁白已改、成片待重制）｜旁白/屏上字已改（I-234）、成片待重制 |
| 2   | [《拆解 Agent Context Layer：上下文怎么供给、治理、装配》](./episodes/context-layer/context-layer/README.md) | Context Layer：三面蓝图怎么拆解（2026-10-16 v4 零类比重制） | 钢蓝/工业橙/校准绿            | 013 去比喻版 + 011 + lab/mcp 原型 @ `5ebfb7e3b`，2026-10-19                        | **v3 终渲待审**（27:31.77 · 克隆终声 story 档 · 12 图 63 章 137 cue · 锚定 39.0%）｜旁白/屏上字已改（I-234）、成片待重制 |
| 3   | [《给 AI 一座图书馆：OpenViking 上下文数据库》](./episodes/context-layer/openviking/README.md) | OpenViking：文件系统范式怎么做上下文 | 玫红/薄荷绿/长春花蓝        | 014 精读笔记 + 015 映射 + openviking_lab @ `348d8797`，2026-09-24                          | **v1 终渲待审**（10:37 · archify 9 图 54 cue 回放）｜旁白/屏上字已改（I-234）、成片待重制 |

## Agent 基础设施系列（doc 型 · 3 集）

信源为本仓 `docs/research/agent-infra/` 精读笔记与最小原型（B 型 · 固定提交取证），并直接取证上游开放标准的固定提交（规范、指南与参考实现源码）；本仓实现的映射结论不进正片。系列纪律同前（口播互不引用、无集数序号）。

| #   | 作品 | 一句话主题 | 视觉契约（主色） | 信源 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1   | [《目录常驻，正文按需：Agent Skills 开放标准》](./episodes/agent-infra/agent-skills/README.md) | Agent Skills：目录常驻、正文按需的领域知识打包开放标准 | 目录金/路由靛/治理紫 | 精读（C 型）@ 本分支（原 210 已并入 230）+ agentskills/agentskills @ `69ef37e9`，2026-09-26 | **成片交付 v1**（12:55 · edge 草声 · 双图 10 章 12 cue · 锚定 8.5% · lab2 五实验复算 · 归档 ~/Documents/video）｜旁白/屏上字已改（I-234）、成片待重制 |
| 2   | [《只填格的判读员：Jev 决策模型》](./episodes/agent-infra/jev-decision-model/README.md) | Jev：小判断的交付方式怎么变 | 格黄/柱青/闸品 | 200 精读 + 原型 + laya 复刻 @ `40bf690` + TypeSafe 官方/adapter/kev/laya/nibzard 钉提交，2026-09-26 | **v1 终渲待审**（14.2 分 · story 配音 · archify 13 图 54 章 · 归档 ~/Documents/video）｜旁白/屏上字已改（I-234）、成片待重制 |
| 3   | [《没有海关的港口：Skills 的签名、分发与版本战争》](./episodes/agent-infra/skills-supply-chain/README.md) | Agent Skills：签名/分发/版本三战场 | 关税橙/检疫绿 | 220/221 供应链精读 @ `9284cce2c` + agentskills @ `69ef37e9` + MCP SEP-2640 @ `b0b3272f`，2026-09-27 | **成片交付 v1**（13:57 · 20 图 79 cue · 锚定 78.2% · 归档 ~/Documents/video） |
