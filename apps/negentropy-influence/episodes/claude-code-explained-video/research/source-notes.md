# 事实源：《Learn Claude Code》工具与执行四章

> **本集口播的单一事实源**。逐字稿（[../script/narration.md](../script/narration.md)）中每一条断言都必须能回溯到本文件的某一节；
> 回溯不到的断言不得进入口播。
>
> **信源双轨**
> - **轨 A · 代码仓库（可核验）**：[shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code)
>   @ `f9e8b280f715f9ba107d4517fd39bc5f8ddda618`（main，2026-08-18T17:42:28Z），License **MIT**。
>   取法：`raw.githubusercontent.com/<repo>/<sha>/sNN_*/{README.zh.md,code.py}`，指纹与行数见 [sources.toml](./sources.toml)。
> - **轨 B · 课程站点（用户指定）**：`https://learn.shareai.run/zh/s01/` … `/zh/s04/`，访问日期 **2026-08-21**。
>   站点为 Next.js **SSG 预渲染**（关键数字同时出现在可见文本与 Flight 载荷 `"children":[102," LOC"]` 中），
>   故 HTML 文本即渲染结果，不存在 [ISSUE-162](../../../../../docs/.agents/issue.md) 的「未水合占位符」风险。
>
> **证据三级（本集最重要的真实性纪律）**
> | 级 | 含义 | 口播允许的表述 |
> |---|---|---|
> | 【一】 | 轨 A 仓库文件实测（可复算） | 可直接断言 |
> | 【二】 | 轨 B 站点课程正文 | 可断言，但属「课程的讲法」 |
> | 【三】 | 课程作者**对 Claude Code 源码的分析**（站点独有，我们无从核验） | **必须**表述为「课程作者拆过源码后说…」一类归属句，**不得**说成「Claude Code 就是这样」 |
>
> 三级证据是本集最有信息量的部分，也是最容易说错的部分：那些 `query.ts:830-834` 式的行号来自课程作者
> 对**闭源产品**的逆向阅读，仓库里没有对应文件（仓库 s04 的 README 甚至完全没有「深入 CC 源码」这一节）。
>
> **提取方式**：2026-08-21 双轨并行取证 —— 轨 A 用固定 commit 拉取四章 README.zh.md 与 code.py 并
> 实测行数 / diff `agent_loop` 函数；轨 B 拉取四页 HTML 剥标签成文本后逐节精读。
> **图片纪律**：站点 6 张 SVG 一律**不下载、不嵌入**（版权 + 与代码动画美学不一致），只转文字规格（见 §五）。

---

## 一、s01 Agent Loop —— 一个循环就够了

### 定位与标语
- 【二】章节指标：**102 LOC · 1 个工具 · Minimal model/tool loop**（⚠️ 与实测不符，见 §三-3）。
- 【二】标语 *"One Loop Is All You Need"*；页面引语 *"One loop & Bash is all you need"*。
- 【二】Harness 层定位：「循环 —— 模型与真实世界的第一道连接」。

### 问题（原文，轨 A）
> 【一】「你提出了一个问题给大模型：'帮我读取下我的目录下有哪些文件，并且执行XXX.py'。模型能输出一条 bash 命令，但输出完了就停了，它不会自己跑，也不会看到结果后继续推理。」
> 【一】「每一个来回，你都在做中间层。而把它自动化，就是这一章要做的事。」

**这是全片的开场痛点**：人在充当模型与终端之间的复制粘贴中间层。

### 机制：两个信号决定循环生死
- 【一】**轨 A 的判据是「响应内容里有没有 `tool_use` 块」**：

  | 信号 | 含义 | 循环动作 |
  |---|---|---|
  | 包含 `tool_use` block | 模型要求调用工具 | 执行 → 结果喂回去 → 继续 |
  | 不包含 `tool_use` block | 模型没有调用工具 | 退出循环 |

- 【二】**轨 B 站点仍是旧判据 `stop_reason == "tool_use"`** —— 两轨在此分歧，见 §三-1。

### 五步（轨 A 原文代码，逐字）
1. 【一】把用户问题作为第一条消息：`messages = [{"role": "user", "content": query}]`
2. 【一】消息 + 工具定义一起发给模型：`client.messages.create(model=MODEL, system=SYSTEM, messages=messages, tools=TOOLS, max_tokens=8000)`
3. 【一】追加模型回答，检查它是否调了工具；没调 → 结束：
   ```python
   messages.append({"role": "assistant", "content": response.content})
   tool_calls = [block for block in response.content if block.type == "tool_use"]
   if not tool_calls:
       return
   ```
   【一】原文补注：「只有实际存在的 `tool_use` block 才会进入执行阶段，因此不会追加空的工具结果消息。」
4. 【一】执行工具、收集结果（`run_bash(block.input["command"])` → `{"type": "tool_result", "tool_use_id": block.id, "content": output}`）
5. 【一】结果作为新消息追加，回到第 2 步：`messages.append({"role": "user", "content": results})`

【一】轨 A 自述：「**三十多行，这就是最小可运行的 agent harness 内核**……模型负责决策（要不要调工具、调哪个），harness 负责执行……**后面 16 个章节都在这个循环上叠加机制，循环本身始终不变。**」

### 安全提示（轨 A 原文）
> 【一】「代码会执行模型生成的 shell 命令。建议在一个临时测试目录中运行，避免影响你的项目文件。s03 会加入权限控制。」

### 生产版对照【三级 —— 课程作者对 CC 源码的分析】
- 依据文件：`src/query.ts`，作者称 **1729 行**。作者结论：「**1729 行的 query.ts 核心就是 30 行 `while True`**。所有复杂字段和退出路径都是保护机制。」
- **两个核心差异**：① CC 不看 `stop_reason` 字段，而是检查内容里有没有 `tool_use` 块（流式响应中 `stop_reason` 不可靠）；② CC 有更多退出路径与恢复策略。
- 作者引用的源码注释（`query.ts:554-558`）：
  ```
  // stop_reason === 'tool_use' is unreliable.
  // Set during streaming whenever a tool_use block arrives.
  let needsFollowUp = false
  ```
  机制：流式消息中一旦检测到 `tool_use` 块就把 `needsFollowUp` 置 true（`query.ts:830-834`）；真实 `stop_reason` 由 `QueryEngine.ts` 从 `message_delta` 捕获、供其他逻辑用，但循环本身靠 `needsFollowUp` 决定是否继续。
- **State 对象 10 字段**（教学版只用 `messages`）——★本集重点视觉演绎素材，每个字段都指向后续某一章：

  | # | 字段 | 用途 | 对应章节 |
  |---|---|---|---|
  | 1 | `messages` | 当前迭代的消息数组 | s01 |
  | 2 | `toolUseContext` | 工具、信号、权限上下文 | s02 |
  | 3 | `autoCompactTracking` | 压缩状态追踪 | s08 |
  | 4 | `maxOutputTokensRecoveryCount` | token 恢复尝试次数（上限 3） | s11 |
  | 5 | `hasAttemptedReactiveCompact` | 本轮是否已尝试响应式压缩 | s08 |
  | 6 | `maxOutputTokensOverride` | 8K→64K 的升级覆盖 | s11 |
  | 7 | `pendingToolUseSummary` | 后台 Haiku 生成的 tool use 摘要 | s08 |
  | 8 | `stopHookActive` | 停止钩子是否产生阻塞错误 | s04 |
  | 9 | `turnCount` | 轮次计数（maxTurns 检查） | s01 |
  | 10 | `transition` | 上一次继续原因 | s11 |

  注：`taskBudgetRemaining`（`query.ts:291`）是 loop-local 局部变量，**不在 State 上**，源码注释明写 "Loop-local (not on State)"。
- **多条退出/继续路径**：教学版 1 条；生产版覆盖 blocking limit、prompt too long、model error、abort、hook stop、max turns、token budget continuation、reactive compact retry。
- **流式工具执行**：`StreamingToolExecutor`（`query.ts:561`）让工具在模型还在生成时就并行启动（按是否 concurrency-safe 决定并发或独占）；`QueryEngine.ts` 另加费用超限、结构化输出验证失败等保护。

---

## 二、s02 Tool Use —— 加一个工具，只加一行

### 定位与标语
- 【二】指标：**135 LOC · 5 个工具 · Tool dispatch map**；标语 *"Add a Tool, Add Just One Line"*；
  引语 *"The loop stays stable while capabilities register into a dispatch table."*
- 【二】Harness 层定位：「工具分发 —— 扩展模型能触达的边界」。

### 问题（轨 A 原文）
> 【一】「读文件要 `cat`，写文件要 `echo "..." > file.py`，改文件要 `sed`。模型想的是"读这个文件"，却要拼出 `cat path/to/file`。**多了一层翻译，浪费 token，还容易拼错。**」

### 机制：字典分发
- 【一】五个工具定义（`TOOLS` 数组）：`bash`（Run a shell command.）· `read_file`（Read file contents.）· `write_file`（Write content to file.）· `edit_file`（Replace text in file once.）· `glob`（Find files by pattern.）
- 【一】分发表：
  ```python
  TOOL_HANDLERS = {
      "bash": run_bash, "read_file": run_read, "write_file": run_write,
      "edit_file": run_edit, "glob": run_glob,
  }
  ```
- 【一】加一个工具 = `TOOLS` 数组加一条 + `TOOL_HANDLERS` 字典加一行映射。
- 【一】新增路径安全：file tools 经 `safe_path()` 校验；**bash 不受其保护**（这是 s03 的引子）。
- 【一】多工具调用：模型常一次返回多个 `tool_use`（例：「读一下 a.py 和 b.py，然后列出所有 .py 文件」），轨 A 按 `response.content` 原始顺序逐个执行。
- 【一】速查表原文一句：「**循环不变** —— s01 的 `while True` 循环一行都没改」。

### 生产版对照【三级】
依据文件：`Tool.ts`、`tools.ts`、`toolOrchestration.ts`、`toolExecution.ts`、`StreamingToolExecutor.ts`。

- **工具定义方式**：CC 中每个工具是 `buildTool()` 创建的独立对象（内含 schema、验证、权限、执行），由 `getAllBaseTools()` 汇总；教学版刻意把定义与实现分开，「读者一眼看到'加一个工具 = 两条定义'」。
- ★**并发安全 ≠ 只读**（本章最反直觉、列为重点视觉演绎）：`isConcurrencySafe(input)` **按具体输入判断**，不是简单的只读 vs 写。

  | 工具 | `isReadOnly` | `isConcurrencySafe` | |
  |---|---|---|---|
  | FileRead | true | true | |
  | Glob | true | true | |
  | Bash `ls` | true | **true** | ← 关键差异 |
  | Bash `rm` | false | false | |
  | TaskCreate | false | **true** | ← 改状态但可并发 |

  作者解释：CC 的 Bash tool 的 `isConcurrencySafe` **等于** `isReadOnly`（只读命令可并发，写命令不可）；TaskCreate 虽然改任务文件，但**每次都写不同的文件**，所以可以并发。
- ★**分区算法**：`partitionToolCalls()`（`toolOrchestration.ts:91-115`）不是分两组，而是**按连续块分批**：
  ```
  [read A, read B, glob *.py, bash "rm x", read C]
    → batch1(并发): [read A, read B, glob *.py]
    → batch2(串行): [bash "rm x"]
    → batch3(并发): [read C]
  ```
  并发安全的连续块编入同一 batch（`toolOrchestration.ts:152-176`，有并发上限）；遇到非并发安全的就开新 batch 串行；**batch 之间严格顺序**。
- **5 步验证管线**（`toolExecution.ts`）：① Zod schema 验证（`614-680`）② 工具级 `validateInput()`（`682-733`）③ PreToolUse hooks（`800-862`）④ 权限检查（`921-931`）⑤ 执行 `tool.call()`（`1207-1222`）。
- **流式工具执行**：`read_file` 可能在模型还在输出「我来分析」时就已跑完。
- ★**工具结果落盘的自我循环陷阱**（极好的记忆点）：每个工具有 `maxResultSizeChars`，超限就落盘、模型只看到预览 + 文件路径。**FileRead 特殊，设为 `Infinity`** —— 否则「读文件 → 落盘 → 再读那个落盘文件 → 再落盘 → …」形成无限循环。

---

## 三、s03 Permission —— 执行之前，先过闸门

### 定位与标语
- 【二】指标：**180 LOC · 5 个工具 · Permission gate**；标语 *"Check Permissions Before Execution"*；
  引语 *"Dangerous actions need a harness decision point before the shell runs."*
- 【二】Harness 层定位：「权限 —— 在工具执行前加一道门」。

### 问题（轨 A 原文）
> 【一】「file tools 受 `safe_path` 保护，但 bash 不受限制。让它'清理一下项目'，**可能执行 `rm -rf /`**。安全边界由代码负责，判断发生在工具执行之前。」

### 机制：三道闸门（顺序固定）
【一/二】两轨一致：

| 闸门 | 作用 | 命中后 |
|---|---|---|
| 1. 拒绝列表 | 永远禁止的操作（`rm -rf /`、`sudo`） | 直接拒绝，不执行 |
| 2. 规则匹配 | 取决于上下文的操作（读/写工作区外、`rm` 文件） | 交给闸门 3 |
| 3. 用户审批 | 闸门 2 命中后，暂停等用户确认 | 用户决定允许或拒绝 |

【一/二】三道都没命中 → 直接执行，「大部分日常操作走这条路」。

- 【一】`DENY_LIST = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"]`
- ★【一】**轨 A 对闸门 1 的自我限定（诚实且重要）**：「这张表使用简单字符串匹配来**说明权限闸门的位置**，**不能视为完整的安全边界**。」
  【二】站点版措辞更具体：「简单字符串匹配不是可靠安全机制，**命令变体和 shell 展开可能绕过**。」
  → 这条必须进口播：它是「教学模型 ≠ 生产安全」的诚实声明。
- 【一】闸门 2 规则覆盖 `["read_file", "write_file", "edit_file"]`，message `"Access outside workspace"`；
  bash 规则关键词 `["rm ", "> /etc/", "chmod 777"]`，message `"Potentially destructive command"`。（站点覆盖范围较窄，见 §三-4）
- 【一】闸门 3：`input("   Allow? [y/N] ")`，非 `y/yes` 即 deny。

### 生产版对照【三级】
依据文件：`types/permissions.ts`、`utils/permissions/permissions.ts`、`toolExecution.ts`、`utils/permissions/yoloClassifier.ts`、`tools/AgentTool/forkSubagent.ts`。

- ★**PermissionResult 不是 3 种，是 4 种**（`types/permissions.ts:241-266`）：

  | behavior | 含义 | 教学版对应 |
  |---|---|---|
  | `allow` | 直接允许 | 闸门 3 通过 |
  | `deny` | 直接拒绝 | 闸门 1 命中 |
  | `ask` | 弹出对话框问用户 | 闸门 2 命中 |
  | `passthrough` | 工具不表态，交给通用管线决定 | **教学版无** |

- **多层规则检查顺序**（`hasPermissionsToUseToolInner()`，`permissions.ts:1158-1310`）：
  被 deny rule 禁用 → `deny`；被 ask rule 标记 → `ask`；`tool.checkPermissions()`；工具返回 deny → `deny`；
  `requiresUserInteraction()` → `ask`；内容相关 ask 规则 → `ask`（**不可绕过**）；安全检查违规 → `ask`（**不可绕过**）；
  bypassPermissions 模式 → `allow`；被 allow rule 放行 → `allow`；`passthrough` → 转为 `ask`。
- ★**拒绝/允许规则来自 8 个来源**（`types/permissions.ts:54-62`）：

  | 来源 | 配置位置 |
  |---|---|
  | `userSettings` | `~/.claude/settings.json` |
  | `projectSettings` | `.claude/settings.json` |
  | `localSettings` | `settings.local.json` |
  | `flagSettings` | Feature flags |
  | `policySettings` | 企业管理策略 |
  | `cliArg` | `--allowedTools` / `--deniedTools` |
  | `command` | 内联命令 |
  | `session` | 会话内临时授权 |

  规则格式：`{ toolName: "Bash", ruleBehavior: "deny", ruleContent: "npm publish:*" }`。
  合并优先级**从低到高：user < project < local < flag < policy**，另有 cliArg、command、session。
- **`isDestructive()` 只管 UI**（`Tool.ts:405-406`）：纯粹用于工具列表显示 `[destructive]` 标签，**不参与权限决策**，默认所有工具返回 `false`；只有 ExitWorktree（remove 时）与 MCP 工具（依赖 `annotations.destructiveHint`）覆写。
- **YoloClassifier（自动审批）**：auto 模式下不每次弹窗。`classifyYoloAction`（`yoloClassifier.ts:1012`）把工具调用 + 对话上下文交给一个**分类器 LLM** 判断。顺序：先模拟 acceptEdits 模式（`permissions.ts:620-656`，允许则直接批准）→ 查安全工具白名单（`permissions.ts:658-686`）→ 最后才调分类器；**分类器连续拒绝太多次会回退到人工审批**。
- **权限冒泡**：子 Agent（`AgentTool` fork 出来的）`permissionMode` 设为 `'bubble'`（`forkSubagent.ts:50`）—— 权限弹窗**冒泡到父 Agent 的终端**，而不是在子 Agent 里静默拒绝。

---

## 四、s04 Hooks —— 挂在循环上，不写进循环里

### 定位与标语
- 【二】指标：**232 LOC · 5 个工具 · Lifecycle hooks**；标语 *"Hang on the Loop, Don't Write into It"*；
  引语 *"Cross-cutting behavior belongs around the loop, not tangled inside it."*
- 【二】Harness 层定位：「hook —— 扩展点不侵入循环」。

### 问题（轨 A 原文 + 那段「退化的循环」）
【一】原文示意代码 —— **绝佳的视觉素材**：
```python
def agent_loop(messages):
    while True:
        # ... LLM call ...
        for block in response.content:
            if block.type != "tool_use":
                continue
            log_to_file(block)          # 加一行
            check_permission(block)     # 加一行
            notify_slack(block)         # 又加一行
            output = execute(block)
            auto_git_add(block)         # 再加一行
            # ... 很快循环就认不出来了
```
> 【一】「**你想扩展的是 Agent 的行为，但你改的却是循环本身。循环应该是一个稳定的核心，扩展应该挂在外面。**」

### 机制：注册表 + 四个事件
- 【一】注册表与触发器（逐字）：
  ```python
  HOOKS = {"UserPromptSubmit": [], "PreToolUse": [], "PostToolUse": [], "Stop": []}

  def register_hook(event: str, callback):
      HOOKS[event].append(callback)

  def trigger_hooks(event: str, *args):
      for callback in HOOKS[event]:
          result = callback(*args)
          if result is not None:   # 返回值 ≠ None → hook 说"停"
              return result
      return None
  ```
- 【一】**四个事件覆盖一个完整 agent cycle**：

  | 事件 | 触发时机 | 典型用途 |
  |---|---|---|
  | `UserPromptSubmit` | 用户输入提交后、进入 LLM 前 | 输入验证、注入上下文 |
  | `PreToolUse` | 工具执行前 | 权限检查、日志记录 |
  | `PostToolUse` | 工具执行后 | 副作用（自动 git add 等）、输出检查 |
  | `Stop` | 循环即将退出时 | 收尾清理、决定是否继续循环 |

- 【一】返回值语义：`PreToolUse` 返回非 None → **阻止本次工具执行**；`Stop` 返回非 None → **强制续跑**（把返回的消息注入 messages 后 `continue`）；`UserPromptSubmit` 与 `PostToolUse` 的返回值**不参与控制流**。
- 【一】五个示例回调：`context_inject_hook`（注入 cwd）、`permission_hook`（s03 逻辑搬上钩子）、`log_hook`、`large_output_hook`（`> 100000` 字符提醒）、`summary_hook`（统计本次会话用了几次工具）。
- 【一】原文：「**四个 hook 覆盖了 agent cycle 的关键节点：输入→执行前→执行后→退出。循环只负责调用 `trigger_hooks()`，具体逻辑全在 hook 回调里。**」

### 生产版对照【三级】
依据文件：`toolHooks.ts`（作者称 **650 行**）、`hooks.ts`、`stopHooks.ts`、`coreTypes.ts`。

- ★**hook 事件不止 4 个，而是 27 个**（`coreTypes.ts:25-53`）—— 本章重点视觉演绎：

  | 类别 | 事件 |
  |---|---|
  | 工具相关 | `PreToolUse`, `PostToolUse`, `PostToolUseFailure` |
  | 会话相关 | `SessionStart`, `SessionEnd`, `Stop`, `StopFailure`, `Setup` |
  | 用户交互 | `UserPromptSubmit`, `Notification`, `PermissionRequest`, `PermissionDenied` |
  | 子 Agent | `SubagentStart`, `SubagentStop` |
  | 压缩相关 | `PreCompact`, `PostCompact` |
  | 团队相关 | `TeammateIdle`, `TaskCreated`, `TaskCompleted` |
  | 其他 | `Elicitation`, `ElicitationResult`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`, `InstructionsLoaded`, `CwdChanged`, `FileChanged` |

  （逐类计数 3+5+4+2+2+3+8 = **27**，与作者声称的 27 自洽。）作者说其他 23 个「都是同样的模式」。
- **HookResult 14 个字段**（`types/hooks.ts:260-275`），常用 9 个：`message` / `blockingError`（阻塞错误 → 注入对话让模型自纠）/ `outcome`（success·blocking·non_blocking_error·cancelled）/ `preventContinuation` / `stopReason` / `permissionBehavior`（allow·deny·ask·passthrough）/ `updatedInput`（修改工具输入）/ `additionalContext` / `updatedMCPToolOutput`。
- ★★**关键不变式：hook 的 `allow` 不能绕过 deny/ask 规则**（`toolHooks.ts:325-331`）——作者称之为「CC 权限系统最重要的安全设计」：即使用户的 hook 脚本说「允许」，settings.json 里禁用了该工具，操作**仍然被阻止**。
  作者对教学版的自评：「教学版没有这个层次，只把 PreToolUse 的非 None 返回值解释为阻止本次工具执行。**这在教学场景中够了，但在生产环境中会形成安全漏洞。**」
  → **这是全片安全主题的收口句**，也是「教学模型与真实产品的距离」最有力的一处。
- **`stopHookActive` 防无限循环**（`query.ts:212,1300`）：stop hooks 产生 blockingError 时，循环带 `stopHookActive: true` 重入；后续迭代看到该标志就不再触发 stop hooks，防止「模型自纠 → stop hook 再报错 → 再自纠…」永不停机。
- **`hook_stopped_continuation`**：PostToolUse hook 返回 `preventContinuation: true` 会产生该附件（`toolHooks.ts:117-130`），`query.ts`（L1388-1393）检测到后置 `shouldPreventContinuation = true` 退出循环 ——「**不是崩溃，是完成**」。

---

## 五、跨章主线：「循环不变」的实测证据【一级，本集脊梁】

这是本集唯一需要自己动手测量、也是最有说服力的一条主线。方法：在 pinned commit 上抽出四章的 `agent_loop` 函数逐一 diff。

### 行数实测（`wc -l` / 非空非注释）

| 章 | `code.py` 总行 | 非空非注释 | `agent_loop` 总行 | `agent_loop` 非空非注释 |
|---|---|---|---|---|
| s01 | 141 | 106 | 31 | **23** |
| s02 | 191 | 145 | 23 | **20** |
| s03 | 241 | 181 | 30 | **24** |
| s04 | 255 | 203 | 35 | **28** |

→ **整个程序从 141 行长到 255 行（+81%），而循环函数始终在 20–28 行之间。** 这就是「循环不变」的量化版本。

### 逐章 diff（只列实质变更，注释与折行不计）

- **s01 → s02**（+5/−13，其中 11 行是删注释与折行合并）：**唯一实质变更就是执行那一行** ——
  `output = run_bash(block.input["command"])` → `handler = TOOL_HANDLERS.get(block.name); output = handler(**block.input)`。
  → **课程说「循环里只改了一行」，在这一步是成立的。**
- **s02 → s03**（+8/−1）：在执行前插入权限门 ——
  ```python
  if not check_permission(block):
      results.append({"type": "tool_result", "tool_use_id": block.id, "content": "Permission denied."})
      continue
  ```
  → ⚠️ 这是**插入 5 行**（if + append + continue），不是「只加一行」。课程原文说「s02 的循环只加了一行」，**口径偏乐观**。
- **s03 → s04**（+11/−6）：① `check_permission(block)` → `trigger_hooks("PreToolUse", block)`；
  ② **新增** Stop 钩子续跑分支（4 行：`force = trigger_hooks("Stop", messages)` → 注入 → `continue`）；
  ③ 新增 `trigger_hooks("PostToolUse", block, output)`。
  → ⚠️ 课程说「循环里只改了一处」，但实际上循环**新长出了一个退出前的分支**。

### 校准后的口播口径（★逐字稿必须用这一版）
> **四章下来，循环的骨架一字未改**：调模型 → 看回复里有没有工具调用 → 执行 → 把结果填回去 → 再来一轮。
> **变的只有「执行」那一步怎么写**：从写死一个命令，到查一张表，到先过一道闸门，到交给一排钩子。

这个说法比「循环一行都没改」既**更准确**（有实测支撑）又**更有力**（说清了到底什么在变），是本集主线。

---

## 六、站点与仓库的分歧清单（必须记录，且都不进口播）

| # | 分歧 | 轨 A 仓库 @ pinned | 轨 B 站点 @ 2026-08-21 | 处置 |
|---|---|---|---|---|
| 1 | **循环判据** | 检查内容里有没有 `tool_use` 块 | `stop_reason == "tool_use"` | **采用仓库版**。站点的「深入 CC 源码」正是把「教学版用 stop_reason」当作与 CC 的差异来讲，而仓库已改成内容块判定 —— 这条差异事实上已被消除。口播讲「看回复里有没有工具调用」，并把「为什么不能只看那个停止标记」作为记忆点。 |
| 2 | **总章数** | s01→…→s16→s17（**17 章**），s01 自述「后面 16 个章节」 | s01→…→**s20**（20 章） | **口播不引用总章数**（活数据，说死必陈旧）。画面若需体现「后面还有很多章」，用不带数字的表达。 |
| 3 | **章节 LOC 指标** | 实测 141/191/241/255（非空非注释 106/145/181/203） | 102/135/180/232 | **口播不引用绝对行数**。站点数字用任何口径都复算不出（尤其 s04 声称 232，而实测非空只有 213），应为早期 commit 的遗留值。画面若要给数字，用**我方实测值 + 口径 + 取数日期**。 |
| 4 | **s03 闸门 2 覆盖范围** | `["read_file","write_file","edit_file"]`，msg `"Access outside workspace"` | `["write_file","edit_file"]`，msg `"Writing outside workspace"` | 采用仓库版（更全）。口播只说「读写工作区之外」。 |
| 5 | **中段章节编号** | `s10_task_system` | s12 Task System | 与本集无关（只涉及 s05+），仅记录。 |
| 6 | **「循环只改一行」** | 实测 s02 成立、s03 是插 5 行、s04 另长出分支 | 三章都说「只改了一行/一处」 | 见 §五「校准后的口播口径」。 |
| 7 | **s03 试一下 prompt 2** | `Delete the file test.txt` | `Delete all temporary files in /tmp` | 画面若复现终端示例，用仓库版。 |
| 8 | **s04 深入节** | 仓库 README **没有**「深入 CC 源码」节 | 有（27 事件 / 14 字段 / 不变式…） | 该节全部内容标【三级】，口播必须加归属句。 |

---

## 七、站点交互式可视化的文字规格（供 Remotion 概念重建）

**纪律**：只重建**概念与信息结构**，不复刻站点美术；配色、构图、动效一律用本集视觉契约（[../script/planning.md](../script/planning.md)）。

1. **Agent While-Loop（s01，7 帧）**
   - 标题 "The While Loop"；条件行 `while (stop_reason === "tool_use")`（⚠️ 站点旧判据，我方重建时改为「回复里有 tool_use 块吗」）。
   - 节点序列：`Start` → `API Call` → `stop_reason?` → 分两支：`tool_use` → `Execute Tool` → `Append Result` → 回到 `API Call`；`end_turn` → `Break / Done`。
   - 侧栏 `messages[]` 面板，初值 `[ empty ]`，随轮次增长。
   - 帧文案：「Every agent is a while loop that keeps calling the model until it says 'stop'.」
2. **Tool Dispatch Map（s02，6 帧）**
   - 标题 "The Dispatch Map"；状态行 `Incoming: waiting for tool_call...`；动作 `dispatch(name)`。
   - 四行条目：`bash` — Execute shell commands；`read_file` — Read file contents；`write_file` — Create or overwrite a file；`edit_file` — Apply targeted edits。
   - 代码显示 `const handlers = { bash, read_file, write_file, edit_file, };`
   - 帧文案：「A dictionary maps tool names to handler functions. **The loop code never changes.**」
3. **Permission Desk（s03，6 帧）**
   - 标题 "Three Requests, Three Routes"；副标「Permission is a router: safe calls run, risky calls ask, forbidden calls stop.」
   - 三个请求 → 三条路线：
     - `read_file` `README.md` — read-only workspace file → **allow**（"No write, no shell, no approval needed."）
     - `bash` `rm -rf ./tmp/build-cache` — local destructive command → **ask**（"May be useful, but requires a human yes."）
     - `bash` `sudo rm -rf /` — forbidden root delete → **deny**（"Root delete and sudo never reach handlers."）
   - Beginner rule：「the model proposes tools; the runtime routes each request to allow, ask, or deny **before execution**.」
4. **Hook Workbench（s04，6 帧）**
   - 标题 "Hooks Are Registered Outside the Loop"；引导句「The loop **stays boring on purpose**: it calls `trigger_hooks(event)`, and the registry decides what extra logic runs.」
   - 四个插槽（槽名 / 时机 / 已注册回调）：
     `UserPromptSubmit`（after input, before LLM）→ `context_inject_hook`；
     `PreToolUse`（after tool_use, before handler）→ `permission_hook`, `log_hook`；
     `PostToolUse`（after handler, before next turn）→ `large_output_hook`；
     `Stop`（before final output）→ `summary_hook`。
   - 本轮输入示例：`Read README.md and summarize it.`；审计日志：`[registry] four hook slots registered`。
   - 尾注：「The loop only knows event names; callback behavior lives in the registry.」

### 六张 SVG 的文字规格
`agent-loop.svg`（s01 循环环路）· `tool-dispatch.svg`（工具名→handler 分发）· `concurrency-comparison.svg`（并发 vs 串行对比）· `permission-overview.svg`（三闸门总览）· `permission-pipeline.svg`（闸门串联管线）· `hooks-overview.svg`（钩子挂在循环外）。
站点未提供这些图的文字描述（仅 alt 文本），其概念与上述交互可视化重合 —— **重建以交互可视化的信息结构为准，不参照 SVG 造型**。

---

## 八、科普叙事素材库（金句 / 比喻 / 例子）

- 【一】仓库 README 主张（比站点更完整，适合 P5/P6 收束）：
  - "Bash is all you need - A nano claude code–like 「agent harness」, built from 0 to 1"
  - ★"**Agency comes from the model. The harness gives agency a place to land.**"（能动性来自模型，脚手架给能动性一个落地的地方）
  - "**Agency is learned, not coded.**"（能动性是学出来的，不是编出来的）—— 反对把 if-else 编排、节点图当成造 agent
- 【二】"One loop & Bash is all you need"；【一】「三十多行，这就是最小可运行的 agent harness 内核」
- 【三】"1729 行的 query.ts 核心就是 30 行 `while True`。所有复杂字段和退出路径都是保护机制。"
- 【一】「你想扩展的是 Agent 的行为，但你改的却是循环本身。」
- 【二】"The loop stays boring on purpose."（循环是**故意**保持无聊的）—— 极佳的 P4 主句
- 【三】"不是崩溃，是完成。"（`hook_stopped_continuation`）
- 【三】"这在教学场景中够了，但在生产环境中会形成安全漏洞。"（作者对教学版权限层的自评）
- 【一】「这张表使用简单字符串匹配来说明权限闸门的位置，不能视为完整的安全边界。」

**可用的比喻（自拟，需在逐字稿标注为比喻而非事实）**
- 循环 = **传送带**；模型举手要工具 = 传送带继续转，模型不举手 = 停机。
- `stop_reason` 不可靠 = **信号灯会滞后，改看货舱里到底有没有货**。
- 分发表 = **前台的转接号码簿**：来电报名字，前台查表转接；换人只改簿子，不改前台的工作流程。
- 三道闸门 = **门禁三道**：黑名单直接挡、灰名单请示、其余刷卡即过。
- 钩子 = **插线板**：循环是墙上的插座，功能是插头；加功能是插一个插头，不是重新布线。
- State 10 字段 = **十个抽屉**，每个抽屉后面对应课程后面某一章。
- FileRead 落盘无限循环 = **把便条塞进抽屉，下次读便条又生成一张新便条**。

---

## 九、口播禁用清单（活数据 / 不可核验项）

1. **不说**站点的 LOC 绝对数字（102/135/180/232）—— 复算不出（§六-3）。
2. **不说**课程总章数（17 还是 20 两轨不一致）。
3. **不说** GitHub star 数（74792 @ 2026-08-21，活数据；画面若用须带取数日期）。
4. **不说** CC 源码的具体行号（`query.ts:830-834` 之类）—— 属【三级】，且无法核验；这些只进画面角标，并标注「课程作者的源码分析」。
5. **不把**【三级】断言说成 Claude Code 的既成事实 —— 一律加归属句。
6. **不说**「循环一行都没改」—— 用 §五 校准后的口径。
7. **不出现**任何其他系列的片名、集数序号、「上一集/本系列」等顺序词（`check_series.py` 规则 1 会拦）。
8. **英文标识符不进口播**（`stop_reason` / `tool_use` / `TOOL_HANDLERS` / `PreToolUse` 等一律说中文白话，英文只进画面角标）；唯一例外是不可回避的产品名 **Claude Code**。
