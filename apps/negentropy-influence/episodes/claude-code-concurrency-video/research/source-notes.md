# 事实源：《Learn Claude Code》并发 2 章

> **本集口播的单一事实源**。逐字稿中每一条断言都必须能回溯到本文件的某一节。
>
> **信源双轨与修订分叉**：章节归属与双钉（本集钉 `67a9126`，站点同源修订（20 章版））只登记在系列级信源地图，本文件不重述：见 [../../../source-map/claude-code-explained.md](../../../source-map/claude-code-explained.md)。
>
> **证据分级**：【一】仓库实测（@ 67a9126，可复算）／【二】站点正文／【三】课程作者对 Claude Code 源码的分析（口播必带归属句 + 画面角标）／【官】Anthropic 官方文档（产品现状口径，域名已迁 code.claude.com）。
>
> **提取方式**：2026-09-28 五维度重调研（钉点逐章 curl 取原文）；字节归档 `research/source-archive/67a9126/`；指纹见 [sources.toml](./sources.toml)。图片纪律：站点 SVG 不下载不嵌入，只转文字规格。
>
> **撞号纪律**：本集两章号与 main 17 章轨同号不同物（main s13 = Agent Teams、main s14 = MCP Plugin），与旧 12 课轨亦错位（旧轨 s08 ≈ Background Tasks）。凡涉章号一律写「站点轨 + 章全称」（如「站点轨 s13_background_tasks」），禁止裸用编号。

---

## 实测总表（【一】· 2026-09-28 @ 67a9126）

| 章（站点轨） | 总行 | 非空非注释 | 工具数 |
|---|---:|---:|---:|
| 站点轨 s13_background_tasks | 480 | 381 | 8 |
| 站点轨 s14_cron_scheduler | 804 | 645 | 11 |

口径：总行 = `wc -l code.py`；非空非注释 = `grep -cvE '^\s*(#|$)'`（docstring 计入）；工具数 = TOOLS 列表 `"name":` 条目数。s13 的 8 工具沿用 s12（bash、read_file、write_file、create_task、list_tasks、get_task、claim_task、complete_task）；s14 = 8 + 3 = 11（+schedule_cron、list_crons、cancel_cron）【二】。

数字纪律：口播不引绝对行数与活数据；本表仅供制作组核对体量与工具面。

---

## 一、站点轨 s13 Background Tasks —— 慢操作丢后台，Agent 继续处理

### 定位与标语

- **解决的问题【二】**：慢操作阻塞 Agent 主循环——`pip install torch` 要 10 分钟、`npm run build` 要 3 分钟，命令一跑 Agent 只能干等 bash 工具返回，而 LLM 按 token 计费，空转就是浪费。方案：慢操作扔后台线程，Agent 继续跑循环，后台完成后把结果以通知形式注入对话。
- **全书递进位【二】**：s12（简化任务系统）之后、s14（Cron Scheduler）之前——本章解决「慢操作不阻塞」，下一章解决「定时做某件事」，章尾预告原话是「给 Agent 装一个闹钟」。
- **标语与引言块原样摘录【二】**：
  > *"慢操作丢后台, agent 继续处理"* — 后台线程跑命令, 完成后注入通知。
  >
  > **Harness 层**: 后台 — 异步执行, 不阻塞主循环。
- **核心比喻【二】**（洗衣机，README 开篇整段）：「你用过洗衣机吗？把衣服扔进去，按下启动，然后去干别的——做饭、回消息、看论文。30 分钟后洗衣机"滴滴滴"提醒你：好了。你不会站在洗衣机前面干等 30 分钟。」
- **教学版裁剪（课程自declared）【二】**：「省略完整错误恢复、记忆和技能系统」；code.py docstring 进一步写明 S11 的 RecoveryState、backoff、escalation、reactive compact、fallback model 均被省略（`code.py:19-22`）。工具数保持 8 个不变，「变的只是执行策略」。

### 机制【一】

1. **should_run_background（显式请求优先，启发式兜底）**：模型通过 bash 工具的 `run_in_background` 参数显式请求后台执行；模型没指定时，教学版用关键词启发式猜测哪些命令可能超过 30 秒。
   - README 引语【二】：「模型通过 bash 工具的 `run_in_background` 参数显式请求后台执行。如果模型没指定，教学版用关键词启发式兜底」；「CC 的 bash 工具 schema 里有 `run_in_background: boolean` 参数（`BashTool.tsx:241`）。模型自己决定哪些命令丢后台，不靠关键词猜。教学版保留启发式作为兜底，但主路径是模型显式请求。」
   - 锚点【一】：`code.py:329 def should_run_background`、`code.py:318 def is_slow_operation`；slow_keywords 列表 `code.py:323-325`（install / build / test / deploy / compile / "docker build" / "pip install" / "npm install" / "cargo build" / pytest / make）。
   - 关键参数：启发式阈值口径 "commands likely to take > 30s"（docstring `code.py:319`）；bash schema 从 `command` 变为 `command` + `run_in_background`（boolean 且不在 required，`code.py:256-261`）。
   - 相对 s12 变更：新函数（s12 无此二者）。

2. **start_background_task（daemon 线程后台执行与生命周期追踪）**：把工具调用包装成 worker 函数扔进 daemon 线程，每个后台任务分配唯一 ID，状态存进内存字典，加锁保证线程安全。
   - README 引语【二】：「把工具调用包装成 worker 函数，扔到 daemon 线程里执行。每个后台任务有唯一 ID，状态存在 `background_tasks` 字典里」；「返回 `bg_id` 而不是只返回 `[Running in background...]`。`daemon=True` 确保 Agent 进程退出时线程跟着退出。教学版用内存字典追踪状态；真实 CC 有 `LocalShellTaskState`，输出重定向到文件，支持停止任务、读取后续输出等完整生命周期。」
   - 锚点【一】：`code.py:344 def start_background_task`；全局态 `code.py:312-315`（`_bg_counter` / `background_tasks` / `background_results` / `background_lock = threading.Lock()`）；`code.py:363 threading.Thread(target=worker, daemon=True)`；bg_id 生成 `code.py:348 f"bg_{_bg_counter:04d}"`。
   - 关键参数：bg_id 为四位零填充（`bg_0001` 形式）。
   - 相对 s12 变更：新类型 `background_tasks: dict`、`background_results: dict`、`background_lock: Lock`。
   - 取证备注【一】：README 片段中命令取值为 `block.input.get("command", "")`，`code.py:349` 实为 `block.input.get("command", block.name)`——以 code.py 为 SSOT（见分歧清单 #1）。

3. **collect_background_results（完成结果收集 + task_notification 通知格式化）**：每轮扫描状态为 completed 的后台任务，弹出结果并格式化为 `<task_notification>` XML 文本块，摘要截断到 200 字符。
   - README 引语【二】：「后台任务完成后，收集结果并格式化为 `<task_notification>` 通知」；「通知不复用原始 `tool_use_id`。原始 tool call 已经用占位 `tool_result` 回复了，后台完成是独立事件，用 `task_notification` 格式注入。这符合 Messages API 的工具配对语义：一个 `tool_use` 只对应一个 `tool_result`。」
   - 锚点【一】：`code.py:369 def collect_background_results`；通知格式化 `code.py:380-386`（含 `task_id` / `status` / `command` / `summary` 四个字段）；摘要截断 `code.py:379`（`summary = output[:200] if len(output) > 200 else output`）。
   - 相对 s12 变更：新通知格式 `<task_notification>`（不复用 tool_use_id）。

4. **agent_loop 双路分发 + 通知合流**：工具执行分两条路——判定为后台的先回带 bg_id 的占位 tool_result，快操作照旧同步执行；随后收集后台通知，通知（text block）和本轮工具结果合并成同一条 user 消息发给模型。
   - README 引语【二】：「慢操作先回一个带 `bg_id` 的占位 tool_result，LLM 知道这个命令还在跑，可以先做别的事。后台完成后，通知作为独立 text block 和当前轮的 tool_result 一起组成 user 消息。」；「教学版在 agent loop 继续运行时轮询后台结果。真实 CC 通过通知队列（`messageQueueManager.ts`）把后台完成事件送入后续 turn，不需要等工具循环。」
   - 锚点【一】：`code.py:410 def agent_loop`；后台分支 `code.py:433-439`（占位内容 `[Background task {bg_id} started]`）；同步分支 `code.py:440-445`；通知合流 `code.py:447-455`（`user_content = list(results)` 后 append 通知 text block）。
   - 相对 s12 变更：循环行为从「工具串行执行」变为「慢操作异步，快操作同步，通知每轮收集」。注意：工具批次仍是 for 循环逐块串行分发【一】（`code.py:433-445` 对 `response.content` 逐个处理）——本章没有并行执行工具。

5. **线程安全状态管理**：所有对共享字典（background_tasks / background_results）的读写都包在 `background_lock` 临界区里，worker 线程完成后在锁内更新状态。
   - README 引语【二】（code.py docstring，Changes from s12 第 3 条）：「background_results dict + threading.Lock for thread-safe storage」。
   - 锚点【一】：`code.py:315 background_lock = threading.Lock()`；worker 内加锁 `code.py:353-355`；收集时加锁 `code.py:371-378`。
   - 相对 s12 变更：s12 无共享可变状态，本章首次引入跨线程共享字典。

6. **run_bash 与调度解耦**：bash 处理函数签名里带 `run_in_background` 形参但不在函数内处理，由 agent_loop 的分发层统一决定前台/后台（课程正文未单独展开，体现在代码）。
   - 锚点【一】：`code.py:184 def run_bash`、`code.py:185` 注释「run_in_background is handled by agent_loop dispatch, not here」。

**防护与边界（同步路径 + 进程边界）【一】**：同步 bash 120 秒超时（`code.py:188 timeout=120`）；同步输出截断 50000 字符（`code.py:190 out[:50000]`）；后台通知摘要截断 200 字符（`code.py:379`）；`daemon=True` 保证进程退出时后台线程连带退出（`code.py:363`）；后台状态为内存态、会话结束即失（`code.py:312-315` 字典无落盘路径）。

### 生产版对照【三】

> 以下为取证笔记 §4 的逐条转抄（课程对真实 Claude Code 源码的分析）。**归属义务**：口播引用任一条须带「据 learn-claude-code 课程对 CC 源码的分析」归属句 + 画面角标；CC 文件行号只保留在本节，不进口播可用层。

- `BashTool.tsx:241` — CC 的 bash 工具 schema 里有 `run_in_background: boolean` 参数；模型自己决定哪些命令丢后台，不靠关键词猜。
- `query.ts:1411-1482` — CC 在每批工具执行完后，启动 Haiku side-query 生成工具使用摘要的发起代码。
- `services/toolUseSummary/toolUseSummaryGenerator.ts:15` — 摘要 prompt 文本，变量名 `TOOL_USE_SUMMARY_SYSTEM_PROMPT`；提示语为 "Write a short summary label... think git-commit-subject, not sentence"，过去时态，约 30 字符。
- Haiku 摘要耗时约 1s，在主模型流式生成（5-30s）期间完成；下一轮开始前把摘要 yield 出去；SDK 消费这些摘要做移动端进度展示。（依附于上两条源码引用的时序断言）
- `query.ts`（211, 1054-1060 行）— 课程头部声明的分析范围包含此两处行号，但正文六节未单独展开其内容（课程未展开）。
- 线程模型（无行号）— CC 运行在 Node.js/Bun 单线程事件循环中，「后台」只是「不 await」；`ShellCommand.background(taskId)` 把 stdout/stderr 重定向到文件，让进程独立运行。
- `Task.ts:7-13` — CC 定义 7 种后台任务类型：`local_bash`、`local_agent`、`remote_agent`、`in_process_teammate`、`local_workflow`、`monitor_mcp`、`dream`；每种有自己的注册、生命周期和通知机制。
- `utils/task/framework.ts:267` — `enqueueTaskNotification` 把后台完成通知入队到共享命令队列；另一入口为 `messageQueueManager.ts` 的 `enqueuePendingNotification`；消费点在 `query.ts:1566-1593`；优先级 `next` > `later`，后台任务默认 `later`（不阻塞用户输入）。
- `LocalShellTask.tsx` L24-25（常量）, L59-98（看门狗逻辑）— 定期检查后台 bash 任务输出是否停滞，45 秒无增长后检测交互式提示（`(y/n)` 等），防止后台任务卡在无人响应的交互式对话框。
- 并发限制 — 前台工具调用受 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` 限制（默认 10 个并发安全工具）；后台 bash 任务没有硬性限制，它们是独立的子进程。
- 通知 XML 格式示例（CC 侧，README 转抄）：

```xml
<task_notification>
  <status>completed</status>
  <summary>Background command "npm test" completed (exit code 0)</summary>
</task_notification>
```

### 官方文档对照【官】

> 轨 C 事实集（code.claude.com，2026-09-28）。判定三档：一致 / 互补 / 分歧。引语逐字。

| # | 主题 | 官方说【官】 | 课程教 | 判定 |
|---|---|---|---|---|
| 1 | run_in_background 异步执行 | "When Claude Code runs a command in the background, it runs the command asynchronously and immediately returns a background task ID. Claude Code can respond to new prompts while the command continues executing in the background."（interactive-mode） | 模型显式请求后台（`BashTool.tsx:241`【三】），异步 + 立即返回任务 ID | 一致 |
| 2 | 用户侧入口 Ctrl+B | "Press `Ctrl+B` to move a regular Bash tool invocation to the background. Tmux users must press `Ctrl+B` twice due to tmux's prefix key."（interactive-mode） | 只讲模型侧参数这一条入口 | 互补 |
| 3 | 超时自动转后台 | "When a command reaches its timeout before it finishes, Claude Code automatically moves it to the background instead of stopping it, unless the command starts with `sleep`."；转后台时报文明示 `Command did not complete within its 120s timeout and was moved to the background` + 任务 ID + 输出文件路径（interactive-mode / tools-reference） | 未教（教学版同步 bash 120s 超时直接返回结果；官方默认超时数值与教学版 `timeout=120` 同源） | 互补 |
| 4 | 输出落文件、/tasks、TaskOutput 弃用 | "Output is written to a file and Claude can retrieve it using the Read tool"；"List and stop background tasks with `/tasks`"；"`TaskOutput` — Retrieves output from a background task. Deprecated in favor of `Read` on the task's output file path."（interactive-mode / tools-reference） | 【三】`LocalShellTaskState` 输出重定向文件 + 完整生命周期 | 一致（+TaskOutput→Read 为产品演进细节） |
| 5 | 退出清理 | "Background tasks are automatically cleaned up when Claude Code exits."；`setsid`/`timeout` 分离进程连坐终止；"If you background the session instead of exiting it, your background tasks keep running in the background session."（interactive-mode） | `daemon=True` 进程退出线程跟着退（方向一致） | 一致（方向）+互补 |
| 6 | 资源上限 | "Background tasks are automatically terminated if output exceeds 5GB"；内存压力收割（闲置≥30 分钟且无轮次/子代理运行时停后台任务，v2.1.193+，`CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1` 可关）（interactive-mode） | 【三】「后台 bash 无硬性并发限制——独立子进程」（官方同样未记并发上限） | 互补（无并发上限 → 有资源上限） |
| 7 | 后台总开关 | "`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` — Set to `1` to disable all background task functionality, including the `run_in_background` parameter on Bash and subagent tools, auto-backgrounding, and the Ctrl+B shortcut"（env-vars） | 未讲 | 互补 |
| 8 | 前台并发上限 | "`CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` — Maximum number of read-only tools and subagents that can execute in parallel (default: 10)."（env-vars） | 【三】「默认 10 个并发安全工具」（课程为意译，语义同向） | 一致 |
| 9 | headless（-p）退出 | 后台 Bash 任务在 `claude -p` 返回最终结果且 stdin 关闭后约 5 秒终止（宽限期让刚完成的任务仍能交付输出）；后台子 agent/workflow 则会让 `-p` 等待完成（默认 10 分钟空闲上限 `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`）（headless） | 未覆盖 | 互补 |
| 10 | SDK 通知消息 | "`TaskNotificationMessage` — Emitted when a background task completes, fails, or is stopped. Background tasks include `run_in_background` Bash commands, Monitor watches, and background subagents."；字段 task_id / status（completed、failed、stopped）/ output_file / summary / tool_use_id / usage；MCP 长调用后台化后真实结果经此消息返回（Agent SDK Python） | `<task_notification>` 四字段（task_id/status/command/summary）独立 text block 注入、不复用 tool_use_id | 一致（同构）+互补 |
| 11 | 通知人（PushNotification） | "Sends a desktop notification, and a phone push when Remote Control is connected, so a long-running task or scheduled task can reach you when you step away."；Bedrock/Vertex 等不经 Anthropic 托管设施不可用（tools-reference） | 通知口径=注入对话给模型（机器侧） | 互补（两条通知通路课程只讲一条） |
| 12 | Monitor 工具 | 后台脚本逐行回流 / WebSocket 事件源；"Every watch Claude starts has a deadline: 5 minutes by default, at most 30 minutes, and at most 10 minutes in a non-interactive run given a single prompt with `-p`."（tools-reference） | 【三】`monitor_mcp` 列为七种后台任务类型之一 | 一致（方向）+互补 |
| 13 | 源码级口径对账空窗 | 官方未记载：45 秒停滞看门狗、通知优先级 `next` > `later`、Haiku 工具使用摘要（~1s/30 字符）、Node.js/Bun 单线程「后台=不 await」 | 均为课程【三】 | 无法对账（非分歧；维持归属句，不得包装成官方背书） |

---

## 二、站点轨 s14 Cron Scheduler —— 按时间表生产工作，调度与执行解耦

### 定位与标语

- **解决的问题【二】**：周期性工作不该需要人每次来推——s13 让 Agent 能后台执行慢操作，但触发权仍在用户手里，「你说一句，Agent 动一下」；「每天早上 9 点跑测试」「每 30 分钟检查 CI 状态」这类周期任务的触发本身应该自动化。做法：把「什么时候做」与「做」解耦。
- **全书递进位【二】**：s13 之后、s15（Agent Teams）之前——至此单个 Agent 已「能计划、能压缩、能后台、能定时」，下一课动机是任务太大、单 Agent 注意力有限，需要组队。
- **标语与引言块原样摘录【二】**：
  > *"按时间表生产工作, 调度与执行解耦"* — cron 调度, 持久化或会话级。
  >
  > **Harness 层**: 调度 — 独立线程判断时间, 队列传递触发。
- **核心比喻【二】**（闹钟，开篇）：「闹钟不需要你盯着它才会响。你设好 7:00，到点它自己响，你在睡觉、在洗澡、在做饭，它都照响不误。」另有 Unix 老兵句：「Cron 表达式，五段式，Unix 用了 50 年」。
- **教学版裁剪【二】**：「为了聚焦调度器，省略完整错误恢复、记忆和技能系统」；`code.py:682` 注释「S11's full error recovery is omitted」。
- **继承件（非本章新增，code.py 标注 synced）【一】**：s12 任务系统（`code.py:49-140`）、s10 prompt 组装（`code.py:143-175`）、s13 后台执行（`code.py:258-343`：is_slow_operation 关键词启发式、should_run_background、daemon 线程 worker、`<task_notification>` 汇报）；安全件 `safe_path`（路径逃逸拦截，`code.py:180-184`）与 bash 120s 超时（`code.py:191`）沿用。

### 机制【一】

1. **四层模型（Scheduler → Queue → Queue Processor → Consumer）**：调度分四个正交角色——daemon 线程判时、队列暂存已触发任务、处理器择机唤醒、agent_loop 消费注入，每层只做一件事，通过锁与队列协作。
   - README 引语【二】：「Cron 调度分四层：1. **Scheduler**：daemon 线程，每秒轮询，判断时间到了没有 2. **Queue**：`cron_queue`，调度线程写入已触发任务 3. **Queue Processor**：发现队列非空且 Agent 空闲，启动一轮 agent_loop 4. **Consumer**：agent_loop 从队列消费，注入到 messages」。
   - 锚点【一】：模块 docstring `code.py:18-22`；`code.py:519 cron_scheduler_loop`、`code.py:361 cron_queue`、`code.py:773 queue_processor_loop`、`code.py:690 consume_cron_queue`。
   - 相对 s13 变更：s13 只有后台执行线程；本章新增「调度线程（daemon, 1s 轮询）+ queue processor 线程」。

2. **CronJob 数据结构**：每个 cron 任务是一个五字段 dataclass（id / cron / prompt / recurring / durable），一次性与持久化都在字段里声明。
   - README 引语【二】：字段注释「`cron: str  # "0 9 * * *" (五段式 cron 表达式)`」「`recurring: bool  # True=周期性，False=一次性`」「`durable: bool    # True=写磁盘，跨会话保留`」。
   - 锚点【一】：`code.py:351-357 @dataclass class CronJob`；任务 id 生成于 `code.py:495`，格式 `cron_{random.randint(0, 999999):06d}`。

3. **cron_matches：五段式匹配 + DOM/DOW OR 语义**：判断「现在」是否命中 cron 表达式；分钟、小时、月必须全匹配（AND），日（DOM）与星期（DOW）同时被约束时任一命中即可（OR）——标准 Unix cron 语义。
   - README 引语【二】：「标准 cron 语义：分钟、小时、月必须全部匹配；日（DOM）和星期（DOW）同时被约束时任一匹配即可（OR）」；代码注释「`dow_val = (dt.weekday() + 1) % 7  # Python Monday=0 → cron Sunday=0`」。
   - 锚点【一】：`code.py:383 def cron_matches`（OR 分支在 `code.py:398-410`）。

4. **_cron_field_matches：字段级匹配原语**：单个 cron 字段支持 `*`、`*/N`（步进）、`N-M`（区间）、`N,M,...`（列表，递归展开）四种形态。
   - README 引语【二】：「支持 `*`、`*/N`、`N`、`N-M`、`N,M,...`。」
   - 锚点【一】：`code.py:367 def _cron_field_matches`（`*/` 于 371-373，逗号递归于 374-376，区间于 377-379）。

5. **validate_cron：注册前校验**：注册与磁盘加载前先校验表达式（字段数必须为 5、各段落在界内：分 0-59、时 0-23、日 1-31、月 1-12、星期 0-6），非法直接返回错误；从磁盘恢复时跳过非法任务，防单个坏任务拖垮启动。
   - README 引语【二】：「`schedule_job` 在注册前校验 cron 表达式，非法的直接返回错误」「从磁盘加载 durable job 时也会跳过非法表达式，避免单个坏任务拖垮启动。」
   - 锚点【一】：`code.py:448 def validate_cron`（界定义 `code.py:453 bounds = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 6)]`）；加载跳过 `code.py:476-479`。

6. **cron_scheduler_loop：独立调度线程**：跑在 daemon 线程里、每秒轮询一次，完全独立于 agent_loop 是否在执行；遍历 `list(scheduled_jobs.values())` 拷贝，单个 job 异常被 per-job try/except 吞掉，不杀调度线程。
   - README 引语【二】：「调度器跑在独立的 daemon 线程里，不依赖 agent_loop 是否在执行。单个 job 异常不会杀掉整个线程」；「**独立于 agent_loop**：即使 agent_loop 没在跑，调度器也在后台检查时间」「**单 job try/except**：一个坏 job 不会拖垮整个调度线程」。
   - 锚点【一】：`code.py:519 def cron_scheduler_loop`（`time.sleep(1)` 于 524；per-job `try/except` 于 530-542）。线程在**模块导入即启动**：`code.py:560-562`（`load_durable_jobs()` + `threading.Thread(target=cron_scheduler_loop, daemon=True).start()`）。

7. **date-aware minute_marker：分钟级去重**：用 `"YYYY-MM-DD HH:MM"` 字符串做每 job 的上次触发标记，防止同一分钟内重复入队（1s 轮询会在同一分钟命中约 60 次），同时带日期、避免纯 `HH:MM` 在第二天被误判「已触发」而跳过。
   - README 引语【二】：「**date-aware minute_marker**：用 `"YYYY-MM-DD HH:MM"` 防止同一分钟重复触发，同时不会在第二天跳过」。
   - 锚点【一】：`code.py:527 minute_marker = now.strftime("%Y-%m-%d %H:%M")`、`code.py:532-534`；状态表 `code.py:364 _last_fired: dict[str, str]`。

8. **一次性任务自动清理**：`recurring=False` 的 job 触发后立即从 scheduled_jobs 删除；durable 的还会同步落盘。
   - README 引语【二】：「**一次性任务**：触发后自动从 scheduled_jobs 里删除」。
   - 锚点【一】：`code.py:537-540`（`if not job.recurring: scheduled_jobs.pop(job.id, None); if job.durable: save_durable_jobs()`）。

9. **cron_queue 队列解耦**：调度线程（生产者）、queue processor（交付者）、agent_loop（消费者）三个角色通过 `cron_queue`、`cron_lock`、`agent_lock` 解耦——调度者不懂执行，执行者不看时钟。
   - README 引语【二】：「生产者（调度线程）、交付者（queue processor）和消费者（agent_loop）通过 `cron_queue`、`cron_lock`、`agent_lock` 解耦。」
   - 锚点【一】：五个全局态 `code.py:360-364`；`code.py:545 consume_cron_queue`（持锁快照+清空）；`code.py:553 has_cron_queue`。

10. **queue_processor_loop：空闲时自动交付**：每 0.2s 轮询一次；队列非空且能用非阻塞方式拿到 `agent_lock`（即 Agent 空闲）时，拿锁后再查一次队列（double-check，防拿锁间隙队列被消费），然后拉起一轮 `run_agent_turn_locked()`，finally 释放锁。
    - README 引语【二】：「queue processor 不检查时间，只负责在队列有任务且 Agent 空闲时拉起一轮执行」；「教学版实现的是最小 queue processor：用 `agent_lock` 判断 Agent 是否空闲，空闲时自动交付定时任务。真实 CC 的 `useQueueProcessor.ts` 还会处理 UI 阻塞、队列优先级和不同消息模式。」
    - 锚点【一】：`code.py:773 def queue_processor_loop`（`sleep(0.2)` 于 777；非阻塞 `agent_lock.acquire(blocking=False)` 于 780；拿锁后复查于 783；`finally: agent_lock.release()` 于 787-788）；主线程 REPL 同样以 `with agent_lock:` 串行化（`code.py:803-804`）。

11. **Consumer 注入 `[Scheduled]` 消息**：agent_loop 每轮先 `consume_cron_queue()`，把已触发 job 的 prompt 以 `[Scheduled] ` 前缀追加为 user 消息——对 LLM 而言，定时任务与用户发言汇入同一 messages 流。
    - README 引语【二】：「agent_loop 也不负责检查时间，它只从 `cron_queue` 里拿已触发的任务，注入到 messages 里」；注入代码 `messages.append({"role": "user", "content": f"[Scheduled] {job.prompt}"})`。
    - 锚点【一】：`code.py:690-694`（consume + 注入 + `[inject cron]` 日志）；`code.py:681-684` 注释「cron_scheduler_loop produces work; queue_processor_loop wakes this loop…」。

12. **Durable vs Session-only 持久化**：durable job 的定义写进工作目录 `.scheduled_tasks.json`，重启后 `load_durable_jobs()` 恢复；session-only 只在内存、关进程即失。**durable 只保留「任务定义」，不保留「错过即补跑」**——进程关闭调度也停，重启后调度器只会触发「当下该触发」的任务。
    - README 引语【二】：「- **Durable**：任务定义写进 `.scheduled_tasks.json`。Agent 重启后加载文件，恢复任务。 - **Session-only**：只在内存里。Agent 关闭就没了。」；边界原话：「cron 调度器必须在 Agent 进程内跑。进程关闭，调度也停。Durable 只意味着任务定义跨重启保留，下次 Agent 启动时调度器才会发现"该触发了"并触发。如果需要"即使应用关闭也能定时跑"，请用系统 crontab 或 systemd timer。」
    - 锚点【一】：`code.py:348 DURABLE_PATH = WORKDIR / ".scheduled_tasks.json"`、`code.py:462 save_durable_jobs`（只序列化 durable 的）、`code.py:468 load_durable_jobs`（整体 `except Exception: pass` 静默吞异常，`code.py:484-485`——课程未展开此取舍）。

13. **三个 cron 工具（8 → 11）**：模型侧新增 `schedule_cron`（注册，参数 cron/prompt/recurring/durable）、`list_crons`（列出，标注 recurring/one-shot 与 durable/session）、`cancel_cron`（按 id 取消）；系统提示 tools 段同步枚举全部 11 个工具名。
    - README 引语【二】：「工具 | 8 (s12/s13) | + schedule_cron, list_crons, cancel_cron (11)」。
    - 锚点【一】：工具定义 `code.py:640-661`（TOOLS 数组 `code.py:595-662` 共 11 条）；执行器 `code.py:567 run_schedule_cron`、`code.py:575 run_list_crons`、`code.py:589 run_cancel_cron`；注册/取消内核 `code.py:488 schedule_job`、`code.py:507 cancel_job`；prompt 枚举 `code.py:147-149`。

**防护与竞态（本章风险面）【一】**：坏 cron 表达式三层防护（注册前 validate_cron + 磁盘加载跳过非法（`code.py:476-479` 打印 `[cron] skipping invalid job` 后 continue）+ 运行期 per-job try/except（`code.py:530-542`））；调度与执行竞态防护（queue processor 拿锁后二次检查 `has_cron_queue()`（`code.py:783`）防空转一轮；调度线程遍历拷贝 `code.py:529` 允许循环内安全 pop 一次性任务）。

**「合起来跑」四步叙事【二】**（README 原文，可作分镜骨架）：

```
1. 启动时：load_durable_jobs() → 从 .scheduled_tasks.json 恢复持久化任务；调度线程开始轮询；队列处理器等待交付
2. 注册任务：schedule_cron(cron="*/2 * * * *", prompt="run date", durable=True) → CronJob 写入 scheduled_jobs + .scheduled_tasks.json
3. 每 2 分钟：调度线程检查 → cron_matches 返回 True → cron_queue.append(job) → queue processor 发现 Agent 空闲 → agent_loop consume_cron_queue → 注入 "[Scheduled] run date" → LLM 收到消息，执行 date 命令
4. 关闭进程：调度线程跟着停（daemon=True）；.scheduled_tasks.json 还在磁盘上；下次启动 → load_durable_jobs → 任务恢复
```

**手动 vs 定时对照表【二】**（README 原文）：

| | 手动触发 (s13) | 定时触发 (s14) |
|---|---|---|
| 触发者 | 用户输入 | 调度线程 |
| 触发时机 | 随时 | cron 表达式指定 |
| 需要人参与 | 是 | 否（调度器自动入队，空闲时自动交付） |
| 持久性 | — | durable 跨重启 |

### 生产版对照【三】

> 取证笔记 §4 的九条转抄。README `<details>` 节声明的归属句模板：「以下基于 CC 源码 `CronCreateTool.ts`、`cronScheduler.ts`、`cron.ts`、`cronTasks.ts`、`cronTasksLock.ts`、`useScheduledTasks.ts`（139 行）的完整分析。」口播须带「据 learn-claude-code 对 Claude Code 源码的分析」类归属句；行号锚点只保留在本节。

1. **三个 Cron 工具与门控**（锚：`CronCreateTool.ts` 等）：「CC 暴露了三个 cron 工具给模型：`CronCreate`、`CronDelete`、`CronList`。全部由编译时门控 `feature('AGENT_TRIGGERS')` 和运行时 GrowthBook 标志 `tengu_kairos_cron` 控制。还有一个 `CLAUDE_CODE_DISABLE_CRON` 环境变量做本地覆盖。」
2. **存储：`.claude/scheduled_tasks.json`**（锚：`cronTasks.ts` / `cronTasksLock.ts`）：存储样例 `{ "tasks": [{ "id": "abc12345", "cron": "0 9 * * *", "prompt": "...", "recurring": true, "durable": true, "createdAt": 1714567890000 }] }`；「Durable 任务写磁盘；session-only 任务存于 `STATE.sessionCronTasks` 内存数组（进程重启丢失）。还有一个 `.scheduled_tasks.lock` 文件防止同项目的多个 session 重复触发。」
3. **调度器 1 秒轮询**（锚：`cronScheduler.ts`）：「`cronScheduler.ts` 每秒检查一次（`CHECK_INTERVAL_MS = 1000`）。谁持有锁谁触发文件任务；所有 session 都触发仅 session 任务。还有一个 `chokidar` 文件观察者监视 `scheduled_tasks.json` 变更。」
4. **Cron 表达式：标准 5 字段**（锚：`cron.ts`）：「分钟 小时 日 月 星期。支持 `*`、`*/N`、`N`、`N-M`、`N-M/S`、`N,M,...`。不支持 `L`、`W`、`?`。所有时间以本地时区解释。Day-of-month 和 day-of-week 同时约束时用 OR 语义。」（注意：CC 支持 `N-M/S`、教学版不支持；教学版 README 的支持列表也无 `N-M/S`——见分歧清单 #8。）
5. **抖动（防惊群效应）**（锚：`cronScheduler.ts` 文件集）：「- 重复性任务：触发延迟最多可达期间的 10%（上限 15 分钟），基于任务 ID 的确定性哈希 - 一次性任务：当触发时间落在 `:00` 或 `:30` 时，最多提前 90 秒触发 - 抖动配置可通过 GrowthBook 实时调整，60 秒刷新一次」（重复任务延迟上限与官方文档冲突——见分歧清单 #2。）
6. **自动过期**（锚：同上文件集）：「重复性任务 7 天后自动过期（可配置，上限 30 天）。过期前最后一次触发，触发后自动删除。」（「可配置、上限 30 天」为源码级单侧口径——见分歧清单 #3。）
7. **作业数上限**（锚：`CronCreateTool.ts:25`）：「`MAX_JOBS = 50`（`CronCreateTool.ts:25`）。超限时返回错误："Too many scheduled jobs (max 50). Cancel one first."」
8. **触发注入与降级 QoS**（锚：`cronScheduler.ts` 文件集）：「触发后通过 `enqueuePendingNotification()` 以 `priority: 'later'` 入队命令队列。标记 `workload: WORKLOAD_CRON`，API 在容量紧张时以更低的 QoS 为 cron 发起的请求服务。」
9. **Queue Processor：自动交付**（锚：`useQueueProcessor.ts:48-60`、`queueProcessor.ts:52-87`）：「真实 CC 通过 `useQueueProcessor.ts:48-60` 在无 query、无阻塞 UI、队列非空时自动触发处理。`queueProcessor.ts:52-87` 按队列优先级把命令交给 `handlePromptSubmit()`。教学版用 `queue_processor_loop` 保留核心行为：队列有任务且 Agent 空闲时，自动启动一轮 agent_loop。」

### 官方文档对照【官】

> 原 scheduled-actions 页已更名为 scheduled-tasks，主题从「云端定时动作」收敛为「会话内 cron 调度 + /loop」，云端调度独立成 routines / desktop-scheduled-tasks 两页。

| # | 主题 | 官方说【官】 | 课程教 | 判定 |
|---|---|---|---|---|
| 14 | 调度节奏、低优先级、轮间触发 | "The scheduler checks every second for due tasks and enqueues them at low priority. A scheduled prompt fires between your turns, not while Claude is mid-response. If Claude is busy when a task comes due, the prompt waits until the current turn ends."（scheduled-tasks） | 【三】`CHECK_INTERVAL_MS = 1000`、`priority: 'later'` 入队、queue processor 空闲交付 | 一致（逐点） |
| 15 | 三工具、50 上限、8 字符 ID | CronCreate / CronList / CronDelete 三工具；"Each scheduled task has an 8-character ID you can pass to `CronDelete`. A session can hold up to 50 scheduled tasks at once."（scheduled-tasks） | 【三】三工具、`MAX_JOBS = 50`（CronCreateTool.ts:25）、超限报错原文 | 一致 |
| 16 | 本地时区 | "All times are interpreted in your local timezone. A cron expression like `0 9 * * *` means 9am wherever you're running Claude Code, not UTC."（scheduled-tasks） | 【三】「所有时间以本地时区解释」 | 一致 |
| 17 | 表达式支持集与 DOM/DOW OR | 5 字段；wildcards / single / steps / ranges / comma lists；"Extended syntax like `L`, `W`, `?`, and name aliases such as `MON` or `JAN` is not supported."；"When both day-of-month and day-of-week are constrained, a date matches if either field matches. This follows standard vixie-cron semantics."（scheduled-tasks） | 【三】同集（含 `N-M/S` 官方列表未列，待核微差——分歧清单 #8）；教学版四形态无 `N-M/S`【一】 | 一致（含一处待核微差） |
| 18 | 抖动（jitter） | "Recurring tasks fire up to 30 minutes after the scheduled time (or up to half the interval, for tasks that run more often than hourly). An hourly job scheduled for `:00` may fire anywhere up to `:30`."；"One-shot tasks scheduled for the top or bottom of the hour fire up to 90 seconds early."；偏移由任务 ID 派生（同一任务恒同偏移）；要准点就选非 `:00`/`:30` 的分钟（如 `3 9 * * *`）（scheduled-tasks） | 【三】「期间 10%、上限 15 分钟」——重复任务延迟上限两源冲突（分歧清单 #2）；一次性 90 秒提前、ID 派生、防惊群动机一致 | 分歧（仅重复任务延迟上限） |
| 19 | 七天自动过期 | "Recurring tasks automatically expire 7 days after creation. The task fires one final time, then deletes itself. This bounds how long a forgotten loop can run."；续命方式=到期前取消重建或改用 Routines / Desktop scheduled tasks（scheduled-tasks） | 【三】7 天 + 末次触发后自删一致；「可配置、上限 30 天」官方未提（分歧清单 #3） | 一致（主体）+单侧口径 |
| 20 | 会话作用域与恢复 | "Tasks are session-scoped: they live in the current conversation and stop when you start a new one."；`--resume`/`--continue` 恢复未过期任务（Limitations 所列除外）；durable 存 `.claude/scheduled_tasks.json`（symlink 即报错；只在创建它的项目文件夹运行）；"Background Bash and monitor tasks are never restored on resume."（scheduled-tasks） | 【三】durable 写 `.claude/scheduled_tasks.json`、session-only 存 `STATE.sessionCronTasks` | 一致 + 互补（恢复规则/ symlink 拒绝官方补） |
| 21 | 不补跑、仅运行且空闲时触发 | "Tasks only fire while Claude Code is running and idle. Closing the terminal or letting the session exit stops them firing."；"No catch-up for missed fires. If a task's scheduled time passes while Claude is busy on a long-running request, it fires once when Claude becomes idle, not once per missed interval."（scheduled-tasks） | 【二】进程内调度边界 + 「用系统 crontab 或 systemd timer」 | 一致（官方把「不补跑」精确化为「空闲后补一次，非按错过次数补」；替代方案产品化为三档） |
| 22 | 禁用开关与门控 | "Set `CLAUDE_CODE_DISABLE_CRON=1` in your environment to disable the scheduler entirely. The cron tools and `/loop` become unavailable, and any already-scheduled tasks stop firing."（scheduled-tasks / env-vars） | 【三】`CLAUDE_CODE_DISABLE_CRON` 一致；`feature('AGENT_TRIGGERS')` + `tengu_kairos_cron` 双层门控官方未记载（分歧清单 #4） | 一致（env）+单侧口径（门控） |
| 23 | /loop 生态与三档调度 | `/loop` 为会话内最快捷的循环执行；省略间隔时动态选（1 分钟–1 小时自适配）；`ScheduleWakeup` + `stop: true` 停环；无重排则 20 分钟 fallback wakeup；自然语言一次性提醒；三档对照：Cloud（routines，无需开 session，最小间隔 1 小时）/ Desktop（最小间隔 1 分钟，跨重启持久）/ `/loop`（需开 session）（scheduled-tasks） | 课程世界只有「会话内 cron 调度器」一档 | 互补（重大——三档是「进程外定时」的官方答案） |
| 24 | 源码级口径对账空窗 | 官方未记载：`.scheduled_tasks.lock` 锁文件、`chokidar` 文件观察者、「持锁者触发文件任务」锁语义、`WORKLOAD_CRON` 更低 QoS（官方仅 "enqueues them at low priority" 间接对应） | 均为课程【三】 | 无法对账（非分歧；维持归属句） |

---

## 叙事素材速查（金句 / 比喻 / 数字，按证据分级）

**金句**
- *"慢操作丢后台, agent 继续处理"*（站点轨 s13 中文标语）【二】
- *"按时间表生产工作, 调度与执行解耦"*（站点轨 s14 中文标语）【二】
- "Write a short summary label... think git-commit-subject, not sentence"（CC 摘要 prompt，白话：写个短标签就行，像 git commit 标题，别写成句子）【三】
- "Run a shell command."（bash 工具 description，最朴素的一句话工具描述，`code.py:256`）【一】
- "s14: Cron Scheduler — independent daemon thread + queue processor."（s14 文件头一句话定义：独立守护线程加队列处理器，就是本章全部）【一】

**比喻**
- 洗衣机（s13 全章核心）：「你不会站在洗衣机前面干等 30 分钟。」【二】
- 闹钟（s14 开篇）：「闹钟不需要你盯着它才会响。」【二】
- s13→s14 衔接：「给 Agent 装一个闹钟。」【二】
- s14→s15 预告（团队动机）：「"重构整个后端"……一个 Agent 的注意力是有限的，这需要一个团队。」【二】

**具体数字（口播可用口径）**
- 问题面【二】：`pip install torch` 要 10 分钟；`npm run build` 要 3 分钟；洗衣机 30 分钟；读文件毫秒级；`git status` 一秒内返回。
- 教学版参数【一】（随修订漂移，口播可定性引用）：调度线程 1s 轮询、queue processor 0.2s 轮询、同步 bash 超时 120s、输出截 50000 字符、通知摘要截 200 字符、max_tokens=8000、工具数 8→11、minute_marker 格式 `"YYYY-MM-DD HH:MM"`。
- 【三】数值（须带归属句）：Haiku 摘要 ~1s vs 主模型流式 5-30s、摘要约 30 字符；看门狗 45 秒；前台默认 10 并发；CC 七种后台任务类型；`CHECK_INTERVAL_MS = 1000`、`MAX_JOBS = 50`、重复任务 7 天过期（上限 30 天）、抖动 10%/15 分钟（与官方冲突，见分歧 #2）、`:00`/`:30` 一次性任务提前 90 秒、GrowthBook 抖动配置 60 秒刷新。
- 【官】数值（产品现状口径，口播优先采用）：重复任务抖动上限 30 分钟或半间隔；一次性任务提前 90 秒；会话上限 50 个定时任务、8 字符 ID；7 天过期（固定）；5GB 输出上限；内存压力收割需闲置 ≥30 分钟（v2.1.193+）；Monitor 时限默认 5 分钟/上限 30 分钟/-p 上限 10 分钟；`-p` 后台 Bash 约 5 秒宽限终止；三档最小间隔：Cloud 1 小时 / Desktop 1 分钟 / /loop 需开 session。

**反直觉断言**
- 「线程模型：没有真正的线程」——CC 跑在 Node.js/Bun 单线程事件循环上，所谓「后台」只是「不 await」【三】。
- 通知不复用 tool_use_id：后台完成是「独立事件」，一个 tool_use 只配一个 tool_result【二】【一】。
- 后台 bash 任务没有硬性并发限制——因为它们是独立子进程【三】（官方补充：有 5GB/内存压力资源上限【官】）。
- LLM 按 token 计费，「空转就是浪费」——等待本身就是钱在烧【二】。
- durable ≠ 「关机也在跑」：存下的是任务定义，进程关了调度即停；真要关机也跑用系统 crontab 或 systemd timer【二】（官方一致【官】#21，且产品化为三档）。
- DOM 与 DOW 同时约束是 OR 不是 AND（标准 cron 冷知识）【二】【官】#17。
- 「agent_loop 也不负责检查时间」——三层里没有一层「顺便」看表：调度线程判时、处理器判闲、消费者只管注入【二】。
- 一次性任务「最多提前 90 秒触发」（CC 侧）：恰好在整点/半点响的任务反而被故意提早一点（防惊群）【三】【官】#18。

**有名字的系统/组件（画面角标候选）**
- 教学版【一】：`<task_notification>`、`bg_0001`、`background_tasks` / `background_results` / `background_lock`、`CronJob`、`cron_queue`、`cron_lock`、`agent_lock`、`_last_fired`、`scheduled_jobs`、`cron_scheduler_loop`、`queue_processor_loop`、`consume_cron_queue`、`[Scheduled]` 注入前缀、`.scheduled_tasks.json`。
- CC 侧【三】：`LocalShellTaskState`、`messageQueueManager.ts`、`enqueueTaskNotification` / `enqueuePendingNotification`、`TOOL_USE_SUMMARY_SYSTEM_PROMPT` + Haiku side-query、停滞看门狗（stagnation watchdog）、`CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`、`dream`（七种后台任务类型之一，名字自带话题性）、`CronCreate`/`CronDelete`/`CronList`、`feature('AGENT_TRIGGERS')`、`tengu_kairos_cron`、`CLAUDE_CODE_DISABLE_CRON`、`STATE.sessionCronTasks`、`.scheduled_tasks.lock`、`chokidar`、`priority: 'later'`、`WORKLOAD_CRON`、QoS、`useQueueProcessor.ts`、`queueProcessor.ts`、`handlePromptSubmit()`。

---

## 分歧清单

> 逐条：分歧点 / 各轨说法 / 处置。课程 vs 官方分歧须写明口播措辞建议——通常「课程教 X；官方文档当前说 Y」。

**A. 课程内（README vs code.py）**

1. **start_background_task 的命令取值**：README 片段写 `block.input.get("command", "")`；`code.py:349` 实为 `block.input.get("command", block.name)`。处置：以 code.py 为 SSOT【一】；不影响口播（默认分支行为一致）。

**B. 课程 vs 官方（硬分歧）**

2. **重复性 cron 任务的抖动上限（数值冲突）**：课程【三】——「触发延迟最多可达期间的 10%（上限 15 分钟）」；官方【官】——"Recurring tasks fire up to 30 minutes after the scheduled time (or up to half the interval, for tasks that run more often than hourly)"。按时任务两口径相差 5 倍（6 分钟 vs 30 分钟）；其余参数（一次性 90 秒提前、task ID 派生确定性偏移、防惊群动机）两源一致。处置：口播默认取官方口径；若提及课程数字，措辞为「课程源码分析说上限 15 分钟；官方文档当前写最多可延迟 30 分钟——同一机制，两份口径，以官方为产品现状」。

**C. 单侧口径（课程源码级有、官方文档无——引用须带归属句，不得包装成官方背书）**

3. **7 天过期「可配置、上限 30 天」**：官方只写固定 7 天 + 「到期前取消重建」的续命方式，未提可配置性。处置：7 天主体两轨并用；「可配置/30 天上限」必须带归属句。
4. **双层门控**：`feature('AGENT_TRIGGERS')`（编译时）+ GrowthBook `tengu_kairos_cron`（运行时）——官方只记载 `CLAUDE_CODE_DISABLE_CRON`（该 env var 本身两轨一致）。处置：env var 可引官方；双层门控带归属句。
5. **七种后台任务类型枚举**（含 `dream`）：官方为非穷尽枚举（"Background tasks include `run_in_background` Bash commands, Monitor watches, and background subagents."）。处置：枚举带归属句；`dream` 可作彩蛋但标注【三】。
6. **后台侧源码断言打包**：45 秒停滞看门狗、通知优先级 `next` > `later`（后台默认 `later`）、Haiku 工具使用摘要（~1s/30 字符）、Node.js/Bun 单线程「后台 = 不 await」——官方均无记载。处置：全部维持「据 learn-claude-code 对源码的分析」归属句。
7. **cron 侧源码断言打包**：`.scheduled_tasks.lock` 锁文件、`chokidar` 文件观察者、「持锁者触发文件任务」锁语义、`WORKLOAD_CRON` 降级 QoS——官方仅 "enqueues them at low priority" 间接对应。处置：同上归属句。

**D. 待核微差（不构成冲突）**

8. **cron 表达式 `N-M/S`（区间带步进）**：课程源码口径支持；官方支持列表未列该组合形态（未明示穷尽与否）。处置：口播不展开此形态；如需列出支持集，以官方列表为准或注明课程口径。

**E. 结构性互补（非分歧，重制必须补的产品面）**

9. **课程只有「会话内」一档，官方产品面更宽**：用户侧 `Ctrl+B` 后台化（tmux 双击）、超时自动转后台（120s 默认、`sleep` 豁免、报文明示）、`/tasks` 列停、TaskOutput→Read 弃用迁移、5GB 输出上限、内存压力收割、`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` 总开关、Monitor 工具产品化、PushNotification（任务完成推给人）、云 routines / Desktop 定时任务 / `/loop` 三档调度（动态间隔、ScheduleWakeup、loop.md、自然语言一次性提醒）。处置：口播须点出「官方产品面比课程宽」；三档调度正是课程「进程外定时请用系统 crontab/systemd timer」这条教学边界的官方答案。
