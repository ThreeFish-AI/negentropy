# 分镜：《拆解 Horizon Context：功能、治理、安全与开放性》v3

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`manual` 琥珀金（手册/核准资产）·
> `engine` 青碧（引擎/计算纪律/门禁）· `dig` 淡紫（隐式挖掘/自纠）· `danger` 警示红（错误数字/泄露）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 保持规范对应**；动效列 `@动词` 对应 motion 模型（hooks.ts）。
>
> **v3 母题（三层视觉语法）**：
> ① **母图层** —— 受治理带教大厦纵剖面 + 七格承重列 HUD（常驻角落，讲完一个机制点亮一根柱子）；
> ② **装置层** —— 24 个可被拆坏的机械装置，每个**演三遍：正演一次、拆一次、坏给你看**；
> ③ **证据层** —— 代码走廊（CodeWalk + TerminalLog 滚真实 selftest 输出）、**archify 工程图逐章回放**
>    （`ArchifyRecap`，一章锚一句）、四级证据角标（【一】原型实测 /【二】官方机制 /【三】厂商自报 /【四】第三方复现）。
>
> ⚠️ **非 beat 用途禁写 `w('句id')` 字面形态**：`check_script` 的 `SCENE_CALL_RE` 只认字面量，
> 写字面量会把「取某句时长给 cue 定长」的镜内叠加层登记成镜区间，恒定刷出几十条
> 「未在分镜表中登记」。各 scene 里用与 `at` 对称的 `dur('句id')` 辅助函数取长即可绕开
> （2026-09-19 实测 WARN 28 → 0）。判定基线因此收紧为：**FAIL 0 + WARN 0**，出现任何 WARN 都是真漂移。
>
> archify 档位：**full** = 整屏主控回放（v4 全屏独占——archify 播放期不与自制装置同屏，装置由 ArchifyYield 按 cue 窗淡出让位或挪窗外子窗；inset 画中画档已退役，覆盖门 forbid_inset 锁死）。章节 id 见
> [../video/public/archify/views/](../video/public/archify/views/)，每章时长 = 拍数 × max(1100ms, 3200ms/拍数)。

## P0 钥匙给了，还是答错（p0-01..10）

| 镜  | 句区间    | 画面                                                          | 动效                                                      |
| --- | --------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| 0-A | p0-01..03 | 终端问答：AI 自信吐数打勾 → 勾翻红叉；角标【三】厂商自报基线 ·**archify full**：裸库基线 章 `whole-key`+`blind-wrong`+`baseline-two`| 打字机逐字；勾 impulse 爆红 ；`@reveal` `@impulse`|
| 0-B | p0-04..06 | **乱码列名墙**：整屏物理列名滚入，一列染 `manual` 金 + 角标 `amt_ttl_pre_dsc` | 墙 progress 刷入；金列 spring 高亮 ；`@progress` `@spring`|
| 0-C | p0-07..08 | 净收入文档裂成三张算法卡对撞 → 金句「缺的不是智能，是含义」 ·**archify full**：口径打架 章 `three-dashboards`| 三卡 stagger 分裂；对撞 impulse ；`@stagger` `@impulse`|
| 0-D | p0-09..10 | 片名卡：青碧细线生长 + 主标题                                 | 细线 draw；标题 spring ；`@draw` `@spring`|

## P1 每天重新入职的天才（p1-01..25）

| 镜  | 句区间    | 画面                                                                                             | 动效                                                                 |
| --- | --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1-A | p1-01..07 | **失忆实习生记忆条**：周一至周五五根记忆柱，各自在两句边界之间匀速攒满、到自己的清零句（p1-03..07）3 帧抹平；右侧点题「每天推门上班，记忆全部清零」 ·**archify full**：失忆实习生 章 `daily-reset`+`dark-guess`| 记忆柱纯 progress 攒满 + 句边界抹平（清零点=句边界，无 use 模型）|
| 1-B | p1-08..15 | **三病灶裂纹**：大厦立面裂三道缝（口径打架 / 定义漂移 / 门禁穿透）·**archify full**：病因链 章 `cause-chain`+`encircle-pierce` ·**archify full**：口径打架 章 `twenty-algorithms`+`owners-clash`| 裂缝 draw 扩张；小人 travel 越墙 ；`@stagger`|
| 1-C | p1-16..21 | 命名帧「Horizon Context」+ 官方三句递进阶梯（英文原句进角标）·**archify full**：病因链 章 `engine-cast`/`answer-ledger`/`downgraded-lane`；背景三阶段演进时间轴 | 三卡阶梯 stagger；「可信」级 breathe 辉光 ；`@stagger`|
| 1-D | p1-22..24 | **带教大厦剖面母图展开**：基座七套受治理安防装备依次弹出 ·**archify full**：组件全景 章 `口径主线`+`消费端五路汇入` | 合页 draw 展开；七格 stagger 弹出 ；`@stagger`|
| 1-E | p1-25     | 七格承重列 HUD 首次点亮 + 终端角标「lab · selftest ✔」预告代码实景                                | HUD 逐格 progress；角标 impulse 一闪 ；`@stagger`|

## P2 规章手册：只印一本且当场套算（p2-01..36）

| 镜  | 句区间      | 画面                                                                                                              | 动效                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 2-A | p2-01..04   | **五段式抽屉柜**：琥珀金《规章手册》的五个抽屉（TABLES 核准账本 / RELATIONSHIPS 勾稽路径 / FACTS 原始凭证量 / DIMENSIONS 切片维度 / METRICS 官方指标）逐格亮出 ·**archify full**：三阶段演进 章 `stage-objects` ·**archify full**：声明执行 章 `declare` | 抽屉 stagger 逐格入位 ；`@stagger`|
| 2-B | p2-05..08   | **注册校验门**：坏「关系卡」推向门被弹回盖拒收章 ·**代码走廊①** `validate_view` + 终端 `✗ relationship bad` ·**archify full**：声明执行 章 `gate` | 卡片 travel 撞门弹回；报错行 impulse 红光 ；`@impulse`|
| 2-C | p2-09..09b  | **双保险锁**：手册封面两把锁（声明锁 / 计算锁）；拧开计算锁 → 文字一字未改、数字 200 跳 440 变红 ·**archify full**：声明执行 章 `recompute` | 锁 spring 拧开；数字 count 跳变 ；`@spring` `@count`|
| 2-D | p2-10..13   | 宽表死数字（🧊 冻住的数）vs 只存算式、临机现算（⚙️）：左右静态对照卡，字幕推进为节拍 | 静态对照（本镜无动效 hook）|
| 2-E | p2-14..20   | **复印机陷阱**：$100 订单进复印机 → 三张副本 → 求和器滚 $300 爆红；解法「先聚后联」合体；终端 `440 vs 200` ·**archify full**：复印机陷阱 章 `copy-inflate`+`aggregate-first`+`measured-440`| 副本 stagger 弹出；计数 count 爆红 ；`@stagger` `@count`|
| 2-F | p2-21..26   | 去重集合圈收束（6 vs 3）·**班级平均分天平**：先除后加 122 幽灵飘散 vs 先聚后除 108 落盘 ·**archify full**：去重安全 章 `set-vs-rows` ·**archify full**：平均的平均 章 `wrong-avg-of-avg`+`measured-122-108`| 集合圈 count；幽灵 dim 飘散 ；`@count` `@progress`|
| 2-G | p2-27..31   | **末快照时间闸**：七格余额「求和」堆叠爆红 24 vs「末快照」只亮 7；买家/推荐人双路径分岔显式声明 ·**archify full**：末快照 章 `semi-additive`+`snapshot-vs-sum` ·**archify full**：关系消歧 章 `two-paths`| 时间轴 draw；末点 breathe 脉冲 ；`@spring`|
| 2-H | p2-32..36   | 题眼金句卡「语法完全正确，分析可能彻底错误」→ 规章手册徽章落位，HUD 第一柱点亮 ·**archify full**：语法 × 业务 章 `syntax-pass`+`business-fail`| 金句 progress 淡入 + impulse ；`@progress` `@impulse` `@spring`|

## P3 承重墙上的闸机：逐页验放与双层防线（p3-01..26）

| 镜  | 句区间       | 画面                                                                                                          | 动效                                                        |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 3-A | p3-01..04    | **母图推近**至各层电梯厅验放闸 + M2/M3 两块机制名牌 ·**archify full**：行列级策略 章 `perpage` ·**逐页验放扫描仪**正演一次：扫描线横扫、逐行亮「实时核验 · 放行」 ·**archify full**：三阶段演进 章 `stage-governed-enrich` | 推镜 progress 匀速；名牌 spring 落位；扫描线 progress 横扫 ；`@progress` `@spring`|
| 3-B | p3-05..08    | 机密页翻黑打码、越权行整条抽走；**代理识别灯**变色后切更严脱敏口径 ·**archify full**：章 `family`+`agentface` | 敏感格 stagger 翻黑；识别灯 breathe ；`@progress` `@spring`|
| 3-C | p3-09..13    | 草坪「请勿踩踏」木牌（小人轻松翻越）vs 焊入承重墙的实体闸机，人/系统/AI 合流过同一执法点 ·**archify full**：语义级治理 章 `sign-vs-wall`+`治理主路径` | 木牌 shake 倒下；承重墙 draw 升起 ；`@shake`|
| 3-D | p3-13a..13c  | **两种坏法对照台**：左=规则被拆（人看到明文）/ 右=闸机挪到大堂外（受限口径静默溜出）·**出门行李标签**：策略标签随数据箱出楼 ·**archify full**：治理破坏台 章 `remove-mask`+`wrong-placement` ·**archify full**：开放互操作 章 `portable` | 左右分屏 dim 对照；行李标签 travel 随行 ；`@progress` `@spring`|
| 3-E | p3-14..18    | **双层防线剖面**：前台抽走机密词条（体验层）→ 实习生猜名强行发起 → 承重墙红灯拦下（执行层） ·**archify full**：语义级治理 章 `two-layer-defense`                     | 滤卡 dim 抽走；绕行 travel 撞墙；红灯 impulse ；`@impulse`|
| 3-F | p3-19..22    | **代码走廊②** `compile_query` RBAC 分支 + 终端 `leak == blocked`；拆闸反事实 `[90, 560]` 泄露卡闪烁 ·**archify full**：治理破坏台 章 `rbac-ablation`| 代码 progress 高亮；泄露卡 shake 闪烁 ；`@progress` `@shake`|
| 3-G | p3-23..26    | 编译期安全锁扣合；收束金句「语义层绝不成绕开安全的后门」·**archify full**：语义级治理 章 `绕行仍被拦截`；HUD 第二三柱点亮 | 锁扣 spring；金句 enter 升起 ；`@spring`|

## P4 盖章底稿与全楼台账：答对与对账（p4-01..28）

| 镜  | 句区间      | 画面                                                                                                       | 动效                                                          |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 4-A | p4-01..04   | **引用错手册**：手册金色发光完全正确，实习生却翻到错误那一页照算，答案变红；第四大机制徽章压入 ·**archify full**：选错页失效 章 `right-book-wrong-page`+`two-branches` ·**archify full**：自动巡航闭环 章 `inputs` | 翻页 travel；错页 shake；徽章 spring ；`@shake` `@spring`|
| 4-B | p4-05..09   | **盖章底稿 + 对账双栏**：核准题库底稿落「已核准」圆章（verified_by / verified_at），右栏按底稿公式重算三个月对账行逐行亮勾 ·**archify full**：应答验证 章 `命中与对账`+`未命中回退` ·**archify full**：自动巡航闭环 章 `valgate`+`loop` | 公章 spring 盖印；对账行 stagger 逐行亮出 ；`@spring` `@stagger`|
| 4-C | p4-09a      | **半堵墙**：验证缺口只砌了下半截，上半截是空的（事后评分不在楼内），镜头在缺口停留| 墙体 draw 砌到一半即止 ；`@progress` `@spring`|
| 4-D | p4-10..14   | **母图推近**至地下机房台账层 + 挑战提问卡 → 数据跨系统流转管网图 → **全息管道台账**落桌翻开，每根水管挂流向标签，末句解析门落下弹回虚构对象 ·**archify full**：血缘台账 章 `引擎执行` | 推镜 progress；管网 flowDash 流动；台账 spring 翻开；虚构对象 shake 弹回 ；`@spring` `@flowDash` `@shake`|
| 4-E | p4-14a..18  | **入账三道闸**依次亮灯（权限 / 完成态 / 对象可解析），虚构流水第三道被弹回 ·**代码走廊③** `ingest_external_lineage` + 终端 D8；拆闸后虚构边混入闪红 ·**archify full**：血缘台账 章 `外部摄取` | 三闸 stagger 亮灯；虚构边 shake ；`@stagger` `@shake` `@progress`|
| 4-F | p4-19..24   | **逆流溯源**：🔦 探照灯意象 + 「顺着台账三秒定位源头 / 谁生产、谁清洗、AI 何时引用哪一列」文案卡 ·**archify full**：血缘台账 章 `账本与盲区` ·**archify full**：双柱信任 章 `two-pillars` ·**archify full**：三阶段演进 章 `stage-ecosystem` | 静态意象卡（本镜无动效 hook）|
| 4-G | p4-25..28   | 答错有拦截 / 答对有底稿 / 有疑问翻账本——信任资产四方印鉴收束；HUD 第四五柱点亮 ·**archify full**：双柱信任 章 `three-seals` ·**archify full**：四因子称重 章 `topk` | 印鉴 spring 盖定；剖面 breathe 辉光 ；`@spring`|

## P5 专用工牌与自动贴标：代理风控与敏捷纳管（p5-01..32）

| 镜  | 句区间      | 画面                                                                                                    | 动效                                                        |
| --- | ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 5-A | p5-01..04   | **母图推近**至大门发牌处 + 发牌提问卡 → 万能钥匙被注入抖裂、七道锁逐一弹开 → 实习生挂上动态发光**专用工牌**与两条铁律 ·**archify full**：Agent Identity 章 `ceiling` ·**archify full**：万能钥匙威胁 章 `badge-question`+`master-key`| 推镜 progress；钥匙 shake 碎裂（decay）；七锁 stagger 铺满整句；工牌 spring 挂落 + breathe 光环 ；`@spring` `@shake` `@stagger` `@draw`|
| 5-B | p5-05..08   | **权限交集环**：带教人环 ∩ 代理岗位环收窄成工牌形；「并集」版本被打叉；刷卡审计芯片点亮 ·**archify full**：章 `audit` | 交集 count 收窄；芯片 breathe ；`@progress` `@spring`|
| 5-C | p5-08a      | 回指 P3 的代理识别灯：前面闸机认出的代理，认的就是这张工牌 ·**archify full**：章 `strict`               | 指示灯 impulse 回指 ；`@progress` `@spring`|
| 5-D | p5-09..15   | **双钟对照**：左「快照式工牌」钟（危险色）⛔ 停在会话开始、回收后翻 🕐 仍持权；右「实时天花板」钟（绿色）🕐 持续求值、回收后翻 ⛔ 刷卡即拒；中间「越权窗口」阴影区随 p5-13 张开 ·**代码走廊④** 天花板实时求值 + 终端 D9 ·**archify full**：Agent Identity 章 `snapshot-vs-live` | 阴影区 progress 张开；两钟状态翻色 ；`@progress`|
| 5-E | p5-16..20   | **母图推近**至装卸货码头贴标层 + 进楼考验双条对比（涌入 vs 人工登记，差额即未纳管缺口）→ **贴标流水线**：新文件循环滑过扫描探针，**淡紫**密级标签（按文案区分密级）精准贴上，联动承重墙闸机 ·**archify full**：分类贴标 章 `分类到自动纳管` ·**archify full**：纳管缺口 章 `flood-vs-manual`| 推镜 progress；文件 flowDash 滑行；探针 breathe；标签 spring 贴合；联动 draw 接通 ；`@spring` `@flowDash` `@draw` `@breathe`|
| 5-F | p5-21..25   | **断链最后一环**：发现→标记→执行 第三环断开，手机号明文从断口滑出大楼 ·**代码走廊⑤** 标签映射 + 终端 D10；补齐映射后绿线接通 ·**archify full**：章 `honest-limit`+`未映射显式缺口` ·**archify full**：开放互操作 章 `feedback` | 断口 shake；绿线 draw 接通 ；`@progress`|
| 5-G | p5-26..30   | 七格承重列 HUD 全亮合拢 ·**听证会空白卡**：两个同名定义对峙、数字栏刻意留白等人裁决；对照组按热度自动选让错误口径胜出染红 ·**archify full**：汇聚富化激活 ·**archify full**：组件全景 章 `reserved-supply` ·**archify full**：多数派近道 章 `popularity-wins` ·**archify full**：汇聚富化激活 章 `activate`+`enrich`| 七柱 stagger 合拢；对峙卡 travel 对撞 ；`@stagger`|
| 5-H | p5-31..32   | 前台**四因子称重天平** + 标准 MCP 插头接入大厦；体系运转全景 ·**archify full**：四因子排序 + 开放互操作 ·**archify full**：四因子排序 章 `factors` ·**archify full**：开放互操作 章 `socket`| 砝码 stagger 落盘；插头 travel 插入 ；`@stagger`|

## P6 它没证明什么：理性收口与批判性边界（p6-01..24）

| 镜  | 句区间      | 画面                                                                                                  | 动效                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 6-A | p6-01..06   | **五道警示栅栏**升起，第一道压暗：厂商自报八成六 vs 独立复测两成出头（角标【三】/【二】） ·**archify full**：证据分级 章 `vendor-claim`+`not-industry-norm`| 栅栏 spring 升起；第一道 dim 压暗 ；`@progress` `@stagger`|
| 6-B | p6-07..09   | 第二道压暗（预览期落地鸿沟）+ 第三道压暗（安全周界限于楼内，数据出楼治理失效） ·**archify full**：落地鸿沟 章 `preview-band` ·**archify full**：安全周界 章 `inside-effective`+`outside-void`| 栅栏逐条 dim；外流雾区 breathe ；`@progress` `@stagger`|
| 6-C | p6-10..16   | **地基塌方剖面**（与母图同一张）：楼上图纸金色合法、七柱全亮，地基已塌陷；**477 vs 48** 对撞裂开；第四道高亮 ·**archify full**：上游塌方 章 `day-pack-collapse`+`legal-but-wrong`+`measured-477-48`| 地基 shake 塌陷；数字 travel 对撞；第四道 impulse ；`@progress` `@stagger`|
| 6-D | p6-17       | 第五道压暗：五道警示栅栏整队立起（均已压暗态），第五道「多数人踩出来的近道依然可能是错的——习惯不等于真理」| 栅栏 stagger 立起 ；`@stagger`|
| 6-E | p6-19..22   | **租来的聪明**：机器人（🤖）头顶光环，一根电源线 draw 出悬空连出（p6-21）；拔线（p6-22）→ 光环/电源线熄灭，题眼金句上屏（p6-20） ·**archify full**：四因子称重 章 `signals` | 电源线 draw；光环 dim 熄灭 ；`@draw` `@progress`|
| 6-F | p6-23..24   | 下期钩子（上下文层蓝图展开）+ 信源卡（pinned commit / 笔记 / 原型代码 / **33 张 archify 工程图拼版背景**）+ 全屏平缓**渐黑** | 蓝图 draw 铺开；信源卡 enter 升起；全屏 fadeOut ；`@draw` `@fadeOut`|
