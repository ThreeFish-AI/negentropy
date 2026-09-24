# 分镜：《给 AI 一座图书馆：OpenViking 上下文数据库》v1

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §3。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`rose` 玫红（问题 / 反例 / 批判）·
> `mint` 薄荷绿（图书馆机制：树 / 书架 / 标签 / 卡片 / 推车）· `peri` 长春花蓝（证据 / 实验 / 数字）·
> `danger` 警示红（「已废弃」降权与破坏标记专用）· `confirm` 确认绿（自检通过专用）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 保持规范对应**；动效列 `@动词` 对应 motion 模型（hooks.ts）。
> **`@动词` 的判据**：当且仅当**本镜 `<Sequence>` 内、由本幕 `scenes/P*.tsx` 自身定义的装置**调用了该 `useXxx(`。
> `components/` 内的 hook（`ArchifyClip` 画框弹入 / `ArchifyRecap` 章节回放 / `devices.tsx` 的 EvidenceBadge、NumberClash / `CodeWalk` / `TerminalLog`）与 `window.ts` 纯函数 `progress()` **一律不产生 token**，但**必须在散文里点名承担者**。
> ⚠️ 动效列**禁照搬画面列那套标注字面**：覆盖门按全文计数、解析只取画面列，多一处命中即 FAIL。散文一律写「全屏独占 / 画中画」。
> ⚠️ 非 beat 用途禁写 `w('句id')` 字面形态：scene 里用与 `at` 对称的 `dur('句id')` 取长。判定基线 **FAIL 0 + WARN 0**。
>
> **本集母题（三层视觉语法）**：
> ① **母图层** —— 图书馆剖面 HUD（常驻左下：三个分区格，讲到哪格亮哪格）；
> ② **装置层** —— 可拆坏的机械装置（三孤岛碎裂 / 撕日历 / 卡片柜翻卡 / 专家红叉 / 借阅推车 / 过敏合并对撞 / 盖章台 / 三卡并立 / 事件卡翻倍）；
> ③ **证据层** —— 代码走廊（CodeWalk + TerminalLog 滚 lab 真实输出）+ 工程图逐章回放（`ArchifyRecap`，一章锚一句）+ 四级证据角标（EvidenceBadge：一原型实测 / 二笔记讲法 / 三厂商自报）。
>
> 章节清单见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长 = 拍数 × max(1100ms, 3200ms/拍数)。

## P0 三个失忆现场（p0-01..12）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A | p0-01..04 | **三失忆现场**：三块小屏依次点亮（忘口味 / 答非所问 / 从头学起），研究员简笔形象在屏幕间奔走；角标「记忆 / 文档 / 技能」 | 三屏 useStagger 依次推入；研究员位移 useProgress；`@stagger` `@progress` |
| 0-B | p0-05..07 | **三孤岛碎裂**：三张卡片各飞入三座孤岛，岛间海面裂开（rose）；角标「三个家、三种规矩」 | 卡片飞入 useSpring；裂痕 useDraw 生长；`@spring` `@draw` |
| 0-C | p0-08..09 | **碎片箱**：文档被切成碎片倒入大箱，捞起的碎片高度雷同、真答案沉底（danger 角标「捞漏 = 永失」） | 碎片 useStagger 沉降；真答案碎片 useDim 压暗；`@stagger` `@dim` |
| 0-D | p0-10..12 | **图书馆亮相**：碎岛拼合成图书馆剪影（mint），定名卡「OpenViking · 上下文数据库」；角标 `viking://` | 剪影拼合 useProgress；定名卡静态；`@progress` |

## P1 一棵树（p1-01..14）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A | p1-01..03 | 章头「一棵树」+ ·**archify full**：uri-scope-tree 章 `tree`（p1-01 起锚、铺满本镜） | 回放主控由 ArchifyClip 承担（本镜无动效 hook）；HUD 分区格全亮 |
| 1-B | p1-04..07 | **三分区柜**装置：公共馆藏 / 读者档案 / 馆员手册三柜门开合，一套动作图标（列目录 / 读 / 搜）依次落三柜 | 柜门 useSpring 开合；图标 useStagger；`@spring` `@stagger` |
| 1-C | p1-08..12 | ·**archify full**：uri-scope-tree 章 `mem`（p1-08 起锚）+ 章 `counter`（p1-10 反例句起锚、铺满至镜尾） | 回放主控由 ArchifyClip 承担；反例高亮为章节内置聚焦（本镜无动效 hook） |
| 1-D | p1-13..14 | **边界卡**：「不是文件系统」两行字卡（rose 边），AI-ready 结构示意角标 | 字卡 useSpring 升起（本镜主控为自绘装置）；`@spring` |

## P2 标签与导览（p2-01..15）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..03 | 章头「标签与导览」+ ·**archify full**：tiering-l0-l1-l2 章 `layers`（p2-01 起锚、铺满本镜） | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 2-B | p2-05..08 | ·**archify full**：tiering-l0-l1-l2 章 `gen`（p2-07 一次大模型句锚定）+ 章 `cut`（p2-08 零次调用句锚定）；ingest-phase 章 `summarize`（p2-05 起锚）；侧栏代码走廊①：lab S2「LLM 调用 125 次（L0 零次）」 | 回放主控由 ArchifyClip 承担；终端行 CodeWalk；（本镜无动效 hook） |
| 2-C | p2-09..13 | ·**archify full**：tiering-l0-l1-l2 章 `sample`（p2-09 采样句锚定）→ freshness-bubbling 章 `funnel`（p2-11 零成本句锚定）+ 章 `small`（p2-12 立即重印句锚定）+ 章 `wide`（p2-13 攒一成句锚定） | 回放主控由 ArchifyClip 承担；跨实例接缝 lead 抑制在场景代码声明（本镜无动效 hook） |
| 2-D | p2-14..15 | **成本账单**装置：等式卡「文档数 + 目录数」滚动累计，祖先架重印时兄弟文件简介卡陪翻 | 数字 useCount；陪翻卡 useStagger；`@count` `@stagger` |

## P3 两档检索（p3-01..23）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..05 | 章头「两档检索」+ ·**archify full**：retrieval-phase 章 `quick`（p3-01 起锚、铺满本镜）；HUD 默认档徽标点亮 | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 3-B | p3-07..08 | ·**archify full**：intent-typed-queries 章 `split`（p3-07 拆单句锚定） | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 3-C | p3-09..15 | ·**archify full**：retrieval-phase 章 `thinking`（p3-09 逐架下钻句锚定）+ 章 `prune`（p3-11 唯一剪枝句锚定）；角标 α=1.0 | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 3-D | p3-16..19 | **废弃文档陷阱**装置：十二份「已废弃」旧流程卡涌向平铺档前三名（danger 红叉降权只在豪华档生效）；代码走廊②：lab S3 `QUICK recall@3 = 0.75 / THINKING 1.00` | 旧卡 useStagger 涌入；红叉 useImpulse 击中；终端行 CodeWalk；`@stagger` `@impulse` |
| 3-E | p3-20..23 | ·**archify full**：retrieval-phase 章 `asm`（p3-21 先广后深句锚定）；**借阅推车**装置叠角：薄本摘要换厚本全文、装不下降档 | 回放主控由 ArchifyClip 承担；推车换本 useProgress（自绘装置）；`@progress` |

## P4 来访与档案卡（p4-01..20）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..04 | 章头「来访与档案卡」+ ·**archify full**：session-commit-two-phase 章 `live`（p4-01 来访句锚定）+ 章 `archived`（p4-03 装订句锚定）+ 章 `p2`（p4-04 后台整理句锚定） | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 4-B | p4-05..08 | ·**archify full**：session-commit-two-phase 章 `done`（p4-05 起锚、延至提交点句）+ 章 `failed`（p4-08 封条句锚定）；盖章意象由章回放自带 | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 4-C | p4-09..12 | **像 vs 是**装置：两张过敏卡（妈妈 / 女儿）被相似度弹簧拉向合并、锁定前急停（danger）；金句卡「像和是，从来不是一回事」 | 弹簧拉拽 useSpring + 急停 useImpulse；金句卡静态；`@spring` `@impulse` |
| 4-D | p4-13..16 | ·**archify full**：memory-identity 章 `prefetch`（p4-13 提名候选句锚定）+ 章 `identity`（p4-14 规则拼名句锚定）+ 章 `upsert`（p4-15 降维句锚定） | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 4-E | p4-17..20 | 代码走廊③：lab S6「三次来访一张卡 / diff before-after」+ S7「重投跳过」终端实录；残余风险角标（peri：「咖啡 vs 饮品」双卡） | 终端行 CodeWalk；双卡 useStagger 并立；`@stagger` |

## P5 拆台（p5-01..15）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..06 | **证据分级卡**（【一】原型实测 /【二】笔记讲法 /【三】厂商自报，peri）；成绩单数字卡「24 → 82」盖「团队自测」水印；三连「它没告诉你」小卡 | 分级卡 useStagger；水印 useImpulse 盖下；`@stagger` `@impulse` |
| 5-B | p5-07..10 | **反例对撞**：66.9 vs 76 双柱（rose 落败侧），侧栏两枚小奖牌「建库 token 一成四 / 快四十倍」（mint）；金句卡「省钱省时和精度不是一回事」 | 双柱 useSpring 升起；奖牌 useStagger；`@spring` `@stagger` |
| 5-C | p5-11..15 | **复算终端**：`−22.8%` 被红线改写为 `−15.3%`（CodeWalk 行高亮）；论文 / 文档漂移两行角标；收束卡「以固定提交代码实值为准」（peri） | 终端行 CodeWalk（本镜无动效 hook） |

## P6 实验室与收尾（p6-01..18）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01 | **实验室门牌**：玩具图书馆线稿 + 「每次只拆一个零件」工作台 | 门牌 useSpring 落下；`@spring` |
| 6-B | p6-02..04 | ·**archify full**：lab-break-matrix 章 `struct`（p6-02 起锚、铺满本镜）；侧栏装置：撕标签手势 | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 6-C | p6-05..07 | ·**archify full**：lab-break-matrix 章 `idcheck`（p6-05 起锚、铺满本镜）；三卡并立装置角标 | 回放主控由 ArchifyClip 承担（本镜无动效 hook） |
| 6-D | p6-08..11 | **事件卡翻倍**装置：重投箭头落下、单卡分身成两张（danger）；代码走廊④：lab B6 终端 + `SELFTEST PASSED ✔`（confirm） | 翻倍 useImpulse；终端行 CodeWalk；`@impulse` |
| 6-E | p6-12..15 | **映射卡**（peri）：左「不照搬这棵树（副本式 ✗）」右「搬这条提交链：归档→整理→盖章（✓）」+ 断链示意 | 双卡 useSpring；链条 useDraw 连通；`@spring` `@draw` |
| 6-F | p6-16..18 | **图书馆熄灯**：分区灯依次熄灭只留门口一枚（mint），下期卡淡入 | 熄灯 useDim 逐格；下期卡静态；`@dim` |

## 字幕规范

底部单行、一句一条、与配音逐句同步；字号同系列前集（正文 34px 级、安全带 y<56 留给章节进度条）；标点句尾剥句号口径沿用系列（captions 阶段处理）。

## 实现映射

| 幕 | 组件 | 公共组件复用 |
| --- | --- | --- |
| P0 | `P0Amnesia.tsx` | devices 三屏/碎岛/碎片箱/定名卡、SceneFade |
| P1 | `P1Tree.tsx` | 三分区柜、边界卡、ArchifyClip |
| P2 | `P2Tiers.tsx` | 成本账单装置、CodeWalk、ArchifyClip |
| P3 | `P3Retrieval.tsx` | 废弃卡陷阱、借阅推车、CodeWalk、ArchifyClip |
| P4 | `P4Memory.tsx` | 过敏合并对撞、盖章台角标、CodeWalk、ArchifyClip |
| P5 | `P5Teardown.tsx` | 证据分级卡、NumberClash、复算终端 |
| P6 | `P6Lab.tsx` | 事件卡翻倍、映射卡、熄灯装置、TerminalLog |

motion hooks 汇总（判据=scene 级并集，与 check_motion 同粒度）：`@spring`（0-B/1-B/1-D/5-B/6-A/6-E）· `@stagger`（0-A/0-B/0-C/1-B/2-D/3-D/4-E/5-A/5-B）· `@progress`（0-A/0-D/3-E）· `@draw`（0-B/6-E）· `@dim`（0-C/6-F）· `@count`（2-D）· `@impulse`（3-D/4-C/5-A/6-D）。
