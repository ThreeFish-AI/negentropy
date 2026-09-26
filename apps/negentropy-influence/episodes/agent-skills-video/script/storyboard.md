# 分镜表（storyboard.md）

> 句 id 与 `narration.md`（★SSOT）逐句对齐；各镜时长以 audio manifest 实测为准（`at()/dur()` 均按句 id 推导，禁写死帧数）。
> 色板（theme.ts 契约）：引航青 `#45DFFF`=港口/规范/台账系统面 · 货签粉 `#FF7A9E`=集装箱/知识/内容面 · 警示金 `#FFC85C`=悬案/留白 · danger 红仅攻击瞬间 · ok 绿仅验证瞬间。
> 空间语义恒定：纵深=港口平面；左=堆场（存量），右=泊位/作业台（使用中）；「进入上下文」永远向右。〔M-001〕集装箱母题全片同形（粉描边恒定线宽）；〔M-003〕持续陈述配可停驻终态。
> 画面文字一律关键词锚点（≤6 字短语），禁整句复述口播（复述门）。

## P0 四十六家就范（p0-01..15，镜 0-A..0-F）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A | p0-01..02 | **反常捐赠**：2025 年份戳 + 「开放标准」牌匾从 Anthropic 港务大楼递出（关键词：2025 / 捐出） ·**archify full**：port-46-adoption 章 `pa-open`（p0-01） | 牌匾 useSpring 递出；年份戳 useImpulse；`@spring` `@impulse` |
| 0-B | p0-03..04 | **牌桌亮灯**：夜港全景，四家招牌（OpenAI/Google/微软/Cursor）先亮，随后 46 盏港灯次第点亮 ·**archify full**：port-46-adoption 章 `pa-harbor`（p0-03）+ `pa-table`（p0-04） | 灯组 useStagger 波次点亮后保持〔M-003〕；末帧停驻全亮终态；`@stagger` |
| 0-C | p0-05..07 | **悬念三连**：文件夹图标→单文件→「247 行」计数器，三个「没有」标签逐个盖章（无版本号/无日志/无安全章节）（关键词：247 行 / 三个没有） | 计数器 useCount 滚到 247；印章 useImpulse 连盖；`@count` `@impulse` |
| 0-D | p0-08..10 | **规矩之困**：白板上三张便签（报销单/评审口径/PDF 三个坑）悬浮在 AI 头像上方，抓取失败手势（关键词：团队规矩） | 便签 useStagger 浮现；AI 头像微摇头 useSpring；`@stagger` `@spring` |
| 0-E | p0-11..15 | **两条老路**：左船雾中盲航（引航青雾）翻沉 / 右船超载（警示金）压舱进水；旁挂数字翻牌「20×3000≈60000」 ·**archify full**：two-old-roads 章 `or-two`（p0-11）+ `or-guess`（p0-12）+ `or-stuff`（p0-12a）+ `or-ledger`（p0-13） | 双船对照 useProgress 同步下沉；翻牌 useCount；`@progress` `@count` |

## P1 一个文件夹的标准（p1-01..19，镜 1-A..1-G）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A | p1-01..03 | **箱体解剖**：集装箱母题〔M-001〕展开爆炸图——箱体→SKILL.md→六格角件卡（name/description 两格高亮，其余四格灰） ·**archify full**：box-anatomy 章 `ba-box`（p1-01）+ `ba-corner`（p1-02）+ `ba-name`（p1-03） | 爆炸图 useSpring 分层展开；两格高亮 useImpulse；`@spring` `@impulse` |
| 1-B | p1-04..06 | **登记处**：无注册中心（虚线打叉的中央大楼）→ 文件夹抽屉即登记处，箱号铭牌=抽屉标签逐字对齐 ·**archify full**：identity-registry 章 `ir-nocenter`（p1-04）+ `ir-deal`（p1-06） | 铭牌滑入槽位 useSpring 对齐卡口「咔」一下；`@spring` |
| 1-C | p1-07..11 | **正文与附件**：正文区自由书写动画 + 三层附件抽屉（scripts/references/assets）推入箱体；「规范不管」印章 ·**archify full**：box-anatomy 章 `ba-body`（p1-07）+ `ba-annex`（p1-08）+ `ba-optional`（p1-08a）+ `ba-validate`（p1-08b） | 抽屉 useStagger 推入；印章 useImpulse；`@stagger` `@impulse` |
| 1-D | p1-08c..08e | **工艺一：长出来**：真实任务工作台——AI 干活、人纠偏、便签「不用库X会踩坑」飞入箱内 gotchas 节 ·**archify full**：craft-real-tasks 章 `cr-grow`（p1-08c）+ `cr-gotchas`（p1-08e） | 便签 useSpring 飞入并钉住；`@spring` |
| 1-E | p1-08f..08g | **工艺二：跑了再改**：循环箭头（写→跑→改）转动；天平一侧「模型已会」清空、一侧「它不知道」加重（关键词：跑了再改 / 会的别写） ·**archify full**：craft-real-tasks 章 `cr-rerun`（p1-08f）+ `cr-lean`（p1-08g） | 循环 useProgress 旋转；天平 useSpring 倾斜；`@progress` `@spring` |
| 1-F | p1-09..10 | **治理宪法**：ISO 会议室场景，条文卡「Keep the format small」引号卡（引航青）+ 中文要点副标（关键词：格式要小 / 真实痛点） | 条文卡 useDraw 描边显字；`@draw` |
| 1-G | p1-11..12 | **三处留白**：箱体图三块区域虚线化并打金色问号——放哪/谁查/航线（关键词：三处留白） | 三块 useStagger 虚线化+问号 useImpulse；〔M-003〕终态停驻；`@stagger` `@impulse` |

## P2 台账与提箱（p2-01..15，镜 2-A..2-F）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..04 | **台账墙**：调度室场景，台账墙逐行点亮（每行=箱号+一句货签，引航青单像素行〔M-001〕）；右侧泊位保持空 ·**archify full**：disclosure-lifecycle 章 `dl-discover`（p2-01）+ `dl-catalog`（p2-03） | 台账行 useStagger 点亮〔M-003〕；「~100 token/行」角标 useCount；`@stagger` `@count` |
| 2-B | p2-05..08 | **提箱开箱**：匹配的台账行高亮→吊臂把对应集装箱〔M-001〕从左堆场吊往右作业台→整册指导书摊开；隔层按需抽拉 ·**archify full**：disclosure-lifecycle 章 `dl-activate`（p2-05）+ `dl-tier3`（p2-06）+ `dl-rewrite`（p2-08） | 吊臂 useProgress 平移；摊开 useSpring；隔层 useStagger；`@progress` `@spring` `@stagger` |
| 2-C | p2-08a..08c | **软预算**：正文区标尺 5000 token/500 行（警示金虚线）+ 参考文件分册 +「一层深」单跳路径示意（关键词：软预算 / 一层深） | 标尺 useDraw；分册 useSpring 弹出；越界试探被弹回；`@draw` `@spring` |
| 2-D | p2-09..10 | **数字翻牌**：左右账柱 39,222 vs 2,321（自建玩具角标）；「≈17×」横幅 ·**archify full**：budget-flipboard 章 `bf-toy`（p2-09）+ `bf-times`（p2-10） | 账柱 useCount 对向生长；横幅 useSpring 压入；`@count` `@spring` |
| 2-E | p2-11..12 | **对岸同款**：对岸港口（OpenAI 旗）调度室同款台账墙，标尺「≤2% 或 8000 字符」（归属角标：OpenAI 文档口径）；两港隔海相望 ·**archify full**：budget-flipboard 章 `bf-openai`（p2-11） | 双港同款台账 useStagger 镜像点亮；标尺 useDraw；`@stagger` `@draw` |
| 2-F | p2-12a..12c | **脚本家规**：箱内脚本舱——版本号钉死动画；四条家规牌（不问交互/报错说人话/结构化/能空跑）（关键词：钉版本 / 四条家规） ·**archify full**：script-craft 章 `sc-pin`（p2-12a）+ `sc-rules`（p2-12b） | 版本钉 useImpulse；家规牌 useStagger；`@impulse` `@stagger` |

## P3 货签决定生死（p3-01..12，镜 3-A..3-E）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..04 | **好签差签**：两张货签并排（粉）——左「清洗 CSV：做什么+何时用」亮绿勾、右「帮忙处理文档」蒙灰无勾；分拣员视线从右签滑过不停留 ·**archify full**：label-good-bad 章 `lb-pair`（p3-02）+ `lb-silent`（p3-04） | 左签 useImpulse 亮起；右签降饱和〔M-002〕以静写闷——无强调动效；`@impulse` |
| 3-B | p3-05..06 | **何时用**：货签放大镜下「何时用」子句高亮；用户气泡「这表看着乱」→ 清洗签被勾中（关键词：何时用 / 没说关键词） ·**archify full**：label-good-bad 章 `lb-intent`（p3-06） | 气泡 useSpring 浮起→连线勾中 useImpulse；`@spring` `@impulse` |
| 3-C | p3-07..08 | **近失配**：靶纸三环——中心「正解：表格编辑」、近环「差一点：改个表格」命中清洗签边界、外环「无关：天气」剔除 ·**archify full**：routing-eval-protocol 章 `re-nearmiss`（p3-08） | 近环弹着点 useImpulse；外环淡出；`@impulse` |
| 3-D | p3-08a..09a | **别写满**：货签膨胀成大杂烩被 2% 标尺弹回（呼应 2-E）；随后收缩成精炼版过关（关键词：别写满） | 膨胀 useSpring 回弹；`@spring` |
| 3-E | p3-09..11 | **一套卷子**：考卷摊开——20 题三遍演算纸→触发率分数条；六四分档（练/考）；「最优≠最后」两版货签对比冠军非终版 ·**archify full**：routing-eval-protocol 章 `re-protocol`（p3-09）+ `re-holdout`（p3-10）+ `re-interview`（p3-11） | 卷面 useStagger 铺开；分数条 useCount；冠军标 useImpulse；`@stagger` `@count` `@impulse` |

## P4 四个港口四种章程（p4-01..14，镜 4-A..4-F）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..02 | **对账开场+模范生**：审计台灯亮起；四联卡第一格 Gemini 港——章程牌「仅两格必填」+ 海关岗亭绿灯 ·**archify full**：four-ports-charter 章 `fp-quartet`（p4-01）+ `fp-gemini`（p4-02） | 岗亭灯 useImpulse 亮绿（ok 色）；`@impulse` |
| 4-B | p4-03..04 | **私货与通吃**：第二格 Claude Code 港——章程牌挂 10+ 扩展字段标签微微超宽；第四格 VS Code 港三道门全开（关键词：私货字段 / 三套全认） ·**archify full**：four-ports-charter 章 `fp-cc`（p4-03）+ `fp-vscode`（p4-04） | 扩展标签 useStagger 外溢；三道门 useSpring 齐开；`@stagger` `@spring` |
| 4-C | p4-05a..05b | **堆场混战**：四港堆场地图——.agents/.claude/自专属三种路牌交错；.agents 路牌最终四港通用高亮（关键词：点agents / 事实锚点） ·**archify full**：four-ports-charter 章 `fp-paths`（p4-05a）+ `fp-anchor`（p4-05b） | 路牌 useStagger 交错亮；.agents 全线贯通 useDraw；`@stagger` `@draw` |
| 4-D | p4-06..08 | **宽容之门**：验关台——name 不匹配的箱子亮黄警告牌仍放行（黄=warn）；门禁计数器「严格拒 4 / 宽容进 12」（自建实测角标） ·**archify full**：lenient-vs-strict 章 `ls-warnload`（p4-06）+ `ls-x2`（p4-08） | 警告牌 useImpulse 后闸门 useSpring 抬杆放行；计数器 useCount；`@impulse` `@spring` `@count` |
| 4-E | p4-08a..08d | **双跑盲评**：同单两跑（带箱/不带箱）产物进遮幕裁判席；断言清单逐条勾选；成本收益两栏记账（关键词：双跑 / 盲评 / 断言） ·**archify full**：eval-twin-runs 章 `et-blind`（p4-08a）+ `et-assert`（p4-08d） | 遮幕 useSpring 落下；勾选 useStagger；账本 useCount；`@spring` `@stagger` `@count` |
| 4-F | p4-09..11 | **验箱师与真空**：对照表 13 条红叉（自建复核角标）；签名栏四家全空——唯独 Gemini 岗亭那盏绿灯回闪（呼应 4-A） ·**archify full**：four-ports-charter 章 `fp-ref`（p4-09）+ `fp-vacuum`（p4-10） | 红叉 useStagger 连打；空签名栏 useDraw 描空；绿灯 useImpulse 回闪；`@stagger` `@draw` `@impulse` |

## P5 两个破坏实验（p5-01..14，镜 5-A..5-F）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..02 | **进实验室**：实验服挂钩、警示条纹门帘拉开；实验台标牌「同名优先级」（关键词：拆优先级） | 门帘 useSpring 拉开；`@spring` |
| 5-B | p5-03..05 | **扫描序漂移**：双屏对照——A 港台账 vs B 港台账，同名两行版本对调并泛红（danger） ·**archify full**：experiment-scan-order 章 `xo-priority`（p5-02）+ `xo-drift`（p5-04）+ `xo-silent`（p5-05） | 双屏 useStagger 同步滚动；漂移行 useImpulse 泛红〔M-003〕停驻终态；`@stagger` `@impulse` |
| 5-C | p5-05a..05c | **遮蔽戏法**：公司菜谱架 vs 私改副本——副本改动行高亮，投影到公司仓时被「项目压个人」盾牌弹开；告警气泡「已被遮蔽」亮起/缺失两种结局 ·**archify full**：shadow-warning 章 `sw-copy`（p5-05a）+ `sw-shadow`（p5-05b）+ `sw-warn`（p5-05c） | 盾牌 useSpring 挡下；气泡 useImpulse；缺告警版本画面静止〔M-002〕；`@spring` `@impulse` |
| 5-D | p5-06..09 | **货签藏私货**：放大镜下货签文本，缩进一行小字「allowed-tools: Bash(rm:*)」渗出墨迹→解析漏斗→元数据卡混入红字字段（danger） ·**archify full**：experiment-label-injection 章 `xi-smuggle`（p5-07）+ `xi-leak`（p5-08）+ `xi-authorize`（p5-09） | 墨迹 useDraw 蔓延；漏斗 useProgress；红字 useImpulse；`@draw` `@progress` `@impulse` |
| 5-E | p5-09a..09b | **false 彩蛋**：键值对卡「enabled: false」→ 管道一圈 → 字符串 "'false'"；客户端检查章「非空=启用」误盖（danger 边）（关键词：只收字符串） ·**archify full**：experiment-label-injection 章 `xi-truthiness`（p5-09b） | 管道 useProgress 传输；印章误盖 useImpulse；`@progress` `@impulse` |
| 5-F | p5-10..11 | **被解释的文本**：指导书页面上文字被工人形象「读」出并照做——代码符号淡出、人话台词浮起（金句位）（关键词：被解释的文本） | 文字→动作转译 useDraw；台词 useSpring 浮起〔M-003〕停驻；`@draw` `@spring` |

## P6 留白处的战争（p6-01..16，镜 6-A..6-F）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01..04 | **摊牌**：三处留白（呼应 1-G）从虚线问号变成金边卷宗；「管得越少，越多人肯用」算法卡 ·**archify full**：governance-layers 章 `gl-three`（p6-02）+ `gl-algo`（p6-04） | 问号→卷宗 useSpring 翻转；算法卡 useDraw；`@spring` `@draw` |
| 6-B | p6-05..06 | **悬案卷宗堆**：分发提案卷宗盖「停摆 7 个月」日期章（2026-03→09）；两份对冲提案背靠背卡死（关键词：停摆 7 个月 / 对冲） ·**archify full**：pending-wars 章 `pw-stall`（p6-05）+ `pw-clash`（p6-06） | 日期章 useImpulse；对冲卡 useSpring 顶牛抖动后僵持；`@impulse` `@spring` |
| 6-C | p6-07 | **互通先落地**：三卷宗中「互操作」卷宗被最先抽走归档（关键词：最先落地） ·**archify full**：pending-wars 章 `pw-interop`（p6-07） | 抽卷 useProgress；`@progress` |
| 6-D | p6-08..08b | **集装箱史押韵**：时间线 1956 卡车→ISO 箱体→…→CSI 海关协作（事故标记）→2026 押韵箭头折向本格式（关键词：1956 / 事故倒逼） ·**archify full**：box-history-rhyme 章 `hr-mclean`（p6-08a）+ `hr-csi`（p6-08b） | 时间线 useDraw 延伸；押韵箭头 useSpring 折转；`@draw` `@spring` |
| 6-E | p6-09..11 | **边界收束**：「先事实后条文」牌；清单卡三行——保证什么/靠什么好用/靠什么可信（关键词：先事实后条文） ·**archify full**：box-history-rhyme 章 `hr-rhyme`（p6-09）+ `gl-verdict`（p6-10） | 三行卡 useStagger 逐行定格〔M-003〕；`@stagger` |
| 6-F | p6-12..16 | **收尾**：金句衬线卡（一个文件夹/一份说明/一行货签）→ 下期卡 → 信源卡渐黑（信源：agentskills.io @69ef37e9 / 本仓 210·211 / 自建实测原型） | 金句卡 useSpring 压入；信源卡 useFadeOut 渐黑（末 beat 分镜标「渐黑」）；`@spring` `@fadeOut` |

## 实现映射

- scenes/P0..P6.tsx ↔ 上表七幕；SCENE_COMPONENTS 注册顺序 P0→P6；chapters.json 由 build 派生（勿手改）。
- archify 资产 19 图（17 新绘 + 2 复用 210 运行相/治理相）：`agent-skills--` 前缀入 `docs/assets/architecture/agent-infra/`；views 章节清单 = 上表各 `章 id`；cue 全部经 `<ArchifyRecap>`（`at('句id')` 锚定、`dur('句id')` 单参取长、背靠背后挂实例 `lead={false}`）。
- 动效 hook 全部走 `src/motion/hooks.ts` frozen 层；装置类（翻牌/账柱/靶纸/双屏/放大镜/时间线）在 `src/components/devices.tsx` 新写；集装箱/台账行母题在 `src/components/motifs.tsx`。
- 字幕规范：单行 ≤26 字（两行 35 字上限内），关键词锚点不整句上屏。
