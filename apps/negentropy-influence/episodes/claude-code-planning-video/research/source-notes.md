# 事实源：《Learn Claude Code》规划与协调 5 章

> **本集口播的单一事实源**。逐字稿中每一条断言都必须能回溯到本文件的某一节。
>
> **信源双轨与修订分叉**：章节归属与双钉（本集钉 `67a9126`，站点同源修订（20 章版））只登记在系列级信源地图，本文件不重述：见 [../../../source-map/claude-code-explained.md](../../../source-map/claude-code-explained.md)。
>
> **证据分级**：【一】仓库实测（@ 67a9126，可复算）／【二】站点正文／【三】课程作者对 Claude Code 源码的分析（口播必带归属句 + 画面角标）／【官】Anthropic 官方文档（产品现状口径，域名已迁 code.claude.com）。
>
> **提取方式**：2026-09-28 五维度重调研（钉点逐章 curl 取原文）；字节归档 `research/source-archive/67a9126/`；指纹见 [sources.toml](./sources.toml)。图片纪律：站点 SVG 不下载不嵌入，只转文字规格。

---

## 实测总表（【一】· 2026-09-28 @ 67a9126）

| 章（站点轨） | 总行 | 非空非注释 | 工具数 |
|---|---:|---:|---:|
| s05 TodoWrite | 302 | 235 | 6 |
| s06 Subagent | 381 | 303 | 7（父 Agent 去重口径；code.py 全文 `"name":` 12 条 = 父 6 + 子代理 5 + task 追加 1） |
| s07 Skill Loading | 424 | 334 | 8 |
| s10 System Prompt | 219 | 165 | 3 |
| s11 Error Recovery | 365 | 287 | 3 |

口径：总行 = `wc -l code.py`；非空非注释 = `grep -cvE '^\s*(#|$)'`（docstring 行计入，保守口径）；工具数 = 主 Agent `TOOLS` 定义条目。s10/s11 是**重置型小章**——工具面回退到 3（bash/read_file/write_file），课程聚焦单机制、不累积前章工具，非能力删减。数字纪律：口播不引绝对行数与活数据；本表仅供取证复算。

**撞号纪律（必读）**：本章号均指站点 20 章版。与旧 12 课轨撞号：旧 s03 TodoWrite / s04 Subagent / s05 Skill / s06 Compact / s07 Task System 与本集 s05–s07 错位；**s10/s11 是三轨三物**（旧 s10 Team Protocols、main s10 Task System vs 站点 s10 System Prompt；旧 s11 Autonomous、main s11 Background Tasks vs 站点 s11 Error Recovery）。凡涉及章号一律写「站点轨 sXX + 章全称」，禁止裸用编号。

**钉点边界**：本表与全文实测均钉 `67a9126`。main 轨（f9e8b28 / 0dcafa2）与本钉存在机制差异——已核实的有：s05 的「Max 20 条」与「至多一件 in_progress」校验、s07 的扫描期根目录守卫与未命中名单导航、s06 撞上限的回溯形态，均为 main 轨 2026-07-28 之后的增量或改动。凡引用以本钉为准，勿混钉。

---

## 一、站点轨 s05 TodoWrite —— 没有计划的 Agent，做着做着就偏了

### 定位与标语

- 顶部标语：*"没有计划的 agent 走哪算哪"* — 先列步骤再动手，长任务更不容易漏项。**Harness 层**: 规划 — 让 Agent 在动手之前先想清楚。
- 解决的问题：「长任务跑偏」——对话变长、工具结果填满上下文，系统提示影响力被稀释，模型做完前几步即兴发挥（「一个 10 步重构，做完 1-3 步就开始即兴发挥，因为 4-10 步已经被挤出注意力了」）。
- 章位：第 5 课，保留 s04 最小 hook 系统不动，新增第 6 个工具与 reminder 机制；章末引出 s06 Subagent（任务太大时 TODO 不够）。

### 机制【一】

1. **todo_write 规划工具（纯内存状态）**：不做任何实际工作的第 6 号工具，接收带状态的 TODO 列表，存进程内存并在终端渲染进度，退出即清空。README：「`todo_write` 本身不做任何实际工作，不能读文件、不能跑命令，只是让 Agent 在动手之前先理清思路。」返回 `f"Updated {len(CURRENT_TODOS)} tasks"`。锚点 `code.py:50`（`CURRENT_TODOS: list[dict] = []`）、`code.py:144`（`run_todo_write`）、`code.py:169-170`（工具定义，description: "Create and manage a task list for your current coding session."）。关键洞察（README）：「todo_write 不给 Agent 增加任何**执行能力**。它增加的是**规划能力**。」
2. **三态状态流转 pending / in_progress / completed**：每条目必含 `content` 与 `status`，status 限三态枚举；终端图标区分（空格 / ▸ / ✓ + ANSI 色）。锚点 `code.py:170`（enum）、`code.py:152`（icon 映射）。
3. **输入规范化防御 `_normalize_todos`**：字符串输入先 `json.loads` 失败再退 `ast.literal_eval`（全程不用 eval）；逐条校验必须是对象、必含 content/status、status 必须在枚举内；任何一步失败**返回错误字符串且不更新状态**。锚点 `code.py:124-142`；错误样例 `"Error: todos must be a list or JSON array string"`。README 的 run_todo_write 代码块省略了此函数（仅 code.py 实现）。
4. **Nag reminder（3 轮未更新注入提醒）**：`rounds_since_todo` 计数器每轮 +1、调过 todo_write 清零；计数 ≥3 且有消息时，下一次 LLM 调用前以 **user 角色**追加 `<reminder>Update your todos.</reminder>` 并归零。README 两次强调：「教学版机制，CC 源码中没有这个固定轮数逻辑」。锚点 `code.py:236-242, 257, 274-276`。阈值 3 为本钉常量。
5. **SYSTEM 提示「先计划再执行」引导**：系统提示显式要求多步任务先 todo_write 列步骤、边做边更新——提示层配合工具层。锚点 `code.py:53-57`。
6. **零改动 dispatch 接入**：新工具仅注册进 TOOLS 与 `TOOL_HANDLERS`，自动被 `TOOL_HANDLERS[block.name]` 分发；s04 hook 体系（四事件 + DENY_LIST）原样保留。锚点 `code.py:173-176, 269-270`。

继承参数（沿自 s02–s04，本章未改）：bash DENY_LIST（`rm -rf /`、`sudo` 等）、safe_path 工作区逃逸校验、120s bash 超时、50000 字符输出截断、max_tokens=8000。

### 生产版对照【三】（课程「深入 CC 源码」节转抄，口播须带归属句）

1. `tasks.ts:133-139` — CC 中有两套任务系统并存：TodoWrite（V1）与 Task System（V2）双轨。
2. `TodoWriteTool.ts:65-103` — V1 是简单列表工具，数据在内存 AppState 中维护（「教学版也保存在进程内存里，退出后清空」）。
3. `isTodoV2Enabled()`（课程未给行号）— 「交互式会话中 V2 默认启用，非交互式会话（SDK）中 V1 默认启用；设置 `CLAUDE_CODE_ENABLE_TASKS` 环境变量可强制启用 V2」；并提示阅读陷阱：源码注释 "Force-enable tasks in non-interactive mode" 描述的是 env var 路径用途，与默认分支返回值语义不同。
4. `utils/todo/types.ts:8-15` — 教学版省略了 `activeForm` 字段（CC 用它给 UI spinner 展示「正在做什么」）。
5. `TodoWriteTool.ts:72-107` — CC 源码中没有固定「3 轮」逻辑；更接近的是「3 个以上 todo 全部完成但没有 verification 项时，追加 verification nudge」。
6. `tasks/{taskListId}/{taskId}.json`（Claude 配置目录下路径）— Task System（V2）采用文件持久化而非内存列表。
7. `TaskCreateTool.ts:80-129`、`TaskUpdateTool.ts:231-260` — V2 提供 TaskCreated / TaskCompleted hooks 供外部系统集成。
8. V1/V2 对照（V2 = 站点轨 s12）：文件持久化、`blockedBy` 依赖图而非平铺列表、`proper-lockfile` 并发安全而非无锁、四个独立工具（Create/Get/Update/List）而非一个、TaskCreated/TaskCompleted hooks。

### 官方文档对照【官】（轨 C 一节，访问 2026-09-28）

| # | 官方说（引语核心） | 课程教 | 判定 |
|---|---|---|---|
| C1 | tools-reference（built-in tools 表）："`TodoWrite` \| Manages the session task checklist. **Disabled by default** in favor of `TaskCreate`, `TaskGet`, `TaskList`, and `TaskUpdate`. Set `CLAUDE_CODE_ENABLE_TASKS=0` to re-enable it" | 【三】isTodoV2Enabled：交互式 V2 默认、SDK V1 默认、env var 强制开 V2 | **分歧**（分歧清单 D1） |
| C2 | 同页 Task tool availability：任务工具「available by default only on Claude 3.x models, Opus 4 through 4.7, Sonnet 4 through 4.6, and Haiku 4.5」（v2.1.268+）；新模型默认两套都不提供 | 双轨模型「总有一套默认在场」 | **互补偏分歧**：官方多出「V0 无工具」第三态 |
| C3 | 同页："On newer models, Claude keeps track of multi-step work without a written checklist, and the tools' definitions and reminders take up context." | todo_write 是对抗跑偏的核心规划工具 | **互补**：官方给「规划能力 > 规划工具」论断的反面注脚 |
| C4 | interactive-mode（Task list）："items Claude created to plan multi-step work, with indicators showing what's **pending, in progress, or complete**" | 三态流转 + 图标区分 | **一致** |
| C5 | 同页："Tasks persist across context compactions"；`CLAUDE_CODE_TASK_LIST_ID` 共享 `~/.claude/tasks/` 命名目录 | V1 内存退出即清；V2 文件持久化 `tasks/{taskListId}/{taskId}.json` | **一致**（官方落在 V2 一侧，与课程 V2 取证吻合） |
| C6 | permission-modes："Plan mode tells Claude to research and propose changes without making them… does not edit your source. Except in interactive terminal sessions with bypass permissions available, edits stay blocked until you approve the plan." | 「先计划再执行」= 提示层引导 + 规划工具 | **互补**：课程讲机制原型，官方另有产品级 plan mode（批准前禁止编辑） |
| C7 | context-window（What survives compaction 表）："The plan Claude wrote in [plan mode] \| Re-injected from disk" | 未覆盖 | **互补**：规划产物是官方认定的跨压缩一等资产 |

---

## 二、站点轨 s06 Subagent —— 大任务拆小，每个拿到的都是干净上下文

### 定位与标语

- 顶部标语：*"大任务拆小, 每个小任务干净的上下文"* — Subagent 用独立 messages[], 不污染主对话。**Harness 层**: 子 Agent — 上下文隔离, 注意力不漂移。
- 解决的问题：上下文污染——修 bug 读了 30 个文件、聊 60 轮、messages 涨到 120 条，「让 Agent 越来越"健忘"，它记不住最初的问题是什么了」。
- 核心比喻（README 问题节）：「你修 bug 的时候，会"开一个新终端"来追踪调用链。追踪完了，终端关掉，结果写进笔记，回到原来的终端继续修 bug。」子 Agent = 临时新终端，结论 = 笔记。
- 章位：紧接 s05 规划能力，进入「子任务外包」协调维度；章末钩子引出 s07（知识全塞 system prompt 会爆上下文）。

### 机制【一】

1. **task 工具 + spawn_subagent（全新 messages[] 上下文隔离）**：主 Agent 像调普通工具一样调 task，spawn 出的子 Agent 拿到只含一条任务描述的独立消息列表，跑自己的循环。锚点 `code.py:207`、`code.py:210`（`messages = [{"role": "user", "content": description}]  # fresh context`）、注册 `code.py:252-257`。工具数 6 → 7。
2. **只回传结论（extract_text，中间过程全部丢弃）**：结束后仅返回最后一条消息里的文本结论，不回传整个 messages 列表（`code.py:249` 注释 "only summary, entire message history discarded"）。锚点 `code.py:201, 249`。
3. **文件系统副作用保留**：对话上下文被丢弃，但写文件/改文件/跑命令的结果留在工作目录——父子共用同一 WORKDIR（`code.py:47`，子复用 run_write/run_edit/run_bash，`code.py:196-199`）。隔离的是「对话」，不是「世界」。
4. **禁止递归（子 Agent 无 task 工具）**：子 Agent 只有 bash/read/write/edit/glob 五个工具，没有 task，不能再 spawn 子子 Agent。锚点 `code.py:182-193`（SUB_TOOLS）、`code.py:194`（`# NO "task" tool — prevent recursive spawning`）。
5. **子 Agent 工具调用仍走权限 hook（上下文隔离 ≠ 权限隔离）**：每次工具调用照样过 PreToolUse/PostToolUse，安全策略不因上下文隔离跳过。锚点 `code.py:223-231`（Issue 1 注释 "subagent also runs hooks (permissions apply)"）。
6. **30 轮安全限制 + 耗尽回退**：子 Agent 最多跑 30 轮（`for _ in range(30)`，本钉常量）；耗尽时最后一条是 tool_result 则**倒序回溯**找 assistant 文本，仍无则返回固定兜底句 `"Subagent stopped after 30 turns without final answer."`（`code.py:212, 237, 247`）。注意回溯命中路径返回的文本与正常收敛**同形**——父 Agent 无法区分（「回执上不写它有没有干完」仅兜底句路径除外）。
7. **独立 SUB_SYSTEM 提示**：子 Agent 有自己的 system prompt，明确要求直接完成任务、不要再委派："Complete the task you were given, then return a concise summary. Do not delegate further."（`code.py:57-62`）。
8. **dispatch 机制不变**：主循环零改动，task 作为普通工具经 `TOOL_HANDLERS[block.name]` 分发（`code.py:349`；docstring "Main loop unchanged: task auto-dispatches via TOOL_HANDLERS."）。

README「三个关键设计决策」标题下的表体实为**四行**（转写注记）：上下文隔离（全新 messages[]，中间过程不污染主上下文）／只回传结论（extract_text(last_message)）／禁止递归（子无 task 工具）／安全策略不跳过（子也走 PreToolUse hook）。

### 生产版对照【三】（六节：三种执行模式 / Fork 缓存共享 / 隔离粒度 / 递归防护 / 权限冒泡 / 异步路径）

1. 三种执行模式（纯断言表）：**Normal Subagent**（指定 subagent_type）全新 messages[] 只有 prompt；**Fork Subagent**（未指定、fork gate 开）经 buildForkedMessages() 构造 cache-friendly 前缀共享 prompt cache；**General-Purpose**（未指定、fork gate 关）同 Normal。「不是一种模式，是三种」。
2. `forkSubagent.ts:60-71` + `forkSubagent.ts:107-168` — Fork 模式不创建全新上下文，而是构造 cache-friendly 消息前缀、保留父 assistant message 并生成 placeholder tool results。「目的不是隔离，而是让 Anthropic API 的 prompt cache 命中」。
3. `forkedAgent.ts:57-68` — 缓存命中五关键组件（system prompt、tools、model、messages 前缀、thinking config）必须**字节级一致**。
4. `forkedAgent.ts:345-462` — `createSubagentContext()` 创建子 ToolUseContext：abortController 新 child controller 父 abort 向下传播；setAppState 默认 no-op 但 sync agent 经 `shareSetAppState` 共享（`runAgent.ts:697-714`）；**readFileState 从父克隆**（避免重复读相同文件）；queryTracking 新 chainId、`depth = parentDepth + 1`。
5. `forkSubagent.ts:78-89` — `isInForkChild()` 检查对话历史中 `FORK_BOILERPLATE_TAG`，有就拒绝。
6. `constants/tools.ts:36-46` — 「`Agent` 工具默认在所有 agent 的禁用集合里，`USER_TYPE === 'ant'` 时例外」；`forkSubagent.ts:73-89` 针对 fork child 有专门递归保护；`agentToolUtils.ts:100-110` teammate 场景特殊放行——「不是简单的"禁止新的子 Agent"」。
7. `forkSubagent.ts:67` — Fork Agent `permissionMode: 'bubble'`：子 Agent 权限弹窗冒泡到父终端，用户在主终端审批。
8. `AgentTool.tsx:686-764` — `run_in_background: true` 时异步启动返回 `{ status: 'async_launched' }`，完成后经通知机制告知父 Agent；实际触发条件还有 auto-background、assistant force async、coordinator/proactive 等路径。
9. 「子 Agent 不是完全隔离的：文件读取状态是共享的。UI 和通知的隔离程度取决于执行路径。」
10. 教学版刻意简化（README 自陈）：三种模式 → 一种（fresh messages）；prompt cache 共享省略；递归防护简化为「子 Agent 无 task 工具」；async 省略（留给站点轨 s13）。

### 官方文档对照【官】（轨 C 二节）

| # | 官方说（引语核心） | 课程教 | 判定 |
|---|---|---|---|
| C8 | sub-agents 导语："Each subagent runs in its own context window with a custom system prompt, specific tool access, and **independent permissions**." | task 工具 spawn、全新 messages[]、只回摘要 | **一致**（independent permissions 与「上下文隔离≠权限隔离」同向） |
| C9 | What loads at startup："Each subagent starts with a fresh, isolated context window. It doesn't see your conversation history… Claude composes a **delegation message** that summarizes the task… The exception is a [fork], which inherits the parent conversation" | 子 Agent 拿只含一条任务描述的独立消息列表 | **一致**（delegation message 即任务描述；fork 例外见 C15） |
| C10 | Write subagent files："The body becomes the system prompt… Subagents receive only this system prompt plus basic environment details… **not the Claude Code system prompt**."；"Only `name` and `description` are required." | 独立 SUB_SYSTEM，直接完成不再委派 | **一致**（同构；必填最小集与 s07 技能 frontmatter 平行） |
| C11 | 同节：子代理初始上下文还加载 "**CLAUDE.md files**: every level of the CLAUDE.md hierarchy…" 与 "**Git status**: a snapshot…"（内置 Explore/Plan 例外） | 教学版子代理只有一条任务描述 | **互补**：产品级「干净上下文」≠「空上下文」 |
| C12 | common-workflows："use a subagent to investigate how our auth system handles token refresh… reads files in its own context window and **reports a summary**." | 委派探索、只拿回摘要 | **一致** |
| C13 | Concurrent subagent limit："when **20 subagents** are running in a session, spawning another fails with `Concurrent subagent limit reached`… **no limit** on the total number" | 子 Agent 30 轮安全限制（教学） | **互补**：两种限额正交（单代理轮数 vs 会话并发） |
| C14 | "By default, a subagent **can** spawn subagents of its own, **up to three layers** below the main conversation." | 教学版禁递归；【三】「Agent 工具默认在禁用集合」 | **分歧**（分歧清单 D2） |
| C15 | Fork the current conversation："A fork… inherits the entire conversation so far instead of starting fresh… so you can hand it a side task **without re-explaining the situation**. The fork's own tool calls still stay out of your conversation and only its final result comes back." | 【三】Fork 继承父消息构造 cache-friendly 前缀，「目的是 prompt cache 命中」 | **一致+互补**：机制吻合（继承+结果-only 回传）；动机叙事层不同——cache 视角是课程源码层增量，官方讲用户动机 |
| C16 | Resume subagents："The built-in Explore and Plan agents are **one-shot** and return no agent ID, so Claude can't resume them."（自定义/general-purpose 带 agent ID 可经 SendMessage 恢复） | 教学版全部一次性、跑完即弃 | **互补**：「一次性」是内置代理属性而非子代理本质 |
| C17 | Run parallel research："Running many subagents that each return detailed results **can consume significant context**, and each subagent spends tokens of its own." | 只回传结论、不污染主上下文 | **互补**：隔离的是过程，**结果仍占主上下文预算** |

---

## 三、站点轨 s07 Skill Loading —— 用到的时候才加载

### 定位与标语

- 顶部标语：*"用到时再加载, 别全塞 prompt 里"* — 通过 tool_result 注入, 不塞 system prompt。**Harness 层**: 知识 — 按需加载, 不堆满上下文。
- 解决的问题：token 浪费——反例把 React 规范（2000 行）+ SQL 风格指南（1500 行）+ API 设计文档（3000 行）全拼进 system prompt 得 6500 行，「Agent 每次调用 LLM 都带着这些文档——不管是在改 CSS 颜色还是修 SQL 查询。99% 的内容和当前任务无关，白白消耗 token。」
- 章位：不改循环，知识加载挂进既有 dispatch；工具数 7 → 8；章尾衔接 s08 compact（「按需加载解决了"不该提前带的不要带"，compact 解决"该丢的怎么丢"」）。

### 机制【一】

1. **两级按需加载（catalog + content）**：目录层（name + 一行 description）启动时注入 SYSTEM（~100 tokens/skill，每轮都带）；内容层（SKILL.md 全文）Agent 判断需要时调 load_skill 经 tool_result 进入对话（~2000 tokens/skill，按需）。锚点 `code.py:3-11`（docstring "Layer 1 (cheap, always present)" / "Layer 2 (expensive, on demand)"）、`code.py:93-102`、`code.py:269-274`。
2. **SKILL_REGISTRY 注册表 + 启动扫描 _scan_skills()**：启动时遍历 `skills/` 下每个子目录的 SKILL.md，把 name/description/全文存入全局字典；后续查找全走注册表。锚点 `code.py:67, 69-82, 84`（模块级调用 runs once at startup）、`code.py:47`（SKILLS_DIR）。
3. **YAML frontmatter 解析 _parse_frontmatter（含降级回退）**：`---` 分隔元数据块，`yaml.safe_load` 解析；失败回退 meta 置空、name 回退目录名、description 回退正文首行去 `#`（`code.py:53-64, 80-81`）。本钉的扫描只有三个跳过条件：目录不存在、非目录项、SKILL.md 缺失。
4. **目录注入 list_skills() + build_system()**：从注册表生成「- **name**: description」清单拼进 SYSTEM，不花额外 API 调用；空表回退 "(no skills found)"（`code.py:86-102`）。SYSTEM 固定句 "Use load_skill to get full details when needed."
5. **load_skill 注册表查找**：按名取全文，天然无路径遍历面（docstring "Lookup via registry — no path traversal."）；未命中返回 `"Skill not found: {name}"` 不抛异常（`code.py:269-274`）。本钉未命中**不带可用名单**。
6. **dispatch 不变**：主循环与子代理循环都未改，load_skill 只是 TOOL_HANDLERS 新条目（`code.py:301-305, 392-393, 246-247`）。
7. **tool_result 注入语义 + 与 s08 衔接**：技能全文不是 system prompt 的一部分，而是作为一次工具结果进入 messages，「会随历史一起携带，直到上下文压缩、截断或会话结束」（README）。锚点 `code.py:400-401`。**按需加载与上下文清理是配套机制，不是替代关系**。
8. **子代理技能面收窄**：SUB_SYSTEM 无目录、SUB_TOOLS 无 load_skill/task/todo_write——技能面只开给主 Agent（`code.py:104-109, 214-227`；README 未展开原因）。

### 生产版对照【三】（课程声明基于 `loadSkillsDir.ts`、`SkillTool.ts`、`bundledSkills.ts`、`commands.ts` 的分析；均未给出行号）

1. 技能来源不止一个 skills/ 目录：「CC 实际从多个来源加载」：loadSkillsDir.ts（user/project/`--add-dir` 目录和 legacy commands `.claude/commands/`）、bundledSkills.ts（内置）、SkillTool.ts（MCP 远程）、commands.ts（命令聚合）。类型含 managed/policy、user（`~/.claude/skills/`）、project（`.claude/skills/`）、`--add-dir`、legacy commands、dynamic、conditional（带 `paths` frontmatter 按文件路径激活）、bundled、plugin、MCP skills。
2. `parseSkillFrontmatterFields()`（loadSkillsDir.ts）— frontmatter 字段：`name`/`description`、`when_to_use`、`allowed-tools`、`context`（`inline` 默认或 `fork` 作为子 Agent 运行）、`model`（haiku/sonnet/opus/inherit）、`hooks`、`paths`、`user-invocable`。免责：「完整字段列表随版本迭代会变化」。
3. `getSkillDirCommands()` — Catalog 层：扫描目录注册为 Command 对象，只含元数据。
4. `getSkillListingAttachments()` — 目录附件预算「上下文窗口的 ~1%（上限 8000 字符）」。
5. `SkillTool.ts` — 模型调 Skill 工具，输入字段 `skill` + 可选 `args`（教学版用 `name`）。
6. `getPromptForCommand()` — Load 层展开完整 SKILL.md 内容。
7. `SkillTool.ts` — tool_result 展示文本只是 `"Launching skill: {name}"`，真正技能内容通过 `newMessages` 注入对话；「教学版把两者合并为"通过 tool_result 注入"是一种简化」。
8. 四条刻意简化（README 自陈）：多文件多来源 → 1 个 skills/ 目录；多 frontmatter 字段 → 只解析 name/description；forked skills（`context: 'fork'`）省略；`skill`+`args` 输入 → 教学版用 `name`。

### 官方文档对照【官】（轨 C 三节）

| # | 官方说（引语核心） | 课程教 | 判定 |
|---|---|---|---|
| C18 | skills 导语："Create a `SKILL.md` file with instructions, and Claude adds it to its toolkit. Claude uses skills when relevant, or you can invoke one directly with `/skill-name`."；"follow the [Agent Skills](https://agentskills.io) **open standard**" | 知识做成技能、两层按需加载 | **一致+互补**（开放标准与跨工具互通是课程未提的产品层事实） |
| C19 | "Unlike CLAUDE.md content, a skill's body **loads only when it's used**, so long reference material costs almost nothing until you need it." | 内容层 ~2000 tokens/skill 按需付费 | **一致**（渐进披露核心承诺逐字同义） |
| C20 | "In a regular session, skill descriptions are loaded into context… but full skill content only loads when invoked. **Subagents with preloaded skills** work differently: the full skill content is injected at startup." | 两级：启动目录 + 运行时 load_skill | **一致+互补**：官方多出「子代理预载技能」反转路径（教学版子代理无技能面） |
| C21 | Frontmatter reference："`description` and `when_to_use` text is **truncated at 1,536 characters** in the skill listing" | 目录层 ~100 tokens/skill；【三】列表附件预算 ~1%/8000 字符 | **互补**（两个数字度量不同层面：列表总预算 vs 单技能描述截断；引用须分开） |
| C22 | Skill content lifecycle："the rendered `SKILL.md` content enters the conversation as a single message and **stays there across later turns**… Claude Code does not re-read the skill file on later turns." | 全文经 tool_result 进 messages 随历史携带直到 compact/截断；【三】真实通道是 newMessages | **一致**（与课程对 CC 真实通道的修正口径吻合：注入是对话消息而非 system prompt 常驻） |
| C23 | "Auto-compaction carries invoked skills forward within a token budget… re-attaches the most recent invocation of each skill after the summary, keeping the **first 5,000 tokens** of each. Re-attached skills share a combined budget of **25,000 tokens**." | s07↔s08 分工句：按需加载管「不该带的」，compact 管「该丢的」 | **互补**：官方给了分工句的精确数字实现 |
| C24 | "Skills in a `.claude/skills/` directory below where you started **don't load at startup**. They load the first time Claude reads or edits a file in that subdirectory." | 启动时全量扫描 skills/ | **互补**：官方把「按需」再下钻一层（目录级惰性加载） |
| C25 | "By default, both you and Claude can invoke any skill."（另有 `disable-model-invocation` / `user-invocable` / 权限语法 `Skill(name)` 精确与 `Skill(name *)` 前缀匹配） | 【三】frontmatter 字段集（含 `context: inline\|fork`、`model`、`hooks`、`paths`） | **一致+互补**：课程源码级字段集是官方文档未记载的超集，方向不冲突 |

---

## 四、站点轨 s10 System Prompt —— 运行时组装，不硬编码

### 定位与标语

- 顶部标语：*"prompt 是组装出来的, 不是写死的"* — 分段 + 按需拼接 + 缓存。**Harness 层**: 提示 — 运行时组装, 不硬编码。
- 解决的问题：s01–s09 的 SYSTEM 是一行硬编码字符串，「加一个能力就多一段」后产生三个失败模式——(1) 换项目要重写整个 prompt，不知哪些该改；(2) 修改一处可能影响全局（新工具描述可能与前面指令冲突）；(3) 每次请求都带全部内容浪费 token。
- 章位：以 s08–s09 能力为背景但不重复实现压缩与记忆，聚焦 prompt 组装机制；下一课转向错误恢复。identity section 原文："Act, don't explain."
- 成本论断（README）：「token 有成本（system prompt 每轮计费），信息越少 LLM 越专注（无关指令是噪音）。」

### 机制【一】

1. **PROMPT_SECTIONS 分段定义**：一大段字符串拆成字典，每个 key 一个主题、各段独立维护（「修改 `tools` 不影响 `identity`，新增 `memory` 不动 `workspace`」）。锚点 `code.py:42`。
2. **assemble_system_prompt 按需拼接**：按 context 真实状态选段——始终段（identity/tools/workspace）每轮加载，按需段（memory）只在条件满足时加载，`\n\n` 拼接（`code.py:47, 65`）。四 section 两策略表（README 逐字）：identity（始终）、tools（始终，依据 enabled_tools）、workspace（始终）、memory（按需，依据 `.memory/MEMORY.md` 是否存在）。
3. **get_system_prompt 确定性缓存**：上下文没变直接返回上次拼好的字符串；用 `json.dumps(context, sort_keys=True)` 做稳定 cache key 而非 `hash()`——「Python 内置 `hash()` 有进程随机化，不适合做稳定 cache key，而且遇到 list/dict 会报 `unhashable type`」。命中打印 `[cache hit] system prompt unchanged`。锚点 `code.py:68-69, 72, 82, 84`。
4. **update_context 真实状态采集**：`enabled_tools` 列出实际注册工具（`list(TOOL_HANDLERS.keys())`）；`memories` 检查 `.memory/MEMORY.md` 存在且非空才填。**「section 是否加载取决于真实状态（工具是否存在、文件是否存在），不是消息里的关键词。」**锚点 `code.py:157-165`。
5. **agent_loop 循环内重估 prompt**：每轮循环开头取 `get_system_prompt(context)`；每次工具回合后 `update_context` 重算再重取——context 变了重新组装，没变返回缓存（`code.py:173-198`）。
6. **工具面不变**：本章工具仍 3 个（bash/read_file/write_file），与 s09 相同（`code.py:135-152`）。

### 生产版对照【三】（课程声明基于 `constants/prompts.ts`（914 行）、`constants/systemPromptSections.ts`（68 行）、`context.ts`（189 行）、`utils/api.ts`（718 行）、`utils/systemPrompt.ts`（123 行）、`bootstrap/state.ts` 的分析；给的是文件总行数，未给断言行号）

1. section 数量不固定，受 feature flag、output style、KAIROS/Proactive 模式、用户类型、token 预算等影响。静态 section（始终加载）：identity、system、doing_tasks、actions、using_tools、tone_style、output_efficiency 等；动态 section（按状态加载）：session_guidance、memory、ant_model_override、env_info_simple、language、output_style、mcp_instructions、scratchpad、frc、summarize_tool_results、numeric_length_anchors、token_budget、brief 等。
2. 「`mcp_instructions` 是唯一的易失性 section（通过 `DANGEROUS_uncachedSystemPromptSection()` 创建），因为 MCP server 可以在轮次间连接和断开。」
3. 组装函数签名 `getSystemPrompt(tools, model, additionalWorkingDirs?, mcpClients?): Promise<string[]>`——返回 string[]（每元素一个 section），由 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 分隔静态和动态部分。
4. cache scope：启用 global cache boundary 时静态 section 合并成一个 global cache block，动态 section 不使用 global cache（`cacheScope: null`）。
5. CC 的三层缓存：lodash memoize（getSystemContext / getUserContext 会话中缓存）；section 注册缓存（`STATE.systemPromptSectionCache`，`/clear` 或 `/compact` 时清除）；API 级缓存（`splitSysPromptPrefix()` 按 boundary 分块）。
6. getUserContext vs getSystemContext：getSystemContext（gitStatus、cacheBreaker）追加到 system prompt 数组，「自定义 system prompt 时」跳过；getUserContext（CLAUDE.md 内容、currentDate）**前置为 `<system-reminder>` 用户消息**，「始终运行」。
7. 模式如何改变 prompt：CLAUDE_CODE_SIMPLE 整个 prompt 只有 2 行；Proactive/KAIROS 用紧凑版替换所有标准 section；Coordinator 用协调器专用 prompt 完全替换；Agent 模式的定义 prompt 替换或追加。
8. 总大小：标准交互模式下 system prompt 核心约 20-30KB 文本；CLAUDE_CODE_SIMPLE 约 150 字符；用户上下文（CLAUDE.md）与系统上下文（git status）在此基础上累加。

划界（README）：「这里的缓存只是"避免重复拼接字符串"，和 CC 的 API prompt cache 不是一回事。CC 的 prompt cache 通过 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 分隔静态和动态部分，静态部分命中 global cache，不因动态内容变化而失效。」

### 官方文档对照【官】（轨 C 四节）

| # | 官方说（引语核心） | 课程教 | 判定 |
|---|---|---|---|
| C26 | memory（Troubleshoot）："CLAUDE.md content is delivered as a **user message after the system prompt, not as part of the system prompt itself**. Claude reads it and tries to follow it, but there's no guarantee of strict compliance…" | 【三】getUserContext 前置为 `<system-reminder>` 用户消息 | **一致**：官方产品口径直接证实课程源码取证的消息层分工——装配叙事最硬的官方锚点 |
| C27 | "Claude Code has two complementary memory systems. Both are loaded at the start of every conversation. Claude treats them as **context, not enforced configuration**." | section 加载取决于真实状态 | **互补**：官方明确「记忆=提示层、hook=强制层」边界 |
| C28 | "The **first 200 lines** of `MEMORY.md`, or the first **25KB**, whichever comes first, are loaded at the start of every conversation." | memory section 按 `.memory/MEMORY.md` 存在性加载（教学版私有路径） | **互补**：官方给量化门槛与真实路径（`~/.claude/projects/<project>/memory/`） |
| C29 | 多级 CLAUDE.md：「loaded at launch」、拼接「from the filesystem root down to your working directory」、@import 递归「maximum depth of **four hops**」 | 分段 + 按需拼接 + 确定性缓存；【三】DYNAMIC_BOUNDARY 分隔 | **互补**：官方只暴露用户可见装配面（层级/顺序/导入），课程在实现层 |
| C30 | how-claude-code-works："MCP tool definitions are **deferred by default** and loaded on demand via tool search, so only tool names and server instructions consume context until Claude uses a specific tool." | 【三】mcp_instructions 唯一易失性 section | **互补+演进**：官方把 MCP 工具面也纳入「按需」范式 |
| C31 | "For instructions you want at the system prompt level, use `--append-system-prompt`. You pass it at launch, so it's better suited to scripts and automation." | 运行时组装为 harness 内部机制 | **互补**：装配叙事的用户可操作注入口 |

---

## 五、站点轨 s11 Error Recovery —— 错误不是结束，是重试的开始

### 定位与标语

- 顶部标语：*"错误不是终点, 是重试的起点"* — 升级 token、压缩上下文、切换模型。**Harness 层**: 韧性 — 主循环遇到错误时分类并恢复。
- 解决的问题：Agent 跑着跑着报错（`Error: 529 overloaded`）直接崩溃——「它没有重试，没有换模型，没有减少上下文——直接崩溃」；「生产环境中 API 错误是常态」「一个不处理错误的 Agent 就像一个一碰就熄火的车」。
- 三种最常见故障模式：输出被截断（话说一半 token 用完）、上下文超限（压缩后仍太长）、临时故障（429 限流 / 529 过载）。
- 章位：给 s01–s10 的完整循环补韧性；下一课（站点轨 s12 Task System）把一次性任务升级为有依赖、持久化的任务图（「TODO 列表不是任务系统」）。

### 机制【一】

1. **路径 1：输出截断恢复（max_tokens 升级 + 续写）**：`stop_reason == "max_tokens"` 时，首次直接把 max_tokens 从 8K 升到 64K（8 倍空间）重试同一请求——**不追加截断输出到 messages，保持原始请求不变**（`continue # messages unchanged, same request with more tokens`）；64K 仍截断才保存截断输出并注入续写提示（CONTINUATION_PROMPT），最多 3 次，超过即退出（「继续续写也不会有实质产出」）。锚点 `code.py:52-54, 58-61, 301-318`。**顺序防护：max_tokens 检查必须先于 append**（`# max_tokens check BEFORE appending to messages`；`code.py:301` 在 `code.py:321` 之前）——先写入再续写等于用残句污染历史。
2. **路径 2：上下文超限恢复（reactive compact，仅一次机会）**：`prompt_too_long` 族错误（按子串判定 prompt/long、prompt_is_too_long、context_length_exceeded、max_context_window）触发 reactive compact——比 auto compact 更激进的应急压缩；教学版只保留最后 5 条消息模拟效果（注入 `[Reactive compact] Earlier conversation trimmed.` 开头消息），真实实现由 LLM 生成 compact 摘要再重试；`has_attempted_reactive_compact` 一次性闸门，压缩过一次仍超限则退出——「再压缩也不会变小」。锚点 `code.py:226-232, 235-244, 282-291`。
3. **路径 3：瞬态故障恢复（指数退避 + 抖动）**：429/529 统一指数退避加随机抖动，最多 10 次；退避公式 `min(500 × 2^attempt, 32000) + random(0~25%)`（基础 500ms、封顶 32000ms、抖动 0~25%）；服务器返回 `Retry-After` header 优先采用；非瞬态异常重新抛给外层。锚点 `code.py:55-56, 173-179, 182-223`。抖动动机：「让并发请求不在同一时刻重试」（防雪崩）。
4. **连续 529 → 备用模型切换**：连续 3 次 529 过载切换到 `FALLBACK_MODEL_ID` 环境变量指定的备用模型；未配置则清零计数继续退避重试（不崩溃）。锚点 `code.py:48, 57, 203-219`。
5. **RecoveryState 恢复状态机**：跨循环生命周期的状态对象，跟踪 has_escalated / recovery_count / consecutive_529 / has_attempted_reactive_compact / current_model——各恢复路径「一次性闸门」的载体；成功调用后清零 529 计数。锚点 `code.py:163-170, 188`。
6. **三层错误分诊架构**：`with_retry` 只管瞬态（429/529）非瞬态重抛；外层 try/except 捕获 API 异常（prompt_too_long 走压缩、其余记日志退出）；`stop_reason` 检查处理截断——「三种恢复机制各管各的错误类型」。锚点 `code.py:273-321`。
7. **兜底：不可恢复错误的退出协议**：超出所有恢复路径的错误按「记录日志 + 把错误作为 assistant 消息写回 + return」退出，不让 Agent 裸崩（`code.py:287-298`，日志标记 `[unrecoverable]`）。

### 生产版对照【三】（课程声明基于 `query.ts`（1729 行）、`services/api/withRetry.ts`（822 行）、`query/tokenBudget.ts`（93 行）、`utils/tokenBudget.ts`（73 行）的分析）

1. 十几种 reason/transition（不只 3 条）：课程列 17 行对照表——completed、next_turn、max_output_tokens_escalate（8K→64K）、max_output_tokens_recovery（续写最多 3 次）、reactive_compact_retry、prompt_too_long、collapse_drain_retry（context collapse 先提交暂存）、model_error、image_error（ImageSizeError/ImageResizeError）、aborted_streaming（流式中止恢复）、aborted_tools、stop_hook_blocking（注入 blocking error → 模型自纠）、stop_hook_prevented、hook_stopped、token_budget_continuation（token 用量 < 90% 时继续）、blocking_limit、max_turns。「教学版只展开了前 5 种（最常见的）」；正文另有口径「CC 实际有 13+ reason code」。
2. CC 指数退避精确公式（withRetry.ts:530-548）：`delay = min(500 × 2^(attempt-1), 32000) + random(0~25%)`；延迟表：尝试 1 → 500ms + 0-125ms、尝试 2 → 1000ms + 0-250ms、尝试 4 → 4000ms + 0-1000ms、尝试 7+ → 32000ms 上限 + 0-8000ms；`Retry-After` 优先。**注意：CC 公式指数为 `2^(attempt-1)`，教学版 code.py 为 `2^attempt`，两处原文并存**。
3. CONTINUATION 提示原文（query.ts:1225-1227）：`Output token limit hit. Resume directly — no apology, no recap of what you were doing. Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.`；token budget nudge（tokenBudget.ts:72）：`Stopped at {pct}% of token target. Keep working — do not summarize.`
4. 流式错误处理（query.ts:788-822）：可恢复错误（413、max_tokens、media error）在 streaming 期间**被暂扣不展示**——SDK 消费者看不到，只有恢复逻辑能看到；streaming 结束后才判断是否需要恢复。
5. 529 → Fallback Model 切换：「连续 3 次 529 过载错误后（`MAX_529_RETRIES = 3`），CC 自动切换到 fallback model（如 Opus → Sonnet）。切换时清除所有 pending 消息和 tool 结果，给用户展示 `Switched to {model} due to high demand`。」
6. Diminishing Returns 检测（tokenBudget.ts:60-62）：「连续 3 次 continuation 且 token 增量 < 500 时，系统判断"继续也没有实质性产出"，停止 continuation」。

教学版覆盖面声明：「教学版只处理 429/529；真实系统还覆盖连接错误、超时、云厂商认证缓存等」。

### 官方文档对照【官】（轨 C 五节）

| # | 官方说（引语核心） | 课程教 | 判定 |
|---|---|---|---|
| C32 | errors（Automatic retries）："Claude Code retries transient failures **up to 10 times** with exponential backoff before showing you an error." | 指数退避 + MAX_RETRIES=10 | **一致**：上限 10 与退避策略获官方直接证实（公式与抖动参数为课程源码层增量） |
| C33 | 同节：吃满重试预算的是「Server errors, overloaded responses, and request timeouts that arrive **before any of Claude's response has streamed**」「Temporary 429 throttles, but not a gateway's spend-limit 429」；不重试如「A TLS certificate validation failure… reports the error on the first attempt」 | 429/529 统一退避；非瞬态重抛 | **一致+互补**：分诊思想一致，官方给更细白/黑名单 |
| C34 | 同节："A request rejected because the **input plus `max_tokens` exceeds the context limit**… Claude Code retries with a **reduced** `max_tokens`, and stops retrying and **compacts** instead in two cases" | 输出截断（stop_reason=max_tokens）→ max_tokens 8K **升** 64K + 续写 ≤3 次 | **互补（方向相反的两条路径）**：官方记载输入侧「降档」，课程讲输出侧「升档」；不冲突但引用必须分清触发条件；输出侧 8K→64K 升级仍是课程源码层独有 |
| C35 | errors（529 节）："The API is temporarily at capacity across all users. Claude Code has already retried several times before showing this message"；"Run `/model` and switch to a different model… Claude Code **prompts you to do this**" | 【三】连续 3 次 529 自动切换 + `Switched to {model} due to high demand` | **分歧**（分歧清单 D3） |
| C36 | model-config（Fallback chains）："can switch to a fallback model instead of failing the request… caps chains at **three models**"（`--fallback-model`；子代理同样适用："the subagent continues on the model that accepts the request"） | 教学版 FALLBACK_MODEL_ID env；【三】MAX_529_RETRIES=3 内置自动切换 | **互补偏分歧**：降级机制存在获证实，但触发方式（用户配置链 vs 内置 3×529）与持续性口径不同 |
| C37 | sub-agents（API errors）："When something cuts off a subagent's response mid-stream, and the partial response contains text but no tool calls, Claude Code **prompts the subagent to continue** rather than ending the run… The run ends on the error only once those continuations are used up." | 输出截断→续写提示最多 3 次，超过即退出 | **一致**：有限续写预算的恢复形态获官方证实（限子代理场景；次数官方未给数字） |
| C38 | context-window："Claude Code compacts automatically as you approach the limit… The automatic pass works the same way as the `/compact` step"；`Prompt is too long` 触发时「normally summarizes your oldest exchanges and keeps the newest」 | prompt_too_long → reactive compact，一次机会 | **一致+互补**：主线对应；官方另有最后手段（逐字保留最新 prompt、必要时整段总结） |
| C39 | how-claude-code-works / troubleshooting："If a single file or tool output is so large that context refills immediately after each summary, Claude Code **stops auto-compacting after a few attempts and shows an error** instead of looping."（`Autocompact is thrashing`；恢复建议含 "Move the large-file work to a subagent"） | 「再压缩也不会变小」一次性闸门 | **一致**：有界恢复/止损哲学的官方直接对应 |
| C40 | checkpointing："Before Claude edits a file, it snapshots the current contents. If something goes wrong, press `Esc` twice to rewind…"（`/rewind`：Restore code / Restore conversation / Summarize…） | s11 只覆盖 API 层错误恢复 | **互补**：维度补位——课程讲引擎自愈，官方另有用户侧恢复面（文件快照回滚、对话回退） |
| C41 | interactive-mode："When a claude.ai usage limit stops Claude mid-task, Claude Code **waits in the open session and continues the task on its own after the limit resets**." | 未覆盖（课程只处理 429 节流一类） | **互补**：第三类错误的恢复路径——等待限流窗口重置并自动续跑 |
| C42 | common-workflows："`claude --continue`… `claude --resume` to choose from a list, or `/resume` from inside a running session." | s11 聚焦单次循环内恢复 | **互补**：恢复粒度谱系的会话层一端（跨会话续跑） |

---

## 分歧清单

> 判定标准：官方现行文档与课程口径（含课程「深入 CC 源码」对真实 CC 的断言）在同一问题上给出冲突表述。课程教学版的刻意简化（README 已自陈）不计入分歧，仅在正文对照中标注。处置默认取更可核验的一轨（官方产品现状口径）；课程 vs 官方分歧须写明口播措辞建议。

| # | 分歧点 | 两轨各自的说法 | 处置与口播措辞建议 |
|---|---|---|---|
| D1 | **TodoWrite 默认态与 `CLAUDE_CODE_ENABLE_TASKS` 语义反转** | 课程【三】（引 isTodoV2Enabled()）：交互式会话 V2 默认启用、非交互式（SDK）V1 默认启用；设 `CLAUDE_CODE_ENABLE_TASKS` 可**强制启用 V2**。官方（tools-reference，v2.1.268+）：TodoWrite「Disabled by default in favor of TaskCreate/TaskGet/TaskList/TaskUpdate」，`CLAUDE_CODE_ENABLE_TASKS=0` 用于**重新启用 V1（TodoWrite）**；且新模型上默认两套任务工具都不提供 | 取官方。口播措辞：「课程拆当时的源码得出『交互式默认任务图、SDK 默认轻量清单』；官方文档现在的口径是——TodoWrite 默认禁用、由四个 Task 工具取代，同一个环境变量如今用来把 TodoWrite 换回来；而在最新模型上，两套任务工具默认都不开，官方的理由是模型不再需要书面清单。」凡涉任务工具默认态一律以官方现行口径为准 |
| D2 | **子代理递归的默认值** | 课程【三】（引 constants/tools.ts:36-46）：「`Agent` 工具默认在所有 agent 的禁用集合里，`USER_TYPE === 'ant'` 时例外」——默认禁止子代理再派子代理。官方（sub-agents）："By default, a subagent **can** spawn subagents of its own, up to **three layers** below the main conversation."——默认允许、限深三层 | 取官方。口播措辞：「教学版干脆不给子 Agent 派生的工具，课程拆源码时它默认也在禁用名单里；而官方现行文档说，产品里子代理默认就能再派子代理、最深三层。」教学版「无 task 工具」是自陈简化，照讲不误；「CC 默认禁用」不可作产品现状断言 |
| D3 | **529 过载后的模型切换：内置自动 vs 可配置链 + 手动提示** | 课程【三】（引 MAX_529_RETRIES = 3）：连续 3 次 529 后 CC **自动**切换 fallback model（如 Opus → Sonnet），展示 `Switched to {model} due to high demand`。官方（errors + model-config）：529 错误页只说「已重试多次后报错」并**建议用户 `/model` 手动切换**（高负载时 Claude Code 会提示用户）；自动切换仅以**用户配置**的 fallback chains 形式记载（链上限 3、切换仅当前回合），无「连续 3 次内置自动切换」的记载 | 取官方。口播措辞：「课程教的是教学版自己的兜底（配了备用模型就切）；官方文档对 529 的说法是——重试烧完后提示你手动 `/model` 换模型，自动切换只在你自己配了 fallback 链时发生。」凡「CC 会自动换模型」不作产品断言 |
| D4 | **README 表述与 code.py 实现的出入（s06）** | README 小节标题「三个关键设计决策」，其下表体实为**四行**（上下文隔离 / 只回传结论 / 禁止递归 / 安全策略不跳过） | 讲机制时按四条讲（与 code.py 一致）；不引用「三个」计数 |
| D5 | **README 代码块省略输入校验（s05）** | README 的 run_todo_write 代码块省略了 `_normalize_todos`，仅 code.py 实现（`code.py:124-142`）；另 s07 README 正文未展开「子代理无技能面」（仅 code.py SUB_SYSTEM/SUB_TOOLS 体现） | 断言输入校验与子代理技能面收窄时证据级标【一】（code.py 实测），不引 README 为源 |

## 附：口播不可出口的边界（负向清单）

- 「3 轮未更新就提醒」是**教学版机制**（README 两次自陈「CC 源码中没有这个固定轮数逻辑」）；CC 侧最接近的是「3 个以上 todo 全 completed 无 verification 项时追加 nudge」【三】。
- 「待办清单减少跑偏」是设计主张，材料无对照实验、无漂移指标、无成功率数字——不可讲成测量结论。
- 【三】断言不转引具体 CC 文件行号进「口播可用」层；转抄保留在「生产版对照」小节并标注归属义务（「课程作者拆 CC 源码的分析」+ 画面角标）。
- 退避公式指数口径：CC 侧 `2^(attempt-1)` 与教学版 `2^attempt` 两处原文并存【三】——引用须注明是哪一版，勿混同。
- 站点轨 s10/s11 章号与 main 轨、旧 12 课轨三轨三物，涉及处必须带「站点轨 + 章全称」。
