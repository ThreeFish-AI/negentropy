# 事实源：《Learn Claude Code》工具与执行 4 章

> **本集口播的单一事实源**。逐字稿中每一条断言都必须能回溯到本文件的某一节。
>
> **信源双轨与修订分叉**：章节归属与双钉（本集钉 `0dcafa2`，仓库 main 17 章整合版）只登记在系列级信源地图，本文件不重述：见 [../../../source-map/claude-code-explained.md](../../../source-map/claude-code-explained.md)。
>
> **证据分级**：【一】仓库实测（@ 0dcafa2，可复算）／【二】站点正文／【三】课程作者对 Claude Code 源码的分析（口播必带归属句 + 画面角标）／【官】Anthropic 官方文档（产品现状口径，域名已迁 code.claude.com）。
>
> **提取方式**：2026-09-28 五维度重调研（钉点逐章 curl 取原文）；字节归档 `research/source-archive/0dcafa2/`；指纹见 [sources.toml](./sources.toml)。图片纪律：站点 SVG 不下载不嵌入，只转文字规格。
>
> **本集特有纪律**：① 撞号——本集钉 main 轨，其中 s03/s04 与旧 12 课轨撞号（旧 s03 TodoWrite、旧 s04 Subagent），涉及时写「main 轨 + 章全称」，禁止裸用编号；s01/s02 为三轨同号同物安全区。② 数字——口播不引绝对行数/活数据；课程计数（DENY_LIST 条数、截断上限等）随修订漂移，以本文件「机制」条目的 code.py 锚点为准，不在口播中念具体数字。③【三】断言不转引具体 CC 文件行号进「口播可用」层——转抄保留在「生产版对照」小节并标注归属义务。

---

## 实测总表（【一】· 2026-09-28 @ 0dcafa2）

| 章 | 总行 | 非空非注释 | 工具数 |
|---|---:|---:|---:|
| s01_agent_loop | 142 | 106 | 1 |
| s02_tool_use | 196 | 149 | 5 |
| s03_permission | 257 | 192 | 5 |
| s04_hooks | 271 | 215 | 5 |

口径：总行 = `wc -l code.py`（含空行、注释、docstring）；非空非注释 = `grep -cvE '^\s*(#|$)'`（docstring 正文行计入）；工具数 = `TOOLS` 数组中 `"name":` 条目计数。全部取自钉点 raw 文件（指纹见 [sources.toml](./sources.toml)）。README「三十多行」指 s01 循环**内核**（`agent_loop` 函数体），非全文件——口播引用须带此口径。另：s03/s04 的 `agent_loop` 骨架逐字同头（`def agent_loop` → `while True` → `client.messages.create` → append assistant），与两章 README「循环不变」声明互证【一】。

## 一、s01 Agent Loop —— 一个工具 + 一个循环 = 一个 Agent

### 定位与标语

- README 标语：`*"One loop & Bash is all you need"* — 一个工具 + 一个循环 = 一个 Agent。`；Harness 层定位：「**Harness 层**: 循环 — 模型与真实世界的第一道连接。」
- 章节链 s01 → … → s17（17 课），「后面 16 个章节都在这个循环上叠加机制，循环本身始终不变」。
- 要消灭的痛点：「模型能输出一条 bash 命令，但输出完了就停了，它不会自己跑，也不会看到结果后继续推理。」「每一个来回，你都在做中间层。而把它自动化，就是这一章要做的事。」
- 全书分工语义（README）：模型负责决策（要不要调工具、调哪个），harness 负责执行（调用工具，把结果作为新消息追加）。
- code.py 模块 docstring："This is the core loop: feed tool results back to the model until the model decides to stop. Later chapters add policy, hooks, and lifecycle controls around it."
- SYSTEM 提示词行为指令："Act, don't explain."（做，别解释）
- s02 悬念三连（下集钩子）：「给它 5 个真正的工具，会发生什么？模型会不会一次调用多个工具？几个工具同时跑会不会互相踩？」

### 机制【一】

- **Agent Loop 主循环**：`while True` 循环，模型调用工具就继续、不调就停——全书唯一始终不变的核心。
  - README：「一个 `while True` 循环，模型调用工具就继续，不调用就停。循环直接检查响应里的内容块：」
  - 锚点：`code.py:87 def agent_loop`；`code.py:88 while True:`；调用参数 `code.py:89-92`（model=MODEL, system=SYSTEM, messages=messages, tools=TOOLS, max_tokens=8000）
- **tool_use 信号检测（循环终止条件）**：循环靠检查响应内容块里有没有 `tool_use` 决定继续还是退出，不用额外标志位。
  - README（信号表）：「| 包含 `tool_use` block | 模型要求调用工具 | 执行 → 结果喂回去 → 继续 |」「| 不包含 `tool_use` block | 模型没有调用工具 | 退出循环 |」
  - 锚点：`code.py:98-102`（`tool_calls = [block for block in response.content if block.type == "tool_use"]`；`if not tool_calls: return`）
- **assistant 回合先落账 + 非空工具结果纪律**：无论是否调工具，assistant 回答先追加进 messages；只有实际存在 `tool_use` block 才进入执行阶段，不会追加空的工具结果消息。
  - README：「**第 3 步**：追加模型回答，检查它是否调了工具。没调 → 结束。」「只有实际存在的 `tool_use` block 才会进入执行阶段，因此不会追加空的工具结果消息。」
  - 锚点：`code.py:95`（`messages.append({"role": "assistant", "content": response.content})`）
- **tool_result 回喂（tool_use_id 配对）**：执行每个工具调用后，结果以带对应 `tool_use_id` 的 `tool_result` block 组成一条 user 消息追加回 messages，回到第 2 步。
  - README：「**第 5 步**：把工具结果作为新消息追加，回到第 2 步。」
  - 锚点：`code.py:104-117`（收集 `results` 后 `messages.append({"role": "user", "content": results})`）
- **单 bash 工具定义**：工具集只有一条——name `bash`、入参仅 `command` 字符串。
  - README：「现在模型手里只有 bash 一个工具，读文件要 `cat`，写文件要 `echo ... >`，找个文件要 `find`，又丑又容易出错。」
  - 锚点：`code.py:59-67 TOOLS`（description "Run a shell command."；input_schema 仅 command 必填）
- **危险命令黑名单**：执行前对命令做 5 个危险模式的子串匹配，命中即拦截返回错误字符串（不抛异常、不执行）。
  - README 未展开（仅安全提示，见「定位」）；清单只在 code.py。
  - 锚点：`code.py:71-74 run_bash`（dangerous 五模式；命中返回 `"Error: Dangerous command blocked"`）
- **执行防护三件套（超时/截断/空输出占位）**：subprocess 超时；stdout+stderr 合并后截断再回喂；空输出用占位串，保证模型总收到非空结果。
  - 锚点：`code.py:76-83 run_bash`（timeout=120；`out[:50000]`；空输出 `"(no output)"`；TimeoutExpired / FileNotFoundError / OSError 均捕为错误字符串不炸循环）
- **系统提示词锚定工作目录**：SYSTEM 把当前目录注入，并下达「行动优先于解释」指令。
  - 锚点：`code.py:56 SYSTEM`（`f"You are a coding agent at {os.getcwd()}. Use bash to solve tasks. Act, don't explain."`）
- **多轮 REPL 会话（history 跨 query 复用）**：入口为交互式 REPL，history 列表跨提问累积；退出后打印模型最终 text block。
  - 锚点：`code.py:121-142`
- **终端观测装修**：被执行命令以黄色 ANSI 高亮打印（`$ ` 前缀），终端只预览输出前段（完整截断后内容仍回喂模型）；提示符用零宽标记避免 readline 错位。
  - 锚点：`code.py:107-109`；`code.py:128-129`（注释 `# \001/\002 tell Readline the ANSI escapes have zero display width.`）
- **readline macOS 兼容修补（课程仓库 issue #143）**：导入 readline 并绑定四条设置修复 macOS libedit 的 UTF-8 退格；非 macOS 静默跳过。
  - 锚点：`code.py:35-43`（注释 `# #143 UTF-8 backspace fix for macOS libedit`）
- **网关 BASE_URL 自适配**：设置了 `ANTHROPIC_BASE_URL` 时移除 `ANTHROPIC_AUTH_TOKEN`，客户端以 BASE_URL 构造；`.env` 经 `load_dotenv(override=True)` 加载。
  - 锚点：`code.py:48-54`

### 生产版对照【三】

本章无「深入 CC 源码」节（README.zh @0dcafa2 全文不含，亦无对真实 CC 源码文件/行号的引用；code.py 内 `#143` 为课程仓库自身 issue 编号）。与本章相关的【三】级主张经轨 C 对照字段转录：

- 【三】产品不把停止标记当续轮的唯一依据，而是另设一个独立标志位（流式过程中一旦收到工具调用块就置真），理由是声明会滞后于事实——续轮判据是「内容块里有无工具调用」的**结构事实**而非停止标记**声明**，属课程作者的闭源源码级结论；官方文档不覆盖此层（见下「官方文档对照」1.4），口播引用必须带归属句 + 画面角标。

### 官方文档对照【官】

1. 三阶段循环（how-claude-code-works § The agentic loop）："gather context, take action, and **verify results**… These phases blend together."——官方是用户可见的产品级叙述，课程是实现级骨架（本轮工具调用执行+结果追回）。**互补**。
2. 循环可打断、扩展点插在循环特定阶段（Glossary · Agentic loop）："You can interrupt the loop at any point to redirect. Most extension points, including hooks, skills, and MCP, plug into specific phases of this loop."——课程教「循环极小、可生长的都挂循环外」；官方明说扩展点插在循环特定阶段。**一致**。
3. harness 官方定义（Glossary · Agentic harness）："The tools, context management, and execution environment that turn a language model into a capable coding agent. Claude Code is the harness; Claude is the model inside it. The harness supplies file access, shell execution, permission gating, memory loading, and the loop that chains actions together."——与课程「模型决策 / harness 执行」分工及「Claude Code 是 harness」口径对得上。**一致**。
4. 续轮判据不披露（Glossary + how-claude-code-works 全 6 页）：官方仅有 "repeat until done" 等产品级表述，未出现 stop marker / stop_reason /「内容块里有无工具调用」等实现层口径。**互补（官方空白）**——课程判据主张无法用官方文档校准，只能以源码/SDK 行为佐证；站点轨旧修订（信停止标记）与 main 轨（信内容块）之争官方同样无法裁决。
5. 打断与同轮排队（how-claude-code-works § Interrupt and steer）：Esc 立即停止并**取消正在运行的工具调用**；排队消息在工具调用结束后**同轮内**被读取、下一步前调整。**互补**（官方补用户侧打断语义）。

## 二、s02 Tool Use —— 多加一个工具，只加一行

### 定位与标语

- README 标题：`s02: Tool Use — 多加一个工具，只加一行`；标语：*"加一个工具, 只加一个 handler"* — 循环不用动, 新工具注册进 dispatch map 就行。
- Harness 层定位：「**Harness 层**: 工具分发 — 扩展模型能触达的边界。」
- 痛点（翻译层）：「模型想的是"读这个文件"，却要拼出 `cat path/to/file`。多了一层翻译，浪费 token，还容易拼错。」
- code.py docstring 金句："Key insight: the loop stays the same; only tool registration and dispatch grow."（循环保持不变，只有工具注册与分发在生长）
- 章末交棒 s03：「file tools 受 `safe_path` 保护，但 bash 不受限制，`rm -rf /` 还是能跑。」→「s03 Permission → 在工具执行之前加一道门：这个操作安全吗？需要用户批准吗？」

### 机制【一】

- **TOOL_HANDLERS 查表分发**：工具名 → 处理函数的字典，把 s01 硬编码的 `run_bash()` 变成查表调用；加工具 = 加一行映射。
  - README：「s01 的循环完全保留（LLM 调用、`tool_use` block 判断、消息追加）。唯一的变动在工具执行那 1 行：`run_bash()` 替换为 `TOOL_HANDLERS[block.name]()` 查表分发。」
  - 锚点：`code.py:143 TOOL_HANDLERS`；`code.py:170-171`（`handler = TOOL_HANDLERS.get(block.name)`；`output = handler(**block.input) if handler else f"Unknown: {block.name}"`）；对照注释 `code.py:150-151`
- **加工具两步注册**：`TOOLS` 数组加一条 JSON schema 描述 + `TOOL_HANDLERS` 字典加一行映射，循环不动。
  - README：「给 Agent 加一个工具只需要做两件事：1. **定义工具**… 2. **注册处理函数**…」「加一个工具 = 在 `TOOLS` 数组加一条 + 在 `TOOL_HANDLERS` 字典加一行。循环不变。」
  - 锚点：`code.py:128 TOOLS`（5 条）；`code.py:143 TOOL_HANDLERS`（5 行映射）
  - 隐含第三契约（code.py:171 `handler(**block.input)` 按关键字展开 ⇒ schema 属性名必须与处理函数形参名逐字一致）【一，代码事实】
- **safe_path 工作区路径围栏**：文件类工具路径先 resolve 再验 `is_relative_to(WORKDIR)`，越界抛错；仅覆盖 file tools，不含 bash。
  - README（变更表）：「路径安全 | 无 | safe_path 校验（仅 file tools）」
  - 锚点：`code.py:71 def safe_path`；`code.py:73-74`；`WORKDIR = Path.cwd()`（code.py:44）。实测 grep：safe_path 命中 5 行（docstring 提及 + 定义 + read/write/edit 三处调用点）【一，2026-09-28 复核】
- **read_file：行级读取 + limit 截断**：按行读，`limit` 截断并附剩余行数提示。
  - 锚点：`code.py:78 run_read`；`code.py:81-82`（`... ({len(lines) - limit} more lines)`）；异常兜底 `return f"Error: {e}"`
- **write_file：父目录自建 + 字节数回执**：写入前自动 `mkdir(parents=True)`，成功返回写入字节数。
  - 锚点：`code.py:88 run_write`；`code.py:91`；`code.py:93 return f"Wrote {len(content)} bytes to {path}"`
- **edit_file：精确文本单次替换**：要求 `old_text` 精确存在，只替换第一处，找不到即报错。
  - 锚点：`code.py:98 run_edit`；`code.py:102-103`（`Error: text not found in {path}`）；`code.py:104`（`text.replace(old_text, new_text, 1)`）
- **glob：递归检索 + 条数上限 + 越界过滤**：按 pattern 递归匹配（`**`），去重排序后截断到上限并提示收窄 pattern，同时过滤解析后越出工作区的路径；空结果返回占位串。
  - 锚点：`code.py:110 run_glob`；`code.py:113-117`（越界过滤）；`code.py:118-120`（上限 200 条）；`code.py:121 "(no matches)"`
- **多 tool_use 按原始顺序逐个执行**：模型一次可返回多个 tool_use block，循环按 `response.content` 原始顺序逐个执行，每个调用各自回一条 `tool_result`；教学版无任何并发原语（无线程池、无异步）。
  - README：「模型经常一次返回多个 tool_use："读一下 a.py 和 b.py，然后列出所有 .py 文件"。这些调用按照 `response.content` 中的原始顺序逐个执行。」
  - 锚点：`code.py:161-163`；`code.py:168 for block in tool_calls:`（顺序执行）；`code.py:173 results.append(...)`
  - 兜底纪律：未知工具返回错误串而非崩溃（code.py:171）；每个工具函数自带 try/except 以字符串回错（code.py:84-85, 94-95, 106-107, 122-123）

### 生产版对照【三】

本章无「深入 CC 源码」节。经轨 C 对照字段转录的【三】级主张：

- 【三】产品侧工具调用被切成连续的批次：批内并行且有并发上限、批间严格有序；能否并行由**本次调用的实参**判定，而非工具的读写属性——课程作者拆闭源源码后的结论；官方文档只确认到「存在并行与批」这一层，调度细节未披露（见下 2.3 与分歧清单 D3）。口播引用必须带归属句 + 画面角标。
- 教学版与 CC 内置工具的概念层对应（bash/read_file/write_file/edit_file 同名同语义）：课程**未展开**此项对应（取证笔记 §4 标记「课程未展开」），口播不得安到课程头上；官方内置工具面见下 2.2【官】。

### 官方文档对照【官】

1. 工具回灌循环（how-claude-code-works § Tools）："Without tools, Claude can only respond with text. With tools, Claude can act… Each tool use returns information that feeds back into the loop, informing Claude's next decision."——与课程「每次工具调用的结果作为新消息追回循环」同构。**一致**。
2. 内置工具面（§ Tools）：五类（File operations / Search / Execution / Web / Code intelligence）+ "tools for spawning subagents, asking you questions, and other orchestration tasks"（完整清单在 tools-reference）。教学版个位数工具 vs 产品全集。**互补**——「加工具改表、不动循环」的结构主张在产品规模下依然成立。
3. 并行工具调用与「批」层（hooks § PostToolBatch）："Runs once after every tool call in a batch has resolved, before Claude Code sends the next request to the model. `PostToolUse` fires once per tool, which means it fires concurrently when Claude makes parallel tool calls."——官方确认产品存在并行工具调用与批层。**对教学版构成分歧**（教学版纯串行，见分歧清单 D3）。
4. 钩子事件挂在循环的每次工具调用上（hooks § Hook lifecycle）：节奏三分——per session（SessionStart/SessionEnd）、per turn（UserPromptSubmit/Stop/StopFailure）、on every tool call（PreToolUse/PostToolUse，`EndConversation` 例外两事件都跳过）——与课程 s04 事件表节奏一致，官方另给完整事件表（含 PermissionRequest/Notification/PreCompact 等）。**一致 + 互补**。

## 三、s03 Permission —— 执行前做权限判断

### 定位与标语

- README 标题：`s03: Permission — 执行前做权限判断`；标语：*"工具执行前先做权限判断"* — 权限管线决定哪些操作需要审批。
- Harness 层定位：「**Harness 层**: 权限 — 在工具执行前加一道门。」
- 核心理念：「安全边界由代码负责，判断发生在工具执行之前。」
- 起点失败模式：「s02 的 Agent 有 5 个工具。file tools 受 `safe_path` 保护，但 bash 不受限制。让它"清理一下项目"，可能执行 `rm -rf /`。」
- code.py docstring："Only one line added to the agent loop:"（整套权限系统接入循环只花一行）
- 引出 s04：「当前权限检查每次都在循环里硬编码 `check_permission()`。如果我想在每次工具执行前后加日志？…这些扩展逻辑散落在 loop 里，循环很快就会膨胀。」

### 机制【一】

- **三道闸门权限管线（check_permission）**：工具执行前依次过三道门——硬拒绝、规则匹配、用户审批；任一拒绝则不执行，三道都没命中就直接执行（「大部分日常操作走这条路」）；s02 的 agent loop 只加一行接入。
  - README：「s02 的循环完全保留。唯一的变动是在工具执行前插入 `check_permission()`。每个工具调用依次经过三道闸门：硬拒绝优先，软询问次之，都没命中就放行。」
  - 锚点：`code.py:191 def check_permission`；接入点 `code.py:226 if not check_permission(block):`
- **闸门 1：硬拒绝列表（DENY_LIST）**：一张永远禁止的命令表，子串匹配，命中直接拒绝、不执行、不询问；**仅对 bash 工具生效**。
  - README：「**闸门 1**：一张硬拒绝表，先查，命中就返回阻止信息。这张表使用简单字符串匹配来说明权限闸门的位置，不能视为完整的安全边界。」
  - 锚点：`code.py:146 DENY_LIST`（本章 7 条，含 `> /dev/sda`；注意 s04 漂移为 6 条，见分歧清单）；`code.py:148 check_deny_list`；「仅对 bash 生效」锚点 `code.py:192 if block.name == "bash":`（README 未展开此限定，以代码为准）
- **闸门 2：规则匹配（PERMISSION_RULES）**：声明式规则表，每条指定工具与检查条件，回答「什么时候需要问用户」；命中后转交闸门 3。
  - README：「**闸门 2**负责规则匹配，用来描述"什么时候需要问用户"。每条规则指定工具和检查条件。」
  - 锚点：`code.py:165 PERMISSION_RULES`（两条：file tools 出工作区 / bash 破坏性命令）；`code.py:175 check_rules`
- **命令词位正则（DESTRUCTIVE_COMMAND_WORD）**：只在「命令位」（行首或 `;`、`&`、`|`、`(`、`)`、换行之后）识别 `rm`/`del`，大小写不敏感；子串与参数位不触发。
  - README（「试一下」第 5 条）：「在 Windows 上，`del test.txt` 和 `DEL test.txt` 会触发闸门 2，而 `model`、`delimiter` 和 `echo del test.txt` 不会。」
  - 锚点：`code.py:156 DESTRUCTIVE_COMMAND_WORD = re.compile(...)`；`code.py:161 contains_destructive_command`
  - 演进注记：该正则为 main 轨 0dcafa2 相对旧钉新增（PR #548），并传播到 13/17 个根级章（s03–s14、s17，即带 s03 权限层的章；s15_integrated_harness 虽带 Bash 工具但无此正则）【一，fork-ledger §5 已同步修正】
- **闸门 3：用户审批（ask_user）**：规则命中后暂停循环，终端打印原因与参数，等用户输入；**默认拒绝**。
  - README：「**闸门 3**：规则命中后，暂停等用户输入。」
  - 锚点：`code.py:183 def ask_user`；`code.py:186 choice = input("   Allow? [y/N] ")`；`code.py:187`（空输入即 deny）
- **拒绝结果回灌（Permission denied. tool_result）**：被拒的调用不静默消失，而是以 tool_result 形式回给模型，Agent 能看到自己被拒。
  - 锚点：`code.py:226-229`（`results.append({... "content": "Permission denied."})` 后 `continue`）
- **s02 硬边界的拆除（净效应样本）**：本章起文件工具不再调用 safe_path（实测 grep 零命中），越界从「函数级直接报错」改为「规则匹配 → 问用户」——装门禁的同时把墙换成了对讲机。
  - 证据：s02 safe_path 命中 5 行（定义 + 3 调用点）vs s03 零命中【一，2026-09-28 复核】；越界检查内联进规则一（`code.py:166-172` check 为 `not (WORKDIR / args.get("path", "")).resolve().is_relative_to(WORKDIR)`）
- **提示词层并行声明**：SYSTEM 同时声明破坏性操作需审批（提示词与代码双层）。
  - 锚点：`code.py:59 SYSTEM = f"You are a coding agent at {WORKDIR}. All destructive operations require user approval."`（课程正文未展开，代码事实）

### 生产版对照【三】

本章无「深入 CC 源码」节。经轨 C 对照字段转录的【三】级主张：

- 【三】产品里权限规则求值**独立于钩子**，钩子是权限评估的扩展/输入而非宿主——「权限实现成一个钩子」只是教学版的权宜（课程作者源码分析同口径：产品里钩子从属于权限管线）。口播引用必须带归属句；正文以官方口径为准（见下 3.6 与分歧清单 D2）。

### 官方文档对照【官】

1. 分层权限系统与默认免批面（permissions § Permission system）："Claude Code uses a tiered permission system to balance power and safety."——按工具类型分层默认免批：工作目录内读免批、只读 Bash 白名单免批、文件修改需批、Web fetch 预批文档域名免批。教学版只有三段闸门，无分层免批面。**互补**。
2. 求值顺序：deny → ask → allow，首中即决（§ Manage permissions）："Rules are evaluated in order: deny, then ask, then allow. The first match in that order determines the outcome, and rule specificity doesn't change the order."——与课程三闸门「先匹配到哪档按哪档办」逐句对应。**一致**。
3. 放行无法在拒绝上开洞（§ Manage permissions）："A broad deny rule like `Bash(aws *)` blocks every matching call, including calls that also match a narrower allow rule… An allow rule can't carve an exception out of a deny rule."——课程「不可协商的拒绝排在可协商的同意前」的机制化。**一致**。
4. 跨来源合并（settings § Lists merge instead of overriding + § Settings precedence）："combines the lists instead of picking one"；"If a tool is denied at any level, no other level can allow it."——多来源并集 + deny 全局优先。教学版单一规则来源。**互补**。
5. 设置优先级五层（settings + permissions）："managed settings, command line, project local, shared project, user"——受管最高，"no other level, including command line arguments, can override a managed permission rule"。**一致**。
6. 权限由 harness 执行、不由模型执行（permissions § Manage permissions，Note）："Permission rules are enforced by Claude Code, not by the model. Instructions in your prompt or `CLAUDE.md` shape what Claude tries to do, but they don't change what Claude Code allows."——提示词只能影响模型**尝试**什么，改不了门禁**放行**什么。**一致**。
7. 模式层：六模式（permission-modes + how-claude-code-works）：default（Manual）/ acceptEdits / plan / auto / dontAsk / bypassPermissions；`Shift+Tab` 循环切换。教学版只有规则三档 + 问人，无模式层。**互补**。
8. auto 模式：分类器代审、看不到工具结果、已是内置起步模式（permission-modes）："a second model, the classifier, reviews actions instead of you"；"Tool results are stripped from those requests, so hostile content in a file or web page can't manipulate the classifier directly."；"With Claude Code v2.1.283 or later, auto mode is the built-in starting permission mode for interactive terminal and VS Code sessions."——**一致 + 互补（默认值更新：auto 已是交互会话起步模式）**。
9. 拒绝的回灌语义（permissions § Add a comment when you answer a permission prompt）："**No**: Claude Code sends your comment to Claude as the reason for the denial, and Claude continues working."——与课程「被拒也补一条结果再继续」一致。**一致**。
10. 整工具移除与只读 Bash 白名单（permissions § Manage permissions + § Read-only commands）："A bare tool name like `Bash` removes the tool from Claude's context entirely, so Claude never sees it."；内建只读命令集（ls/cat/echo/pwd/head/tail/grep/find/wc/which/diff/stat/du/cd + 只读 git）"runs them without a permission prompt in every mode… The set is not configurable"。——教学版 deny 只拦执行；产品 bare deny 连工具定义都移出上下文。**互补**。
11. 信任门：收紧免信任、放松需信任（permissions § Project allow rules and workspace trust）：项目文件里的 `permissions.allow` 与 `additionalDirectories` 需先接受 workspace trust 对话框才生效；"`deny` and `ask` rules aren't affected, since they only restrict."——授予权能力的规则设信任门、只收不放的规则不设门。**互补**。

## 四、s04 Hooks —— 挂在循环上，不写进循环里

### 定位与标语

- README 标语：*"挂在循环上, 不写进循环里"* — hook 在工具执行前后注入扩展逻辑。
- Harness 层定位：「**Harness 层**: hook — 扩展点不侵入循环。」
- 动机（反模式）：每加一个新行为（「记录每次 bash 调用」「操作后自动 git add」）都要修改 `agent_loop` 本身，「很快循环就认不出来了」；「你想扩展的是 Agent 的行为，但你改的却是循环本身。循环应该是一个稳定的核心，扩展应该挂在外面。」
- 结构总结：「四个 hook 覆盖了 agent cycle 的关键节点：输入→执行前→执行后→退出。循环只负责调用 trigger_hooks()，具体逻辑全在 hook 回调里。」
- 引出 s05：「Agent 现在能安全执行操作了。但它有没有停下来想过"我应该先做什么，再做什么"？…s05 TodoWrite → 给 Agent 一个计划工具。先列清单，再做。」

### 机制【一】

- **HOOKS 注册表（四事件模型）**：事件名映射到回调列表的字典，是全部扩展逻辑的挂载点。四事件：UserPromptSubmit（用户输入提交后、进 LLM 前：输入验证、注入上下文）/ PreToolUse（工具执行前：权限检查、日志记录）/ PostToolUse（工具执行后：副作用、输出检查）/ Stop（循环即将退出时：收尾清理、决定是否继续）。
  - README：「**hook 注册表**：一个字典，事件名映射到回调列表。」
  - 锚点：`code.py:128 HOOKS = {"UserPromptSubmit": [], "PreToolUse": [], "PostToolUse": [], "Stop": []}`
- **register_hook() / trigger_hooks()**：注册即挂载、触发即遍历；循环只认这两个函数，不认任何具体检查。
  - README：「扩展通过 `register_hook()` 添加，循环只调用 `trigger_hooks()`。」
  - 锚点：`code.py:130 def register_hook`；`code.py:133 def trigger_hooks`
- **返回值控制流协议（None vs 非 None）**：hook 返回 None 表示放行/无意见，返回非 None 表示干预——唯一的控制流信道；**只有 PreToolUse 与 Stop 拥有控制流权力**，UserPromptSubmit 与 PostToolUse 的返回值不参与控制流。
  - README：「`PreToolUse` 返回非 `None` 时，本次工具执行被阻止；`Stop` 返回非 `None` 时，循环继续。`UserPromptSubmit` 和 `PostToolUse` 的返回值不参与控制流。」
  - 锚点：`code.py:133-138 trigger_hooks`（`code.py:136 if result is not None`）
- **permission_hook（s03 权限逻辑迁移）**：s03 的 `check_permission()` 原封不动搬进一个 PreToolUse hook，逻辑不变、位置改变——权限从此与日志回调平级。
  - README：「s03 的权限检查逻辑现在包装成 PreToolUse hook」
  - 锚点：`code.py:153 def permission_hook`（docstring：`PreToolUse: s03 check_permission() logic moved here.`）；注册在 `code.py:205`
- **三层权限判定（hook 内）**：黑名单直接拒；破坏性命令启发式须人工确认；文件路径越出工作区须人工确认；确认默认拒绝。
  - 锚点：`code.py:142 DENY_LIST`（本章 6 条，较 s03 漂移少 `> /dev/sda`，见分歧清单）；`code.py:143-145 DESTRUCTIVE_COMMAND_WORD`；`code.py:146 DESTRUCTIVE`（3 关键词）；`code.py:166 input("   Allow? [y/N] ")`（默认 N）
- **log_hook（PreToolUse 日志）**：每次工具执行前打印调用预览（取前两个参数值、截 60 字符）。
  - 锚点：`code.py:179 def log_hook`（`code.py:181`）
- **large_output_hook（PostToolUse 大输出提醒）**：工具输出超阈值告警（「输出检查」类用途）。
  - 锚点：`code.py:185 def large_output_hook`（阈值 `code.py:187`，100000 字符）
- **context_inject_hook（UserPromptSubmit 上下文注入点）**：用户输入提交后、进 LLM 前触发；本章示例只打印当前工作目录并返回 None（`return None = no modification, let prompt through`）——文档口径「注入上下文」与本章实现（打印一行、返回值无人读）存在能力落差。
  - 锚点：`code.py:192 def context_inject_hook`；触发点 `code.py:265 trigger_hooks("UserPromptSubmit", query)`
- **summary_hook（Stop 收尾统计）**：循环即将退出时统计本次会话的工具调用次数（遍历 messages 中 tool_result 块计数）；恒返回 None（允许退出）。
  - 锚点：`code.py:197 def summary_hook`；`code.py:227 force = trigger_hooks("Stop", messages)`
- **Stop hook 强制续跑**：Stop hook 返回消息时，该消息被注入为 user 消息并 continue，循环被强行延续——hook 可以「拒绝停止」；该能力存在于协议中，本章示例未启用。
  - README：「`Stop` 返回非 `None` 时，循环继续。」
  - 锚点：`code.py:227-230`（`messages.append({"role": "user", "content": force}); continue`）
- **循环去硬化（唯一一处改动）**：agent_loop 与 s03 结构相同，唯一变动是权限调用点换成 hook 触发；权限被拒时工具得到一条 "Permission denied …" 的 tool_result——拦截也走正常消息回路。
  - README：「**循环里只改了一处**：s03 直接调用 `check_permission(block)`，s04 改为 `trigger_hooks("PreToolUse", block)`」
  - 锚点：`code.py:215 def agent_loop`；`code.py:236 blocked = trigger_hooks("PreToolUse", block)`；`code.py:245 trigger_hooks("PostToolUse", block, output)`；`code.py:212-213` 对照注释；`code.py:238-240`（拒绝回灌）

### 生产版对照【三】

本章无「深入 CC 源码」节。经轨 C 对照字段转录的【三】级主张：

- 【三】产品有「本轮已由退出钩子接管」的标志位抑制重复触发、防 Stop 钩子死循环——课程作者源码分析；官方以 `stop_hook_active` 字段 + **8 次连续续轮上限**的量化口径证实并细化（见下 4.9）。口播引用带归属句。
- 【三】产品里钩子从属于权限管线（同 s03 节转录条目；见分歧清单 D2）。

### 官方文档对照【官】

1. 钩子定义与处理器类型（hooks 首段）："Hooks are user-defined shell commands, HTTP endpoints, MCP tool calls, LLM prompts, or subagents that execute automatically at specific points in Claude Code's lifecycle. Claude Code fires the same hook events wherever it runs…"——教学版钩子 = 进程内 Python 回调；产品处理器五类（command/http/mcp_tool/prompt/agent）。**互补**。
2. PreToolUse 的位置（hooks § PreToolUse + permissions § Extend permissions with hooks）："Runs after Claude creates tool parameters and before processing the tool call."；"PreToolUse hooks run before the permission prompt, for every tool except `EndConversation`."——「前置钩子先于权限判定」的顺序获官方确认；官方另区分 PermissionRequest 事件（仅当要弹权限提示时触发）。**一致 + 互补**。
3. PreToolUse 决策四值；钩子决定不能绕过权限规则（hooks § PreToolUse decision control + permissions）："allow / deny / ask / defer"（defer 供 `-p` 子进程场景暂停/恢复）；"Hook decisions don't bypass permission rules. Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns…"——「插线口只能收紧、不能放松」逐字成立；官方另给 allow 的例外清单（no-mode-auto-approves 动作与 AskUserQuestion/ExitPlanMode 跳不过）。**一致 + 互补**。
4. 阻断钩子压过放行规则（permissions § Extend permissions with hooks）："A blocking hook also takes precedence over allow rules. A hook that exits with code 2 stops the tool call before permission rules are evaluated…"——与 4.3 合起来构成对称不变量。**一致**。
5. exit 2 / 沉默 / 超时三态（hooks § Exit code 2 / § How a hook resolves / § Timeouts）："Exit 2 means a blocking error… even a JSON `permissionDecision` of `\"allow\"` can't override it."；"staying silent doesn't approve it"（沉默不等于批准）；"A timed-out `command`, `http`, or `mcp_tool` hook doesn't block the tool call… don't count on a stalled hook to act as a gate"（超时不算拦截；默认超时 command/http/mcp_tool 600s、prompt 30s、agent 60s）。**一致 + 互补**。
6. 多钩子：并行执行 + 决策按优先级合并（hooks § Hook handler fields + § PreToolUse decision control）："All matching hooks run in parallel. If you define the same handler in more than one settings file, it runs once."；"precedence is `deny` > `defer` > `ask` > `allow`."——**对教学版构成分歧**（教学版串行 + 第一个非空短路；见分歧清单 D1）。
7. PostToolUse：成功后立即运行；有真实决策语义（hooks § PostToolUse + decision control）："Runs immediately after a tool completes successfully."；`decision: "block"` 把 reason 加在工具结果旁（Claude 仍见原始输出）；`updatedToolOutput` 只改模型所见——"The tool has already run by the time the hook fires, so any files written, commands executed, or network requests sent have already taken effect."——教学版「执行后返回值被调用方丢弃、无任何效果」与产品方向差（课程自记为教学版瑕疵）。**互补（方向性差异）**。
8. PostToolBatch：批级事件可停循环（hooks § PostToolBatch）："fires exactly once with the full batch"；"Returning `decision: \"block\"` or `continue: false` stops the agentic loop before the next model call."——产品「批」层的直接文档证据；循环外装置可终止循环的又一实例。**互补**。
9. Stop：退出否决 + 防死循环上限（hooks § Stop）：`decision: "block"` 阻止停止；`stop_hook_active` 字段；"Claude Code applies an 8-consecutive-continuation cap: after stop hooks have continued the turn eight times in a row, Claude Code overrides the next block and ends the turn."——课程「收工不是循环一个人说了算」与官方一致；官方给出量化上限。**一致 + 互补（量化）**。
10. 硬性放行/拒绝用权限系统而非钩子（hooks § Common fields，`if` 条目）："Because the `if` filter is best-effort, use the permission system rather than a hook to enforce a hard allow or deny."——**一致**。

## 分歧清单

处置默认规则：课程 vs 官方分歧，取更可核验的官方轨；口播措辞建议「课程教 X；官方文档当前说 Y」。README vs code 分歧，一律以 code.py 为准（课程 README 代码块系节选简化）。

### A. 课程 vs 官方

- **D1 · 钩子执行与合并语义**：课程 s04 教「事件 → 回调列表，按注册顺序**串行**调用，第一个返回非空的**就地短路**」，并据此可推出「权限回调先注册 → 拦截导致日志回调漏记」；官方 hooks 文档明写 "All matching hooks run in parallel" + 多决策合并 "precedence is `deny` > `defer` > `ask` > `allow`"。教学版的串行短路语义（及「漏记」推论）不描述产品行为——产品里不存在注册顺序遮蔽。口播措辞建议：「课程教按注册顺序串行、先到先短路；官方文档说全部匹配钩子并行执行、多个决策按 拒绝>延迟>询问>放行 合并」；「漏记」推论只可作教学版结构瑕疵讲，不得外推产品。
- **D2 · 权限的架构位置**：课程 s03→s04 把权限实现为 PreToolUse 回调列表的第一项（「权限不再是特权逻辑，只是众多插件中的第一个」）；官方产品中权限规则求值独立于钩子——"Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns"，钩子是权限评估的扩展/输入而非宿主（【三】源码分析同口径）。方向相反。处置：教学版写法讲成「扩展点统一」的结构演示，不得说成产品权限架构。
- **D3 · 工具执行并发**：课程 s02 教学代码严格串行（固定提交实测零并发原语、该章自身说明明写逐个执行），但仓库章节索引把「并发」列为该章关键概念；官方文档确认产品存在并行工具调用与「批」层（PostToolBatch/PostToolUse concurrent）。课程正文承诺与教学代码、与产品现状两头不符。处置：教学版「不存在同时」如实讲；产品侧只讲到「存在并行与批」这一官方披露层，批间次序与并行判定细节不披露、只能带【三】归属转述。

### B. README vs code（章内取证差异）

- **s02 分发示例**：README 示例为直取下标 `TOOL_HANDLERS[block.name]`；code.py 实实现为 `.get()` + `Unknown: {name}` 兜底。以 code.py 为准。
- **s02「bash 不受限制」**：README 结尾说 bash 不受限制、`rm -rf /` 还是能跑；code.py 的 run_bash（标注 "-- From s01 (unchanged) --"）实际存在危险命令子串黑名单与超时/截断。两条并列记录：README 指本章未给 bash 增加新防护层（黑名单为 s01 遗留且按子串匹配），不是字面「无任何拦截」。
- **s02 glob 节选缺件**：README 的 run_glob 节选未含越界过滤与空结果回退，code.py 为完整实现。
- **s03 规则一 message 措辞**：README 代码块写 "Access outside workspace"；code.py 写 "Writing outside workspace"。以 code.py 为准。
- **s04 permission_hook 摘录简化**：README 摘录只含 bash 黑名单与路径检查两分支，code.py 实际还有破坏性命令确认分支与彩色终端输出；context_inject_hook/summary_hook 的 README 摘录带 docstring 与返回类型标注，code.py 实文无。

### C. 轨间与跨章

- **续轮判据的轨间之争**：课程站点轨（旧修订）信停止标记（「停止标记不是工具调用，即返回」）vs 本集钉的 main 轨看内容块——同一课程两个修订判据相反（经轨 C §1.4 对照转录；轨拓扑见 fork-ledger §0：站点分支 = main@ac82266 冻结 +1 提交）。官方文档不披露实现层，无法裁决。口播措辞建议：「同一门课的两个修订，判据正好相反；官方文档只讲到产品级三阶段，不披露实现。」
- **跨章常数漂移（DENY_LIST）**：s03 为 7 条（含 `> /dev/sda`）→ s04 为 6 条（无此项）。随修订/跨章漂移的计数不进口播（数字纪律），引参数以本文件锚点为准。
