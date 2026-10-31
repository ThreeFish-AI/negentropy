# 取证字节归档 · 出处表

| 项 | 值 |
|---|---|
| 上游项目 | shareAI-lab/learn-claude-code（"Bash is all you need" 教学仓） |
| 仓库 URL | https://github.com/shareAI-lab/learn-claude-code |
| 固定提交 · main 轨 | `7226f555d48900076eba126acf37c9ed5f002b5d`（仓库 main（17 章整合版），提交日 2026-10-27，= 2026-10-31 复核日 main HEAD）→ 归档 `7226f555/`（s03：`README.zh.md.txt` / `code.py`；台账 `s03-readme` / `s03-code`；2026-10-31 归档。**本集钉选轨（开工翻钉 main）**，理由：其一，站点轨 s03 code.py 循环退出判据仍写 `stop_reason`（与 s01/s02 同款），直引必与 ep1 所教「认内容块不认收尾字段」自相矛盾；其二，main 前移增量正面服务本集——闸门 2 新增 `DESTRUCTIVE_COMMAND_WORD` 词边界正则与测试点 5 负例走查（课程「字符串表 → 词边界正则 → CC 分类器」三步走第二步实件）＋ SYSTEM 提示新增「Do not ask for approval yourself … the harness will approve or deny before execution」；自旧系列旧钉 `ce8f9f18` 的 13 提交窗口内 s03 README.zh.md 逐字一致、code.py 仅此两处差异） |
| 固定提交 · 站点轨 | `67a9126c6435a8654ba7a6f68c0fd2130f00a462`（fix/s08-s20-sync-frontmatter-parser = 站点同源修订（20 章版，本系列集制骨架），提交日 2026-07-29，分支 HEAD 至 2026-10-31 未动）→ 归档 `67a9126c/`（s03：`README.md.txt` / `code.py`；台账 `s03f-readme` / `s03f-code`，指纹与旧系列 2026-10-09 登记逐字一致；含 s03 独有「深入 CC 源码」附录六节（PermissionResult 四裁决 / 验证阶段 / 8 来源 / isDestructive 纯 UI / YoloClassifier / 权限冒泡）——【三】级断言正源；立场句原句「安全不能靠信任模型，要靠代码」亦锚此轨，main 已改写措辞） |
| 站点实况 | learn.shareai.run/zh/s03/ 台账 `s03-site`（2026-10-31 fetch：raw `ae54c96b095bc788` / text `1a3fc2a7a75dec35`，与旧系列 2026-10-07 基线指纹零漂移） |
| 许可 | MIT；两钉点 `LICENSE` 字节一致（承 ep1/ep2 归档复核）：sha256 = `204ff5ee216c8f895268a23b66d959f82aa4d868e871e0690fbf2844eff8a26b` |
| 取数日期 | 双轨均 2026-10-31（本集开工归档）；本集 C 型信源 = gl-notes.md，冻结自 docs/research/agent-harness/171 精读（I-234 整改后代次，与 ep1/ep2 同一冻结正文代次） |
| 指纹台账 | 同目录 `../sources.toml`（repo 条目 `source_ledger.py fetch` 逐条登记；系列地图钉值同步属编排者层） |

章→集归属与钉选不在此重述：唯一登记处为系列信源地图
[../../../../source-map/claude-code-chapters.md](../../../../source-map/claude-code-chapters.md)。
归档文件用 `.md.txt`/`.py` 后缀（避免上游原文相对链接被 check_series 规则 5 误判）。
