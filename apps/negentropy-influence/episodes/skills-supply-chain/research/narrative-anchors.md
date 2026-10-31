# E3 叙事锚点与数字时效卡

> 本文是《Agent Skills 供应链》（E3）视频制片的取证资产：把 [220 供应链精读](../../../../../docs/research/agent-infra/220-skills-supply-chain.md) 的章节对到七幕大纲，并固化上屏数字的复核动作。本仓机制映射（A1–A6）在汇总文档 [mapping-negentropy.md](../../../../../docs/research/mapping-negentropy.md) 的 Skills 域，编号前缀 `SK-A`。表中引用的蓝图 `.context/e3-blueprint.md` 为本地制片文件，不入库。

## B. 叙事锚点表：E3 七幕 → 220 章节 + lab3 实验 + 上屏数字与归属

> 七幕大纲 SSOT 为蓝图 `.context/e3-blueprint.md` 附录 A2；本表是视频 Stage ④（分镜/校验）的直接输入：每幕一行，上屏数字逐条带归属句，与蓝图 A3/A4 的信源卫生条款对齐。

| 幕 | 220 章节 | lab3 | 上屏关键数字与归属 |
| --- | --- | --- | --- |
| 一｜欠条与判词 | §1 + §10 | — | 46 家客户端（showcase 源码清点 @69ef37e9）vs 0 家验签（230 四家实测基线）；247 行规范 8 词干唯一命中 L133 "De-SIGN-ed"（grep 复验 @69ef37e9，2026-09-28）；issue #358 判词「npm 八年/PyPI 压缩/这里六个月」（2026-05，作者自报） |
| 二｜公示栏与铅封 | §3 | E-01 / E-02 | 双仓双帽（RFC PR#8 2026-03-23 合入 @1bd11679 → 次日 #254）；digest=`sha256:{64 小写hex}`；Vercel 双闸 50MB/1000 文件（wellknown.ts）；curl 三连 @2026-09-27：supabase index 活（URL 直钉 Releases v0.1.8）/ cloudflare.com 404 / schemas.agentskills.io DNS 000 |
| 三｜封条的法庭 | §4 | E-01（锁步竞态机制镜头） | pja-ant「同信任域+footgun」（P254:4117431773，Anthropic 员工，2026-03-24）；sigstore 2022 / npm provenance 2023-04-19 GA / PyPI trusted publishing 15 分钟 token；TomeVault **187,976 行 @2026-07 manifest（文件实例含 fork，自报口径）**；contextlock=「原型/新开源实现」措辞（禁「已出货」） |
| 四｜海关还没建 | §7 | E-03 / E-04 / E-06 | Snyk 76/3,984（**厂商自报 @2026-02-05**，36.82%/13.4%/91% 同源）；USENIX 157/98,380、4.03 漏洞均值（arXiv 2602.06547）；MalSkillBench 86.3% 假前置依赖（arXiv 2606.07131）；ClawHavoc 1,184=二手转述降级提及；npm skills 月下载 29,823,552（官方统计 **2026-08-27~09-25 窗口、含 CI/bot**）；Gemini 确认门=代码级（write.toml:63-67 默认 ask_user / :96-108 无 TTY deny） |
| 五｜编号牌失踪 | §5 | E-05 | 双门失效原句（Claude Code 官方文档）；官方仓 19 技能零 version/零 tag/零 release、claude-api ≥9 次静默变更（提交史实测）；supabase v0.1.1–v0.1.8 逐版 release；#380 四件套+作者 24h 自我推翻+回滚盲区（v0.1.7→v0.1.6 无标准入口） |
| 六｜隔壁港航线 | §6 | —（图⑲–㉑ 前端动画） | SEP-2640 SSOT=ext-skills @b0b3272f（勘误：a3e147c 属 modelcontextprotocol 仓，stable/skills.mdx 为准）；81 天（2026-06-24 否决→09-13 Final）；「Hosts MUST NOT treat a digest match as a security boundary」原文上屏；content-bound approval（批准绑 resources 全集，一变即撤）；PR #546 八行/24 天/0 评论；3 家 Partial 中仅 ChatGPT 有厂商文档背书 |
| 七｜冻结吊车 | §2 + §8 + §9 | — | 冻结 49 天（2026-08-09→09-27，gh api 实测）；48 open PR；46 家 showcase 数字被冻住（队列躺 2 个待合并客户端）；allowed-tools 三线（Poll #515 仅 2 票全投最宽松，**勿写「压倒性共识」**）；三个跟踪信号（#254 合并 / #380 解冻 / 首发验签或首个 provenance registry） |

## C. 数字时效卡（成片前 48h 复核清单）

| 数字 | 现口径（钉点） | 成片前 48h 须复核什么 |
| --- | --- | --- |
| Snyk ToxicSkills | 76 恶意/3,984 扫描，截至 2026-02-05（厂商自报） | 访问 snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub 确认样本数/日期未更新；若更新，同步替换 36.82%/13.4%/91% 全组数字与「@2026-02-05」角标 |
| USENIX'26 / MalSkillBench | 157/98,380/4.03（arXiv 2602.06547）；86.3%（arXiv 2606.07131） | 查两 arXiv 页有无 v2 修订改数字（摘要页 version 历史）；Camassa 一致性：正文引用保持「论文口径」措辞 |
| npm skills 月下载 | 29,823,552（窗口 2026-08-27~09-25，api.npmjs.org 官方，含 CI/bot） | 重打 `api.npmjs.org/downloads/point/last-month/skills` 取新窗口；「含 CI/bot/npx 口径」声明必须随数字保留 |
| TomeVault 见证规模 | 187,976 行（instruction-corpus manifest @2026-07，**文件实例含 fork**） | 重取最新 manifest 的 row_count 与 Skills 类计数；「含 fork、自报口径」角标句随行 |
| grep 8 词干 | 247 行唯一命中 L133 "Designed"（@69ef37e9，2026-09-28 复验） | 核主仓 HEAD 是否仍 69ef37e9；若解冻，重跑 `(secur\|trust\|sign\|integrit\|malicious\|verif\|safety\|risk)` 大小写敏感 grep 并按实测词表重新定格（蓝图 A4-8 纪律） |
| 主仓冻结天数 | 49 天（2026-08-09 → 2026-09-27） | `gh api repos/agentskills/agentskills/commits?per_page=1` 核 sha+pushed_at，按成片日重算天数；48h 清单扩为六线：#254/#380/#546/#573/#520/#515 + HEAD（蓝图 A4-6），任一解冻即启用备播文案 |

## 交叉引用

- 精读本体：[220-skills-supply-chain.md](../../../../../docs/research/agent-infra/220-skills-supply-chain.md)（§3–§8 六机制、§9 五规律三争议、§10 数字表、§11 实验室）
- 本仓机制映射：[mapping-negentropy.md](../../../../../docs/research/mapping-negentropy.md) Skills 域 `SK-A1`–`SK-A6`
- 格式层前篇：[230](../../../../../docs/research/agent-infra/230-agent-skills-standard.md)
- 视频制片 SSOT：蓝图 `.context/e3-blueprint.md`（七幕大纲 A2、信源卫生 A3/A4、备播与 48h 复核规则）
