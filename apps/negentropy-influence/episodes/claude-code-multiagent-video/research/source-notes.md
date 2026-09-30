# 事实源：《Learn Claude Code》多 Agent 平台 7 章

> **本集口播的单一事实源**。逐字稿中每一条断言都必须能回溯到本文件的某一节。
>
> **信源双轨与修订分叉**：章节归属与双钉（本集钉 `67a9126`，站点同源修订（20 章版））只登记在系列级信源地图，本文件不重述：见 [../../../source-map/claude-code-explained.md](../../../source-map/claude-code-explained.md)。
>
> **证据分级**：【一】仓库实测（@ 67a9126，可复算）／【二】站点正文／【三】课程作者对 Claude Code 源码的分析（口播必带归属句 + 画面角标）／【官】Anthropic 官方文档（产品现状口径，域名已迁 code.claude.com）。
>
> **提取方式**：2026-09-28 五维度重调研（钉点逐章 curl 取原文）；字节归档 `research/source-archive/67a9126/`；指纹见 [sources.toml](./sources.toml)。图片纪律：站点 SVG 不下载不嵌入，只转文字规格。
>
> **两条本集特有纪律**：
> - **撞号纪律**：本集章号 s12/s15/s16/s17 与仓库 main 17 章轨撞号（s12 更与旧 12 课轨构成三轨三物），涉及时一律写「站点轨 + 章全称」，禁止裸用编号；s18/s19/s20 仅存在于站点轨，可裸用但下文仍带全称。
> - **钉点内一致性**：站点正文与钉点 README 逐字一致（信源地图口径），故【一】与【二】在本集同源；机制小节的「README 引语」同时就是站点正文原文。README 引码块与 code.py 的出入单独记入分歧清单 D8/D9。

---

## 实测总表（【一】· 2026-09-28 @ 67a9126）

| 章（站点轨） | 总行 | 非空非注释 | 工具数（口径） |
|---|---:|---:|---|
| s12《Task System》 | 378 | 299 | 8（Lead 单 Agent：3 旧 + 5 任务工具） |
| s15《Agent Teams》 | 985 | 786 | 18 条目（Lead 14 + 队友 4；去重 14） |
| s16《Team Protocols》 | 882 | 711 | 19 条目（Lead 14 + 队友 5；去重 15） |
| s17《Autonomous Agents》 | 813 | 649 | 22 条目（Lead 14 + 队友 8） |
| s18《Worktree Isolation》 | 998 | 804 | 25 条目（Lead 17 + 队友 8；去重 18） |
| s19《MCP Plugin》 | 1026 | 837 | 30 条目（Lead 18 + 队友 8 + mock MCP 4） |
| s20《Comprehensive》 | 2130 | 1717 | 内置 27（另队友 8 / subagent 5 / mock 4） |

口径：总行 = `wc -l code.py`；非空非注释 = `grep -cvE '^\s*(#|$)' code.py`（docstring 行计入）；工具数 = code.py 内工具定义条目计数（剔除参数 schema 中名为 `name` 的属性项），与各章 README 变更表逐一核对一致。README 行数与字节指纹见 [sources.toml](./sources.toml)。**数字纪律**：口播不引绝对行数/活数据；本表仅供制作与核查。

---

## 一、站点轨 s12《Task System（任务系统）》 —— 「大目标拆成小任务, 排好序, 持久化」

### 定位与标语

解决「目标太大」：项目由多个有先后次序的子目标组成（搭数据库、写 API、加测试），s05 的 TodoWrite 只是会话内存中的执行清单——表达不了依赖、跨不了会话、无法在多 Agent 间分配。本章引入任务系统：每个任务一个独立 JSON 文件，`blockedBy` 声明依赖形成任务图，五个新工具操作，跨会话靠目录还在。

- 标语原文：*"大目标拆成小任务, 排好序, 持久化"* — 文件持久化的任务图, 多 agent 协作的基础。
- Harness 层原文：**Harness 层**: 任务 — 持久化的目标, 可恢复的进度。
- code.py 文件头：`s12: Task System — file-persisted task graph with blockedBy dependencies.`
- 次序隐喻：「盖房子不能先盖屋顶再打地基。任务之间有先后。」

### 机制【一】

1. **Task 数据结构（六字段）**：每个任务是带六个字段的 dataclass，序列化为一个 JSON 文件。
   - README 引语：「每个任务是一个 JSON 文件，存于 `.tasks/` 目录」；字段 `id / subject / description / status（pending|in_progress|completed）/ owner（Agent 名，多 Agent 场景）/ blockedBy（依赖任务 ID 列表）`。
   - 锚点：`code.py:52-59 @dataclass class Task`（`code.py:57` 行内注释 `# pending | in_progress | completed`）。
2. **文件持久化（跨会话恢复）**：任务落盘为 `task_*.json`，进程死了目录还在，重启扫描即恢复。
   - README 引语：「跨会话时，`.tasks/` 目录还在，Agent 读文件就能恢复进度。」
   - 锚点：`code.py:48-49 TASKS_DIR = WORKDIR / ".tasks"`（启动即 `mkdir(exist_ok=True)`）；`code.py:80-90`（save_task / load_task / list_tasks，`glob("task_*.json")` 排序遍历）。
3. **create_task 与 ID 生成**：创建即落盘；ID 用 `timestamp + random hex`。
   - README 引语：「ID 用 `timestamp + random hex` 生成，简单但够用。CC 用顺序 ID + highwatermark 文件防止 ID 重用，是更严谨的设计。」
   - 锚点：`code.py:66-77 def create_task`（ID 模板 `f"task_{int(time.time())}_{random.randint(0, 9999):04d}"`）；工具包装 `code.py:217-222`。
4. **can_start 依赖检查（fail-closed）**：blockedBy 全部 completed 才能开始；不存在的依赖直接视为被阻塞。
   - README 引语：「`can_start` 是 `claim_task` 的前置检查：`blockedBy` 里有任何一个不是 completed，就不能认领。不存在的依赖视为 blocked，避免引用错误 ID 时崩溃。」
   - 锚点：`code.py:99-108 def can_start`（docstring：`Missing dependencies are treated as blocked.`）。
5. **claim_task 认领（owner + pending→in_progress）**：开始前先认领——写 owner、改状态；已被认领或依赖未完成则拒绝。
   - README 引语：「如果任务已被别人认领（`status != "pending"`），或者依赖没完成（`can_start` 返回 False），拒绝认领。」
   - 锚点：`code.py:111-123 def claim_task`；工具包装 `code.py:247-248`（owner 硬编码 `"agent"`）。
6. **complete_task 完成与解锁下游**：做完设 completed，同时全量扫描找出刚被解锁的 pending 任务并在返回消息里报告。
   - README 引语：「任务做完后，设为 `completed`。同时扫描所有其他任务，找出**刚刚被解锁**的下游任务」。
   - 锚点：`code.py:126-139 def complete_task`（`unblocked = [t.subject for t in list_tasks() if t.status == "pending" and t.blockedBy and can_start(t.id)]`）。
7. **get_task / list_tasks 双视图**：list 给一行摘要（状态图标 ○/●/✓ 与依赖），get 返回完整 JSON；跨会话恢复靠 get 读全量描述。
   - README 引语：「`get_task` 返回完整的任务 JSON，包括 description 和依赖细节。跨会话恢复时，Agent 需要读取完整描述才能继续工作」。
   - 锚点：`code.py:93-96`；`code.py:225-244`（run_list_tasks / run_get_task）。
8. **三态状态机（无 release 回退）**：pending →claim→ in_progress →complete→ completed，只有两个动作，无回退边。
   - README 引语：「CC 没有 `in_progress → pending` 的 release 路径。如果 teammate 终止或 shutdown，CC 会把它未完成的任务 unassign（清除 owner），并将 status 重置为 `pending`，方便其他 agent 重新认领。教学版省略了这一恢复路径。」
   - 锚点：状态字面量贯穿 `code.py:72/113/120/128/130`。
9. **工具面 3 → 8**：bash / read_file / write_file 之上新增 create_task、list_tasks、get_task、claim_task、complete_task。
   - README 引语（变更表）：「工具 | bash, read_file, write_file (3) | + create_task, list_tasks, get_task, claim_task, complete_task (8)」。
   - 锚点：`code.py:255-298 TOOLS`（8 条）、`code.py:300-305 TOOL_HANDLERS`。
10. **承接机制（本章未展开）**：safe_path 工作区围栏拒绝逃逸（`code.py:178-182`，`Path escapes workspace`）；bash 120 秒超时 + 50000 字符截断（`code.py:185-192`）；prompt 组装按 context 键缓存、上下文每轮从磁盘真实状态派生（`code.py:142-173/310-321`，自 s10 同步）。参数见本节，不进口播。

TodoWrite vs Task System 七行对比表（README·解决方案，逐字保留在取证笔记 s12 §5）：定位／存储／依赖／生命周期／分工／状态／粒度七轴，核心句「TodoWrite 是当前任务的执行清单（会话内存）；Task System 是可恢复的任务系统（`.tasks/{id}.json` + blockedBy 图 + owner/claim）」。

### 生产版对照【三】

> 归属义务：以下全部为课程作者对 Claude Code 闭源源码的分析（README `<details>「深入 CC 源码」</details>` 节，分析基础：`utils/tasks.ts`、`tools/TaskCreateTool/TaskCreateTool.ts`、`tools/TaskUpdateTool/TaskUpdateTool.ts`、`tools/TaskGetTool/TaskGetTool.ts`、`tools/TaskListTool/TaskListTool.ts`、`hooks/useTaskListWatcher.ts`）。口播引用必须带归属句与画面角标；**不得作为无归属的「产品现状」进入口播层**。

1. `utils/tasks.ts:76-89` — CC 的 TaskRecord 实际有 9 个字段（教学版只讲 5/6 个）：`id`（递增整数）、`subject`、`description`、`activeForm`（进行时态，in_progress 时在 spinner 显示）、`owner`、`status`、`blocks`（下游）、`blockedBy`（上游）、`metadata`。
2. 存储位置：`~/.claude/tasks/{taskListId}/{id}.json`，「每个任务一个文件」。
3. `utils/tasks.ts:133` — Task System 和 TodoWrite 在 CC 中**同时存在**，经 `isTodoV2Enabled()` 切换：交互式会话默认 Task（V2），非交互式/SDK 默认 TodoWrite；环境变量 `CLAUDE_CODE_ENABLE_TASKS` 可强制启用 Task。
4. Task 有 TodoWrite 没有的：文件锁并发保护、依赖强制执行、ownership、fs.watch 响应式监听、生命周期 hooks。
5. `utils/tasks.ts:541-612` — `claimTask()` 用双重锁防竞争：任务文件锁（`proper-lockfile` 锁 `{taskId}.json`，最多重试 30 次，指数退避 5-100ms）+ 列表级锁（`.lock` 文件，原子扫描该 agent 是否已有其他 open task）。锁内五步：重读任务（防 TOCTOU）→ 查已认领 → 查已完成 → 查上游未完成 → 设 owner。
6. 真实 CC 的 `claimTask` 主要解决 owner 竞争，**只设 owner 不改 status**，状态更新由 `TaskUpdate` 完成（教学版把认领与开始合成一步是简化）。
7. `.highwatermark` 文件记录曾分配过的最高任务 ID：「即使任务被删除，ID 也不会被重用。」
8. CC 的任务系统是**四个工具**：`TaskCreate`、`TaskGet`、`TaskUpdate`、`TaskList`；全部 `isConcurrencySafe: true` 且 `shouldDefer: true`（schema 不在初始 prompt 中，需 ToolSearch 后才可见）。
9. 真实 CC 的 `TaskCreate` 只接受 subject/description/activeForm/metadata，依赖关系由 `TaskUpdate` 的 `addBlocks/addBlockedBy` 维护；教学版 `create_task(blockedBy=...)` 建时声明依赖是合理简化。
10. 「任务系统与错误恢复是独立层：CC 源码中 `utils/tasks.ts` 只管 CRUD，`query.ts` 的 with_retry/RecoveryState 管错误恢复，互不耦合。」（README 正文）
11. 「CC 用顺序 ID + highwatermark 文件防止 ID 重用，是更严谨的设计。」（README 正文）
12. 「CC 没有 `in_progress → pending` 的 release 路径。teammate 终止或 shutdown 时 CC 会 unassign 并重置为 pending。」（README 正文）
13. code.py docstring 呼应：「in real CC, tasks.ts and withRetry are independent layers that compose naturally.」（`code.py:19-20`）
14. 教学版省略面（README 自陈）：DAG 环检测未实现；S11 完整错误恢复为聚焦而省略；claim 与开始合并的简化。

### 官方文档对照【官】

（轨 C = `.temp/learn-cc-lab/trackC/multiagent.md`，2026-09-28 访问；下文以「轨C #n」指其编号条目，正式 URL 均为 code.claude.com/docs/en/。）

| 官方事实 | 官方说（摘） | 课程教 | 判定 |
|---|---|---|---|
| 轨C #1 任务三态+依赖阻塞 | "Tasks have three states: pending, in progress, and completed. … a pending task with unresolved dependencies cannot be claimed until those dependencies are completed."（agent-teams §Assign and claim tasks） | 三态两动作 + 认领前三条件（pending＋can_start） | **一致** |
| 轨C #2 认领文件锁 | "Task claiming uses file locking to prevent race conditions when multiple teammates try to claim the same task simultaneously." | 教学版无锁自陈竞态；【三】称产品双重锁 | **一致**（官方口径更粗，未细分双层） |
| 轨C #3 自动解锁+状态滞后 | 依赖自动解锁（"without any action from you"）；Limitations 自陈 "Task status can lag: teammates sometimes fail to mark tasks as completed, which blocks dependent tasks" | 完成即扫描播报解锁；课程无此缺陷自陈 | **互补**（官方把「忘标完成→依赖被卡」列为已知限制） |
| 轨C #4 落盘位置与持久性 | `~/.claude/teams/{team-name}/config.json`（会话末删除）+ `~/.claude/tasks/{team-name}/`（本地持久、never uploaded、resume 保留） | `.tasks/` 目录制、跨会话重读 | **互补**（方向一致：活挂磁盘；官方补齐产品形态） |
| 轨C #5 无 Task 工具走消息 | "Agents without the Task tools coordinate through messages instead of the shared task list." | 任务板与收件格是两件底座 | **互补**（官方把消息定位为降级路径） |

---

## 二、站点轨 s15《Agent Teams（代理团队）》 —— 「一个搞不定, 组队来」

### 定位与标语

解决「单 Agent 上下文覆盖不了大任务」：重构整个后端涉及认证、数据库、路由、测试，修 API 路由时认证细节已不在上下文里。s06 的子 Agent 是临时工；本章把「一个主 Agent + 偶尔子 Agent」升级为「一个 Lead + 多个常驻队友线程」。新增三样：MessageBus（文件收件箱）、spawn_teammate_thread（队友线程）、inbox 注入（Lead 接收队友消息注入 history）。省略：完整错误恢复、记忆、技能系统、权限冒泡。

- 标语原文：*"一个搞不定, 组队来"* — 文件收件箱 + 队友线程。
- Harness 层原文：**Harness 层**: 团队 — 多 Agent 协作, 消息总线。
- 动机金句：「上下文窗口就那么大，单个 Agent 的注意力覆盖不了所有模块。」
- 分工金句：「s06 的子 Agent 是临时工，叫来干一件事就走了。但有些任务需要能通信、能协作的队友。」

s06 子 Agent vs s15 队友四轴对照（README·逐字）：生命周期（一次性用完销毁 vs 多轮——教学版限 10 轮，真实 CC 用 idle loop）／通信（只回传结论 vs 异步收件箱随时通信）／上下文（完全隔离 vs 通过消息共享）／数量（一个主 + 偶尔子 vs 一个 Lead + 多个队友）。

### 机制【一】

1. **MessageBus 文件收件箱**：每个 Agent（Lead 与队友）各一个 `.jsonl` 邮箱文件；发消息 = 往对方文件追加一行 JSON。
   - README 引语：「每个 Agent（包括 Lead 和队友）有一个 `.jsonl` 邮箱。发消息 = 往对方的文件里 append 一行 JSON。」
   - 锚点：`code.py:598 MAILBOX_DIR = WORKDIR / ".mailboxes"`、`code.py:602 class MessageBus`、`code.py:607 def send`、`code.py:635 BUS = MessageBus()`。
2. **消费式读取（read + unlink）**：读收件箱即删除文件，消息只被消费一次。
   - README 引语：「读消息 = 读文件 + 删除（消费式）」；自陈竞态：「教学版的 `read_inbox` 有 read + unlink 竞态，多线程同时读可能丢消息，对教学场景可以接受。」
   - 锚点：`code.py:618 def read_inbox`（`code.py:624 inbox.unlink()  # consume: read + delete`）。
3. **peek 非破坏性探测**：判断有无未读但不消费，供唤醒条件用。
   - README 引语：正文未展开（code.py docstring：「Non-destructive: True if the agent has unread inbox messages. The Lead's inbox poller uses this to decide whether to wake a turn without consuming the mailbox.」）。
   - 锚点：`code.py:627 def peek`。
4. **spawn_teammate_thread 队友线程**：Lead 调 spawn_teammate 工具，队友在 daemon 线程跑自己的 agent loop，独立 system prompt、messages、工具集。
   - README 引语：「队友跑在自己的 daemon 线程里，有自己的 system prompt、自己的 messages、自己的简化工具集」。
   - 锚点：`code.py:643 def spawn_teammate_thread`、`code.py:651-653`（队友 system prompt：`You are '{name}', a {role}.`）、`code.py:724 threading.Thread(target=run, daemon=True).start()`。
5. **队友简化工具集（4 件）**：bash、read_file、write_file、send_message。
   - README 引语：「队友有简化工具集：bash、read、write、send_message。教学版省略了任务和 cron，聚焦通信机制。真实 CC 的队友也有 TaskCreate、TaskUpdate 等工具，任务系统是团队共享的」。
   - 锚点：`code.py:657-682`（sub_tools + sub_handlers）。
6. **队友 10 轮上限**：固定轮数防无限循环（真实 CC 用 idle loop 常驻等消息，s16 引入）。
   - README 引语：「教学版限 10 轮：防止队友无限循环。」
   - 锚点：`code.py:684 for _ in range(10)`。
7. **完成后自动汇报**：队友跑完把最后一条 assistant 文本作为 summary 发到 Lead 收件箱。
   - README 引语：「完成后自动汇报：`BUS.send(name, "lead", summary)` 把最终结果发到 Lead 的收件箱」。
   - 锚点：`code.py:709-719`（reversed 遍历取最后一条 assistant 文本）。
8. **队友侧 inbox 注入 + 上下文窗口**：每轮先读自己收件箱，包成 `<inbox>` XML 作为 user 消息；LLM 调用只带最近 20 条、max_tokens=8000。
   - README 引语：（代码块内）`inbox = BUS.read_inbox(name)` → `content: f"<inbox>{json.dumps(inbox)}</inbox>"`。
   - 锚点：`code.py:685-688`；`code.py:691`（`messages[-20:]`）。
9. **Lead inbox 注入**：Lead 被唤醒时读收件箱，队友消息格式化为 `[Inbox]` user 消息注入 history（内容截 200 字符）。
   - README 引语：「队友发来的消息注入到 history 里，让 LLM 能看到并做出反应」。
   - 锚点：`code.py:956-961`；工具面 `code.py:740 def run_check_inbox`。
10. **统一事件队列 + 1 秒 inbox_poller 唤醒**：用户输入线程与 1 秒轮询线程向同一 event queue 投递；队友消息/后台结果不等用户输入即唤醒新 turn。
    - README 引语：正文未展开（code.py 注释：「input() and a 1s poller (teammate inbox or background results) feed one event queue (issues #291, #46)」）。
    - 锚点：`code.py:923-949`（events queue / input_reader / inbox_poller）；唤醒幂等 `code.py:965 if not parts: continue`。
11. **active_teammates 登记与重名拒绝**：全局 dict 跟踪存活队友；重名 spawn 拒绝，跑完自我移除。
    - README 引语：（变更表）「新类 — MessageBus, active_teammates dict」。
    - 锚点：`code.py:638/648-649/720`。
12. **[all teammates done] 完结播报**：所有队友完成且收件箱与后台结果排空后一次性播报；轮询不依赖队友注册表（防最后一条 result 因注册表已清空被漏检）。
    - README 引语：正文未展开。
    - 锚点：`code.py:936-938`（注释）、`code.py:979-984`。

8 步合跑时序（README，可作动画骨架）：Lead 说「一个人搞不定，组队吧」→ spawn alice（backend dev，建 schema）+ bob（frontend dev，写客户端）→ 两队友各自 LLM 调用与 bash/write → 各自 `BUS.send(name, "lead", …)` → Lead 下次循环 inbox 注入 history。「两个队友并行工作。」

### 生产版对照【三】

> 归属义务同前。分析基础：`spawnMultiAgent.ts`、`useInboxPoller.ts`（969 行）、`useSwarmPermissionPoller.ts`（330 行）、`teammateMailbox.ts`、`teamHelpers.ts`。

1. 无中央总线，直接写文件：「教学版用 `MessageBus` 类收发消息。CC 的做法更直接，每个 Agent 直接写其他 Agent 的收件箱文件。」（README:182-184）
2. 收件箱路径：`~/.claude/teams/{teamName}/inboxes/{agentName}.json`（README:186）。
3. 并发安全写入：`proper-lockfile` 文件锁（最多重试 10 次）；每个文件是一个 JSON 数组，append 时读→追加→写回（README:188）。
4. 15 种结构化消息类型（`teammateMailbox.ts`，README:190-209）：`plain text`、`idle_notification`、`permission_request`、`permission_response`、`plan_approval_request`、`plan_approval_response`、`shutdown_request`、`shutdown_approved`、`shutdown_rejected`、`task_assignment`、`team_permission_update`、`mode_set_request`、`sandbox_permission_*`（双向）、`teammate_terminated`。
5. XML 包装交付：「文本消息被包装在 `<teammate-message>` XML 标签中交付给模型。」（README:211）
6. 权限冒泡双向轮询（`permissionSync.ts`，README:213-221）五步：队友发 `permission_request` 到 Lead 收件箱 → Lead 的 `useInboxPoller`（每 1 秒）检测并路由到 `ToolUseConfirmQueue`（UI 显示审批对话框，带队友名字和颜色）→ 用户审批 → Lead 发 `permission_response` 回队友 → 队友的 `useSwarmPermissionPoller`（每 500ms）收到回复继续或拒绝。
7. 队友生命周期四阶段（`spawnTeammate()` 位于 `spawnMultiAgent.ts`，README:223-230）：**Spawn**（创建 tmux 窗格或进程内、分配颜色、写入 team config）→ **Work**（`useInboxPoller` 每 1 秒查收件箱，有消息提交新 turn）→ **Idle**（Stop hook 触发，发 `idle_notification` 给 Lead）→ **Shutdown**（Lead 发 `shutdown_request` → 队友回 `shutdown_approved` → Lead 清理）。
8. Team Config 注册表：`~/.claude/teams/{teamName}/config.json`（`teamHelpers.ts`），字段含 `agentId`（如 `researcher@my-team`）、`agentType`、`color`、`isActive`、`leadAgentId`（README:232-248）。
9. 嵌套禁止：「队友之间不能嵌套（`AgentTool.tsx:273` 明确禁止 "teammates spawning other teammates"）。」（README:250）

（正文另有三条同源 CC 对照——真实收件箱路径加文件锁、Lead 每 1 秒 poller、队友有 TaskCreate/TaskUpdate 且任务系统团队共享——与第 2/3/6 条同证据的正文版，不重复计。）

### 官方文档对照【官】

| 官方事实 | 官方说（摘） | 课程教 | 判定 |
|---|---|---|---|
| 轨C #6 实验性默认关 | "Agent teams are experimental and disabled by default. Enable them by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`"（页首 Warning） | 课程自造机制，未述产品开关态 | **互补**（产品现状关键前提：整套机制标 experimental） |
| 轨C #7 Lead 协调+独立上下文 | "One session acts as the team lead… Teammates work independently, each in its own context window, and communicate directly with each other." | Lead + 常驻队友线程 + 收件格互通 | **一致** |
| 轨C #8 无嵌套班组 | "No nested teams: teammates cannot spawn their own teammates. Only the lead can manage the team." | 教学版队友 4 工具里无 spawn；【三】`AgentTool.tsx:273` | **一致**（注意层级：副台层允许有限嵌套，见轨C #43） |
| 轨C #9 一会话一队、Lead 固定 | "a session has exactly one team"；"the main session is the lead for its lifetime. You can't promote a teammate to lead" | Lead 独占 spawn 与通信三工具（工具集边界的另一面） | **互补** |
| 轨C #10 关机走协议、可拒绝 | "The lead sends a shutdown request. The teammate can approve, exiting gracefully, or reject with an explanation." | s16 关机握手（请求→确认→关机） | **一致** + 官方补充「队友有权拒绝」 |
| 轨C #11 消息复活已停队友 | 已停队友收到消息可原地复活并恢复对话；但 `/resume` `/rewind` 不还原 in-process teammates | 教学版队友完成即汇报退出（10 轮/后续 idle+超时） | **互补**（产品持久性语义不同：复活 vs 退回任务） |
| 轨C #12 队友上下文 | "a teammate loads the same project context as a regular session: CLAUDE.md, MCP servers, and skills… The lead's conversation history does not carry over." | 队友独立 prompt/messages；MCP 仅 Lead 是教学简化（s19 自陈） | **一致**（并证 MCP 对队友可用，见 s19 节） |
| 轨C #13 队友工具表 | 定义 `tools` 限定 + 运行时追加 `SendMessage`，有 Task tools 的会话再加 `TaskCreate/TaskGet/TaskList/TaskUpdate` | s17 队友 8 工具 = 基础组 + send_message + submit_plan + 任务三件 | **一致**（结构同构；官方未提对等的 submit_plan） |
| 轨C #14 生成规则 | Agent 工具带 `name` 即成队友（非 fork、非 isolation 调用）；`-p` 非交互模式不生成队友 | Lead 调 spawn_teammate 显式生成 | **互补**（产品把「命名」内建为工具参数；队与副台是同一工具的两个档位） |
| 轨C #15 token 成本 | "Agent teams use significantly more tokens than a single session" | 课程未量化成本 | **互补** |
| 轨C #22 副台回执标注 | 副台最终报告被扫描后返回，头部标注 subagent 话语「carry no authority from you」（sub-agents §How results return） | 副台只带回一张回执、按数据处理（s20） | **一致**（代理输出视为数据不视为授权） |
| 轨C #42 命名副台可 resume | 命名使副台可被按名 resume，保留完整对话史；SendMessage 可复活已完成副台 | 副台一次性 vs 队友常驻的二分（s15 四轴表） | **分歧** → 分歧清单 D7 |
| 轨C #43 副台嵌套 | 默认三层；触顶 withhold `Agent` 工具、自己干完返回摘要 | 队友层零嵌套（工具表决定） | **互补**（同构机制「工具收走」、不同阈值） |

---

## 三、站点轨 s16《Team Protocols（团队协议）》 —— 「队友之间要有约定」

### 定位与标语

解决「从能通信到有协议」：两个同构场景——关机（直接杀线程会留下写了一半的文件）与计划审批（高风险操作应先经 Lead 审）。抽象为同一机制：「一方发请求，另一方给回复，请求和回复通过同一个 ID 关联。有状态机追踪：pending → approved / rejected」。新增三样：ProtocolState（请求状态追踪）、dispatch_message（按类型路由；实现名 handle_inbox_message，见 D9）、match_response（request_id 关联 + 类型校验）。「两种协议，一套机制」：shutdown（Lead→队友）与 plan approval（队友→Lead）。

- 标语原文：*"队友之间要有约定"* — request-response 模式驱动协商。
- Harness 层原文：**Harness 层**: 协议 — Agent 之间的结构化握手。
- 关联键金句：「`request_id` 是贯穿全链路的关联键，请求带着它出去，回复带着它回来。」
- 杀线程失败模式：「直接杀线程，Alice 写了一半的文件留在磁盘上」（s15 伏笔、本章动机）。

### 机制【一】

1. **ProtocolState 状态机**：每个协议请求一条记录（谁发、发给谁、状态、payload），pending → approved/rejected 有限状态机。
   - README 引语：「每个协议请求创建一条状态记录，记录谁发的、发给谁、当前状态、附带内容」；字段 `request_id / type（"shutdown"|"plan_approval"）/ status（pending|approved|rejected）/ payload（计划文本或关机原因）`。
   - 锚点：`code.py:371-379 @dataclass class ProtocolState`；`code.py:382 pending_requests`。
2. **request_id 关联键**：6 位零填充随机 ID（形如 `req_004281`），请求带出去、回复带回来。
   - README 引语：同上金句。
   - 锚点：`code.py:385-386 def new_request_id`（`random.randint(0, 999999):06d`）。
3. **match_response 类型校验与去重**：按 request_id 找状态 + 校验响应类型与请求类型配对 + 非 pending 的重复响应跳过。
   - README 引语：「`match_response` 不只按 `request_id` 找状态，还会校验响应类型是否匹配请求类型」；「一个 shutdown_response 不会意外 approve 一个 plan_approval 请求。」
   - 锚点：`code.py:389-413`（类型校验 397-404、重复跳过 405-408、落定 409）；未知 request_id 打印 `[protocol] unknown request_id` 后跳过（393-395）。
4. **dispatch_message 按类型路由（实现为 handle_inbox_message）**：队友 inbox 同时收普通与协议消息，按 type 分发；新增协议类型只需加 if 分支。
   - README 引语：「队友的 inbox 不只收普通消息，还收协议消息。`handle_inbox_message` 按消息类型分发」；「新增协议类型只需加新的 `if` 分支。」
   - 锚点：`code.py:451-475 def handle_inbox_message(name, msg, messages)`（返回 True 表示队友应停止）。命名出入见分歧清单 D9。
5. **consume_lead_inbox 统一消费（先路由后返回）**：check_inbox 工具与主循环末尾共用同一函数，先对 `_response` 结尾消息做 match_response 路由再返回全部消息。
   - README 引语：「先路由协议消息再返回剩余内容，避免消息被读走但协议状态没更新」。
   - 锚点：`code.py:420-435`；调用点 `code.py:670/875`；`code.py:416` 注释标「s16 fix」。
6. **队友 idle loop**：LLM 返回非 tool_use 后不退出，每秒轮询 inbox 等待——收到 shutdown_request 回响应并退出，收到新消息继续干活。
   - README 引语：「s15 的队友跑完 10 轮就退出。s16 的队友在 LLM 返回非 tool_use 后进入 idle 等待：轮询 inbox，收到 shutdown_request 就响应退出，收到新消息就继续工作。」
   - 锚点：`code.py:542-564`（`while not shutdown_requested: time.sleep(1)`）；`code.py:544` 注释「Real CC sends idle_notification to Lead here」。
7. **shutdown 协议**：Lead 侧 request_shutdown 建 pending 状态并发 shutdown_request；队友分支自动回 shutdown_response(approve=True) 并停止。
   - README 引语：协议表「shutdown_request / response | Lead → 队友 | 体面关机握手」；四步流程 ①发请求（带 req_id）→②队友 dispatch→③队友回同编号响应→④Lead match 落定。
   - 锚点：`code.py:621-632 def run_request_shutdown`；队友响应分支 `code.py:458-464`。
8. **plan approval 协议（submit_plan / request_plan / review_plan）**：队友 submit_plan 把计划作为 plan_approval_request 发 Lead（建 pending 记录）；Lead review_plan 按 request_id 批/拒（拒绝可带 feedback）；响应回队友注入 messages；request_plan 只是普通 message 要求提交（不建协议状态）。
   - README 引语：协议表「plan_approval_request / response | 队友 → Lead | 计划审批协议示例」。
   - 锚点：`code.py:598-616 _teammate_submit_plan`；`code.py:642-654 run_review_plan`；`code.py:635-639 run_request_plan`；队友接收分支 `code.py:466-473`（批准注入 `[Plan approved] Proceed with the task.`，拒绝注入 `[Plan rejected] Feedback: …`）。
9. **inbox 注入 history**：Lead 主循环每轮末把 inbox 拼成 `[Inbox]` user 消息注入；队友侧非协议消息以 `<inbox>` XML 注入。
   - README 引语：「主循环末尾还会把 inbox 消息注入到 `history`，让 LLM 能看到并做出反应。」
   - 锚点：`code.py:874-881`；队友侧 `code.py:528-531/560-563`。

**执行门控边界（本章最重要的一条自陈）**：「教学版演示了计划审批的请求-响应消息流程，没有实现执行门控（未 approved 时拦截 bash/write_file）。真实 CC 的队友有 permission gating 机制。」（README:37）code.py 印证：`_teammate_submit_plan` docstring「This is a protocol-level request, not a code-level gate. … Real enforcement relies on the model waiting for the approval response before acting.」（`code.py:601-607`）。→ s20 把它升级为真门（见第七节机制 8）。

### 生产版对照【三】

> 归属义务同前。分析基础：`teammateMailbox.ts`（1184 行）、`SendMessageTool.ts`、`useInboxPoller.ts`、`ExitPlanModeV2Tool.ts`。

1. 「CC 的团队协议实现（`teammateMailbox.ts`，1184 行）和教学版在核心结构上一致：request_id + approve/reject 的请求-响应模式。」（README:229）
2. `teammateMailbox.ts:720-763` — 真实源码拆成 `shutdown_approved` 和 `shutdown_rejected` 两种独立消息类型（README:89）。
3. 「CC 的 shutdown 是三向通信（`teammateMailbox.ts:720-763`、`SendMessageTool.ts:268-430`）」（README:231）——request → approved/rejected → `teammate_terminated` 通知所有相关方。
4. `useInboxPoller.ts:677-800` — 「关机确认后系统自动清理 pane（tmux/iTerm2）、unassign 任务、从 team config 移除成员」（README:231）。
5. `ExitPlanModeV2Tool.ts:263-312` — plan approval request 由该工具在 plan-mode-required 队友退出 plan mode 时产生（README:233）。
6. `useInboxPoller.ts:599-661` — 「当前会自动回写 approval，并把请求交给 Lead 作为上下文（regular message）」（README:233）。
7. `SendMessageTool.ts:434-518` — 「仍保留显式 approve/reject response 能力，审批时可同时设置 `permissionMode`（如"批准但以 plan mode 运行"），响应中可包含 `feedback` 字符串供队友修正后重新提交。不是简单的"Lead 手动 review_plan 工具"流程。」（README:233）
8. `teammateMailbox.ts:453-462` — 「字段名也不统一：permission 用 `request_id`」（README:235）；同段：「CC 的协议消息是结构化的 JSON（有 Zod schema 验证），教学版用简单的 type + metadata 字典」。
9. `teammateMailbox.ts:684-763` — 「shutdown 和 plan approval 用 `requestId`」（README:235）。
10. 整体性断言（无行号）：「教学版的一个 FSM（pending → approved | rejected）对应两种协议，这个简化完全正确。CC 的所有协议消息共用同一个 request id 关联机制。」（README:239）

### 官方文档对照【官】

| 官方事实 | 官方说（摘） | 课程教 | 判定 |
|---|---|---|---|
| 轨C #16 邮箱文件+坏条目剔除 | "Each agent's mailbox is a JSON file at `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`… validates every entry when it reads… bad entries removed, valid messages still delivered" | 一人一格 JSONL、append/读取整理 | **一致（方向）+互补（容错细节）**；「读后删格」官方未述 |
| 轨C #17 写成功才算送达 | "reports a message as sent only when the write to the recipient's mailbox file succeeds, whether… plain text or a structured protocol message" | 协议与普通消息同走收件格、先路由后返回 | **一致** |
| 轨C #18 自动投递 | "delivered automatically to recipients. The lead doesn't need to poll for updates." | 模型不轮询；注入由宿主侧 poller/循环完成 | **一致** |
| 轨C #19 空闲通知内含答案 | "it automatically notifies the lead and includes its final answer in the notification"；API 错误时通知失败附错误文本 | 教学版完成后只发一条 result summary；idle_notification 是【三】产品机制、教学版省略 | **分歧** → D5 |
| 轨C #20 来源标注+不可代批 | 收方被告知消息来自另一 Claude 会话；队友不能代用户批权限；被拒动作不得经队友转手绕过 | match_response 验编号+类型+pending（无身份校验） | **一致**（官方更广） |
| 轨C #21 auto 模式投递前审查 | 审批声明视为不可信输入；每条智能体间消息（含协议消息）投递前审查，被拦不达收件人 | 教学版无投递前审查层 | **互补** |
| 轨C #39 队友计划审批自动批 | "Claude Code approves the plan in the lead's session as soon as the request arrives, without the lead reviewing it"；修改型动作走权限提示 | 计划审批是协议核心（s16 流程 + s20 真门） | **分歧** → D3 |
| 轨C #40 权限冒泡 | "Teammate permission prompts appear in the lead session, so approve them there yourself"；权限模式继承（dontAsk 除外） | 教学版省略冒泡；【三】五步冒泡分析 | **分歧**（教学实现 vs 产品）→ D4 |
| 轨C #41 质量门挂 hooks | `TeammateIdle` / `TaskCreated` / `TaskCompleted`，exit 2 可阻止并发反馈 | 教学版无 hooks；s20 权限是 PreToolUse hook | **互补**（门是真的，挂点不同；hook 制避名单制弱点） |

---

## 四、站点轨 s17《Autonomous Agents（自治代理）》 —— 「自己看板，自己认领」

### 定位与标语

解决「Lead 手动派活不可扩展」：「如果任务看板上有 10 个未认领任务，Lead 得手动 assign 10 次。这不能扩展。」队友从「等派活」升级为「自己看任务看板，发现没人做的任务就认领，做完再找下一个」。新增三机制：idle_poll（空闲每 5 秒轮询）、scan_unclaimed_tasks（扫可认领任务）、自动认领。队友生命周期两阶段扩为 WORK → IDLE → SHUTDOWN。章末以 Alice/Bob 同改 `config.py` 互覆盖引出 s18。

- 标语原文：*"自己看板，自己认领"* — 空闲时轮询，有活就干。
- Harness 层原文：**Harness 层**: 自治 — 队友自组织，不依赖 Lead 分配。
- 依赖语义金句：「有依赖不代表不能做，只有被未完成的任务阻塞才不能做。」
- 双通道反直觉：「所以"队友不主动轮询任务"不准确，CC 同时有被动通知和主动认领。」

### 机制【一】

1. **idle_poll（空闲轮询）**：IDLE 阶段每 5 秒轮询一次，inbox 优先（可能含 shutdown_request 等协议消息）、任务板其次；返回 work / shutdown / timeout 三态；12 次 × 5s = 60s 超时。
   - README 引语：「**idle_poll**（空闲时每 5 秒轮询一次）」「IDLE | 每 5s 轮询 inbox + 任务板 | 60s 超时」。
   - 锚点：`code.py:288-289 IDLE_POLL_INTERVAL = 5 / IDLE_TIMEOUT = 60`；`code.py:304 def idle_poll`；shutdown 分发 `code.py:313-321`；auto-claim 分支 `code.py:330-342`。
2. **scan_unclaimed_tasks（三条件合取）**：pending + 无 owner + 依赖全部已完成（can_start）；教学版按文件名排序取第一个。
   - README 引语：「三个条件：必须是 pending、没有 owner、所有 blockedBy 依赖已完成。」「教学版按文件名排序取第一个；CC 用文件锁防止多个队友同时认领同一个任务。」
   - 锚点：`code.py:292 def scan_unclaimed_tasks`（`code.py:297-299`）。
3. **claim_task（owner 检查 + 返回值验证）**：认领前查状态/owner/依赖；自动认领处检查返回串含 "Claimed" 才注入上下文——失败不当成功。
   - README 引语：「自动认领时检查 claim 结果，不把失败当成功」「教学版没有文件锁，并发认领可能出现竞争。但至少 `task.owner` 检查避免了最明显的"后写覆盖"问题。」
   - 锚点：`code.py:104 def claim_task`（owner 检查 108-109、阻塞明细 110-117）；`code.py:334 if "Claimed" in result:`。
4. **WORK → IDLE → SHUTDOWN 三阶段**：外层 while True 交替 WORK/IDLE；内层 for 10 轮限制单次 WORK 的 LLM 调用；shutdown 两阶段都能响应；退出后发 summary 给 Lead。
   - README 引语：「**外层 while True**：WORK 和 IDLE 交替进行，直到超时或收到关机请求」「**内层 for 10**：WORK 阶段最多 10 轮 LLM 调用（防止无限循环）」。
   - 锚点：`code.py:451-452`；`code.py:461`；IDLE 分发 `code.py:499-504`；summary `code.py:517`。
5. **身份重注入（identity re-injection）**：autoCompact 后 messages 过短（≤3）时，进入新 WORK 阶段前重插身份块。
   - README 引语：「消息过短说明发生了压缩，此时重新注入身份信息。真实 CC 中 context compaction 会保留 system prompt，教学版的简化实现需要手动处理。」
   - 锚点：`code.py:453-457`（`<identity>You are '{name}', role: {role}.`）。
6. **consume_lead_inbox（沿用 s16）**：先路由协议 response 再注入 Lead 历史，使 summary/result 进入 Lead 的 LLM 视野。
   - README 引语：「队友发来的 summary/result 不会只打印在终端，Lead 的 LLM 能看到并协调下一步。」
   - 锚点：`code.py:620/633/806`；`code.py:265 def match_response`。
7. **can_start（依赖解锁语义）**：blockedBy 每个依赖存在且 completed 才放行；缺失依赖也返回 False。
   - README 引语：见定位金句。
   - 锚点：`code.py:94 def can_start`（`code.py:97-98`）。
8. **complete_task 的解锁通知**：完成后扫描看板列出被解锁的 pending 任务附在返回消息（README 未单列，代码可见）。
   - 锚点：`code.py:125 def complete_task`；`code.py:131-137`（`Unblocked: …`）。
9. **队友工具 5 → 8（Lead 14 不变）**：+list_tasks / claim_task / complete_task，队友具备自主看板能力。
   - README 引语：「队友工具 | 5 | 8（+ list_tasks, claim_task, complete_task）」「Lead 工具 | 14 | 14（不变）」。
   - 锚点：`code.py:385-425 sub_tools`（注释 `# s17 new: teammates can list, claim, and complete tasks`）；队友 system prompt 明示「You can list and claim tasks from the board.」（`code.py:354-357`）。

演示剧本（README「合起来跑」18 步节选）：Lead 建 3 个任务（schema / API 路由 / 单元测试）→ spawn alice、bob → alice 认领 schema、bob 认领 API → alice 做完再认领单元测试 → 双双 60s 超时关机 → Lead 收两份 summary。「两个队友并行认领、并行工作。Lead 只需要创建任务和启动队友，不需要手动分配。」

### 生产版对照【三】

> 归属义务同前。分析基础：`inProcessRunner.ts`、`hooks/useTaskListWatcher.ts`、`utils/tasks.ts`。节首教学声明（归属句素材）：「本章的 idle_poll + auto-claim 机制是教学设计，用统一的轮询函数演示"空闲后找活干"。CC 的实际实现是多个机制的组合，但目标一致——减少 Lead 的手动分配负担。」

1. `inProcessRunner.ts:569-589` — `sendIdleNotification()`：队友完成一轮后向 Lead 发空闲通知，「Lead 知道队友可用了，可以分配新任务或请求关机」。
2. `inProcessRunner.ts:689-868` — `waitForNextPromptOrShutdown()` 是「**500ms 轮询循环**，持续检查三类来源：pending user messages、mailbox 文件消息、task list」。
3. `inProcessRunner.ts:768-804` — shutdown_request 在该轮询中被优先处理，「不会被普通消息饿死」。
4. `hooks/useTaskListWatcher.ts:34-189` — `useTaskListWatcher` 用 `fs.watch()` 监听 `.claude/tasks/`，「1 秒 debounce，当新任务创建或依赖解锁时触发检查」。
5. `useTaskListWatcher.ts L197-207` — 依赖判断「是"blockedBy 中没有未完成的任务"，不是"blockedBy 为空"」。
6. `inProcessRunner.ts:853-860` — `tryClaimNextTask()`：「轮询循环内部也会调用」——「在等待期间主动从任务 list 领取任务」；并断言「所以"队友不主动轮询任务"不准确，CC 同时有被动通知和主动认领」。
7. `utils/tasks.ts:541-612` — `claimTask()` 用 `proper-lockfile` 任务文件锁「在锁内完成读-检查-改-写」；检查项：owner 已存在（L575-576）、已完成（L580-581）、blockedBy 未完成（L585-594）。
8. `utils/tasks.ts:614-692` — `claimTaskWithBusyCheck()` 用 task-list 级别锁，「把 busy check 和 claim 做成原子操作，避免 TOCTOU」。
9. `inProcessRunner.ts:595-604` — `findAvailableTask()` 依赖判断为「所有 blockedBy 已完成」，实现 `task.blockedBy.every(id => !unresolvedTaskIds.has(id))`。
10. `inProcessRunner.ts:624-657` — `tryClaimNextTask()`「在认领后把状态更新为 `in_progress`，让 UI 立即反映变化」。

### 官方文档对照【官】

| 官方事实 | 官方说（摘） | 课程教 | 判定 |
|---|---|---|---|
| 轨C #23 干完自领下一张 | "after finishing a task, a teammate picks up the next unassigned, unblocked task on its own" | 三条件合取（pending+无主+依赖全完） | **一致**（官方两判据是课程三条件的子集） |

交叉参照：任务状态滞后（轨C #3，见第一节）直接影响自治认领的活性——官方自陈「队友忘标完成 → 依赖方被卡」；队友持久性（轨C #11）与教学版「60s 超时自动关机」是两种收敛方向（教学版反而比产品更激进地自动退出，README 自陈「无固定超时，Lead 手动 shutdown」为产品侧）。

---

## 五、s18《Worktree Isolation（工作树隔离）》 —— 「各干各的目录, 互不干扰」

### 定位与标语

解决「在哪干」：三分法递进——「s15-s17 解决了『谁干什么』（任务系统）和『怎么通信』（消息总线），但没解决『在哪干』。」Alice（重构认证）与 Bob（重构 UI 登录页）同在 WORKDIR 双写 `config.py` 互相覆盖，「无法干净地回滚——分不清哪些改动是谁的」。用 git worktree 补上：同一仓库开出多个独立工作目录，各挂分支，任务与目录按 ID 绑定。

- 标语原文：*"各干各的目录, 互不干扰"* — 任务管目标, worktree 管目录, 按 ID 绑定。
- Harness 层原文：**Harness 层**: 隔离 — 并行执行的目录隔离。
- 拓扑（code.py 文件头）：Main repo 下 `.worktrees/auth/`（branch: wt/auth）← Task #1、`.worktrees/ui/`（wt/ui）← Task #2、`.tasks/task_xxx.json`（worktree: "auth"）、`.worktrees/events.jsonl`。

### 机制【一】

1. **create_worktree**：git worktree add 建独立目录 + 分支；已存在同名则拒绝。
   - README 引语：「Git worktree 让你在同一仓库中创建多个独立的工作目录，每个有自己的分支。Alice 在 `.worktrees/auth-refactor/` 下工作，Bob 在 `.worktrees/ui-login/` 下工作——互不干扰。」
   - 锚点：`code.py:189 def create_worktree`；`code.py:197`（`run_git(["worktree", "add", str(path), "-b", f"wt/{name}", "HEAD"])`）。
2. **bind_task_to_worktree**：只写 Task 的 worktree 字段，不改状态。
   - README 引语：「绑定规则：一个任务绑定一个 worktree。绑定不改任务状态——任务仍是 `pending`，队友自动认领时才推进到 `in_progress`。这样 Lead 可以提前创建任务和 worktree，队友 idle 时自然认领带 worktree 的任务。」
   - 锚点：`code.py:207 def bind_task_to_worktree`；Task 新字段 `code.py:65 worktree: str | None = None`。
3. **队友工具 cwd 切换（wt_ctx）**：认领带 worktree 的任务时，bash/read_file/write_file 自动在该目录下执行；完成后重置回共享 WORKDIR。
   - README 引语：「这是教学简化。真实 CC 的 EnterWorktree 用 `process.chdir()` 切换整个进程目录，AgentTool isolation 用 `cwdOverride` 包住子 agent 执行。」
   - 锚点：`code.py:523 wt_ctx`；`code.py:547 _run_claim_task`；`code.py:529-536`（三个工具传 `cwd=_wt_cwd()`）；`code.py:558 _run_complete_task` 重置。
4. **remove_worktree**：有未提交改动默认拒绝，需 `discard_changes=true` 强制；不自动完成任务；强删连分支一起删（`git worktree remove --force` + `git branch -D`）。
   - README 引语：「Remove = 有改动时默认拒绝，需要 `discard_changes=true` 确认。不自动 complete task——任务完成由队友的 `complete_task` 显式触发。」
   - 锚点：`code.py:229 def remove_worktree`；拒绝分支 `code.py:242-246`；`code.py:247/250`。
5. **keep_worktree**：保留目录与分支，等人工 review 后合并。
   - README 引语：「Keep = 留着分支，等人工 review 后合并到主分支。」
   - 锚点：`code.py:256 def keep_worktree`。
6. **validate_worktree_name**：拒绝路径穿越与非法字符，只允许 `[A-Za-z0-9._-]{1,64}`（拒空名、`.`/`..`）。
   - README 引语：「validate_worktree_name 拒绝路径穿越和非法字符」「只允许 [A-Za-z0-9._-]{1,64}」。
   - 锚点：`code.py:153 VALID_WT_NAME`；`code.py:156 def validate_worktree_name`。
7. **事件日志 log_event**：create/remove/keep 追加写 `events.jsonl` 供审计；只在 git 命令成功后写。
   - README 引语：「每次生命周期操作写入日志，方便排查」；「教学版只记录事件用于人工排查；完整恢复还需要 index 或 `git worktree list` 扫描。」
   - 锚点：`code.py:180 def log_event`；`code.py:168 def run_git`（成功才写事件）。
8. **run_git 封装**：返回 `(ok, output)`；30 秒超时、输出截 5000 字符。
   - 锚点：`code.py:168-176`。
9. **_count_worktree_changes（fail-safe）**：删除前清点未提交文件数（`git status --porcelain`）与未推送提交数（`git log @{push}..HEAD`）；查不出（-1,-1）同样拒绝。
   - 锚点：`code.py:215 def _count_worktree_changes`；`code.py:239-241` 拒绝分支。
10. **工具面 Lead 14 → 17**：+create_worktree / remove_worktree / keep_worktree；队友 8 不变（bash/read/write 在 worktree cwd 执行）。
    - README 引语（变更表）：「Lead 工具 | 14 (s17) | + create_worktree, remove_worktree, keep_worktree (17)」。
    - 锚点：`code.py:812-906 TOOLS`；队友 sub_tools `code.py:564-603`。
11. **认领注入工作目录提示 + 看板标注**：idle 自动认领带 worktree 任务时注入 `Work directory: {path}`；list_tasks 对绑定任务追加 `(wt:名称)`。
    - 锚点：`code.py:470-476`；`code.py:544/772`。

观察重点四连（README）：两个 worktree 的 `git status` 是否不同分支？认领后 bash 是否在 worktree 目录执行？remove 对有改动的 worktree 是否拒绝？绑定后任务是否仍 pending？

### 生产版对照【三】

> 归属义务同前。总纲断言：「CC 的 worktree 系统有两条路径：**EnterWorktree**（当前会话切入）和 **AgentTool isolation**（子 agent 隔离）。」「CC 没有 task-worktree 绑定。……CC 把 worktree 和 task 作为两个独立系统，通过 Agent 理解上下文来关联。」

1. `EnterWorktreeTool.ts:92-97` — 创建后立即 `process.chdir(worktreePath)`、`setCwd()`、`setOriginalCwd()`、`saveWorktreeState()`：「当前会话的工作目录直接切换到 worktree——不是 prompt 提醒，而是进程级目录变更。」
2. `ExitWorktreeTool.ts:261-320` — keep/remove 都会 `restoreSessionToOriginalCwd()` 恢复原目录。
3. `ExitWorktreeTool.ts:190-220` — Remove 时检查未提交改动，「没有 `discard_changes: true` 就拒绝删除」。
4. `AgentTool.tsx:590-641` — `isolation: "worktree"` 时调用 `createAgentWorktree()`，用 `cwdOverridePath` 包住子 agent 执行：「子 agent 的所有操作自动在 worktree 目录下进行。」
5. `AgentTool/prompt.ts:272` — 告诉模型：这是临时 worktree，无改动自动清理，有改动返回路径和分支。
6. `worktree.ts:902-951` — `createAgentWorktree()` 不修改全局 session cwd，只给子 agent 用。
7. `worktree.ts:961-1020` — `removeAgentWorktree()` 从主 repo root 删除。
8. `worktree.ts:76-84` — 校验 slug：拒绝 `.`/`..`，允许 `[a-zA-Z0-9._-]`。
9. `worktree.ts:48` — 定义 `VALID_WORKTREE_SLUG_SEGMENT`：「教学版的 `validate_worktree_name` 用同样的规则。」
10. `worktree.ts:204-227` — 真实路径是 `.claude/worktrees/`，分支名 `worktree-{slug}`（斜杠用 `+` 替代）；「教学版用 `.worktrees/` 和 `wt/{name}` 简化。」
11. `worktree.ts:326-328` — 创建时用 `git worktree add -B`，优先基于 `origin/<defaultBranch>` 而非当前 HEAD。
12. `worktree.ts:756-768` — `PersistedWorktreeSession` 字段含 `originalCwd / worktreePath / worktreeName / worktreeBranch / originalBranch / originalHeadCommit / sessionId` 等——**没有 taskId**（「CC 没有 task-worktree 绑定」的源码佐证）。
13. `sessionStorage.ts:2883-2920` — `saveWorktreeState()` 以 `type: 'worktree-state'` 写入 session transcript。
14. 总纲：两条路径 + 无 task-worktree 绑定（两个系统靠 Agent 理解上下文关联）。

### 官方文档对照【官】

| 官方事实 | 官方说（摘） | 课程教 | 判定 |
|---|---|---|---|
| 轨C #24 worktrees 与 teams 解耦 | worktrees 页定位 "Manual parallel sessions… without automated team coordination"；agent-teams 页通篇不提 worktree | worktree 是队友机制组件（任务绑定+cwd 切换） | **分歧** → D1 |
| 轨C #25 隔离四项硬阻断 | 编辑/命令工作目录/git 重定向/命令形状四检查，"You can't turn this check off" | 教学版目录级切换（wt_ctx+safe_path）；【三】chdir/cwdOverride 亦为目录层 | **分歧** → D2 |
| 轨C #26 subagent `isolation: worktree` | "temporary git worktree… branched by default from your default branch rather than the parent session's `HEAD`"；无改动自动清理 | 【三】cwdOverride 路径的文档化；【三】默认分支分叉同口径 | **互补（一致方向的文档化）** |
| 轨C #27 清理纪律 | 干净（未命名会话）自动删**含分支**；有活必问 keep/remove；sweep 只删自己造的（marker）+ 运行中持 `git worktree lock` | keep 留分支；discard 强删连分支（`git branch -D`） | **部分一致＋分歧** → D6 |
| 轨C #28 采纳前核验+跳过 filter driver | 目录 git 身份不可核验即拒绝采纳；不信任仓内 filter driver（shell 命令） | 名字白名单 + fail-safe 清点（查不出即拒删） | **一致**（精神同源，落点不同） |
| 轨C #29 EnterWorktree 越界必问 | 出 `.claude/worktrees/` 必批准；权限规则不能抑制，仅 bypassPermissions 跳过 | 课程未覆盖（教学版无此边界） | **互补** |
| 轨C #30 任务—worktree 绑定零记载 | agent-teams 与 worktrees 两页均无绑定记载；创建/清理以会话与 subagent 为单位 | 课程自陈绑定是教学简化；【三】产品无绑定 | **一致（负证据佐证）** |
| 轨C #31 权限批准写回主 checkout | "Yes, and don't ask again" 规则存主 checkout `.claude/settings.local.json`，跨 worktree 生效、目录删了规则还在 | 课程未覆盖 | **互补** |

---

## 六、s19《MCP Plugin（插件）》 —— 「外接工具, 标准协议」

### 定位与标语

解决「工具的外部供给」：s01–s18 所有工具都是手写的，每接一个外部服务（Jira、自建部署系统、Notion）就要重写一套验证/执行/错误处理。引入 MCP 作为标准协议：「你需要一个标准协议——外部服务只要实现它，Agent 就能直接调用，不管服务用什么语言写的。」倒数第二章；下一章 s20 把十二类机制「合回一个完整 harness。机制很多，循环一个」。

- 标语原文：*"外接工具, 标准协议"* — 发现、组装、调用，Agent 不需要知道工具是谁写的。
- Harness 层原文：**Harness 层**: 插件 — 外部能力通过标准协议接入。

### 机制【一】

1. **MCPClient（tools/list + tools/call 的教学模拟）**：注册工具定义与处理器，按名调用——分别模拟协议的「发现」与「调用」两原语。
   - README 引语：「教学版用 Python 函数模拟 server 的工具实现。真实版通过 stdio JSON-RPC 与子进程通信。」
   - 锚点：`code.py:660 class MCPClient`；`code.py:668 def register`；`code.py:673 def call_tool`。（R2 证伪修正：两方法在钉点 code.py 中**无 docstring**，"Simulates tools/list discovery."/"Simulates tools/call." 出自 README:54/59 的示例码块，且该块与实现有签名/异常处理差异——已补登分歧清单 D19。）
2. **MOCK_SERVERS 双 mock server**：docs（search、get_version）与 deploy（trigger、status）两个工厂函数；运行时不依赖真实服务。
   - README 引语：「教学版用 mock handler 模拟外部 server。真实版会启动子进程，通过 stdin/stdout 发送 JSON-RPC 请求。」
   - 锚点：`code.py:693/712/733 MOCK_SERVERS`。
3. **connect_mcp（连接+发现）**：Lead 第 18 个内置工具；幂等（重复连接报 already connected）；未知 server 返回可用列表。
   - README 引语：「连接后，server 提供的工具立即可用。」
   - 锚点：`code.py:739-751`。
4. **normalize_mcp_name**：非 `[a-zA-Z0-9_-]` 字符替换为 `_`，防命名冲突与注入。
   - README 引语：「所有非 `[a-zA-Z0-9_-]` 的字符替换为 `_`。防止 server 名或工具名中包含特殊字符导致命名冲突或注入问题。」
   - 锚点：`code.py:685-690`。
5. **mcp\_\_server\_\_tool 命名空间**：入池时统一加前缀（两级名称均先规范化），不同 server 同名工具互不冲突；系统提示同步告知模型。
   - README 引语：「前缀 `mcp__{server}__{tool}` 避免不同 server 的工具名冲突。」
   - 锚点：`code.py:762 prefixed = f"mcp__{safe_server}__{safe_tool}"`；`code.py:255`。
6. **assemble_tool_pool（动态组装+闭包晚绑定）**：把内置工具与所有已连 server 工具拼成一个池；MCP handler 用默认参数闭包捕获当前 client 与原始工具名。
   - README 引语（实现引语）：`handlers[prefixed] = (lambda *, c=mcp_client, t=tool_def["name"], **kw: c.call_tool(t, kw))`。
   - 锚点：`code.py:754 def assemble_tool_pool`；`code.py:768-769`。
7. **动态重建 + 主动去 prompt 缓存**：s10 起的 prompt cache 整体去掉；检测到本轮调用了 connect_mcp 即重建工具池与 system prompt（动态追加 "Connected MCP servers: …"）。
   - README 引语：「原因：`connect_mcp` 之后工具池变化了……缓存中的工具列表是旧的，继续用会导致模型调用不到新工具。教学版直接去掉缓存，代价是多花一点序列化时间。」
   - 锚点：`code.py:962-963`；`code.py:991-995`。
8. **(readOnly)/(destructive) 文本标注**：MCP 工具 description 尾部带能力标注；教学版仅文本不拦截。
   - README 引语：「MCP 工具的 description 带 `(readOnly)` 或 `(destructive)` 标注——教学版用文本标注，真实 CC 用 tool annotations 结构体让权限系统判断。」
   - 锚点：`code.py:697/701/717/721`。
9. **MCP 工具仅 Lead 可用（教学简化）**：Teammate 固定 8 工具，不继承 MCP。
   - README 引语：「这是教学简化。真实 CC 中，MCP 工具对主 agent 和子 agent 都可用——子 agent 继承父级的 MCP 配置。」（官方佐证见轨C #12）
   - 锚点：`code.py:500-550`（sub_tools / sub_handlers）。

教学版六项省略清单（README「教学版的简化」）：6 种 transport → 1 种 mock；Channel 反向通知 → 省略；OAuth → 省略；多层配置优先级 → 省略；复杂错误分类 → 省略（try/except 兜底）；MCP 工具只给 Lead → 省略子 agent 继承。

### 生产版对照【三】

> 归属义务同前。分析基础：`services/mcp/client.ts`、`auth.ts`、`config.ts`、`channelNotification.ts`（另引 `types.ts`、`tools.ts`、`mcpStringUtils.ts`、`normalization.ts`）。

1. `types.ts:23-25` — CC 支持 6 种传输：`stdio`（子进程，跨平台默认）、`sse`、`http`（Streamable HTTP）、`ws`、`sse-ide`（IDE 内嵌）、`sdk`（进程内）。「连接时本地和远程服务器分批并发：本地批量 3 个，远程批量 20 个。」
2. `tools.ts:345-364 assembleToolPool()` — 去重时 `uniqBy([...builtInTools.sort(byName), ...filteredMcpTools.sort(byName)], 'name')` 优先保留内置工具；「内置工具和 MCP 工具分开排序，不是合起来排。原因是 CC 的 `claude_code_system_cache_policy` 在最后一个内置工具之后的某个位置放全局缓存断点——混排会破坏这个设计。」
3. `mcpStringUtils.ts:50-52 buildMcpToolName()` — 命名规则 `mcp__<normalizedServerName>__<normalizedToolName>`；「所有非 `[a-zA-Z0-9_-]` 字符替换为 `_`（`normalization.ts:17-23`）。教学版的 `normalize_mcp_name` 用同样的规则。」
4. `checkPermissions()`（无行号）— 「CC 对 MCP 工具有独立的权限系统。……MCP 工具可以声明自己的权限需求（readOnly、destructive 等），CC 根据声明决定是否需要用户确认。」
5. `config.ts:1267-1289` — 配置优先级从低到高：`claude.ai 连接器 < plugin < user settings.json < approved project .mcp.json < local settings.local.json`；「`claude.ai` 连接器单独拉取、按内容签名去重」；「企业 `managed-mcp.json` 存在时完全排除其他配置。」
6. `channelNotification.ts`（无行号）— Channel 反向推消息四步：Server 声明 `capabilities.experimental['claude/channel']` → `notifications/claude/channel` 通知 → 消息包装在 `<channel source="serverName">` XML → 「Agent 被 SleepTool 唤醒（1 秒内）」；Server 还可请求权限（`notifications/claude/channel/permission_request`），「用户通过 5 字母短 ID 确认/拒绝」。
7. `auth.ts`（无行号）— 完整 OAuth 2.0 + PKCE：公钥客户端发现 OAuth 元数据（RFC 8414 / RFC 9728）；本地回调服务器接收授权码；令牌经 `getSecureStorage()` 持久化（macOS Keychain / Linux 加密文件 / Windows 凭据管理器）；「过期前 5 分钟自动刷新」；「支持跨应用访问（XAA）：浏览器获取 id_token → RFC 8693 + RFC 7523 交换」。
8. `client.ts:1266-1402` — 连接生命周期错误分类与重试：「终局性错误（ECONNRESET、ETIMEDOUT、EPIPE 等）：连续 3 次 → 关闭 + 重连」；「工具调用 401：令牌过期 → 抛出 `McpAuthError` → 触发重认证」；「工具调用超时：`Promise.race` 超时（可配置，默认约 28 小时）」；「Stdio 断连：按 SIGINT → SIGTERM → SIGKILL 顺序杀进程」。

### 官方文档对照【官】

| 官方事实 | 官方说（摘） | 课程教 | 判定 |
|---|---|---|---|
| 轨C #32 三段式命名+归一化 | 插件服务器工具全名 `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`，字符表外替换 `_` | 两段式 `mcp__{server}__{tool}` + 归一化 | **一致**（归一化；官方多 plugin 一段） |
| 轨C #33 .mcp.json 交互批准 | "Claude Code prompts for approval in interactive sessions before using project-scoped servers" | 教学版接上即用（mock）；「接上不等于放行」见 s20 权限 hook | **一致**（方向） |
| 轨C #34 ask/blocked | `ask` 每次调用提示；`blocked` "filters the tool out before Claude sees it" | s20：`mcp__*deploy*` 类破坏性工具 PreToolUse 确认 | **一致**（宿主策略方向） |
| 轨C #35 list_changed 动态更新 | 服务器可动态增删工具，免断开重连 | 工具池每轮重装（接上下一轮自然可用） | **互补**（目标同、机制异：通知 vs 每轮重装） |
| 轨C #36 OAuth 2.0 | "Claude Code supports OAuth 2.0 for secure connections"（令牌安全存储自动刷新、`/mcp` 重认证） | 【三】OAuth+PKCE+密钥库+刷新的文档化；教学版无鉴权 | **一致（【三】对应物的官方文档化）** |
| 轨C #37 两分钟转后台 | 主对话中 MCP 调用超 2 分钟转后台任务不阻塞会话 | 后台派发是内置工具层机制（s13/ep4 维度） | **互补**（同一「不阻塞」纪律延伸到 MCP） |
| 轨C #38 传输矩阵 | HTTP 推荐；SSE 弃用；stdio/ws | 【三】六传输；教学版 mock | **互补（现状更新）** |

---

## 七、s20《Comprehensive（综合）》 —— 「机制很多，循环一个」

### 定位与标语

终点章：前 19 章每章一个机制，真实 Agent 不会只带一个机制运行。「难点不是把功能堆起来，而是看清楚它们都挂在循环的哪个位置。S20 就是终点章：把所有组件归位。」不发明新机制，把工具分发、权限、hooks、todo、subagent、技能、压缩、记忆、prompt 组装、错误恢复、任务图、后台、cron、团队、协议、自治认领、worktree、MCP 全部放回同一个 `while True`。**系列定位（信源地图）**：s20 不作本集普通章节、作终幕收束装置——标语「机制很多，循环一个」直接回答系列主线。

- 标语原文：*"机制很多，循环一个"* — 工具、权限、记忆、任务、团队、插件都挂在同一个 while True 上。
- Harness 层原文：**Harness 层**: 综合 — 把前 19 章的机制放回同一个可运行系统。
- 收束金句：「从 s01 到 s20，代码表面越来越复杂，但核心始终没变。」
- 分工金句：「Claude Code 的复杂性不是"另一个 agent 大脑"，而是一个成熟 harness 的复杂性。模型负责判断和行动选择；harness 负责把环境、工具、权限、记忆、团队和外部能力组织好。」

核心五步循环（README 结尾，画面锚）：

```python
while True:
    response = LLM(messages, tools)
    if not has_tool_use(response.content):
        return
    results = execute_tools(response.content)
    messages.append(tool_results)
```

### 机制【一】

1. **单循环不变量（has_tool_use 判定）**：循环是否继续不信任 `stop_reason`，以响应中实际出现 `tool_use` block 为信号。
   - README 引语：「CC 源码里也不直接信任 `stop_reason == "tool_use"`，而是以实际出现的 tool_use block 作为是否继续工具轮的信号。」（课程转述，非源码定位——口播引用注明）
   - 锚点：`code.py:1023 def has_tool_use`；主循环判定 `code.py:2015`；无 tool_use 时 `code.py:2016 trigger_hooks("Stop", messages)` 后返回。
2. **四事件 hooks 管线**：UserPromptSubmit / PreToolUse / PostToolUse / Stop 贯穿循环；任一回调返回非 None 即短路。
   - README 引语：「这样 permission、log、审计都可以挂在同一个 hook 点上。」
   - 锚点：`code.py:883 HOOKS`；`code.py:891 def trigger_hooks`。
3. **权限即 PreToolUse hook**：deny list 直接拒、destructive 命令交互确认、路径越界确认、MCP 破坏性工具确认——权限不写在工具执行行里。
   - README 引语：「权限不写死在工具执行行里，而是作为 `PreToolUse` hook」。
   - 锚点：`code.py:899 DENY_LIST`（rm -rf /、sudo、shutdown、reboot、mkfs、dd if=）；`code.py:900 DESTRUCTIVE`（rm 、> /etc/、chmod 777）；`code.py:903 def permission_hook`；拦截点 `code.py:2033-2038`。
4. **两层计划（todo_write + task graph）**：会话内轻量 todo 防单 Agent 漂移；跨会话可依赖可认领的任务文件支撑团队；3 轮未更新 todo 自动注入提醒。
   - README 引语：「S20 同时保留两层计划」；「前者帮助单个 Agent 不漂移；后者支撑团队协作。」
   - 锚点：`code.py:485 run_todo_write`；`code.py:1979-1982`（`<reminder>Update your todos.</reminder>`）。
5. **任务图持久化与依赖认领（沿用 s12）**：Task 写盘（六字段 + worktree 字段），认领前查全部 blocker 存在且 completed，完成后报告解锁。
   - 锚点：`code.py:80/95/124/136/157`。
6. **一次性 subagent（task 工具）**：独立 `messages[]` 跑满自己的工具循环，中间过程丢弃只回最终摘要；防递归（SUB_SYSTEM 明示 "Do not spawn more agents."）；30 轮上限；subagent 内工具调用同样过 PreToolUse hooks。
   - README 引语：「一次性 subagent 解决"上下文隔离"；持久队友解决"长期并行协作"。」
   - 锚点：`code.py:1030 def spawn_subagent`；`code.py:971 SUB_SYSTEM`；`code.py:978 SUB_TOOLS`（5 件）。
7. **持久队友线程（spawn_teammate + MessageBus）**：daemon 线程 + append-only JSONL 邮箱 + idle 轮询任务板自动认领；每轮仅带最近 20 条消息。
   - README 引语：「`spawn_teammate`：持久队友线程。通过 MessageBus 收发消息，能 idle 轮询任务板并自动认领。」
   - 锚点：`code.py:503 class MessageBus`；`code.py:629 def spawn_teammate_thread`；队友工具 8 件 `code.py:699-740`；`code.py:780`。
8. **plan approval 协议门（s16 协议的真门化）**：队友 submit_plan 后**停止一切模型/工具步骤**，直到 Lead 以带 request_id 的 plan_approval_response 批准；同一响应里后续 tool_use block 被忽略。
   - README 引语（观察重点）：「队友是否提交 plan，并在 approval 前暂停」「plan 批准后，队友是否能认领任务」。
   - 锚点：`code.py:633-634` 注释 "Plan approval is a real gate: after submit_plan, the teammate stops taking model/tool steps until lead sends plan_approval_response."；等待期只轮询协议回复不跑模型 `code.py:767-771`；`code.py:803-806` 忽略同响应后续 tool_use。
   - 对照：s16 的门是协议级（模型自觉等待）；s20 是代码级（循环真的停）。两者与官方产品口径的分歧见 D3。
9. **自治认领 + worktree 透明切换**：idle 先 inbox 后任务板；认领带 worktree 的任务后 bash/read/write 自动在对应目录执行。
   - README 引语：「队友 claim 到带 worktree 的 task 后，bash/read/write 自动在对应目录下执行」。
   - 锚点：`code.py:575-576 IDLE_POLL_INTERVAL/IDLE_TIMEOUT`；`code.py:579/590`；`code.py:685 _run_claim_task`。
10. **worktree 隔离（沿用 s18）**：名字白名单、绑定、拒绝有未提交/未推送的删除。
    - 锚点：`code.py:179-277`（validate/create/count/remove/keep/log_event）。
11. **MCP 晚绑定工具池**：connect_mcp 连接发现；assemble_tool_pool 每轮把内置与已连 MCP 工具合并为单池，命名统一 `mcp__{server}__{tool}`。
    - README 引语：「所以 `connect_mcp("docs")` 后，下一轮工具池里会出现 `mcp__docs__search`。」
    - 锚点：`code.py:1542 class MCPClient`；`code.py:1636 def assemble_tool_pool`；每轮重组装 `code.py:1964/1986`。
12. **内置工具池 27 件**：bash、read_file、write_file、edit_file、glob、todo_write、task、load_skill、compact、create_task、list_tasks、get_task、claim_task、complete_task、schedule_cron、list_crons、cancel_cron、spawn_teammate、send_message、check_inbox、request_shutdown、request_plan、review_plan、create_worktree、remove_worktree、keep_worktree、connect_mcp。
    - README 引语：「内置工具池包含 27 个工具」。
    - 锚点：`code.py:1732-1876 BUILTIN_TOOLS`；`code.py:1878 BUILTIN_HANDLERS`（27 键）。
13. **其余机制归位（本集只取总括口径）**：压缩四级管线、错误恢复分级、后台任务通知、cron 调度、记忆注入、技能目录按需加载——机制本体属 ep2–ep4 维度，本集仅引用「都挂在同一个循环的位置表」这一总括事实（README 12 行组件位置表）。

### 生产版对照【三】

本章无「深入 CC 源码」独立节，README 与 code.py 均未给出 CC 文件:行号级引用——**三级证据条目为 0 条**。

附录（非三级证据）：README 正文有一句 CC 行为断言（无锚点）：「CC 源码里也不直接信任 `stop_reason == "tool_use"`，而是以实际出现的 tool_use block 作为是否继续工具轮的信号。」口播引用须注明为**课程转述**而非源码定位。

### 官方文档对照【官】

轨 C 四页（agent-teams / sub-agents / mcp / worktrees）均以功能页切分产品能力，**无对应 s20 的「总括循环」专页**；「机制很多，循环一个」是课程叙事口径，官方文档不做此总括表述。处置：本集终幕引用该标语时定位为课程的教学收束观点（【二】），不作为官方口径；官方对照按前六节的分页事实累计（轨C #1–#43）。

---

## 分歧清单

| # | 分歧点 | 站点轨 README | 钉点 code.py | 处置 |
|---|---|---|---|---|
| D19 | s19 MCPClient 的 register/call_tool 释义 | README:54/59 示例码块含 docstring（"Simulates tools/list discovery." 等）且签名/异常处理与实现不同 | 两方法无 docstring（grep "Simulates" 零命中） | 引语归属 README【二】；代码断言以锚点实测为准（R2 证伪发现） |

> 「分歧」＝两轨（或多轨）各自说法正面冲突处；「互补/一致」不入本清单。课程 vs 官方分歧须写明口播措辞建议（通常「课程教 X；官方文档当前说 Y」）。README vs code 以 code.py（【一】）为准。

| # | 分歧点 | 各轨说法 | 处置与口播措辞 |
|---|---|---|---|
| D1 | **Worktree 与队友的关系** | 站点轨 s18：worktree 是队友机制组件——任务带 worktree 字段、认领即切 cwd（「任务管目标, worktree 管目录, 按 ID 绑定」，课程自陈绑定是教学简化）。官方（轨C #24/#26/#30）：agent-teams 页通篇不提 worktree，队友以 in-process / split pane（tmux、iTerm2）运行；worktrees 是独立的手动并行机制 + subagent `isolation: worktree`；任务—worktree 绑定两页零记载。 | 架构口径分歧。口播：「课程教：给每张活配一个隔间，任务和目录按 ID 绑定；官方文档当前说：Agent teams 页不提 worktree——隔间是另一套手动并行机制，子代理可以声明 isolation: worktree，任务与隔间之间产品没有绑定。」 |
| D2 | **隔离强度：「换目录」还是「硬阻断」** | 站点轨教学实现：wt_ctx 只切换 bash/read/write 的 cwd，safe_path 围栏以 worktree 为 base（`code.py:303-308`）——目录级手段。【三】（s18 深入 CC 源码）：EnterWorktree 是 `process.chdir()` 进程级切换、AgentTool isolation 是 `cwdOverride` 包住子 agent——同为目录层手段，未见阻断式检查。官方（轨C #25）：四项工具调用级硬阻断（编辑/命令工作目录/git 重定向/命令形状），"You can't turn this check off"。 | 官方隔离强度已超过课程的实现口径与产品旧分析。口播：「课程教的是：换个目录干活；官方文档当前说：产品现在会对指向主 checkout 的编辑和命令直接拦截，而且这道检查关不掉。」不把「只是换目录、不是沙箱」当产品现状讲（该自陈属 main 轨教学实现，非本集钉点原文）。 |
| D3 | **队友计划审批：核心门禁还是自动通过** | 站点轨 s16 教 request-response 计划审批协议但自陈「没有实现执行门控……真实 CC 的队友有 permission gating 机制」；s20 把它升级为代码级真门（submit_plan 后停止一切模型/工具步骤）。官方（轨C #39）："Claude Code approves the plan in the lead's session as soon as the request arrives, **without the lead reviewing it**"；修改型动作由权限提示兜底。 | 口播：「课程把计划审批当协议核心来教——s20 还给它做了真门：计划没批，队友一步都不走；官方文档当前说：产品的计划请求一到 Lead 会话就自动批准，不经审阅，真正的拦截在权限提示那一层。」 |
| D4 | **权限冒泡：省略还是产品标配** | 站点轨 s15 教学版省略权限冒泡（对比表明示「真实 CC 有冒泡机制」）。【三】：产品五步冒泡（permission_request → Lead 审批队列 → 用户批准 → permission_response 回队友），双频轮询 1s/500ms。官方（轨C #40）："Teammate permission prompts appear in the lead session"；权限模式继承（dontAsk 除外）。 | 教学实现 vs 产品口径的分歧，【三】与官方方向一致、细节互补。口播须双归属：「教学版把权限冒泡省了；按课程作者对源码的分析，产品里队友的审批请求会一路冒到 Lead 的界面上——官方文档确认：队友的权限提示出现在 Lead 会话，由用户在那儿批准。」 |
| D5 | **结果与空闲：两条消息还是一个通知** | 站点轨 s15：队友完成后发一条 result summary 到 Lead 收件箱；idle_notification 是【三】产品机制（s16 教学版自陈省略了给 Lead 的空闲通知）。官方（轨C #19）：空闲通知**内含最终答案**（一个通知合并两者）；API 错误时通知失败并附错误文本。 | 口播：「课程把『干完了』当成一条消息教，空闲通知是产品的另一种消息；官方文档说：产品的空闲通知本身就带着最终答案——一件事一次说清。」 |
| D6 | **Worktree 清理与分支保留（三口径）** | 站点轨 s18：keep = 留分支等人工 review；remove 有改动默认拒绝，`discard_changes=true` 强删且**连分支一起删**（`git branch -D`）。main 轨（演进注记，旧 175 §6）：两条移除路径都保留分支——「目录可以没有，提交不能丢」。官方（轨C #27）：干净时未命名会话自动删**含分支**；显式 remove 删目录+分支+工作；sweep 只删自己造的、运行中持 `git worktree lock`。 | 三方不同。本集按站点轨口径讲（keep 留 / discard 强删连分支），官方对照按轨C #27。**旧文档「目录能删分支不能丢」是 main 轨口径，禁止用于本集口播。** |
| D7 | **副台/队友二分法：二值还是渐变** | 站点轨 s15 四轴对照：s06 子 Agent「一次性，用完销毁」vs s15 队友「多轮常驻」。官方（轨C #42）：命名副台可按名 resume 并**保留完整对话史**；SendMessage 可复活已完成副台。 | 口播：「课程教的是两级：临时工和常驻同事；官方文档显示，产品里给副台起个名字，它就能被再次叫醒、还保留全部历史——这条分界线在产品里是渐变的。」（教学实现的副台确为一次性，分歧仅对产品口径成立。） |
| D8 | **s12 README 引码块与 code.py 两处出入** | claim_task：README 所引片段的阻塞依赖列表缺「任务文件不存在」分支，`code.py:116-117` 实际为 `[d for d in task.blockedBy if not _task_path(d).exists() or load_task(d).status != "completed"]`。complete_task：`code.py:128` 有 `status != "in_progress"` 守卫（cannot complete），README 片段未展示。 | 以 code.py 为准（【一】）；README 片段是节选。口播若引「完成只接受进行中的任务」「缺失依赖也算被阻塞」，以实测口径为准，不照读 README 片段。 |
| D9 | **s16 命名口径：dispatch_message vs handle_inbox_message** | README 解决方案段与变更表、code.py 文件头 docstring 均称 `dispatch_message`（docstring 还提及 handle_shutdown_request / handle_plan_response）；实际实现是嵌套在 spawn_teammate_thread 内的 `handle_inbox_message`（`code.py:451-475`），两个「handler」均无独立函数、逻辑内联在分支里。 | 口播用机制描述「按消息类型路由到对应分支」，不点名 dispatch_message；文档对照与画面标注须注明实现名 handle_inbox_message。 |

**官方未述（无法对账，不判分歧，引用时不得说「官方否认」）**：「读后删格」的消费式语义（轨C #16 只写到读取校验与坏条目剔除）；归一化撞名的处理（#32 只写归一化规则）；【三】「MCP 服务端结构化权限标注参与判定」（MCP 页未述）；【三】「任务 ID 递增整数+高水位标」「认领只设归属不改状态」（官方未述任务 ID 方案与认领状态语义）；【三】「提示缓存断点卡在最后一个内置工具后」（MCP 页未述缓存；agent-teams 页仅有队友缓存 TTL）。

---

## 附：口播可用度分层速查

- 【一】【二】（钉点实测与 README 原文）：可直接引用；绝对行数/活数据不进口播。
- 【三】：必须带归属句（「按课程作者对 Claude Code 源码的分析」）+ 画面角标；CC 文件行号只保留在本文件「生产版对照」小节，不进「口播可用」层。
- 【官】：产品现状口径；与课程分歧处按分歧清单措辞（「课程教 X；官方文档当前说 Y」）。
- 站点自标数字与实测全部核对一致（工具数/行数无出入；两处引码出入见 D8/D9）。
