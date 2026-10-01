# 230 数字对账表（Agent Skills 开放标准精读）

对账对象：[230-agent-skills-standard.md](../../../../../docs/research/agent-infra/230-agent-skills-standard.md) 的 §9 关键实证数字查找表与 §4/§10 实验数字。复算日 2026-10-01；钉点 `69ef37e9`（clone 于 `.temp/agent-skills-open-standard-lab/repo`，易失临时物，命令可重跑）；Agent B 落盘信源 `sources/S0–S5.txt`（同 .temp 下）；实验六日志 `$P/research/lab4-*.log`（$P = 本集 research 目录）+ 仓内 tracked 自证件 `docs/research/agent-infra/assets/lab4-selftest.json`。判定取值：一致 / 漂移 / 口径差。

## 一、格式量级（规范与指南）

| 数字 | 230 口径与出处 | 证据指针 | 复算结果 | 判定 |
| --- | --- | --- | --- | --- |
| 目录 ~50–100 token/技能 | §4 三级表·§9 行1 [1] | repo@69ef37e9 `docs/client-implementation/adding-skills-support.mdx` L24 "Catalog … ~50-100 tokens per skill"、L184 "roughly 50-100 tokens" | 逐字一致；`specification.mdx` L220 另有 "~100 tokens" 单点上界口径，两源合围 50–100 | 一致 |
| 正文建议 <5000 token | §4 三级表 [1] | `specification.mdx` L221 "< 5000 tokens recommended" | 逐字一致 | 一致 |
| 正文建议 <500 行 | §4 三级表 [1] | `specification.mdx` L224 "Keep your main SKILL.md under 500 lines" | 逐字一致 | 一致 |
| name 1–64 字符 | §3 字段表 [1] | `specification.mdx` L61 "Must be 1-64 characters" | 逐字一致 | 一致 |
| description 1–1024 字符 | §3 字段表·§5 [1] | `specification.mdx` L94 "Must be 1-1024 characters" | 逐字一致 | 一致 |
| compatibility 1–500 字符 | §3 字段表 [1] | `specification.mdx` L126 "Must be 1-500 characters if provided" | 逐字一致 | 一致 |
| 六字段白名单（name/description/license/compatibility/metadata/allowed-tools） | §3·§8 分歧1 [1][2][3] | `specification.mdx` 字段表恰 6 行；lab4-selftest.log `[strict]` 报错白名单恰列此 6 项；S3.txt L403–409 "packaging or upload fails with a hard error"（claude.ai 上传面） | 三源同构；Claude Code 文档 L394–409 明示规范外字段打包/上传即硬错 | 一致 |

## 二、客户端预算门（三家实测口径）

| 数字 | 230 口径与出处 | 证据指针 | 复算结果 | 判定 |
| --- | --- | --- | --- | --- |
| Codex 初始目录 ≤ 窗口 2%，未知时 8000 字符 | §4·§9 行2 [4] | S4.txt L775–776 "at most 2% of the model's context window, or 8,000 characters when the context window is unknown" | 逐字一致 | 一致 |
| Codex 超限先截 description，大集可省略并警告 | §4 [4] | S4.txt L777–778 "shortens skill descriptions first … may omit some skills … and show a warning" | 逐字一致 | 一致 |
| Claude Code 收 20 个 frontmatter 字段（规范 6 + 扩展 14） | §8 分歧1·§9 行3 [3] | S3.txt L367–386 字段表逐行计数 = 20（name…compatibility）；与规范交集恰 6，扩展 20−6=14 | 计数一致 | 一致 |
| 目录中 description+when_to_use 合计 1536 字符截断 | §9 行3 [3] | S3.txt L372–373 "truncated at 1,536 characters in the skill listing" | 逐字一致（L1130 另证上限可配） | 一致 |

## 三、生态登记（钉点 69ef37e9 快照）

复算命令：`python3` 解析 repo@69ef37e9 `docs/snippets/clients.jsx` 的 `clients` 数组，按字段存在性计数。

| 数字 | 230 口径与出处 | 证据指针 | 复算结果 | 判定 |
| --- | --- | --- | --- | --- |
| 46 家客户端登记 | §9 行4·§11 [1] | clients 数组条目数 | total=46 | 一致 |
| 45 家带说明文档链接 | §9 行4 [1] | 含 `instructionsUrl:` 的条目数 | 45 | 一致 |
| 26 家开源 | §9 行4 [1] | 含 `sourceCodeUrl:` 的条目数 | 26 | 一致 |
| 14 家需 logo 缩放 | §9 行4 [1] | 含 `scale:` 的条目数 | 14（值 0.45–1.33 共 14 个） | 一致 |

## 四、仓史（gh api + git log @69ef37e9）

复算命令：`git -C <clone> rev-list --count main`；`git log --reverse/--format='%ad' --date=short` 按月 `uniq -c`；`gh api repos/agentskills/agentskills`；`gh api "search/issues?q=repo:agentskills/agentskills+type:pr+state:open"`。

| 数字 | 230 口径与出处 | 证据指针 | 复算结果 | 判定 |
| --- | --- | --- | --- | --- |
| 145 提交 | §9 行5·§11 [5] | `git rev-list --count main` | 145 | 一致 |
| 2025-12-16 init | §9 行5·注 [5] | `git log --reverse` 首条 `2075f7e 2025-12-16 init`；GitHub `created_at=2025-12-16T15:47:19Z` 双证 | 一致 | 一致 |
| 2025-12-18 文档与参考实现落地 | §9 行5·注 [5] | `fb08d60 2025-12-18 Add documentation`、`547831f 2025-12-18 Add skills-ref library (#2)` | 一致 | 一致 |
| 2026-03 峰值 42 条 | §9 行5 [5] | 按月计数：2026-03=42（次高 2026-04=32，第三 2026-01=20） | 42 为全史单月最高 | 一致 |
| 冻结自 2026-08-09 | §9 行5 [5] | 末条 `69ef37e 2026-08-09 13:36:04 -0700`；2026-08-10 起零提交；`pushed_at=2026-08-09T20:36:04Z`（10-01 复查仍此值） | 一致 | 一致 |
| 25,811 stars（截至 2026-09-30） | §9 行5 [5] | S5 落盘快照 `stargazers_count=25811`；2026-10-01 实时复查 = 25,826（+15） | 与 9-30 快照逐位一致；活数据，见口播附注 | 一致（活数据） |
| 51 条 open PR（截至 2026-09-30） | §9 行5·§11 [5] | S5 落盘 search API（type:pr state:open）=51；2026-10-01 实时复查 = 51 | 一致；注意口径：`open_issues_count=94` 是 issue+PR 合计，PR 数必须走 search API | 一致（活数据） |
| 冻结 52 天（截至 2026-09-30） | §9 行5·§11 [5] | (31−9)+30 = 52 天 | 算术一致；10-01 已为 53 天，随日递增 | 一致（活数据） |

## 五、原型实验（六份复跑日志逐位对账）

证据：`lab4-selftest.log` + `lab4-break-X1..X5.log`（2026-10-01 17:22 复跑产物）+ 本次幂等重跑（`uv run --no-project python docs/research/agent-infra/assets/agent_skills_lab4.py --selftest`，输出 613/PASSED 与日志逐位同）+ tracked 自证件 `lab4-selftest.json`（454/613 在档）。token 均为 chars/4 整数除近似口径（230 §4 已自标）。

| 数字 | 230 口径与出处 | 证据指针 | 复算结果 | 判定 |
| --- | --- | --- | --- | --- |
| tier1 = 454（6 技能目录块常驻） | §4 走查·§9 行6 | selftest 日志 `[tier1] 目录 6 技能，prompt 块 454 token`；`[ledger] tier1=454` | 一致（重跑同值） | 一致 |
| tier2 = +62（一轮激活 5 份正文） | §4 走查·§9 行6 | selftest 五条 `[run]` 各路由 1 技能；`tier2=62` | 一致 | 一致 |
| tier3 = +97（按需读 1 份参考文件） | §4 走查·§9 行6 | `tier3=97`（approver-list.md 按需读） | 一致 | 一致 |
| 常驻合计 613 | §4 走查·§9 行6 | 454+62+97=613；`常驻合计=613` | 一致 | 一致 |
| X1：目录 6→5，技能静默蒸发、no-match、无告警 | §10 X1 行 | X1 日志 `目录 5 技能`、周报任务 `路由 None；结果 no-match；报错信号 无` | 一致（日志另有常驻 613→542、tier2 62→55，230 §10 未引用，不冲突） | 一致 |
| X2：装载面 −1/6（6→5）、常驻 613→533 | §10 X2 行 | X2 日志 `目录 5 技能`（deploy-helper 被严格门跳过）、`常驻合计=533` | 一致 | 一致 |
| X3：注入 0→1 | §10 X3 行 | X3 日志 `fake-admin 1 处（注入成功！）` | 一致（日志另有 tier1 454→440、常驻 613→599——转义拆除后 `&…;` 变短所致，230 未引用，不冲突） | 一致 |
| X4：tier2 62→240、tier3 97→0 | §4 走查·§10 X4 行 | X4 日志 `tier2=240 tier3=0`；算术 62+97+81=240 自洽 | 一致 | 一致 |
| X4：常驻 613→694（+13%） | §4 走查·§9 行6·§10 X4 行 | X4 日志 `常驻合计=694`；(694−613)/613 = 13.21% → 取整 +13% | 一致（13.21% 取整口径） | 一致 |
| X4 涨幅 81 = 未被读到的 submit.py 体量 | §4 走查 | fixtures：submit.py 全文 326 chars，326//4 = 81 = 694−613 | 算术逐位成立 | 一致 |
| X5：留存 0 份、策略遵守 False→silent-fail、报错信号无 | §10 X5 行 | X5 日志 `未保护；技能正文留存 0 份`、`策略遵守 False；结果 silent-fail；报错信号 无` | 一致 | 一致 |
| X5：tier2→0、常驻 613→454 | §10 X5 行（隐含） | X5 日志 `tier2=0 tier3=0 常驻合计=454`（=tier1 孤值） | 一致 | 一致 |
| 原型 464 行纯标准库 | 230 frontmatter·§10 | `wc -l agent_skills_lab4.py` = 464 | 一致 | 一致 |
| 12 assert 全绿 | 230 frontmatter·§10 | selftest 日志 12 × `PASS` + `SELFTEST PASSED ✔`；tracked json 同构 | 一致 | 一致 |

## 口播可用性

| 类别 | 数字 | 用法约束 |
| --- | --- | --- |
| 钉死口径，可进口播（须带「截至 2026-09-30」或「规范钉点 69ef37e9」限定） | 六字段与各字段上限（1–64 / 1–1024 / 1–500）；三级量级 50–100 / <5000 / <500 行；Codex 2% 与 8000 字符；Claude Code 20 字段（6+14）与 1536 截断；生态 46/45/26/14；仓史 145 提交、12-16 init、12-18 落地、2026-03 峰值 42 | 全部来自钉点快照或规范原文，可钉死引用；生态四数是自报登记口径（230 §12 已声明无第三方复核），口播建议保留「登记」措辞 |
| 确定性实验，可进口播（须带「chars/4 近似口径」或「约」） | 454 / +62 / +97 / 613 / 694（+13%）/ X1–X5 全部退化形态 | 脚本确定性、重跑幂等（本次已二次复跑对齐）；+13% 实为 13.21%，口播说「涨了约一成三」或「+13%」皆可，勿报小数；token 数字一律加「约」 |
| 活数据，只进画面角标（或口播强制带「截至」短语） | stars（25,811@09-30 → 25,826@10-01，仍在涨）；open PR（51，暂稳）；冻结天数（52@09-30 → 53@10-01，随日递增） | 任何一处进成片都须挂「截至 2026-09-30」角标或动态化处理；否则宁可改定性「两万五千多家 star」/「五十来条 PR 排队」/「冻结一个多月」 |
| 复算失败须降级定性 | （无） | 本次 35 项全部复算成功，无降级项 |

补充弹药（日志在档、230 §10 表未引用，可按需取用）：X1 常驻 613→542、X2 tier2 62→51、X3 常驻 613→599（tier1 454→440）、X5 常驻退回 tier1 孤值 454——四组数字与 230 已引用数字同源同日志，口径自洽，引用时注明「同份复跑日志」即可。

失效警示：`.temp/agent-skills-open-standard-lab/`（clone @69ef37e9 与 S0–S5 落盘）属易失临时物；`.temp` 下另有旧夹具状态的 lab4-selftest.json 快照（460/619 口径），与现行夹具不一致、不采信（230 评审修复 d7c651f9f 已改账本口径）。对账以本表「证据指针」列的可重跑命令与仓内 tracked 文件为准。
