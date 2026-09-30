# 事实源：《Learn Claude Code》记忆管理 2 章

> **本集口播的单一事实源**。逐字稿中每一条断言都必须能回溯到本文件的某一节。
>
> **信源双轨与修订分叉**：章节归属与双钉（本集钉 `67a9126`，站点同源修订（20 章版））只登记在系列级信源地图，本文件不重述：见 [../../../source-map/claude-code-explained.md](../../../source-map/claude-code-explained.md)。
>
> **证据分级**：【一】仓库实测（@ 67a9126，可复算）／【二】站点正文／【三】课程作者对 Claude Code 源码的分析（口播必带归属句 + 画面角标）／【官】Anthropic 官方文档（产品现状口径，域名已迁 code.claude.com）。
>
> **提取方式**：2026-09-28 五维度重调研（钉点逐章 curl 取原文）；字节归档 `research/source-archive/67a9126/`；指纹见 [sources.toml](./sources.toml)。图片纪律：站点 SVG 不下载不嵌入，只转文字规格。
>
> **轨道分叉提示（写给撰稿人，不进口播）**：本集两章编号与旧 12 课轨撞号（旧 s08=Background Tasks、旧 s09=Agent Teams），涉编号一律写「站点轨 + 章全称」。仓内精读 [173](../../../../../docs/research/agent-harness/173-claude-code-memory-management.md) 的机制正文与本集同钉站点轨 `67a9126`；其 main 轨演进注记（`f9e8b28`→`0dcafa2a`）与本集钉点在「看不见的守卫 / 占位符指针 / 注入位置」三处实现不同（见各章「轨道差异」注记），引用其 main 轨结论前先对表。

---

## 实测总表（【一】· 2026-09-28 @ 67a9126）

| 章 | code.py 总行 | 非空非注释 | 工具数（主 Agent `TOOLS`） |
|---|---:|---:|---:|
| 站点轨 s08_context_compact | 534 | 422 | 9（bash / read_file / write_file / edit_file / glob / todo_write / task / load_skill / compact） |
| 站点轨 s09_memory | 655 | 528 | 6（bash / read_file / write_file / edit_file / glob / task） |

口径附注：

- 总行 `wc -l code.py`；非空非注释 `grep -cvE '^\s*(#|$)' code.py`（docstring 计入）；工具数按 `TOOLS` 列表定义条目数。另各有子 Agent 工具池：s08 `SUB_TOOLS` 5 个、s09 `SUB_TOOLS` 3 个（bash/read_file/write_file）。
- README 行数：s08 实测 310（`wc -l`，与台账一致）；s09 README 台账记 280。
- **数字纪律**：口播不引绝对行数/活数据；本表仅供撰稿人体量感与核对。课程/站点自标数字与实测不符时记入分歧清单（本集未发现）。

---

## 一、站点轨 s08_context_compact —— Context Compact：上下文总会满，要有办法腾地方

### 定位与标语

README 顶部引言块逐字：

> # s08: Context Compact — 上下文总会满，要有办法腾地方
>
> > *"上下文总会满, 要有办法腾地方"* — 四层压缩策略, 便宜的先跑贵的后跑。
> >
> > **Harness 层**: 压缩 — 干净的记忆, 无限的会话。

本章处理「上下文耗尽」：Agent 能力够，但「每条命令的输出、每个文件的内容，全都堆在 `messages` 列表里」，而「上下文窗口是有限的。满了之后，API 直接拒绝：`prompt_too_long`」——「不压缩，Agent 根本没法在大项目里干活」。方案是「四层压缩管线 + 一条应急通道」，设计哲学一句话贯穿全章：**「便宜的先跑，贵的后跑」**——前三层「纯文本/结构操作，0 API 调用」，第四层才花 1 次 API 调用。压缩的副作用（用户偏好与约束跟着丢）直接引出下一章 Memory。在本书递进中，s08 保留 s07 的 hook 结构、技能加载、子 Agent 骨架，省略部分工具细节以聚焦压缩。

### 机制【一】

#### M-1. L1 snip_compact（裁掉中间旧消息）

- **一句话**：消息条数超阈值时，保留头部「初始上下文」+ 尾部「当前工作」，中间整段换成一条占位消息，且不拆散 tool_use/tool_result 配对。
- **README 引语**：「消息数超过 50 条 → 保留头部 3 条（初始上下文）和尾部 47 条（当前工作），中间裁掉；唯一额外边界条件是，不能把 `assistant(tool_use)` 和后面的 `user(tool_result)` 拆开」。
- **code.py 锚点**：`code.py:305 def snip_compact(messages, max_messages=50)`；头尾边界保护 `:309-315`；head/tail 交叠守卫 `:316-317`（`if head_end >= tail_start: return messages`，README 未展示）；占位串 `:319`（`"[snipped {snipped} messages]"`）。
- **关键参数**：阈值 50 条；保头 3 / 尾 47。参数属教学简化值，见「生产版对照」第 3 条。

#### M-2. L2 micro_compact（旧工具结果占位）

- **一句话**：只保留最近几条 tool_result 的完整内容，更旧的超过一定长度就替换成一行占位符。
- **README 引语**：「只保留最近 3 条 `tool_result` 的完整内容，更旧的替换为一行占位符」；占位符常量 `KEEP_RECENT_TOOL_RESULTS = 3`、长度门 `> 120`、占位文本 `"[Earlier tool result compacted. Re-run if needed.]"`。
- **code.py 锚点**：`code.py:276 KEEP_RECENT = 3`（README 命名有漂移，见分歧 A1）；`code.py:323 def collect_tool_results`；`code.py:332 def micro_compact`；`:336` 长度门；`:337` 占位文本。
- **关键参数**：窗口 3 条；长度门 120 字符。
- **占位符形态（本钉点重要事实）**：站点钉的占位符是「重跑提示」型——不携带落盘路径；已在 L3 落过盘的大结果一旦滑出最近 3 条窗口，同样被压成这行通用提示，**上下文里的指针随之消失**（磁盘文件仍在）。携带路径的「saved at」型占位符是 main 轨后续演进（见「轨道差异」注记）。

#### M-3. L3 tool_result_budget（大结果落盘）

- **一句话**：统计最后一条 user 消息里 tool_result 总大小，超预算就把最大的块写到磁盘，上下文里只留标记 + 预览。
- **README 引语**：「统计最后一条 user 消息里所有 `tool_result` 的总大小。超过 200KB → 按大小排序，从最大的开始落盘到 `.task_outputs/tool-results/`，上下文里只留 `<persisted-output>` 标记 + 前 2000 字符预览。模型看到标记后知道完整内容在磁盘上，需要时可以重新读。」
- **code.py 锚点**：`code.py:349 def tool_result_budget(messages, max_bytes=200_000)`；`code.py:342 def persist_large_output`（`:347` 返回 `<persisted-output>` + `output[:2000]` 预览）；`:277 PERSIST_THRESHOLD = 30000`；`:359` 只落盘超过 30000 字符的块（README 代码块未展示该跳过逻辑）。
- **关键参数**：批次预算 200KB；单块落盘门槛 30000 字符；预览 2000 字符。作用域只有**最后一条 user 消息**。

#### M-4. L4 compact_history（LLM 全量摘要）

- **一句话**：三层便宜手段用尽仍超阈值时，先把完整对话写盘留档，再用一次 LLM 调用把历史浓缩成一条摘要消息替换全部旧消息。
- **README 引语**（三步流程逐字）：「**保存 transcript**：完整对话写入 `.transcripts/`，JSONL 格式。……教学代码没有提供 transcript 检索工具。」「**LLM 生成摘要**：把对话历史发给 LLM，要求保留当前目标、重要发现、已改文件、剩余工作、用户约束等关键信息。」「**替换消息列表**：所有旧消息被替换为一条摘要。教学版只保留摘要；真实 Claude Code 会在 compact 后重新附加部分最近文件、计划、agent/skill/tool 等上下文。」
- **code.py 锚点**：`code.py:385 def compact_history`；`code.py:367 def write_transcript`（`:369` 文件名 `transcript_{int(time.time())}.jsonl`）；`code.py:374 def summarize_history`（`:375` 对话序列化截断 `[:80000]` 字符；`:377-378` 摘要 prompt 要求 5 类信息：current goal / key findings/decisions / files read/changed / remaining work / user constraints；`:379` `max_tokens=2000`）；`:389` 返回单条 `[Compacted]` 消息。
- **边界表述（README 逐字）**：「transcript 保留了可恢复记录，但模型的活跃上下文里只剩摘要。对模型当下推理来说，细节已经不在上下文中了。」

#### M-5. reactive_compact（应急压缩）

- **一句话**：API 已经报 `prompt_too_long` 之后的兜底——保存 transcript、保留最近约 5 条原始消息、只对更早历史做 LLM 摘要。
- **README 引语**：「触发方式比 compact_history 更激进（API 报错后的应急手段），但压缩策略更温和，保留最近约 5 条原始消息，只总结较早历史。同样避免留下孤立 `tool_result`。」；「reactive compact 有重试上限（默认 1 次）。再失败就抛出异常，不无限循环。」
- **code.py 锚点**：`code.py:393 def reactive_compact`；`:395` 保留尾部 5 条；`:396-399` 孤立 tool_result 边界保护；`:462 MAX_REACTIVE_RETRIES = 1`；`:482` 捕获含 `prompt_too_long` / `too many tokens` 的异常进入应急；`:480` 成功调用后重置计数（README 未展示）。
- **关键参数**：保尾 5 条；重试上限 1 次。

#### M-6. compact 工具（模型主动压缩）

- **一句话**：工具列表第 9 个工具，模型可主动调用触发全量摘要，结束当前 turn、以压缩后的上下文开新一轮。
- **README 引语**：变更表「工具 | bash, read, write, edit, glob, todo_write, task, load_skill (8) | 8 + compact (9)」。
- **code.py 锚点**：`code.py:425-427` 工具定义（description `"Summarize earlier conversation to free context space."`，参数 `focus` 可选）；compact 不在 `TOOL_HANDLERS`（`:430-434` 无该键），由 agent_loop 专用分支处理：`:498-503`（调 compact_history、回 tool_result `"[Compacted. Conversation history has been summarized.]"`、`break` 结束当前 turn）。

#### M-7. 预处理器执行顺序 + 字符数 token 估算（管线骨架）

- **一句话**：每轮 LLM 调用前按 budget → snip → micro 顺序跑三层便宜压缩，之后才按阈值决定是否 LLM 摘要；token 用字符数估算。
- **README 引语**：「**顺序不能换。** L3（budget）在 L2（micro）前面，因为 micro 会把旧的大 tool_result 替换成一行占位符，budget 必须在那之前把完整内容落盘。这也是为什么 CC 源码把 `applyToolResultBudget` 放在最前面。」
- **code.py 锚点**：`code.py:469-471`（budget → snip → micro 三连）；`:474` 阈值判断 `estimate_size(messages) > CONTEXT_LIMIT`；`:275 CONTEXT_LIMIT = 50000`；`:279 def estimate_size(msgs): return len(str(msgs))`；`:475` 打印 `[auto compact]`、`:483` 打印 `[reactive compact]`。
- **关键参数**：`CONTEXT_LIMIT = 50000`（字符口径）。
- **关联边界**：子 Agent 不参与压缩——`code.py:122` 注释「s08: subagent gets its own system prompt — no compact, no skill loading」，`SUB_TOOLS` 仅 5 个基础工具（`:220-231`），子 Agent 循环上限 30 轮（`:238`）。

**轨道差异注记（不进口播，写给撰稿人）**：main 轨 `f9e8b28` 起为类实现（`ContextCompactor`），micro_compact 多出「看不见的守卫」（最后一条 assistant 之后的 tool_result 不压）与「路径提取」（从 `Full output:` 行提取路径、占位符写成 `[Earlier tool result saved at <path>]`）；`0dcafa2` 再修复幂等并新增 `fit_tool_results`。本集钉的站点轨**没有**这些——M-2 的占位符形态以此处为准。

### 风险与防护【一】（本章）

1. **配对不可拆散**：snip 头尾切口与 reactive 尾切点都做边界保护，避免孤立 `tool_result`（API 请求非法）。
2. **层序不可换**：见 M-7 引语——先落盘再占位。
3. **熔断器**：README 声明「连续失败 3 次后停止重试，防止死循环浪费 API 调用」——**code.py 未见对应实现**（无连续失败计数器，仅有 reactive 重试上限）。处置见分歧 A3。
4. **reactive 重试上限**：默认 1 次，再失败异常外抛。
5. **压缩即遗忘**：「上下文压缩让 Agent 能跑很久不会崩。但每次压缩后，用户之前告诉它的偏好、约束也跟着丢了。」（引出 s09）
6. **transcript 留而难用**：存档与记忆是两回事（M-4 边界表述）。
7. **重读代价与缓存**：「代价是可能多一次工具调用，也可能降低 prompt cache 命中率。」
8. **token 口径局限**：字符数估算；增长快于压缩触发时仍会 413，故有 reactive 兜底。
9. **head/tail 交叠保护**：交叠即不裁（`:316-317`）。
10. **子 Agent 无压缩**：上下文独立、30 轮上限。

### 生产版对照【三】（「深入 CC 源码」逐条转抄；课程声明基于 CC 源码 `compact.ts`、`autoCompact.ts`、`microCompact.ts`、`query.ts` 的分析）

> 归属义务：本小节所有断言**口播必带归属句**（如「按课程作者对 Claude Code 源码的分析」）+ 画面角标；CC 文件行号只保留在本小节，不进口播正文。

| # | 断言 | CC 锚点 |
|---|---|---|
| 1 | 执行顺序总表：budget → snip → micro → collapse → auto（`query.ts:379-468`）；「教学版的 L1/L2/L3/L4 是讲解编号，实际执行顺序和编号不完全对应」 | `query.ts:379-468` |
| 2 | 分步锚点：`applyToolResultBudget`（`:379`）→ `snipCompact`（`:403`）→ `microcompact`（`:414`）→ `contextCollapse`（`:441`，教学版无）→ `autoCompact`（`:454`）；教学版 budget → snip → micro 顺序与此一致 | `query.ts` 各行 |
| 3 | snip 仅主线程启用、实现不在开源仓库（`HISTORY_SNIP` feature gate），但接口可见：`snipCompactIfNeeded(messages)` → `{ messages, tokensFreed, boundaryMessage? }`，并暴露 `SnipTool` 让模型主动调用；教学版 3/47 是简化参数 | 对照表（无行号） |
| 4 | micro 两条路径：time-based 直接清内容、cached 走 API `cache_edits`（legacy path 已移除）；time-based 按时间阈值触发、cached 按计数触发 | `microCompact.ts`（无行号） |
| 5 | budget 常量：CC tool_result budget = 200,000 字符 | `toolLimits.ts:49` |
| 6 | compact 阈值口径：精确 token，`contextWindow - maxOutputTokens - 13_000`（13,000 对应 `AUTOCOMPACT_BUFFER_TOKENS`） | `autoCompact.ts:62` |
| 7 | 摘要要求：9 个部分 + `<analysis>`/`<summary>` 双标签（教学版 5 类信息）；「analysis 在格式化时被剥离」 | 对照表 |
| 8 | 压缩 prompt 防呆：「绝对禁止调用工具：开头就是 `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.`，末尾还会再 REMINDER 一次」 | 对照表 |
| 9 | PTL retry：`truncateHeadForPTLRetry()` 按消息组回退 | `compact.ts:243-290` |
| 10 | 后压缩恢复：自动重新读取最近文件、计划、agent/skill/tool 等（教学版无） | 对照表 |
| 11 | 熔断器：3 次（`MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES`） | `autoCompact.ts:70` |
| 12 | reactive 重试：CC 有更精细的分级重试 | 无行号 |
| 13 | Read 取舍：CC 把 `Read` 放进可 microcompact 集合，但维护 `readFileState`——重复读取未变化文件返回 `FILE_UNCHANGED_STUB`，compact 后按预算恢复最近读过的文件（最多 5 个文件、每个 5K token、总预算 50K token） | 对照表 |
| 14 | contextCollapse：独立上下文管理系统，启用时抑制 proactive autocompact（`autoCompact.ts:215-222`），由 collapse 的 commit/blocking 流程接管；manual `/compact` 与 reactive fallback 不受影响 | `autoCompact.ts:215-222` |
| 15 | 常量表：`AUTOCOMPACT_BUFFER_TOKENS`=13,000（`autoCompact.ts:62`）；`MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES`=3（`:70`）；`MAX_OUTPUT_TOKENS_FOR_SUMMARY`=20,000（`:30`）；`POST_COMPACT_TOKEN_BUDGET`=50,000（`compact.ts:123`）；`POST_COMPACT_MAX_FILES_TO_RESTORE`=5（`:122`）；`POST_COMPACT_MAX_TOKENS_PER_FILE`=5,000（`:124`）；时间 micro_compact 间隔=60 分钟（`timeBasedMCConfig.ts`）；`MAX_COMPACT_STREAMING_RETRIES`=2（`compact.ts:131`） | 各行 |
| 16 | sessionMemoryCompact：compact_history 之前，CC 先尝试用已有 session memory（s09 讲）做轻量摘要、不调 LLM | 对照表 |
| 17 | 课程自陈简化清单（「教学版的简化是刻意的」）：micro 用文本占位（无 API 层 `cache_edits` 权限）；read_file 不特殊处理（接受必要时重读）；token 字符估算；后压缩恢复省略；contextCollapse / sessionMemoryCompact「属于 10% 的细节」不展开。「核心设计思想，便宜的先跑贵的后跑，完整保留。」 | README |

### 官方文档对照【官】（轨 C · 2026-09-28 抓取；编号沿用轨 C 事实清单）

| 官 | 官方说 | 课程教 | 判定 |
|---|---|---|---|
| 23 | 现行官方文档（7 页全文＋全站检索）**无 "microcompact" 一词**；机制表述为 "It clears older tool outputs first, then summarizes the conversation if needed. Your requests and key code snippets are preserved; detailed instructions from early in the conversation may be lost." | 把「清旧工具结果」那步称作 L2 micro_compact | 机制一致、**术语分歧**（分歧 B4） |
| 24 | "Claude Code compacts automatically as you approach the limit, so a full context window doesn't end your session." 自动压缩与手动 `/compact` 同机制 | 阈值触发的 `[auto compact]`；compact 工具 | 一致 |
| 25 | 默认阈值按模型窗口：200K 边界提前压；原生 1M 窗口模型默认约 967K tokens 压 | 字符数 `CONTEXT_LIMIT = 50000` 扁平阈值 | 互补（教学简化 vs 产品参数；官方未公布预留常数值） |
| 26 | 阈值可调：`/autocompact 500k`、`--autocompact` flag、`autoCompactWindow` 设置、`CLAUDE_CODE_AUTO_COMPACT_WINDOW` 环境变量（100K–1M） | 无可调面 | 互补 |
| 27 | 摘要请求形态："a separate request with the same system prompt, tools, and history as your conversation, plus a summarization instruction appended as a final user message"；缓存暖时 `/compact` 成本远低于上下文规模所示 | 一次独立 LLM 调用浓缩历史 | 一致·互补 |
| 28 | 摘要请求继承会话的 extended thinking 配置（v2.1.198+） | 无此面 | 互补 |
| 30 | 压缩后重读至多 5 个最近读过/改过的文件；超 5,000 token 的文件回来只剩路径引用（`Referenced file`） | 教学版无后压缩恢复（README 自认） | 一致·互补（指针换空间的官方落地） |
| 31 | 已调用技能体重注入：每技能 ≤5,000 token、总计 ≤25,000 token，最旧先丢 | 无技能面 | 互补 |
| 32 | 主动压缩三入口：`/compact` 带焦点指令（如 `/compact focus on the auth bug fix`）、`/rewind` 局部摘要、CLAUDE.md `# Compact instructions` 节 | compact 工具 + 自动 + 应急；无用户焦点指令面 | 互补 |
| 33 | 抖动守卫：单文件/工具输出大到「摘要后立刻 refill」时，几次尝试后停止并报错 | 应急只补救一次、再失败外抛 | 一致·互补（触发条件口径不同：课程=API 拒绝，官方=thrashing） |
| 34 | 多模态批量移除：超限时按批移除最旧的图片/PDF，移除后模型不可见，需要再共享 | 占位符化只处理文本工具结果 | 互补 |
| 35 | 压缩重写历史 → 缓存会话层必然失效，记为 expected rebuild；"clearing old tool results from context" 同样计入 | 「可能降低 prompt cache 命中率」 | 一致·互补 |
| 36 | 闲置大会话 resume 时提供 "Resume from summary" 选项（立即 `/compact`，恢复摘要+最近交流+至多 5 个最近读的文件） | 无 resume 面 | 互补 |
| 40 | hook 输出超 10,000 字符落盘＋预览＋路径 | L3 落盘＋`<persisted-output>` 预览 | 一致·互补（官方仅在 hook 场景明文） |
| 41 | 后台会话摘要作业（为 `claude --resume` 服务）即使空闲也耗 token | 无 | 互补 |
| 37/38/39 | **「落盘」消歧**：官方的转录落盘＝完整会话记录（消息+工具用+结果）持续写 plaintext JSONL 至 `~/.claude/projects/<project>/<session-id>.jsonl`，支撑 rewind/resume/fork；默认 30 天保留（`cleanupPeriodDays`）、可抑制写盘；格式内部、随版本变 | 课程 `.transcripts/` 是压缩时的一次性归档 | 互补（两处「落盘」所指不同，口播须消歧，分歧 B7） |

### 叙事素材（口播备料，引语逐字）

- **金句**：「不压缩，Agent 根本没法在大项目里干活。」／「上下文窗口是有限的。满了之后，API 直接拒绝：`prompt_too_long`。」／「便宜的先跑，贵的后跑。」（code.py 文档串 `Core principle: cheap first, expensive last.`）／「干净的口袋、无限的会话」（Harness 层标语原文为「**Harness 层**: 压缩 — 干净的记忆, 无限的会话」）／`Execution order matches CC source: budget → snip → micro → auto.`（code.py:27）／「对模型当下推理来说，细节已经不在上下文中了。」／「触发方式比 compact_history 更激进……但压缩策略更温和」。
- **占位符原文（画面可用）**：`[Earlier tool result compacted. Re-run if needed.]`、`[snipped {n} messages]`、`[Compacted. Conversation history has been summarized.]`、`<persisted-output>`。
- **比喻/画面**：「腾地方」＝会塞满的房间定期搬旧家具；「第 34 条消息里可能躺着 30KB 的旧文件内容」＝压箱底旧报纸；「一个 `cat` 大文件的输出就能打满上下文」＝单条输出是上下文炸弹；「落盘」＝搬去磁盘仓库、留一张取货凭证。
- **具体数字（叙事可引）**：读 1000 行文件 ≈ ~4000 token；单条 tool_result 可达 500KB；budget 200KB；预览 2000 字符；保尾 5 条。**注意**：教学常量（50 条/3+47/3 条/120 字符/50000 字符）属「随修订漂移的常数」，口播提及时限定「教学版取值」。
- **反直觉断言**：编号 ≠ 顺序（L3 先于 L1/L2 执行）；「顺序不能换」的硬依赖＝先落盘再占位；CC 的 snip 实现不在开源仓库但接口与 `SnipTool` 可见；CC 故意把 `Read` 放进可压缩集合、靠 `readFileState` 兜底；transcript 全量存了但没有检索工具——存档与记忆是两回事。
- **演示脚本（课程原文记录，仅作叙事参考，不执行）**：读多个文件观察 L2；读全目录观察 L3；长对话观察 `[auto compact]` / `[reactive compact]`。

---

## 二、站点轨 s09_memory —— Memory：压缩会丢细节，要有一层不丢的

### 定位与标语

README 顶部引言块逐字：

> *"压缩会丢细节, 要有一层不丢的"* — 文件仓库 + 索引 + 按需加载，跨压缩、跨会话。
>
> **Harness 层**: 记忆 — 跨压缩、跨会话的知识积累。

本章解决 s08 的遗留问题：autoCompact 摘要是有损的——README 原文举例：「"用 tab 缩进不要用空格"可能被简化成"用户有代码风格偏好"」；且新开会话连摘要也没有。根本原因是「LLM 没有持久状态，所有信息都在上下文窗口里。上下文满了要压缩，压缩就有损」。方案是文件系统存储 + 两条加载路径 + 每轮结束提取 + 定期整理；四类记忆各有明确用途。s08 的压缩管线**全部保留**，本章叠加于其上（README：「s08 的压缩管线保留，聚焦记忆。」）。

### 机制【一】

#### M-1. 文件存储 + frontmatter 记忆格式

- **一句话**：每个记忆是一个带 YAML frontmatter（name/description/type）的 Markdown 文件，写入后自动重建索引。
- **README 引语**：「存储选文件系统：`.memory/` 目录下，每个记忆一个 `.md` 文件，带 YAML frontmatter（`name` / `description` / `type`）。文件多了需要索引：`MEMORY.md` 一行一个链接，注入 SYSTEM。」
- **code.py 锚点**：`code.py:43-44`（`MEMORY_DIR = WORKDIR / ".memory"`、`MEMORY_INDEX`）；`:56 MEMORY_TYPES`；`:58 def _parse_frontmatter`；`:72 def write_memory_file`（slug 化：`name.lower().replace(" ", "-").replace("/", "-")`——同名即同文件）；`:84 def _rebuild_index`（从全部文件全量重建，一行 `- [name](filename) — desc`）；`:98 def read_memory_index`。
- **不变式**：一文件一记忆；**索引是派生物、文件是事实源**。

#### M-2. 四类记忆（user/feedback/project/reference）

- **README 引语**（表格逐字）：「| user | 你是谁 | "用 tab 不用空格" |」「| feedback | 怎么做事 | "别 mock 数据库" |」「| project | 正在发生什么 | "auth 重写是合规驱动" |」「| reference | 东西在哪找 | "pipeline bug 在 Linear INGEST" |」
- **code.py 锚点**：`code.py:56 MEMORY_TYPES = ["user", "feedback", "project", "reference"]`。
- 记忆文件本体示例（README）：frontmatter（name: user-preference-tabs / description / type: user）+ body 含 `**Why:**` 与 `**How to apply:**` 结构。

#### M-3. 路径一：索引常驻 SYSTEM

- **一句话**：每次用户请求开始时把 MEMORY.md 清单注入 system prompt，本轮内不再重建。
- **README 引语**：「**路径一：索引常驻 SYSTEM。** `build_system()` 在每次用户请求开始时读取 `MEMORY.md`，把记忆清单注入。记忆提取和整理只在本轮结束时触发，因此同一轮用户请求中不需要重复重建 SYSTEM。」
- **code.py 锚点**：`code.py:337 def build_system`（system 文案含 "Memories available:\n{index}"、"Respect user preferences from memory."、"When the user says 'remember' or expresses a clear preference, extract it as a memory."）。

#### M-4. 路径二：LLM side-query 相关记忆选择 + 关键词降级

- **一句话**：把最近对话与记忆目录（name + description）发给 LLM 做轻量 side-query 选出相关文件名；失败降级关键词匹配。
- **README 引语**：「`load_memories()` 把最近对话和记忆目录（name + description）一起发给 LLM 做一次轻量 side-query，选出相关的文件名，再读文件内容临时注入到当前 user turn。最多 5 条，控制开销。」「如果 side-query 失败（API 错误、JSON 解析失败），降级到关键词匹配 name + description。」
- **code.py 锚点**：`code.py:132 def select_relevant_memories`（`max_items=5`；recent 取最近 3 条 **user** 消息的文本块、截 `[:2000]`；目录按 `i: name — description` 编号；side-query `max_tokens=200`、只要求返回 JSON 整数数组；降级分支 `:195-204`，关键词取长度 >3 的词）；`:207 def load_memories`。
- **细节**：查询输入只有用户文本——工具结果内容块非 text 类型、被文本提取自然滤掉，工具噪声不进选择依据。

#### M-5. 记忆内容按需注入当前 user turn（不破坏 prompt cache）

- **一句话**：选中的记忆文件内容包 `<relevant_memories>` 标签临时拼进本轮 user 消息，而非改 system。
- **README 引语**：「关键设计：索引常驻 SYSTEM prompt（可被 prompt cache 缓存），文件内容按需注入到当前 user turn（按 filename/description 匹配当前对话，不破坏 cache）。」
- **code.py 锚点**：`code.py:213-218`（`parts = ["<relevant_memories>"]` … `</relevant_memories>`）；`:585-611`（agent_loop 开头算好 `memories_content` 与 `memory_turn` 位置，发请求时**拷贝** messages、把记忆内容前置到该轮 content——真实 `messages` 状态不被注入污染）。
- **轨道差异注记**：main 轨 `f9e8b28` 的 s09 把召回正文拼进 system prompt（`build_system(relevant_memories)`）——「两层加载只讲没做」是 main 钉的判定；**本集钉的站点轨两个注入点都在、与讲法一致**。撰稿时勿沿用 173 的该条判定（见分歧 B1 与简报）。

#### M-6. 每轮结束提取记忆（从压缩前快照）

- **一句话**：模型停止且无 tool_use 时，从压缩前的消息快照提取新记忆，避免压缩破坏保真。
- **README 引语**：「`extract_memories()` 在每轮结束时运行，条件是模型停止且没有 tool_use（说明对话告一段落）」「提取前先检查已有记忆，避免重复。提取 prompt 要求 LLM 返回 `{name, type, description, body}` 的 JSON 数组，只有确实有新信息时才写文件。」「用户显式说"记住"或表达稳定偏好时，提取器会保存为记忆。」
- **code.py 锚点**：`code.py:222 def extract_memories`（取 `messages[-10:]`、只拼文本块、dialogue 截 `[:4000]`；existing 清单注入 prompt 防重、要求 "If nothing new or already covered, return []"；`max_tokens=800`；写盘门槛仅 `if desc and body`）；`:592-594`（`pre_compress` 快照，注释 "save pre-compression snapshot for accurate memory extraction"）；`:626-630`（`if response.stop_reason != "tool_use": extract_memories(pre_compress); consolidate_memories(); return`）。
- **时间铰链（本钉点成立）**：提取输入是 `pre_compress` 快照——即使本轮压缩管线已把 messages 压扁，抽取仍看到压缩前的原文。「压缩章与记忆章互不包含」是 main 钉的结构判定；**站点轨 s09 完整保留 s08 压缩管线并以快照衔接**（单向包含：记忆章含压缩，压缩章不含记忆）。

#### M-7. 定期整理（教学版阈值 / CC 的 Dream）

- **一句话**：文件数达阈值时让 LLM 去重、合并矛盾、淘汰过时记忆。
- **README 引语**：「`consolidate_memories()` 在文件数达到阈值（默认 10）时触发，让 LLM 去重、合并矛盾、淘汰过时记忆」「CC 把这个过程叫 Dream，实际有四层门控：时间间隔、扫描节流、会话数、文件锁。教学版简化为文件数阈值。」
- **code.py 锚点**：`code.py:285 CONSOLIDATE_THRESHOLD = 10`；`:287 def consolidate_memories`（prompt 规则含 "3. Keep the total under 30 memories" 与 "4. Preserve important user preferences above all"；catalog 截 `[:16000]`、`max_tokens=3000`；**先 unlink 全部旧记忆文件再重写**，`except Exception: pass`）。
- **原生风险观察（撰稿人自查用）**：catalog 送 LLM 前截 `[:16000]`（`:305`），而删除删的是**全部** `*.md`（`:319-321`）——超出截断窗口的记忆不进整理视野却照样被删、且无快照回滚（main 轨版本另有快照与回滚），失败即静默跳过（`except: pass`）。口播不必展开，作 173 重写的批判边界素材。

#### M-8. Memory 与 session memory 的双层分工

- **README 引语**：「session memory 关注同一会话内的连续性：compact 之后，当前会话还需要保留哪些上下文。两者配合使用：Memory 管长期知识，session memory 管当前会话的压缩续接。」
- **对照表（README 逐字）**：持久性「跨会话 / 单会话」；存储「`memory/` 下多个 .md 文件 / `session-memory/<id>/memory.md`」；加载到「system prompt / compact 摘要」；用途「跨会话的知识积累 / 跨 compact 的上下文连续性」。
- **code.py 锚点**：教学版未实现 session memory（属 CC 侧机制，见生产版对照第 8 条）。

#### M-9. 保留自 s08 的压缩管线（骨架）

- **README 引语**：「s08 的压缩管线保留，聚焦记忆。」
- **code.py 锚点**：`code.py:448 CONTEXT_LIMIT = 50000; KEEP_RECENT = 3; PERSIST_THRESHOLD = 30000`；`:471 snip_compact`；`:493 micro_compact`；`:536 compact_history`；`:541 reactive_compact`；`:597-603`（agent_loop 内依次调用 budget → snip → micro → 阈值摘要 → 应急）。

#### M-10. 工具面收缩以聚焦记忆

- **README 引语**（对比表逐字）：「bash, read, write, edit, glob, todo_write, task, load_skill, compact (9) | bash, read_file, write_file, edit_file, glob, task (6)」
- **code.py 锚点**：`:556-569 TOOLS`（6 项）；`:407-414 SUB_TOOLS`（3 项）。减去 todo_write / load_skill / compact。
- **写权归属**：主 Agent 工具清单里**没有任何记忆读写工具**——模型不能主动「请记住」，写入只发生在回合收尾的旁路抽取（M-6），提取结果也只是候选（软防重靠 prompt，硬门槛仅字段齐全）。

### 风险与防护【一】（本章）

1. **压缩有损（核心风险）**：「上下文满了要压缩，压缩就有损」→ 设一层不参与压缩、跨会话保留的存储。
2. **细节退化**：tab/空格 → 「代码风格偏好」→ 原话存成带 body 的记忆文件。
3. **side-query 失败** → 降级关键词匹配（`:195-204`）。
4. **重复提取** → existing 清单入 prompt + "return []" 指令（软防重）。
5. **提取保真被压缩破坏** → 从 `pre_compress` 快照提取。
6. **注入开销** → 「最多 5 条，控制开销」；side-query `max_tokens=200`。
7. **整理成本与文件膨胀** → 阈值 10 才触发；"Keep the total under 30 memories"；catalog 截 16000。
8. **prompt cache 失效风险**（CC 侧，README 深入节）：「记忆注入需要考虑 prompt cache 的 TTL，避免每次都重写 system prompt 的大段内容」→ 教学对策即「索引进 SYSTEM、内容进 user turn」分工。
9. **CC 侧其他防护**：重叠保护（主 Agent 已写记忆则跳过提取）；文件锁 + 崩溃恢复（锁 mtime 即 lastConsolidatedAt，1 小时自动过期）；注入预算（每文件 ≤200 行 / 4096 字节、单 session 总 60KB、MEMORY.md ≤200 行 / 25KB）；memory prefetch 异步不卡主流程。

### 生产版对照【三】（「深入 CC 源码」逐条转抄；课程声明基于 CC 源码 `src/` 下 `memdir/`、`services/`、`utils/`、`query/` 的分析，行号已对照核实）

| # | 断言 | CC 锚点 |
|---|---|---|
| 1 | `memdir.ts`（507 行）核心：`MEMORY.md` 定义（`34-38`）、记忆行为指令区分 memory/plan/tasks（`199-266`）、`loadMemoryPrompt()` 三条路径（`419-490`）；索引约束 `MEMORY.md` ≤200 行 / 25KB；存储位置 `~/.claude/projects/<sanitized-git-root>/memory/` | `memdir/memdir.ts` |
| 2 | **CC 用 Sonnet 本身来选**（`findRelevantMemories.ts`），不是 embedding 向量相似度；side-query 提示词：「"根据名称和描述选出真正有用的记忆（最多 5 个）。不确定就不要选。"」返回 `{ selected_memories: ["file1.md", ...] }` | `memdir/findRelevantMemories.ts:18-24, 97-122` |
| 3 | `memoryTypes.ts`（271 行）：类型定义、frontmatter 字段 | `memdir/memoryTypes.ts` |
| 4 | `memoryScan.ts`：扫描 .md、排除 MEMORY.md、读 frontmatter、最多 200 个、按 mtime 降序 | `memdir/memoryScan.ts:35-94` |
| 5 | 提取：forked agent、受限权限、`skipTranscript: true`、`maxTurns: 5` | `services/extractMemories/extractMemories.ts:371-427`（615 行） |
| 6 | Dream 整理四层门控：①时间（距上次 ≥24 小时）②扫描节流 ③会话（修改 ≥5 个 transcript）④锁（`.consolidate-lock`，无其他进程在合并） | `services/autoDream/autoDream.ts:63-66, 130-190, 224-233`（324 行） |
| 7 | `sessionMemory.ts`（495 行）：会话级记忆管理 | `services/SessionMemory/sessionMemory.ts` |
| 8 | sessionMemoryCompact：autoCompact 前先读 session memory，内容足够（≥10K token、≥5 条文本消息、≤40K token）就用它做摘要、**不调 LLM** | `services/compact/sessionMemoryCompact.ts:56-61` |
| 9 | 注入预算：每文件 200 行 / 4096 字节、每 session 60KB；按 query 找相关 memory | `utils/attachments.ts:269-288, 2196-2241` |
| 10 | 触发位置：`handleStopHooks()` 中 fire-and-forget 触发提取和 Dream；memory prefetch 每轮启动、非阻塞收集 | `query/stopHooks.ts:141-155`；`query.ts:301-304, 1592-1614` |

另有命名组件：KAIROS（时机感知的记忆提取策略，`loadMemoryPrompt()` 中 daily-log 模式）、Team memory（团队共享记忆，`loadMemoryPrompt()` 专门路径）。

### 官方文档对照【官】

| 官 | 官方说 | 课程教 | 判定 |
|---|---|---|---|
| 1 | "Each Claude Code session begins with a fresh context window. Two mechanisms carry knowledge across sessions: **CLAUDE.md files** … **Auto memory**: notes Claude writes itself based on your corrections and preferences" | 压缩跨会话丢摘要 → 需要持久层 | 一致（两机制并列与课程同构） |
| 2 | "Claude treats them as context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook instead." | build_system 写 "Respect user preferences from memory."（背景知识口径） | 一致（官方额外给出 hook 强制出口） |
| 12 | 四类 type 官方定义：`user`=role/expertise/working preferences；`feedback`=corrections 与确认过的做法；`project`="ongoing work, deadlines, and decisions that Claude can't derive from the code or git history"；`reference`=项目外信息在哪找 | 同名四类；站点口径 project=「正在发生什么」 | 一致（站点口径与官方对齐；main 轨「稳定项目事实、禁临时状态」口径更保守——轨间差异，见简报） |
| 13 | "Claude skips anything it can derive from the codebase … It also skips anything your CLAUDE.md files already say."；"Claude doesn't save something every session." | existing 清单 + "return []"（软防重） | 一致·互补（官方只给原则，未记载闸门细节） |
| 14 | Auto memory 默认开启；`/memory` toggle（`autoMemoryEnabled`）、项目级关、`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`；`autoMemoryDirectory` 可自定义 | 无开关面 | 互补 |
| 15 | 存储位置 `~/.claude/projects/<project>/memory/`，`<project>` 由 git 仓库派生；同仓 worktree/子目录共享一个记忆目录；机器本地、不跨机器/云共享 | `.memory/`（工作目录内） | 互补（位置口径不同：教学放工作区，产品放用户主目录按仓派生） |
| 16 | "The directory contains a `MEMORY.md` index and one topic file per memory"；"Claude reads and writes files in this directory throughout your session, using `MEMORY.md` to keep track of what's stored where." | 一文件一记忆 + MEMORY.md 索引 | 一致（存储不变式官方印证） |
| 17 | MEMORY.md 首 200 行或 25KB（先到者）每会话开始加载；超限部分不加载、写仍成功但报错引导重写 | 未给硬数字 | 一致·互补 |
| 18 | "Claude Code doesn't load topic files … at startup. Claude reads them on demand using its standard file tools when it needs the information." | side-query 选文件名 → 读内容注入 user turn | 两层一致；**挑选机制分歧**（分歧 B2） |
| 19 | 记忆文件豁免转录清理（转录按 `cleanupPeriodDays` 删、记忆不动） | 未讨论 | 互补（「保证不丢」的官方落地） |
| 20 | 写入时记 `modified` frontmatter 时间戳（ISO 8601，v2.1.214+） | frontmatter 只记 name/description/type | 互补 |
| 21 | 主会话 auto memory 不进子代理；fork 例外；子代理可开自己的记忆目录 | 子代理 SUB_TOOLS 3 个、无记忆面 | 互补 |
| 22 | 读写主体表述为 Claude 本身："Saved 2 memories" / "Recalled 2 memories" 提示；要进 CLAUDE.md 则明说 "add this to CLAUDE.md" | 模型无记忆读写工具，写入在回合收尾旁路抽取 | 互补·张力（官方未给写入路径细节；"Saved N" 提示与 harness 侧写入兼容；分歧 B6 相关） |
| 29 | 压缩存活面：system prompt 与输出风格仍生效；项目根 CLAUDE.md、无 paths 规则、**auto memory 从磁盘重注入**；计划重注入；paths 规则与子目录 CLAUDE.md 按读取重载 | s09 保留压缩管线 + `pre_compress` 快照（写侧保护） | 互补（课程=写侧取压缩前快照；官方=读侧压缩后重注入——两个方向的咬合） |
| 42 | 开机即载：CLAUDE.md、auto memory、MCP 工具名、技能描述 | 索引常驻 SYSTEM | 一致 |
| 45 | 请求前缀三层：system prompt（核心指令+工具定义）→ project context（CLAUDE.md、auto memory、unscoped rules；会话开始或 /clear、/compact 时变化）→ conversation | 索引进 system、内容进 user turn | 一致·互补（缓存理由获印证；**注入位置**：官方把记忆归 system 之后独立层，分歧 B1） |
| 46 | 成本策略：任务间 `/clear`；大读取委托 subagent（文件内容留在其窗口）；CLAUDE.md 控制在 200 行内 | subagent 不参与压缩、上下文独立 | 一致·互补 |
| 3-11 | CLAUDE.md 专面（课程未覆盖，口播若提须标注「课程之外的官方面」）：四级作用域（managed policy/user/project/local）；多文件拼接不覆盖、根到工作目录排序；`@path` 导入（递归四跳上限）；体量建议 200 行、4 MiB 加载硬上限；**以 system prompt 之后的 user message 送达**；`/init` 生成；`/memory` 与 `/context` 核查；AGENTS.md 直读（v2.1.277+）；会话中途编辑不生效（下次 /clear、/compact 或重启生效） | 课程教的是 `.memory/` 自动记忆，无 CLAUDE.md 面 | 互补（对应关系：课程 Memory 层 ≈ 官方 auto memory；CLAUDE.md 是用户手写层，课程未教） |

### 叙事素材（口播备料，引语逐字）

- **金句**：*"压缩会丢细节, 要有一层不丢的"*；*"LLM 没有持久状态，所有信息都在上下文窗口里。"*；*"Memory 管长期知识，session memory 管当前会话的压缩续接。"*
- **比喻/具象**：tab/空格退化成「代码风格偏好」；四类记忆的「回答什么」框架（你是谁/怎么做事/正在发生什么/东西在哪找）。
- **反直觉断言**：CC 用 **Sonnet 本身**选记忆、不是向量相似度【三，带归属句】；提取时机在 stop（对话告一段落）而非 autoCompact 后；sessionMemoryCompact 内容足够时压缩零 LLM 调用；CC 把整理叫 **Dream**（系统「做梦」即合并去重）；索引/内容分层注入的动机是 prompt cache。
- **演示脚本（课程原文记录，可做视频演示线）**：①`I prefer using tabs for indentation, not spaces. Remember that.` ②`Create a Python file called test.py`（观察是否用 tab）③`What did I tell you about my preferences?` ④`I also prefer single quotes over double quotes for strings.`；观察信号：`[Memory: extracted N new memories]` 终端回显、`.memory/` 生成 `.md`、MEMORY.md 更新、新一轮自动加载。
- **承上启下**（README「接下来」）：「记忆、压缩、工具都已就绪。但 system prompt 还是硬编码的一大段字符串。……prompt 应该运行时组装。」→ 下一课 System Prompt。

---

## 分歧清单

处置原则：默认取更可核验的一轨；课程 vs 官方分歧的口播措辞一律「课程教 X；官方文档当前说 Y」双句式。

### A. 站点钉内：README 正文 vs code.py 实现

| # | 分歧点 | 两轨说法 | 处置 |
|---|---|---|---|
| A1 | 标识符命名 | README 用 `KEEP_RECENT_TOOL_RESULTS` / `collect_tool_result_blocks` / `estimate_token_count` / `THRESHOLD`；code.py 实为 `KEEP_RECENT`（:276）/ `collect_tool_results`（:323）/ `estimate_size`（:279）/ `CONTEXT_LIMIT`（:275） | 口播不引标识符；画面代码用 code.py 实名（【一】可核验） |
| A2 | snip 占位串 | README 片段含 "from conversation middle"；code.py:319 仅 `"[snipped {snipped} messages]"` | 以 code.py 为准 |
| A3 | 熔断器 | README 声明「**熔断器**：连续失败 3 次后停止重试，防止死循环浪费 API 调用」；code.py **无对应实现**（无连续失败计数器，仅有 reactive 重试上限 1 次） | 口播不得把熔断说成教学版已实现；「连续 3 次熔断」只能以【三】讲（CC `autoCompact.ts:70` = 3） |

### B. 课程 vs 官方文档

| # | 分歧点 | 两轨说法 | 口播措辞建议 |
|---|---|---|---|
| B1 | 记忆注入位置 | 课程教（站点钉也如此实现）：索引进 system prompt、召回内容注入当前 user turn；官方：CLAUDE.md 以 "a user message after the system prompt" 送达，CLAUDE.md/auto memory/unscoped rules 归为 system 之后的独立 project context 层 | 「课程教：索引常驻 system、正文按需进当前轮；官方文档说：这层记忆作为 system prompt 之后的独立段落送达，不占 system prompt 本身。」 |
| B2 | 记忆挑选机制 | 课程教：旁路 side-query 挑文件名（CC 侧「用 Sonnet 本身选」属【三】源码分析）；官方：模型需要时**用标准文件工具**按需读取，未文档化任何旁路挑选调用 | 「课程教：开工前一次旁路小调用挑出相关记忆；官方文档只说：模型需要时自己用文件工具去读。」（CC 侧断言带【三】归属句） |
| B3 | MEMORY.md 维护方式 | 课程教：索引是派生物、每次写入后从全部文件全量重建；官方：Claude 会话中持续读写维护、接近上限时产品提醒精简、超限时写成功但报错引导重写 | 「课程教：扉页每次写完从头重排；官方说：模型边用边维护，超限时产品会报错引导改写。」 |
| B4 | 「microcompact」术语 | 课程/社区把清旧工具结果一步称 micro compact；官方文档（7 页全文＋全站检索）无此词，表述为 "clears older tool outputs first, then summarizes" | 机制照讲；提名词时标注「课程与社区口径，官方文档不这么叫」 |
| B5 | 主动摘要的丢弃面 | 课程教：全部旧消息换成一条摘要（教学版只留摘要；README 自认 CC 会重附加）；官方：结构化摘要保留 requests/intent、关键概念、文件与代码片段、错误与修法、待办、当前工作，且重注入 CLAUDE.md、auto memory、至多 5 个文件、已调用技能体 | 「课程教：摘要一条消息顶全部历史；官方说：产品的摘要保留面宽得多，压完还会从磁盘把记忆和最近文件重新拿回来。」 |
| B6 | 记忆读写主体 | 课程教：模型没有任何记忆读写工具、写入在回合收尾由 harness 旁路完成；官方：表述为 "Claude reads and writes memory files during your session"（界面提示 "Saved 2 memories"），未文档化写入路径 | 「课程教：执笔的另有其人（harness 收尾旁写）；官方说：Claude 会在会话中读写记忆——写入路径的细节官方没有展开。」 |
| B7 | 「落盘」一词的指称 | 课程 `.transcripts/`＝压缩时一次性归档；官方 transcript＝完整会话记录持续写 plaintext JSONL（支撑 rewind/resume/fork，30 天保留） | 同词异物，口播须消歧：「课程里的 transcript 是压缩时的归档；官方产品里另有一条持续写盘的完整会话记录，那是回溯与恢复用的。」 |
