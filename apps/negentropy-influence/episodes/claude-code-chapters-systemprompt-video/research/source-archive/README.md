# 取证字节归档 · 出处表

| 项 | 值 |
|---|---|
| 上游项目 | shareAI-lab/learn-claude-code（"Bash is all you need" 教学仓） |
| 仓库 URL | https://github.com/shareAI-lab/learn-claude-code |
| 固定提交 · 站点轨（本集钉选） | `67a9126c6435a8654ba7a6f68c0fd2130f00a462`（fix/s08-s20-sync-frontmatter-parser = 站点同源修订（20 章版），提交日 2026-07-29，分支 HEAD 至 2026-10-31 未动）→ 归档 `67a9126c/`（s10_system_prompt：`README.md.txt` / `code.py`；台账 `s10-readme` / `s10-code`；2026-10-31 归档。双件 raw 指纹与旧系列 2026-10-07 基线逐字一致。s10 是 system prompt 组装机制唯一独立章形态：PROMPT_SECTIONS 四段「三恒加一按需」＋ get_system_prompt 进程内缓存完整教学实现，附「深入 CC 源码」深潜附录——【三】级断言正源） |
| 固定提交 · main 轨（对照登记） | `7226f555d48900076eba126acf37c9ed5f002b5d`（仓库 main（17 章整合版），提交日 2026-10-27，2026-10-31 复核仍为 main 尖）→ 归档 `7226f555/`（s15_integrated_harness：`README.zh.md.txt` / `code.py`；台账 `s10m-readme` / `s10m-code`。main 轨无 s10 独立目录（404 实测），机制以七键 PROMPT_SECTIONS 每轮重建形态隐式吸收进 s15；自冻结源所记旧钉 `ce8f9f18` 前移 13 提交，assemble_system_prompt 函数体与七键字典两钉逐字一致——复核见 gl-notes 附录 B.1） |
| 站点实况 | learn.shareai.run/zh/s10/ 台账 `s10-site`（2026-10-31 fetch：raw `d5a5e8a3c3df61c4` / text `98e21a327954ee17`，与旧系列 2026-10-07 基线指纹零漂移） |
| 许可 | MIT；两钉点 `LICENSE` 字节一致（承 ep1/ep2 归档复核）：sha256 = `204ff5ee216c8f895268a23b66d959f82aa4d868e871e0690fbf2844eff8a26b` |
| 取数日期 | 双轨均 2026-10-31（本集开工归档）；本集 C 型信源 = gl-notes.md，冻结自 docs/research/agent-harness/172 精读（2026-10-23 I-235 注解后代次） |
| 指纹台账 | 同目录 `../sources.toml`（repo 条目 `source_ledger.py fetch` 逐条登记；系列地图钉值同步属编排者层） |

章→集归属与钉选不在此重述：唯一登记处为系列信源地图
[../../../../source-map/claude-code-chapters.md](../../../../source-map/claude-code-chapters.md)。
归档文件用 `.md.txt`/`.py` 后缀（避免上游原文相对链接被 check_series 规则 5 误判）。
