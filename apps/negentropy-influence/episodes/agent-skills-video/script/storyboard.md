# 分镜：《经验淬炼成手册：Agent 的轻量蒸馏与按需装配》v1

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`forge` 玫瑰焰（淬炼 / 经验 / 纠正 / 坑点）· `spine` 矢车菊蓝（书脊 / 目录 / 常驻成本 / 路由）· `book` 兰花紫（整本 / 附录 / 按次付费）· `danger` 警示红（破坏 / 冒名 / 注入 / 静默丢失）· `ok` 确认绿（通过 / 命中 / 防线）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 保持规范对应**；动效列 `@动词` 对应 motion 模型（hooks.ts）。
> `@动词` 的判据：当且仅当本镜 `<Sequence>` 内、由本幕 `scenes/P*.tsx` 自身定义的装置调用了该 `useXxx(`。`components/` 内 hook（ArchifyClip 画框弹入 / ArchifyYield 让位 / devices.tsx 的 SpineRow、CostWall、TeardownCard 等）与 window.ts 纯函数 `progress()` 不产生 token，但必须在散文里点名承担者。括注 `（本镜无动效 hook）` ≠ 本镜静止。
> ⚠️ 动效列禁照搬画面列那套标注字面：覆盖门的解析数只取画面列。判定基线 FAIL 0 + WARN 0。
> ⚠️ 非 beat 用途禁写 `w('句id')` 字面形态：scene 里用与 `at` 对称的 `dur('句id')` 取长。
> 章节清单见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长 = 拍数 × max(1100ms, 3200ms/拍数)。

## P0 经验之困（p0-01..28）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A | p0-01..04 | **老师傅**：工位旁指点，头顶经验气泡只增不散；角落 AI 助手头像蒙灰 | 气泡由 devices.tsx NoteBubbles 逐个浮起；`@stagger` |
| 0-B | p0-05..07 | **能干却不懂规矩**：左侧三枚能力章（写代码/读文件/自己干完），右侧团队规矩牌全部上锁 | 能力章 useStagger 盖下；规矩牌锁死用静态叉；`@stagger` |
| 0-C | p0-08..11 | **缺口与成本**：官网引语卡（角标原文）→ 上下文定义为「眼前的全部文字」，每字带价签 | 引语卡 useSpring 升起；价签行 useStagger；`@spring` `@stagger` |
| 0-D | p0-12..16 | **两条老路**：路一「猜」（问号雨）；路二「全塞开场白」——手册塔倒进开场白漏斗直到撑爆（danger）·**archify full**：handbook-cabinet 章 `old-empty`（p0-12）+ `old-stuff`（p0-15） | 漏斗撑爆由 devices.tsx FunnelBurst 内 useImpulse；问号雨 useStagger；`@impulse` `@stagger` |
| 0-E | p0-17..22 | **第三条路**：文件夹图标飞入柜格；家谱角标（Anthropic → 开放标准 → 一大批产品）·**archify full**：handbook-cabinet 章 `third-road`（p0-20） | 文件夹入场由本幕 FolderDrop 用 useSpring；家谱线 useDraw；`@spring` `@draw` |
| 0-F | p0-23..28 | **轻量蒸馏定义卡**：大脑锁定（不改参数）↔ 读到的文字流动（改这个）·**archify full**：handbook-cabinet 章 `light-distill`（p0-25）；片名三关键词预告（淬炼/轻量蒸馏/按需装配） | 定义卡双联由本幕 DefineCard 用 useProgress 交叉亮；锁标 useImpulse 落锁；`@progress` `@impulse` |

## P1 淬炼成册（p1-01..35）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A | p1-01..06 | **空泛陷阱**：AI 起草页滚出「妥善处理错误 / 遵循最佳实践」两行灰字，橡皮划掉·**archify full**：distill-loop 章 `generic-trap`（p1-05） | 起草行 useStagger 滚入；划掉线 useDraw；`@stagger` `@draw` |
| 1-B | p1-07..11 | **真实任务**：员工办工单，老师傅三次叫停（红线批注），记录员在旁 | 叫停叉由本幕 StopMarks 用 useImpulse 三连击；`@impulse` |
| 1-C | p1-12..15 | **四格便签**：步骤/纠正/格式/背景四色便签依次贴上，汇成初稿（forge）·**archify full**：distill-loop 章 `four-notes`（p1-12） | 便签由 devices.tsx NoteQuad useStagger 贴入；`@stagger` |
| 1-D | p1-16..18 | **资料合成**：档案柜抽出复盘/文档/评审/补丁四卷，外面买的《通用最佳实践》被放回·**archify full**：distill-loop 章 `synthesize`（p1-17） | 抽卷 useStagger；放回手势静态；`@stagger` |
| 1-E | p1-19..21 | **编辑台**：逐行盖章「没有这条会做错吗？」，「解释 PDF 是什么」一行被划掉·**archify full**：distill-loop 章 `edit-cut`（p1-21） | 印章由本幕 StampSweep 用 useSpring 逐行压下；`@spring` |
| 1-F | p1-22..26 | **坑点清单**：红笔首页三连写；示例「数据库断了，健康检查照报正常」高亮·**archify full**：distill-loop 章 `gotchas`（p1-24） | 红笔迹 useDraw；`@draw` |
| 1-G | p1-27..28 | **执行再修订**：初稿 → 真实任务跑一轮 → 全部结果回灌 ↺ 三格小回路（p1-27）·**archify full**：distill-loop 章 `execute-revise`（p1-28） | 三格由本幕 ReviseLoop 用 useStagger 递进；`@stagger` |
| 1-H | p1-29..33 | **试岗对照**：两名新员工并排领同一工单，一有手册一无；质检员逐条打勾贴证据；「两边都过」整栏划掉、「只有带手册才过」点亮（ok）（成绩板角标「示例」）·**archify full**：eval-twin-runs 章 `twin`（p1-29）+ `with-without`（p1-30）+ `both-pass`（p1-32）+ `only-with`（p1-33） | 打勾由本幕 TwinDesk 用 useStagger；划栏线 useDraw；`@stagger` `@draw` |
| 1-I | p1-34..35 | **定性收束**：「推荐做法，不是硬规定」注记条 + 「被纠正过、被考过，才算淬炼成册」幕尾字牌（forge） | 字牌由本幕 ActSeal 用 useSpring 落章；`@spring` |

## P2 一格一本（p2-01..22）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..04 | **手册柜正面**：一格一本、格子贴标签、书脊朝外；文件夹=一格 映射条·**archify full**：package-and-validation 章 `package`（p2-03） | 格位由 devices.tsx CabinetGrid useStagger 亮起；`@stagger` |
| 2-B | p2-05..09 | **两行书脊**：名字 + 描述 = 书脊；名字规则三反例卡（大写/打头短横线/双短横线，danger）·**archify full**：package-and-validation 章 `required`（p2-06） | 反例卡 useStagger 弹入并打叉；`@stagger` |
| 2-C | p2-10..13 | **关键一条**：书脊名字 vs 格子标签逐字比对，全等亮绿灯（ok）；选填四项角标·**archify full**：package-and-validation 章 `name-rule`（p2-10）+ `optional`（p2-12） | 比对字符由本幕 MatchRun 用 useProgress 逐位对齐；绿灯 useImpulse；`@progress` `@impulse` |
| 2-D | p2-14..18 | **借唯一性**：同柜不可能两个同名格 → 唯一性白送；边界注「只管同一个柜子」 | 推理三连卡 useStagger 递进；`@stagger` |
| 2-E | p2-19..22 | **附录拆分**：正文膨胀 → 脚本/参考资料/模板三夹页飞出；「写清什么情况翻哪一页」·**archify full**：package-and-validation 章 `to-prompt-gap`（p2-21）；幕尾问句「柜里几十本，每次都得全读吗？」悬置 | 夹页 useStagger 飞出；`@stagger` |

## P3 按需装配（p3-01..26）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..05 | **书脊扫描**：员工上岗，扫描光带扫过整排书脊（spine）；这排书脊=目录·**archify full**：progressive-disclosure 章 `tier1`（p3-04） | 扫描光带由本幕 ScanBand 用 useProgress 平移；`@progress` |
| 3-B | p3-06..11 | **三层预算**：书脊≈100 计量单位（价签）→ 整本 <5000/<500 行 → 附录按页；口径不一角标·**archify full**：progressive-disclosure 章 `tier2`（p3-08）+ `tier3`（p3-10） | 三层卡 useStagger 升起；价签 useCount 滚数；`@stagger` `@count` |
| 3-C | p3-12..14 | **目录契约**：目录卡背面印着「怎么取书」通路；空柜不挂目录·**archify full**：progressive-disclosure 章 `contract`（p3-13） | 通路箭头 useDraw；`@draw` |
| 3-D | p3-15..20 | **玩具库账本**：终端走廊滚 selftest 输出（角标「原型实测」）；两根账柱 2321 vs 39222·**archify full**：cost-structure 章 `ledger`（p3-17） | 账柱由 devices.tsx LedgerBars 用 useCount 生长；`@count` |
| 3-E | p3-21..26 | **书脊墙 vs 按次付费**：左墙面随 +1 本变宽、租金每次开工付；右侧整本/附录按次计数·**archify full**：cost-structure 章 `wall-vs-pay`（p3-22） | 墙格由 devices.tsx CostWall useProgress 逐格点亮；`@progress` |

## P4 书脊路由（p4-01..24）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..05 | **谁来做决定**：工单卡飘到书脊墙前；「不做关键词匹配，模型自己判断」归属角标·**archify full**：description-routing 章 `judge`（p4-03） | 工单飘入由本幕 TicketFloat 用 useSpring；`@spring` |
| 4-B | p4-06..10 | **正反例对读**：好书脊亮起（做什么+何时用）；差书脊「帮忙处理 PDF」灰掉但盖「满足硬性规定」章·**archify full**：description-routing 章 `good-desc`（p4-07）+ `bad-desc`（p4-09） | 亮/灰由本幕 SpineVerdict 用 useProgress 双向；`@progress` |
| 4-C | p4-11..14 | **命中与静默落空**：简化判断规则（角标「实验替身」）→ 好描述抽出整本；差描述工单沉底，无报错无警告·**archify full**：description-routing 章 `hit-miss`（p4-12） | 抽书 useSpring；沉底 useDim；`@spring` `@dim` |
| 4-D | p4-15..20 | **描述也要测**：二十条提问分堆（应触发/不应触发）→ 练习组/考核组分箱·**archify full**：description-eval 章 `queries`（p4-16）+ `groups`（p4-19）+ `pick`（p4-20） | 分箱由本幕 SortBins 用 useStagger；`@stagger` |
| 4-E | p4-21..24 | **考核组裁判**：五轮成绩曲线，最高点不在末轮（角标「示意」）；1024 硬顶标尺 | 曲线 useDraw；标尺 useImpulse 压线；`@draw` `@impulse` |

## P5 拆解实验（p5-01..33）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..03 | **拆解台开场**：三栏卡模板（改了什么/实测怎样坏/教训）空卡立起；终端走廊就位 | 卡架由 devices.tsx TeardownCard useSpring 立起；`@spring` |
| 5-B | p5-04..10 | **第一拆·冒名**：真「代码评审」与冒牌货并排；顺序扫描亮真身、倒序亮冒牌（danger）；终端滚 B2 输出·**archify full**：teardown-identity-budget 章 `impostor`（p5-07） | 扫描方向切换由本幕 FlipScan 用 useProgress；`@progress` |
| 5-C | p5-11..15 | **第二拆·超长描述**：12159 字符长条 vs 1024 标尺；账柱 1206→4285（角标 +255%）·**archify full**：teardown-identity-budget 章 `bloat`（p5-12）+ `share`（p5-14） | 长条溢出 useProgress；账柱 useCount；`@progress` `@count` |
| 5-D | p5-16..24 | **第三拆·切分**：头信息首尾各占一行的三条短横线 vs「遇到就切」；描述内合法 --- 被拦腰截断；技能静默消失（终端滚 B4 + 真实参考实现解析失败行）·**archify full**：teardown-parse-escape 章 `dash`（p5-17）+ `cut`（p5-20）+ `drop`（p5-23） | 截断闪由本幕 SnapCut 用 useImpulse；`@impulse` |
| 5-E | p5-25..33 | **第四拆·不转义**：描述内藏伪造目录段 → 注册表 20 本 vs 模型视图 21 本；「最高权限」书脊以假乱真；防线归客户端·**archify full**：teardown-parse-escape 章 `forge`（p5-27）+ `view`（p5-28）+ `fake`（p5-30） | 第 21 本由本幕 GhostSpine 用 useSpring 淡入（半透明）；`@spring` |

## P6 规范边界（p6-01..32）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01..04 | **天平**：规范正文 vs 参考实现代码，天平压向规范；引语角标「specification.mdx is authoritative」·**archify full**：authority-and-controversies 章 `authority`（p6-03） | 天平倾转由本幕 ScaleTip 用 useSpring；`@spring` |
| 6-B | p6-05..10 | **十三处分歧**：分歧卡阵列，六张盖「真跑复现」绿章；点名两例（中文名/坏文件整体失败，终端走廊复现行）·**archify full**：authority-and-controversies 章 `diff-13`（p6-05）+ `realrun`（p6-06） | 卡阵 useStagger；绿章 useImpulse 盖下；`@stagger` `@impulse` |
| 6-C | p6-11..16 | **争议一·严格 vs 宽容**：图书管理员退回 vs 贴黄条上架；谷歌口径与 IAB 提醒两枚归属角标·**archify full**：authority-and-controversies 章 `strict`（p6-13）+ `lenient`（p6-14） | 双门由本幕 TwoGates 用 useProgress 对开；`@progress` |
| 6-D | p6-17..21 | **争议二·自己挑 vs 点名 / 争议三·信任**：并列双题板；无锁柜门敞开，缺签名/出处/版本三枚空卡·**archify full**：authority-and-controversies 章 `trust`（p6-20） | 空卡 useStagger 浮起并保持虚框；`@stagger` |
| 6-E | p6-22..26 | **没有证明的五条**：五张「未证明」便签贴满柜门·**archify full**：unproven-list 章 `five`（p6-23）+ `check`（p6-26） | 便签 useStagger 贴入；`@stagger` |
| 6-F | p6-27..32 | **收尾**：回扣老师傅（p6-27 起「经验 → 手册 · 书脊 · 按需」一行）→ 金句卡「模型本身一个参数都没动；变的是它在对的时刻读到对的那一页」→ 信源卡（agentskills/agentskills @69ef37e9 · CC-BY-4.0 · 本仓精读 090）→ 渐黑 | 金句卡 useSpring 升起；渐黑由本幕 EndFade 从末 beat 时长推导（useFadeOut）；`@spring`（渐黑为渲染层函数） |
