---
sidebar_position: 1
title: "Learn Claude Code 五层 Harness 精读总览"
description: "课程双轨一手材料（仓库 main 17 章 @ ce8f9f18 / 站点 20 章修订 @ 67a9126c，均 MIT）加 Anthropic 官方文档为信源的跨层综观：执行 → 规划 → 记忆 → 时机 → 协作五层的依赖链与层间缺口、四级证据分级、三轨撞号拓扑与 main 轨视频未取材两章的落位、跨章批判边界，以及五篇《精读与通俗拆解》（guided-learn 产物，2026-10-07 全新首读）的导航与本仓机制对位"
---

# Learn Claude Code 五层 Harness 精读总览

> [!NOTE] **核心精读范围**
>
> - 课程仓库 main 轨（17 章整合版）：[shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) @ [`ce8f9f18`](https://github.com/shareAI-lab/learn-claude-code/tree/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3)（2026-09-28），License **MIT**——① 层机制钉点与 main 轨独有两章
> - 课程站点（20 章修订）：[Learn Claude Code](https://learn.shareai.run/zh/s01/)，内容与分支 @ `67a9126c`（2026-07-29）逐节对账一致（2026-10-07 复核 20/20）——②–⑤ 层机制钉点；逐集钉选理由见[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)
> - Anthropic 官方文档（产品现状口径）：[code.claude.com/docs](https://code.claude.com/docs)，各篇按缺口补读、实抓快照（2026-10-07）
> - **本组的五个分篇（171–175）为 guided-learn《精读与通俗拆解》产物**（2026-10-07 全新首读，防污染重写：不承接旧版精读的任何叙述，一切结论从钉点材料重新推导）；每篇配套纯标准库原型 `assets/lcc_<part>_lab.py`（`--selftest` 自证 + 破坏性实验实测退化）。旧版总类比叙事（角色台账剧场）随本轮换代废止，各篇类比就地局部准入、随文声明失配边界，不设总类比剧场

**一句话定位**：这门课程用 Python 从一百余行的最小循环逐章长成千行级的整合 harness，每章只加一个机制——而它真正证明的事情只有一件：**从头到尾，循环没有变过**。让模型能在你机器上动手的，不是更聪明的模型，是循环外面一层层挂上去的 harness。

**怎么读这组笔记**：五篇各自独立成篇（每篇是一次完整的 guided-learn 精读：SCQA 导读 → 问题与设计规格 → 全貌分层 → 机制三拍「痛点直讲 → 机制解构与单步走查 → 原型实景」→ 实证数字 → 动手实验室 → 规律与争议 → 边界 → 自测）。实景全部取自**固定提交上的课程原文实测或配套原型的实际运行输出**——它把材料里由模型承担的角色换成确定性脚本，因此回答的是「机制是否自洽」，不回答「模型是否聪明」。每篇机制主体分钉站点轨或 main 轨，两轨差异随节并陈，产品现状对照官方文档——**三套口径先分轨、再下笔**。

---

## 1. 为什么是这五层：一条不能跳步的依赖链

五层不是并列的功能清单，是一条**每一层都在偿还上一层欠下的债**的链子：

![五层依赖图：五个分层（执行/规划/记忆/时机/协作）自上而下，每层两件机制装置（Agent Loop 主循环与权限闸门/清单与子代理/上下文压缩与持久记忆文件/后台任务与 cron/文件系统协作设施），层间箭头写明上层暴露、下层接住的问题（上下文变长目标被稀释、可见文本有上限、调用有快慢与到点无人触发、单 Agent 并行度有限），收束于「机制很多，循环一个」](../../assets/architecture/agent-harness/claude-code-harness--five-layer-dependency-dark.png)

> 图源（可 diff 文本）：[`claude-code-harness--five-layer-dependency.mmd`](../../assets/mermaid/agent-harness/claude-code-harness--five-layer-dependency.mmd) · 交互版（下载到本地打开）：[`claude-code-harness--five-layer-dependency.html`](../../assets/architecture/agent-harness/claude-code-harness--five-layer-dependency.html)

读法：**每一层的存在理由，都写在上一层的失败里**。跳过任何一层去看下一层，都会觉得后者是过度设计。

## 2. 五篇导航

| 篇 | 机制钉点 | 覆盖 | 一句话本质 |
|:---|:---|:---|:---|
| [① 工具与执行](./171-claude-code-tooling-execution.md) | main `ce8f9f18`（站点差异内联） | 循环 · 工具 · 权限 · 钩子 | 它敢在你机器上动手，靠的不是更聪明，是主循环外面挂着的三层可拆卸装置 |
| [② 规划与协调](./172-claude-code-planning-coordination.md) | 站点 `67a9126c`（附录 main） | 待办 · 子 agent · 技能 · 系统提示 · 错误恢复 | 它每一轮都把全部输入从头重读一遍——所以「看见什么」从来不是它自己说了算 |
| [③ 记忆管理](./173-claude-code-memory-management.md) | 站点 `67a9126c`（main 演进并陈） | 上下文压缩 · 持久记忆 | 记忆不是一个功能，是两套咬合的机制：一套承认会丢，一套保证不丢 |
| [④ 并发与时机](./174-claude-code-concurrency.md) | 站点 `67a9126c`（附录 main） | 后台任务 · 定时调度 | 所谓后台没有平行宇宙，只是「不等它」；而有些活连按开始的人都不要 |
| [⑤ 多 Agent 平台](./175-claude-code-multi-agent-platform.md) | 站点 `67a9126c`（main 对照并陈） | 任务图 · 团队 · 协议 · 自治 · 隔离 · MCP | 把「多 Agent」拆开，全是朴素物件；而循环还是那一个 |

每篇各配一张全貌全景图（`lcc-<part>--panorama` 四件套：`.mmd` 图源 / 交互 HTML / dark·light PNG，位于 [docs/assets/mermaid/agent-harness/](../../assets/mermaid/agent-harness/) 与 [docs/assets/architecture/agent-harness/](../../assets/architecture/agent-harness/)）。哪一篇钉哪个提交的全系列登记处是[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)。

## 3. 证据分级（全组纪律）

这门课程的信息密度最高之处，恰恰也是最容易说错之处：它对 Claude Code **闭源**源码的分析，以及两轨修订之间的口径漂移，都须逐条锚定来源等级：

| 级 | 含义 | 本组的义务 |
|:---|:---|:---|
| 【一】 | 课程仓库/站点固定提交实测，或本组原型 `--selftest` 可复算 | 可直接断言 |
| 【二】 | 课程站点正文（与钉点代码同源的讲法） | 可断言，但属「课程的讲法」 |
| 【三】 | 课程作者对闭源 Claude Code 源码的分析（文面载体＝站点轨「深入 CC 源码」节，main 轨已无此节） | **必须带归属句**，且**一律不转引具体文件行号**，只转引结构性结论 |
| 【官】 | Anthropic 官方文档（code.claude.com，产品现状口径） | 产品现状与默认态以官方为准；与课程口径冲突时双方并记，课程断言带时间状语 |

> [!IMPORTANT] **本组不是口播取证源**
>
> 科普视频各集的逐章取证、原文引语与生产版对照（含轨 C 官方事实集全量），归各集 `research/`（C 型信源冻结快照 `gl-notes.md`）；章→集归属、钉选与三轨撞号防御，只登记在[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)。
> **除「main 轨独有两章」与各篇原型实测外，本组任何断言若与各集取证冲突，一律以集侧为准。**

## 4. 本组不得重述的事实（SSOT 边界）

为避免第二事实源漂移，以下事实**只给链接，不在本组复述**：

1. 章→集归属 · 2. 固定提交的选择与理由 · 3. 站点 20 章 ↔ main 17 章逐行对照表 · 4. 三轨编号对照与全部撞号点 · 5. 取证台账的条目命名与审计判据 —— 全部指向[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)（其 §二「撞号防御」是全仓唯一展开层）
6. 各集标题／集序／配色／时长／交付状态 —— 指向 `series.json` / `series.md`
7. 逐字口播文本与各集口播禁用清单 · 8. 站点／仓库原文的逐字引语 · 9. 站点插图的文字规格转写 · 10. 闭源源码的文件名与行号 —— 全部指向各集 `research/`（main 独有两章的附录为唯一豁免，见 §5）；GL 伴生信源台账（sources.md 五节）在 `.temp/` 沙箱，不随仓

**可写与不可写的判据**：**机制不变式与顺序约束可写**（如「大结果必须先落盘，之后才允许旧结果变成占位符」），它跨修订稳定，是精读的本体；**随修订漂移的可调常数不写**（保留条数、字节阈值、预算上限、小时数、个数上限），一律以「参数见对应篇实证数字表」代之。

## 5. main 轨独有的两章：视频未取材的净增量

课程仓库 main 有两章不在站点 20 章修订内，[系列信源地图](../../../apps/negentropy-influence/source-map/claude-code-explained.md)已登记其不被任何一集取材——即科普视频五个作品均未以它们为信源。它们没有任何一集持有，**因此本组是它们的唯一事实源**（唯一豁免：参数与官方对位在本节末与 §7 写全）：

| 目录（main 轨全称） | 文件 | 落位（机制概述见各篇附录；常量与官方对位的唯一落点＝本文 §7） |
|:---|:---|:---|
| `s16_workflow_runtime` | `code.py` / `README.zh.md` | [④ 并发与时机 · 附录](./174-claude-code-concurrency.md)——全仓唯一的事件循环扇出并发：有屏障／无屏障两原语、journal 断点续跑 |
| `s17_goal_loop` | `code.py` / `README.zh.md` | [② 规划与协调 · 附录](./172-claude-code-planning-coordination.md)——给循环装目标闸门：终止原因建模为互斥的一等状态 |

> 取证：`raw.githubusercontent.com/shareAI-lab/learn-claude-code/ce8f9f186058939da54c9d6fead78dfb5d0fd6c3/<目录>/<文件>`，License MIT。换钉复核【一】：自旧钉 `0dcafa2a` 前进 2 提交（Windows s11/s15 进程清理修复 + 课程 prompt 增加 OS-aware shell 上下文），两章 `README.zh.md` 与 `code.py` 均未触及——机制内容不受影响。
>
> ⚠️ **撞号警告**：这两章的编号与站点 20 章修订里的 s16／s17 **不是同一章**——main 与站点的 s13–s17 全部错位，s10–s12 更与旧 12 课轨构成三轨三物高危区。三轨编号对照与全部撞号点的唯一展开层是[系列信源地图 · §二 撞号防御](../../../apps/negentropy-influence/source-map/claude-code-explained.md)；本组提及它们时一律书写「main 轨 + 完整目录名」全称，禁止裸用编号。

## 6. 全局批判性边界（材料没有证明的事）

以下五条跨篇成立，各篇不再重述，只链接本节（2026-10-07 换钉至 `ce8f9f18`/`67a9126c` 后逐条复验成立）：

1. **站点与仓库不是同一时刻的产物——这是可验算的拓扑事实，不只是描述**。站点分支＝main 于 `ac82266`（2026-07-28，PR #488 合并点）＋1 提交（`67a9126`，frontmatter parser 同步）后冻结；main 自该点继续前进（至 `ce8f9f18`）。任何「站点说 X 行」的数字都不能拿去核对仓库当前代码。
2. **「流式下停止标记不可靠」在材料内无法自证**。两个钉点的课程代码都没有流式调用（无 `stream=True`），这条核心论点只能引课程作者对闭源产品的分析【三】；官方文档不披露实现层，既无法核验也无法背书【官】。课程内最有力的证据恰是修订差本身：站点轨旧修订信停止标记，main 轨固定提交的判据已是「看内容块」且四章全文无一处停止标记判据【一】。
3. **文档与实现不一致，至少两处**。其一，仓库章节索引把「并发」列为工具章的关键概念，而 main 轨 s01–s04 全部代码是纯串行循环（无线程池、无 `asyncio.gather`）；其二，站点讲任务图时自陈环检测未实现，而 main 轨对应实现已有反向可达性环检测。各篇已就地登记教学版内口径不一。
4. **课程实现没有项目级配置文件加载机制——但这是「课程没证明」，不是「产品没有」**。两个钉点的全部代码都没有 `CLAUDE.md` / `.claude/` 的读取，项目记忆完全由自研记忆目录承担；而产品侧官方文档载有完整的 CLAUDE.md 层级与加载口径【官】。凡涉及「Claude Code 怎么读项目约定」，课程材料给不出证据，产品证据在官方——两个口径必须分开写。
5. **全程没有横向对照实验**。「多 Agent 更好」「待办清单减少跑偏」「后台任务更省」这类主张，材料**一次 A/B 都没做过**；官方文档也只给成本警告（班组 token 显著增多）而无收益数据【官】。它证明的是机制自洽，不是效果更优。

此外有一条**仓内导航纪律**：课程信源实为三轨（旧 12 课轨遗产／main 17 章／站点 20 章），章号互不对应、多处同号不同物——三轨对照与撞号防御只看[系列信源地图 · §二](../../../apps/negentropy-influence/source-map/claude-code-explained.md)，本组不再展开。本仓此前的两处旧轨引用已消歧（见下节）。另注意本地克隆的默认远端停在课程 2026-04 的旧谱系（`36897b1`「realign teaching path」至 `5dfe67f`，12 课 `agents/`+web 文档形态），与上游 main 的 17 章制是先后两代结构——引用一律走钉点，勿信本地 clone 的默认分支。

## 7. 与本仓 negentropy 的关联

本仓早在精读之前就消费过这门课程。两处旧 12 课轨引用已办结消歧（commit `7a192f4f5`，2026-09-28）：

| 本仓位置 | 曾引 | 现状 |
|:---|:---|:---|
| [`docs/concepts/subsystems/025-the-memory-system.md`](../../concepts/subsystems/025-the-memory-system.md) §2.5 | 旧轨 `agents/s05_skill_loading.py` 等 | ✅ 已消歧：三处旧轨编号改为现行根级目录 |
| [`context_assembler.py`](../../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) 文件头参考文献 | 「learn-claude-code s06 — 三层压缩管线」 | ✅ 已消歧：现引根级 `s08` 四步管线，并注明旧轨三层为历史形态 |

机制对位（结论性，实现细节归本仓设计文档；2026-10-07 换钉复验判定不变）：

| 课程机制 | 本仓对应 | 判定 |
|:---|:---|:---|
| 技能两层加载（目录常驻 + 正文按需） | [Skills 设计](../../concepts/design/skills.md) 的渐进披露「描述常驻 Layer 1 / 模板按需 Layer 2」 | ✅ 已对齐（同一范式；官方压缩后按预算重贴技能体的口径再印证） |
| 压缩的预算分配 | [`context_assembler.py`](../../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) 的记忆／历史／系统三档预算 | ✅ 已对齐（该文件头部参考文献即引本课程，轨号已消歧） |
| 三闸门权限 + 钩子作为共用扩展点 | [Claude Code 集成设计](../../concepts/subsystems/038-claude-code-integration.md) | ✅ 已对齐（以 BuiltinTool 接入，闸门由宿主 CLI 侧承担） |
| 任务图：落盘、带依赖、可认领 | [Routine 系统](../../concepts/subsystems/039-the-routine-system.md)（Orchestrator + Evaluator 闭环） | ✅ 已对齐 |
| 队友运行时、收件箱与协议握手 | [Routine 多 Agent 归因](../../concepts/subsystems/040-routine-multi-agent-faculty.md)（一核五翼 Faculty 编排） | 🔶 值得落地（本仓无对等的消费式收件箱，也无带类型校验与幂等的请求／响应协议；注意官方侧整套班组机制仍戴 experimental 标签） |
| **目标闸门把「达成／判定不可能／超上限」做成互斥的一等状态**（main 轨 `s17_goal_loop`） | 本仓 `engine/routine/decision.py` 的 `decide()`：成功判定以**标量分数阈值**为主，Judge 显式判 pass 需经 `accept_verdict_pass` 开关旁路才被接受 | 🔶 **值得落地**，且对位证据已从课程内部升为官方——见下 |

> 最后一行是这组精读对本仓最有价值的一条。课程的目标闸门把**终止原因**建模为互斥的一等状态（达成／判定不可能／连续阻断超限／出错／先等后台完成），而本仓把「成功」压在一个可比较的分数阈值上——当评分尺度与阈值不可达时，一个实际已经收敛的任务会落进「无进展」分支。本仓已用开关与分数容差带做了局部对冲；课程的做法提示了一个更上游的选项：**让判定先分类，再打分**。换钉复核带来一处**官方强对位**【官】：Claude Code 产品 Stop 钩子的防死循环上限（`stop_hook_active` 字段＋连续八次续轮后覆盖下一次阻断）及其环境变量 `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`，与 s17 的常量 `DEFAULT_STOP_HOOK_BLOCK_CAP = 8` **同名同值**——goal loop 不是虚构练习，它是产品 Stop 钩子机制的教学镜像。

## 8. 动手实验室

五篇各配一个纯标准库原型（无随机数、无墙钟依赖，同一命令永远同一份日志；2026-10-07 交付位置复跑全绿）：

```bash
cd docs/research/agent-harness/assets
uv run --no-project python lcc_tooling_lab.py      --selftest   # ① 循环/工具/权限/钩子 + 五路破坏实验
uv run --no-project python lcc_planning_lab.py     --selftest   # ② 五机制 episode + 五路破坏实验
uv run --no-project python lcc_memory_lab.py       --selftest   # ③ 压缩/记忆 + 五路破坏实验
uv run --no-project python lcc_concurrency_lab.py  --selftest   # ④ 后台/调度 + 五路破坏实验
uv run --no-project python lcc_multiagent_lab.py   --selftest   # ⑤ 任务/团队/协议 + 五路破坏实验
```

各篇「动手实验室」节含机制→代码行号速查与破坏性实验实测退化表（每次只拆一个机制，改完真跑，逐字记录）。旧版共用原型 `cc_harness_lab.py`（及其 D1–D6 实验）已随本轮换代移除——其结论中被新版独立复现者已并入各篇，未复现者视为旧叙事载体一并废止。

## 9. 换代说明

本组 171–175 于 2026-10-07 由 guided-learn 全新首读重写（防污染模式：写作全程禁读旧版正文、旧原型与各集旧取证，结论从钉点材料重新推导；检验代理全新派发、输入隔离，四测出闸记录见各篇 GL 伴生沙箱）。本总纲保留索引与登记职能（依赖链、证据分级、SSOT 边界、撞号防御指路、本仓对位），叙述性内容以五篇为准。

## 参考

[1] shareAI-lab, "learn-claude-code — Bash is all you need: a nano claude code–like agent harness, built from 0 to 1," GitHub repository, main @ commit `ce8f9f18`, Sep. 28, 2026（取数与对账 2026-10-07；自旧钉 `0dcafa2a` 增量 2 提交，无机制级变更）. License MIT. [Online]. Available: https://github.com/shareAI-lab/learn-claude-code

[2] shareAI-lab, "Learn Claude Code（课程站点，20 章修订；内容与分支 `fix/s08-s20-sync-frontmatter-parser` @ `67a9126c`, Jul. 29, 2026 逐节对账一致；2026-10-07 复核 20/20 章标题全对；【三】断言的文面载体「深入 CC 源码」节在此轨）." [Online]. Available: https://learn.shareai.run/zh/s01/

[3] Anthropic, "Claude Code Docs," *code.claude.com/docs/en*（【官】级唯一来源，产品现状口径；各篇按缺口补读、实抓快照 2026-10-07）. [Online]. Available: https://code.claude.com/docs

[4] 本仓, "系列信源地图 · Claude Code Harness Engineering," `apps/negentropy-influence/source-map/claude-code-explained.md`（章→集归属、双钉选择与三轨撞号防御的唯一登记处）
