# 取证字节归档 · 出处表

| 项 | 值 |
|---|---|
| 上游项目 | shareAI-lab/learn-claude-code（"Bash is all you need" 教学仓） |
| 仓库 URL | https://github.com/shareAI-lab/learn-claude-code |
| 许可 | MIT（`67a9126/LICENSE`、`ce8f9f1/LICENSE` 为各自固定提交下许可文件的字节副本） |
| 固定提交（双轨） | 站点轨 `67a9126c6435a8654ba7a6f68c0fd2130f00a462`（fix 分支，20 章版，提交日 2026-07-29；站点 learn.shareai.run 实况与之 2026-10-07 对账一致）＋ main 轨 `ce8f9f186058939da54c9d6fead78dfb5d0fd6c3`（17 章版，提交日 2026-09-28） |
| 归档布局 | `67a9126/` = 站点轨 s08_context_compact / s09_memory 两章（README.md 中文默认 + code.py）；`ce8f9f1/` = main 轨同两章（README.md 英文默认 + README.zh.md 中文 + code.py，**s08 机制级演进对照信源**：占位符幂等 / seen-unseen 未读豁免 / 压前落盘） |
| 取数日期 | 2026-10-07（剧本 v3 换代重归档；本集 C 型信源 = gl-notes.md，冻结自 docs/research/agent-harness/173 精读） |
| 指纹台账 | 同目录 `../sources.toml`（`source_ledger.py fetch` 逐条登记于两钉点；章号三轨撞号防御见工作区根 .temp/lcc-refresh/chapter-map.md——引用一律「轨名 + 目录名」，禁裸章号） |

章→集归属与钉选不在此重述：唯一登记处为系列信源地图
[../../../../source-map/claude-code-explained.md](../../../../source-map/claude-code-explained.md)。
归档文件用 `.md.txt`/`.py` 后缀（避免上游原文相对链接被 check_series 规则 5 误判）。
