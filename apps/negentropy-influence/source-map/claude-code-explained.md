# 系列信源地图 · Claude Code Harness Engineering（原「通俗全解」，2026-08-23 更名）

> 机器可读版：[claude-code-explained.toml](./claude-code-explained.toml)。本文件与
> [series.json](../series.json) / [series.md](../series.md) 是同一配对纪律：机器版供
> `source_ledger.py sync/audit` 消费，人读版解释**为什么**。

《Learn Claude Code》课程有**两轨现行修订 + 一轨历史遗产**，章号不共用（撞号防御见
第二节）。哪一章归哪一集、哪一集钉哪个提交，**全系列只在本目录登记**；各集
`research/source-notes.md` 只链接本文，永不重述——重述即第二事实源，两轨章号错位时必然漂移。

## 一、修订分叉（为什么双钉）

| 轨 | 修订 | 章 | 中文章名 | 提交 |
|---|---|---|---|---|
| 站点 `learn.shareai.run/zh` | 2026-07 修订 | **20 章** | `README.md` | `67a9126c`（2026-07-29，分支 `fix/s08-s20-sync-frontmatter-parser`，站点内容与该分支逐字一致；**2026-09-28 线上复验未动**） |
| 仓库 `main` | 2026-08 整合 | **17 章** | `README.zh.md` | `ce8f9f18`（2026-09-28；2026-10-01 重钉——旧钉 `0dcafa2a`（2026-08-27；再旧 `f9e8b280`）后仅 2 提交 #586/#587，s01–s04 各章 code.py 净增 +9/10 行 OS-aware shell context，无机制级变更；重钉对齐 171 号精读所读轨） |
| 旧 12 课轨（历史遗产） | 仓库 `docs/` + `agents/` | 12 课 | 三语 markdown | 两钉上均在，属最老一层，**仅作考古对照，禁止引用**（本仓两处旧引用已于 2026-09-28 消歧） |

这是 ISSUE-165「站点 LOC 复算不出」的真正根因：**站点整站是课程的旧修订**，页面上
的数字与旁边的代码本就不是同一时刻的产物。双钉因此不是技术巧合，而是逐集的内容决策：

- **ep2–ep5 钉 `67a9126c`**：用户的五大分组（工具与执行 / 规划与协调 / 记忆管理 /
  并发 / 多 Agent 平台）正是站点 20 章版的 `LAYERS`，只在该修订下成立；
- **ep1 钉 main 新头（`ce8f9f18`，171 精读轨）**：其核心记忆点「看内容块别信停止标记」正依赖
  main 比站点新——站点的「深入 CC 源码」把「教学版看 stop_reason」当作与产品的差异
  来讲，而 main 已把判据改成内容块。钉站点轨会让这条对比失去靶子（2026-09-27 重钉
  随重调研同步，s03 新增的破坏性命令词正则是 ep1 复核增量；2026-10-01 重钉对齐
  171 号精读所读 `ce8f9f18`，逐字稿 code.py:NN 锚点与精读同树可复算）。

耐久性：`67a9126c` 在未合并分支上（分支被强推/删除则 raw URL 失效）。
`source_ledger.py verify` 会在 raw 指纹漂移时 FAIL 报警，台账已登记全指纹
`raw_sha256` 兜底；每集取证字节另归档至 `research/source-archive/<pin>/`（MIT 许可）。

## 二、撞号防御（三轨编号不共用——本表是全仓唯一展开层）

**三轨三物（最危险区）**：

| 号 | 旧 12 课 | main 17 章 | 站点 20 课 |
|:---|:---|:---|:---|
| s10 | Team Protocols | Task System | System Prompt |
| s11 | Autonomous Agents | Background Tasks | Error Recovery |
| s12 | Worktree+Task Isolation | Cron Scheduler | Task System |

**双轨撞号（旧轨 vs 新轨，s03–s09 自 s03 起全部错位）**：s03（旧 TodoWrite ↔ 新
Permission）、s04（旧 Subagent ↔ 新 Hooks）、s05（旧 Skill ↔ 新 TodoWrite）、s06（旧
Compact ↔ 新 Subagent）、s07（旧 Task System ↔ 新 Skill）、s08（旧 Background ↔ 新
Compact）、s09（旧 Teams ↔ 新 Memory）。

**双轨撞号（main vs 站点，s13–s17 全部错位）**：

| 号 | main 17 章 | 站点 20 课 |
|:---|:---|:---|
| s13 | Agent Teams | Background Tasks |
| s14 | MCP Plugin | Cron Scheduler |
| s15 | Integrated Harness | Agent Teams |
| s16 | Workflow Runtime | Team Protocols |
| s17 | Goal Loop | Autonomous Agents |

s18–s20 仅存在于站点轨；main 无 s18+。**s01/s02 是唯一三轨同号同物安全区**（但旧轨
是简化遗产实现）。另有一条**已消失的中间撞号层**：main 历史提交 `b36dbcd`（19 章态）
曾有 `s16_mcp_plugin`/`s17_integrated_harness`/`s18_workflow_runtime`——引任何历史
快照都须带 commit 号。**纪律：涉两轨同号一律「轨道 + 章全称」，禁止裸用编号。**

## 三、层 → 集归属

站点 20 章全部且恰好归入 5 集（机器版每章一行 `[[chapter]]`，此处为总览）：

| 集 | 工程 | 层（站点分组） | 章节 | 钉 |
|---|---|---|---|---|
| 1 | [claude-code-explained-video](../episodes/claude-code-explained-video/README.md) | 工具与执行 | s01 · s02 · s03 · s04 | `ce8f9f18` |
| 2 | [claude-code-planning-video](../episodes/claude-code-planning-video/README.md) | 规划与协调 | s05 · s06 · s07 · s10 · s11 | `67a9126c` |
| 3 | [claude-code-memory-video](../episodes/claude-code-memory-video/README.md) | 记忆管理 | s08 · s09 | `67a9126c` |
| 4 | [claude-code-concurrency-video](../episodes/claude-code-concurrency-video/README.md) | 并发 | s13 · s14 | `67a9126c` |
| 5 | [claude-code-multiagent-video](../episodes/claude-code-multiagent-video/README.md) | 多 Agent 平台 | s12 · s15 · s16 · s17 · s18 · s19 · s20 | `67a9126c` |

注：章号一律指**站点 20 章版**（ep1 的 s01–s04 目录名在两轨恰好相同）。
s20 不作 ep5 的普通章节、作终幕收束装置（一整轮七步传送带，标语「机制很多，
循环一个」直接回答系列主线）；s16（Team Protocols）单章取证，见机器版 note。

## 四、与 main 17 章版的对照

`sync`/`audit` 派生条目时**只消费 [[pin]] 与 [[chapter]]**，本节是给人的导航，不进机器判据：

| 站点 20 章版 | main 17 章版 | 关系 |
|---|---|---|
| s01–s09 | s01–s09（目录名逐一同名） | 两轨共有（内容仍有 2026-07→08 的演进，如 s01 循环判据；s08 在 main 有机制级演进——条件化 micro / fit_tool_results / 占位符幂等，站点轨均无） |
| s10 System Prompt | 隐式吸收进 `s15_integrated_harness` | 机制以 `assemble_system_prompt` 存续；s10 的独立课深潜（PROMPT_SECTIONS/缓存/CC 真实 prompt 解剖）只在站点轨 |
| s11 Error Recovery | 并入 `s15_integrated_harness` 尾部 | 恢复路径集一字不差纯并入；六节深潜只在站点轨 |
| s12 Task System | `s10_task_system` | 改号不改内容 |
| s13 Background Tasks | `s11_background_tasks` | 改号不改内容 |
| s14 Cron Scheduler | `s12_cron_scheduler` | 改号不改内容 |
| s15+s16+s17+s18（团队四课） | `s13_agent_teams`（单章 12 节） | 整合且有真增量：事件模型重构（结果与 IDLE 拆两事件）、认领两步化（发现与认领分离+原子执行）、worktree 语义加固（收归宿主侧+租约）、约束闭环（assignment version 使旧审批失效） |
| s19 MCP Plugin | `s14_mcp_plugin` | 改号不改内容 |
| s20 Comprehensive | `s15_integrated_harness` | 对应并被扩写（diff ~218 行；main 增量 = s08 新压缩管线 + s13 加固语义回灌） |
| —— | `s16_workflow_runtime` | main 新增，本系列不覆盖（精读归 174 附录） |
| —— | `s17_goal_loop` | main 新增，本系列不覆盖（精读归 172 附录） |

## 五、维护规则

1. **改动只发生在这里**：章→集归属、钉选、`readmeFile`（随修订变）、`sitePaths`
   的任何变更，一律改 TOML（并在本文件同步叙事）；各集 notes、storyboard、README
   不复述这些事实，只保留指向本文的相对链接。
2. **撞号防御唯一展开层是本文件第二节**：其余任何文档/代码提及撞号只链接此处，
   不再展开三轨对照表。
3. **命名方案由 sync 派生、audit 执法**：台账条目名 `{slug}-readme` / `{slug}-code`
   / `{slug}-site`（多 sitePath 时 `{slug}-site-{path}`），与既有交付集字节兼容——
   sync 不得另造命名，audit 会拒绝改名后的漂移条目。
4. **新集开工**：先 `sync --episode N`（幂等可续跑），交付前 `audit --episode N`
   离线零报警 + `verify`（在线）FAIL 0。
5. 章节增删（课程再改版）时：先在 TOML 登记新事实，再决定是否迁移旧集的钉——
   已交付集的钉**默认不动**（逐字稿冻在录音时刻，台账指纹即物证）。
