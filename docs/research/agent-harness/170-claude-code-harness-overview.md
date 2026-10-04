---
sidebar_position: 1
title: "Learn Claude Code 五层 Harness 精读总览"
description: "以课程双轨一手材料（仓库 main 17 章 @ 0dcafa2a / 站点 20 章修订 @ 67a9126c，均 MIT）加 Anthropic 官方文档为信源的跨层综观：执行 → 规划 → 记忆 → 时机 → 协作五层的依赖链与层间缺口、单射贯穿 ②–⑤ 的角色台账（含 main 0dcafa2a 新机制五条归位）、四级证据分级、三轨撞号拓扑与 main 轨视频未取材两章的落位、跨章批判边界逐条换钉复验、与本仓 Claude Code 集成/Routine/多 Agent 学部的机制对位（025 消歧已办结、目标闸门获官方 Stop hook 强对位），以及配套最小原型的六次破坏性实验与 main 演进修复的 V1/V2 实测"
---

# Learn Claude Code 五层 Harness 精读总览

> [!NOTE] **核心精读范围**
>
> - 课程仓库 main 轨（17 章整合版）：[shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) @ [`0dcafa2a`](https://github.com/shareAI-lab/learn-claude-code/tree/0dcafa2ae053a1ddd6a72f265431104b08a5aa13)（2026-08-27），License **MIT**——① 层机制钉点与 main 轨独有两章；① 已于 2026-10-01 换代重写并换钉 main `ce8f9f18`（见下表），本轨 `0dcafa2a` 仍是 ②–⑤ 的 main 附录与 s16/s17 两章的钉点
> - 课程站点（20 章修订）：[Learn Claude Code](https://learn.shareai.run/zh/s01/)，内容与分支 @ `67a9126c`（2026-07-29）逐字一致——②–⑤ 层机制钉点；逐集钉选理由见[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)
> - Anthropic 官方文档（产品现状口径）：[code.claude.com/docs](https://code.claude.com/docs)，访问 2026-09-28（旧域名 `docs.claude.com/en/docs/claude-code/*` 已整体 301 迁移至此）
> - raw 取数与复验：2026-09-28；配套最小原型：[`assets/cc_harness_lab.py`](./assets/cc_harness_lab.py)（纯标准库，`--selftest` 秒级，六次破坏性实验）

**一句话定位**：这门课程用 Python 从一百余行的最小循环逐章长成千行级的整合 harness，每章只加一个机制——而它真正证明的事情只有一件：**从头到尾，循环没有变过**。让模型能在你机器上动手的，不是更聪明的模型，是循环外面一层层挂上去的 harness。

**总类比**：把整套东西想象成**一间通宵不打烊的工坊**。模型是那位手很快、但从不记事的师傅；harness 是这间工坊本身——传送带把活一趟趟送到他面前，门禁决定哪些活允许上机器，台面会满、满了要收拾，墙上的钟替他记着几点该干什么，隔壁工位上还有别人在同时干活。**②–⑤ 四章 = 工坊的四个区**，同一物件在四篇内只扮演一个角色，绝不换脸（① 已于 2026-10-01 换代重写，自带类比与通俗拆解体例，不再入工坊剧场）。

**怎么读这篇笔记**：五章各自独立成篇；②–⑤ 每个机制节按「**类比 → 机制 → 实景**」三拍走（① 换代重写后改为自带类比的通俗拆解体例），实景全部取自**固定提交上的课程原文实测或配套原型的实际运行输出**——它把材料里由模型承担的角色换成确定性脚本，因此回答的是「机制是否自洽」，不回答「模型是否聪明」。每章机制主体分钉站点轨或 main 轨，另一轨的差异以「轨道差异注记」内联，产品现状另设「官方文档对照」一节（① 换代重写后改为节内内联三轨对照）——**三套口径先分轨、再下笔**。

---

## 1. 为什么是这五层：一条不能跳步的依赖链

五层不是并列的功能清单，是一条**每一层都在偿还上一层欠下的债**的链子：

![Harness 五层依赖链：五个分层自左向右串成一条主链，每层下方挂着它从上一层接手的那个问题（目标漂移、台面会满、慢活无人触发、单人吞吐天花板），层间箭头标注「偿还」；收束节点写着「机制很多，循环一个」](../../assets/architecture/agent-harness/claude-code-harness--five-layer-dependency-dark.png)

> 图源（可 diff 文本）：[`claude-code-harness--five-layer-dependency.mmd`](../../assets/mermaid/agent-harness/claude-code-harness--five-layer-dependency.mmd) · 交互版（下载到本地打开）：[`claude-code-harness--five-layer-dependency.html`](../../assets/architecture/agent-harness/claude-code-harness--five-layer-dependency.html)

读法：**每一层的存在理由，都写在上一层的失败里**。跳过任何一层去看下一层，都会觉得后者是过度设计。

## 2. 角色台账（②–⑤ 单射，严禁一物多喻）

这是全文最容易破的地方，因此先立账。**同一个技术概念在 ②–⑤ 各章里只绑定一个角色**，各章只展示它的不同职责切面（① 换代重写后不再入戏，其首现行的角色由本篇行文与 ②–⑤ 沿用）；main 轨 `0dcafa2a` 演进引入的新机制照样新增入账（区隔见各行）。

| 技术概念 | 固定角色 | 首现 |
|:---|:---|:---|
| 主循环 `while True` | **传送带** | ① |
| 续轮判据（看内容块，不看停止标记） | **验活动作**——看手里还有没有活 | ① |
| 工具分发表 | **转接号码簿** | ① |
| 工具批次 | **一托盘**（同盘同时上，盘间排队） | ① |
| 权限闸门 | **门口三道门禁** | ① |
| 破坏性命令词位正则（rm/del 词边界匹配） | **危险品名册按词辨认，不再只按字符串包含** | ① |
| Hooks | **传送带边的插线口**（能加装置，改不了锁芯） | ① |
| 上下文窗口 | **台面** | ② |
| 待办清单 | **钉在台面的工序卡** | ② |
| 子 agent | **支起的副台**（只带回一张回执） | ② |
| 技能目录 / 技能正文 | **工具柜的抽屉标签** / **抽屉里的手册** | ② |
| System prompt | **每轮重铺的垫纸** | ② |
| 压缩 | **收台四步——腾到够放就停手** | ③ |
| `fit_tool_results`（超大未读新结果先落盘） | **新货分流——刚出炉的大件直接进仓库，不上台面** | ③ |
| 占位符指针校验（`persisted_output_path`） | **本坊仓库的门牌——条子上的地址必须是本坊的，外地址一律不认** | ③ |
| 掐段幂等（中段恰为单条归档标记不重切） | **掐过的地方留了记号，就不再掐第二刀** | ③ |
| 持久记忆 / 记忆索引 | **登记簿** / **登记簿的扉页目录** | ③ |
| 记忆挑选 | **目录员**（最多抽几页，拿不准就不抽） | ③ |
| 记忆整合（誊清） | **夜班整理工**（先删后写；誊之前先拍个照——main 轨才有） | ③ |
| 后台任务 | **自动清洗槽**（按下就走开） | ④ |
| 后台完成通知 | **叫号器** | ④ |
| 停滞巡视＋进度摘要 | **学徒**（只看不动手：水位不涨去瞧一眼，每批活贴张进度小字条） | ④ |
| 定时调度 | **墙上的定时钟** | ④ |
| 任务图 | **入口排工板** | ⑤ |
| 消息总线 | **每人门口的收件格**（读一条撕一条） | ⑤ |
| 协议请求/响应 | **一式两份的派工单** | ⑤ |
| worktree 隔离 | **各自的隔间** | ⑤ |
| MCP | **标准插口上外接的别人家机器** | ⑤ |

> [!WARNING] **三条防撞规则**
>
> 1. **「桌子」一词全篇禁用**——台面（上下文窗口）／副台（子 agent）／隔间（worktree）／工位（队友本人）语义各异，共用一词必然一喻多物。
> 2. **四个「帮手」不得混用**：记录员（写摘要）≠ 目录员（挑记忆）≠ 夜班整理工（记忆整合）≠ 学徒（进度字条）。
> 3. **三类「卡片」不得同名**：工序卡（待办）／抽屉标签（技能目录）／扉页目录（记忆索引）；同理叫号器（后台通知）≠ 收件格（队友消息）≠ 排工板（任务）。

## 3. 五章导航

| 章 | 机制钉点 | 覆盖 | 一句话本质 |
|:---|:---|:---|:---|
| [① 工具与执行](./171-claude-code-tooling-execution.md) | main `ce8f9f18` | 循环 · 工具 · 权限 · 钩子 | 它敢在你机器上动手，靠的不是更聪明，是循环外面挂着的三层外设 |
| [② 规划与协调](./172-claude-code-planning-coordination.md) | 站点 `67a9126`（附录 main） | 待办 · 子 agent · 技能 · 系统提示 · 错误恢复 | 它每一轮都把台面从头重读一遍——所以「看见什么」从来不是它自己说了算 |
| [③ 记忆管理](./173-claude-code-memory-management.md) | 站点 `67a9126`（演进节 main） | 上下文压缩 · 持久记忆 | 记忆不是一个功能，是两套咬合的机制：一套承认会丢，一套保证不丢 |
| [④ 并发与时机](./174-claude-code-concurrency.md) | 站点 `67a9126`（附录 main） | 后台任务 · 定时调度 | 所谓后台没有平行宇宙，只是「不等它」；而有些活连按开始的人都不要 |
| [⑤ 多 Agent 平台](./175-claude-code-multi-agent-platform.md) | 站点 `67a9126`（演进注记 main） | 任务图 · 团队 · 协议 · 自治 · 隔离 · MCP | 把「多 Agent」拆开，全是朴素物件；而循环还是那一个 |

②–⑤ 各章另有「官方文档对照」一节收本维硬分歧（① 换代重写后改为节内内联对照）；21 条硬分歧按维分配，185 条【官】事实全量留在取证 lab 与各集 notes（见 §4）。哪一章钉哪个提交的全系列登记处是[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)。

## 4. 证据分级（②–⑤ 纪律）

这门课程的信息密度最高之处，恰恰也是最容易说错之处：它对 Claude Code **闭源**源码的分析，以及两轨修订之间的口径漂移，都须逐条锚定来源等级（① 换代重写后改为 IEEE 编号引用＋三轨漂移内联标注，四级徽章由 ②–⑤ 沿用）：

| 级 | 含义 | 本文的义务 |
|:---|:---|:---|
| 【一】 | 课程仓库/站点固定提交实测，或本文最小原型 `--selftest` 可复算 | 可直接断言 |
| 【二】 | 课程站点正文（与钉点代码同源的讲法） | 可断言，但属「课程的讲法」 |
| 【三】 | 课程作者对闭源 Claude Code 源码的分析（文面载体＝站点轨「深入 CC 源码」节，main 轨已无此节） | **必须带归属句**，且**一律不转引具体文件行号**，只转引结构性结论 |
| 【官】 | Anthropic 官方文档（code.claude.com，产品现状口径） | 产品现状与默认态以官方为准；与课程口径冲突时双方并记，课程断言带时间状语 |

> [!IMPORTANT] **本组不是口播取证源**
>
> 科普视频各集的逐章取证、原文引语、可调参数与生产版对照（含轨 C 官方事实集全量），归各集 `research/source-notes.md`；章→集归属、钉选与三轨撞号防御，只登记在[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)。
> **除「main 轨独有两章」与本文最小原型实测外，本组任何断言若与各集 source-notes 冲突，一律以 notes 为准。**

## 5. 本组不得重述的事实（SSOT 边界）

为避免第二事实源漂移，以下事实**只给链接，不在本组复述**：

1. 章→集归属 · 2. 固定提交的选择与理由 · 3. 站点 20 章 ↔ main 17 章逐行对照表 · 4. 三轨编号对照与全部撞号点 · 5. 取证台账的条目命名与审计判据 —— 全部指向[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)（其 §二「撞号防御」是全仓唯一展开层）
6. 各集标题／集序／配色／时长／交付状态 —— 指向 `series.json` / `series.md`
7. 逐字口播文本与各集口播禁用清单 · 8. 站点／仓库原文的逐字引语 · 9. 站点插图的文字规格转写 · 10. 闭源源码的文件名与行号 · 11. 各章总行数／工具数实测总表与各集分歧清单 —— 全部指向各集 `research/source-notes.md`（main 独有两章的附录为唯一豁免，见 §6）

**可写与不可写的判据**：**机制不变式与顺序约束可写**（如「大结果必须先落盘，之后才允许旧结果变成占位符」），它跨修订稳定，是精读的本体；**随修订漂移的可调常数不写**（保留条数、字节阈值、预算上限、小时数、个数上限），一律以「参数见对应集 notes」代之。

## 6. main 轨独有的两章：视频未取材的净增量

课程仓库 main 有两章不在站点 20 章修订内，[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)已登记其不被任何一集取材——即科普视频五个作品均未以它们为信源。它们没有任何一集持有，**因此本组是它们的唯一事实源**（唯一豁免：参数在两篇附录写全）：

| 目录（main 轨全称） | 文件 | 落位（机制、常量与行数实测的唯一落点＝附录） |
|:---|:---|:---|
| `s16_workflow_runtime` | `code.py` / `README.zh.md` | [④ 并发与时机 · 附录](./174-claude-code-concurrency.md)——全仓唯一的事件循环扇出并发：有屏障／无屏障两原语、journal 断点续跑 |
| `s17_goal_loop` | `code.py` / `README.zh.md` | [② 规划与协调 · 附录](./172-claude-code-planning-coordination.md)——给循环装目标闸门：终止原因建模为七个互斥的一等状态 |

> 取证：`raw.githubusercontent.com/shareAI-lab/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/<目录>/<文件>`，取数 2026-09-28，License MIT。换钉复核【一】：自旧钉 `f9e8b280` 前进 25 提交，两章 `README.zh.md` 字节未动，`code.py` 增量全为 UTF-8/readline 一类机械级修复——`wc -l` 实测 s16 `code.py` **880** 行 / s17 `code.py` **896** 行（本仓于取证 lab 的 raw 快照独立复核一致），「机制自洽」结论不受影响。
>
> ⚠️ **撞号警告**：这两章的编号与站点 20 章修订里的 s16／s17 **不是同一章**——main 与站点的 s13–s17 全部错位，s10–s12 更与旧 12 课轨构成三轨三物高危区。三轨编号对照与全部撞号点的唯一展开层是[系列信源地图 · §二 撞号防御](../../../apps/negentropy-influence/source-map/claude-code-explained.md)；本组提及它们时一律书写「main 轨 + 完整目录名」全称，禁止裸用编号。

## 7. 全局批判性边界（材料没有证明的事）

以下五条跨章成立，各章不再重述，只链接本节（换钉至 `0dcafa2a`/`67a9126c` 后逐条复验）：

1. **站点与仓库不是同一时刻的产物——这是可验算的拓扑事实，不只是描述**。站点分支＝main 于 `ac82266`（2026-07-28，PR #488 合并点）＋1 提交（`67a9126`，frontmatter parser 同步）后冻结；main 自该点前进 74 提交至 `0dcafa2a`。任何「站点说 X 行」的数字都不能拿去核对仓库当前代码。
2. **「流式下停止标记不可靠」在材料内无法自证**。两个钉点的课程代码都没有流式调用（无 `stream=True`），这条核心论点只能引课程作者对闭源产品的分析【三】；官方文档不披露实现层，既无法核验也无法背书【官】。课程内最有力的证据恰是修订差本身：站点轨旧修订信停止标记，main 轨固定提交的判据已是「看内容块」且四章全文无一处停止标记判据【一】。
3. **文档与实现不一致，至少两处**。其一，仓库章节索引把「并发」列为工具章的关键概念，而 main 轨 s01–s04 全部代码是纯串行循环（无线程池、无 `asyncio.gather`）；其二，站点讲任务图时自陈环检测未实现，而 main 轨对应实现已有反向可达性环检测。另有两处教学版内口径不一（输入提交事件「注入上下文」的文档承诺与只打印一行的实现；压缩 README 未展示应急计数重置），各章已就地登记。
4. **课程实现没有项目级配置文件加载机制——但这是「课程没证明」，不是「产品没有」**。两个钉点的全部代码都没有 `CLAUDE.md` / `.claude/` 的读取，项目记忆完全由自研记忆目录承担；而产品侧官方文档载有完整的 CLAUDE.md 层级与加载口径【官】。凡涉及「Claude Code 怎么读项目约定」，课程材料给不出证据，产品证据在官方——两个口径必须分开写。
5. **全程没有横向对照实验**。「多 Agent 更好」「待办清单减少跑偏」「后台任务更省」这类主张，材料**一次 A/B 都没做过**；官方文档也只给成本警告（班组 token 显著增多）而无收益数据【官】。它证明的是机制自洽，不是效果更优。

此外有一条**仓内导航纪律**：课程信源实为三轨（旧 12 课轨遗产／main 17 章／站点 20 章），章号互不对应、多处同号不同物——三轨对照与撞号防御只看[系列信源地图 · §二](../../../apps/negentropy-influence/source-map/claude-code-explained.md)，本组不再展开。本仓此前的两处旧轨引用已消歧（见下节）。

## 8. 与本仓 negentropy 的关联

本仓早在这次精读之前就消费过这门课程。上一版总纲曾登记两处旧 12 课轨引用为待办，**均已办结**（commit `7a192f4f5`，2026-09-28）：

| 本仓位置 | 曾引 | 现状 |
|:---|:---|:---|
| [`docs/concepts/subsystems/025-the-memory-system.md`](../../concepts/subsystems/025-the-memory-system.md) §2.5 | 旧轨 `agents/s05_skill_loading.py` 等 | ✅ 已消歧：三处旧轨编号改为现行根级目录 |
| [`context_assembler.py`](../../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) 文件头参考文献 | 「learn-claude-code s06 — 三层压缩管线」 | ✅ 已消歧：现引根级 `s08` 四步管线，并注明旧轨三层为历史形态 |

机制对位（结论性，实现细节归本仓设计文档；判定经换钉与轨 C 复核，无一被推翻、两处获强化）：

| 课程机制 | 本仓对应 | 判定 |
|:---|:---|:---|
| 技能两层加载（目录常驻 + 正文按需） | [Skills 设计](../../concepts/design/skills.md) 的渐进披露「描述常驻 Layer 1 / 模板按需 Layer 2」 | ✅ 已对齐（同一范式；官方压缩后按预算重贴技能体的口径再印证） |
| 压缩的预算分配 | [`context_assembler.py`](../../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) 的记忆／历史／系统三档预算 | ✅ 已对齐（该文件头部参考文献即引本课程，轨号已消歧） |
| 三闸门权限 + 钩子作为共用扩展点 | [Claude Code 集成设计](../../concepts/subsystems/038-claude-code-integration.md) | ✅ 已对齐（以 BuiltinTool 接入，闸门由宿主 CLI 侧承担） |
| 任务图：落盘、带依赖、可认领 | [Routine 系统](../../concepts/subsystems/039-the-routine-system.md)（Orchestrator + Evaluator 闭环） | ✅ 已对齐 |
| 队友运行时、收件格与协议握手 | [Routine 多 Agent 归因](../../concepts/subsystems/040-routine-multi-agent-faculty.md)（一核五翼 Faculty 编排） | 🔶 值得落地（本仓无对等的消费式收件格，也无带类型校验与幂等的请求／响应协议；注意官方侧整套班组机制仍戴 experimental 标签） |
| **目标闸门把「达成／判定不可能／超上限」做成互斥的一等状态**（main 轨 `s17_goal_loop`） | 本仓 `engine/routine/decision.py` 的 `decide()`：成功判定以**标量分数阈值**为主，Judge 显式判 pass 需经 `accept_verdict_pass` 开关旁路才被接受 | 🔶 **值得落地**，且对位证据已从课程内部升为官方——见下 |

> 最后一行是这次精读对本仓最有价值的一条。课程的目标闸门把**终止原因**建模为互斥的一等状态（达成／判定不可能／连续阻断超限／出错／先等后台完成），而本仓把「成功」压在一个可比较的分数阈值上——当评分尺度与阈值不可达时，一个实际已经收敛的任务会落进「无进展」分支。本仓已用开关与分数容差带做了局部对冲；课程的做法提示了一个更上游的选项：**让判定先分类，再打分**。换钉复核还带来一处**官方强对位**【官】：Claude Code 产品 Stop 钩子的防死循环上限（`stop_hook_active` 字段＋连续八次续轮后覆盖下一次阻断）及其环境变量 `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`，与 s17 的常量 `DEFAULT_STOP_HOOK_BLOCK_CAP = 8` **同名同值**——goal loop 不是虚构练习，它是产品 Stop 钩子机制的教学镜像（详见[② · 附录](./172-claude-code-planning-coordination.md)）。

## 9. 动手实验室

配套原型 [`assets/cc_harness_lab.py`](./assets/cc_harness_lab.py)（纯标准库、无随机数、无墙钟依赖，同一命令永远同一份日志；换钉取数 2026-09-28 后全数复跑复现）：

```bash
cd docs/research/agent-harness/assets
uv run --no-project python cc_harness_lab.py --selftest     # 全绿自证
uv run --no-project python cc_harness_lab.py --break all    # D1..D6 破坏性实验
```

**完好基线**（实际运行输出，换钉后复跑一致）：

```text
== 完好基线 ==
  ran_deny_listed    = False
  ran_first_tool     = True
  ran_late_tool      = True
  persisted_files    = ['a1.txt', 'a2.txt', 'a3.txt', 'b1.txt', 'b2.txt', 'b3.txt']
  lost_forever       = 0
  pointer_lost       = 0
  pairs_intact       = True
  makespan           = 4.0
  notify_reuses_id   = False

SELFTEST PASSED ✔
```

**六次破坏性实验**（每次只拆一个机制，改完真跑，逐字记录）：

| # | 拆什么 | 实测退化 | 教训 | 详见 |
|:---|:---|:---|:---|:---|
| D1 | 循环判据退回「信停止标记」 | `ran_late_tool  True → False`——内容块里明明还有活，循环提前收工 | 判据要看手里有没有活，不看它说没说完 | [①](./171-claude-code-tooling-execution.md) |
| D2 | 压缩顺序调换（旧结果替换抢在落盘之前） | **无可观测差异** | 顺序不是唯一的保险，「没看过的不许动」独立兜住了同一条不变式 | [③](./173-claude-code-memory-management.md) |
| D3 | 关掉工具调用与其结果的配对保护 | `pairs_intact  True → False`——裁剪把配对拆散 | 裁剪可以丢内容，不能丢结构 | [原型](./assets/cc_harness_lab.py) |
| D4 | 权限闸门顺序倒置（人工审批先于硬拒绝表） | `ran_deny_listed  False → True`——硬拒绝表上的命令被放行执行 | 不可协商的拒绝必须排在可协商的同意前面 | [①](./171-claude-code-tooling-execution.md) |
| D5 | 无屏障管道改成有屏障并行 | `makespan  4.0 → 6.0`（+50%） | 屏障的代价是让快的等慢的，且逐段累积 | [④](./174-claude-code-concurrency.md) |
| D6 | 顺序与「没看过的不许动」**两道保险同时失效** | `lost_forever 0 → 1`（一份原文从未落盘）、`pointer_lost 0 → 1`（一份已落盘但指针被抹掉） | 两道保险各自都够用，一起拆才出事——这才是顺序纪律真正的分量 | [③](./173-claude-code-memory-management.md) |

**main 演进修复的 V1/V2 验证**（在 `0dcafa2a` 课程原文 `ContextCompactor` 上重放旧缺陷场景；实验期脚本 `.temp/learn-cc-lab/verify/verify_fixes.py`，2026-09-28 实际运行输出，场景与完整输出见[③ §8](./173-claude-code-memory-management.md)）：

```text
== V1 · 占位符幂等（270 字符长路径占位符二次压缩）==
  压后内容：[Earlier tool result saved at …/tool-results/x….txt]   → PASS 指针保留
== V2 · 原文永久丢失路径（最旧未落盘的 5000 字结果被压）==
  压后内容：[Earlier tool result saved at …/tool-results/t1.txt]
  磁盘文件 = ['f1.txt', 't1.txt']，原文在磁盘 = True            → PASS 先落盘再压缩
```

> **「两个意外发现」的三轨口径**（完整双口径叙事唯一落点＝[③ §5 与 §8](./173-claude-code-memory-management.md)）：① D2 单独调换顺序**没有**造成损失——「没看过的结果不许压成占位符」独立维持同一条不变式，纵深防御而非单点；② D6 暴露占位符的**不幂等**。两条在**站点轨（视频信源钉 `67a9126`）至今仍在**；**main 轨 `0dcafa2a` 已修**——第三道保险（压前兜底落盘）把「两道同拆才出事」的那一格也兜住了，占位符幂等让指针不再丢（V1/V2 实测 PASS）。

## 10. 验收问答

1. **为什么说「循环从未改变」不是一句漂亮话？** 因为每章新增的机制都挂在循环**外面**：门禁挂在上件之前，插线口挂在传送带边，收台挂在每次开工之前，叫号器挂在下一轮的入口。多 Agent 机制也不例外——它们只以**两种身份**入场：一条注入的消息（收件格、后台完成、定时到点），或工具池里的一个工具（生成队友、协议、隔间、外接服务）；循环体从头到尾没有为「多 Agent」写过一支分支。
2. **为什么判据要看内容块而不是停止标记？** 停止标记在流式输出下会失真【三，带归属】；而「内容块里有没有工具调用」是本地可直接观察的事实。这门课自己就是证据：站点轨旧修订信声明，main 轨固定提交看事实——同一门课两个修订判据相反【一】，官方文档不披露实现层、无法裁决【官】。D1 实测：信标记的版本会在标记失真的那一轮提前收工，把已经排好的活丢掉。
3. **压缩顺序为什么不能换？现在有几道保险？** 真正的正确性理由是**大结果必须先落盘，之后才允许旧结果变成占位符**——否则原文还没存下来就先被压成了一行。D2/D6 实测这条不变式由独立保险共同维持：站点轨两道（顺序＋最近窗口豁免），main 轨 `0dcafa2a` 三道（再加压前兜底落盘）——纵深防御，不是一根保险丝。
4. **子 agent 和队友的本质差别是什么？** 副台是一次性的：另起一份干净的历史，干完只带回一张回执，中间过程全部丢弃；队友是常驻的：有自己的收件格、能被唤醒、能自己去排工板上认领活。注意这条二分是教学口径——官方产品里它是渐变的：给副台起个名字就能被按名 resume 并保留完整对话史【官】。
5. **这门课程最不能外推的结论是哪一条？** 「教学实现 = 产品实现」。本组处处分轨：课程两轨（站点 `67a9126`／main `0dcafa2a`）互有先后、互有缺口；官方文档只给产品现状，不背书课程对源码的分析【三】；且全程没有任何横向对照实验——它证明的是机制自洽，不是效果更优。

## 参考

[1] shareAI-lab, "learn-claude-code — Bash is all you need: a nano claude code–like agent harness, built from 0 to 1," GitHub repository, main @ commit `0dcafa2a`, Aug. 27, 2026（取数与换钉复验 2026-09-28）. License MIT. [Online]. Available: https://github.com/shareAI-lab/learn-claude-code

[2] shareAI-lab, "Learn Claude Code（课程站点，20 章修订；内容与分支 `fix/s08-s20-sync-frontmatter-parser` @ `67a9126c`, Jul. 29, 2026 逐字一致；【三】断言的文面载体「深入 CC 源码」节在此轨）." [Online]. Available: https://learn.shareai.run/zh/s01/

[3] Anthropic, "Claude Code Docs," *code.claude.com/docs/en*（【官】级唯一来源，产品现状口径；访问 2026-09-28，旧域名 `docs.claude.com/en/docs/claude-code/*` 已整体 301 迁移至此）. [Online]. Available: https://code.claude.com/docs

[4] 本仓, "系列信源地图 · Claude Code Harness Engineering," `apps/negentropy-influence/source-map/claude-code-explained.md`（章→集归属、双钉选择与三轨撞号防御的唯一登记处）
