# 分镜：规划与协调：视野错位的五种修正手法

> 逐字稿 SSOT：[narration.md](./narration.md)（v2，155 句 / 3428 字；估算 13.5 分 @254 字/分，终值以音频 manifest 实测为准）。
> 幕 ↔ 组件：P0→`P0Failures` P1→`P1Todo` P2→`P2Subagent` P3→`P3Skills` P4→`P4Prompt` P5→`P5Recovery` P6→`P6Rules`。
> **本集视觉契约**（与 planning.md §三同源）：core 陶土橙 `#D97757`=循环内核（全系列恒定锚〔M-001〕）；coreDeep `#B45A3C`=内核暗态；mech 鸢紫 `#9C90EE`=本集五装置维度；mechDeep `#7A72C4`=装置暗态；警示红 `#FF5C5C`=拆解/故障侧；确认绿 `#7ED321`=机制在位/恢复成功。深底 `#0E1116`。
> **画面纪律**：画面文字 ≤6 字、只放关键词/数字/标签/结构；英文方法名只进角标；零信源站标识（规则 7）；顶部安全带 y<56 归章节条，内容 y≥56 起；字幕带避让 bottom≥150。
> **archify 档位**：全屏独占（forbid_inset）；一个 cue = 章节 id + 锚句；同锚句禁双 cue；跨实例背靠背后挂 `lead={false}`。
> **工坊剧场角色单射**（170 §2 台账 + 本集新增一席）：台面=上下文、工序卡=待办、副台=子代理、抽屉标签/手册=技能目录/正文、垫纸=system prompt、传送带=主循环、插线口=钩子；**新增：分诊口=恢复逻辑**（仅此一席，不与帮手/卡片系撞名）。

## 图集预算表

| # | slug | 型 | 服务幕/句段 | 章数 |
|---|---|---|---|---|
| 1 | pc2-panorama | workflow | P0 总亮 p0-16；P1–P4 挂点回照 p1-01/p2-01/p3-01/p4-01 | 5 |
| 2 | pc2-failures | workflow | P0 蒙太奇 p0-03/06/10/11/12 | 5 |
| 3 | pc2-todo-nag | lifecycle | P1 装置/计数/注入/消融 p1-03/06/08/14 | 4 |
| 4 | pc2-sub-guard | architecture | P2 三不/防线/回退 p2-09/12/14b | 3 |
| 5 | pc2-sub-lanes | sequence | P2 走查/回执/对比 p2-15/17/18 | 3 |
| 6 | pc2-skill-levels | architecture | P3 两级/成本/生命周期 p3-04/07/12 | 3 |
| 7 | pc2-skill-cost | dataflow | P3 消融/结论 p3-15/18 | 2 |
| 8 | pc2-prompt-shelf | workflow | P4 分段/实况/独立维护 p4-07/08/09b | 3 |
| 9 | pc2-prompt-cache | dataflow | P4 走查/指纹/污染 p4-10/14/16 | 3 |
| 10 | pc2-triage-map | workflow | P5 挂点/截断/超限/瞬态 p5-01/07/10/11 | 4 |
| 11 | pc2-backoff-scale | dataflow | P5 序列/抖动 p5-12/13 | 2 |
| 12 | pc2-recovery-ledger | lifecycle | P5 账本/消融/结论 p5-17/19/21 | 3 |
| 13 | pc2-rules | lifecycle | P6 五规律逐条 p6-02..06 | 5 |
| 14 | pc2-ablation-bar | dataflow | P6 口径/裁决 p6-13/14 | 2 |

锚定预算：图 14 / 型 5（workflow4·lifecycle3·sequence1·architecture2·dataflow4）/ cue 47 → 密度 3.5/min ≥3.0 ✓。

## P0 五个失败现场（组件 `P0Failures`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A | p0-01..02 | 系列片头 HarnessStack 五层栈自底向上落板，第二层「规划与协调」高亮脉冲两次后缩为顶边常驻条；传送带环居中缓转 | `@stagger` 落板；`@breathe` 本层点亮〔M-001〕 |
| 0-B | p0-03..05 | ·**archify full**：pc2-failures `fail-plan` | 全屏逐章回放（工序卡挤落） |
| 0-C | p0-06..08 | ·**archify full**：pc2-failures `fail-flood` | 全屏逐章回放（120 条淹没） |
| 0-D | p0-09..12 | ·**archify full**：pc2-failures `fail-carry` + `fail-clash` + `fail-crash`（背靠背，后挂 lead={false}） | 全屏逐章回放（红色调收尾；as-built：p0-09 为章前空窗句，cue 自 p0-10 起） |
| 0-E | p0-13..15c | 五格收拢成一行错位示意「看到的 ≠ 需要的」；台面标注「上下文=模型这一轮看到的全部消息」 | 两行格组先后推入（as-built：translateX 渐入，未走 `@pushIn` 命名 hook）〔M-003〕 |
| 0-F | p0-16..20 | ·**archify full**：pc2-panorama `pan-loop` | 全屏逐章回放 |

## P1 计划回到视野（组件 `P1Todo`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A | p1-01..02 | ·**archify full**：pc2-panorama `pan-m1` | 全屏逐章回放（挂点①回照） |
| 1-B | p1-03..05 | ·**archify full**：pc2-todo-nag `nag-device` | 全屏逐章回放（三态工序卡） |
| 1-C | p1-06..08 | ·**archify full**：pc2-todo-nag `nag-count` + `nag-fire`（背靠背，后挂 lead={false}） | 全屏逐章回放（刻度环+注入） |
| 1-D | p1-09..13 | 类型注解任务走查：五轮标签轮转（交计划→改文件→跑测试→修失败→提醒回看），工序卡状态随轮迁移 | 高亮逐轮迁移（as-built：句边界驱动 activeIdx，未走 `@flow` 命名 hook）；`rel(beat,'p1-11')` 驱动 |
| 1-E | p1-14..17b | ·**archify full**：pc2-todo-nag `nag-ablate` | 全屏逐章回放（0↔1 消融标尺） |
| 1-F | p1-18..20 | 工序卡淡出标注「内存态·进程退出即清」；台面右侧过程条目涌入钩到 P2 | `@fadeout` |

## P2 大过程挪出去（组件 `P2Subagent`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A | p2-01..03 | ·**archify full**：pc2-panorama `pan-m2` | 全屏逐章回放（挂点②回照） |
| 2-B | p2-04..05 | 主台面与副台分屏：副台自开新消息列表自跑循环，末尾只撕下一页回执飞回主线 | `@enter:slide` 分屏；`@travel` 回执 |
| 2-C | p2-06..08 | 外包顾问意象三拍：自带笔记本/只交一页结论；门禁卡+共享盘高亮；失配句压角标「类比边界 · 另一个人 ≠ 另一场对话」（v4 关键词化 as-built） | `@stagger` 三拍〔四定式②〕 |
| 2-D | p2-09..14b | ·**archify full**：pc2-sub-guard `guard-three` + `guard-notask` + `guard-fallback`（接力） | 全屏逐章回放（三不+防线+回退） |
| 2-E | p2-15..19 | ·**archify full**：pc2-sub-lanes `lanes-walk` + `lanes-receipt` + `lanes-contrast`（接力） | 全屏逐章回放（走查+回执+19↔2） |
| 2-F | p2-20 | 副台收拢回全景挂点②，抽屉格预告 P3 | `@pushIn` |

## P3 知识按需进场（组件 `P3Skills`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A | p3-01..03 | ·**archify full**：pc2-panorama `pan-m3` | 全屏逐章回放（挂点③回照） |
| 3-B | p3-04..07 | ·**archify full**：pc2-skill-levels `levels-two` + `levels-cost`（接力） | 全屏逐章回放（两级+token 对比） |
| 3-C | p3-08..11 | SQL 规范走查：抽屉标签常驻垫纸；点名后手册整本抽出经工具结果落进消息流 | 三级先后淡入（as-built：`@draw`/`@travel` 未实装，降级 useProgress 淡入）〔四定式②〕 |
| 3-D | p3-12..14c | ·**archify full**：pc2-skill-levels `levels-lifecycle` | 全屏逐章回放（常驻 vs 可裁） |
| 3-E | p3-15..19 | ·**archify full**：pc2-skill-cost `cost-ablation` + `cost-ruling` | 全屏逐章回放（128→5981 标尺+结论） |

## P4 指令按实况拼装（组件 `P4Prompt`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A | p4-01..03 | ·**archify full**：pc2-panorama `pan-m4` | 全屏逐章回放（挂点④回照） |
| 4-B | p4-04..06 | 每日菜单意象三拍：招牌菜恒印/时令菜看货/昨天那页复用（=缓存）；失配句角标 | `@stagger` 三拍〔四定式②〕 |
| 4-C | p4-07..09b | ·**archify full**：pc2-prompt-shelf `shelf-sections` + `shelf-state` + `shelf-split`（接力） | 全屏逐章回放（分段+实况+独立维护） |
| 4-D | p4-10..13 | ·**archify full**：pc2-prompt-cache `cache-hit` | 全屏逐章回放（三段→命中→四段走查） |
| 4-E | p4-14..15 | ·**archify full**：pc2-prompt-cache `cache-fingerprint` | 全屏逐章回放（拼串成键） |
| 4-F | p4-16..19 | ·**archify full**：pc2-prompt-cache `cache-dirty` | 全屏逐章回放（5/0 标尺消融） |
| 4-G | p4-20..21 | 两层缓存双栏图：本地拼串层 vs 服务端前缀层「开头不变按开头复用」 | 双栏先后淡入（as-built：`@flowDash` 未实装）；钩到 P5 |

## P5 断了分类自愈（组件 `P5Recovery`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A | p5-01..03 | ·**archify full**：pc2-triage-map `triage-mount` | 全屏逐章回放（挂点⑤回照=分诊口包住调用步） |
| 5-B | p5-04..06 | 修打印机意象三拍：换墨盒/抽纸/换备用机；失配句角标「记账无对应，回工程术语」 | `@stagger` 三拍〔四定式②〕 |
| 5-C | p5-07..09 | ·**archify full**：pc2-triage-map `triage-trunc` | 全屏逐章回放（路径一：截断→升级→续写） |
| 5-D | p5-10..10b | ·**archify full**：pc2-triage-map `triage-overflow` | 全屏逐章回放（路径二：压缩留 5 仅一次） |
| 5-E | p5-11..12 | ·**archify full**：pc2-triage-map `triage-transient` + pc2-backoff-scale `backoff-seq`（跨图背靠背，后挂 lead={false}） | 全屏逐章回放（瞬态路径+三连等） |
| 5-F | p5-13..16b | ·**archify full**：pc2-backoff-scale `backoff-jitter` | 全屏逐章回放（双序列+抖动） |
| 5-G | p5-17..21 | ·**archify full**：pc2-recovery-ledger `ledger-book` + `ledger-ablation` + `ledger-ruling`（接力） | 全屏逐章回放（账本+8↔1+止损结论） |
| 5-H | p5-22 | 五挂点齐亮全景缩略收拢 | `@breathe` |

## P6 五条规律（组件 `P6Rules`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A | p6-01..06 | ·**archify full**：pc2-rules `rule-position` + `rule-state` + `rule-lossy` + `rule-ledger` + `rule-structure`（五条接力） | 全屏逐章回放（金句条快板；as-built：p6-01 为规律引入句，章前空窗有意保留，cue 自 p6-02 起） |
| 6-B | p6-07..10d | 争议双栏：全新上下文（正确）↔ 缓存友好前缀（成本），天平意象；第二对取舍两行 | 双栏 stagger 淡入（as-built：`@enter:rise` 未实装） |
| 6-C | p6-11..14b | 护栏卡三行（教学设定/缺对照组/只是口径；as-built：原文与口播 4 连字同窗复述，R5 关键词化）；·**archify full**：pc2-ablation-bar `ablation-scale` + `ablation-ruling`（接力，p6-13/p6-14 锚） | 卡片浮现；全屏逐章回放 |
| 6-D | p6-15..17 | 系列身份卡（五层栈缩略，本层点亮）+ 下期卡（下期标题主段「会丢的和不能丢的」）+ 信源卡四行；工坊灯牌收暗 | `@stagger` 卡组；`@fadeout` 收暗（红线四：末 beat 总时长推导渐黑） |

## 字幕规范

底部单行、一句一条、与配音逐句同步（frozen Subtitle 组件；渲染层剥句尾「。」）；字号与安全带由骨架组件自带，字幕带侵入由 qa 门执法。

## 公共组件清单

系列装置（自 ep1 复制裁剪）：`HarnessStackP0/P6`、`HarnessBadge`；共享：`ArchifyRecap/ArchifyClip/ArchifyYield`（frozen 三件套）、`Panel`（chrome 层 motifs 存活件；Footnote/SceneTag/CodeCard/NumberedCard 已随重制退役）、金句卡（cards）。本集新增装置 as-built 均为场景内联实现、未提取共享组件：工序卡（`P1Todo` FiveRoundWalk + pc2-todo-nag 图内三态卡）、回执条（`P2Subagent` SideDeskSplit 飞页）、计数刻度环与消融双标尺（pc2-todo-nag 图内 nag-count/nag-ablate 章）。
