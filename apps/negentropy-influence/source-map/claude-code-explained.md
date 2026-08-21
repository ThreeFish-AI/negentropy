# 信源地图：《Learn Claude Code》→《Claude Code 通俗全解》系列

> 机器可读版（章节映射 / 双钉 / 台账派生规则）：[claude-code-explained.toml](./claude-code-explained.toml)——
> 本文件是其人读版，承载没有机器形态的叙事与维护规则。系列登记见 [../series.json](../series.json)。

## 一、修订分叉：站点与仓库不是同一时刻的产物

用户指定的信源是线上课程站点 `learn.shareai.run`。取证时查明（2026-08-22）：**站点整站对应仓库分支
`fix/s08-s20-sync-frontmatter-parser` @ `67a9126c6435a8654ba7a6f68c0fd2130f00a462`（2026-07-28）**——
20 章版；而仓库默认分支 `main` @ `f9e8b280f715f9ba107d4517fd39bc5f8ddda618`（2026-08-18）已整合为
**17 章版**。两轨的章节切分、编号、乃至中文文件名（旧修订 `README.md`，main 起 `README.zh.md`）都不同。

这不是普通的「编号漂移」，而是 **ISSUE-165 的根因再上探一层**：站点 LOC 数字复算不出，因为站点
整站是旧修订；散文与代码的新鲜度要分别评估之后，还要加一句——**站点与仓库的切分本来就不是同一时刻的产物**。

### 为什么双钉

| 集 | 钉版 | 理由 |
|---|---|---|
| 第 1 集《拆开 Claude Code：让 AI 动手的四层机制》 | `main` @ `f9e8b28` | 其核心记忆点「看内容块别信停止标记」正依赖 **main 比站点新**（站点教学版仍按停止标记判定）。已交付，钉版不动。 |
| 第 2–5 集 | 站点同源修订 `67a9126c` | 用户指定的 5 大分组（工具与执行 / 规划与协调 / 记忆管理 / 并发 / 多 Agent 平台）正是**站点版的层结构**；s10 System Prompt、s11 Error Recovery、s16 Team Protocols、s18 Worktree Isolation、s20 Comprehensive 只在该修订存在。代码轨与叙事轨必须同构，否则每条交叉引用都成分歧。 |

### 持久性风险与缓解

`67a9126c` 在未合并分支上——分支被强推或删除则 raw URL 失效（`source_ledger.py verify` 会 FAIL 报警兜底）。
缓解：fetch 时登记 raw_sha256 全指纹（台账已有）；各集把取证字节归档至 `research/source-archive/<pin前7位>/`。

## 二、层 → 集归属（20 章全覆盖）

| 站点分组 | 集 | 章节（站点编号） |
|---|---|---|
| 工具与执行 | 1（已交付） | s01 Agent Loop · s02 Tool Use · s03 Permission · s04 Hooks |
| 规划与协调 | 2 | s05 TodoWrite · s06 Subagent · s07 Skills · s10 System Prompt · s11 Error Recovery |
| 记忆管理 | 3 | s08 Context Compact · s09 Memory |
| 并发 | 4 | s13 Background Tasks · s14 Cron Scheduler |
| 多 Agent 平台 | 5 | s12 Task System · s15 Agent Teams · s16 Team Protocols · s17 Autonomous Agents · s18 Worktree Isolation · s19 MCP Tools · s20 Comprehensive |

第 5 集承载 7 章（约 271 KB 源码，压缩比约为第 4 集的 6 倍），采用**递进主线**消化：s19 一句话带过
（另一类问题：插件生态）、s20 不作独立章而作收束装置。取舍详见该集 `script/planning.md`。

## 三、与 main 17 章版的对照（记录，不覆盖）

| 站点 20 章版 | main 17 章版 | 处置 |
|---|---|---|
| s10 System Prompt | （无对应目录） | 本系列按站点版讲（第 2 集） |
| s11 Error Recovery | （无对应目录） | 本系列按站点版讲（第 2 集） |
| s12 Task System | s10_task_system | 章号漂移；口播永不提章号 |
| s13 Background Tasks | s11_background_tasks | 同上 |
| s14 Cron Scheduler | s12_cron_scheduler | 同上 |
| s15 Agent Teams | s13_agent_teams | 同上 |
| s16 Team Protocols | 并入 s13_agent_teams | 本系列单独成段（第 5 集） |
| s17 Autonomous Agents | s17_goal_loop（主题已变） | 本系列按站点版讲自治认领 |
| s18 Worktree Isolation | 并入 s13_agent_teams | 本系列单独成段（第 5 集） |
| s19 MCP Plugin | s14_mcp_plugin | 章号漂移 |
| s20 Comprehensive | s15_integrated_harness | 章号漂移 |
| （无） | s16_workflow_runtime、s17_goal_loop | **main 新增，本系列不覆盖**（记此免查） |

## 四、维护规则

1. 章节归属变更（如某章换集）**只改本目录两个文件**；随后重跑
   `source_ledger.py --project <P> audit --map <本文件同目录 toml> --episode <N>` 与各集 verify。
2. 各集 `research/source-notes.md` 的「分歧清单」只登记**本集章节**的分歧；修订级的事实（本文件 §一）一律链接至此。
3. 台账条目名由 `sync` 从本地图派生（`{slug}-readme` / `{slug}-code` / `{slug}-site`），不手写——防命名漂移。
