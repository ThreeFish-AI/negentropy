---
sidebar_position: 10
title: "Agent Skills 供应链战场精读笔记"
description: "以 agentskills 规范仓 @69ef37e9 + PR #254/#380 楼层证据 + MCP SEP-2640 最终文本 @b0b3272f + Snyk/USENIX 战报为信源的供应链精读：知识的港口·海关篇——舱单与铅封、三层信任栈=sigstore 重演、编号牌与保税仓、隔壁港航线、四闸门实况、npm/PyPI 先例对账；五规律×三争议；agent_skills_lab3.py 六破坏实验（锁步竞态/soft-404/隐形墨水/预批准/版本双门/一字母之差）"
---

# Agent Skills 供应链战场精读笔记

> [agentskills, "Agent Skills Specification," agentskills.io, 2026](https://agentskills.io/specification) · 规范仓 [agentskills/agentskills](https://github.com/agentskills/agentskills) 钉点 `69ef37e9`（2026-08-09，此后至 2026-09-27 零提交，冻结第 49 天）· 分发提案 [PR #254](https://github.com/agentskills/agentskills/pull/254)（open·dirty，2026-03-16 开）· 版本化提案 [PR #380](https://github.com/agentskills/agentskills/pull/380)（open，2026-05-13 开）· MCP 侧规范 SSOT [modelcontextprotocol/ext-skills](https://github.com/modelcontextprotocol/ext-skills) 钉点 `b0b3272f`（2026-09-24；SEP-2640 于 2026-09-13 投票合并 Final）· Cloudflare RFC 第三钉 [cloudflare/agent-skills-discovery-rfc](https://github.com/cloudflare/agent-skills-discovery-rfc) @`1bd11679`（2026-03-24，文本冻结）· 客户端源码 [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) @v0.61.x。系列上一篇 [210](./210-agent-skills-open-standard.md)（同一港口剧场讲格式；本篇讲**分发、签名、版本**三件被规范刻意留白的港口基础设施）。

**一句话定位**：Agent Skills 的格式标准化跑赢了信任标准化——46 家客户端互认箱体（官网 showcase 源码清点 @69ef37e9），其中被逐家实测的四家头部（Gemini/Claude Code/OpenAI/VS Code，210 §7）**无一验签**——注意「46 家清点」与「四家实测」是两个口径，后者不外推前者；分发、签名、版本三件「海关设施」全被规范留白，社区在 PR 评论区、隔壁 MCP 港区和野生市场里，用六个月手工重演了包管理器界三十年长出的机制（舱单 digest、签名 sidecar、透明见证、semver、lockfile）。

**总类比：知识的港口·海关篇**（剧场延续 210；基础角色沿用，本篇登记海关侧新角色——完整单射映射以此表为唯一事实源）：

> [!TIP]
> | 技术实体 | 港口角色 | 同构依据 |
> | --- | --- | --- |
> | .well-known index.json | 公示栏上的总舱单 | 一次 GET 拿走整张清单 |
> | digest（SHA-256） | 铅封 | 证明「货没被换」，不证明「谁装的」 |
> | 域名+TLS（传输完整性） | 地契与港区围墙 | 只管「运到港这段没换货」 |
> | DSSE 签名 sidecar | 随箱同行的发货人签章 | 离开港口也跟着货走 |
> | 第三方持续见证（Rekor 形态） | 灯塔见证人 | 独立记录每次进港所见 |
> | 锁步竞态 | 阴阳舱单 | 14:00 的舱单配 14:02 的货，无单点报错 |
> | soft-404 / digest 同步 footgun | 报关单笔误 | 盖了章的「查无此货」被当真 |
> | MCP skills/list + content-bound approval | 隔壁港的定期航线 | 逐文件舱单+「内容一变批准即撤」 |
> | semver version 字段 | 编号牌 | 只是标签，不锁字节 |
> | lockfile | 提单存根 | 把「意图」冻结成「事实」 |
> | 不可变 registry 历史 | 保税仓 | npm 能回退因为保税仓在；技能港没有 |
> | computed version | 码头工人自己抄的编号 | 写死不动/不写跟着船走 |
> | typosquat | 走私船挂正规船名 | 名字本身就是攻击面 |
> | U+E0000 隐形字符 | 隐形墨水 | 屏显正常，hexdump 显形 |

**怎么读**：§1–2 问题与全貌；§3–8 六个机制节一律「类比 → 机制 → 原型实景」（实景引自 [agent_skills_lab3.py](./assets/agent_skills_lab3.py) 实际运行日志，客户端/攻击者均为确定性 mock，验证**机制自洽**而非模型能力）；§9 规律与争议。引用记号：`P254:`=PR #254 评论区（评论号+日期可逐条 gh api 复核）、`RFC@1bd11679`=Cloudflare RFC、`SEP@b0b3272f`=ext-skills stable/skills.mdx（SEP-2640 最终文本）、`GEM:文件:行`=gemini-cli 源码、无记号处为官方文档或仓库原文（归属在括号内）。

## 1. 它要解决什么问题

210 讲清了箱体：一个文件夹 + 一个 SKILL.md，46 家港口互认。但**集装箱进了港，海关还没建**：

- 规范 247 行里，8 个安全词干（secur/trust/sign/integrit/malicious/verif/safety/risk，大小写敏感）**唯一一处命中是 L133 的单词 "Designed"**（`sign` 藏在 De-**sign**-ed 里；specification.mdx grep 复验 @69ef37e9，2026-09-27）——签名条款藏在一个单词的肚子里。
- 三个签名/信任 RFC（#247 签名块 / #358 provenance / #418 供应链指引）全部关闭，维护者 jonathanhefner 定调：「deciding whether a skill is safe is outside the scope of the spec… attestation is better solved at the distribution layer」（issue #418，2026-06-30）——而那个「分发层」的唯一提案 #254 停摆至今。
- 真空已被兑现为伤亡：Snyk ToxicSkills 扫 ClawHub+skills.sh 共 **3,984 个 skills（截至 2026-02-05，厂商自报）→ 76 个确认恶意、13.4% 含 CRITICAL、36.82% 有任意级别安全问题**；恶意样本 100% 含恶意代码、91% 叠加 prompt injection。

问题的形状：**格式只要极简就能被采纳，信任设施要强制力=主权让渡**（§9 规律 4），于是三场战争（签名/分发/版本）在规范之外的地方各自开打。

## 2. 全貌解剖：三战线并行 + 现实层市场先行

| 层级 | 部分 | 回答的问题 | 性质 |
| --- | --- | --- | --- |
| T1 提案层 | #254 舱单设计 / #380 四件套 / SEP-2640 最终文本 | 社区想建什么 | 精读 |
| T1' 现实层 | 四客户端闸门、npx skills 2982 万月下载、supabase/tomevault 营业、Snyk/USENIX 战报 | 实际发生了什么 | 精读 |
| T2 先例层 | sigstore / npm provenance / PyPI trusted publishing / event-stream | 这场战争以前怎么打的 | 映射 |
| T3 领域坐标 | 格式标准 vs 信任标准的时间差定律 | 为什么总是这样 | 地图 |

三条战线共用一个冻结的前线（规范仓 @69ef37e9，2026-08-09 后零提交、48 条 open PR 积压）：**#254 签名栈**（停摆约六个半月：2026-03-16 开出至 2026-09-27 仍 open，194 天；但评论区三个月长出三层信任栈，§4）；**#380 版本**（显式排队在 #254 之后，§5）；**SEP-2640 分发半场**（隔壁 MCP 港区 81 天从否决打到 Final，但只标准化了「随 server 分发」这半边，§6）。现实层不等任何人：Vercel CLI 已实现完整校验、supabase/tomevault 已营业、投毒已发生（§7）——de facto 标准跑在 de jure 前面。

因果脉络链：观察（46:0 信任真空与 76/3984 恶意并存）→ 归因（采纳成本不对称）→ 机制（舱单 digest / 三层信任栈 / 双门版本 / content-bound approval / 四闸门）→ 证据（grep 8 词干唯一命中；curl 三连实测；lab3 六实验退化数据；包管理器史逐条映射）。

## 3. 机制一：公示栏与铅封——#254 舱单解剖

**类比**：起重机把 index.json 贴上港口公示栏（`/.well-known/agent-skills/`），Agent 划船人一次 GET 拿走整张舱单——对照旧姿势「挨个翻仓库」；每箱贴 sha256 铅封，装货侧与验货侧各盖半枚章，合上一致才放行。

**机制**：提案出身是**双仓双帽**——jonathanhefner 一边给 Cloudflare RFC 提修订 PR #8（2026-03-23 合入：改名 `agent-skills/`、`$schema` 替代 `version`、废 files+package 改扁平单工件模型），次日把文本推成 agentskills PR #254；而他自己就是主仓最活跃 merger（近 100 提交占 47 次）。舱单设计：顶层仅 `$schema`+`skills[]`；每条目 5 必填（name/description/type/url/digest）；两种箱型——`skill-md`（信封，单文件直指 SKILL.md）与 `archive`（tar.gz/zip 整箱，SKILL.md 必须在根、禁止套娃外层目录；zip 有 HTTP Range 部分取件小门）；URL 按 RFC 3986 以 index 为基准解析 → 工件可放 CDN 任意工位。**digest=SHA-256 对工件原始字节**（`sha256:{64 位小写hex}`），失配不得使用、兼作缓存键。archive 安全三条款（解压前 MUST）：拒绝路径穿越/绝对路径、拒绝越界软硬链、设解压总大小上限。`$schema` 是不透明标识符——规范明文「不保证可解析」，实测 `schemas.agentskills.io` DNS 返回 000（2026-09-27），字面兑现。

三处真实裂缝：①**absent-$schema 三读取器分叉**（同一份 index 缺 `$schema` 字段时，三种实现给出三个答案）：Cloudflare RFC 文本判「回退 v0.1.0 兼容处理」（隐含前提：v0.1.0 旧 schema 的 files 数组**没有 digest 字段**，于是新客户端「必须校验 digest」在这条回退路径上逻辑不可满足）/ #254 文本判「警告并拒收」/ Vercel CLI 代码两头都实现（`wellknown.ts` 双接口 V1/V2 兼容）；②**Leiruz 四连击**（独立合规实现+fixture、刻意不读现有客户端，P254:5462874723，2026-08-29）：soft-404 的 `{"error":"not found"}` 按字面规则合法、type 既是封闭集又是扩展点自相矛盾、「Max 1024 characters」未定义单位（JS `.length` 与 Go `len()` 对 emoji 差 2 倍）；③**生态实况讽刺**（2026-09-27 curl 实测）：supabase.com 的 index 活着（2 个 skill，URL 直钉 GitHub Releases v0.1.8）→ RFC 诞生地 cloudflare.com 同路径 **404** → schemas.agentskills.io **DNS 000**——标准地基没浇筑，租客已营业。

**原型实景（E-01 锁步竞态 + E-02 footgun/soft-404）**：jonathanhefner 三段辩护（P254:4118732417，2026-03-24）里最好懂的一个 bug：客户端 14:00 拿到 index → 下载 skill A v1 → 服务端 14:01 发布整包新版 → 14:02 下载 skill B v2——此刻手里是一套「阴阳版本」，没有任何单点报错；digest 是唯一能发现「舱单和货物对不上」的机制。反向的 footgun（P254:4117431773，pja-ant/Peter Alexander，Anthropic 员工）：只换工件忘换 index，严格客户端整站不可用。

```text
实际运行日志（uv run --no-project python agent_skills_lab3.py --break E-01 / E-02）：
[E-01] {"off": {"installed": ["skill-a", "skill-b"], "errors": []},        ← 关 digest：阴阳版本零报错
        "on":  {"installed": ["skill-a"], "errors": 1}}                     ← 开 digest：失配整批打回
[E-02] {"stale_index_strict_client": {"errors": 1, "note": "全挂：严格客户端整站不可用"},
        "soft404": {"accepted_as_index": "raise",
                    "note": "200+error 体的形态分叉由实现自决（三读取器分叉）"}}
```

教训：digest 的价值是「运输途中换货零成本→必须双点锁步且躲过所有比对者」；它的成本是「静态发布被升级为哈希同步流水线」。安全特性本身也有 footgun。

## 4. 机制二：封条的法庭——三层信任栈 = sigstore 重演

**类比**：铅封（digest）只保证箱内没被动过，从不管发货人是谁——于是港区自组织出三样东西：地契与围墙（域名+TLS，管运到港这段）、随箱同行的发货人签章（DSSE sidecar，离开港口也跟着货走）、灯塔见证人（第三方持续记录每次进港所见，人人可查的台账）。

**机制**：第一枪来自看门人家里——Anthropic 员工 pja-ant 质疑「能篡改 skill 的人大概率也能篡改 index（同信任域）」（P254:4117431773）；争论三个月后，评论区**没人要求改 spec，而是分层收敛出三层信任栈**：①传输完整性=digest（锚域名+TLS）；②发布者来源=包内 DSSE 签名 sidecar（锚发布者密钥）；③独立验证=第三方重取 index、逐次 digest 比对、对所见签名（锚第三方信誉）。三层独立验证、互不削弱。

**两实现的逐仓核对（本轮 gap 调研，修正归属）**：②号的 contextlock 真身是 **mindmodelai/contextlock**（评论区作者 mm-aiva 自贴链接；Apache-2.0 TS monorepo）：DSSE v1.0.2 envelope/PAE/Ed25519、单 sidecar 记 per-file sha256+length+单调 version+expiry、sigstore keyless 引擎+trusted_root、213 个测试——实现一级真实，但建仓 2026-07-15、npm 月下载 12 次，**定位是「原型/新开源实现」，禁用「已生产出货」措辞**。③号的独立见证是 **olijboyd 的 TomeVault**（tomevault-io，16 仓活跃）：六平台分注册表日更、skills-registry 2.18 万目录；instruction-corpus 2026-07 manifest 实测 row_count 229,375，其中 Skills 类 **187,976——作者自 declare「一行=一个文件实例，fork 各算一行」**，故「180k+ skills」须带角标「约 18.8 万个 skill 文件实例（含 fork）」；2026-09-01 起发布 Ed25519 签名+OpenTimestamps 锚定的日度 manifest（snapsynapse 独立复算佐证）。第四参与者 snapsynapse/skill-provenance（MANIFEST.yaml+逐资源 sha256+verify.sh）**不是第三层见证**，是随包完整性半场；其 README 主动撤回了无法复现的 14.2% 旧数字（证据治理纪律好）。

**sigstore 对账（2022 年的答案被手工重造）**：三层栈与 sigstore 架构逐层重叠——Fulcio 凭 OIDC 身份（邮箱/CI workflow）签发短命证书（↔DSSE sidecar 的「签章锚身份」）、Rekor 不可变追加式透明日志供公众审计（↔灯塔见证人）、keyless 一次性密钥用完即弃。npm provenance（2023-04-19 GA）给包发「CI 出身证明」；PyPI trusted publishing 用 OIDC 换 15 分钟短命 token 消灭长命凭证，PEP 740 把文件摘要绑到 in-toto 证明上。

**MUST 之印的无力**（petemounce，P254:4692737191）：「you can't make a server honour a MUST」「trust is easy to assert, (much) harder to verify」——规范写不可变没有意义，服务器可以悄悄改；这正是 npm/cargo 最终长出中心化 registry（拒绝重发布）的引力。边界一针（snapsynapse，P254:4995195544）：**skill 一旦被贴进聊天窗口，.well-known 整条信任链就消失了，只剩随包旅行的来源信息**——签名保护不了离开港口的货。

## 5. 机制三：编号牌与保税仓——版本双门失效

**类比**：编号牌（semver）只是标签不锁字节；提单存根（lockfile）才把意图冻结成事实；npm 能回退是因为保税仓（registry）永久保存全部历史——技能港以 git 默认分支为货源，上游一改旧版本入口直接消失，**保税仓没了，存根就是孤本**。

**机制**：规范层是**决策不是疏漏**——SKILL.md 六字段无版本，`metadata: version` 纯惯例且规范明文不定义语义；klazuka：「保持格式极轻、防 context bloat」（issue #46，2026-01-12）；jonathanhefner：「版本化属于分发机制而非 SKILL.md」（同 issue，2026-01-26）——把问题推给了一个尚不存在的层。客户端层是**双门失效**（Claude Code 官方文档原文；computed version=插件清单里用户可见的生效版本号，写死时取 entry 的 version 字段、省略时取 HEAD commit 哈希）：`version` 写死 `"1.0.0"` 再推 commit 不 bump → computed version 不变，**修复永远发不出去**；省略 version → 直接跟随 HEAD，**上游一推全员变脑**。且一个 marketplace 同一时刻只 serve 一版、无按语义版本安装、无回滚命令——把用户钉在某版本是维护者特权。活标本：anthropics/skills 官方仓 19 个技能**零 version 字段、零 git tag、零 release**，claude-api 技能三个月内 ≥9 次内容静默变更（提交史实测）直推 main；对照面 supabase/agent-skills 用 Release Please 逐版发布 v0.1.1–v0.1.8、每版 release 自带 index.json+tar.gz——**同一标准、两个物种**。竞态最小场景（issue #46 开篇，mstsirkin，2025-12-24）：同一会话 agent 读的是 v1 的 SKILL.md（说用 `parse_pdf`）、转身执行的 scripts/ 已是 v2（改名 `extract_pdf`）——版本混跑的最小复现。排队中的答案 PR #380 四件套：可选 semver version / versions.json+不可变快照 / 客户端 lockfile（version+digest+resolvedIndex）/ 发布者不可变期望（正文自认「no server-side enforcement mechanism… trust-based convention」）；作者 Rodriguespn 24 小时内自我推翻（「多数 skill 纯指令、活文档」）、六月带**回滚盲区**杀回：装了 v0.1.7 想回 v0.1.6，那个版本的 URL+digest 快照没有任何标准办法找到。petemounce 终结乐观（P254:4451634076）：「skills are instructions — in the same way that all released software packages are instructions. These are just prose vs code.」正交论断（olijboyd，issue #46）：semver 只说明标签变了、不说明字节变了；digest 只保证字节没变、不保证行为没变——版本、完整性、行为有效性是三个必须分开的概念。（Nikolife2016 自报「1,193 次变更/660 技能/14.2% 版本号未动」，无公开数据集且被疑 AI 生成，仅作「有此自报」引用。）

**原型实景（E-05 版本双门失效，mock computed version 比较逻辑；日志中 aaa/bbb/ccc 为三个示意 commit 短哈希）**：

```text
实际运行日志（--break E-05）：
{"pinned":   {"user_sees": ["1.0.0", "1.0.0", "1.0.0"], "bugfix_delivered": false},   ← 写死：连推 3 个修复 commit，用户端永远 1.0.0
 "floating": {"user_sees": ["aaa", "bbb", "ccc"], "all_users_jumped": true}}          ← 省略：一次 update 全员跟随 HEAD
```

教训：同一机制，两个方向的静默失效——修复卡死与全员变脑互为镜像；没有保税仓（不可变历史），lockfile 从便利升级为唯一锚点，删掉即失忆。

## 6. 机制四：隔壁港航线——SEP-2640 的半场战争

**类比**：左港（agentskills）吊车静止，右港（MCP/ext-skills）周更灯火通明——隔壁港区 81 天修好了一条「定期航线」，但只通到半途。

**机制**：战史（全部一级证据）：2026-06-24 被 Core Maintainers 四条结构性反对推迟（archive 解压攻击面 / skill://index.json 规范外私有格式 / 混淆「提供」与「通用分发」/ 脚本执行风险）→ 06-30 工作组「砍小先落地」→ 7 月八项重写（逐文件 manifest、skills/list+skills/get、name 冲突按来源港命名空间）→ **2026-09-13 投票合并 Final，从否决到 Final 只用 81 天**（对照同期 agentskills 仓零提交）。设计核心：不新建原语、复用 MCP Resources——skill 目录逐文件暴露为 resource，新增 skills/list（返回逐字 frontmatter+全量文件清单 `{uri, digest, size}`）与 skills/get 两个必实现方法、resources/directory/read 可选；硬限 512 文件/16 MiB；identity=(server 身份, uri)，最终路径段 MUST=name，跨源 per-origin 命名空间防冒名。

**安全条款要点（SEP@b0b3272f 最终文本，MUST 逐条有原文）**：技能内容 MUST 视为 untrusted model input（风险高于 remote tool）；origin 标注 MUST 进 context 且 MUST NOT 伪装本地；读文件 MUST 验 digest+size、不符 MUST NOT 使用；acting window 内只读已批准 entry 列出的文件；frontmatter 逐字段比对不符即拒载；**allowed-tools 对 MCP 来源技能 MUST 忽略**除非用户显式批准；嵌套技能需全新同意；缓存 MUST host 专属隔离；**「Hosts MUST NOT treat a digest match as a security boundary」**（digest 未签名且与内容同一服务器提供，网关可两者同改——匹配证明一致、不证明可信）；**持久批准 MUST 绑定批准时刻的 resources 全集（每 uri+digest），任何增删/轮换即撤销重批**——content-bound approval 把 rug-pull 从静默变成**可检测事件**；dynamic 技能（无完整性清单）MUST NOT 被持久批准覆盖。

**半场战争**：分发——「随 server 走 MCP 通道」这半边标准化了，通用分发（registry/独立打包/well-known URL 发现）被 charter 与决策日志双双划出范围（Final 附录正式 deferred 仅 Archive Distribution 一项，附 CM 两条反对原文；batch read/well-known 分发/动态工具加载见 decisions.md「Deferred, not rejected」）；签名——缺席（上文 MUST NOT 条款即自认）；版本——被降维成「变更检测」（metadata.version 透传无 semver 语义；SEP-2549 ttlMs/cacheScope 规范明言「非完整性属性」）。落地现状：OpenAI 在 Draft 期（2026-08-04）就让 ChatGPT 插件流以「提交时静态快照」消费（Scan Tools 导入、改动需重扫重审，厂商文档；限额 5 skills/100 文件/5 MiB）；官方 client-matrix（社区维护口径）仅 3 家 Partial——ChatGPT（唯一厂商文档背书）/fast-agent（社区自报）/MCP Inspector 2.6.0；Claude Code 宿主实现「Anthropic 内部原型，未公开」（SEP 原文）。**八行字的报关单**：整条 MCP 战线唯一需要 agentskills 配合的是 PR #546（8 行文字把 `io.modelcontextprotocol/` 前缀保留写进 metadata 规范）——MCP 侧已在最终文本自宣保留（Reservations 节 SHOULD ignore），agentskills 侧开了 24 天、0 评论；两个规范的人事桥梁只有一座：Jonathan Hefner（MCP Maintainer 兼 Agent Skills Maintainer）。

## 7. 机制五：海关实况——四闸门、投毒战报与三件武器

**类比**：港口章程写得再好，海上有没有人查船是另一回事——真实防线在各港口的闸门实现里。

**机制（四闸门，官方文档原文+代码级核验）**：**Gemini CLI 是唯一双重确认门且为代码级强制**——安装时确认来源+每次激活询问；证据链：`activate-skill.ts:72-109` 确认 UI → `tools.ts:191-227` 走 policy engine → **`write.toml:63-67`（随包分发的内建默认）`activate_skill→ask_user`（priority 10）** → `write.toml:96-108` 无 TTY 直接 deny（**fail-closed**）→ `--yolo`=`yolo.toml:50-56` 通配 allow（priority 998）——实测过的代码级机制，而非文档承诺（GEM:write.toml 等，@v0.61.x；lirantal 2026-04 实测 v0.40.1 时同款规则已在）。**Claude Code**：官方明写「Workspace trust doesn't gate this field」——allowed-tools 进未信任文件夹的 `-p` 运行照样生效，并警告「a skill can grant itself broad tool access」。**VS Code**：零门控，只有一句「Always review shared skills」。**OpenAI**：仅容器沙箱（container_auto 默认禁出站网络）+网络指引「treat tool output as untrusted」。

**投毒战报（逐条带归属）**：Snyk ToxicSkills 76/3,984@2026-02-05（厂商自报，见 §1）；Antiy CERT 披露 ClawHavoc 一次投毒 1,184 个技能（**二手转述**——Trellix 原文 403 未直读，降级为带归属次要提及）；USENIX Security'26 论文扫 98,380 个技能确认 157 个恶意（负责任披露后 100% 下架）、632 个独立漏洞、**平均每恶意技能 4.03 个漏洞**（蓄意而非手误的实锤）、过半追溯至单一行为者的模板化品牌冒充（arXiv 2602.06547）；MalSkillBench 703 个野生样本中 86.3% 为假前置依赖冒充（arXiv 2606.07131）——npm 时代的 typosquatting 换了马甲。

市场体量与三层市场：skills npm 包月下载 29,823,552（npm registry 官方统计，2026-08-27~09-25 窗口，**含 CI/bot/npx 口径**）；GitHub topic claude-skills 9,142 仓；anthropics/skills 官方仓 178,560 stars。三层市场（无政府集市/平台商店/企业私域）**没有一处有密码学签名**；唯一接近完整性控制的是 Claude Code archive 源 sha256 pin 与 OpenAI 提交门户自动扫描；事后补救层是第三方扫描器（Snyk/Socket/Gen 评级，非上架门禁）。

**三件武器**（对应三实验）：①**隐形墨水**——Liran Tal 用 U+E0000–U+E007F 区 tag 字符（无可见字形）在 SKILL.md 藏 171 个隐形字符指令，Gemini `--yolo` 下自动激活并弹出 Calculator；Google VRP 三分钟判 Won't Fix（理由「文件夹已信任」）——坐实 folder trust 管「是否加载」不管「内容是否诚实」。②**预批准直通**——Reversec Labs 链：frontmatter 写 `allowed-tools: Bash(*)` + 模型根本看不见的动态上下文注入语法 `!`cmd`` ＝ 无提示、无 LLM 审查直接执行；同一命令明文请求会被当场拒绝并识别为 prompt injection（四级第三方，作者自我定位「非漏洞披露」）。③**一字母之差**——Snyk 报告的 `polymarket-traiding-bot`（traiding vs trading）：无签名分发层里，名字本身就是攻击面。

```text
实际运行日志（--break E-03 / E-04 / E-06）：
[E-03] {"total_chars": 46, "invisible_tag_chars": 26, "screen_and_diff_identical": true, "hexdump_visible": true}
        ← 26 个 tag 字符已够示意；屏显与 diff 完全正常，仅 hexdump 显形（Liran Tal 实测 171 个即藏完整英文指令）
[E-04] {"a": {"channel": "pre-approved", "model_sees_command": false, "permission_prompt": false, "executed": true},
        "b": {"channel": "explicit", "model_sees_command": true, "permission_prompt": true,
              "executed": false, "flagged_as": "prompt injection"}}
        ← 同一命令：预授权通道无提示无审查直执；明文通道被拒并识别（Reversec 链 mock）
[E-06] {"both_installed": true, "warnings": 0, "digest_valid_for_both": true}
        ← 错拼双装零告警：digest 对两个「都合法」的工件各自校验通过
```

教训：防御的悖论——越可信的通道越危险（预批准通道绕过模型审查）；肉眼审查被隐形编码击溃；digest 校验拦得住运输换货、拦不住名字冒充。三者共同指向：**签名缺席时，攻击面从字节层迁移到名字层与编码层**。

## 8. 机制六：先例对账——包管理器战争史的重演与分叉

**类比**：这场战争的每一步都打过——问题只是这次由谁、以什么顺序再打一遍。

**逐条映射**：

| 先例 | 年份 | 战役 | Skills 生态对应物 |
| --- | --- | --- | --- |
| event-stream | 2018 | burnout 维护者移交 → 恶意依赖定向窃取 Copay 钱包 | ClawHavoc 1,184 投毒（二手）/USENIX 157 恶意；issue #358 判词：「npm ran eight years before event-stream. PyPI compressed that timeline. Agent Skills has been live for six months with no integrity layer」（2026-05，作者自报） |
| left-pad | 2016 | 单包消失瘫痪全网 → npm 改 unpublish 政策 | 未发生（git 分发无删除权）；对应风险=上游改历史（§5 保税仓缺失） |
| sigstore | 2022 | 「谁签字」→「你是谁」：Fulcio OIDC 短命证书 + Rekor 透明日志 + keyless | #254 评论区手工重造三层栈（§4），架构逐层重叠 |
| npm provenance | 2023-04-19 GA | CI 出身证明（OIDC→证书→账本→attestation） | contextlock（原型级：DSSE+sigstore keyless 引擎，npm 月下载 12） |
| PyPI trusted publishing | 2023+ | OIDC 换 15 分钟短命 token，消灭长命凭证；PEP 740 绑 in-toto 证明 | 无对应物（无 registry 可托管信任） |
| cargo audit | — | RustSec 黑名单兜底扫描（与签名系互补第二层） | 第三方扫描器（Snyk/Socket/Gen 评级，事后非门禁） |

**终战形态推演**（规律 4 的预测，非事实）：两条已验证路径——keyless 签名+透明账本消灭密钥管理成本（sigstore 路线），或 registry 不可变事实标准（npm 路线）；差异点同样真实：Skills 生态**没有中心化 registry 的引力**（git 裸装已是事实主流），故更可能长成「三层信任栈+企业私域凭据」的混合形态而非单一 registry。分叉已在进行：官方仓零版本 vs supabase 逐版发布、三层市场三套互不兼容的私有答案（§7）。

## 9. 底层规律与核心争议

**五规律（正交分解：完整性/来源/时间/采纳/治理）**：

1. **digest 证明货没换，不证明谁装的（Integrity ≠ Provenance）**——哈希是发布方自己写的，他能登记毒内容的正确哈希；没有它，「途中换货」零成本，有了它，攻击必须升级为双点锁步。演示：E-01/E-02。
2. **可信来源=签名身份+透明见证，社区总会自组织出这两层（信任栈收敛于 sigstore 形态）**——知道「货没换」后马上问「谁装的、装的时候有没有人看见」；透明账本把信任换成证据（事后可发现 > 事前绝对可信）。演示：§4 三层栈与 Fulcio/Rekor 逐层重叠。
3. **没有不可变历史，lockfile 就从便利升级为唯一锚点**——npm 删 lockfile 能从 package.json 重生（保税仓在）；技能港上游一改旧版本入口直接消失。演示：E-05+官方仓 vs supabase 对照。
4. **格式采纳与信任设施的成本不对称**——接极简解析器零成本零让渡；建 registry 或强制验签=让渡分发/命名/裁判主权+摊派密钥成本——所以格式 6 个月统一 46 家、签名 0 家。这不是懒，是结构性成本；它同时预测终战形态（§8）。
5. **安全边界写在纸上不代表在海上（MUST is paper; the sea decides）**——SEP-2640 把「digest 不是安全边界」诚实写进规范；Claude Code 文档明写 workspace trust 不管 allowed-tools；规范 grep 不到 sign——真实防线在各客户端实现选择里（§7 四闸门）。

**三争议**：①**digest 该不该进规范**——pja-ant「同信任域，digest 是安慰剂且是 footgun」vs jonathanhefner「分域托管+锁步竞态证明独立价值」；本质是威胁模型选择（传输层 vs 源头层），社区用三层栈同时要了两层。②**中心化 registry vs 活文档**——#380 作者 24 小时自我推翻又带回滚盲区杀回；本质是软件不可性假设 vs 知识鲜活性假设之争（「指令要不要像代码一样冻结发行」），包管理器史站在冻结一边。③**隔壁港的半场革命**——SEP-2640 用 content-bound approval 把 rug-pull 变成可检测事件，但 digest 仍不签名、分发只通半场；本质是「把安全渐进诚实写进规范」vs「用户误读 Final=安全」——规范作者选了诚实，代价是半场战争要等下半场。

## 10. 关键实证数字

| 口径 | 关键数字 | 归属 |
| --- | --- | --- |
| E-01 锁步竞态 | 关校验 0 报错双装 / 开校验 1 失配整批打回 | lab3 实测（本仓，确定性 mock） |
| E-02 footgun | 只换工件忘换 index → 严格客户端 errors=1 全挂；soft-404 形态分叉 | lab3 实测 |
| E-03 隐形墨水 | 26 tag 字符：屏显/diff 全同，仅 hexdump 显形 | lab3 实测；野外 171 字符实例=lirantal（四级第三方） |
| E-04 预批准 | 预授权通道 executed=true 零提示 / 明文通道被拒+识别 injection | lab3 实测（Reversec 链 mock） |
| E-05 版本双门 | 写死 3 commit 仍是 1.0.0 / 省略 3 commit 跳 aaa→ccc | lab3 实测（mock computed version） |
| E-06 typosquat | 错拼双装、0 告警、digest 双合法 | lab3 实测 |
| 规范安全词 | 247 行、8 词干唯一命中 L133 "Designed"（sign 藏于 De-sign-ed） | grep 复验 @69ef37e9（2026-09-27） |
| 生态信任真空 | 46 家客户端 vs 0 家验签 | showcase 源码清点 @69ef37e9 / 四家实测基线（210 §7） |
| Snyk ToxicSkills | 3,984 扫描 → 76 恶意 / 13.4% CRITICAL / 36.82% 有问题 | 厂商自报 @2026-02-05 |
| USENIX'26 | 98,380 扫描 → 157 恶意 / 4.03 漏洞每恶意技能 / 过半单一行为者 | arXiv 2602.06547 |
| MalSkillBench | 野生 703 样本 86.3% 假前置依赖冒充 | arXiv 2606.07131 |
| ClawHavoc | 1,184 个投毒技能 | Antiy CERT（二手转述，Trellix 403 未直读） |
| 市场体量 | npm skills 月下载 29,823,552；topic 9,142 仓；官方仓 178,560 stars | npm registry 官方（2026-08-27~09-25，含 CI/bot）/ GitHub API |
| 主仓冻结 | HEAD @69ef37e9 后零提交 49 天；48 open PR；#546 八行/24 天/0 评论 | gh api 实测 @2026-09-27 |
| SEP-2640 | 81 天（2026-06-24 否决→09-13 Final）；512 文件/16 MiB；3 家 Partial | ext-skills @b0b3272f；client-matrix（社区维护口径） |
| 官方仓版本 | 19 技能零 version/零 tag/零 release；claude-api 3 个月 ≥9 次静默变更 | GitHub API 提交史实测 |
| 独立见证 | Skills 类 187,976 行 | TomeVault instruction-corpus manifest @2026-07（**文件实例含 fork，非去重技能数**；自报口径，签名 manifest 可独立复核） |
| 生态实况 | supabase index 活（URL 钉 Releases v0.1.8）/ cloudflare 404 / schemas DNS 000 | curl 实测 @2026-09-27 |

## 11. 动手实验室

- 运行：`cd docs/research/agent-infra/assets && uv run --no-project python agent_skills_lab3.py --selftest`（无 uv 用 python3；秒级、确定性、纯标准库）。`--break E-01..E-06` 单拆一机制；自测基准 [lab3-selftest.json](./assets/lab3-selftest.json) 与本文全部引用日志同源。
- 机制→代码速查：`Client.fetch`（digest 开关+lag 窗口模拟锁步）/ `Harbor.publish`（注入「只换工件忘换 index」）/ `exp_version_gates`（computed version 双门 mock）/ `exp_typosquat`（错拼双装）。E-04 为 Reversec 链的确定性 mock（不执行真实命令），E-05 为比较逻辑 mock（不真跑 marketplace 更新流）。
- 上游复核三连（终端实录素材）：`curl https://supabase.com/.well-known/agent-skills/index.json` → `curl https://cloudflare.com/.well-known/agent-skills/index.json`（404）→ `curl https://schemas.agentskills.io/...`（DNS 000）。

## 12. 批判性边界（材料未证明的 5 件事）

1. Snyk/USENIX/MalSkillBench 数字均为**扫描口径**（样本=ClawHub+skills.sh 等社区 registry），非全生态普查；「恶意」判定标准未公开可复现。
2. 三层信任栈两实现——contextlock 为**原型级**（建仓 2026-07-15、npm 月下载 12）；TomeVault 规模为**自报口径**（187,976 行含 fork，签名 manifest 可复核但见证服务本身未经独立审计）。
3. SEP-2640 的 3 家 Partial 实装多为**社区自报**（唯 ChatGPT 有厂商文档背书）；「Claude Code 内部原型」无公开时间表——协议已定、实现竞速早期，生产可用性未证。
4. 供应链攻击数字的**时间外推**（「六个月无完整性层」→长期风险曲线）无纵向数据；ClawHavoc 1,184 为二手转述。
5. 「历史总重演」是**叙事框架非因果证明**——差异点（无中心化 registry 引力、git 裸装事实主流）同样真实，终战形态推演（§8）是预测不是事实。

## 13. 研究范围与《费曼考评实录》

**研究范围**：输入=Agent Skills 开放格式的分发/签名/版本生态（2026-03 至 2026-09-27），证据=PR/issue 楼层原文、规范文本钉点、仓库代码、curl/npm/GitHub API 实测、lab3 确定性实验；输出=机制结论与退化数据。成立工况：公开生态、git 分发为主、客户端自主选择信任策略。**Out-of-Scope**：MCP 协议自身安全模型（仅取 skills 条款）、各客户端未公开的内部风控、攻击纵向趋势外推、恶意样本逆向。

**实录（Learner Subagent 代管，压缩为结论）**：费曼三维考评**三题全绿**。题 1（白话转述）——用「铅封/签章/灯塔台账」三道具向零基础讲清完整性≠来源，并诚实交代 digest 的 footgun 面；题 2（最近邻差异）——三条轴判明与中心化 CA 的本质差异：信任锚从「事前绝对可信」换成「事后可发现」、密钥成本用完即弃、见证与签章互不削弱；题 3（极限推演）——推演终战两分支（keyless+透明账本 / registry 不可变）并主动交代反例条件（无 registry 引力），给出可证伪信号（§15 三个跟踪信号）。要点：正交五轴（完整性/来源/时间/采纳/治理）在追问下不串轴；唯一被考官纠偏的措辞是「MUST 无强制力≠规范无价值」（条款对**诚实实现者**仍构成对账基线）——复考全绿，出闸。

## 14. 用户自测（3 题）

1. 同事说：「既然客户端都支持 digest 校验，供应链问题已解决。」用 E-01 与 E-06 两个实验结果分别反驳：digest 拦得住什么、拦不住什么？（提示：锁步竞态是它**能**拦的极限案例；typosquat 是它**结构上不可能**拦的案例——为什么？）
2. 为什么 Anthropic 维护者把 attestation「推给分发层」后，#254 反而停摆约六个半月？用「采纳成本不对称」规律解释格式 6 个月统一 46 家、签名 0 家的结构性原因，并预测：若 sigstore 路线胜出，密钥成本摊派给谁？
3. SEP-2640 已 Final，为什么说它只打了「半场战争」？列出它标准化的半边与显式 deferred 的半边，并解释 content-bound approval 为什么把 rug-pull 从「不可检测」变成「可检测」而非「不可发生」。

## 15. 与本仓的关联

机制→negentropy 代码的 grep 实测映射（skills_injector/harness_materializer/definitions 表版本语义）见 [221-skills-supply-chain-mapping.md](./221-skills-supply-chain-mapping.md)；本篇同时是 E3 视频蓝图的直接信源（七幕↔章节逐幕对表亦在 221）。上一篇 [210](./210-agent-skills-open-standard.md)（格式层精读）；E1 成片结尾的三张欠条（怎么签名/怎么分发/怎么管版本）在本篇 §3–§6 逐一兑付对账。可跟踪三信号：#254 合并与否 / #380 解冻与否 / 任一客户端首发签名校验或第一个要求 provenance 的 skill registry。

## 参考（IEEE）

[1] agentskills, "Agent Skills Specification," agentskills.io. [Online]. Available: https://agentskills.io/specification. Accessed: 2026-09-27（规范仓钉点 `69ef37e9`，2026-08-09 后冻结）.
[2] agentskills/agentskills, "PR #254: Add spec for .well-known URI," "PR #380: feat: add optional skill versioning," "Issue #46: support versioning/locking," "Issue #418," GitHub. Accessed: 2026-09-27（楼层级评论证据，正文以 `P254:` 记号逐条可复核）.
[3] modelcontextprotocol, "Skills Extension (SEP-2640)," ext-skills 仓 specification/stable/skills.mdx. [Online]. Available: https://github.com/modelcontextprotocol/ext-skills. Accessed: 2026-09-27（钉点 `b0b3272f`；Final 2026-09-13）.
[4] Cloudflare, "Agent Skills Discovery RFC," github.com/cloudflare/agent-skills-discovery-rfc. Accessed: 2026-09-27（钉点 `1bd11679`，文本冻结 2026-03-24）.
[5] Google, "Gemini CLI"（skills 确认门源码 write.toml/activate-skill.ts/tools.ts）, github.com/google-gemini/gemini-cli @v0.61.x.
[6] Anthropic, "Claude Code Skills / Plugins — host a marketplace," code.claude.com/docs. Accessed: 2026-09-27.
[7] Snyk, "ToxicSkills: Malicious AI Agent Skills," snyk.io/blog. Accessed: 2026-09-27（厂商自报，扫描截至 2026-02-05）.
[8] arXiv 2602.06547, "Malicious Agent Skills in the Wild: A Large-Scale Security Empirical Study," USENIX Security'26; arXiv 2606.07131, "MalSkillBench."
[9] OpenSSF Sigstore 文档（docs.sigstore.dev）；npm provenance（docs.npmjs.com，GA 2023-04-19）；PyPI trusted publishers/attestations（docs.pypi.org）；RustSec cargo-audit. Accessed: 2026-09-27.
[10] 第三方研究（四级，均带归属引用）：Reversec Labs, "Skill Issues: Compromising Claude Code with Malicious Skills," 2026-05; L. Tal, "Gemini CLI invisible unicode skill injection," lirantal.com, 2026；Antiy CERT ClawHavoc 报告（经 arXiv 2606.07131 转述）.
