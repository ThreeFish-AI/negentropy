# 分镜表 · 《记忆管理：一张草稿纸和一本卡片册》（v1）

> **句 id 对齐**：镜=beat（narration.md v2 幕内空行分组），`beatWindow(sentences, scene.from, id, id2)` 取窗；句区间覆盖各幕全部句子、无交叠无遗漏（`check --check-scenes` 执法）。
> **时长**：以 `video/public/audio/manifest.json` 实测为准（edge 草声 13.25 分；终声后重派生）。
> **视觉契约**（与 [planning.md](./planning.md) §3 一致）：bg `#0E1116`／panel `#171C26`／text `#F2F5FA`／dim `#9AA7B8`；**mech 苔绿 `#A9C46C`=卡片册·记忆·长期（本集维度色）**；**core 橙 `#D97757`=循环内核恒定**（3D 层）；**账单金 `#EFB13C`=钱·成本·计费**；红线红 `#FF5C5C`（deny `#EF6461`）=破坏·拦截警示；确认绿 `#7ED321`=机制在位。灰白系底座=草稿纸·会话内。
> **顶部安全带 y<56** 归章节进度条；各镜画面 y≥56 起；底部角标 bottom≥150 避字幕条。
> **archify 引导图**：全屏独占三分法（`forbid_inset`）；图集预算表见文末；cue 一章锚一句、锚句全片唯一；前一镜为引导图实例的镜，其 `<ArchifyRecap>` 一律 lead=false（跨实例接缝防重入弹簧）。

## P0 重发的账单（组件 `P0Scratchpad.tsx`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A 草稿纸解剖 | p0-01..05 | ·**archify full**：scratchpad-anatomy 章 `fixed-prefix`+`pair-interlock`+`full-resend`（纸解剖全屏：指令区/消息对/全量重发边依次聚焦） | 章节回放三分句接力 |
| 0-B 大头与拒收 | p0-06..09 | ·**archify full**：scratchpad-anatomy 章 `heavy-results`（同图续章：巨型结果块聚焦，lead=false） | 章节回放 |
| 0-C 双问字卡 | p0-10..13 | 场景镜：全貌坐标装置首亮全图（草稿纸层／卡片册层／尾区三分卡，当前高亮草稿纸层，其余压暗）；双问字卡两联（「凭什么跑一整天不崩？」／「凭什么第二天还记得你？」，mech 苔绿点睛）；草稿纸母题小样（纸张+行线）右下驻场 | `@enter:rise` 坐标三分卡错峰落位〔M-001 恒定锚〕；`@impulse` 第二问字卡点睛 |

## P1 便宜的先跑（组件 `P1CheapFirst.tsx`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A 搬家三格 | p1-01..05 | 场景镜：搬家三步横移地图（仓储→装箱登记→清单处理三格；第三格旁小字「原件已归档」拦截标签）；下缘四格管线轮廓逐格点亮对位；坐标装置高亮草稿纸层·四层管线环节 | `@stagger` 三格横移；`@enter:rise` 对位点亮 |
| 1-B 落盘收据 | p1-07..09 | ·**archify full**：compact-pipeline 章 `cheap-first`（管线全景首亮，L1 层聚焦） | 章节回放 |
| 1-C 裁中段 | p1-11..12 | 场景镜：纸卷轴向特写——首 3/尾 46 条高亮带，中段整块吊入归档柜，原处留一行标记（画面字 50/3/46） | `@draw` 裁切线；`@travel` 中段块平移 |
| 1-D 换地址与八成 | p1-13..16 | 场景镜：旧结果块变装地址条（占位符化）；量尺指针压向 80% 刻度（账单金）；「还没读过的」新批结果块加防护罩（dim 虚线框） | `@count` 量尺指针；`@enter:pop` 防护罩 |
| 1-E 摘要殿后 | p1-17..20 | ·**archify full**：compact-pipeline 章 `bypass`+`batch-wait`（旁路虚线聚焦→compact 工具等批次章接力） | 章节回放两章接力 |
| 1-F T11 实测走查 | p1-21..25b | ·**archify full**：batch-walkthrough 章 `three-big`+`budget-pass`+`fit-fallback`+`final-zero`（三结果逐层数字流全屏走查，lead=false） | 章节回放四章接力（Animated State Trace） |
| 1-G 应急裁剪 | p1-27..29 | ·**archify full**：compact-pipeline 章 `reactive`（应急支聚焦，lead=false） | 章节回放 |

## P2 两条红线（组件 `P2RedLines.tsx`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A 小票互锁 | p2-01..05 | ·**archify full**：pairing-interlock 章 `paired-ok`+`torn-reject`+`retreat-fix`（配对时序三章接力：常态→黑单→回退修复）；空窗回落 p2-01 纸面互锁首现、p2-03..03 出菜口小票装置 | 章节回放三章接力 |
| 2-B 拆回退消融 | p2-07..11 | 场景镜：正反同屏消融（左坏：剪刀拆回退→断裂计数 0→1 跳红→mock 校验红章；右好：切点回退两拍动画→整对越过绿章）；下缘「等批次完成」锁定按钮（压缩按钮在进度条走完前灰锁） | `@count` 断裂计数 0→1；`@enter:slide` 剪刀两拍；警示红↔确认绿对置 |
| 2-C 快递与双保险 | p2-13..17 | ·**archify full**：unseen-guard 章 `unseen-safe`+`old-swap`+`two-guards`（未读保护状态图三章接力）；空窗回落 p2-14..15 门口快递装置 | 章节回放三章接力 |
| 2-D 拆保护消融 | p2-18..20 | ·**archify full**：unseen-guard 章 `guard-off`（破坏路径章，画面字 9,009→137，lead=false）；空窗回落 p2-19..20 两道保险收束卡 | 章节回放 |

## P3 压扁之后（组件 `P3AfterSummary.tsx`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A 偏好塌缩 | p3-01..04 | 场景镜：精确便签「缩进用 tab 不用空格」过摘要机（纸带传送），出纸字迹毛化变「用户有代码风格偏好」归类卡；两侧小字对照标签 | `@travel` 纸带；`@dim` 字迹毛化（透明度分层） |
| 3-B 四件事流水线 | p3-05..10 | ·**archify full**：summary-surgery 章 `four-steps`+`anti-inject`（四步主链+防注入旁支章接力） | 章节回放两章接力 |
| 3-C 熔断 | p3-11..12 | ·**archify full**：summary-surgery 章 `fuse-3`（熔断章，出处角标「讲义口径／开源代码无实现」双标签由场景层叠加，lead=false） | 章节回放 |
| 3-D 换层镜 | p3-13..16 | 场景镜：全貌坐标装置整幅切换——草稿纸层收起压暗，卡片册层（苔绿）整幅点亮展开；新对话开场白浮出「连摘要都不剩」 | `@enter:fade` 层切换交叉淡化〔M-001〕；`@pushIn` 卡片册层展开 |

## P4 目录与正文（组件 `P4CatalogBody.tsx`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A 卡片册解剖 | p4-01..04 | ·**archify full**：memory-file-anatomy 章 `one-file`+`frontmatter`+`four-types`（存储解剖三章接力） | 章节回放三章接力 |
| 4-A2 写入全景回看 | p4-05..06 | ·**archify full**：recall-loop 章 `write-rebuild`（全景图写入章：写文件+索引重建，锚写入例句；lead=false；p4-06 四类两例装置由场景层持有） | 章节回放 |
| 4-B 复印店账单 | p4-07..13 | ·**archify full**：cache-economics 章 `prefix-hit`+`one-char`+`two-lanes`（复印店三章接力，账单金主轴，lead=false） | 章节回放三章接力 |
| 4-C 两层加载 | p4-14..16 | ·**archify full**：recall-loop 章 `two-channels`（全景图两通道章：目录常驻缓存价 vs 正文按需，lead=false） | 章节回放 |
| 4-D 旁路挑选 | p4-17..18b | ·**archify full**：sidecar-selection 章 `sidecar-pick`+`budget-funnel`（旁路时序+限额漏斗两章接力，lead=false） | 章节回放两章接力 |
| 4-E 降级与安全阀 | p4-20..23 | ·**archify full**：sidecar-selection 章 `fallback-valve`（降级+安全阀章，lead=false）；句 p4-23 收束字卡「有什么常驻 · 是什么按需」由场景层右缘叠加 | 章节回放 |

## P5 三道门（组件 `P5ThreeGates.tsx`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A 提取时机 | p5-01..03 | ·**archify full**：recall-loop 章 `extract-gates`（全景图提取章：会话尾+压缩前快照） | 章节回放 |
| 5-B 三句穿门 | p5-05..10 | ·**archify full**：memory-gates 章 `three-in`+`first-pass`+`second-block`+`third-block`+`one-of-three`（三句穿门走查五章接力，lead=false；终态计数「入库 1/3」由图章 note 承载） | 章节回放五章接力（Animated State Trace 全片高潮） |
| 5-C 便签对置 | p5-11..14 | 场景镜：会议纪要本（苔绿·跨次生效）vs 桌角便签（灰·当次作废）对置卡；拦截提示条「关键词级一刀切」 | `@enter:rise` 对置卡；`@impulse` 拦截条 |
| 5-D 事务整理 | p5-15..20 | ·**archify full**：consolidation-txn 章 `trigger-snapshot`+`swap-write`+`fail-rollback`+`no-snapshot`（事务四章接力，含 10→0 破坏章） | 章节回放四章接力 |
| 5-E 界线卡 | p5-21..23 | ·**archify full**：recall-loop 章 `consolidate`（p5-21 全景图整理章回看，承接 5-D 事务链，lead=false）；场景镜：界线卡（左「草稿纸内的腾挪：省着放」/右「卡片册：跨会话值得留」）；地图坐标小图（官方产品两席定位）；卡片册母题合拢定格 | `@enter:settle` 界线卡；`@breathe` 卡片册苔绿辉光收束 |

## P6 照进生产（组件 `P6Production.tsx`）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A 双问回收与对照 | p6-01..05 | ·**archify full**：compact-pipeline 章 `cheap-first`（p6-03 开源教学骨架回看，空窗后重现默认入场）；场景镜：双问字卡回收（两联卡与五规律总括句同帧点亮）；「教学四层 vs 生产五层」对照高亮条（左列四层·灰白系，右列五层·右起第五层苔绿高亮+标签「独立回收系统」）；坐标装置点尾区 | `@enter:fade` 双问回收；`@stagger` 对照条两列逐层点亮；`@count` 层计数 4→5 |
| 6-B 互证双标尺 | p6-07..09 | 场景镜：双标尺（useCount 动态）——左：1M 窗口标尺+967K 触发线（工况角标【官】）；右：目录页双格上限「头 200 行／25KB」双点重合闪亮（基线=官方文档口径） | `@count` 标尺水位；`@impulse` 双点重合 |
| 6-C 生产形态两帧 | p6-10..11 | 场景镜：挑选帧——卡片墙按修改时间排序扫描、犹豫卡盖「拿不准就不选」章、选中 ≤5 张苔绿描边；提取帧——回合结束挂钩弹起→fire-and-forget 箭头射出→受限进程图标（角标「不写对话记录 · 最多五轮」） | `@travel` 扫描游标；`@enter:pop` 挂钩弹起；`@flowDash` 箭头 |
| 6-D 五规律卡 | p6-12..17 | ·**archify full**：pairing-interlock 章 `retreat-fix`（p6-14 结构规律回看）·**archify full**：cache-economics 章 `prefix-hit`（p6-15 经济学规律回看，lead=false）·**archify full**：memory-gates 章 `one-of-three`（p6-16 治理规律回看，lead=false）；场景镜：五规律卡逐条翻页（代价阶梯／配对完整／前缀稳定／垃圾优先／索引正文分离；每卡一行判词），总括句与首卡同帧；角标 LSM-tree / B-tree 小字 | `@stagger` 五卡翻页；`@enter:rise` 判词行 |
| 6-E 边界与收尾 | p6-18..25 | 场景镜：两争议悬置双面卡（窗口大小之争／提取时机之争，不裁决）；边界护栏卡（成立前提三条件+Out-of-Scope 一行）；五层 Harness 栈放大居中（记忆层苔绿点亮，系列身份卡）；下期卡《并发：谁来按下开始》；坐标装置尾区收束；末镜渐黑 | `@enter:fade` 悬置卡翻转；`@breathe` 记忆层脉冲；`@fadeOut` 末 beat 总时长推导渐黑（红线四） |

## 字幕规范

底部单行、一句一条、zh 恒单行 30px；与配音逐句同步（`NarrationAudio` + manifest 时序）；句尾「。」渲染层剥除（系列现行代）；字幕带占底部 ~98px，各镜角标 bottom≥150。

## 实现映射

| 幕 | 组件 | 主装置 |
|---|---|---|
| P0 | `P0Scratchpad.tsx` | 全貌坐标装置（`components/map-anchor.tsx` 新建）、双问字卡 |
| P1 | `P1CheapFirst.tsx` | 搬家三格、纸卷裁切、量尺、防护罩 |
| P2 | `P2RedLines.tsx` | 正反同屏消融台、剪刀切点、锁定按钮 |
| P3 | `P3AfterSummary.tsx` | 摘要机纸带、毛化、换层编排 |
| P4 | `P4CatalogBody.tsx` | 复印店由引导图承载、收束字卡叠加 |
| P5 | `P5ThreeGates.tsx` | 便签对置、界线卡、母题合拢 |
| P6 | `P6Production.tsx` | 对照条、双标尺、卡片墙、五规律卡、护栏卡、`components/harness-stack.tsx`（复制自 ep4）、下期卡 |

公共：`components/motifs.tsx`（seeded chrome 层 Panel/Footnote/SceneTag/Counter/CodeCard/NumberedCard）+ 本集新增 `map-anchor.tsx`（全貌坐标装置）+ `harness-stack.tsx`（系列复制源 ep4，层序/层名读 series-layers.json）；`ArchifyRecap` 三件为 frozen 薄包装。信源卡（P6 依据与致谢）四条固定行走 8-E 右下小字（系列惯例）。

## archify 图集预算表

12 图（10 新绘＋2 复用重建）· 5 型 · 45 章引导故事 · 48 cue 落镜（密度按实测分钟复算 ≥3.0；句级锚定率 44/139=31.7% ≥30%）：

| # | 图 | 型 | 章数 | cue 落镜 |
|---|---|---|---|---|
| 1 | scratchpad-anatomy | architecture | 4 | 0-A×3 · 0-B×1 |
| 2 | compact-pipeline（重建） | workflow | 4 | 1-B×1 · 1-E×2 · 1-G×1 · 6-A×1（回看） |
| 3 | batch-walkthrough | dataflow | 4 | 1-F×4 |
| 4 | pairing-interlock | sequence | 3 | 2-A×3 · 6-D×1（回看） |
| 5 | unseen-guard | lifecycle | 4 | 2-C×3 · 2-D×1 |
| 6 | summary-surgery | lifecycle | 3 | 3-B×2 · 3-C×1 |
| 7 | memory-file-anatomy | architecture | 4 | 4-A×3（index-rebuild 章由图 10 write-rebuild 同语义覆盖，不落镜） |
| 8 | cache-economics | dataflow | 3 | 4-B×3 · 6-D×1（回看） |
| 9 | sidecar-selection | sequence | 3 | 4-D×2 · 4-E×1 |
| 10 | recall-loop（重建） | workflow | 4 | 4-A2×1 · 4-C×1 · 5-A×1 · 5-E×1（四章全落镜） |
| 11 | memory-gates | workflow | 5 | 5-B×5 · 6-D×1（回看） |
| 12 | consolidation-txn | lifecycle | 4 | 5-D×4 |

不落镜一章的处置已按覆盖门双向对账登记：图 7 index-rebuild（由图 10 write-rebuild 同语义承接）。
