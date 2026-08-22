# 事实源：《Learn Claude Code》规划与协调五章

> **本集口播的单一事实源**。逐字稿中每一条断言都必须能回溯到本文件的某一节；
> 回溯不到的断言不得进入口播。
>
> **信源双轨与修订分叉**：章节→集归属、双钉选择（本集钉站点同源修订 `67a9126c`，
> 中文文件名 `README.md`）**只登记在系列级信源地图**，本文件不重述：
> 见 [../../../source-map/claude-code-explained.md](../../../source-map/claude-code-explained.md)。
>
> **证据三级**
> | 级 | 含义 | 口播允许的表述 |
> |---|---|---|
> | 【一】 | 轨 A 仓库文件实测（@ `67a9126c`，可复算） | 可直接断言 |
> | 【二】 | 轨 B 站点正文 | 可断言，属「课程的讲法」 |
> | 【三】 | 课程作者对 Claude Code 源码的分析（站点「深入 CC 源码」节独有） | **必须**带归属句（前 3 句内出现「课程作者拆过源码」类表述），画面压「课程作者的源码分析」角标 |
>
> **提取方式**：2026-08-22 双轨并行取证。轨 A：五章 `README.md` + `code.py` @ `67a9126c`
>（字节归档 `research/source-archive/67a9126c/`）；轨 B：五页站点 HTML 剥标签精读（SSG 预渲染，
> 正文与仓库分支逐字一致——逐页抽查验证）。指纹见 [sources.toml](./sources.toml)。
> **图片纪律**：站点 SVG 一律不下载不嵌入，只转文字规格（§七）。

---

## 实测总表（【一】· 2026-08-22 @ 67a9126c，`wc -l` / 非空非注释双口径）

| 章 | 总行 | 非空非注释 | 工具数 | agent_loop 签名 |
|---|---|---|---|---|
| s05 todo_write | 302 | 235 | 6 | `(messages)` |
| s06 subagent | 381 | 303 | 7 | `(messages)` |
| s07 skill_loading | 424 | 334 | 8 | `(messages)` |
| s10 system_prompt | 219 | 165 | **3**（独立精简教学线） | `(messages, context)` |
| s11 error_recovery | 365 | 287 | **3**（同上） | `(messages, context)` |

⚠️ **口播不用绝对行数**（禁用清单 §九）；s10/s11 是与 s05–s07 **并行**的第二条教学线
（工具数回落 3、循环签名多一个 `context` 参数）——「程序越长越大」的叙事不能跨线拼接，见 §六-2。

---

## 一、s05 TodoWrite —— 没有计划的 Agent，做着做着就偏了

### 定位与标语
- 【二】标语「没有计划的 agent 走哪算哪」；Harness 层定位「规划——让 Agent 在动手之前先想清楚」。

### 问题（原文，轨 A）
> 【一】「改了 3 个文件，跑了个测试，发现 2 个失败，开始修。修着修着，它忘了最初是『改成
> snake_case』，测试失败把注意力全吸走了。」
> 【一】「一个 10 步重构，做完 1-3 步就开始即兴发挥，因为 4-10 步已经被挤出注意力了。」

### 机制【一】
- `todo_write` 工具**本身不做任何实际工作**：不能读文件、不能跑命令，只是把带状态的清单写进
  进程内存并显示进度。三态：`pending` / `in_progress` / `completed`（图标分别是空格 / ▸ / ✓）。
- 加工具仍是两步：`TOOLS` 数组加一条 + `TOOL_HANDLERS` 字典加一行映射（循环保留 s01 起的分发骨架）。
- **催更提醒（nag reminder）**：连续 **3 轮**没调 `todo_write`，循环在下一次调用模型前注入一条
  `<reminder>Update your todos.</reminder>` 用户消息，计数清零。
- 【一】关键洞察（README 原话）：「todo_write 不给 Agent 增加任何**执行能力**。它增加的是**规划能力**。」

### 生产版对照【三】
- 两套任务系统并存（`tasks.ts:133-139`）：TodoWrite（V1，内存 AppState，`TodoWriteTool.ts:65-103`）
  与 Task System（V2 = s12，文件持久化 + 依赖图 + 并发锁）。切换由 `isTodoV2Enabled()` 控制：
  交互式会话 V2 默认启用、非交互式（SDK）V1 默认启用，`CLAUDE_CODE_ENABLE_TASKS` 可强制 V2。
  （注意：源码注释 "Force-enable tasks in non-interactive mode" 描述的是 env var 路径用途，
  与默认分支返回值语义不同——作者提醒阅读时需区分。）
- 真实源码无固定「3 轮」催更；更接近的是 3 个以上 todo 全完成而无 verification 项时追加 nudge
  （`TodoWriteTool.ts:72-107`）。教学版的 3 轮是教学机制。
- V2 相对 V1 的核心增量（归属第 5 集细讲，本集只提一句「另一套更重的任务系统」）：
  文件持久化、`blockedBy` 依赖图、`proper-lockfile` 并发锁、四工具（Create/Get/Update/List）、
  TaskCreated/TaskCompleted hooks。
- 教学版省略 `activeForm` 字段（UI spinner 用；终端输出不需要）。

---

## 二、s06 Subagent —— 大任务拆小，每个拿到的都是干净上下文

### 定位与标语
- 【二】标语「大任务拆小，每个小任务干净的上下文」；Harness 层「子 Agent——上下文隔离，注意力不漂移」。

### 问题（原文，轨 A）
> 【一】「读了 30 个文件追踪调用链，聊了 60 轮，messages 涨到 120 条，大部分是中间过程。」
> 【一】比喻（README 原话）：「你修 bug 时会开一个新终端追踪调用链；追踪完，终端关掉，结果写进笔记，
> 回到原来的终端继续修。」

### 机制【一】
- `task` 工具触发 `spawn_subagent`：给子 Agent **全新的 `messages[]`**（只有一句任务描述），
  跑自己的循环（30 轮安全上限），结束**只回传最后一条的文本结论**，中间过程全部丢弃；
  文件系统副作用（写/改文件）保留在工作目录。
- 四个关键设计（README 决策表逐条）：
  1. 上下文隔离 = 全新 messages[]；
  2. 只回传结论 = `extract_text(last_message)`，不是整个列表；
  3. 禁止递归 = 子 Agent 的工具表里**没有 task**；
  4. 安全策略不跳过 = 子 Agent 的工具调用照样过 PreToolUse 权限钩子。
- 子 Agent 有独立的 `SUB_SYSTEM` 提示，明确要求「直接完成任务，不要再委派」。

### 生产版对照【三】（本集最反直觉的一节）
- **不是一种模式，是三种**（`AgentTool.tsx` / `runAgent.ts` / `forkSubagent.ts` / `forkedAgent.ts`）：
  Normal（全新 messages）/ **Fork**（fork gate 开启且未指定 subagent_type）/ General-purpose。
- ★ **Fork 模式的动机是命中 Prompt Cache，不是隔离**（`forkSubagent.ts:60-71`、107-168）：
  不创建全新上下文，而是构造 cache-friendly 前缀（保留父 assistant message + 生成占位 tool results）。
  缓存命中的**五个组件必须字节级一致**（`forkedAgent.ts:57-68`）：system prompt、tools、model、
  messages 前缀、thinking config。API 端因此不需要重算。
- ★ **隔离是半拉的**（`createSubagentContext()`，`forkedAgent.ts:345-462`）：`readFileState`
  **从父克隆**（避免重复读相同文件）；abort 向下传播；但 UI/通知的隔离程度取决于执行路径。
  子 Agent 不是完全隔离的——文件读取状态是共享的。
- 递归防护的精确形态：`isInForkChild()` 查对话历史里的 `FORK_BOILERPLATE_TAG`；
  `Agent` 工具默认在所有 agent 的禁用集合里（`constants/tools.ts:36-46`，`USER_TYPE === 'ant'` 例外）；
  teammate 场景有特殊放行（`agentToolUtils.ts:100-110`）。不是简单的「禁止再派生」。
- Permission Bubbling：Fork Agent 的 `permissionMode: 'bubble'`——子 Agent 的权限弹窗
  冒泡到父终端，用户在主终端审批。
- 异步路径（`AgentTool.tsx:686-764`）：`run_in_background: true` 时异步启动返回
  `{status: 'async_launched'}`——**本集一句带过**（并发是另一集的事，口播不得提集数，说「后面另说」）。
- 教学版的简化是刻意的：三种模式→一种、缓存共享→省略、递归防护→简化、async→留给 s13。

---

## 三、s07 Skill Loading —— 用到的时候才加载

### 定位与标语
- 【二】标语「用到时再加载，别全塞 prompt 里」；Harness 层「知识——按需加载，不堆满上下文」。

### 问题（原文，轨 A）
> 【一】「React 规范 2000 行 + SQL 风格 1500 行 + API 文档 3000 行全塞进 system prompt——
> 6500 行。改 CSS 颜色时 99% 的内容与当前任务无关，白白消耗 token。」

### 机制【一】两级加载
| 层 | 位置 | 时机 | 代价 |
|---|---|---|---|
| 1. 目录 | system prompt | 启动时扫描 `skills/` 注入 | ~100 token/技能，每轮都带 |
| 2. 内容 | tool_result | Agent 调 `load_skill` 时 | ~2000 token/技能，按需 |

- 目录注册表 `SKILL_REGISTRY` 启动时一次填充（解析 SKILL.md 的 YAML frontmatter：
  `name` / `description`）；`load_skill` 按注册表查找，**不走文件路径——没有路径遍历风险**。
- 关键区别（README 原话）：技能内容不是 system prompt 的一部分，它作为**一次工具结果**进入
  当前 messages，随历史携带直到压缩/截断/结束——「与 s08 的 compact 自然衔接」。

### 生产版对照【三】
- 目录预算：`getSkillListingAttachments()` 把技能列表格式化为附件，**预算为上下文窗口的 ~1%，
  上限 8000 字符**。
- `Skill` 工具返回的 tool_result 展示文本只是 `"Launching skill: {name}"`，**真正内容通过
  newMessages 注入对话**——教学版合并成「通过 tool_result 注入」是简化。
- 技能来源不止一个 `skills/` 目录：user（`~/.claude/skills/`）/ project（`.claude/`）/ `--add-dir` /
  legacy commands / bundled / plugin / MCP / conditional（带 `paths` frontmatter 按文件路径激活）。
- frontmatter 常见字段：`name`/`description`/`when_to_use`/`allowed-tools`/`context`（inline|fork）/
  `model`/`hooks`/`paths`/`user-invocable`（完整列表随版本迭代变化，课程作者只列核心）。

---

## 四、s10 System Prompt —— 运行时组装，不硬编码

### 定位与标语
- 【二】标语「prompt 是组装出来的，不是写死的」；Harness 层「提示——运行时组装，不硬编码」。

### 问题（原文，轨 A）
> 【一】「从第一章到上一章，system prompt 都是一行硬编码。能力越多，该提的越多——
> 换项目要重写整个 prompt；改一处可能影响全局；每次请求都带全部内容。」

### 机制【一】四段拼装
- `PROMPT_SECTIONS` 分段字典（identity / tools / workspace / memory），`assemble_system_prompt(context)`
  按真实状态拼接：identity+tools+workspace 始终加载；memory 仅当 `.memory/MEMORY.md` 存在且非空。
- ★ 判断依据是**真实状态，不是关键词**：`enabled_tools` 取自实际注册的分发表，memories 检查文件
  是否存在——不在消息里搜关键词。
- `get_system_prompt` 用 `json.dumps(context, sort_keys=True)` 做 cache key（README 解释为什么不用
  `hash()`：进程随机化 + list/dict 不可哈希）。**这个缓存只是避免重复拼字符串**，与 API 层
  prompt cache 是两回事（README 明确区分）。
- 每轮循环开头取一次 system prompt；context 变了重新组装，没变返回缓存。

### 生产版对照【三】（信息密度高，择深讲）
- CC 的 section 数量不固定（受 feature flag / output style / 模式 / 用户类型 / token 预算影响），
  大致两类：静态（identity / doing_tasks / using_tools / tone_style / output_efficiency 等）
  与动态（session_guidance / memory / env_info / language / mcp_instructions / token_budget 等）。
- ★ **唯一不许进缓存的段落是外接工具段**（`mcp_instructions`，经
  `DANGEROUS_uncachedSystemPromptSection()` 创建）——因为 MCP server 可以在轮次间连接和断开。
- 三层缓存：lodash memoize（会话内）→ section 注册缓存（`/clear`、`/compact` 时清除）→
  API 级缓存（`SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 分隔静态/动态，静态部分命中 global cache）。
- 体量对照：标准交互模式 system prompt 核心约 **20–30KB**；`CLAUDE_CODE_SIMPLE` 模式整个
  prompt 只有 **2 行**（约 150 字符）。
- getUserContext（CLAUDE.md、currentDate）以 `<system-reminder>` 用户消息**前置**注入，
  不进 system prompt 数组。

---

## 五、s11 Error Recovery —— 错误不是结束，是重试的开始

### 定位与标语
- 【二】标语「错误不是终点，是重试的起点」；Harness 层「韧性——主循环遇到错误时分类并恢复」。

### 问题（原文，轨 A）
> 【一】「`Error: 529 overloaded`——Agent 崩了。没有重试、没有换模型、没有减上下文，直接崩溃。
> 一个不处理错误的 Agent 就像一碰就熄火的车。」

### 机制【一】三条恢复路径（教学版）
1. **输出截断**（`max_tokens`）：第一次直接把上限 8K→64K（8 倍）**重试同一请求**（不追加截断输出）；
   64K 仍截断才保存输出并注入续写提示「从刚才的话直接接着说」，**最多 3 次**；超过就退出。
2. **上下文超限**（`prompt_too_long`）：触发 reactive compact（比 auto 更激进；教学版只留最后
   5 条模拟）后重试；**压缩过一次仍超限就退出**——再压缩也不会变小。
3. **临时故障**（429/529）：指数退避 + 抖动：`min(500×2^attempt, 32000)ms + 随机 0~25%`——
   0.5s、1s、2s、4s……**封顶 32s**，最多重试 10 次；服务器给了 `Retry-After` 头则优先用它。
   连续 **3 次 529** → 切换备用模型（若配置了 `FALLBACK_MODEL_ID`）。

### 生产版对照【三】
- **不止 3 条**：CC 有 17 种 reason/transition（completed / next_turn / max_output_tokens_escalate /
  max_output_tokens_recovery / reactive_compact_retry / prompt_too_long / collapse_drain_retry /
  model_error / image_error / aborted_streaming / aborted_tools / stop_hook_blocking /
  stop_hook_prevented / hook_stopped / token_budget_continuation / blocking_limit / max_turns）——
  教学版只展开最常见的 5 种。（「17 个」这个数以本表实测计数为准，口播只说「十几种」。）
- ★ **续写提示原文**（`query.ts:1225-1227`）："Output token limit hit. Resume directly — no apology,
  no recap of what you were doing. Pick up mid-thought if that is where the cut happened. Break
  remaining work into smaller pieces."——「别道歉、别复述」是写给模型的工程品味。
- 流式中可恢复错误（413 / max_tokens / media error）**被暂扣不展示**（`query.ts:788-822`）——
  SDK 消费者看不见，只有恢复逻辑看得见；流结束后才判定。
- 529 切换时清除所有 pending 消息和 tool 结果，向用户展示 "Switched to {model} due to high demand"。
- **收益递减检测**（`tokenBudget.ts:60-62`）：连续 3 次 continuation 且 token 增量 < 500 →
  判定「继续也无实质产出」，停。nudge 原文（`tokenBudget.ts:72`）："Stopped at {pct}% of token
  target. Keep working — do not summarize."

---

## 六、跨章主线与分歧清单

### 主线：「谁在安排它的视野」
五章合成一个答案：写下来的计划（s05）· 另开的副桌（s06）· 按需翻开的目录（s07）·
每轮重拼的垫纸（s10）· 出错时的补救梯子（s11）——都不是模型自己的能力，是外挂在循环外的
**视野管理**。循环本身从 s01 到 s11 只有加法（催更计数 / 子循环 / 目录扫描 / context 参数 /
try-except 包裹），`while True` 骨架一次没换【一，实测】。

### 分歧清单（本集章节范围内；修订级分叉见 source-map，不在此重复）

| # | 分歧 | 轨 A @ 67a9126c | 轨 B 站点 | 处置 |
|---|---|---|---|---|
| 1 | 站点 LOC 指标 | 实测 302/381/424/219/365 | 页头指标数字（如 s05 标 148） | 一律不进口播；两轨都只是「越来越厚」的趋势，画面用我方实测值+口径+日期 |
| 2 | 教学线分叉 | s10/s11 是独立精简线（3 工具、`(messages, context)` 签名），与 s05–s07（6/7/8 工具）并行 | 站点按 s01→s20 顺序叙述 | 口播不拼「连续增长」叙事；s10/s11 的循环变化单独讲（加 context、加 try-except） |
| 3 | s06 判据 | 教学版子循环用 `stop_reason != "tool_use"` 判停 | 同 | 教学版自己保留旧判据（与 s01 主线判据不同）——口播不展开子循环判据细节 |
| 4 | s05 催更 3 轮 | 教学机制（README 自注 CC 无固定轮数） | 同 | 口播必须说「教学版的设计」或加归属句 |
| 5 | s11 reason 数 | 表列 17 种（实测计数） | 正文说「13+」 | 用「十几种」模糊表述，画面角标 17（我方计数 @ 67a9126c） |

---

## 七、站点可视化文字规格（供 Remotion 概念重建）

**纪律**：只重建概念与信息结构，不复刻站点美术；配色构图动效一律用本集视觉契约
（[../video/src/design/theme.ts](../video/src/design/theme.ts)）。

1. **Todo Board（s05）**：三态卡列表（pending 空格 / in_progress ▸ / completed ✓）；连续三轮
   未更新时一枚「提醒」印章落下（`<reminder>Update your todos.</reminder>`）。
2. **Subagent Split（s06）**：主对话流中部滑出一张「副桌」（独立消息列表），干完只回传一张
   回执卡；主桌与副桌间画「干净上下文」分界。深挖帧：两条对话流逐字节对齐比对（五要素等号锁）。
3. **Skill Catalog（s07）**：左列目录卡（每张 ~100 token 标价），右列完整手册（~2000 token 标价）；
   拉开手册时计价器跳字。
4. **Prompt Assembly（s10）**：四段卡片（identity/tools/workspace/memory）拼装成一条 system
   prompt；memory 段凭「文件存在」开关亮起；拼好后盖缓存印章（`json key` 一致 → 直接返回）。
5. **Recovery Ladder（s11）**：三级台阶（截断→上限升级→续写；超限→压缩→重试；429→退避→换模型）；
   等待条 0.5s→1s→2s→…→32s 封顶生长，带抖动毛边；连续三个 529 后模型卡翻面换人。

---

## 八、科普叙事素材库（金句 / 比喻 / 例子）

- 【一·s05】「todo_write 不增加执行能力，增加的是规划能力。」（README 原话直译）——本集落点句之一。
- 【一·s06】「开一个新终端追踪调用链，追踪完关掉，结果写进笔记，回到原终端」——副桌比喻的原文出处。
- 【一·s07】「6500 行 system prompt，改 CSS 时 99% 与你无关」——视野经济账的痛点。
- 【三·s06】★「分叉不是为了隔离，是为了命中缓存——五个东西一字不差才算命中」——本集最反直觉。
- 【三·s06】「隔离是半拉的：读过的文件，子辈会继承」——诚实感素材。
- 【三·s10】「唯一不许进缓存的一段，是外接工具段——它们随时会掉线。」——反直觉素材。
- 【三·s10】「简单模式整个提示只有两行；常规模式 20–30KB」——体量对比素材（数字进角标）。
- 【三·s11】「别道歉、别复述，从断掉的半句话接着说」——写给模型的工程品味（续写提示原文意译）。
- 【一·s11】「一个不处理错误的 Agent，就像一碰就熄火的车」——README 原话。
- 【三·s11】「压完还往回捞」同族：收益递减检测——「继续 3 次增量不足 500 字，就承认没产出」。

---

## 九、口播禁用清单（本集）

1. **不说**任何绝对行数 / 章节总数 / token 绝对预算数（目录 1%/8000 字上限进角标）。
2. **不说**「第 N 集」「上一集」等顺序词；不提任何他集标题（含《拆开 Claude Code》全名与
   自进化系列三部曲名）。「下一章讲什么」可以（章≠集）。
3. 英文标识符不进口播（`todo_write`/`task`/`load_skill`/`SKILL.md`/`prompt cache`/`max_tokens`
   等——一律中文白话 + 画面角标）；唯一例外 **Claude Code**。
4. 【三】断言前 3 句内必须出现归属句；「3 轮催更」「字节级一致五要素」「17 种原因」等
   具体数字若源自源码分析，数字进角标并带「课程作者的源码分析」标注。
5. 排版陷阱（check_script 强制）：`2026 年` 这类「数字+空格+年」禁写；「行」多音字场景写法
   待 TTS 试听后按 PRON-GLOSSARY 协议处理（确认读错才标注）。
6. s12 任务系统细节（九字段/双锁/高水位）**不在本集**——归第 5 集（归属切分见 source-map）；
   本集对「另一套更重的任务系统」最多一句 + 角标。
