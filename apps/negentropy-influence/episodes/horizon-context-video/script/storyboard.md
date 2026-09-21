# 分镜：《拆解 Horizon Context：功能、治理、安全与开放性》v3

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`manual` 琥珀金（手册/核准资产）·
> `engine` 青碧（引擎/计算纪律/门禁）· `dig` 淡紫（隐式挖掘/自纠）· `danger` 警示红（错误数字/泄露）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 保持规范对应**；动效列 `@动词` 对应 motion 模型（hooks.ts）。
> **`@动词` 的判据**：当且仅当**本镜 `<Sequence>` 内、由本幕 `scenes/P*.tsx` 自身定义的装置**调用了该 `useXxx(`。
> `check_motion` 只按**幕级**粒度比对（`P4*` 任一处调用即满足全幕），本表按更严的**镜级**维护——装置在镜间搬家或退役时，
> 幕级门会沉默，镜级登记不会。`components/` 内的 hook（`ArchifyClip` 画框弹入 / `devices.tsx` 的 PillarHUD、
> EvidenceBadge、MechZoom、NumberClash / `CodeWalk`）与 `window.ts` 的纯函数 `progress()` **一律不产生 token**
> （门不扫 `components/`，写了门也证实不了——同幕他处恰有同 verb 时还会幕级假通过），但**必须在散文里点名承担者**。
> 括注 `（本镜无动效 hook）` 的准确含义是「本镜内、由本幕 scene 文件定义的装置无 `useXxx(` 调用」，
> **不等于本镜静止**——纯图主控镜正在播 `OffthreadVideo`、画框还带入场弹簧。
> ⚠️ 动效列**禁照搬画面列那套 `archify` + `full`/`inset` 字面标注**：`check_archify_coverage` 的 `ANN_COUNT_RE` 扫全文、
> 而解析数只取画面列，多一处命中即 **FAIL**。同理禁写 `@archify` 之类非动词表标记（会触发「不在词表」WARN）。
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
| 0-A | p0-01..03 | 终端问答：AI 自信吐数打勾 → 勾翻红叉；角标【三】厂商自报基线 ·**archify full**：裸库基线 章 `whole-key`+`blind-wrong`+`baseline-two`| archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；【三】角标淡入在 devices.tsx EvidenceBadge 内（本镜无动效 hook）|
| 0-B | p0-04..06 | **乱码列名墙**：整屏物理列名滚入，一列染 `manual` 金 + 角标 `amt_ttl_pre_dsc` ·**archify full**：双基线证据链 章 `two-benchmarks` ·**archify full**：密文对译 章 `not-model-dumb`+`cipher-wall` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 0-C | p0-07..08 | 净收入文档裂成三张算法卡对撞 → 金句「缺的不是智能，是含义」 ·**archify full**：口径打架 章 `three-dashboards` ·**archify full**：密文对译 章 `letters-not-meaning` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 0-D | p0-09..10 | 片名卡：青碧细线生长 + 主标题                                 | 细线 draw；标题 spring ；`@draw` `@spring`|

## P1 每天重新入职的天才（p1-01..25）

| 镜  | 句区间    | 画面                                                                                             | 动效                                                                 |
| --- | --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1-A | p1-01..07 | **失忆实习生记忆条**：周一至周五五根记忆柱，各自在两句边界之间匀速攒满、到自己的清零句（p1-03..07）3 帧抹平；右侧点题「每天推门上班，记忆全部清零」 ·**archify full**：失忆实习生 章 `daily-reset`+`dark-guess` ·**archify full**：七机制×十次拆坏 章 `three-lesions` | 记忆柱纯 progress 攒满 + 句边界抹平（清零点=句边界，无 use 模型）|
| 1-B | p1-08..15 | **三病灶裂纹**：大厦立面裂三道缝（口径打架 / 定义漂移 / 门禁穿透）·**archify full**：病因链 章 `cause-chain`+`encircle-pierce` ·**archify full**：口径打架 章 `twenty-algorithms`+`owners-clash` ·**archify full**：病因链 章 `cause-chain`+`encircle-pierce` ·**archify full**：外挂词典漂移 章 `dict-outside`+`schema-changed`+`stale-manual` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 1-C | p1-16..21 | 命名帧「Horizon Context」+ 官方三句递进阶梯（英文原句进角标）·**archify full**：病因链 章 `engine-cast`/`answer-ledger`/`downgraded-lane`；背景三阶段演进时间轴 ·**archify full**：病因链 章 `engine-cast`+`answer-ledger`+`downgraded-lane` ·**archify full**：官方三句递进 章 `guess-only`+`native-act`+`governed-trust` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 1-D | p1-22..24 | **带教大厦剖面母图展开**：基座七套受治理安防装备依次弹出 ·**archify full**：组件全景 章 `caliber-spine`+`consumer-feed` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 1-E | p1-25     | 七格承重列 HUD 首次点亮 + 终端角标「lab · selftest ✔」预告代码实景 ·**archify full**：七机制×十次拆坏 章 `ten-teardowns` | HUD 首次出场整体淡入（PillarHUD lit=0 全灭态，淡入在 devices.tsx 内）；主文案静态、由 ArchifyYield 让位 archify 回放（本镜无动效 hook）|

## P2 规章手册：只印一本且当场套算（p2-01..36）

| 镜  | 句区间      | 画面                                                                                                              | 动效                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 2-A | p2-01..04   | **五段式抽屉柜**：琥珀金《规章手册》的五个抽屉（TABLES 核准账本 / RELATIONSHIPS 勾稽路径 / FACTS 原始凭证量 / DIMENSIONS 切片维度 / METRICS 官方指标）逐格亮出 ·**archify full**：三阶段演进 章 `stage-objects` ·**archify full**：声明执行 章 `declare` ·**archify full**：便利贴收拢成手册 章 `first-mechanism`+`scattered-notes` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 2-B | p2-05..08   | **注册校验门**：坏「关系卡」推向门被弹回盖拒收章 ·**代码走廊①** `validate_view` + 终端 `✗ relationship bad` ·**archify full**：声明执行 章 `gate` ·**archify full**：坏定义注册生死簿 章 `strict-gate`+`nonkey-rejected`+`no-runtime-risk` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；【一】角标淡入在 devices.tsx EvidenceBadge 内（本镜无动效 hook）|
| 2-C | p2-09..09b  | **双保险锁**：手册封面两把锁（声明锁 / 计算锁）；拧开计算锁 → 文字一字未改、数字 200 跳 440 变红 ·**archify full**：声明执行 章 `recompute` ·**archify full**：手册是算式不是结论 章 `declare-execute-split` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 2-D | p2-10..13   | 宽表死数字（🧊 冻住的数）vs 只存算式、临机现算（⚙️）：左右静态对照卡，字幕推进为节拍 ·**archify full**：临机现算 章 `frozen-widetable`+`formula-only`+`grain-recompute` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 2-E | p2-14..20   | **复印机陷阱**：$100 订单进复印机 → 三张副本 → 求和器滚 $300 爆红；解法「先聚后联」合体；终端 `440 vs 200` ·**archify full**：复印机陷阱 章 `copy-inflate`+`aggregate-first`+`measured-440` ·**archify full**：事件扇出 章 `hundred-three`+`join-disaster` ·**archify full**：计算纪律四条总纲 章 `agg-before-join` | 副本 stagger 逐张推入；求和 count 100→300 + impulse 爆红；p2-15..20 由 ArchifyYield 让位 archify；【一】角标淡入在 devices.tsx EvidenceBadge 内 ；`@stagger` `@count` `@impulse`|
| 2-F | p2-21..26   | 去重集合圈收束（6 vs 3）·**班级平均分天平**：先除后加 122 幽灵飘散 vs 先聚后除 108 落盘 ·**archify full**：去重安全 章 `set-vs-rows` ·**archify full**：平均的平均 章 `wrong-avg-of-avg`+`measured-122-108` ·**archify full**：计算纪律四条总纲 章 `dedup-count`+`divide-after-agg` | 去重对撞卡由 devices.tsx NumberClash 左右错峰推入；天平 spring 倾斜；122 幽灵 progress 淡隐（非 useDim） ；`@spring` `@progress`|
| 2-G | p2-27..31   | **末快照时间闸**：七格余额「求和」堆叠爆红 24 vs「末快照」只亮 7；买家/推荐人双路径分岔显式声明 ·**archify full**：末快照 章 `semi-additive`+`snapshot-vs-sum` ·**archify full**：关系消歧 章 `two-paths` ·**archify full**：计算纪律四条总纲 章 `semi-additive` | 七根天数条按纯函数 progress 逐根起高（无 use 模型）；24 vs 7 对撞卡在 devices.tsx NumberClash 内（本镜无动效 hook）|
| 2-H | p2-32..36   | 题眼金句卡「语法完全正确，分析可能彻底错误」→ 规章手册徽章落位，HUD 第一柱点亮 ·**archify full**：语法 × 业务 章 `syntax-pass`+`business-fail` ·**archify full**：多入口一个答案 章 `single-point-bind`+`whoever-asks` ·**archify full**：第一道防线按死两病灶 章 `sealed-off` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；第一柱点亮在 devices.tsx PillarHUD 内（本镜无动效 hook）|

## P3 承重墙上的闸机：逐页验放与双层防线（p3-01..26）

| 镜  | 句区间       | 画面                                                                                                          | 动效                                                        |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 3-A | p3-01..04    | **母图推近**至各层电梯厅验放闸 + M2/M3 两块机制名牌 ·**archify full**：行列级策略 章 `perpage` ·**逐页验放扫描仪**正演一次：扫描线横扫、逐行亮「实时核验 · 放行」 ·**archify full**：三阶段演进 章 `stage-governed-enrich` ·**archify full**：查询瞬间逐页验放 章 `instant-inspection` | 推镜匀速与母图辉光在 devices.tsx MechZoom 内；两块机制名牌弹入在 motifs.tsx NumberedCard 内；扫描仪已退役、p3-03/04 转 archify 主控（本镜无动效 hook）|
| 3-B | p3-05..08    | 机密页翻黑打码、越权行整条抽走；**代理识别灯**变色后切更严脱敏口径 ·**archify full**：章 `family`+`agentface` ·**archify full**：行列级策略 章 `family`+`agentface` ·**archify full**：查询瞬间逐页验放 章 `agent-recognized` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 3-C | p3-09..13    | 草坪「请勿踩踏」木牌（小人轻松翻越）vs 焊入承重墙的实体闸机，人/系统/AI 合流过同一执法点 ·**archify full**：语义级治理 章 `sign-vs-wall`+`governed-path` ·**archify full**：三流合一执法点 章 `sign-vs-wall`+`shared-checkpoint` | 木牌 spring 立起 → 被绕过时 shake 一击（decay）+ progress 压暗倾倒；承重墙 spring 长高 ；`@spring` `@shake` `@progress`|
| 3-D | p3-13a..13c  | **两种坏法对照台**：左=规则被拆（人看到明文）/ 右=闸机挪到大堂外（受限口径静默溜出）·**出门行李标签**：策略标签随数据箱出楼 ·**archify full**：治理破坏台 章 `remove-mask`+`wrong-placement` ·**archify full**：开放互操作 章 `portable` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 3-E | p3-14..18    | **双层防线剖面**：前台抽走机密词条（体验层）→ 实习生猜名强行发起 → 承重墙红灯拦下（执行层） ·**archify full**：语义级治理 章 `two-layer-defense` ·**archify full**：猜名强查拦截 章 `guessed-name`+`impenetrable` | 第一层 progress 压暗（只是藏起来）；第二层 impulse 强调脉冲；绕行撞墙与红灯由 archify 回放承担；【一】角标淡入在 devices.tsx EvidenceBadge 内 ；`@progress` `@impulse`|
| 3-F | p3-19..22    | **代码走廊②** `compile_query` RBAC 分支 + 终端 `leak == blocked`；拆闸反事实 `[90, 560]` 泄露卡闪烁 ·**archify full**：治理破坏台 章 `rbac-ablation` ·**archify full**：猜名强查拦截 章 `intercepted` ·**archify full**：藏起来不等于拦得住 章 `teardown-leak`+`hide-not-block` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；【一】角标淡入在 devices.tsx EvidenceBadge 内（本镜无动效 hook）|
| 3-G | p3-23..26    | 编译期安全锁扣合；收束金句「语义层绝不成绕开安全的后门」·**archify full**：语义级治理 章 `绕行仍被拦截`；HUD 第二三柱点亮 ·**archify full**：编译那一秒的拦截 章 `ux-vs-lifeline`+`no-backdoor`+`compile-second` ·**archify full**：语义级治理 章 `bypass-intercepted` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；第二三柱点亮在 devices.tsx PillarHUD 内（本镜无动效 hook）|

## P4 盖章底稿与全楼台账：答对与对账（p4-01..28）

| 镜  | 句区间      | 画面                                                                                                       | 动效                                                          |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 4-A | p4-01..04   | **引用错手册**：手册金色发光完全正确，实习生却翻到错误那一页照算，答案变红；第四大机制徽章压入 ·**archify full**：选错页失效 章 `right-book-wrong-page`+`two-branches` ·**archify full**：自动巡航闭环 章 `inputs` ·**archify full**：落地的两个挑战 章 `challenge-one` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 4-B | p4-05..09   | **盖章底稿 + 对账双栏**：核准题库底稿落「已核准」圆章（verified_by / verified_at），右栏按底稿公式重算三个月对账行逐行亮勾 ·**archify full**：应答验证 章 `hit-reconcile`+`miss-fallback` ·**archify full**：自动巡航闭环 章 `valgate`+`loop` ·**archify full**：核准条目的一生 章 `signed-stamped` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 4-C | p4-09a      | **半堵墙**：验证缺口只砌了下半截，上半截是空的（事后评分不在楼内），镜头在缺口停留| 下半截砖 progress 淡入砌起、上半截恒留虚线空位（本镜无 archify 窗，装置独占） ；`@progress`|
| 4-D | p4-10..14   | **母图推近**至地下机房台账层 + 挑战提问卡 → 数据跨系统流转管网图 → **全息管道台账**落桌翻开，每根水管挂流向标签，末句解析门落下弹回虚构对象 ·**archify full**：血缘台账 章 `engine-lane` ·**archify full**：落地的两个挑战 章 `challenge-two` ·**archify full**：全楼水管台账 章 `fifth-mechanism`+`drop-to-drop`+`not-wastepaper` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 4-E | p4-14a..18  | **入账三道闸**依次亮灯（权限 / 完成态 / 对象可解析），虚构流水第三道被弹回 ·**代码走廊③** `ingest_external_lineage` + 终端 D8；拆闸后虚构边混入闪红 ·**archify full**：血缘台账 章 `ingest-lane` ·**archify full**：虚构流水入账生死 章 `fake-event`+`rejected`+`gate-removed`+`ledger-detached` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；【一】角标淡入在 devices.tsx EvidenceBadge 内（本镜无动效 hook）|
| 4-F | p4-19..24   | **逆流溯源**：🔦 探照灯意象 + 「顺着台账三秒定位源头 / 谁生产、谁清洗、AI 何时引用哪一列」文案卡 ·**archify full**：双柱信任 章 `two-pillars` ·**archify full**：三阶段演进 章 `stage-ecosystem` ·**archify full**：逆流溯源 章 `living-ledger`+`three-seconds` ·**archify full**：信任的事前事中事后 章 `before-during`+`after-audit` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 4-G | p4-25..28   | 答错有拦截 / 答对有底稿 / 有疑问翻账本——信任资产四方印鉴收束；HUD 第四五柱点亮 ·**archify full**：双柱信任 章 `three-seals` ·**archify full**：四因子称重 章 `topk` | 金句卡静态，让位由 ArchifyYield 纯函数 progress 交叉淡化；第四五柱点亮在 devices.tsx PillarHUD 内（本镜无动效 hook）|

## P5 专用工牌与自动贴标：代理风控与敏捷纳管（p5-01..32）

| 镜  | 句区间      | 画面                                                                                                    | 动效                                                        |
| --- | ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 5-A | p5-01..04   | **母图推近**至大门发牌处 + 发牌提问卡 → 万能钥匙被注入抖裂、七道锁逐一弹开 → 实习生挂上动态发光**专用工牌**与两条铁律 ·**archify full**：Agent Identity 章 `ceiling` ·**archify full**：万能钥匙威胁 章 `badge-question`+`master-key` ·**archify full**：权限交集 章 `two-iron-rules` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 5-B | p5-05..08   | **权限交集环**：带教人环 ∩ 代理岗位环收窄成工牌形；「并集」版本被打叉；刷卡审计芯片点亮 ·**archify full**：章 `audit` ·**archify full**：Agent Identity 章 `audit` | 双环 spring 入场 → progress 收窄成工牌透镜（decelerate，铺满 p5-06 整句）→ 机密文案 progress 点亮 + impulse 弹一下 + breathe 常驻辉光 ；`@spring` `@progress` `@impulse` `@breathe`|
| 5-C | p5-08a      | 回指 P3 的代理识别灯：前面闸机认出的代理，认的就是这张工牌 ·**archify full**：章 `strict` ·**archify full**：Agent Identity 章 `strict` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 5-D | p5-09..15   | **双钟对照**：左「快照式工牌」钟（危险色）⛔ 停在会话开始、回收后翻 🕐 仍持权；右「实时天花板」钟（绿色）🕐 持续求值、回收后翻 ⛔ 刷卡即拒；中间「越权窗口」阴影区随 p5-13 张开 ·**代码走廊④** 天花板实时求值 + 终端 D9 ·**archify full**：Agent Identity 章 `snapshot-vs-live` ·**archify full**：权限回收的两种命运 章 `realtime-ceiling`+`static-snapshot`+`ten-minutes` ·**archify full**：零越权窗口时序 章 `experiment-risk`+`dynamic-intersect`+`zero-window` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；【一】角标淡入在 devices.tsx EvidenceBadge 内（本镜无动效 hook）|
| 5-E | p5-16..20   | **母图推近**至装卸货码头贴标层 + 进楼考验双条对比（涌入 vs 人工登记，差额即未纳管缺口）→ **贴标流水线**：新文件循环滑过扫描探针，**淡紫**密级标签（按文案区分密级）精准贴上，联动承重墙闸机 ·**archify full**：纳管缺口 章 `tag-driven` ·**archify full**：贴标即联动闸机 章 `intake-test`+`seventh-mechanism`+`auto-linkage` ·**archify full**：纳管洪峰 章 `flood-vs-manual` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 5-F | p5-21..25   | **断链最后一环**：发现→标记→执行 第三环断开，手机号明文从断口滑出大楼 ·**代码走廊⑤** 标签映射 + 终端 D10；补齐映射后绿线接通 ·**archify full**：章 `honest-limit`+`未映射显式缺口` ·**archify full**：开放互操作 章 `feedback` ·**archify full**：纳管缺口 章 `honest-limit`+`explicit-gap` | 三环 stagger 逐块亮出（第三环 danger 断口）；明文出楼行 progress 浮出；代码走廊与终端行在 CodeWalk 内逐行 ；`@stagger` `@progress`|
| 5-G | p5-26..30   | 七格承重列 HUD 全亮合拢 ·**听证会空白卡**：两个同名定义对峙、数字栏刻意留白等人裁决；对照组按热度自动选让错误口径胜出染红 ·**archify full**：汇聚富化激活 ·**archify full**：组件全景 章 `reserved-supply` ·**archify full**：多数派近道 章 `popularity-wins` ·**archify full**：汇聚富化激活 章 `activate`+`enrich` ·**archify full**：语义打架开听证会 章 `open-hearing` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；七柱全亮由镜外常驻 PillarHUD 按纯函数 progress 逐格起高（devices.tsx）（本镜无动效 hook）|
| 5-H | p5-31..32   | 前台**四因子称重天平** + 标准 MCP 插头接入大厦；体系运转全景 ·**archify full**：四因子排序 + 开放互操作 ·**archify full**：开放互操作 章 `socket` ·**archify full**：四因子称重 章 `factors` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；HUD 承 5-G 镜外常驻实例不重挂（本镜无动效 hook）|

## P6 它没证明什么：理性收口与批判性边界（p6-01..24）

| 镜  | 句区间      | 画面                                                                                                  | 动效                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 6-A | p6-01..06   | **五道警示栅栏**升起，第一道压暗：厂商自报八成六 vs 独立复测两成出头（角标【三】/【二】） ·**archify full**：证据分级 章 `vendor-claim`+`not-industry-norm`| 五条栅栏 stagger 逐条立起（第一条转实线红、其余虚线半暗，为样式分支非 useDim）；【三】角标淡入在 devices.tsx EvidenceBadge 内；p6-05/06 由 ArchifyYield 让位 archify ；`@stagger`|
| 6-B | p6-07..09   | 第二道压暗（预览期落地鸿沟）+ 第三道压暗（安全周界限于楼内，数据出楼治理失效） ·**archify full**：落地鸿沟 章 `preview-band` ·**archify full**：安全周界 章 `inside-effective`+`outside-void`| archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 6-C | p6-10..16   | **地基塌方剖面**（与母图同一张）：楼上图纸金色合法、七柱全亮，地基已塌陷；**477 vs 48** 对撞裂开；第四道高亮 ·**archify full**：上游塌方 章 `day-pack-collapse`+`legal-but-wrong`+`measured-477-48` ·**archify full**：治理合法≠计算正确 章 `fourth-boundary`+`third-party-critique`+`upstream-collapse` ·**archify full**：图纸合法救不了塌方地基 章 `blueprint-vs-foundation` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担；【四】角标淡入在 devices.tsx EvidenceBadge 内（本镜无动效 hook）|
| 6-D | p6-17       | 第五道压暗：五道警示栅栏整队立起（均已压暗态），第五道「多数人踩出来的近道依然可能是错的——习惯不等于真理」| 栅栏 stagger 立起 ；`@stagger`|
| 6-E | p6-19..22   | **租来的聪明**：机器人（🤖）头顶光环，一根电源线 draw 出悬空连出（p6-21）；拔线（p6-22）→ 光环/电源线熄灭，题眼金句上屏（p6-20） ·**archify full**：四因子称重 章 `signals` ·**archify full**：归因天平 章 `not-the-brain`+`cast-into-infra` ·**archify full**：租来的聪明 章 `rented-to-owned` | archify 全屏回放主控：章内拍脉冲 + 换章弹入由 ArchifyClip 承担（本镜无动效 hook）|
| 6-F | p6-23..24   | 下期钩子（上下文层蓝图展开）+ 信源卡（pinned commit / 笔记 / 原型代码 / **67 张 archify 工程图拼版背景**）+ 全屏平缓**渐黑** ·**archify full**：下期蓝图 章 `self-build` | 信源卡四行 stagger 浮现；全镜 fadeOut 渐黑（末 90 帧，窗取整镜时长）；下期蓝图由 archify 回放承担 ；`@stagger` `@fadeOut`|
