# 系列信源地图 ·《Claude Code 通俗全解》

> 机器可读版：[claude-code-explained.toml](./claude-code-explained.toml)。本文件与
> [series.json](../series.json) / [series.md](../series.md) 是同一配对纪律：机器版供
> `source_ledger.py sync/audit` 消费，人读版解释**为什么**。

《Learn Claude Code》课程有**两轨修订**，章号不共用。哪一章归哪一集、哪一集钉哪个提交，
**全系列只在本目录登记**；各集 `research/source-notes.md` 只链接本文，永不重述——
重述即第二事实源，两轨章号错位时必然漂移。

## 一、修订分叉（为什么双钉）

| 轨 | 修订 | 章 | 中文章名 | 提交 |
|---|---|---|---|---|
| 站点 `learn.shareai.run/zh` | 2026-07 修订 | **20 章** | `README.md` | `67a9126c`（2026-07-28，分支 `fix/s08-s20-sync-frontmatter-parser`，站点内容与该分支逐字一致） |
| 仓库 `main` | 2026-08 整合 | **17 章** | `README.zh.md` | `f9e8b280`（2026-08-18） |

这是 ISSUE-165「站点 LOC 复算不出」的真正根因：**站点整站是课程的旧修订**，页面上
的数字与旁边的代码本就不是同一时刻的产物。双钉因此不是技术巧合，而是逐集的内容决策：

- **ep2–ep5 钉 `67a9126c`**：用户的五大分组（工具与执行 / 规划与协调 / 记忆管理 /
  并发 / 多 Agent 平台）正是站点 20 章版的 `LAYERS`，只在该修订下成立；
- **ep1 维持 `f9e8b280` 不动**：其核心记忆点「看内容块别信停止标记」正依赖
  main 比站点新——站点的「深入 CC 源码」把「教学版看 stop_reason」当作与产品的差异
  来讲，而 main 已把判据改成内容块。钉旧提交会让这条对比失去靶子。

耐久性：`67a9126c` 在未合并分支上（分支被强推/删除则 raw URL 失效）。
`source_ledger.py verify` 会在 raw 指纹漂移时 FAIL 报警，台账已登记全指纹
`raw_sha256` 兜底；每集取证字节另归档至 `research/source-archive/<pin>/`（MIT 许可）。

## 二、层 → 集归属

站点 20 章全部且恰好归入 5 集（机器版每章一行 `[[chapter]]`，此处为总览）：

| 集 | 工程 | 层（站点分组） | 章节 | 钉 |
|---|---|---|---|---|
| 1 | [claude-code-explained-video](../episodes/claude-code-explained-video/README.md) | 工具与执行 | s01 · s02 · s03 · s04 | `f9e8b280` |
| 2 | claude-code-planning-video（规划中） | 规划与协调 | s05 · s06 · s07 · s10 · s11 | `67a9126c` |
| 3 | claude-code-memory-video（规划中） | 记忆管理 | s08 · s09 | `67a9126c` |
| 4 | claude-code-concurrency-video（规划中） | 并发 | s13 · s14 | `67a9126c` |
| 5 | claude-code-multiagent-video（规划中） | 多 Agent 平台 | s12 · s15 · s16 · s17 · s18 · s19 · s20 | `67a9126c` |

注：章号一律指**站点 20 章版**（ep1 的 s01–s04 目录名在两轨恰好相同）。
s20 不作 ep5 的普通章节、作终幕收束装置（一整轮七步传送带，标语「机制很多，
循环一个」直接回答系列主线）；s16（Team Protocols）单章取证，见机器版 note。

## 三、与 main 17 章版的对照

`sync`/`audit` 派生条目时**只消费 [[pin]] 与 [[chapter]]**，本节是给人的导航，不进机器判据：

| 站点 20 章版 | main 17 章版 | 关系 |
|---|---|---|
| s01–s09 | s01–s09（目录名逐一同名） | 两轨共有（内容仍有 2026-07→08 的演进，如 s01 循环判据） |
| s10 System Prompt | 并入 `s15_integrated_harness` | 「组装 system prompt / 压缩和错误恢复」成为 s15 的循环步 |
| s11 Error Recovery | 并入 `s15_integrated_harness` | 同上（429 重试、`max_tokens` 升级、reactive compact） |
| s12 Task System | `s10_task_system` | 改号不改内容 |
| s13 Background Tasks | `s11_background_tasks` | 改号不改内容 |
| s14 Cron Scheduler | `s12_cron_scheduler` | 改号不改内容 |
| s15 Agent Teams + s16 Team Protocols + s17 Autonomous + s18 Worktree | `s13_agent_teams` | 四章整合为「团队运行时与协作协议」 |
| s19 MCP Plugin | `s14_mcp_plugin` | 改号不改内容 |
| s20 Comprehensive | `s15_integrated_harness` | 对应并被扩写（多出 worktree 与 MCP、运行时上下文等小节） |
| —— | `s16_workflow_runtime` | main 新增，本系列不覆盖 |
| —— | `s17_goal_loop` | main 新增，本系列不覆盖 |

## 四、维护规则

1. **改动只发生在这里**：章→集归属、钉选、`readmeFile`（随修订变）、`sitePaths`
   的任何变更，一律改 TOML（并在本文件同步叙事）；各集 notes、storyboard、README
   不复述这些事实，只保留指向本文的相对链接。
2. **命名方案由 sync 派生、audit 执法**：台账条目名 `{slug}-readme` / `{slug}-code`
   / `{slug}-site`（多 sitePath 时 `{slug}-site-{path}`），与 ep1 已交付的 12 条
   （`s01-readme` … `s04-site`）字节兼容——sync 不得重造命名，audit 会拒绝改名后
   的漂移条目。
3. **新集开工**：先 `sync --episode N`（幂等可续跑），交付前 `audit --episode N`
   离线零报警 + `verify`（在线）FAIL 0。
4. 章节增删（课程再改版）时：先在 TOML 登记新事实，再决定是否迁移旧集的钉——
   已交付集的钉**默认不动**（逐字稿冻在录音时刻，台账指纹即物证）。
