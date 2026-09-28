# 分镜：并发：谁来按下开始（v1）

> 逐字稿 SSOT：[narration.md](./narration.md)（170 句 v2——p4-03/p4-29 为空号，镜区间跨空号按实存句连续取值；句 id 即本表定位锚，时序与 [narration.json](./narration.json) 逐句一致）；时长以 audio manifest 实测为准（定稿 3,613 字 ≈ 14.2 分 @254 含停顿口径，硬窗 [13.0, 14.6] 分）。
> 一镜（beat）＝2–8 句连续句共享同一主画面，镜界沿 ⑤ 成文优化已切好的空行 beat（全片 32 镜与 narration beat 一一对应）；句区间覆盖本幕每一句、无交叠无遗漏（`check_script.py` 强制）；镜号与 `scenes/P*.tsx` 内嵌 `<Sequence name="N-X">` 规范对应。
>
> **本集视觉契约**（[theme.ts](../video/src/design/theme.ts)，与 [planning.md](./planning.md) §3 一致；mechDeep 落位值 `#5C8FB8`，planning 表内 `#5588B5` 系旧值漂移，以 theme.ts 为准）：
> `core` 陶土橙 `#D97757`＝循环内核／传送带——**全系列恒定视觉锚〔M-001〕**：锁死描边色与绝对线宽，全片同形出场只换周边标签；本集戏份收窄为恒转底盘，「装置动、带不停」＝本集视觉动词 · `coreDeep` `#B45A3C`＝底盘描边／托盘暗态 · `mech` 时机蓝 `#7FB2E0`＝一切「接管时间」的装置（本集维度色：清洗槽／登记板／叫号器／学徒／定时钟／入口小格子／号牌）· `mechDeep` `#5C8FB8`＝装置暗态／描边深档／3D 层板 lit 面 · `deny` `#EF6461`＝卡死／坏闹钟／进程死亡／打烊停摆唯一语义 · `ok` `#7ED321`＝触发／送达确认瞬态 · 师傅／用户／数据流一律无彩（`text` 白／`dim` 灰）；学徒为机制化身，mech 蓝描边剪影区别于无彩师傅。
> 恒定空间契约（防〔X-001〕空间逆旁白）：**传送带恒居画面左中锚位**（core 橙恒转底盘——本集恒定主视觉的「底」）；时机装置自**右缘／上缘**挂入（mech 蓝）——后台线装置族（清洗槽／登记板／叫号器／学徒）挂右缘、定时线装置族（定时钟盘／入口小格子／岗哨）挂上缘墙面，**双线分轨互不叠加**、各自汇回传送带（全景总装图按「后台支路／通知支路／定时支路」三线同纪律）；「接管时间」的动效永远表现为**装置在动而传送带不停**（甩活瞬间仅托盘离带、带速不变）；师傅剪影（text 白无彩）立于带侧；金句卡衬线体（`theme.serif`）；代码实景只进画面角标与引语卡（mono 等宽引语态）。
>
> **画面纪律**：画面文字只放关键词／数字／标签（≤6 字），不复述口播（RSI-007，刻意定格处在该行注 `caption-dup-ok:` 豁免）；英文标识符只进角标；顶部安全带 y<56 由章节条占用，画面内容 y≥56 起，SceneTag 维持 top:64；画面零信源站标识与他集标题。
> **archify 资产档位**：全屏独占（`forbid_inset`，无画中画）——播放期自制装置由 ArchifyYield 淡出让位或空窗句回落；章节数据＝录制 SSOT，见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长＝拍数 × max(1100ms, 3200ms/拍数)；cue 纪律：一章锚一句（`at('句id')` + `dur('同句id')` 单参），同锚句双 cue 即 FAIL；**同图跨镜界帧相邻的后挂实例一律 `lead={false}`**（本集四处：1-C／2-B／4-C／4-E 内坏闹钟实例；空窗后重现的实例保持默认 lead）。timing-panorama 等同名题材产物按 planning §3 走全原生重绘，不开旧产物复用通道。
> ⚠️ 动效列与一切散文**禁写**画面列那套档位字面标注（覆盖门按全文计数断言，多一处命中即 FAIL），散文一律写「全屏独占／画中画」；`@动词` 只用 [motion/hooks.ts](../video/src/motion/hooks.ts) 实存模型，判据＝本镜 `<Sequence>` 内由本幕 scene 自身定义的装置调用了该 `useXxx(`（`components/` 内装置承担者一律散文点名，不产生 token）；角标 token 与章节 token 分处不同 `·` 段（覆盖门按段解析，混段即串账）。

## 图集预算表（12 图全原生重绘；6 型；59 章＝59 cue 计划，锚定率 59/170≈0.35 ≥ 0.30，密度 ≈4.2/分 ≥ 3.0；命名循 `claude-code--{slug}.html`，与其他集不撞名）

| # | slug（新绘落 `docs/assets/architecture/agent-harness/claude-code--<slug>.html`） | 型 | 服务幕/句段 | 章 |
| --- | --- | --- | --- | --- |
| 1 | bg-two-verdicts | workflow | P1 两级判定（p1-07..12） | 4 |
| 2 | bg-placeholder-receipt | sequence | P1 占位回执时序（p1-13..17） | 4 |
| 3 | bg-board-and-lock | architecture | P1 登记板与锁（p1-18..22） | 4 |
| 4 | notify-protocol | state | P2 一问一答与独立通知（p2-01..07） | 5 |
| 5 | notify-merge | dataflow | P2 同框合流（p2-08..12） | 5 |
| 6 | apprentice-watch | workflow | P3 停滞判据＋小字条＋官方监视（p3-01..16） | 7 |
| 7 | clock-four-layers | architecture | P4 四层解耦总装（p4-09..22） | 6 |
| 8 | clock-dedupe | dataflow | P4 带日期分钟去重（p4-23..27） | 4 |
| 9 | clock-bad-jobs | state | P4 坏任务三层防护（p4-28..31） | 3 |
| 10 | durable-lifecycle | lifecycle | P5 durable 生命周期（p5-04..10） | 5 |
| 11 | schedule-three-tiers | architecture | P5 官方三档阶梯（p5-11..17） | 5 |
| 12 | timing-panorama | architecture | P0 双闪预告（p0-04/p0-17）＋P5 全景自白（p5-19..23）＋P6 收束读图（p6-06/p6-13） | 7 |

> 型多样性＝workflow×2 / sequence×1 / architecture×4 / state×2 / dataflow×2 / lifecycle×1 ＝ 6 型 ≥ 5（sidecar 顶层 `type` 录制时按本表落盘）。主仓 docs 侧另有 `claude-code-concurrency--timing-panorama.html` 旧产物（文档图层），与本集 `claude-code--timing-panorama.html` 不同名不撞车，后者按本集 views 全原生重绘。P0/P6 首尾幕的幕级锚定由 #12 双闪与收束章承担（ep1 先例：总装图首尾复用），其余 11 图全部服务正文幕。

## P0 两类时间（p0-01..18）→ `scenes/P0TwoTimes.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A（3D） | p0-01..04 | HarnessStackP0 3D 五层栈自底向上落板（components/harness-stack.tsx 承担）→ 本集层「并发」点亮呼吸两次 → 压暗缩退为顶边常驻条（HarnessBadge，P1–P6）；工坊轮廓描线生长（通宵不打烊灯牌，dim）；师傅剪影（text 白无彩）立于带侧；传送带母题首现（motifs.LoopRing，core 橙恒转底盘〔M-001〕——本集恒定主视觉的「底」）；p0-04 让位——全图首闪（预告态，两条时间支路虚位不展开） ·**archify full**：timing-panorama 章 `two-kinds-of-time` · 角标 `while True` | 栈落板/层呼吸/缩退在 HarnessStackP0 内；工坊描线由 scene 调用 `useDraw`；p0-04 由 ArchifyRecap 主控（本镜 scene 侧仅描线）；`@draw` |
| 0-B | p0-05..10 | 慢活卡带：传送带（core 橙左中锚位）停等——巨型包裹（mech 蓝线框）压带，带面静止；师傅剪影干站带侧（text 白）；计时器数字滚涨（dim 灰＝人色时间）；计费条随秒匀速累积（dim）；p0-10 记忆点小字卡「白烧的钱」（deny 红点睛「白烧」）；角标 `pip install`、`npm run build`（不口播） | 巨型包裹落带 `useEnter:fall`；计时器滚涨 `useCount`；计费条匀速累积 `useProgress`（linear）——p0-07..09 以静写闷〔M-002〕：停等段零强调脉冲；「白烧」deny 点睛 `useImpulse`；`@enter:fall` `@count` `@progress` `@impulse` |
| 0-C | p0-11..14 | 到点的活：日历墙（上缘 mech 蓝刻度网格）＋九点整刻度高亮点亮；空台面（师傅剪影缺席，空无一人）；「你说一句 · 它动一下」对白气泡（dim 灰人色）；漏触发示意——日历翻页一天过去、九点再亮但带上无活；角标 `0 9 * * *`（预告，不口播） | 九点刻度点亮 `useImpulse`（一次性）；日历翻页 `useProgress`；空台面留白呼吸 `useBreathe`（dim 低频）；`@impulse` `@progress` `@breathe` |
| 0-D | p0-15..18 | 悬念立碑：主问题字卡双联对开（「等不等？」「谁按开始？」，mech 蓝点睛「等」「按」二字——落 p0-15 立碑句）→「更快的机器」「更多的工坊」字卡双双划掉（dim 划线）→ 两装置预告剪影自右缘点亮（mech 蓝 ×2：清洗槽滚筒轮廓／定时钟盘轮廓）＋全图二闪（两支路点亮态） ·**archify full**：timing-panorama 章 `two-devices-lit` · p0-18 金句预埋小卡（衬线体预告态「没有平行宇宙」） caption-dup-ok: 金句预埋小卡，主字压短非逐字 · 角标 `run_in_background`、`cron`（预告态） | 双联字卡对开 `useEnter:slideL`＋`useEnter:slideR`；划掉 `useProgress`（decelerate）；装置剪影右缘滑入 `useEnter:slideR`＋常驻辉光 `useBreathe`（mech）；预埋小卡衬线定格〔M-003〕；p0-17 由 ArchifyRecap 主控；`@enter:slideL` `@enter:slideR` `@progress` `@breathe` |

## P1 自动清洗槽（p1-01..32）→ `scenes/P1WashSink.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A（3D 一现） | p1-01..06 | 洗衣机引子：转筒滚转动效（components/solids-3d.tsx 承担清洗槽滚筒，mech 蓝滚筒＋透明滚窗——planning §3 唯二 3D 点缀之一）；「三十分钟」教学叙事数字卡（dim）；「滴滴」完成提示（ok 瞬态绿一闪两拍）；叠化到工坊角落清洗槽落位（mech 蓝主体挂右缘，不触碰左中传送带锚位；师傅按下开关转身回台面动势）；角标 `background task` | 3D 滚筒旋转在 solids-3d 内（不产生 token）；数字卡 `useCount`；完成提示 ok 一闪 `useImpulse`；叠化 `useProgress`；`@count` `@impulse` `@progress` |
| 1-B | p1-07..12 | 两级判定分叉 ·**archify full**：bg-two-verdicts 章 `two-roads`+`explicit-switch`+`keyword-fallback`+`primary-vs-fallback` · 四章接力（p1-07、p1-11 空窗回落：判定之问引子小字＋关键词扫描灯逐个亮起的小装置一现）；角标 `run_in_background`、`slow_keywords` | 空窗句关键词灯点亮 `useStagger`；其余由 ArchifyRecap 主控；`@stagger` |
| 1-C | p1-13..17 | 占位回执时序 ·**archify full**：bg-placeholder-receipt 章 `sink-in-trade`+`ticket-first`+`belt-unpaused`+`four-digit-id` · 四章接力（p1-17 空窗回落：号牌实物卡弹出落到师傅手里＋金句卡衬线定格「先给号牌 · 活慢慢干」〔压短形态〕；甩活只托盘离带、core 橙底盘恒转——〔X-001〕防线） caption-dup-ok: p1-17 金句卡定格记忆点，主字已压短非逐字 · 角标 `bg_0001`、`[Background task started]` | 号牌弹出 `useEnter:pop`；金句卡 QuoteCard 终态停驻〔M-003〕；其余由 ArchifyRecap 主控；`@enter:pop` |
| 1-D | p1-18..22 | 登记板与锁 ·**archify full**：bg-board-and-lock 章 `registry-board`+`daemon-thread`+`lock-critical`+`lock-before-write` · 四章接力（p1-18 空窗回落：「幕后还有一套簿记」引子小字＋mech 蓝登记板三栏剪影一现：编号／命令／干到哪了）；角标 `background_tasks`、`background_lock`、`threading.Thread(daemon=True)` | 引子小字 `useEnter:fade`；登记板剪影三栏 `useStagger`；其余由 ArchifyRecap 主控；`@enter:fade` `@stagger` |
| 1-E | p1-23..27 | 边界三联卡：①登记板断电——板面字迹散粒消散（内存态，dim）②线程拴在工坊大门——链条连线 mech→门框（打烊即断，deny 暗示）③摘要小票只裁开头一段——剪刀裁切、前段高亮后段虚化；p1-26【官】官方文档页样小卡并列（「退出自动清理」标签）；角标 `in-memory`、`daemon=True`、`summary[:200]`（定性呈现） | 字迹消散 `useProgress`＋`useDim`；链条 `useDraw`；裁切 `useImpulse`；官方卡 `useEnter:rise`；`@progress` `@dim` `@draw` `@impulse` `@enter:rise` |
| 1-F | p1-28..32 | 官方产品面对照卡（教学版左／产品右）四连：任务号即回／快捷键挪后台／超时自动转后台（沙漏漏完→转后台箭头）／输出落文件读回；「产品更讲究」题词；角标 `Ctrl+B`、`timeout → background`、`output file + Read` | 四连卡依次入场 `useStagger`；沙漏漏完 `useProgress`；转移箭头 `useFlowDash`；`@stagger` `@progress` `@flowDash` |

## P2 叫号器（p2-01..23）→ `scenes/P2CallBoard.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..07 | 叫号器首现＋硬协议 ·**archify full**：notify-protocol 章 `hang-the-tag`+`one-to-one`+`receipt-spent`+`no-second-receipt`+`own-doorway` · 五章接力（p2-01..02 空窗回落：门口挂牌板 mech 蓝首现＋号码牌翻上——「不拍肩、不喊人」的具象，师傅剪影背对未察觉）；角标 `task_notification`、`tool_use ↔ tool_result` | 挂牌板首现 `useEnter:rise`；号码牌翻上 `useSpring`（局部帧）；p2-03 起由 ArchifyRecap 主控；`@enter:rise` `@spring` |
| 2-B | p2-08..12 | 同框合流 ·**archify full**：notify-merge 章 `delivery-when`+`ride-along`+`passive-board`+`next-lap-glance`+`closing-loss` · 五句五接力无空窗 | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担（本镜无动效 hook） |
| 2-C | p2-13..19 | 官方 SDK 同构卡：三态徽标（完成／失败／停止三枚 mech 徽标依次点亮）＋长调用后台化小图（外部长调用→后台→真实结果原路返回）；推人通路卡（桌面通知弹出图形＋门铃一声，ok 瞬态）；「给模型小票 · 给人门铃」对句题词（p2-18 记忆点）；p2-19 收束小字「完成 · 独立事件」；角标 `TaskNotificationMessage`、`PushNotification` | 三态徽标 `useStagger`；原路返回 `useFlowDash`；桌面通知弹出 `useEnter:pop`＋ok 一闪 `useImpulse`；`@stagger` `@flowDash` `@enter:pop` `@impulse` |
| 2-D | p2-20..23 | 诚实注卡：账本空白页翻动（零量化记录——页面上只有目录线没有数字行）＋「动机 ≠ 成绩单」分栏卡（左「动机 · 空转烧钱」右「成绩单 · 空白」）；p2-23 记忆点题词「不必干等 · 不是更便宜」（压短对句定格）；角标 `token billing`（动机面） | 空白页翻页 `useProgress`；分栏卡对开 `useEnter:slideL`＋`useEnter:slideR`；题词终态定格〔M-003〕；`@progress` `@enter:slideL` `@enter:slideR` |

## P3 学徒的字条（p3-01..16）→ `scenes/P3ApprenticeSlip.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..08 | 停滞巡视 ·**archify full**：apprentice-watch 章 `teach-zero`+`watch-only`+`growth-not-age`+`forty-five-sec`+`yn-sniff` · 五章接力（p3-01 空窗回落：清洗槽群多槽位一现＋卡死槽位 deny 红警示「停在问话上」；p3-03 空窗回落：【三】归属引语卡——「开源项目作者 · 源码分析」归属角标＋学徒 mech 蓝描边剪影首现，只看不动手）；角标 `(y/n)?`、`stagnation watchdog` | 卡死槽位 deny 脉冲 `useImpulse`；学徒剪影淡入 `useEnter:fade`；p3-02 起由 ArchifyRecap 主控（p3-03 段回落）；`@impulse` `@enter:fade` |
| 3-B | p3-09..13 | 小字条动效 ·**archify full**：apprentice-watch 章 `side-model-slip` · 单章（p3-09..10 空窗回落：「副业」引子小字＋每批活完成贴一张小条的 2D 动效一现——几个字的样例短条；p3-12..13 空窗回落：旁路箭头（mech 细线）先于主线完成的对比小图——主线流水条仍在吐字 vs 旁路已贴条＋记忆点小卡「并行 · 而且更快」）；角标 `Haiku side-query`、`git-commit-subject, not sentence` | 小字条逐张贴上 `useEnter:pop`；旁路箭头 `useFlowDash`（mech）；主线吐字 `useReveal`；p3-11 由 ArchifyRecap 主控；`@enter:pop` `@flowDash` `@reveal` |
| 3-C | p3-14..16 | 官方产品面 ·**archify full**：apprentice-watch 章 `official-monitor` · 单章（p3-15 空窗回落：监视工具流式视图 2D 细化——后台输出逐行回流的行缓冲＋游标＋「超时就收队」时限小标；p3-16 空窗回落：收束对句「教学版没教 · 产品配齐」）；角标 `Monitor` | 行回流 `useReveal`（逐行）；游标呼吸 `useBreathe`；收束对句 `useStagger`；p3-14 由 ArchifyRecap 主控；`@reveal` `@breathe` `@stagger` |

## P4 墙上的定时钟（p4-01..35，p4-03/p4-29 空号）→ `scenes/P4WallClock.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A（Lottie 点缀） | p4-01..08 | 定时钟落墙：LottieEmphasis clock-swing 钟摆强调（components/LottieEmphasis.tsx＋`lottie/clock-swing.json`，mech 蓝——planning §3 唯二 3D/Lottie 点缀之二）；七点闹钟叙事卡（睡觉／洗澡／做饭三枚 dim 小图标，钟照响不误 mech）；五格时间表特写（分钟／小时／日／月／星期五格 mech 框依次点亮）＋「用了五十年」老写法徽标（dim）；钟挂上缘墙面居中，与左中台面师傅剪影背对（空间契约：定时线走上缘）；角标 `0 9 * * *`、`cron`、`Unix · 50 years` | 钟摆摆动在 LottieEmphasis 内（不产生 token）；七点到点响铃 `useImpulse`；五格依次点亮 `useStagger`；背对构图淡入 `useEnter:fade`；`@impulse` `@stagger` `@enter:fade` |
| 4-B | p4-09..11 | 四层解耦总图首现 ·**archify full**：clock-four-layers 章 `clock-blind`+`four-roles` · 两章接力（p4-09 空窗回落：「有意思的不是钟本身」引子小字＋钟与师傅剪影背对示意 2D 一现——钟面 mech、师傅 text 白，两剪影中隔一道墙线）；角标 `cron_scheduler_loop`、`cron_queue`、`agent_lock`、`[Scheduled]` | 引子小字 `useEnter:fade`；背对示意墙线 `useDraw`；p4-10 起由 ArchifyRecap 主控；`@enter:fade` `@draw` |
| 4-C | p4-12..19 | 前三层单向链 ·**archify full**：clock-four-layers 章 `tick-keeper`+`slot-keeper`+`lock-is-state` · 三章接力（p4-13 空窗回落：请求条塞入入口小格子一拍；p4-15..18 空窗回落：岗哨试锁双分支 2D——拿得到＝空→条子递上传送带 ok 一闪／拿不到＝忙→这一拍跳过等下一拍 deny 暗闪，锁形图标 mech 亮起——「拿不到锁就是正忙」记忆点段）；角标 `sleep(1)`、`agent_lock.acquire(blocking=False)` | 条子递带 `useFlowDash`；拿锁成功 ok 一闪 `useImpulse`；跳拍暗闪 `useDim`；锁图标呼吸 `useBreathe`；其余由 ArchifyRecap 主控；`@flowDash` `@impulse` `@dim` `@breathe` |
| 4-D | p4-20..22 | 第四层收话 ·**archify full**：clock-four-layers 章 `same-stream` · 单章（p4-20 空窗回落：条子以一句话形态汇入对话流 2D——钟话条与人话条同色同轨并列两条消息条；p4-22 空窗回落：四层总结卡「判时 · 存条 · 判闲 · 干活」四格）；角标 `[Scheduled] {prompt}` | 消息条并列浮入 `useStagger`；四格总结卡 `useStagger`；p4-21 由 ArchifyRecap 主控；`@stagger` |
| 4-E | p4-23..31 | 防重放＋坏闹钟双图接力 ·**archify full**：clock-dedupe 章 `sixty-glances`+`date-plus-minute`+`hhmm-trap`+`one-key-two-errors` ·**archify full**：clock-bad-jobs 章 `validate-first`+`quarantine-bad`+`fire-and-delete` · 七章接力（p4-23 空窗回落：2D 钟面秒针扫过六十格，同一分钟命中格连闪——引出「每秒都醒、最小刻度是分钟」）；角标 `minute_marker`、`validate_cron`、`recurring=False` | 秒针绕行 `useTravel`＋命中格连闪 `useImpulse`；其余由 ArchifyRecap 主控（坏闹钟实例接前图末章帧相邻，`lead={false}`）；`@travel` `@impulse` |
| 4-F | p4-32..35 | 官方对齐卡：轮间触发时间轴——用户话条与定时话条交错排列、定时话只插在两轮之间（绝不在半截打断；busy 段标灰等本轮结束）；「每秒检查 · 低优先级」标签；角标 `low priority`、`between your turns` | 话条交错入场 `useStagger`；busy 段置灰 `useDim`；时间轴推进 `useProgress`；`@stagger` `@dim` `@progress` |

## P5 诚实的边界（p5-01..30）→ `scenes/P5HonestEdge.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..03 | 大实话先行：工坊打烊灯灭（deny 渐暗主调）——顶灯熄灭、清洗槽滚筒停转（mech→mechDeep 暗态）、定时钟停摆（2D 秒针停在半途，deny；停摆前匀速绕行）；师傅剪影离场背影；角标 `daemon=True`、`in-process scheduler` | 秒针停摆前绕行 `useTravel`→停摆 `useDim`；灯灭渐暗 `useProgress`（deny 包络）；滚筒暗态 `useDim`；`@travel` `@progress` `@dim` |
| 5-B | p5-04..10 | durable 边界 ·**archify full**：durable-lifecycle 章 `alarm-not-fires`+`definition-on-disk`+`restart-from-now`+`boundary-verbatim`+`no-catchup` · 五章接力（p5-04 空窗回落：设问小字「存的是什么」；p5-10 空窗回落：金句小卡「不是永生 · 闹钟没丢」〔压短〕）；角标 `.scheduled_tasks.json`、`durable` | 设问小字 `useEnter:fade`；金句小卡 QuoteCard 终态；其余由 ArchifyRecap 主控；`@enter:fade` |
| 5-C | p5-11..17 | 官方三档阶梯 ·**archify full**：schedule-three-tiers 章 `three-tiers`+`session-loop`+`desktop-tier`+`cloud-tier`+`same-edge-two-ways` · 五章接力（p5-11 空窗回落：「产品没停在这条边界上」过渡小字；p5-16 空窗回落：双栏小卡——教学版划给操作系统 vs 官方做成产品）；角标 `/loop`、`desktop`、`routines` | 过渡小字 `useEnter:fade`；双栏小卡对开 `useEnter:slideL`＋`useEnter:slideR`；其余由 ArchifyRecap 主控；`@enter:fade` `@enter:slideL` `@enter:slideR` |
| 5-D | p5-18..23 | 传送带自白——全景拉远 ·**archify full**：timing-panorama 章 `panorama-live`+`serial-trays`+`threads-not-tools` · 三章接力（p5-18 空窗回落：「传送带的自白」开场小字＋师傅指向全景动势；p5-20 空窗回落：两个事实清单条「一 · 串行」「二 · 线程真有」；p5-22 空窗回落：线程职能小图——甩活＋看表两枚 mech icon，无工具执行）；角标 `for loop（串行分发）` | 清单条 `useStagger`；职能 icon `useEnter:pop`；其余由 ArchifyRecap 主控；`@stagger` `@enter:pop` |
| 5-E | p5-24..28 | 产品侧单线圈图：一条事件循环圈（motifs.LoopRing 复用，core 橙描边恒定〔M-001〕——与传送带同锚），任务发起后箭头离圈不回；「发起之后 · 不去等」压短题词；教学版 vs 产品对照双卡（左「真线程」右「无真线程」，中缝「语义一字不差」）；p5-25【三】归属引语卡（mono 引语态＋「开源项目作者 · 源码分析」归属角标）；p5-27 拧巴一幕小卡（deny↔mech 双色对撞）；角标 `single-threaded event loop`、`not awaited` | 圈环描线 `useDraw`；箭头离圈 `useFlowDash`＋一次性 `useImpulse`；双卡对开 `useEnter:slideL`＋`useEnter:slideR`；引语逐字 `useReveal`；`@draw` `@flowDash` `@impulse` `@enter:slideL` `@enter:slideR` `@reveal` |
| 5-F | p5-29..30 | 收束卡：两问句并列亮起（「谁按开始？」「要不要等？」mech 蓝）＋第三问「同时能跑几个？」灰置打叉（dim＋deny 叉）；衬线暗态预收小字（P6 终态伏笔）；角标（无新增） | 两问句点亮 `useStagger`；第三问打叉 `useImpulse`（deny）；预收小字 `useEnter:fade`；`@stagger` `@impulse` `@enter:fade` |

## P6 收束（p6-01..18）→ `scenes/P6OneBelt.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A（3D） | p6-01..07 | HarnessStackP6 3D 栈重新放大居中（components/harness-stack.tsx 承担）＋并发层常亮点名；两问题对账卡逐个打钩（「不等 · 号牌先收」「没人按 · 钟替看表」）；p6-05 金句卡衬线体终态定格「后台 · 没有平行宇宙」〔压短形态〕；p6-06 让位——全景对账终态（装置都在动、带仍一条） ·**archify full**：timing-panorama 章 `one-belt-close` · p6-07 回落「师傅不站着等」走开动势（师傅剪影从干站位走开） caption-dup-ok: p6-05 金句卡定格记忆点，主字已压短非逐字 · 角标 `run_in_background`、`agent_lock`、`cron`（三装置对账） | 3D 放大与层点亮在 HarnessStackP6 内；对账卡打钩 `useStagger`；走开动势 `useProgress`；p6-06 由 ArchifyRecap 主控；`@stagger` `@progress` |
| 6-B | p6-08..11 | 遗产句金句卡（衬线体「等待可以外包」主字＋「外包的是等待 · 不是永动」对句小字）＋边界重申小卡（「打烊 · 钟停」deny 描边）；三装置对账卡（清洗槽／叫号器／定时钟 mech ×3 逐一打钩，core 橙底盘恒静于卡底〔M-001〕） caption-dup-ok: 遗产句金句卡刻意定格，主字已压短非逐字 | 金句卡终态定格〔M-003〕；三卡逐个打钩 `useStagger`；边界小卡轻脉冲 `useImpulse`；`@stagger` `@impulse` |
| 6-C | p6-12..18 | 读图法与系列收尾 ·**archify full**：timing-panorama 章 `where-waiting-goes` · p6-12 空窗回落：读图法两问小卡（「等待放哪里」「开始交给谁」）；p6-14..15 系列身份卡（chip 档，标题主段受检硬编码——数据对账 series-layers.json ↔ series.json，规则 8 主段对账）＋工坊地图数区亮灯示意（末区 dim 呼吸不亮）；p6-16..17 下期卡（next 走 series-layers.json，规则 8 对账；口播只说「下期」）；p6-18 工坊灯牌收暗渐黑 | 两问小卡 `useStagger`；身份卡/下期卡浮现 `useStagger`；末区暗态呼吸 `useBreathe`（dim）；灯牌收暗 `useFadeOut`（末 36 帧，**窗取整镜时长**——渐黑窗口用 beat 时长非末句时长，防收尾长黑屏）；p6-13 由 ArchifyRecap 主控；`@stagger` `@breathe` `@fadeOut` |

## 字幕规范

- 底部单行、一句一条（170 句＝170 条，p4-03/p4-29 空号不占条），与 `NarrationAudio` manifest 逐句同步；字号与安全带沿系列 frozen `Subtitle.tsx`，不另设。
- zh 字幕恒单行不折行；超宽句由 Subtitle 内部缩放兜底。
- 口播英文仅 p0-03 一处（Harness，术语规范），字幕跟随口播文本；其余英文标识符只在画面角标出现。

## 实现映射

| 幕 | 组件 | 装置重心 |
| --- | --- | --- |
| P0 两类时间 | `scenes/P0TwoTimes.tsx` | HarnessStackP0（3D）、慢活卡带＋计费条、日历墙、主问题双联字卡、装置预告剪影＋金句预埋小卡 |
| P1 自动清洗槽 | `scenes/P1WashSink.tsx` | 3D 清洗槽滚筒一现（solids-3d）、号牌弹出＋金句卡、登记板剪影、边界三联卡、官方对照四连卡 |
| P2 叫号器 | `scenes/P2CallBoard.tsx` | 挂牌板首现、三态徽标＋推人通路卡、诚实注分栏卡 |
| P3 学徒的字条 | `scenes/P3ApprenticeSlip.tsx` | 清洗槽群＋卡死槽位（deny）、学徒剪影＋归属引语卡、小字条＋旁路箭头、监视工具流式视图 |
| P4 墙上的定时钟 | `scenes/P4WallClock.tsx` | LottieEmphasis clock-swing、五格时间表、试锁双分支、轮间触发时间轴 |
| P5 诚实的边界 | `scenes/P5HonestEdge.tsx` | 打烊灯灭（deny 渐暗）、单线圈图（LoopRing 复用）＋归属引语卡、收束三问卡 |
| P6 收束 | `scenes/P6OneBelt.tsx` | HarnessStackP6（3D）、对账打钩卡、遗产句金句卡、三装置对账卡、系列身份卡/下期卡＋灯牌收暗 |

公共组件清单：`Subtitle`（frozen）· `ChapterProgress`（顶部章节条，y<56）· `SceneTag`（top:64）· `QuoteCard`／`FadeUp`／`Pill`（cards.tsx，金句卡衬线体）· `Panel`／`Terminal`／`CodeCard`／`NumberedCard`／`Counter`／`Footnote`（motifs.tsx）· 母题复用一件：`LoopRing`（传送带／事件循环圈，M-001 恒定）· 新建母题候选四件（Stage ⑧ 落）：`WashDrum`（清洗槽 2D 态）／`ClockFace`（定时钟面＋`useTravel` 秒针）／`CallBoard`（挂牌板＋号码牌翻牌）／`RegistryBoard`（登记板＋锁）· `HarnessStackP0`／`HarnessStackP6`／`HarnessBadge`（harness-stack.tsx，P1–P6 常驻顶边条 chip 档）· `Stage3D`／`Slab3D`／`Rim3D` 等（solids-3d.tsx，P1 滚筒一现）· `LottieEmphasis`（clock-swing，新增 lottie/clock-swing.json）· `ArchifyRecap`／`ArchifyYield`（ep1 frozen 共享件，本集 scaffold 未入库——Stage ⑧ 自 ep1 移植；一章锚一句，帧相邻跨实例后挂 `lead={false}`，本集四处：1-C／2-B／4-C／4-E 坏闹钟实例）。

## 自检对账（Stage ⑥ 收口）

- 句覆盖：0-A p0-01 → 6-C p6-18，幕内镜区间首尾相接、跨幕无缝——32 镜 170/170 全覆盖无重叠、镜号唯一（p4-03/p4-29 空号：4-A 区间 p4-01..08、4-E 区间 p4-23..31 跨空号按实存句连续）。
- 图集：12 图全原生重绘 · 6 型（workflow／sequence／architecture／state／dataflow／lifecycle）· 每图 3–7 章 · 59 章＝59 cue 计划（章章有 cue，被引用章比 1.0）。
- 锚定：59/170 ≈ 0.35 ≥ 0.30；分幕锚定 P0 2/18、P1 12/32、P2 10/23、P3 7/16、P4 13/33、P5 13/30、P6 2/18——全部 ≥1 锚且 ≥5%；最长连续无锚 run＝12 ≤ 12（run 幕边界不重置），**四处贴上限**：p0-05..16／p1-23..p2-02／p2-13..p3-01／p5-24..p6-05——均为 2D 定制剧场段（边界三联卡／SDK 同构／单线圈收束等，无适配图例），Stage ⑧ 不得删这四段边界的邻接 cue；次长 10（p3-15..p4-09）。
- 单调性：各图章按锚句顺序正向播放无逆序（timing-panorama 跨幕 P0→P5→P6 七章锚句 p0-04→p6-13 单调；apprentice-watch 三镜接力 p3-02→p3-14 序内；clock-four-layers 三镜接力 p4-10→p4-21 序内）。
- 档位标注：20 处（均在画面列，`·` 段与角标 token 隔离），章 token 59 个逐一可解析到 views id。
- `@动词` 全部为 motion/hooks.ts 实存模型：enter:fall／enter:fade／enter:pop／enter:rise／enter:slideL／enter:slideR／stagger／reveal／progress／breathe／draw／count／impulse／dim／flowDash／spring／travel／fadeOut。
- 金句卡三张（p1-17／p6-05／p6-08，压短形态＋caption-dup-ok 留痕）＋金句预埋小卡一张（p0-18）；3D 镜 P0/P6 两处＋正文 3D/Lottie 点缀两处（P1 滚筒、P4 钟摆），3D 回归面受控。
