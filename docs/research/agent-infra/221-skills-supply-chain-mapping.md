---
sidebar_position: 11
title: "Agent Skills 供应链 ↔ negentropy/E3 叙事锚点"
description: "220 供应链精读的双向落地：映射总表 A（六机制 → 本仓 skills_injector/harness_materializer/definitions 表的 rg -n 实测锚点与 ✅/🔶/⏸ 判定——注入层零校验、DB 有 checksum 列但 version 槽位恒 None，恰是上游「digest 有、semver 无」的仓内镜像）；叙事锚点表 B（E3 七幕大纲逐幕 → 220 章节 + lab3 实验 + 上屏数字与归属，视频 Stage ④ 校验直接输入）；数字时效卡（六个时效敏感数字各自的成片前 48h 复核动作）。"
---

# Agent Skills 供应链 ↔ negentropy/E3 叙事锚点

> 姊妹篇 [220-skills-supply-chain.md](./220-skills-supply-chain.md)（供应链精读本体）；剧场前篇 [210](./210-agent-skills-open-standard.md)/[211](./211-agent-skills-mapping-negentropy.md)（格式层）。本篇所有仓内行号均为 `rg -n` 于本 worktree 实测（2026-09-28），非推测。

## 结论先行

1. **本仓与上游同构地停在「digest 半步」**：definitions 表（0095）同时备好 `version` 与 `checksum` 两列，但 0098 seed 只填 checksum（`sha256(source)` 本地自算）、`version` 恒 `None`（migration 注释亲口承认「harness SKILL.md 无 version 字段」）——**版本被降维成变更检测**这一上游规律（220 §5/§6）在仓内 DB schema 层有精确镜像；且 checksum 的全部消费面（registry.py）只做「物化跳过+前端 dirty 判定」，与 SEP-2640「匹配证明一致、不证明可信」同款边界（同域自算自存）。
2. **无外部下载面是本仓的幸运而非设计**：harness_materializer 零网络代码（DB→盘纯内部物化），传输完整性攻击面暂不存在；但注入层（skills_injector）零校验同上游——一旦未来接入外部 skill 分发（如 .well-known / MCP skills/list），A 表两条 ⏸ 即刻转为真实缺口。
3. **E3 视频七幕与 220 章节已可逐幕对表**（表 B），全部上屏数字带归属句；六个时效敏感数字的成片前 48h 复核动作固化为「数字时效卡」。

## A. 映射总表：机制 → 本仓现状（rg -n 实测锚点）

| # | 220 机制 | 本仓锚点（实测） | 判定 | 说明 |
| --- | --- | --- | --- | --- |
| A1 | 注入层完整性/签名校验（220 §7） | `apps/negentropy/src/negentropy/agents/skills_injector.py:342`（`format_skills_block`）：全文 `rg "digest\|sha256\|hashlib\|signature\|verify_signature\|checksum"` **零命中**；正文经 Jinja2 沙箱渲染、渲染失败 fail-soft 返回原文 | ⏸ | description/模板注入零校验，与上游客户端同构（210 §7 基线）；信任判定完全依赖 DB 内部信任域 |
| A2 | 物化外部资源时的传输校验（220 §3） | `apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py`：校验词与网络下载词（`requests./httpx/urlopen/urlretrieve/download`）**双零命中**；物化路径 DB（kind=harness_skill）→ `.agent/skills/<key>/SKILL.md`，fail-soft | ✅ | 无外部资源下载面=无传输完整性攻击面；这是「没接外部分发」的幸运而非「验了」的设计——接入外部源之日即 A1 同款缺口 |
| A3 | 版本/校验存储位（220 §5） | `apps/negentropy/src/negentropy/db/migrations/versions/0095_create_definitions_registry.py:59-60`：`version String(50) nullable` / `checksum String(64) nullable` 两列齐备 | 🔶 | 槽位在（比上游 SKILL.md 六字段更进一步）；语义用没用看 A4/A5 |
| A4 | semver 槽位闲置（220 §5「编号牌」） | `apps/negentropy/src/negentropy/db/migrations/versions/0098_seed_harness_skill_definitions.py:889`（`checksum = hashlib.sha256(source.encode()).hexdigest()`）、`:896`（`"version": None  # harness SKILL.md 无 version 字段`） | ⏸ | digest 有、semver 无——上游生态结构（220 §5）的仓内镜像；definitions SSOT 架构（见 MEMORY/0095-0099）继承上游同款留白 |
| A5 | checksum 消费面=变更检测（220 §6「降维」） | `apps/negentropy/src/negentropy/agents/definitions/registry.py:42-44`（`compute_checksum` docstring：「物化器据此跳过未变行、前端据此判定 dirty」） | 🔶 | checksum 唯一用途=变更检测，非来源证明；同域自算自存（DB 写 DB 读），与 SEP-2640「Hosts MUST NOT treat a digest match as a security boundary」同款边界 |
| A6 | seed 幂等 vs 活文档静默变脑（220 §5 双门） | `0098_seed_harness_skill_definitions.py:871`（`ON CONFLICT (kind, key) DO NOTHING`，文件头注释「可重入；已存在则跳过」）；升级先例=0094 显式 reseed | ✅ | 首次落库即钉死，重跑 migration 不覆盖——无上游「computed version 双门失效」面；内容升级走新 migration 显式重种（0094 先例），可审计、可回溯 alembic 版本 |

## B. 叙事锚点表：E3 七幕 → 220 章节 + lab3 实验 + 上屏数字与归属

> 七幕大纲 SSOT=[.context/e3-blueprint.md](../../../.context/e3-blueprint.md) 附录 A2；本表是视频 Stage ④（分镜/校验）的直接输入——每幕一行，上屏数字逐条带归属句，与蓝图 A3/A4 的信源卫生条款对齐。

| 幕 | 220 章节 | lab3 | 上屏关键数字与归属 |
| --- | --- | --- | --- |
| 一｜欠条与判词 | §1 + §10 | — | 46 家客户端（showcase 源码清点 @69ef37e9）vs 0 家验签（210 四家实测基线）；247 行规范 8 词干唯一命中 L133 "De-SIGN-ed"（grep 复验 @69ef37e9，2026-09-28）；issue #358 判词「npm 八年/PyPI 压缩/这里六个月」（2026-05，作者自报） |
| 二｜公示栏与铅封 | §3 | E-01 / E-02 | 双仓双帽（RFC PR#8 2026-03-23 合入 @1bd11679 → 次日 #254）；digest=`sha256:{64 小写hex}`；Vercel 双闸 50MB/1000 文件（wellknown.ts）；curl 三连 @2026-09-27：supabase index 活（URL 直钉 Releases v0.1.8）/ cloudflare.com 404 / schemas.agentskills.io DNS 000 |
| 三｜封条的法庭 | §4 | E-01（锁步竞态机制镜头） | pja-ant「同信任域+footgun」（P254:4117431773，Anthropic 员工，2026-03-24）；sigstore 2022 / npm provenance 2023-04-19 GA / PyPI trusted publishing 15 分钟 token；TomeVault **187,976 行 @2026-07 manifest（文件实例含 fork，自报口径）**；contextlock=「原型/新开源实现」措辞（禁「已出货」） |
| 四｜海关还没建 | §7 | E-03 / E-04 / E-06 | Snyk 76/3,984（**厂商自报 @2026-02-05**，36.82%/13.4%/91% 同源）；USENIX 157/98,380、4.03 漏洞均值（arXiv 2602.06547）；MalSkillBench 86.3% 假前置依赖（arXiv 2606.07131）；ClawHavoc 1,184=二手转述降级提及；npm skills 月下载 29,823,552（官方统计 **2026-08-27~09-25 窗口、含 CI/bot**）；Gemini 确认门=代码级（write.toml:63-67 默认 ask_user / :96-108 无 TTY deny） |
| 五｜编号牌失踪 | §5 | E-05 | 双门失效原句（Claude Code 官方文档）；官方仓 19 技能零 version/零 tag/零 release、claude-api ≥9 次静默变更（提交史实测）；supabase v0.1.1–v0.1.8 逐版 release；#380 四件套+作者 24h 自我推翻+回滚盲区（v0.1.7→v0.1.6 无标准入口） |
| 六｜隔壁港航线 | §6 | —（图⑲–㉑ 前端动画） | SEP-2640 SSOT=ext-skills @b0b3272f（勘误：a3e147c 属 modelcontextprotocol 仓，stable/skills.mdx 为准）；81 天（2026-06-24 否决→09-13 Final）；「Hosts MUST NOT treat a digest match as a security boundary」原文上屏；content-bound approval（批准绑 resources 全集，一变即撤）；PR #546 八行/24 天/0 评论；3 家 Partial 中仅 ChatGPT 有厂商文档背书 |
| 七｜冻结吊车 | §2 + §8 + §9 | — | 冻结 49 天（2026-08-09→09-27，gh api 实测）；48 open PR；46 家 showcase 数字被冻住（队列躺 2 个待合并客户端）；allowed-tools 三线（Poll #515 仅 2 票全投最宽松——**勿写「压倒性共识」**）；三个跟踪信号（#254 合并 / #380 解冻 / 首发验签或首个 provenance registry） |

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

- 精读本体：[220-skills-supply-chain.md](./220-skills-supply-chain.md)（§3–§8 六机制、§9 五规律三争议、§10 数字表、§11 实验室）
- 格式层前篇：[210](./210-agent-skills-open-standard.md) / [211](./211-agent-skills-mapping-negentropy.md)（含 ISSUE-194 expand_skill 激活层悬空——A1 注入层判定的事实底座之一）
- 视频制片 SSOT：[.context/e3-blueprint.md](../../../.context/e3-blueprint.md)（七幕大纲 A2、信源卫生 A3/A4、备播与 48h 复核规则）
- 本仓 DB 载体机制：definitions 表 SSOT 架构见 migrations 0095–0099（A3–A6 锚点源文件）
