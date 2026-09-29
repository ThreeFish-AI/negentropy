# 分镜：记忆管理：会丢的和不能丢的（v1）

> 逐字稿 SSOT：[narration.md](./narration.md)（163 句 v2——句 id 即本表定位锚，时序与 [narration.json](./narration.json) 逐句一致）；时长以 audio manifest 实测为准（规划 3,644 字 ≈ 14.3 分 @254 story 档实测口径，硬窗 [13.0, 14.6] 分）。
> 一镜（beat）＝2–8 句连续句共享同一主画面，镜界逐条沿 ⑤ 成文优化已切好的空行 beat（本集 36 镜＝narration 36 个 beat 块一一对应，TTS 台本块与镜界天然对齐）；句区间覆盖本幕每一句、无交叠无遗漏（`check_script.py` 强制）；镜号与 `scenes/P*.tsx` 内嵌 `<Sequence name="N-X">` 规范对应。
>
> **本集视觉契约**（[theme.ts](../video/src/design/theme.ts)，与 [planning.md](./planning.md) §三一致）：
> `core` 陶土橙 `#D97757`＝台面／循环内核（压缩始终围绕它腾位）——**全系列恒定视觉锚〔M-001〕**：台面母题锁死描边色与绝对线宽，全片同形出场只换周边标签 · `coreDeep` `#B45A3C`＝台面深态（账目细节／压扁条的内面）· `mech` `#A9C46C`＝挂在台面之外的记忆机制（本集维度色·记忆绿：收台四步装置／取货条／登记簿／扉页／目录员／夜班）· `mechDeep` `#7A9448`＝机制深态（登记簿内页／面板描边／装置暗态）· `deny` `#EF6461`＝拒绝与危险唯一语义（API 拒收／找不到原文的路／反向门）· `dim` `#9AA7B8`＝人色（用户叮咛／转录存档／悬置判断——灰＝唯一无彩色的环节）· `ok` `#7ED321`＝确认瞬间瞬态（落盘完成／配对保全）· 师傅／用户／数据流一律无彩（`text` 白／`dim` 灰）——**装置才有颜色**。（theme.ts 种子内 `conceptDeep/mechDeep #7FA050` 系 scaffold 残留，Stage ⑧ 落本表契约值并过 `--check-theme` 复算——以本表与 planning §3 为准。）
> 恒定空间契约（防〔X-001〕空间逆旁白）：台面恒居画面**左中锚位**（core 橙）；会丢的机制（收台动作）从**上缘**压入、向下腾位；不能丢的登记簿从**右缘**挂入（mech 绿）；「腾位」与「登记」两组动效互不侵入对方锚区；金句卡衬线体（`theme.serif`）；占位符／标签原文（`Re-run if needed`、`MEMORY.md` 等）只进画面角标与引语卡（mono 等宽引语态），不进口播。
>
> **画面纪律**：画面文字只放关键词／数字／标签（≤6 字），不复述口播（RSI-007——金句卡主字均压短形态，逐字重合面 <10 字安全线内）；英文标识符只进角标；顶部安全带 y<56 由章节条占用，画面内容 y≥56 起，SceneTag 维持 top:64；【三】归属角标统一「开源项目作者 · 源码分析」，画面零信源站标识、零他集标题。
> **archify 资产档位**：全屏独占（`forbid_inset`，无画中画）——播放期自制装置由 ArchifyYield 淡出让位或空窗句回落；章节数据＝录制 SSOT，见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长＝拍数 × max(1100ms, 3200ms/拍数)；cue 纪律：一章锚一句（`at('句id')` + `dur('同句id')` 单参），同锚句双 cue 即 FAIL，跨实例背靠背后挂实例须 `lead={false}`。
> ⚠️ 动效列与一切散文**禁写**画面列那套档位字面标注（覆盖门按全文计数断言，多一处命中即 FAIL）；`@动词` 只用 [motion/hooks.ts](../video/src/motion/hooks.ts) 实存模型，判据＝本镜 `<Sequence>` 内由本幕 scene 自身定义的装置调用了该 `useXxx(`（`components/` 内装置承担者一律散文点名，不产生 token）。

## 图集预算表（12 图＝10 新绘＋2 复用；5 型；62 章＝62 cue（章章有锚）；锚定率 62/163 ≈ 0.38 ≥ 0.30；密度 ≈4.3/分 ≥ 3.0——时长以 manifest 实测为准）

| # | slug（新绘落 `docs/assets/architecture/agent-harness/claude-code--<slug>.html`） | 型 | 服务幕/句段 | 章 |
| --- | --- | --- | --- | --- |
| 1 | compact-pipeline | workflow | P1 四层与顺序（p1-03..08） | 6 |
| 2 | pair-guard | state | P1 配对铁律（p1-16..20） | 5 |
| 3 | pointer-trade | dataflow | P2 搬仓库与占位符（p2-02..06, p2-08） | 6 |
| 4 | compact-entries | lifecycle | P2 入口与应急（p2-17..19, p2-21..23） | 6 |
| 5 | lossy-summary | state | P3 有损塌缩（p3-02..06）＋官方对照段教学版侧回放（p3-16） | 5 |
| 6 | memory-ledger | architecture | P4 扉页派生重建（p4-06..09） | 4 |
| 7 | four-memory-types | dataflow | P4 四问分型（p4-10..12） | 3 |
| 8 | two-layer-loading | dataflow | P4 两层加载（p4-14..17, p4-20）＋目录员旁路（p4-24）＋挑选口径（p4-29） | 7 |
| 9 | stop-extraction | workflow | P5 撂活抽取（p5-06..10） | 5 |
| 10 | night-shift | lifecycle | P5 夜班整理（p5-15..22 择五锚） | 5 |
| 11 | memory-panorama（**复用**：主仓既有 `claude-code-memory--memory-panorama.html`，guided-views 为空——录制前按本集 views 回填章节、focus 对齐既有节点语义） | lifecycle | P6 演进彩蛋（p6-03, p6-05）＋全景兑现（p6-08..14 择五锚） | 7 |
| 12 | five-layer-dependency（**复用**：主仓既有 `claude-code-harness--five-layer-dependency.html`，同上回填） | architecture | P0 立碑一闪（p0-12）＋P6 读图收尾（p6-18..19） | 3 |

> 型多样性＝workflow×2 / state×2 / dataflow×3 / lifecycle×3 / architecture×2 ＝ 5 型 ≥ 5（sidecar 顶层 `type` 录制时按本表落盘）。复用图与 `html_pattern` 不匹配，在此显式登记，Stage ⑦ 录制前落 pipeline.toml 两行映射（本表即落点声明）：
>
> ```
> [archify.html_overrides]
> memory-panorama = "claude-code-memory--memory-panorama.html"
> five-layer-dependency = "claude-code-harness--five-layer-dependency.html"
> ```
>
> 两处 Stage ⑥ 裁定（覆盖门无锚 run ≤12 所需，语义同源故不另立图）：⑤号图尾章 `all-for-one-line` 锚 p3-16——「全部历史换一条消息」即该图塌缩终态，官方对照段回放教学版侧；⑧号图尾二章 `side-query`/`model-not-vectors`——目录员挑选是按需轨上游（p4-16「开工前挑出相关几页」同机制），归入两张 loading 图，目录员小剧场正文与零向量卡仍走 2D 回落。P0/P6 归 3D 系列装置（HarnessStack）＋上表 11/12 两张收束图。

## P0 打烊清台（p0-01..13）→ `scenes/P0NightClosing.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A（3D） | p0-01..04 | HarnessStackP0 3D 五层栈自底向上落板（components/harness-stack.tsx 承担）→ 本集层「记忆层」点亮呼吸两次 → 其余层压暗待缩退为顶边常驻条（HarnessBadge，P1–P6 沿用）；工坊灯调暗——师傅剪影（`text` 白无彩）撂下工具、离场步态；主问题字卡居中「它还记得什么」（问句形态，问号 `deny` 红点睛）；角标 `session end` | 栈落板／呼吸／缩退在 HarnessStackP0 内（不产生 token）；字卡落下 `useEnter:fall`；灯暗随 p0-02 句推进 `useDim`；问号红点一次性 `useImpulse`；`@enter:fall` `@dim` `@impulse` |
| 0-B | p0-05..09 | 台面堆满：motifs.BenchTop 台面母题首现（`core` 橙恒定描边〔M-001〕，恒左中锚位）——文件页／命令输出条／回复气泡自上缘压入逐层堆高（会丢侧动效自上缘）；红色印章「提示太长」盖在台面右上（`deny`）；p0-08 大输出条横占整幅台面；数字角标 `tool_result ≤ 500KB`；角标 `messages`、`prompt_too_long` | 堆叠逐层压入 `useStagger`；印章盖下 `useEnter:fall`＋红闪 `useImpulse`（p0-07 拒收句）；大输出条铺满 `useProgress`；`@stagger` `@enter:fall` `@impulse` `@progress` |
| 0-C | p0-10..13 | 两本账预告：收台剪影（题词「会丢的」）与登记簿剪影（题词「不能丢的」）自右缘挂入（`mech` 绿 ×2，不触碰左中 core 台面锚位）；p0-12 让位系列栈图一闪；p0-13 回落——碑卡衬线定格「记忆不是一个功能」（悬念态，右下小字「等两本账翻完」） ·**archify full**：five-layer-dependency 章 `layer-flash` | 两剪影滑入 `useEnter:slideR`＋常驻辉光 `useBreathe`（`mech`）；碑卡定格终态〔M-003〕；`@enter:slideR` `@breathe` |

## P1 收台四步（p1-01..22）→ `scenes/P1Compaction.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A（3D 一现） | p1-01..06 | p1-01..02：3D 台面堆高一现（components/solids-3d.tsx 承担，planning §3 唯二 3D/Lottie 点缀之一）——物件立体堆叠逼满 → 收敛为 2D BenchTop 台面母题（`core` 橙恒线宽〔M-001〕）；收台工剪影上场（`mech`）；章标语字卡「上下文总会满」；p1-03 起让位收台管线图 ·**archify full**：compact-pipeline 章 `four-layers`+`cost-ladder`+`text-vs-llm`+`one-llm-call` · 角标 `context window` 由镜首段承担 | 3D 堆叠与收敛在 solids-3d 内（不产生 token）；收台工淡入 `useEnter:fade`；标语卡上浮 `useEnter:rise`；p1-03..06 由 ArchifyRecap 主控；`@enter:fade` `@enter:rise` |
| 1-B | p1-07..10 | 讲课编号列（灰置 1–4）与实序列对撞；成本列 0/0/0/1 恒亮 ·**archify full**：compact-pipeline 章 `teach-vs-real`+`real-order` · p1-10 空窗回落：伏笔小条「顺序不能换 · 下一幕」（`dim` 描边） | 空窗句小条弹入 `useEnter:pop`；其余由 ArchifyRecap 主控（跨实例背靠背接 1-A，本镜 `lead={false}`）；`@enter:pop` |
| 1-C | p1-11..15 | 四层速览小卡横排（2D）：裁中段（保头尾）／压条子（一行小字）／搬仓库（留取货条）／记录员（摘要卡），卡角标注讲课编号；每句点亮对应卡 · 角标 `[snipped N messages]` | 四卡依次入场 `useStagger`；每句对应卡强调一次 `useImpulse`（衰减包络）；`@stagger` `@impulse` |
| 1-D | p1-16..20 | 工序卡与回单成对铁律 ·**archify full**：pair-guard 章 `pair-rule`+`pair-bound`+`orphan-rejected`+`cut-yields`+`content-vs-structure` · 五句五接力无空窗 · 角标 `tool_use ↔ tool_result` 由图内承担 | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担（本镜无动效 hook） |
| 1-E | p1-21..22 | 常量打码卡：触发条数／保留窗口／长度门三行数值全部打码（■■■），标签「随版本漂移」（`dim`）；下方恒亮行「顺序 · 铁律」（`mech` 描边） | 打码块依次落下 `useStagger`；恒亮行呼吸 `useBreathe`（`mech` 低频）；`@stagger` `@breathe` |

## P2 指针换空间（p2-01..29）→ `scenes/P2PointerSpace.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..05 | p2-01 引子：镜头拉近——台面全景缩聚焦到「搬仓库」工位（2D 聚焦框收缩）；p2-02 起让位指针置换图 ·**archify full**：pointer-trade 章 `batch-account`+`size-queue`+`parcel-tag`+`full-on-disk` · 数字卡「预览 2000 字符」由图内承担 · 角标 `<persisted-output>` | 引子聚焦框收缩 `useProgress`（decelerate）；p2-02..05 由 ArchifyRecap 主控；`@progress` |
| 2-B | p2-06..09 | p2-06 让位：旧条子滑出窗口压扁 ·**archify full**：pointer-trade 章 `slide-and-flatten`+`hint-no-address` · p2-07 空窗回落：占位符引语卡（mono 等宽引语态，整行 `[Earlier tool result compacted. Re-run if needed.]`）；p2-09 回落：判断小卡「可重放 ≠ 可归档」（两词对置，后段 `deny` 划掉） | 引语逐字流出 `useReveal`（mono）；判断小卡弹入 `useEnter:pop`；其余由 ArchifyRecap 主控（跨实例背靠背接 2-A，本镜 `lead={false}`）；`@reveal` `@enter:pop` |
| 2-C | p2-10..12 | 顺序力学对撞卡（2D）：上路「先落盘 → 再压条」`ok` 绿勾放行 ／ 下路「先压条 → 再落盘」`deny` 红叉（标注「原文已没」）；金句卡衬线定格「先抄地址 · 再扔东西」（压短形态） · 角标 `顺序不能换` | 双路卡对开 `useEnter:slideL`＋`useEnter:slideR`；红叉抖动 `useShake`（decay）；绿勾一次性 `useImpulse`；金句卡 QuoteCard 终态〔M-003〕；`@enter:slideL` `@enter:slideR` `@shake` `@impulse` |
| 2-D | p2-13..16 | 找不到的路演示（2D，「教学版」徽标置顶限定）：左＝台面——已落盘的大结果连同取货条一起滑出最近窗口 → 取货条压扁成无地址通用提示（`mech` 转 `dim`）；右＝磁盘仓库原件仍在（`dim` 灰置）；中缝断线（两段虚线不相连，`deny`「无路可达」标注） · 角标 `claim tag → generic hint` | 滑出 `useProgress`；取货条压扁 `useSpring`（局部帧）；断线描出 `useDraw`；「无路可达」红标闪 `useImpulse`（p2-16 句）；`@progress` `@spring` `@draw` `@impulse` |
| 2-E | p2-17..20 | 压缩入口图 ·**archify full**：compact-entries 章 `entries-overview`+`auto-gate`+`manual-tool` · p2-20 空窗回落：开新一轮小卡——回执条落下、新一轮起跳线（`mech`） · 角标 `compact`、`/compact` | 空窗句小卡弹入 `useEnter:pop`；其余由 ArchifyRecap 主控；`@enter:pop` |
| 2-F | p2-21..25 | 应急车道 ·**archify full**：compact-entries 章 `rescue-lane`+`tail-five`+`once-only` · p2-24..25 空窗回落：尺子不准小卡——字符数刻度尺（刻度密集）与真实占用曲线（上翘）错位，偏差带 `deny` 填充 · 角标 `estimate`、`[auto compact]`、`[reactive compact]` | 空窗句刻度滚动 `useCount`＋偏差带闪 `useImpulse`；其余由 ArchifyRecap 主控（空窗后重现，保持默认 lead）；`@count` `@impulse` |
| 2-G | p2-26..29 | 官方对照卡（2D）：官方文档页样三行摘要（自动压缩确认／手动同机制／阈值可调）＋次序条「先清旧输出 → 再摘要」；子代理侧间小工位一闪（无收台工，题词「自己的台面」） · 角标 `subagent` | 官方卡三行逐条 `useStagger`；小工位淡入淡出 `useEnter:fade`；`@stagger` `@enter:fade` |

## P3 压缩即遗忘（p3-01..20）→ `scenes/P3Forgetting.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..06 | p3-01 引子：账单卡「代价 · 到账」落下（`coreDeep`）；p3-02 起让位有损塌缩图 ·**archify full**：lossy-summary 章 `taste-lost`+`tabs-verbatim`+`collapse-rounds`+`forgetting-per-round` · 角标 `tabs, not spaces` → `style preference` 由图内承担 | 引子账单落下 `useEnter:fall`；其余由 ArchifyRecap 主控；`@enter:fall` |
| 3-B | p3-07..10 | 存档≠记忆双物卡（2D）：左＝压缩前写盘的完整卷宗（`dim` 灰置，厚册形态）／右＝台面摘要（`core` 橙，薄卡）；中缝「无检索工具」断线（虚线中断，`deny` 叉标）；题词「存档 · 记忆」（对置） · 角标 `.transcripts/` | 双物对开 `useEnter:slideL`＋`useEnter:slideR`；断线描出 `useDraw`；叉标闪 `useImpulse`（p3-08 句）；终态停驻〔M-003〕；`@enter:slideL` `@enter:slideR` `@draw` `@impulse` |
| 3-C | p3-11..13 | 根因金句卡（衬线）「没有持久状态」居中；背后新会话空台面——台面上全部物件淡出清空（BenchTop 母题保留，`core` 描边恒定〔M-001〕） · 角标 `stateless` | 金句卡上浮 `useEnter:rise`；台面物件淡出 `useProgress`；清空后静默一拍〔M-003〕；`@enter:rise` `@progress` |
| 3-D | p3-14..18 | p3-14..15 官方对照卡（官方页样：全新窗口＋两机制跨会话）；p3-16 让位教学版丢弃面 ·**archify full**：lossy-summary 章 `all-for-one-line` · p3-17..18 回落：产品保留面清单卡五项逐条点亮（请求意图／关键概念／文件片段／错误与修法／待办，`mech` 描边） | 官方卡淡入 `useEnter:fade`；清单五项逐条 `useStagger`；p3-16 由 ArchifyRecap 主控；`@enter:fade` `@stagger` |
| 3-E | p3-19..20 | 第二本账开张：登记簿剪影自右缘挂入（`mech`，常驻辉光；空间契约——不触碰左中台面锚区）；字卡「要有一层不丢的」；台面侧压暗让位 | 剪影滑入 `useEnter:slideR`＋辉光 `useBreathe`；字卡上浮 `useEnter:rise`；台面侧压暗 `useDim`；`@enter:slideR` `@breathe` `@enter:rise` `@dim` |

## P4 登记簿与扉页（p4-01..32）→ `scenes/P4LedgerLoading.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..04 | 登记簿物件开张（2D）：motifs.LedgerBook 自右缘挂入（`mech`）；一文件一记忆卡——头部三行（名字／说明／类型）＋正文块；p4-03 同名合并动效：两张同名卡吸附合一（slug 角标点亮）；p4-04 台面侧对比压暗（登记簿在台面外） · 角标 `.memory/`、`name / description / type` | 登记簿滑入 `useEnter:slideR`；记忆卡展开 `useStagger`；同名合并 `useSpring`（局部帧）；台面压暗 `useDim`；`@enter:slideR` `@stagger` `@spring` `@dim` |
| 4-B | p4-05..09 | p4-05 扉页物件引子：LottieEmphasis page-flip 翻页脉冲（components/LottieEmphasis.tsx，`mech`——planning §3 唯二 3D/Lottie 点缀之二）＋扉页目录行首现（一行一条）；p4-06 起让位登记簿结构图 ·**archify full**：memory-ledger 章 `not-handwritten`+`full-rebuild`+`derived-vs-source`+`index-cheap-files-precious` · 角标 `MEMORY.md` | 翻页脉冲在 LottieEmphasis 内（不产生 token）；扉页物件上浮 `useEnter:rise`；目录行逐条 `useReveal`；p4-06..09 由 ArchifyRecap 主控；`@enter:rise` `@reveal` |
| 4-C | p4-10..12 | 四问分型图 ·**archify full**：four-memory-types 章 `four-questions`+`who-and-how`+`what-and-where` · 三句三接力无空窗 · 角标 `user / feedback / project / reference` 由图内承担 | archify 全屏回放主控（跨实例背靠背接 4-B，本镜 `lead={false}`；本镜无动效 hook） |
| 4-D | p4-14..21 | 两层加载图 ·**archify full**：two-layer-loading 章 `two-tracks`+`index-resident`+`body-on-demand`+`copy-not-pollute`+`cache-stakes` · p4-18..19 空窗回落：缓存条（前缀锁定段＋命中打点动画）· p4-21 空窗回落：官方一句卡「垫纸之后 · 独立段落」（对置小卡） · 角标 `system prompt` / `user turn`、`<relevant_memories>` | 空窗句缓存命中打点 `useImpulse`＋官方卡淡入 `useEnter:fade`；其余由 ArchifyRecap 主控（跨实例背靠背接 4-C，本镜 `lead={false}`）；`@impulse` `@enter:fade` |
| 4-E | p4-23..27 | p4-23 引子：目录员剪影上场（`dim` 灰置，题词「只看用户的话」预备）；p4-24 让位旁路调用图 ·**archify full**：two-layer-loading 章 `side-query` · p4-25..27 回落小剧场：目录员报序号（序号条 1–5，上限封顶）／工具噪声纸团被筛出（`deny` 淡出）／失败降级关键词（备用钥匙卡，`dim`） · 角标 `side-query`、`max 5`、`fallback` | 引子剪影淡入 `useEnter:fade`；回落小卡三连 `useStagger`；其余由 ArchifyRecap 主控（空窗后重现，保持默认 lead）；`@enter:fade` `@stagger` |
| 4-F | p4-28..32 | p4-28 引子：grep 计数卡——终端行 `grep -r vector` 滚出计数归零（翻到 0 定格，`deny` 点睛）；p4-29 让位挑选口径图 ·**archify full**：two-layer-loading 章 `model-not-vectors` · p4-30..32 回落：【三】引语卡（mono 引语态，归属角标「开源项目作者 · 源码分析」）＋官方口径卡（只说标准文件工具） · 角标 `0 向量代码`、`Sonnet`、`standard file tools` | 计数滚动 `useCount`＋归零定格 `useImpulse`；引语逐字 `useReveal`；官方卡淡入 `useEnter:fade`；其余由 ArchifyRecap 主控（空窗后重现，保持默认 lead）；`@count` `@impulse` `@reveal` `@enter:fade` |

## P5 执笔与夜班（p5-01..32）→ `scenes/P5PenAndNight.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..05 | 写权双人卡（2D）：左＝师傅剪影两手空空（`text` 白，手部特写无笔，题词「不能记 · 不能删」）／右＝工坊侧收尾工执笔（`mech`）；中缝六工具清单快闪翻页——翻遍无记忆读写项（末行空位 `deny` 虚框） · 角标 `bash / read / write / edit / glob / task` | 双人卡对开 `useEnter:slideL`＋`useEnter:slideR`；清单快闪 `useStagger`；空位虚框闪 `useImpulse`；`@enter:slideL` `@enter:slideR` `@stagger` `@impulse` |
| 5-B | p5-06..10 | 撂活抽取图 ·**archify full**：stop-extraction 章 `stop-moment`+`no-new-call`+`side-extract`+`dedupe-first`+`strong-signals` · 五句五接力无空窗 · 角标 `stop & no tool_use`、`extract` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 5-C | p5-11..14 | 时间铰链卡（2D）：左＝台面已压扁（薄条形态，`coreDeep`）／右＝压缩前快照定格（完整原文页，`text` 白）；抽取箭头只指右侧（`mech` 单向）；题词「压缩管丢 · 记忆管存」 · 角标 `pre_compress` | 对开 `useEnter:slideL`＋`useEnter:slideR`；箭头行进 `useFlowDash`；左侧压扁 `useProgress`；终态停驻〔M-003〕；`@enter:slideL` `@enter:slideR` `@flowDash` `@progress` |
| 5-D | p5-15..22 | 夜班整理图 ·**archify full**：night-shift 章 `threshold-in`+`rough-rewrite`+`reverse-gate`+`outside-deleted`+`stuck-paradox` · p5-16 空窗回落：职责清单小条（去重／合并矛盾／淘汰过时，`mech`）· p5-19 空窗回落：警示条「无回滚 · 静默」（`deny` 描边，「教学版」徽标） · 角标 `threshold`、`consolidate` 由图内承担 | 空窗句小条弹入 `useEnter:pop`；其余由 ArchifyRecap 主控；`@enter:pop` |
| 5-E | p5-23..30 | 【三】引语卡（mono 引语态，产品整理四道门：时间间隔／扫描节流／会话数量／文件锁；外号「做梦」标签）＋官方口径三连卡（读写主体说成模型／转录三十天清理·记忆豁免／压缩后从磁盘拿回·超大文件只剩路径） · 角标 `autoDream`、`Saved 2 memories`、`30 天豁免`、`Referenced file` | 引语逐字 `useReveal`；三连卡逐条 `useStagger`；豁免行一次性强调 `useImpulse`；`@reveal` `@stagger` `@impulse` |
| 5-F | p5-31..32 | 双层分工一句卡（2D）：左＝跨会话记忆（LedgerBook 小图标，题词「管一辈子」）／右＝会话记忆（台面便签，题词「管这一场」）；下方小字「教学版未做 · 先记个名」（`dim`） · 角标 `session memory` | 对开 `useEnter:slideL`＋`useEnter:slideR`；小字淡入 `useEnter:fade`；`@enter:slideL` `@enter:slideR` `@enter:fade` |

## P6 两套机制（p6-01..21）→ `scenes/P6TwoBooks.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01..06 | 演进彩蛋：p6-01 转场小卡「后日谈」（`dim`）；p6-02 旧条子→新条子对照卡（上行旧占位提示无地址／下行新条子带磁盘地址，`mech` 高亮地址段）；p6-03 起让位演进图 ·**archify full**：memory-panorama 章 `evolved-hint`+`roads-closed` · p6-04 回落三枚小图标（指针认得自己／先存再压／掐口不二刀）· p6-06 回落「不宣称因果」提示条（`dim` 横条） · 角标 `[Earlier tool result saved at …]` | 转场卡淡入 `useEnter:fade`；对照卡弹入 `useEnter:pop`；三图标 `useStagger`；提示条淡入 `useEnter:fade`；p6-03/05 由 ArchifyRecap 主控（章间空窗回落）；`@enter:fade` `@enter:pop` `@stagger` |
| 6-B（3D） | p6-07..14 | 回答主线：p6-07 HarnessStackP6 3D 栈重新放大居中（components/harness-stack.tsx 承担）；p6-08 起让位全景图 ·**archify full**：memory-panorama 章 `answer-panorama`+`lossy-side`+`ledger-side`+`two-clamps`+`vow-cashed` · p6-10 空窗回落 3D 栈收台侧标注（便宜先跑／配对不拆）· p6-12 空窗回落登记簿侧标注（写权在工坊）· p6-14 终态：碑兑现——全景两区合拢＋咬合两点高亮 | 3D 放大在 HarnessStackP6 内（不产生 token）；空窗标注浮现 `useEnter:fade`；其余由 ArchifyRecap 主控（空窗后重现，保持默认 lead）；`@enter:fade` |
| 6-C | p6-15..17 | 开放问题天平卡（2D）：左盘「模型自选」（`mech`）／右盘「向量检索」（`dim`）；天平横梁悬停不落（刻意不停驻单侧）；题词「召回 · 没人量过」 · 角标 `recall: 未度量` | 对照卡对开 `useEnter:slideL`＋`useEnter:slideR`；天平悬停呼吸 `useBreathe`（`dim`，刻意不裁决）；`@enter:slideL` `@enter:slideR` `@breathe` |
| 6-D（3D） | p6-18..21 | p6-18..19 让位读图法与未开灯两区 ·**archify full**：five-layer-dependency 章 `read-two-books`+`two-dark-zones` · p6-20..21 回落 3D：工坊地图两区暗态、系列身份卡（chip 档，标题主段受检硬编码——数据对账 series-layers.json ↔ series.json）＋下期卡（next 走 [series-layers.json](../video/src/series-layers.json)，规则 8 对账）＋工坊灯牌收暗渐黑 | 身份卡／下期卡浮现 `useStagger`；灯牌收暗全镜 `useFadeOut`（末 36 帧，窗取整镜时长）；两章由 ArchifyRecap 主控；`@stagger` `@fadeOut` |

## 字幕规范

- 底部单行、一句一条（163 句＝163 条），与 `NarrationAudio` manifest 逐句同步；字号与安全带沿系列 frozen `Subtitle.tsx`，不另设。
- zh 字幕恒单行不折行；超宽句由 Subtitle 内部缩放兜底。
- 发音标注 `<行|HANG2>` 仅影响 TTS take（build 期已从字幕文本剥离），不影响字幕形态。

## 实现映射

| 幕 | 组件 | 装置重心 |
| --- | --- | --- |
| P0 打烊清台 | `scenes/P0NightClosing.tsx` | HarnessStackP0（3D）、BenchTop 台面母题首现（M-001）、拒收印章、两本账剪影＋碑卡 |
| P1 收台四步 | `scenes/P1Compaction.tsx` | solids-3d 台面堆高一现、四层速览卡、常量打码卡、顺序金句卡 |
| P2 指针换空间 | `scenes/P2PointerSpace.tsx` | 顺序对撞卡、找不到的路演示、占位符引语卡、尺子卡、官方对照卡 |
| P3 压缩即遗忘 | `scenes/P3Forgetting.tsx` | 存档≠记忆双物卡、根因金句卡、保留面清单卡、登记簿剪影挂入 |
| P4 登记簿与扉页 | `scenes/P4LedgerLoading.tsx` | LedgerBook 登记簿、一文件一记忆卡、LottieEmphasis page-flip、目录员小剧场、grep 归零卡 |
| P5 执笔与夜班 | `scenes/P5PenAndNight.tsx` | 写权双人卡、时间铰链卡、四道门引语卡、官方三连卡、分工一句卡 |
| P6 两套机制 | `scenes/P6TwoBooks.tsx` | HarnessStackP6（3D）、演进对照卡、开放天平、系列身份卡／下期卡 |

公共组件清单：`Subtitle`（frozen）· `ChapterProgress`（顶部章节条，y<56）· `SceneTag`（top:64）· `QuoteCard`／`FadeUp`／`Pill`（cards.tsx，金句卡衬线体）· `Panel`／`Terminal`／`CodeCard`／`NumberedCard`／`Counter`／`Footnote`（motifs.tsx）· 本集母题四件：`BenchTop`（台面，M-001 恒定 `core` 橙）／`LedgerBook`（登记簿）／`ClaimTag`（取货条·包裹标签）／`SideDesk`（目录员旁路小工位）· `HarnessStackP0`／`HarnessStackP6`／`HarnessBadge`（harness-stack.tsx，P1–P6 常驻顶边条 chip 档）· `Stage3D`／`Slab3D`／`Rim3D`（solids-3d.tsx，P1 台面堆高一现）· `LottieEmphasis`（page-flip——**本集 headless ANGLE 实渲已通过并成片 v1**，重渲边界与退役判据见 issue.md ISSUE-202）· `ArchifyRecap`（archify cue 载体，frozen 共享——Stage ⑧ 接入；一章锚一句，跨实例背靠背后挂实例 `lead={false}`）。

金句卡三张（QuoteCard 衬线定格）：0-C 碑卡（悬念态）「记忆不是一个功能」· 2-C 顺序金句「先抄地址 · 再扔东西」· 3-C 根因金句「没有持久状态」——主字均压短形态，与口播逐字重合面 <10 字（RSI-007 安全线内）。

## 自检对账（Stage ⑥ 收口）

- 句覆盖：0-A p0-01 → 6-D p6-21，幕内镜区间首尾相接、跨幕无缝——36 镜 163/163 全覆盖无重叠、镜号唯一；36 镜与 narration.json 36 个 beatStart 块一一对应（跨删句号 p2-27／p4-13／p4-22／p5-28 的区间按 narration 实存句集取窗）。
- 图集：12 图（10 新绘＋2 复用显式登记＋`html_overrides` 两行落点声明）· 5 型（workflow×2／state×2／dataflow×3／lifecycle×3／architecture×2）· 每图 3–7 章 · 62 章＝62 cue 计划（章章有锚，无废章）。
- 锚定：62/163 ≈ 0.38 ≥ 0.30；分幕 P0 1/13 · P1 11/21 · P2 12/28 · P3 5/19 · P4 14/30 · P5 10/31 · P6 9/21——全部 ≥1 锚且 ≥5% 分幕比；最长连续无锚 run＝11（p0-01..11 与 p5-23..p6-02 两处）≤ 12，次长 9（p3-07..15、p3-17..p4-05 两处）。
- 单调性：各图章按锚句顺序正向播放，无逆序（lossy-summary 尾章 `all-for-one-line` 锚 p3-16 归位序内；two-layer-loading 尾二章 `side-query` p4-24／`model-not-vectors` p4-29 序内；memory-panorama 尾章 `vow-cashed` 锚 p6-14 序内）。
- 跨实例背靠背（后挂 `lead={false}`）清单：1-B（接 1-A）· 2-B（接 2-A）· 4-C（接 4-B）· 4-D（接 4-C）；空窗后重现保持默认 lead：2-F · 4-E · 4-F · 6-B。
- `@动词` 全部为 motion/hooks.ts 实存模型：enter:fall／enter:rise／enter:fade／enter:pop／enter:slideL／enter:slideR／stagger／reveal／progress／spring／impulse／breathe／draw／count／flowDash／shake／dim／fadeOut。
- 观众层匿名化抽检：画面零信源标识、零他集标题（下期卡数据走 series-layers.json，视觉层专属）；【三】归属角标统一「开源项目作者 · 源码分析」；英文标识符只进角标与引语卡。
