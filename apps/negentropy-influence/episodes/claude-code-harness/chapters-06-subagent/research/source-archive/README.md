# 取证字节归档 · 出处表

| 项 | 值 |
|---|---|
| 上游项目 | shareAI-lab/learn-claude-code（"Bash is all you need" 教学仓） |
| 仓库 URL | https://github.com/shareAI-lab/learn-claude-code |
| 固定提交 · main 轨（**钉选轨**） | `7226f555d48900076eba126acf37c9ed5f002b5d`（仓库 main（17 章整合版），提交日 2026-10-27）→ 归档 `7226f555/`（s06：`README.zh.md.txt` / `code.py`；台账 `s06-readme` / `s06-code`；2026-10-31 归档。钉选理由：站点轨 s06 判据仍写 `stop_reason != "tool_use"`（code.py `:218`/`:330`），直引必与 ep1 所教「认内容块不认收尾字段」自相矛盾，main `:291`/`:344` 已是内容块判据；自旧钉 `ce8f9f18` 前移 13 提交对 s06 仅 2 提交——`2f8cfb0` 空输入守卫 2 行（同 s01/s02 款）+ `a2f8162` 注释中文化（docs），机制零变化；五决策表与「隔离的是消息，不是进程或文件系统」为本集边界叙事正源） |
| 固定提交 · 站点轨 | `67a9126c6435a8654ba7a6f68c0fd2130f00a462`（fix/s08-s20-sync-frontmatter-parser = 站点同源修订（20 章版），提交日 2026-07-29，分支 HEAD 至 2026-10-31 未动）→ 归档 `67a9126c/`（s06：`README.md.txt` / `code.py`；台账 `s06f-readme` / `s06f-code`，指纹与旧系列 2026-10-07 登记逐字一致；含 s06 独有「深入 CC 源码」附录六小节（三种执行模式 / Fork 缓存五组件 / 隔离粒度 readFileState / 递归 Fork 防护 / Permission Bubbling / Async vs Sync）——【三】级断言正源；课程叙事例数 30 文件 / 60 轮 / 120 条与「开一个新终端」讲法仅在此轨） |
| 站点实况 | learn.shareai.run/zh/s06/ 台账 `s06-site`（2026-10-31 fetch：raw `f73b509cd83671d0` / text `5485fb25c5a7b75c`，与 2026-10-07 基线指纹零漂移） |
| 许可 | MIT；两钉点 `LICENSE` 字节一致（承 ep1/ep2 归档复核）：sha256 = `204ff5ee216c8f895268a23b66d959f82aa4d868e871e0690fbf2844eff8a26b` |
| 取数日期 | 双轨均 2026-10-31（本集开工归档）；本集 C 型信源 = gl-notes.md，冻结自 docs/research/agent-harness/172 精读现行代次（I-234 词族整改后，与 ep1/ep2 同代次纪律） |
| 指纹台账 | 同目录 `../sources.toml`（repo 条目 `source_ledger.py fetch` 逐条登记；系列地图钉值同步属编排者层——本集翻钉 main，地图 `[[pin]]` episodes 归属待编排者更新） |

章→集归属与钉选不在此重述：唯一登记处为系列信源地图
[../../../../../source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。
归档文件用 `.md.txt`/`.py` 后缀（避免上游原文相对链接被 check_series 规则 5 误判）。
