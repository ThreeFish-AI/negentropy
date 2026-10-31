# 取证字节归档 · 出处表

| 项 | 值 |
|---|---|
| 上游项目 | shareAI-lab/learn-claude-code（"Bash is all you need" 教学仓） |
| 仓库 URL | https://github.com/shareAI-lab/learn-claude-code |
| 固定提交 · main 轨 | `7226f555d48900076eba126acf37c9ed5f002b5d`（仓库 main（17 章整合版），提交日 2026-10-27）→ 归档 `7226f555/`（s14_mcp_plugin：`README.zh.md.txt` / `code.py`；台账 `s19-readme` / `s19-code`；2026-10-31 归档。本集翻钉 main：s14 相对站点轨 s19 有三节机制级正源增量——§6「权限由宿主配置决定」（`MCP_HOST_POLICY` 4 条 + 未配置默认 confirm + readOnlyHint 不作授权依据）、§4 规范化撞名直接 raise + 全名 > 64 字符拒绝、§7「工具输入错误留在工具边界内」） |
| 固定提交 · 站点轨 | `67a9126c6435a8654ba7a6f68c0fd2130f00a462`（fix/s08-s20-sync-frontmatter-parser = 站点同源修订（20 章版），提交日 2026-07-29）→ 归档 `67a9126c/`（s19_mcp_plugin：`README.md.txt` / `code.py`；台账 `s19f-readme` / `s19f-code`，指纹与旧系列 2026-10-02 登记逐字一致；含 s19 独有「深入 CC 源码」八小节附录（6 种 transport / 工具池组装算法 / 命名规则 / 权限检查 / 配置优先级 / Channel 反向通知 / OAuth / 连接生命周期错误处理）——【三】级断言正源；「无缓存」叙事与 `BUILTIN_TOOLS` 18 计数亦在该轨） |
| 站点实况 | learn.shareai.run/zh/s19/ 台账 `s19-site`（2026-10-31 fetch：raw `2d7a8cc14a0f0f1d` / text `cc3009bddeb4b61f`，与旧系列 ep5 台账 2026-10-02 登记基线指纹零漂移） |
| 许可 | MIT；两钉点 `LICENSE` 字节一致：sha256 = `204ff5ee216c8f895268a23b66d959f82aa4d868e871e0690fbf2844eff8a26b` |
| 取数日期 | 双轨均 2026-10-31（本集开工归档）；本集 C 型信源 = gl-notes.md，冻结自 docs/research/agent-harness/175 精读（2026-10-07 换代重写后现行代次） |
| 指纹台账 | 同目录 `../sources.toml`（repo 条目 `source_ledger.py fetch` 逐条登记；系列地图钉值同步属编排者层） |

章→集归属与钉选不在此重述：唯一登记处为系列信源地图
[../../../../source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。
归档文件用 `.md.txt`/`.py` 后缀（避免上游原文相对链接被 check_series 规则 5 误判）。
