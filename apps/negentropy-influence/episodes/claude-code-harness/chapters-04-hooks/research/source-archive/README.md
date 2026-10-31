# 取证字节归档 · 出处表

| 项 | 值 |
|---|---|
| 上游项目 | shareAI-lab/learn-claude-code（"Bash is all you need" 教学仓） |
| 仓库 URL | https://github.com/shareAI-lab/learn-claude-code |
| 固定提交 · main 轨 | `7226f555d48900076eba126acf37c9ed5f002b5d`（仓库 main（17 章整合版）HEAD，提交日 2026-10-27）→ 归档 `7226f555/`（s04：`README.zh.md.txt` / `code.py`；台账 `s04-readme` / `s04-code`；2026-10-31 归档。本集翻钉 main：判据措辞用内容块（`tool_calls` 列表 + `if not tool_calls`）与 ep1 所教「认内容不认收尾字段」同口径（站点轨 s04 仍写 `stop_reason`）；Stop 事件行与返回值段把「决定是否继续循环 / 返回非 None 时循环继续」写进教学正文——本集 Stop 强制续跑记忆点的正源措辞（站点轨把它括注为「CC 还支持强制续跑」，实为教学版自身能力，口径归错层）。自旧系列旧钉 `ce8f9f18` 前移 13 提交，s04 仅 README 3 行代码注释英译中 + code.py 空输入守卫 2 行（与 s01/s02 前移同款，无叙事影响）） |
| 固定提交 · 站点轨 | `67a9126c6435a8654ba7a6f68c0fd2130f00a462`（fix/s08-s20-sync-frontmatter-parser = 站点同源修订（20 章版），提交日 2026-07-29，分支 HEAD 至 2026-10-31 未动，GitHub API 复核）→ 归档 `67a9126c/`（s04：`README.md.txt` / `code.py`；台账 `s04f-readme` / `s04f-code`，指纹与旧系列 2026-10-09 登记逐字一致；含 s04 独有「深入 CC 源码」附录（27 个 hook 事件 / HookResult 14 字段 / Hook allow 压不过 deny-ask 不变式 / stopHookActive / hook_stopped_continuation +「教学版的简化是刻意的」对照表）——【三】级断言正源） |
| 站点实况 | learn.shareai.run/zh/s04/ 台账 `s04-site`（2026-10-31 fetch：raw `3ec4a442808b2a5d` / text `213cc53568f96038`，与旧系列 2026-10-07 基线指纹零漂移） |
| 许可 | MIT；两钉点 `LICENSE` 字节一致（承 ep1/ep2 归档复核）：sha256 = `204ff5ee216c8f895268a23b66d959f82aa4d868e871e0690fbf2844eff8a26b` |
| 取数日期 | 双轨均 2026-10-31（本集开工归档）；本集 C 型信源 = gl-notes.md，冻结自 docs/research/agent-harness/171 精读（I-234 整改后代次，与 ep1/ep2 同一冻结正文代次） |
| 指纹台账 | 同目录 `../sources.toml`（repo 条目 `source_ledger.py fetch` 逐条登记；官方补读页 `doc-hooks` 一并存证；系列地图钉值同步属编排者层） |

章→集归属与钉选不在此重述：唯一登记处为系列信源地图
[../../../../../source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。
归档文件用 `.md.txt`/`.py` 后缀（避免上游原文相对链接被 check_series 规则 5 误判）。
