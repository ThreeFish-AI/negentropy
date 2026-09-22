# 《翻旧账不花钱：AI 在梦里改章程》分镜表（v1）

> **句 id 对齐**：镜内句区间以 narration.md 实存句集为准，覆盖各幕全部句子、无交叠无遗漏；时长以 TTS manifest 实测为准（timing.ts/timeline.py 同构重算）。
> **本集视觉契约**（与 planning.md 一致）：`dream #7DD3FC`（离线/免费/确定，主色）· `sun #FFE3B3`（在线/贵/随机）· `grow #A3E635`（改进/胜出，ok 覆写同值）；底座 bg `#0E1116` / danger `#FF5C5C`（仅失败态）。昼夜母题：P0/P2 暖白 → P3/P4 冰蓝 → P5 红压场 → P6 双色合流。
> archify 素材进片一律**全屏独占切换**（manifest 见 `video/public/archify/`，views 为图集章节 SSOT）；跨实例背靠背（含镜界相接）后挂实例 `lead={false}`。

## 字幕规范

底部单行、一句一条（frozen `Subtitle.tsx`，渲染层剥句尾句号）；字号/安全带随 frozen 底座；角标一律绝对定位 `bottom ≥ 150px` 避让字幕带。

## 实现映射

| 幕 | 组件 | 公共件 |
|---|---|---|
| P0 | `scenes/P0Hook.tsx` | 金句卡（cards.tsx）、论文卡、标题卡 |
| P1 | `scenes/P1Dilemma.tsx` | 章程卡、金句卡 |
| P2 | `scenes/P2Tree.tsx` | 分数落格（NumberedCard + meter） |
| P3 | `scenes/P3Dream.tsx` | 台账翻页装置、围栏装置 |
| P4 | `scenes/P4Score.tsx` | 闸门装置、冰冻罩装置 |
| P5 | `scenes/P5Teardown.tsx` | 快闪卡、金句卡 |
| P6 | `scenes/P6Evidence.tsx` | 金句卡、引用卡、SceneFade |

ArchifyRecap/ArchifyClip 装载层为 frozen+seeded 公共组件（`components/`），cue 写法=章节 id+锚句+fit，一章锚一句、同锚句禁双 cue；非 cue 的 `at()`/`dur()` 句引用先对照实存句集。

---

## P0 烧钱账单与做梦赌注

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A 计费计数器 | p0-01..04 | sun 暖白昼。提案→评审双格循环装置居中，右上是计费计数器与红价签（danger），逐轮跳数；背景网格缓漂 | `@count` 计数器帧驱动跳数；循环装置 `@flow` 行进虚线；价签 `@enter:pop` |
| 0-B 再跑一遍 | p0-05..07 | 「再跑一遍」按钮按下→又一列账单涌出（sun+danger）；2026年9月论文卡入场：三机构名录 + arXiv 角标 | 按钮 `@impulse` 按压；账单列 `@stagger` 涌出；论文卡 `@enter:rise` |
| 0-C 台账翻转 | p0-08..11 | 台账本合上→翻面成沙盘（sun 整体 `@dim` 压暗、dream 冰蓝一闪预告）；标题卡定帧：片名衬线大字 + 系列标签「元探索 · 做梦」 | 台账 3D 翻转（bespoke 签名镜头，本集豁免运动层的定制动效）；标题卡 `@enter` |

## P1 章程写死的探险队

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A 探险队与章程 | p1-01..05 | 探险队剪影装置 + 中央章程卡（三栏：方向/深挖/并行）；「写死」印章盖下（danger 描边）；算力箭头砸向灰色无效区 | 章程卡 `@settle` 落位；三栏 `@stagger` 点亮；印章 `@impulse`；无效区 `@dim` |
| 1-B 两难 | p1-06..09 | ·**archify full**：dilemma-cost `dilemma`+`stuck`+`verdict`（锚 p1-06/p1-08/p1-09） | ArchifyRecap 逐章回放承担（画框切章） |
| 1-C1 破局金句 | p1-10..11 | 金句卡：「只要有一个又快又便宜的发现模拟器……先被筛一遍」，英文原句角标（衬线居中） | 金句卡 `@enter` + `@pushIn`；角标 `@reveal` |
| 1-C2 台账揭示 | p1-12 | 全屏独占切图 ·**archify full**：history-as-simulator `origin`（锚 p1-12） | ArchifyRecap 回放承担 |
| 1-D 三件套总装 | p1-13..17 | ·**archify full**：expedition-setup `ledger`+`sandbox`+`staff`（锚 p1-13/p1-15/p1-16，承 1-C2 之图连续切章）；p1-17「原封不动」时 Remotion 覆层：冰冻罩微光压角 | ArchifyRecap 逐章回放承担；覆层 `@breathe` 低频辉光 |

## P2 机制一：台账与同一套决策

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A 发现树生长 | p2-01..04 | ·**archify full**：discovery-tree `pages`+`grow`（锚 p2-02/p2-04） | ArchifyRecap 逐章回放承担 |
| 2-B 批次与自由度 | p2-05..07 | ·**archify full**：replay-simulator `freedom`（锚 p2-06） | ArchifyRecap 逐章回放承担 |
| 2-C 玩具队三连 | p2-08..10 | sun 昼。玩具队场景：一批三支小队分叉出发，三块编号卡落格显示 s=0.50 / 0.35 / 0.80（panel 底+编号，激活才染色；0.80 格 grow 辉光） | 分叉线 `@draw`；三卡 `@stagger` + `@count` 分数滚动落格；0.80 格 `@impulse` |
| 2-D 同一接口 | p2-11..13 | ·**archify full**：discovery-tree `interface`（锚 p2-11）+ two-phase-loop `online`（锚 p2-12）；p2-13 Remotion 昼夜分屏收尾：左半 sun 进山、右半 dream 沙盘，同一份章程卡居中贯通 | ArchifyRecap 逐章回放承担前两句；分屏 `@enter` 对开；章程卡 `@flow` 双向流动线 |

## P3 机制二：沙盘做梦

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A 沙盘推演 | p3-01..05 | dream 冰蓝夜开场（幕基调切换）。沙盘装置：台账页翻开、当年结果被抄录；旁边「生成」「评审」两图标挂灰色「未调用」牌 | 台账页 `@reveal` 逐行显影；抄录线 `@draw`；未调用牌 `@dim` 挂牌 `@enter:fall` |
| 3-B 两条规则 | p3-06..09 | ·**archify full**：determinism-proof `reset`+`nonroot`+`root`（锚 p3-06/p3-07/p3-08） | ArchifyRecap 逐章回放承担 |
| 3-C 确定与免费 | p3-10..11 | ·**archify full**：two-phase-loop `offline`（锚 p3-10）；沙盘上多条时间线并行的示意由图内聚焦承担 | ArchifyRecap 回放承担 |
| 3-D 沙盘边界 | p3-12..14 | Remotion：沙盘边界发光围栏（dream 描边），围栏外灰雾区纯灰留白 + 问号浮标 | 围栏 `@draw` 描线 + `@breathe` 呼吸；灰雾 `@dim`；问号 `@enter:pop`（P6 伏笔标记） |
| 3-E 四章程对撞 | p3-15..19 | ·**archify full**：four-charters `one-tree`+`scores`+`takeaway`（锚 p3-16/p3-17/p3-19） | ArchifyRecap 逐章回放承担 |

## P4 机制三：评分与防回退

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A 重放分三件 | p4-01..06 | ·**archify full**：v-three-terms `quality`+`cost`+`parallel`+`total`（锚 p4-02/p4-03/p4-05/p4-06） | ArchifyRecap 逐章回放承担 |
| 4-B1 幕僚长卷轴 | p4-07..07 | Remotion 过渡卡：幕僚长卷轴一行预告（轨迹与得分逐字显影） | 卷轴 `@reveal` |
| 4-B2 图承章节 | p4-08..12 | 全屏独占切图 ·**archify full**：two-phase-loop `revise`+`guard`（锚 p4-08/p4-10） | ArchifyRecap 逐章回放承担 |
| 4-C 只有章程在变 | p4-13..14 | Remotion：系统全家福——模型/评审/接口三模块罩冰冻玻璃罩（panel+描边、微尘静止），唯一章程卡在顶部闪烁换版（grow） | 冰冻罩 `@pushIn` + `@breathe` 微光；章程卡 `@impulse` 换版闪 |
| 4-D 两轮递归 | p4-15..19 | ·**archify full**：proto-two-rounds `t1`+`dream`+`t2`+`combo`（锚 p4-15/p4-17/p4-18/p4-19） | ArchifyRecap 逐章回放承担 |

## P5 我们亲手拆坏它

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A 拆解宣言 | p5-01..02 | danger 红压场（幕基调切换）：背景网格泛红，工具箱开箱，五把扳手编号 D1–D5（panel 底+编号，danger 描边） | 工具箱 `@enter:fall`；扳手 `@stagger`；全场 `@dim` 红调压暗 |
| 5-B 拆保险（D1） | p5-03..05 | ·**archify full**：teardown-d1-guard `intact`+`removed`+`insurance`（锚 p5-03/p5-04/p5-05） | ArchifyRecap 逐章回放承担 |
| 5-C 拆规矩（D4） | p5-06..10 | ·**archify full**：teardown-d4-peek `legal`+`cheat`+`reversal`+`lesson`（锚 p5-07/p5-08/p5-09/p5-10） | ArchifyRecap 逐章回放承担 |
| 5-D 拆用法（D5） | p5-11..15 | ·**archify full**：teardown-d5-lockin `inject`+`replay`+`diversity`（锚 p5-11/p5-14/p5-15） | ArchifyRecap 逐章回放承担 |
| 5-E 快闪与金句 | p5-16..19 | Remotion：D2/D3 两块快闪卡（拔并行奖→0.83 跌 0.54；拔成本罚→铺张者登顶）；收幕金句卡「断言，必须以真跑输出为准」 | 快闪卡 `@impulse` ×2（数字翻牌）；金句卡 `@enter` + `@pushIn` |

## P6 实证、批判与收尾

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A 三柱对撞 | p6-01..05 | ·**archify full**：evidence-162x-caliber `bars`+`ratio`（锚 p6-03/p6-05） | ArchifyRecap 逐章回放承担 |
| 6-B 口径与拆解 | p6-06..10 | ·**archify full**：evidence-162x-caliber `warn`+`split`（锚 p6-07/p6-09） | ArchifyRecap 逐章回放承担（同图第二实例、与前镜相接，入场抑制 lead 显式关闭） |
| 6-C 先省后探 | p6-11..16 | ·**archify full**：behavior-adaptive `early`+`save`+`re-explore`+`perf`（锚 p6-12/p6-13/p6-14/p6-15） | ArchifyRecap 逐章回放承担 |
| 6-D 未证明清单 | p6-17..20 | ·**archify full**：unproven-list `head`+`gap-12`+`gap-345`（锚 p6-17/p6-18/p6-20） | ArchifyRecap 逐章回放承担 |
| 6-E 总金句与渐黑 | p6-21..22 | sun 与 dream 双色左右合流成一幅昼夜图；总金句卡「白天进山烧钱，夜里翻账免费」；引用卡（IEEE + 代码仓 + 信源四条）；片尾从**末 beat 总时长**推导渐黑（勿用末句时长） | 双色合流 `@flow` 对向而行；金句卡 `@enter`；引用卡 `@stagger` 四行；`@fadeOut` 末 beat 时长推导 |

---

## 覆盖自检

- 句区间连续性：P0 01–04/05–07/08–11 · P1 01–05/06–09/10–12/13–17 · P2 01–04/05–07/08–10/11–13 · P3 01–05/06–09/10–11/12–14/15–19 · P4 01–06/07–12/13–14/15–19 · P5 01–02/03–05/06–10/11–15/16–19 · P6 01–05/06–10/11–16/17–20/21–22 —— 各幕首尾相接、无交叠无遗漏 ✅
- archify cue 共 49 处（16 图全用上），锚句 49 个互不重复；同一图跨镜多实例处（6-A→6-B）已标 `lead={false}`；1-C→1-D、2-B→2-D 等跨图相接处实现时同样核验 enters 判定。
- 色彩契约：P3 起转 dream 基调、P5 danger 压场、P6 双色合流；概念色只在激活态使用（反枚举）。
