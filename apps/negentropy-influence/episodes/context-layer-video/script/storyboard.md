# 分镜：《自己动手，给 AI 搭一个上下文层》v3

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`blueprint` 工程蓝（蓝图与五层结构）·
> `grown` 苔绿（生命周期 / 自纠 / 双轨）· `activate` 暖橙（激活 / 接口 / 题库）· `danger` 警示红（错数 / 泄露 / 冲突）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 保持规范对应**；动效列 `@动词` 对应 motion 模型（hooks.ts）。
> **`@动词` 的判据**：当且仅当**本镜 `<Sequence>` 内、由本幕 `scenes/P*.tsx` 自身定义的装置**调用了该 `useXxx(`。
> `check_motion` 只按**幕级**粒度比对，本表按更严的**镜级**维护。`components/` 内的 hook（`ArchifyClip` 画框弹入 /
> `ArchifyYield` 让位 / `devices.tsx` 的 PillarHUD、EvidenceBadge、NumberClash / `CodeWalk`）与 `window.ts` 纯函数
> `progress()` **一律不产生 token**，但**必须在散文里点名承担者**。括注 `（本镜无动效 hook）` ≠ 本镜静止——
> 纯图主控镜正在播回放、画框还带入场弹簧。
> ⚠️ 动效列**禁照搬画面列那套标注字面**：`check_archify_coverage` 的 `ANN_COUNT_RE` 扫全文、解析数只取画面列，
> 多一处命中即 **FAIL**。同理禁写非动词表标记。
> ⚠️ **非 beat 用途禁写 `w('句id')` 字面形态****：scene 里用与 `at` 对称的 `dur('句id')` 取长。判定基线 **FAIL 0 + WARN 0**。
>
> **v3 母题（三层视觉语法）**：
> ① **母图层** —— 受治理大厦五层剖面 + 五格承重柱 HUD（常驻左下，讲完一层点亮一柱：手册/总账/编纂/风控/前台）；
> ② **装置层** —— 可拆坏的机械装置（复印机 / 末快照闸 / CONFLICT 空白卡 / 闸机 / 承重墙 / 贴标流水线 / 权限交集环 / 盖章底稿 / 十格仪表盘）；
> ③ **证据层** —— 代码走廊（CodeWalk + TerminalLog 滚真实 selftest 输出，D1–D10/T 系列原文）、工程图逐章回放（`ArchifyRecap`，
> 一章锚一句）、四级证据角标（EvidenceBadge）。
>
> 章节清单见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长 = 拍数 × max(1100ms, 3200ms/拍数)。

## P0 两答案事故（p0-01..24）

| 镜  | 句区间    | 画面                                                          | 动效                                                      |
| --- | --------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| 0-A | p0-01..05 | **会议室双屏对撞**：销售屏一千四百二十万 vs 财务屏一千两百八十万，中缝红色裂痕迸开；角标 `$14.2M vs $12.8M` | 对撞卡由 devices.tsx NumberClash 左右错峰推入；裂痕静态叠层（本镜无动效 hook）|
| 0-B | p0-06..09 | **双基线大数字**：百分之二十五 / 百分之二十一两块数字卡 + 官方归属行；角标【三】厂商自报基线 | 数字滚动由 useCount 承担；EvidenceBadge 淡入在 devices.tsx 内 ；`@count`|
| 0-C | p0-10..14 | **天才实习生**：入职日历哗哗撕碎散落 + 头顶记忆条攒满即清零；末句整屏物理列名乱码墙滚入（一列染 `blueprint`，角标 `amt_ttl_pre_dsc`）| 日历碎片 useStagger 散落；记忆条 useProgress 攒满 + useImpulse 抹平；乱码墙 useStagger 滚入 ；`@stagger` `@progress` `@impulse`|
| 0-D | p0-15..21 | **官方判词三段阶梯**（英文原句进角标）→ 大厦立面裂三道缝（口径打架 / 定义漂移 / 门禁穿透，danger）| 阶梯 useSpring 逐级升起；裂纹 useDraw 生长 ；`@spring` `@draw`|
| 0-E | p0-22..24 | 定名卡「上下文层」→ 深蓝蓝图铺开 ·**archify full**：architecture 章 `overview`+`activate`（p0-24 终极入职包句锚激活层收束） | 回放主控由 ArchifyClip 承担；HUD 全灭态首次淡入（devices.tsx PillarHUD）；定名卡让位由 ArchifyYield 纯函数交叉淡化（本镜无动效 hook）|

## P1 大厦与五层（p1-01..26）

| 镜  | 句区间    | 画面                                                                                             | 动效                                                                 |
| --- | --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1-A | p1-01..07 | **术语家谱时间轴**：九十年代语义层 → 幻灭墓碑 → 2026 定名/官方样板/Gartner 三连星 | 主线 useDraw 生长；节点 useStagger 弹出；墓碑压暗 useDim ；`@draw` `@stagger` `@dim`|
| 1-B | p1-08..10 | **三种口径三卡**（全家桶 / 独立一层 / 必须可执行）+ 自嘲金句卡「每家都长成它在卖的产品」 | 三卡 useStagger 错峰；金句卡静态 ；`@stagger`|
| 1-C | p1-11..14 | 四路线入场 ·**archify full**：industry-landscape 章 `embedded`+`code` | 回放主控由 ArchifyClip 承担；安检类比字幕推进为节拍（本镜无动效 hook）|
| 1-D | p1-15..17 | 异类与落位 ·**archify full**：industry-landscape 章 `palantir`+`independent`+`bp` | 回放主控由 ArchifyClip 承担（本镜无动效 hook）|
| 1-E | p1-18..19 | **理由双卡**（不绑引擎 / 治理前移）+ Gartner 六成失败预测数字卡（角标 2028）| 双卡 useSpring；数字 useCount ；`@spring` `@count`|
| 1-F | p1-20..24 | **五层逐层点亮** ·**archify full**：architecture 章 `store`+`catalog`+`gate`（p1-20 口诀句由装置文字承担；explicit/implicit/eval 留 P3 双轨镜；activate 已在 0-E 锚定） | 回放主控由 ArchifyClip 承担；HUD 逐柱同步点亮（devices.tsx PillarHUD 纯函数）（本镜无动效 hook）|
| 1-G | p1-25..26 | **正交接件台**：换掉索引总账模块、风控承重墙不动 ·**archify full**：layer-mechanism-map 章 `obj` | 接件台交换动画 useProgress 后让位回放；施工地图定格收幕 ；`@progress`|

## P2 规章手册（p2-01..28）

| 镜  | 句区间      | 画面                                                                                                              | 动效                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 2-A | p2-01..05   | **规章手册**：厚册子翻开五段式章节（TABLES/RELATIONSHIPS/FACTS/DIMENSIONS/METRICS 角标）；翻到哪条当场套算 ·**archify full**：collect-phase 章 `semview` | 手册翻页 useSpring；套算数字 useCount 后让位回放 ；`@spring` `@count`|
| 2-B | p2-06..08   | **双失效面**：手册封面两把锁（声明锁 / 计算锁）；先祖三厂商卡（Looker / dbt MetricFlow / Cube，角标）| 双锁 useDraw 锁合；三卡 useStagger ；`@draw` `@stagger`|
| 2-C | p2-09..13   | **复印机陷阱**：一百美元进复印机 → 三张副本推出 → 求和器滚到三百爆红；**代码走廊①** lab D1 终端 `Jan 440（对照 200）` | 副本 useStagger 逐张推入；金额 useCount + useImpulse 爆红；终端行 CodeWalk ；`@stagger` `@count` `@impulse`|
| 2-D | p2-14..17   | **末快照时间闸**：七格余额条「求和」堆叠爆红 vs「末快照」只亮期末一格；**代码走廊②** lab D3 终端 `[11,6,7] vs [5,6,7]` | 天数条 useProgress 逐根起高；对撞数值 devices.tsx NumberClash；终端行 CodeWalk ；`@progress`|
| 2-E | p2-18..23   | 金句卡「语法全对，业务答案全错」→ **三条字段纪律三卡**（门牌 / 说明书随定义走 / 签名溯源）；**代码走廊③** lab D6 终端 `✗ relationship bad` | 金句卡静态；三卡 useStagger；终端行 CodeWalk ；`@stagger`|
| 2-F | p2-24..28   | **词条一生轨道** ·**archify full**：object-lifecycle 章 `full`；Ossie 护照角标（p2-25）；**代码走廊④** 注册表 422 拒收（p2-26）；HUD 第 1 柱点亮（p2-27）| 回放主控由 ArchifyClip 承担；HUD 点亮在 devices.tsx（本镜无动效 hook）|

## P3 总账与双轨（p3-01..26）

| 镜  | 句区间       | 画面                                                                                                          | 动效                                                        |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 3-A | p3-01..07    | **机房出入库台账** ·**archify full**：collect-phase 章 `collect`+`open`（catalog 已在 1-F 锚定）；p3-07 **代码走廊⑤** lab D8 终端输出 ghost 入账行 | 回放主控由 ArchifyClip 承担；终端行 CodeWalk（本镜无动效 hook）|
| 3-B | p3-08..11    | **导览图 vs 复制库房**：左=全楼导览图（指针指回原处），右=楼外复制库房盖起即脑裂（danger 虚线撕开）；四层信号四旗（结构/运行/语义/行为）| 对比台 useProgress 交叉高亮；四旗 useStagger ；`@progress` `@stagger`|
| 3-C | p3-12..18    | **双轨两角色**：速记秘书（袖珍打印机）与见习助教（望远镜）登场 ·**archify full**：collect-phase 章 `enrich`+architecture 章 `explicit`+`implicit`+`eval`；小于百分之五覆盖数字卡（角标 9,685 表）| 角色卡 useSpring 入场；数字 useCount；中段让位回放（ArchifyYield）；`@spring` `@count`|
| 3-D | p3-19..24    | **冲突听证**：CONFLICT 卡片两个同名定义对峙、数字栏刻意留白（danger 边框）·**archify full**：object-lifecycle 章 `conflict`；**代码走廊⑥** lab D4 终端输出 auto_popularity 改动行 [6,1,2] | 空白卡 useReveal 揭示；对峙卡 useShake 一击；终端行 CodeWalk ；`@reveal` `@shake`|
| 3-E | p3-25..26    | 口诀卡「台账记流水，双轨养含义，冲突人裁决」+ HUD 第 2/3 柱点亮 | 口诀卡静态；HUD 点亮在 devices.tsx（本镜无动效 hook）|

## P4 风控四机构（p4-01..28）

| 镜  | 句区间       | 画面                                                                                                          | 动效                                                        |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 4-A | p4-01..03    | **四机构名牌矩阵**：闸机 / 承重墙 / 贴标 / 工牌四块铜牌 + 各自底线一句 ·**archify full**：layer-mechanism-map 章 `gov` | 名牌 useStagger 四联弹入；回放承担母图定位（本镜无动效 hook）|
| 4-B | p4-04..08    | **闸机**：扫描线横扫文件队列，机密页逐页打码、越权行整条抽走；**代码走廊⑦** lab D5 终端 `intern → [90,560]` | 扫描线 useProgress 线性横扫；打码块 useProgress；扣行 useImpulse；终端行 CodeWalk ；`@progress` `@impulse`|
| 4-C | p4-09..12    | **木牌 vs 承重墙**：草坪「请勿踩踏」木牌被轻松翻越（danger）vs 焊入承重墙的执法点人/BI/AI 合流通过 | 木牌 useSpring 立起 → useShake 击倒；焊点 useDraw ；`@spring` `@shake` `@draw`|
| 4-D | p4-13..16    | **贴标流水线**：新文件（手机号 / 身份证列）滑过扫描探针，密级标签自动贴上、联动闸机；映射断链则明文出楼（danger）；**代码走廊⑧** lab D10 终端 | 文件 useStagger 滑动；标签随扫描探针 useProgress 显影；终端行 CodeWalk ；`@stagger` `@progress`|
| 4-E | p4-17..20    | **工牌权限交集环**：带教人环 ∩ 岗位环收窄成工牌形 + 双钟对照（快照钟停在会话开始 / 实时钟持续走）；**代码走廊⑨** lab D9 终端 `回收后仍持权` | 双环 useSpring 入场 → useProgress 收窄；钟摆 useBreathe 常驻；终端行 CodeWalk ；`@spring` `@progress` `@breathe`|
| 4-F | p4-21..28    | **MCP 供给面** ·**archify full**：mcp-threat-model 章 `chain`+`poison`+`deputy`+`controls`；对策清单四件套收尾 | 回放主控由 ArchifyClip 承担；插座装置入场后让位（ArchifyYield）（本镜无动效 hook）|

## P5 前台与插座（p5-01..26）

| 镜  | 句区间      | 画面                                                                                                       | 动效                                                          |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 5-A | p5-01..08   | **前台窗口**：档案库整墙缩略图退后虚化，窗口只递出两三页精装纸 ·**archify full**：collect-phase 章 `search`；Spider 崩崖数字卡（角标 86.6→10.1）| 推纸 useProgress；页数 useCount；崩崖数字卡 useCount ；`@progress` `@count`|
| 5-B | p5-09..14   | **核准题库**：题库卡抽出 → 盖章底稿（verified_by / verified_at / 答案，角标）→ 未核准卡打上「未经核准」水印对照；>20 反噬数字卡 | 圆章 useSpring 盖落 + useImpulse；对照卡 useStagger ；`@spring` `@impulse` `@stagger`|
| 5-C | p5-15..18   | **前台契约** ·**archify full**：assembler-planner 章 `router`+`fusion`+`guard`；**代码走廊⑩** mcp T5 终端输出私有事实拒答行 | 回放主控由 ArchifyClip 承担；终端行 CodeWalk（本镜无动效 hook）|
| 5-D | p5-19..21   | **插座与护照**：USB-C 线缆 draw 出接入大厦 + 护照卡翻开（三重边界天平：可携带 ≠ 可执行 ≠ 已验证）；第三方实测角标 | 线缆 useDraw；插头 useSpring 接入；天平 useProgress ；`@draw` `@spring` `@progress`|
| 5-E | p5-22..25   | **治理≠验证**：两块屏幕 477 vs 48 对撞裂开 + 大厦母图地基塌方剖面（图纸金色合法、地基 danger 塌陷）| 对撞卡 devices.tsx NumberClash；塌方 useProgress 压暗下沉 ；`@progress`|
| 5-F | p5-26       | 钩子「去验收」+ HUD 第 4/5 柱点亮 | HUD 点亮在 devices.tsx（本镜无动效 hook）|

## P6 总装与路线（p6-01..26）

| 镜  | 句区间      | 画面                                                                                                       | 动效                                                          |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 6-A | p6-01..07   | **评测考场**：考题卡四类（歧义 / 隐晦连接 / 空结果 / 越权——越权卡期望「拒绝 + 审计」）+ KPI 金句「报错优于错数」+ 基准错标警示卡（角标 62.8%）| 考题卡 useStagger 四联；金句卡静态；警示卡 useImpulse ；`@stagger` `@impulse`|
| 6-B | p6-08..11b  | **总装现状与缝合** ·**archify full**：runtime-layering 章 `memkb`；request-injection 章 `tables`；auto-channel 章 `auto`；assembler-planner 章 `grounding` | 回放主控由 ArchifyClip 承担（本镜无动效 hook）|
| 6-C | p6-12..17   | **十格破坏实验仪表盘**：十格逐格点亮（每格 = 一次拆坏，格内退化数字角标 D1–D10）→ 试金石金句卡 | 仪表盘 useStagger 十联 + 末格 useImpulse；金句卡静态 ；`@stagger` `@impulse`|
| 6-D | p6-18..21   | **双轨路线** ·**archify full**：dual-track-roadmap 章 `design`+`p0`+`ph23`；evolution-levers 章 `seventh`（「带开关」句）| 回放主控由 ArchifyClip 承担；路线图声明角标常驻（本镜无动效 hook）|
| 6-E | p6-22..24   | 收尾金句「含义被治理好之前，AI 的聪明都是租来的」+ 信源卡（pinned commit / 精读笔记 / 蓝图 / 原型代码 / 12 张工程图拼版背景）+ 全屏平缓**渐黑** | 信源卡 useStagger 浮现；全镜 useFadeOut 渐黑（末 90 帧，窗取整镜时长）；`@stagger` `@fadeOut`|
