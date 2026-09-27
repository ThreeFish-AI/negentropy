# 信源取证笔记（Stage ① · B 型：PR 楼层/规范文本/仓库代码）

> 台账：`research/sources.toml`（16 条 · verify FAIL 0，取数 2026-09-27）。三钉点：agentskills@`69ef37e9`
> · ext-skills@`b0b3272f` · cloudflare-rfc@`1bd11679`；本仓研究三件钉 `9284cce2`（220/221/lab3）。
> 证据四级：【一】钉点原文直读 · 【二】本仓独立复算（gh api / npm / curl / grep / lab3 重跑）
> · 【三】他人分析（进画面/口播须带归属句）· 【四】厂商/作者自报（须带角标）。
> 本轮复核前置：lab3 `--selftest` 于 2026-09-27 重跑，与 `lab3-selftest.json` 逐键一致（10 项 A 表自复算同日完成）。

## 一、断言 → 证据映射（口播可引用的硬事实）

| # | 断言（口播句） | 证据级 | 出处（台账名 / 220 小节） |
| --- | --- | --- | --- |
| A1 | 规范 247 行、8 词干唯一命中 L133 "Designed"（sign 藏于 De-sign-ed，p0-02..04） | 【二】 | grep 复验 @69ef37e9（G5；spec-mdx） |
| A2 | 46 家客户端互认箱体（p0-05/08、p6-09） | 【二】 | showcase 源码清点口径（210 §7 / 220 §1） |
| A3 | 签名/分发/版本三留白是明文决策；三份签名提案全关；「attestation 归分发层」 | 【一】 | #418 维护者定调 + #46（220 §1/§5；issue46-thread） |
| A4 | npm 八年等来投毒 / 本生态六个月同悬崖（p0-10/11、p5-11） | 【一】引文 | #358 判词原话；**作者系自述 AI-agent 账号、非维护者**（220 §8 表注「作者自报」） |
| A5 | #254 舱单：域名固定路径、五必填、SHA-256 铅封、失配拒用（p1-02..04） | 【一】 | pr254-thread + cf-rfc（220 §3） |
| A6 | 信封/集装箱两箱型 + 解压炸弹三条款；相对地址解析（p1-05/06a） | 【一】 | cf-rfc + pr254-thread（220 §3） |
| A7 | `$schema` 缺席三分叉（回退/拒收/双读）；1024 无单位；soft-404 合法（p1-06b/10a..c） | 【一】【三】 | cf-rfc / pr254-thread / vercel-sdk + Leiruz 独立复算楼层（220 §3） |
| A8 | 提案停摆：开 PR 2026-03-16 22:50Z，194 个整天 ≈ 6.4 个月（p1-07、p6-03） | 【二】 | gh api 复算 @09-27（220 §2 作 194 天，口径吻合） |
| A9 | 「反对第一枪来自 Anthropic 自己人」＝pja-ant（Peter Alexander, Anthropic） | 【一】 | P254:4117431773（220 §3/§4） |
| A10 | 锁步竞态 14:00/14:01/14:02 辩护＝jonathanhefner 三段论（p1-11/12） | 【一】 | P254:4118732417（220 §3） |
| A11 | 评论区三个月长出三层信任栈（p1-14、p2-02/03/05） | 【一】 | pr254-thread（220 §4） |
| A12 | contextlock：DSSE+213 测试真实、建仓 07-15 次日自荐、月下载 12 | 【一】【二】 | contextlock-dsse（220 §4 / G2）；npm `@contextlock/core` 本轮复取=12 |
| A13 | TomeVault 自报 187,976＝18.8 万**文件实例**（fork 各算一，非独立技能数） | 【四】 | 220 §4（G2 逐仓核对；manifest 可公开复核） |
| A14 | 见证人日度 Ed25519+OpenTimestamps 签名清单、外部可复算（p2-06a） | 【四】【二】 | 220 §4（snapsynapse 独立复算佐证） |
| A15 | sigstore 2022（短命证书/透明日志）↔ 三层栈同构；2022→2026＝**四年**（p2-07/08） | 【一】【二】 | 220 §4/§8 |
| A16 | 「trust is easy to assert…」「skills are instructions…」＝petemounce 两楼 | 【一】 | P254:4692737191 / 4451634076（220 §4/§5） |
| A17 | 聊天窗口边界＝snapsynapse（P254:4995195544） | 【一】 | pr254-thread（220 §4） |
| A18 | computed version 双门：写死不送达/省略跟 HEAD；同时刻仅服务一版（p3-03..05） | 【一】 | Claude Code 插件文档 Release a new version 节（220 §5） |
| A19 | 官方仓 19 技能零 version/零 tag/零 release、claude-api 3 个月 ≥9 次静默变更（p3-06） | 【二】 | 220 §5；本轮 gh api 复核 tags=0/releases=0 |
| A20 | supabase v0.1.1–v0.1.8 自动发版、每版带 tar.gz（v0.1.2 起附 index.json）（p3-07） | 【二】 | 220 §5；本轮逐版复核 assets |
| A21 | #380 四件套、24h 内自我推翻、约一月后带回滚盲区 v0.1.7→v0.1.6（p3-08..10） | 【一】 | pr254-thread Rodriguespn 三楼（05-13/05-14/06-10，220 §5） |
| A22 | 主仓冻结 49 天、48 open PR、#546 八行 24 天 0 评论（p4-01/11/12） | 【二】 | gh api 复核 @09-27（220 §2/§6） |
| A23 | SEP-2640：06-24 表决**推迟**（四结构性顾虑）→ 09-13 Final，全程 81 天（p4-02..04） | 【一】 | sep2640-decisions §June-24 条目（220 §6） |
| A24 | 双港机制：复用 Resources、逐文件 digest、content-bound approval、per-origin 身份、allowed-tools MUST 忽略、digest 匹配≠安全边界（p4-05..09） | 【一】 | sep2640-stable（L479/L861/L869 等） |
| A25 | 三家 Partial、唯 ChatGPT 厂商文档背书（静态快照）；Claude Code＝内部原型未公开（p4-09a/b） | 【一】【四】 | 官网 client-matrix + implementations.md；SEP 文「prototyped internally at Anthropic; not yet public」 |
| A26 | 人事桥＝Jonathan Hefner 一座；但 **PR #546 作者＝tobi-oye**（非 Hefner） | 【一】【二】 | 220 §6；本轮 gh api 复核作者 |
| A27 | Snyk：3,984 扫描 → 76 恶意、36.82% 有问题、91% 叠加提示注入 @2026-02-05 | 【四】 | 220 §1/§7（厂商自报；画面须带时点角标） |
| A28 | USENIX'26：98,380→157 恶意、平均 4.03 漏洞/恶意技能（arXiv 2602.06547）（p5-03） | 【三】 | usenix-paper（论文口径，口播已带「学术界」归属） |
| A29 | `skills` npm 包月下载 29,823,552、含 CI/bot（2026-08-27~09-25 官方窗口）（p5-03a） | 【一】【二】 | npm registry 官方；本轮 API 复取同值 |
| A30 | 老三样：品牌冒充/错拼（traiding）/假前置依赖（MalSkillBench 86.3%）（p5-04） | 【三】 | Snyk + arXiv 2606.07131（220 §7） |
| A31 | 隐形墨水：171 个 U+E0000 区字符、--yolo 自激活弹计算器、VRP 三分钟 Won't Fix（p5-04a/b） | 【三】 | L. Tal 2026（220 §7；须「有人/研究者」归属） |
| A32 | Gemini 确认门＝代码级（write.toml 默认 ask_user、无 TTY 直接 deny、--yolo 旁路）——门在**激活时**而非安装时（p5-05） | 【一】 | gemini-cli 源码（G4 源码级核对） |
| A33 | Claude Code 原话「Workspace trust doesn't gate this field」（p5-06） | 【一】 | Claude Code skills 文档 Pre-approve tools 节 |
| A34 | Reversec 链：allowed-tools 预授权 + 模型不可见动态语法＝无提示直执；明文请求被拒并识别（p5-07/08） | 【三】 | 220 §7②（自我定位「非漏洞披露」） |
| A35 | event-stream 2018：burnout 移交→夹带私货→定向 Copay 钱包（p5-10） | 【一】 | 220 §8（npm 先例层） |
| A36 | curl 三连：supabase index 活 / cloudflare.com 同路径 404（301→www）/ schemas DNS 000（p6-04） | 【二】 | 本轮 @09-27 复测一致（220 §3/§10） |

**台账缺口（Stage ⑥ 前建议补登，本轮未动 sources.toml）**：Snyk 博文、arXiv 2606.07131、lirantal.com、Reversec、#358/#380(PR)/#418/#546、TomeVault manifest、anthropics/skills、supabase/agent-skills、npm downloads API、ext-skills `seps/2640`（A25 引文在 seps 文不在 stable/skills.mdx）、Claude Code `/docs/en/skills` 与 `/docs/en/plugins/host-marketplace`（A18/A33 原话所在页，cc-plugins-doc 现钉 /plugins 总览页未覆盖）。

## 二、原型实测（X1–X6，全部可重跑；源＝lab3 selftest 2026-09-27 重跑，确定性 mock）

| 实验 | 退化结果（实际 selftest 输出值） | mock 性质 | 视频可用表述 |
| --- | --- | --- | --- |
| X1＝E-01 锁步竞态 | off：installed=[skill-a, skill-b]、errors=[]（阴阳版本零报错）；on：installed=[**skill-a**]、errors=1 | digest 真算（真 SHA-256 比对） | 关校验同批装两个版本零报错；开校验**失配那一件当场拒收**（skill-a 照装——口播「整批打回」与实测不符，见 verification RISKY 清单） |
| X2＝E-02 footgun | stale_index_strict_client.errors=1（严格客户端全挂）；soft404.accepted_as_index="raise" | 同上 | 只换工件忘换 index → 严格客户端整站不可用；soft-404 分叉点口播引 Leiruz 复算结论（p1-10a），未直引本 mock 的 raise |
| X3＝E-03 隐形墨水 | total_chars=46、invisible_tag_chars=26、screen_and_diff_identical=true、hexdump_visible=true | 26 为真算；两布尔为**构造性恒真**（shown==text 自比；本轮实跑 diff 会报 1c1 行变更） | 26 个隐形字符屏显无差；「对比工具看不出差别」超出 mock 实测（见 RISKY 清单 p5-04c） |
| X4＝E-04 预批准 | a：model_sees=false/prompt=false/executed=true；b：executed=false、flagged_as="prompt injection" | **全字面量 mock**（executed 由 `"Bash" in fm_grant` 字符串判定，不执行任何命令） | 双通道对照结论属 Reversec（【三】），本 mock 仅作画面示意——口播须带归属句 |
| X5＝E-05 版本双门 | pinned：user_sees=[1.0.0×3]、bugfix_delivered=false；floating：[aaa,bbb,ccc]、all_users_jumped=true | mock computed version 比较逻辑（不跑真实 marketplace 更新流） | 写死推三修复不动 / 省略一次全员跳变；口播宜带「玩具模拟」限定 |
| X6＝E-06 一字母之差 | both_installed=true、warnings=**0（硬编码）**、digest_valid_for_both=true | digest 双合法为真算；零告警是结构性结论（玩具客户端无告警通道，非测量值） | 错拼双装、digest 拦不住名字冒充 |

## 三、数字纪律（ISSUE-164：他方数字一律自复算或带归属角标）

- **已自复算（【二】，本轮 2026-09-27 复核）**：247 行/L133（grep）；194 个整天＝停摆约六个半月（时戳口径；日历差 195）；冻结 49 天；SEP 81 天；#546 八行/24 天/0 评论（作者 tobi-oye）；48 open PR；tags=0/releases=0（官方仓）；「一个月后」（05-13→06-10＝28 天）；「二十四小时内」（05-13→05-14＝18 小时）；「建仓第二天」（07-15→07-16）；supabase 八版逐版 assets；npm `@contextlock/core` 月下载=12；curl 三连；lab3 selftest 重跑一致。
- **带归属他方数字**：76/3,984/36.82%/91%＝Snyk 自报【四】@2026-02-05（口播已带「安全团队/厂商」主语，画面须带时点角标）；98,380/157/4.03＝论文【三】（已带「学术界」）；86.3% 假前置＝MalSkillBench【三】；171 字符+3 分钟 Won't Fix＝L. Tal【三】（已带「有人」归属，建议画面角标补出处）；18.8 万＝文件实例含 fork、TomeVault 自报【四】（口播已带「自报+文件数+复刻各算一个」三重限定）。
- **2,982 万**＝29,823,552 @2026-08-27~09-25 npm 官方窗口、**含 CI/bot 口径必须随数字出现**（p5-03a 已带）；月下载 12＝npm registry 直读。
- **刻意未上口播的数字**：13.4% CRITICAL、632 漏洞、ClawHavoc 1,184（二手转述降级）、9,142 仓/178,560 stars、512 文件/16 MiB 硬限、50MB/1000 文件双闸——按蓝图 A5/C→B 信源卫生条款留置。
- lab3 系数字（26/0 报错/三 commit/双装零告警）＝自建玩具【二】，口播须带「我们实测/复刻/玩具」限定（p1-13 已带；p3-05 未带限定——见 verification）。

## 四、三级证据归属句纪律（句 id 清单）

- **带归属且正确**：p0-07/p5-02「有安全团队/安全厂商扫了」【四】；p1-08「Anthropic 自己人」【一】；p1-10a「有人刻意不看现成客户端」（Leiruz【三】）；p2-04「月下载量十二次」（配套 A12 自复算）；p2-06「自报…文件数、复刻各算一个」【四】；p2-10/p3-13「有位评论者/有人总结」（petemounce【一】）；p2-12「还有个人泼冷水」（snapsynapse【一】）；p3-02「维护者说」（jonathanhefner【一】）；p3-09/10「提案人自己」【一】；p4-09a/b「规范原文」【一】；p5-05「我们核过它的源码」【二】；p5-06「另一家的文档原话」【一】；p5-04a/b「有人」（L. Tal【三】，归属偏弱，建议画面角标）。
- **归属错误（详见 verification RISKY）**：p0-11/p5-11「维护者」——判词作者系自述 AI-agent 账号（author_association=NONE），220 §8 表注即「作者自报」。
- **归属缺失**：p5-07/p5-08 还原链未提安全研究方（Reversec【三】）。
