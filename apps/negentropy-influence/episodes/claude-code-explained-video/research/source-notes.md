# 事实源：《Learn Claude Code》工具与执行 4 章（s01–s04）· 逐章引语台账

> **本集口播的单一事实源**。逐字稿每一条断言都必须能回溯到本文件的某一节；本文件的每一条断言都必须能回溯到下列信源的具体锚点。
>
> **信源地图**：章→集归属、双轨钉选（本集钉仓库 main @ `ce8f9f18`，17 章整合版 · 171 精读轨）只登记在系列级信源地图，本文件不重述：[../../../source-map/claude-code-explained.md](../../../source-map/claude-code-explained.md)（机器版 [claude-code-explained.toml](../../../source-map/claude-code-explained.toml)）。
>
> **首要信源（171 号精读笔记）**：[../../../../../docs/research/agent-harness/171-claude-code-tooling-execution.md](../../../../../docs/research/agent-harness/171-claude-code-tooling-execution.md)——三轨证据与五个破坏性实验的完整分析。取证日：本仓 HEAD = `47e662dbb`（时为 171 最后修订；其后 `34b150526` 原地修订一次，本文件行号锚已复核全命中）。本文件凡写「171 §N」均指该文第 N 节。
>
> **提取方式与日期**：2026-10-01，字节归档 [`source-archive/ce8f9f1/`](./source-archive/ce8f9f1/)（固定提交 `ce8f9f186058939da54c9d6fead78dfb5d0fd6c3`，2026-09-28，MIT；出处表见 [source-archive/README.md](./source-archive/README.md)）；全指纹（raw/text sha256、字节数、行数）见 [sources.toml](./sources.toml)。站点页快照不在本地，站点叙事一律经 171 转引并标【二】。

## 证据分级

| 级 | 定义 | 可复核性 |
|---|---|---|
| 【一】 | 仓库实测 @ `ce8f9f18`（字节归档复算；行号锚点 `code.py:NN` 均按归档文件实际行号，本次逐条 grep 验证）。含本仓原型 [`cc_tools_lab.py`](../../../../../docs/research/agent-harness/assets/cc_tools_lab.py) 的破坏性实验结论（属本仓实测，行号锚点 `lab:NN`） | 完全可复核（归档字节 + 指纹） |
| 【二】 | 站点正文（learn.shareai.run，站点 20 章修订）。快照不在本地，全部经 171 转引（171 取快照 2026-09-30） | 经 171 间接复核 |
| 【三】 | 课程作者对 Claude Code 闭源源码的分析（材料「深入 CC 源码」层，经 171 §3–§7 转引）。**口播引用必须带归属句**（如「课程作者拆源码后发现」），CC 文件名+行号均系「材料所读时点」，闭源不可独立复核（171 §7/§10.2 口径） | 不可独立复核，须标注归属 |
| 【官】 | Anthropic 官方文档（带 URL + 访问日期 2026-09-30，经 171 参考文献转引） | 可在线复核 |

171 引用的三份官方文档（均 accessed 2026-09-30）：Hooks reference `https://code.claude.com/docs/en/hooks`；Configure permissions `https://code.claude.com/docs/en/permissions`；Settings files and precedence `https://code.claude.com/docs/en/settings`。

---

## 实测总表【一】

| 章 | 仓库 `wc -l` @ ce8f9f18 | 站点徽章【二】（171 §7） | 工具数 | 教学版钩子事件数 |
|---|---:|---:|---:|---:|
| s01_agent_loop | **151** | 102 | 1（bash，`code.py:68-76`） | —（尚无钩子层） |
| s02_tool_use | **206** | 135 | 5（`code.py:138-149`） | — |
| s03_permission | **267** | 180 | 5（`code.py:134-145`） | — |
| s04_hooks | **280** | 232 | 5（`code.py:116-127`） | 4（`code.py:137`：UserPromptSubmit / PreToolUse / PostToolUse / Stop） |

口径说明（逐条）：

- **LOC 双口径**：仓库列 = 归档 `code.py` 的 `wc -l`（含空行/注释/docstring，本次复算，与 sources.toml `lines` 字段一致）；徽章列 = 站点页首徽章宣称值，经 171 §7 转引（站点 2026-09-30 快照）。两列**不是同一版本**：徽章描述更早的教学版（171 §10.4：材料未说明口径；source-map：站点整站是课程旧修订，ISSUE-165 根因）。
- **工具数** = `TOOLS` 数组条目计数。**钩子事件数** = `HOOKS` 注册表键数（教学版 4；CC 生产版 27【三】→ 官方今日 33【官】，见 s04 节）。
- 附带口径：归档 README 行数 155 / 164 / 168 / 224（sources.toml）；`DENY_LIST` 条数按章漂移——s01/s02 为 run_bash 内置 dangerous 5 条（s01 `code.py:81`、s02 `code.py:64`），s03 独立 DENY_LIST 7 条（`code.py:156`），s04 缩为 6 条（`code.py:151`）；口播引条数必须钉章。
- README「三十多行」（s01 README:116）指 `agent_loop` 函数体内核（`code.py:96-126`），非全文件——口播引用须带此口径。

---

## 一、s01 Agent Loop —— 一个循环就够了

### 1.1 定位与标语（README 引语，逐字）

- 章标题：`s01: Agent Loop — 一个循环就够了`；页首金句（README:6）：`*"One loop & Bash is all you need"* — 一个工具 + 一个循环 = 一个 Agent。`
- Harness 层定位（README:8）：`**Harness 层**: 循环 — 模型与真实世界的第一道连接。`
- 痛点引语（README:14-20）：`模型能输出一条 bash 命令，但输出完了就停了，它不会自己跑，也不会看到结果后继续推理。`／`每一个来回，你都在做中间层。而把它自动化，就是这一章要做的事。`
- 内核宣言（README:116）：`三十多行，这就是最小可运行的 agent harness 内核。……后面 16 个章节都在这个循环上叠加机制，循环本身始终不变。`（「16 个章节」＝归档 main 17 章导航口径，README:5：`s01 → s02 → s03 → s04 → ... → s16 → s17`）
- code.py docstring 金句（code.py:23-25）：`This is the core loop: feed tool results back to the model until the model decides to stop. Later chapters add policy, hooks, and lifecycle controls around it.`
- 系统提示词行为指令（code.py:64）：`"Use bash to solve tasks. Act, don't explain."`（做，别解释）
- 安全前向声明（README:122）：`代码会执行模型生成的 shell 命令。建议在一个临时测试目录中运行，避免影响你的项目文件。s03 会加入权限控制。`
- 下章钩子（README:152）：`s02 Tool Use → 给它 5 个真正的工具，会发生什么？模型会不会一次调用多个工具？几个工具同时跑会不会互相踩？`

### 1.2 机制【一】（断言 + 归档锚点）

1. **主循环五步骨架**：`agent_loop` = 调模型 → 追加 assistant 回答 → 收集工具请求 → 执行收集结果 → 以 user 消息回喂，`while True` 驱动。锚点：`code.py:96 def agent_loop`、`code.py:97 while True:`、调模型参数（model/system/messages/tools/max_tokens=8000）`code.py:98-101`。docstring 伪代码骨架另见 `code.py:7-12`。
2. **续轮/停止判据 = 内容块**（本章最重要事实）：循环收集回答里的 `tool_use` 块，空则 `return`——不引用任何停止标记字段。**实测归档 8 文件（4 章 code.py + README）`stop_reason` 零命中**。锚点：`code.py:107-109`（`tool_calls = [block for block in response.content if block.type == "tool_use"]`）、`code.py:110-111`（`if not tool_calls: return`）。README 信号表（README:28-33）：`一个 while True 循环，模型调用工具就继续，不调用就停。循环直接检查响应里的内容块：`（含 tool_use block / 无 tool_use block 两行信号表）。
3. **assistant 先落账 + 非空结果纪律**：回答无论是否带工具请求都先追加进 messages；只有实际存在 `tool_use` 块才执行，不追加空结果消息。锚点：`code.py:104`；README:67 `只有实际存在的 tool_use block 才会进入执行阶段，因此不会追加空的工具结果消息。`
4. **tool_result 以 user 消息回喂 + id 配对**：每个结果带对应 `tool_use_id`，打包成一条 `user` 消息追加，回到第 2 步。锚点：`code.py:119-123`（results 收集）、`code.py:126`（`messages.append({"role": "user", "content": results})`）；README:82-86（第 5 步）。
5. **单 bash 工具的 JSON Schema**：工具集仅一条——name `bash`、入参仅 `command` 字符串必填。锚点：`code.py:68-76`（description `"Run a shell command."`）。
6. **run_bash 内置危险命令黑名单**（s01 已有最小拦截层，非零防护起步）：5 个危险模式子串匹配（`["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"]`），命中返回错误字符串——不执行、不抛异常、**不问人**。锚点：`code.py:80-83`（dangerous 列表 `code.py:81`）。此层与 s03 闸门不同：拦截结果以错误串回喂模型，无规则匹配与用户审批。
7. **执行防护三件套**：超时 120 秒、stdout+stderr 合并截断 50000 字符、空输出占位 `(no output)`——模型永远收到非空字符串，异常全部捕为错误串不炸循环。锚点：`code.py:84-92`（`timeout=120` 在 `code.py:86`、`out[:50000]` 在 `code.py:88`）。
8. **SYSTEM 锚定工作目录 + 行为指令**：`f"You are a coding agent at {os.getcwd()}. … Use bash to solve tasks. Act, don't explain."`。锚点：`code.py:62-65`。
9. **OS-aware 环境提示**（ce8f9f1 相对上一钉毛增 +10/11 行的主体——各删 1 行 SYSTEM、净增 +9/10，与 source-map「净增」口径互注，source-map 记 #586/#587「OS-aware shell context，无机制级变更」）：按 `os.name` 给出 Windows cmd.exe / Unix-like shell 两种环境说明。锚点：`code.py:56-61`（ENVIRONMENT_PROMPT 三元分支）。
10. **多轮 REPL 会话**：入口为交互式 REPL，`history` 列表跨提问累积，退出词 `q/exit`；会话末打印模型最终 text block。锚点：`code.py:130-151`。
11. **终端观测装修**：被执行命令黄色 ANSI 高亮打印（`$ ` 前缀）、终端只预览输出前 200 字符（完整截断内容仍回喂模型）、提示符用 `\001/\002` 零宽标记防 readline 错位。锚点：`code.py:116-118`、`code.py:137-138`（注释 `# \001/\002 tell Readline the ANSI escapes have zero display width.`）。
12. **macOS 兼容与网关自适配**：readline 四条绑定修 macOS libedit UTF-8 退格（课程仓库 issue #143）；设 `ANTHROPIC_BASE_URL` 时移除 `ANTHROPIC_AUTH_TOKEN` 并以 BASE_URL 构造客户端。锚点：`code.py:35-43`、`code.py:50-53`。

### 1.3 生产版对照【三】（经 171 §3 转引；口播必带归属句）

- 【三】CC 核心文件 `query.ts`（1729 行，材料所读时点）核心仍是这 30 行循环；续轮判据不同——CC 不拿 `stop_reason` 当唯一依据，而维护 `needsFollowUp` 标志：流式输出时 `stop_reason` 可能还没送达而 `tool_use` 块已出现在正文，看到块就置真续跑；源码注释原话 `stop_reason === 'tool_use' is unreliable`。
- 【三】其余约 1700 行是退出路径（阻塞上限、提示过长、模型报错、中止、钩子停机、轮次上限）与流式执行器等保护壳。
- 不可独立复核性（171 §10.1/§10.2 口径照交代）：「1729 行核心 = 30 行循环」是修辞性等价，材料未量化保护机制行数占比；`query.ts` 行号级论断 CC 闭源、官方文档无对应披露。

### 1.4 官方文档对照【官】

- 官方空白（171 §7）：三份官方文档均不披露续轮判据实现层（`stop_reason` / 内容块判据之争官方无法裁决）；s01 层唯一的官方可交叉项为零。口播讲到此处不得借官方背书。

### 1.5 171 增量【一】：实验 1（续轮判据分岔）

- **实验 1**（`cc_tools_lab.py:329-346`，判据开关在引擎 `lab:208`）：模拟流式响应 `stop_reason` 迟到（置 None）而正文已带工具请求——只看 `stop_reason` 的教学判据让循环**第一轮就退出、0 个工具执行**；看内容块的生产判据 3 轮跑完、2 个工具执行。171 §8 教训句（逐字）：`用迟到的信号当判据，任务半途而废`。
- 归档侧互证：源仓 main 已把运行版切到内容块判据（本节 1.2-2 的零命中实测 + 171 §3「源仓已跟进」）；站点页仍先教 `stop_reason` 两信号表、差异留给附录【二】（171 §3）——此分叉即本集钉 main 轨的原因（source-map 一节一）。

---

## 二、s02 Tool Use —— 多加一个工具，只加一行

### 2.1 定位与标语（README 引语，逐字）

- 页首金句（README:6）：`*"加一个工具, 只加一个 handler"* — 循环不用动, 新工具注册进 dispatch map 就行。`；Harness 层定位（README:8）：`**Harness 层**: 工具分发 — 扩展模型能触达的边界。`
- 痛点引语（README:14-16）：`s01 的 Agent 只有一个 bash 工具。读文件要 cat，写文件要 echo "..." > file.py，改文件要 sed。`／`模型想的是"读这个文件"，却要拼出 cat path/to/file。多了一层翻译，浪费 token，还容易拼错。`
- code.py docstring 金句（code.py:21）：`Key insight: the loop stays the same; only tool registration and dispatch grow.`
- 唯一变动口径（README:24）：`s01 的循环完全保留（LLM 调用、tool_use block 判断、消息追加）。唯一的变动在工具执行那 1 行：run_bash() 替换为 TOOL_HANDLERS[block.name]() 查表分发。`
- 下章交棒（README:159-161）：`现在 Agent 有 5 个专用工具。file tools 受 safe_path 保护，但 bash 不受限制，rm -rf / 还是能跑。`→`s03 Permission → 在工具执行之前加一道门：这个操作安全吗？需要用户批准吗？`（「bash 不受限制」与 code.py 实物的出入见分歧清单 D9）

### 2.2 机制【一】

1. **TOOL_HANDLERS 查表分发**：工具名 → 处理函数的字典，替代 s01 硬编码 `run_bash()`；对照注释原样保留两版写法。锚点：`code.py:151-156`（表定义，注释 `replaces s01's hard-coded run_bash call`）；`code.py:159-161`（s01/s02 两行对照注释：`# s01: output = run_bash(block.input["command"])` / `# s02: output = TOOL_HANDLERS[block.name](**block.input)`）。
2. **加工具两步注册契约**：`TOOLS` 数组加一条 JSON schema + `TOOL_HANDLERS` 加一行映射，循环不动。锚点：`code.py:138-149`（5 条定义；注释 `code.py:136` `one tool in s01, five in s02`）+ `code.py:153-156`；README:105 `加一个工具 = 在 TOOLS 数组加一条 + 在 TOOL_HANDLERS 字典加一行。循环不变。`
3. **软查表 + 未知工具兜底**（归档实实现）：`handler = TOOL_HANDLERS.get(block.name)`，查不到回喂 `Unknown: {name}` 让模型自纠，程序不崩。锚点：`code.py:180-181`。README:100 示例为硬索引 `TOOL_HANDLERS[block.name]`（节选简化，分歧 D10）。隐含第三契约：`handler(**block.input)` 按关键字展开 ⇒ schema 属性名必须与处理函数形参名逐字一致（`code.py:181`，代码事实）。
4. **safe_path 工作区围栏**：文件类工具路径先 resolve 再验 `is_relative_to(WORKDIR)`，越界抛 `ValueError: Path escapes workspace`；仅覆盖 file tools、不含 bash。锚点：`code.py:81-85`；README 变更表（README:134）`| 路径安全 | 无 | safe_path 校验（仅 file tools） |`。实测 grep：safe_path 命中 5 行（docstring 提及 + 定义 + read/write/edit 三处调用点）。
5. **read_file 行级读取 + limit 截断**：按行读，limit 截断附 `... ({n} more lines)` 提示。锚点：`code.py:88-95`。
6. **write_file 父目录自建 + 字节数回执**：`mkdir(parents=True)` 后写，返回 `Wrote {n} bytes to {path}`。锚点：`code.py:98-105`。
7. **edit_file 精确单次替换**：`old_text` 必须精确存在，仅替换第一处（`replace(old, new, 1)`），找不到报 `Error: text not found`。锚点：`code.py:108-117`。
8. **run_glob 递归检索 + 上限 + 越界过滤**：`**` 递归匹配、去重排序、超 200 条截断并提示收窄 pattern、过滤解析后越出工作区的路径、空结果占位 `(no matches)`。锚点：`code.py:120-133`（上限与提示 `code.py:128-130`）。
9. **多 tool_use 按原始顺序逐个执行、零并发原语**：一轮可含多个工具请求，循环按 `response.content` 原始顺序串行执行，各回一条 `tool_result`；全章无任何线程池/异步。锚点：`code.py:171-185`（收集判据 171-175、顺序执行 177-183）；README:113 `这些调用按照 response.content 中的原始顺序逐个执行。`
10. **run_bash 自 s01 原样保留**：注释明写 `# -- From s01 (unchanged) --`，dangerous 5 条黑名单与超时/截断全部继承。锚点：`code.py:61-76`（dangerous 在 `code.py:64`）。
11. **异常字符串化纪律**：四个文件工具全部 try/except 捕获为 `Error: {e}` 字符串回喂，任何工具失败都不炸循环。锚点：`code.py:94-95`、`code.py:104-105`、`code.py:116-117`、`code.py:132-133`。

### 2.3 生产版对照【三】（经 171 §4 转引；口播必带归属句）

- 【三】CC 按「连续块」分批执行多个工具：按原始顺序扫描，连续可并发的编进同一批真正并行（有并发上限），不能并发的单独开批串行，批与批之间严格保序。
- 【三】能否并发按**本次具体输入**判定、不按工具类型：`Bash ls`（只读）可并发、`Bash rm`（写）不行、`TaskCreate` 虽写任务状态但写不同文件照样可并发。
- 【三】CC 每个工具调用过五步验证：schema 校验 → 工具级参数校验 → PreToolUse 钩子 → 权限检查 → 执行。
- 【三】结果超上限落盘成「预览 + 文件路径」；读文件工具上限设为无穷大——否则「读文件 → 输出落盘 → 再读落盘文件」无限套娃（171 §10.5 注明此条系材料转述、无独立证据，教学版亦无此机制）。

### 2.4 官方文档对照【官】

- 本章无官方直接交叉条目（171 仅引 hooks/permissions/settings 三份；工具面与调度细节不在其中）。并行/批层的官方披露仅到 hooks 文档 `PostToolBatch` 一级（经 171 §2 全景图引用口径：PostToolUse 按次触发、批级事件存在），调度细节官方未披露——口播讲到产品并发只能带【三】归属句，不得写成官方口径。

### 2.5 171 增量【一】：实验 2（查表的失败形态）

- **实验 2**（`cc_tools_lab.py:349-370`；硬索引分支 `lab:229-230`、软查表对照 `lab:232-233`）：把分发表删掉 `edit_file` 项并改硬索引取值——模型再调 `edit_file` 时当场抛 `KeyError: 'edit_file'` 崩溃、整轮 tool_result 未生成；软查表 `.get` 对照只得 `Unknown: edit_file` 回喂模型自纠。171 §8 教训句：`查表的失败形态由取值方式决定`。
- 归档侧落点：s02 归档实物正是软查表形态（`code.py:180-181`）——实验 2 的「软侧对照」即仓库真实写法，「硬索引崩溃」是对 README:100 节选示例的破坏性推演。

---

## 三、s03 Permission —— 执行前做权限判断

### 3.1 定位与标语（README 引语，逐字）

- 页首金句（README:6）：`*"工具执行前先做权限判断"* — 权限管线决定哪些操作需要审批。`；Harness 层定位（README:8）：`**Harness 层**: 权限 — 在工具执行前加一道门。`
- 核心理念（README:16）：`安全边界由代码负责，判断发生在工具执行之前。`
- 起点失败模式（README:14）：`s02 的 Agent 有 5 个工具。file tools 受 safe_path 保护，但 bash 不受限制。让它"清理一下项目"，可能执行 rm -rf /。`
- 接入口径（README:24）：`s02 的循环完全保留。唯一的变动是在工具执行前插入 check_permission()。每个工具调用依次经过三道闸门：硬拒绝优先，软询问次之，都没命中就放行。`
- code.py docstring（code.py:23-25）：`Only one line added to the agent loop:`（下方即 `if not check_permission(block): continue` 伪代码）。
- 教学自认（README:42，逐字）：`这张表使用简单字符串匹配来说明权限闸门的位置，不能视为完整的安全边界。`
- 下章交棒（README:163-165）：`当前权限检查每次都在循环里硬编码 check_permission()。……这些扩展逻辑散落在 loop 里，循环很快就会膨胀。`→`s04 Hooks → 给循环加钩子，扩展逻辑挂在钩子上，循环保持干净。`

### 3.2 机制【一】

1. **三闸门管线 check_permission**：工具执行前依次过 硬拒绝 → 规则匹配 → 用户审批；任一拒绝即不执行；接入循环只加一个 if。锚点：管线 `code.py:201-212`；接入点 `code.py:236-239`；README 三闸门表（README:28-32）。
2. **闸门 1：DENY_LIST 硬拒绝（7 条，子串匹配，仅对 bash）**：`["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"]`，命中直接拒绝——不执行、不问人。锚点：`code.py:155-156`、`check_deny_list` `code.py:158-162`、「仅 bash」限定 `code.py:202`（README 未展开此限定，以代码为准）。副作用即 171 §5 分路表的「过拦」：子串 `"rm -rf /"` 同样匹配一切绝对路径递归删除（如 `rm -rf /tmp/cache` 也被拦）。
3. **闸门 2：声明式规则表（两条）**：每条规则指定工具 + 检查条件 + 消息，回答「什么时候需要问用户」。锚点：`PERMISSION_RULES` `code.py:175-183`、`check_rules` `code.py:185-189`；README:57 `**闸门 2**负责规则匹配，用来描述"什么时候需要问用户"。每条规则指定工具和检查条件。` 规则一 = 文件工具路径越出工作区；规则二 = bash 破坏性命令（词边界正则或关键词 `["rm ", "> /etc/", "chmod 777"]`）。
4. **词边界正则（DESTRUCTIVE_COMMAND_WORD）**：只在命令位（行首或 `; & | ( )` 换行之后）识别 `rm`/`del`，大小写不敏感；`model`、`delimiter` 这类假阳性不再误伤。锚点：正则 `code.py:166-168`、`contains_destructive_command` `code.py:171-172`。README 实例（README:155）：`在 Windows 上，del test.txt 和 DEL test.txt 会触发闸门 2，而 model、delimiter 和 echo del test.txt 不会。` 此正则为 main 轨相对站点修订的增量（171 §5：源仓已补、站点页未同步【二】）。
5. **规则一覆盖 read_file（工作区外检查扩到读）**：`"tools": ["read_file", "write_file", "edit_file"]`——读取工作区外路径也要问人。锚点：`code.py:176`。message 文案分歧：code.py:178 `"Writing outside workspace"` vs README:73 `"Access outside workspace"`（分歧 D11；且 read_file 命中时文案仍说 Writing，系文案滞后，以行为为准）。
6. **闸门 3：用户审批，默认拒绝**：规则命中后暂停，终端打印原因与参数，`Allow? [y/N]`——只有 `y/yes` 才放行，空回车即 deny。锚点：`ask_user` `code.py:193-197`。
7. **三道都没命中 → 直接执行**：日常大多数操作走这条路（README:34 `三道都没命中 → 直接执行。大部分日常操作走这条路。`；管线结构证据 `code.py:207-212`——两关都空过即 `return True`）。
8. **拒绝结果回喂**：被拒调用不静默消失，以 `Permission denied.` 的 tool_result 回给模型，循环继续。锚点：`code.py:236-239`。
9. **安全层的两次搬家（演进事实，防错挂）**：① run_bash 内置黑名单（s01/s02 `dangerous` 5 条）在本章 run_bash 中**已移除**（`code.py:74-81` 无 dangerous，grep 零命中）——拦截上收为独立 DENY_LIST 管线并扩到 7 条；② safe_path 在本章**整体移除**（grep 零命中），文件工具路径检查上移到闸门 2 规则一——越界从「函数级直接报错」变为「规则命中 → 问用户」。叙述时不得把 s01 的内置拦截说成「三闸门」。
10. **SYSTEM 提示词同步换血**：s03 的系统提示去掉 `"Act, don't explain."`，改为 `"All destructive operations require user approval."`——提示词层与代码层双声明。锚点：`code.py:66-69`（README 未展开，代码事实）。
11. **分发与查表自 s02 原样继承**：TOOLS/TOOL_HANDLERS/软查表兜底逐字同 s02（`code.py:132-150`、`code.py:241-242`），与「循环不变」声明互证。

### 3.3 生产版对照【三】（经 171 §5 转引；口播必带归属句）

- 【三】CC 权限结论不是三种而是**四种行为**：允许 / 拒绝 / 询问 / 「本工具不表态、交通用管线」（最后这种最终也转成询问）。
- 【三】规则不是一张本地表，而是从 **8 个来源**分层合并（用户级、项目级、本地级、功能开关、企业策略、命令行参数、内联命令、会话内授权），高优先级覆盖低优先级。
- 【三】`isDestructive()` 只管界面上的红色标签、不参与权限决策（易误会点）。
- 【三】自动模式下有一个「分类器」：把工具调用连同对话上下文发给一个判断模型决定能否自动批准，连拒太多次会回退人工（171 §5；「YoloClassifier」代号称法见分歧 D5，口播禁用代号）。
- 【三】铁律：任何环节说了「允许」都不能推翻配置里写死的「禁止」——安全决策取最严的、不取最后的。

### 3.4 官方文档对照【官】

- 权限模式谱系（permissions 文档，accessed 2026-09-30，经 171 §5 转引）：官方六模式（手动 / 接受编辑 / 计划 / 自动 / 不问 / 全跳过）正是「问多少」这个连续谱的产品化——两派争议（见开放问题 6）在产品里两端都保留。
- 设置分层覆盖（settings 文档，accessed 2026-09-30，经 171 §5/§7 转引）：官方给出与【三】8 来源同构的口径——企业托管 > 命令行 > 项目本地 > 项目共享 > 用户级。171 §7 判定：此条获官方同构支撑。

### 3.5 171 增量【一】：实验 3 + 分路表实跑

- **分路表五条命令逐条实跑**（`--pred gates`，`cc_tools_lab.py:502-513`；闸门实现对照 `lab:135-168`）：

| 命令 | 闸门 1 | 闸门 2 | 最终 |
|---|---|---|---|
| `rm -rf /` | 命中（整盘删除） | —— | 拒绝 |
| `rm -rf /tmp/cache` | **命中**（子串 `"rm -rf /"` 连带拦下一切绝对路径递归删除） | —— | 拒绝 |
| `rm -rf ./tmp/build-cache` | 未命中（相对路径） | 命中（含 `rm `） | 问用户 |
| `sudo ls` | 命中（`sudo`） | —— | 拒绝 |
| `cat /etc/hosts` | 未命中 | 未命中 | 放行 |

  两面性（171 §5）：**过拦**与**漏拦**并存——换写法、加层 shell 展开可能绕过；课程自认「简单字符串匹配不是可靠安全机制，命令变体和 shell 展开可能绕过」【二】。
- **实验 3 闸门调序**（`cc_tools_lab.py:373-409`）：把规则与问用户提到最前、硬拒绝殿后，用户顺手按一个 `y`——整盘删除命令真的被执行，虚拟文件系统 4 个文件 → 0 个。171 §8 教训句：`「永远不行」必须最先，否则被一句同意放走`。
- 补充实跑（`--pred t5`，`lab:480-499`）：DENY_LIST 删掉 `sudo` 后，`sudo chmod 777 /var/run/app` 落入闸门 2 → 问用户（按 `n` 即拒）——黑名单与规则层的互补关系可运行演示。

---

## 四、s04 Hooks —— 挂在循环上，不写进循环里

### 4.1 定位与标语（README 引语，逐字）

- 页首金句（README:7）：`*"挂在循环上, 不写进循环里"* — hook 在工具执行前后注入扩展逻辑。`；Harness 层定位（README:9）：`**Harness 层**: hook — 扩展点不侵入循环。`
- 反模式引语（README:15-34）：`但每次加一个新检查，比如"记录每次 bash 调用"、"操作后自动 git add"，都要修改 agent_loop 函数。`（README 膨胀伪代码末行注释 `# ... 很快循环就认不出来了`，README:31）／`你想扩展的是 Agent 的行为，但你改的却是循环本身。循环应该是一个稳定的核心，扩展应该挂在外面。`（README:34）
- 接入口径（README:42）：`s03 的循环和权限逻辑完全保留。唯一的变动是把 check_permission() 从循环体内移到了 hook 上，循环不再直接调用任何检查函数，改为 trigger_hooks("PreToolUse", block)，由注册表决定跑什么。`
- 四事件宣言（README:44）：`四个事件，覆盖一个完整的 agent cycle：`；结构总结（README:183）：`四个 hook 覆盖了 agent cycle 的关键节点：输入→执行前→执行后→退出。循环只负责调用 trigger_hooks()，具体逻辑全在 hook 回调里。`
- 下章交棒（README:219-221）：`Agent 现在能安全执行操作了。但它有没有停下来想过"我应该先做什么，再做什么"？`→`s05 TodoWrite → 给 Agent 一个计划工具。先列清单，再做。`（归档 main 轨 s05 = todo_write；站点 20 章轨 s05 亦为 TodoWrite——本处两轨同物，但编号纪律仍按 source-map）

### 4.2 机制【一】

1. **HOOKS 注册表（四事件）**：事件名 → 回调列表的字典，全部扩展的挂载点。锚点：`code.py:137 HOOKS = {"UserPromptSubmit": [], "PreToolUse": [], "PostToolUse": [], "Stop": []}`；README:59 `**hook 注册表**：一个字典，事件名映射到回调列表。` 四事件触发时机与典型用途表（README:46-51）：UserPromptSubmit=用户输入提交后进 LLM 前（输入验证、注入上下文）/ PreToolUse=工具执行前（权限检查、日志记录）/ PostToolUse=工具执行后（副作用如自动 git add、输出检查）/ Stop=循环即将退出时（收尾清理、决定是否继续）。
2. **register_hook / trigger_hooks**：注册即往列表追加、触发即依序执行；循环只认这两个函数、不认任何具体检查。锚点：`code.py:139-140`、`code.py:142-147`；README:53 `扩展通过 register_hook() 添加，循环只调用 trigger_hooks()。`
3. **非 None 短路协议**：回调依序执行，谁的返回值不是 `None` 谁就喊停（触发函数立即返回、后续回调不再执行）。锚点：`code.py:145`（`if result is not None:  # A hook result blocks this tool call.`）；README 代码注释（README:75）`返回值 ≠ None → hook 说"停"`。
4. **返回值语义非对称**：同为「非 None」，挂 PreToolUse 是踩刹车（本次工具不执行、拒因回喂），挂 Stop 是踩油门（消息注入对话、循环续跑）；UserPromptSubmit 与 PostToolUse 返回值不参与控制流。锚点：README:80（逐字：`PreToolUse 返回非 None 时，本次工具执行被阻止；Stop 返回非 None 时，循环继续。UserPromptSubmit 和 PostToolUse 的返回值不参与控制流。`）；代码对照 `code.py:245-249`（Pre）vs `code.py:235-240`（Stop）。
5. **permission_hook：s03 三闸门迁入回调**：s03 的权限逻辑（DENY_LIST → 正则/关键词 → 问用户；文件工具越界问用户）原封不动包进一个 PreToolUse 回调，位置改变、逻辑不变——权限从此与日志回调平级。锚点：`code.py:162-186`（docstring `code.py:163`：`"""PreToolUse: s03 check_permission() logic moved here."""`）；注册 `code.py:214`；bash 分支 `code.py:164-177`、文件分支 `code.py:178-185`。
6. **DENY_LIST 跨章漂移（6 条）**：s04 为 `["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if="]`——较 s03 少 `"> /dev/sda"`（分歧 D8）。锚点：`code.py:151`；DESTRUCTIVE_COMMAND_WORD（同 s03）`code.py:152-154`；DESTRUCTIVE 三关键词 `code.py:155`。
7. **log_hook / large_output_hook**：PreToolUse 日志回调（打印工具名+参数预览）；PostToolUse 大输出提醒（>100000 字符告警）。锚点：`code.py:188-192`、`code.py:194-198`（阈值 `code.py:196`）。
8. **context_inject_hook（UserPromptSubmit 点位）**：用户输入后、进模型前触发；本章示例只打印当前工作目录并返回 None——「注入上下文」的文档口径与本章实现（打印一行、返回值无人读）存在能力落差。锚点：`code.py:201-203`；触发点 `code.py:274`（主 REPL 循环内、append user 消息前）。
9. **summary_hook（Stop 收尾统计）**：循环将退时统计会话 tool_result 数并打印；恒返回 None（放行停机）。锚点：`code.py:206-211`。
10. **Stop 强制续跑**：Stop 钩子返回非 None 时，返回值作为 user 消息注入并 `continue`——钩子可以「拒绝停止」。**实测归档版无 stopHookActive 防护标志、无轮次封顶**：一个总返回非 None 的 Stop 钩子在教学版就是真·无限循环（生产版对照见 4.3；实验 5 见 4.5）。锚点：`code.py:235-240`（`force = trigger_hooks("Stop", messages)` / `if force:` / `messages.append({"role": "user", "content": force})` / `continue` / `return`）；README:142 代码注释 `return None = allow stop, return string = force continuation`。
11. **循环唯一改动**：agent_loop 与 s03 同构，仅权限调用点换成钩子触发；被拒调用以 `str(blocked)` 的 tool_result 回喂——拦截也走正常消息回路。锚点：对照注释 `code.py:220-222`（`# s03: if not check_permission(block): ...` / `# s04: if trigger_hooks("PreToolUse", block): ...`）；`code.py:245-249`；PostToolUse 触发 `code.py:254`；README:162 `**循环里只改了一处**：s03 直接调用 check_permission(block)，s04 改为 trigger_hooks("PreToolUse", block)`。
12. **被拒的调用连日志回调都轮不到**：注册顺序 permission_hook 先于 log_hook（`code.py:214-215`），权限回调返回非 None 即短路（`code.py:143-146`）——「谁先喊停谁负责」的自然结果。此条同时是 s04 链路实测走查（171 §6 / lab `--pred t4`）的观测点。

### 4.3 生产版对照【三】（经 171 §6 转引；口播必带归属句）

- 【三】CC 实际有 **27 个钩子事件**（工具相关、会话相关、用户交互、子代理、压缩、团队协作……；材料所读时点）；教学版只讲覆盖一个完整回合的 4 个。
- 【三】返回值从「None 与否」扩展成 **14 个字段**（阻塞错误、阻止后续、权限行为、改写输入、附加上下文……）。
- 【三】钩子说「允许」越不过配置里的「拒绝/询问」——课程称这是 CC 权限系统最重要的安全设计；教学版没有这一层，材料自认「在生产环境中会形成安全漏洞」【二】。
- 【三】`stopHookActive` 防无限循环：Stop 钩子报错后循环带标志重入，后续迭代不再被同一钩子拖着跑（官方已证实字段存在与用途并加计数上限，见 4.4）。
- 【三】PostToolUse 可以「优雅停机」：返回阻止继续的字段，让代理完成任务式收束而非崩溃。
- 【三】CC 的 State 共 10 个字段（材料所读时点），教学版只用到其中的 messages。

### 4.4 官方文档对照【官】（hooks 文档，accessed 2026-09-30，经 171 §6/§7 转引）

- **事件数已演进为 33**（材料 27 → 官方 2026-09-30 实况 33，新增消息展示、目录变更、模型切换等 6 类）——事件清单在持续生长，**口播引数字必须带日期**。
- `stop_hook_active` 字段的存在与用途获官方证实，并追加量化上限：**连续强制续跑 8 次即硬停**（防无限循环的双保险：标志之外再加计数上限）。
- 171 §7 交叉结论：27 事件数与 `stop_hook_active` 在官方文档获得交叉证实（前者已演进）；设置分层获同构支撑；**其余源码行号级论断（`query.ts:830` 一类）来自材料对闭源源码的阅读，无法独立复核**。

### 4.5 171 增量【一】：实验 4 / 实验 5 + 链路走查

- **实验 4 返回值语义反转**（`cc_tools_lab.py:412-441`）：把「None 当放行」反转成「None 当阻止」——0 个工具成功执行（本应放行的日常读取也进不来），Stop 钩子被劫持成无限续跑直到 50 轮封顶。171 §8 教训句：`「非 None 才喊停」是全部扩展共享的契约`。
- **实验 5 拿掉防循环标志**（`cc_tools_lab.py:444-458`；防护逻辑在引擎 `lab:210-220`）：一个总在报错的 Stop 钩子（永远要求续跑）——无 `stopHookActive` 防护：冲到 100 条消息封顶不停；有防护：3 条消息内正常停机。171 §8 教训句：`防循环标志是停机权的最后一道闸`。归档互证：教学版实物即无防护形态（4.2-10），生产版防护属【三】+【官】。
- **s04 全链路走查实跑**（`--pred t4`，`lab:462-477`）：`rm -rf ./tmp/build-cache` 在 s04 引擎里的完整链路（171 §6 逐字取自实测日志）：用户输入过 UserPromptSubmit（打印工作目录）→ 模型举手 → PreToolUse 链按注册序执行：权限回调先跑、命中规则问用户 → 答 `y` 权限回调返回 None（放行）→ 轮到日志回调打印 → 查表执行 → PostToolUse 检查输出 → 结果以 user 消息回喂 → 下一轮无新请求则 Stop 统计后放行停机。
- 附：原型 selftest（`lab:292-325`）断言「三轮后正常停止、4 条 tool_result、两次运行日志逐字节一致（确定性）」。

---

## 分歧清单（处置默认规则：课程 vs 官方取官方轨；README vs code 一律以 code.py 为准；随章/随修订漂移的计数不进口播）

### A. 轨间与数字口径（口播必读）

- **D1 · LOC 徽章 vs 仓库实测**：站点徽章 102/135/180/232【二】vs 归档 `wc -l` 151/206/267/280【一】——两版课程，徽章描述更早教学版（171 §10.4：材料未说明口径）。处置：**口播用站点 102 系作教学叙事进度尺并说明口径**（「站点叙事版 100 来行」），本台账并记双口径；不把 151 系说成站点数字。
- **D2 · query.ts 行数两口径**：站点附录口径 3300+【二，任务转引，站点快照不在本地未复核】vs 171 转述材料核查 1729【三，材料所读时点】。处置：**口播不引任何具体行数**；如需体量对比只说「千行级的核心文件」量级并带归属句。
- **D3 · 并发默认数**：站点口径 3 vs 官方文档口径 10（两数字均为任务转引口径，归档与 171 均未载具体值，171 §4 只说「有并发上限」）。处置：**口播不引任何并发默认数**，只讲「连续块分批、批内并行有上限」的机制层（带【三】归属句）。
- **D4 · hooks 事件数 27 → 33**：材料所读时点 27【三】→ 官方 2026-09-30 实况 33【官】。处置：**带日期读**（「课程作者拆的时候是 27 个；官方文档今天已经列到 33 个」）。
- **D5 · 「YoloClassifier」代号**：归档 8 文件 grep `yolo`（不区分大小写）**零命中**；171 §5 亦只称「分类器」。处置：**口播用「自动模式里的分类器」**，禁用代号。
- **D6 · 编号与导航**：归档（main 17 章轨）README 导航 `s01 → … → s16 → s17`（s01 README:5；s04 README:5 的 s05 链接为 `../s05_todo_write/`）；站点为 20 章修订；另有旧 12 课历史轨（171 版本与信源说明；source-map 二节「三轨三物」撞号表）。处置：站点页内出现的旧导航/旧编号交叉引用**按现行站点 20 章编号理解**，涉两轨同号一律「轨道 + 章全称」，归属以 source-map 为唯一事实源。
- **D7 · 续轮判据的轨间之争（本集钉 main 的原因）**：站点 s01 教「续轮看 stop_reason」两信号表、差异留给附录【二】（171 §3/§9 争议 2）；归档 main 已改为看内容块且 `stop_reason` 全仓零命中【一】。处置：机制叙述以归档（main）为准，「站点还教旧判据」本身可作为课程内部分层的叙事点；官方不披露实现层、无法裁决（171 §7）。

### B. README vs code.py（章内取证差异，以 code.py 为准）

- **D8 · DENY_LIST 跨章漂移**：s03 = 7 条（含 `"> /dev/sda"`，`s03 code.py:156`）→ s04 = 6 条（`s04 code.py:151`）；s01/s02 则是 run_bash 内置 dangerous 5 条（含 `"> /dev/"`）。处置：口播引条数必须钉章，或不念具体数字（计数随修订/跨章漂移）。
- **D9 · s02「bash 不受限制」**：README:159 称 `bash 不受限制，rm -rf / 还是能跑`；code.py 实物（标注 `-- From s01 (unchanged) --`，`s02 code.py:63-66`）存在 5 条危险子串黑名单，`rm -rf /` 恰在其中会被拦。处置：按 code.py 叙述；README 语义理解为「本章未给 bash 增加新的权限层（黑名单系 s01 遗留且按子串匹配、可绕过）」，不是字面「无任何拦截」。
- **D10 · s02 分发示例**：README:100 为硬索引 `TOOL_HANDLERS[block.name]`；code.py 实实现为 `.get()` + `Unknown: {name}` 兜底（`s02 code.py:180-181`）。处置：以 code.py 为准；硬索引形态仅作实验 2 的破坏性对照（2.5 节）。
- **D11 · s03 规则一 message 文案**：README:73 `"Access outside workspace"` vs code.py:178 `"Writing outside workspace"`；且规则一 tools 已含 read_file（code.py:176）而文案仍说 Writing。处置：以 code.py 行为为准，口播不逐字念该 message。
- **D12 · s01 内置拦截 ≠ 三闸门（防错挂）**：s01/s02 的 run_bash 内置黑名单（错误串回喂、不问人）与 s03 三闸门（硬拒→规则→问人）是两层不同机制；s03 起 run_bash 黑名单与 safe_path 均移除、上收为管线（3.2-9）。处置：叙述严格按章演进，不得说「s01 就有权限系统」。

## 开放问题（转引 171 §9「核心争议」与 §10「材料没有证明的事」）

1. **「1729 行核心就是 30 行循环」是修辞性等价**：材料未量化保护机制行数占比，「核心」是教学定位而非测量结论（171 §10.1）——口播引用须带归属句与「材料口径」限定。
2. **源码行号级论断不可独立复核**：`query.ts:830-834` 一类均来自材料对 CC 闭源源码的阅读；官方文档只能部分交叉（`stop_hook_active` 已证实、事件数已演进）（171 §10.2）。
3. **教学闸门的边界本身在移动**：字符串匹配可被绕过系材料自认，但绕过面未量化；源仓已补词边界正则而站点未同步（171 §10.3）。
4. **站点徽章与源仓实况不同版**，材料未说明口径（171 §10.4；即 D1）。
5. **「读文件工具上限无穷大防落盘套娃」是材料转述**，无独立证据；教学版无此机制亦无实验（171 §10.5）。
6. **争议：权限审批自动化到什么程度**——手动派（危险边界必须人把关）vs 分类器派（自动批、连拒才回退人工）；两派看到不同失败模式（自动放行的破坏 vs 审批疲劳），是「误放行代价 × 误打扰代价」的连续谱选址，不可消解只可对冲；官方把两端都留在产品里（171 §9 争议 1）。
7. **争议：第一课的续轮判据教哪个**——概念最简（stop_reason 一个字段）vs 行为最真（数内容块，流式下不踩坑）；课程解法是分层（正文教字段、附录揭差异），实验 1 把差异做成可运行分岔（171 §9 争议 2）。
8. **争议：钩子的能力边界**——一派当全能扩展点、一派坚持钩子只能「看」；生产裁决是「能力给足、否决权不给」（钩子的允许翻不了配置的案），教学版省略此层且材料自认会成安全漏洞（171 §9 争议 3）。

---

## 验收自检（写完后逐条回溯复核；抽 10 条断言 → 命中位置）

| # | 抽检断言（出处节） | 级 | 回溯命中（本次 grep/nl 实测） | 归属句义务 |
|---|---|---|---|---|
| 1 | s01 续轮判据 = 内容块、stop_reason 归档零命中（1.2-2） | 【一】 | `s01_agent_loop/code.py:107-111`（grep 命中 L107/108/110）；归档 8 文件 grep `stop_reason` zero hits | — |
| 2 | s02 软查表 + Unknown 兜底（2.2-3） | 【一】 | `s02_tool_use/code.py:180-181`（grep 命中 L180/181） | — |
| 3 | s03 DENY_LIST 7 条（3.2-2 / D8） | 【一】 | `s03_permission/code.py:156`（grep 命中，7 元素逐字） | — |
| 4 | s04 DENY_LIST 漂移为 6 条（4.2-6 / D8） | 【一】 | `s04_hooks/code.py:151`（grep 命中，无 `> /dev/sda`） | — |
| 5 | s04 Stop 续跑无防护标志（4.2-10） | 【一】 | `s04_hooks/code.py:235-240`（grep 命中 L236-238；L239 `continue`、L240 `return`，全文件无 stop_hook/active 字样） | — |
| 6 | CC needsFollowUp + 注释原话「stop_reason === 'tool_use' is unreliable」（1.3） | 【三】 | 171:125（§3，grep 命中该行含原话与 needsFollowUp） | **已标注**：1.3 节首行「口播必带归属句」+ 不可独立复核交代 |
| 7 | CC 权限规则 8 来源分层合并（3.3） | 【三】 | 171 §5（171:183：8 个来源列举 + 高优先级覆盖） | **已标注**：3.3 节首行归属义务 + 「材料所读时点」 |
| 8 | CC 连续块分批并发 + 五步验证（2.3） | 【三】 | 171 §4（171:150：分批/按输入判并发/五步验证） | **已标注**：2.3 节首行归属义务 |
| 9 | 官方 hooks 事件 33 个 + 续跑 8 次硬停，访问日期 2026-09-30（4.4 / D4） | 【官】 | 171:216（33 个、新增 6 类）、171:229/232（8 次上限）；URL `code.claude.com/docs/en/hooks`（171:324） | —（带日期已满足） |
| 10 | 站点徽章 102/135/180/232（实测总表 / D1） | 【二】 | 171:226（§7 表首行：站点页首徽章，2026-09-30） | — |
| 11（附） | 「YoloClassifier」归档零命中（D5） | 【一】 | 归档目录 grep `-i yolo` zero hits（本次实测） | — |
| 12（附） | 实验 3 调序致 VFS 4→0 文件（3.5） | 【一】 | `cc_tools_lab.py:373-409`（exp3；L407 打印 `before -> after`）；171 §8 表行 3 | — |

【三】级抽检 3 条（#6/#7/#8）逐条确认已在正文标注归属句义务与「材料所读时点/不可独立复核」交代。

**断言总数（分项）**：机制【一】46 条（s01 12 + s02 11 + s03 11 + s04 12）；【三】19 条（s01 2 组 + s02 4 + s03 5 + s04 6，含 2 条注明转述无独立证据）；【官】交叉 5 条（33 事件 / 8 次上限 / stop_hook_active 证实 / 模式谱系 / 设置分层）；171 实验结论 7 条（实验 1–5 + 分路表 + t4/t5 走查）；分歧 12 条（D1–D12）；开放问题 8 条。合计 **97 条**。所有计数类断言（LOC/工具数/事件数/条数/阈值）均已写明口径。
