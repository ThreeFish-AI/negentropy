# 分镜：多 Agent 平台：从一个到一群（v2 定稿对齐版）

> 逐字稿 SSOT：[narration.md](./narration.md)（149 句 v2——句 id 即本表定位锚，时序与 [narration.json](./narration.json) 逐句一致）；时长以 audio manifest 实测为准（规划 3,622 字 ≈ 14.3 分 @254 系列实测口径，硬窗 [13.0, 14.6] 分）。
> 一镜（beat）＝2–8 句连续句共享同一主画面，镜界沿 ⑤ 成文优化已切好的空行 beat（32 镜）；句区间覆盖本幕每一句、无交叠无遗漏（`check_script.py` 强制）；镜号与 `scenes/P*.tsx` 内嵌 `<Sequence name="N-X">` 规范对应。
>
> **本集视觉契约**（[theme.ts](../video/src/design/theme.ts)，与 [planning.md](./planning.md) §三一致）：
> `core` 陶土橙 `#D97757`＝循环内核／传送带——**全系列恒定视觉锚〔M-001〕**：锁死描边色与绝对线宽，全片同形出场只换周边标签 · `coreDeep` `#B45A3C`＝内核细节（师傅台面底材）· `mech` `#D9B36B`＝**本集维度色：金＝协作**——一切「多人共用」的挂载装置（排工板卡／收件格／派工单／班次节拍／隔间门牌／插口装置／3D 层板 lit 面）· `mechDeep` `#B08F47`＝装置深态 · `deny` `#EF6461`＝拒绝与危险唯一语义（后写覆盖／双伸手同卡／叫空／旧清单）· `dim` `#9AA7B8`＝人色（审批链用户节点／官方引语卡）· `ok` `#7ED321`＝放行确认瞬态（依赖全绿）· 师傅／队友剪影／数据流一律无彩（`text` 白／`dim` 灰）。seed 里 `accent` 青为前集维度残留，本集画面一律不用（防与 mech 金撞义，Stage ⑧ 前清理）。
> 恒定空间契约（防〔X-001〕空间逆旁白）：传送带母题恒居画面**左中锚位**（core 橙）；**排工板居中**（mech 金协作中枢——本集一切多人机制的挂载中心）；五物件按工坊分区**自右缘／上缘挂入**，P0 预告与 P6 全亮时呈现完整环形分区全景；「加机制」动效永不触碰内核图形；金句卡衬线体（`theme.serif`）；官方引语卡／mono 标识只进角标与引语卡。
>
> **画面纪律**：画面文字只放关键词／数字／标签（≤6 字），不复述口播（RSI-007，刻意定格处在该行注 `caption-dup-ok:` 豁免）；英文标识符只进角标（`.tasks/`／`request_id`／`worktree`／`peek` 等）；顶部安全带 y<56 由章节条占用，画面内容 y≥56 起，SceneTag 维持 top:64；画面零信源站标识、零他集标题、零顺序词；【三】断言的引语卡带归属角标「开源项目作者 · 源码分析」。
> **archify 资产档位**：全屏独占（`forbid_inset`，无画中画）——播放期自制装置由 ArchifyYield 淡出让位或空窗句回落；章节数据＝录制 SSOT，见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长＝拍数 × max(1100ms, 3200ms/拍数)；cue 纪律：一章锚一句（`at('句id')` + `dur('同句id')` 单参），同锚句双 cue 即 FAIL，跨实例背靠背（含镜界切换）后挂实例须 `lead={false}`，空窗后重现的实例保持默认 `lead`。
> ⚠️ 动效列与一切散文**禁写**画面列那套档位字面标注（覆盖门按全文计数断言，多一处命中即 FAIL）；散文一律写「全屏独占／画中画」。`@动词` 只用 [motion/hooks.ts](../video/src/motion/hooks.ts) 实存模型，判据＝本镜 `<Sequence>` 内由本幕 scene 自身定义的装置调用了该 `useXxx(`（`components/` 内装置承担者一律散文点名，不产生 token）。

## 图集预算表（13 图＝11 新绘＋2 复用；6 型；67 章；cue 计划 67（章章必锚），锚定率 67/149≈0.45 ≥ 0.30，密度 ≈4.7/分 ≥ 3.0；11 新绘 slug 沿 planning §3 定稿，与其他四集既有图名零交集）

| # | slug（新绘落 `docs/assets/architecture/agent-harness/claude-code--<slug>.html`） | 型 | 服务幕/句段 | 章 |
| --- | --- | --- | --- | --- |
| 1 | task-board | state | P1 排工板（p1-04..06, p1-13） | 4 |
| 2 | dependency-unlock | workflow | P1 依赖与解锁（p1-09..12, p1-18） | 5 |
| 3 | board-vs-todo | architecture | P0 待办断电一闪＋P1 两层账本（p0-10, p1-07..08） | 3 |
| 4 | mailbox-consume | workflow | P2 收件格（p2-07..11） | 5 |
| 5 | protocol-roundtrip | sequence | P2 派工单（p2-19..22, p2-24） | 5 |
| 6 | protocol-fsm | state | P2 协议状态机（p2-25, p2-27..29） | 4 |
| 7 | shift-three-beats | lifecycle | P3 班次三拍（p3-04..08, p3-18, p3-22） | 7 |
| 8 | idle-claim-loop | dataflow | P3 认领循环（p3-09..13, p3-15） | 6 |
| 9 | worktree-bind | architecture | P4 隔间绑定（p4-04..09） | 6 |
| 10 | worktree-teardown | lifecycle | P4 拆除守卫（p4-10..14） | 5 |
| 11 | mcp-toolpool | dataflow | P5 标准插口（p5-04..09, p5-11） | 7 |
| 12 | collab-panorama（**复用**：主仓既有 `claude-code-multiagent--collab-panorama.html`，guided-views 为空——录制前按本集 views 回填章节、focus 对齐既有节点语义 post/claim/fetch/match/worktree/wait/gate/shift/tools/loop） | dataflow | P0 一闪＋P6 机制归位（p0-12, p6-03..08, p6-10, p6-21） | 8 |
| 13 | five-layer-dependency（**复用**：主仓既有 `claude-code-harness--five-layer-dependency.html`，同上回填，focus 沿用 loop-core/layer-1..5 键） | architecture | P0 立碑一闪＋P6 五层全亮（p0-15, p6-02） | 2 |

> 型多样性＝state×2 / workflow×2 / architecture×3 / sequence×1 / lifecycle×2 / dataflow×3 ＝ 6 型 ≥ 5（sidecar 顶层 `type` 录制时按本表落盘）；复用图与 `html_pattern` 不匹配，已在此显式登记并在 [pipeline.toml](../pipeline.toml) `[archify.html_overrides]` 落映射。P0/P6 归 3D 系列装置（HarnessStack）＋上表 12/13 两张收束图。

## P0 一个到一群（p0-01..15）→ `scenes/P0OneToCrowd.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A（3D） | p0-01..05 | HarnessStackP0 3D 五层栈自底向上落板（components/harness-stack.tsx 承担）→ 第五层「多 Agent 平台」点亮呼吸两次 → 其余层压暗待缩退；主问题字卡居中「一个人」（≤6 字形态，「一个人」三字 mech 金点睛）；角标 `多 Agent`（预告） | 栈落板与层呼吸在 HarnessStackP0 内；「一个人」金点睛一次性强调由 scene 字卡调用 `useImpulse`；`@impulse` |
| 0-B | p0-06..10 | 台面溢出装置——师傅台面（`coreDeep` 矩形）物件堆叠滑落，「重构整个后端」字卡拆四色子活卡（角标 `auth`／`db`／`route`／`test`）；三重困境三行推进（台面摆不下／一双手串行／待办断电即失）；p0-10 让位 ·**archify full**：board-vs-todo 章 `todo-vanishes` | 子活卡四色弹入 `useStagger`；物件滑落抖动 `useShake`（decay）；串行箭头依次推进 `useProgress`；p0-10 由 ArchifyRecap 主控（空窗后首现实例默认入场）；`@stagger` `@shake` `@progress` |
| 0-C | p0-11..15 | 悬念立碑——「更聪明的师傅」字卡划掉 → 五物件剪影自右缘点亮（mech 金 ×5，工坊分区环形预告位，不触碰左中 core 传送带锚位）；p0-12 让位 ·**archify full**：collab-panorama 章 `one-to-many`；p0-13..14 回落五物件剪影逐件挂标签（板／格子／班次／隔间／插口，各 ≤2 字）；p0-15 再让位 ·**archify full**：five-layer-dependency 章 `series-vow`（章尾金句衬线小卡「还是那一条」定格） | 划线否掉 `useProgress`（decelerate）；五剪影右缘滑入 `useEnter:slideR` + 常驻辉光 `useBreathe`（mech）；两处全屏回放由 ArchifyRecap 主控（跨实例接缝入场纪律见头部）；`@progress` `@enter:slideR` `@breathe` |

## P1 排工板（p1-01..19）→ `scenes/P1TaskBoard.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A（3D 一现） | p1-01..03 | 排工板母题首现（motifs.TaskBoard，mech 金卡钉板**居中**）：3D 卡片磁吸上板一现（components/solids-3d.tsx 承担，planning §3 唯二 3D 点缀之一）→ 收敛定格 2D 板；「次序」字卡＋次序示意（屋顶卡沉到地基卡下方 `deny` 短闪再翻正）；板边传送带母题露一角（LoopRing，core 橙恒定描边〔M-001〕）；角标 `.tasks/`、`blockedBy` | 3D 磁吸在 solids-3d 内（不产生 token）；卡片钉板弹入 `useEnter:pop`；次序翻正 `useSpring`；`@enter:pop` `@spring` |
| 1-B | p1-04..08 | 一文件一活与两层账本 ·**archify full**：task-board 章 `file-per-task`+`six-fields`+`three-states`（p1-04..06 三章接力）→ 换图 ·**archify full**：board-vs-todo 章 `two-layers`+`crash-resume`（p1-07..08 两章接力，与前图背靠背，后挂实例关入场）；「活放板上不放脑子里」金句由章内标签承担 | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担（本镜无动效 hook） |
| 1-C | p1-09..12 | 依赖检查与解锁播报 ·**archify full**：dependency-unlock 章 `gate-before-start`+`missing-blocked`+`bad-premise`+`unlock-broadcast`（四章接力无空窗；deny 红锁与 ok 放行瞬态由图内承担） | archify 全屏回放主控（本镜无动效 hook） |
| 1-D | p1-13..16 | p1-13 让位 ·**archify full**：task-board 章 `claim-owner`；p1-14..16 回落自制——教学版自陈卡（无锁竞态，mono 引语态）→ 官方引语卡（产品文件锁，【官】）→ 金句卡衬线定格「人人能看 · 一人撕卡」（压短形态）；双伸手同卡装置一角（两师傅剪影伸手，后者 `deny` 红短闪）；角标 `claim_task`、`owner` | p1-13 由 ArchifyRecap 主控（跨镜换图接缝关入场）；自陈／引语逐字 `useReveal`（mono）；撞卡红闪 `useImpulse`（decay）；金句卡 QuoteCard 终态停驻〔M-003〕；`@reveal` `@impulse` |
| 1-E | p1-17..19 | 官方限制卡（Limitations 引语卡，mono 引语态）＋活锁小动画（依赖箭头绕圈死等）；p1-18 让位 ·**archify full**：dependency-unlock 章 `lag-livelock`；p1-19 回落金句卡衬线定格「挡得住前提 · 挡不住忘单」（压短形态）；角标 `Task status can lag` | 引语逐字 `useReveal`；死循环绕圈 `useFlowDash`（deny）；p1-18 由 ArchifyRecap 主控（空窗后重现默认入场）；金句卡 QuoteCard〔M-003〕；`@reveal` `@flowDash` |

## P2 收件格与派工单（p2-01..32）→ `scenes/P2MailboxProtocol.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A | p2-01..04 | 组队动机——领队帽（角标 `Lead`）＋两常驻工位自下缘升起（mech 金工位）；临时工 vs 常驻同事对照卡对开（生命周期／通信／上下文／数量四轴）；编制卡「一领队 · 多队友」；角标 `subagent → teammate` | 工位升起 `useEnter:rise`；对照卡对开 `useEnter:slideL`＋`useEnter:slideR`；四轴逐行点亮 `useStagger`；`@enter:rise` `@enter:slideL` `@enter:slideR` `@stagger` |
| 2-B | p2-05..06 | 官方 Warning 引语卡（实验性／默认关闭，mono 引语态）＋「实验标签」徽标（mech 描边细态）；金句小卡「机制真 · 标签实验」（压短形态）；角标 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | 引语逐字 `useReveal`；徽标脉冲 `useImpulse`；金句卡 QuoteCard〔M-003〕；`@reveal` `@impulse` |
| 2-C | p2-07..11 | 收件格机制 ·**archify full**：mailbox-consume 章 `inbox-per-seat`+`jsonl-append`+`take-all-clear`+`peek-probe`+`host-polling`（五章接力无空窗；整摞拿走／只看不取／宿主轮询由图内承担） · 角标 `.jsonl`、`peek`、`inbox_poller` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 2-D | p2-12..14 | 工具单卡对开——队友侧（干活／读写／传话）vs 领队侧（招队友／开活／批单）；「招队友」「开新活」两行 `deny` 红删除线；金句卡衬线定格「不拦 · 没发」（压短形态）；角标 `sub_tools`、`create_task` | 对照卡对开 `useEnter:slideL`＋`useEnter:slideR`；删除线划过 `useProgress`；金句卡 QuoteCard〔M-003〕；`@enter:slideL` `@enter:slideR` `@progress` |
| 2-E | p2-15..17 | 副台渐变卡——临时工挂牌两态（无名一次性 vs 挂名按名叫醒、记忆全留）；官方引语卡（mono）；二分→渐变光谱条展开；角标 `subagent names`、`resume` | 挂牌翻转 `useSpring`；光谱条展开 `useDraw`；引语逐字 `useReveal`；`@spring` `@draw` `@reveal` |
| 2-F | p2-18..25 | 派工单机制——p2-18 引子自制（「要拍板的事」凭证位虚线框）→ p2-19..22 ·**archify full**：protocol-roundtrip 章 `two-copies`+`id-roundtrip`+`three-checks`+`stale-immune`（四章接力）→ p2-23 回落金句卡衬线定格「一张单 · 一份回执」（压短形态）→ p2-24 让位 ·**archify full**：protocol-roundtrip 章 `route-before-return` → p2-25 换图 ·**archify full**：protocol-fsm 章 `one-fsm-two-protocols`（与前图背靠背，后挂实例关入场） · 角标 `request_id`、`match_response` 由图内承担 | 引子虚线描出 `useDraw`；p2-23 金句卡 QuoteCard〔M-003〕；其余由 ArchifyRecap 主控；`@draw` |
| 2-G | p2-26..29 | 计划门拍一——p2-26 引子自制（计划单概念小字）→ p2-27..29 ·**archify full**：protocol-fsm 章 `plan-handshake`+`not-a-gate`+`self-discipline`（三章接力；教学版自陈「协议层的请求，不是代码层的门」由图内引语态承担） · 角标 `submit_plan`、`plan_approval_request` 由图内承担 | 引子小字淡入 `useEnter:fade`；三章由 ArchifyRecap 主控（空窗一句后重现，默认入场）；`@enter:fade` |
| 2-H | p2-30..32 | 权限冒泡链路图——队友审批请求 → 领队界面弹窗 → 用户批准（`dim` 灰人色节点）→ 回执回流；【三】归属徽标「开源项目作者 · 源码分析」＋官方引语卡（mono 引语态）；角标 `permission_request` | 链路逐节点点亮 `useStagger`；弹窗弹入 `useEnter:pop`；人节点呼吸 `useBreathe`（dim）；`@stagger` `@enter:pop` `@breathe` |

## P3 班次（p3-01..23）→ `scenes/P3ShiftAutonomy.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A | p3-01..03 | 领队派工过载——派工箭头 ×10 堆积（`deny` 红拥堵扇面）→ 翻转：队友自行扫板认领（mech 金箭头分流）；题词「自己看板 · 自己认领」；角标 `scan_unclaimed_tasks` | 箭头堆积 `useStagger`＋拥堵抖动 `useShake`（decay）；翻转分流 `useProgress`；`@stagger` `@shake` `@progress` |
| 3-B | p3-04..08 | 班次三拍 ·**archify full**：shift-three-beats 章 `three-beats`+`work-cap`+`idle-order`+`instruction-first`+`timeout-leave`（五章接力无空窗；轮数护栏／先格子后板顺序／超时总结条由图内承担） · 角标 `idle_poll`、`WORK / IDLE / SHUTDOWN` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 3-C | p3-09..15 | 认领循环 ·**archify full**：idle-claim-loop 章 `three-conditions`+`conj-check`+`deps-read`+`blocked-only`+`verify-receipt`（p3-09..13 五章接力）→ p3-14 空窗回落金句卡衬线定格「失败不当成功」（压短形态）→ p3-15 让位 ·**archify full**：idle-claim-loop 章 `lead-two-jobs`（与前五章同图，空窗一句后重现，默认入场） · 角标 `claim_task`、`Claimed` 由图内承担 | p3-14 金句卡 QuoteCard〔M-003〕；其余由 ArchifyRecap 主控（本镜无动效 hook） |
| 3-D | p3-16..23 | 教学 vs 产品双向卡对开（超时方向相反／复活机制／完成事件两数法三行对照）→ p3-18 让位 ·**archify full**：shift-three-beats 章 `no-fixed-timeout` → p3-19..21 回落——原地复活装置（已停队友工位收到新消息，剪影重新坐起）＋两数法对照卡（一条结果消息 vs 通知内含答案） · 角标 `idle_notification` → p3-22 让位 ·**archify full**：shift-three-beats 章 `done-two-ways` → p3-23 回落小卡「一件事 · 一次说清」 | 双向卡对开 `useEnter:slideL`＋`useEnter:slideR`；复活坐起 `useSpring`；两处让位由 ArchifyRecap 主控；尾句小卡 QuoteCard caption-dup-ok: 尾句记忆点定格小卡；`@enter:slideL` `@enter:slideR` `@spring` |

## P4 隔间（p4-01..21）→ `scenes/P4WorktreeBooths.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A | p4-01..03 | 覆盖事故——两师傅剪影同写同一文件（事故卡，角标 `config.py`，不口播），后写盖先写（`deny` 红覆盖闪）→ 文件内容两色混杂 → 回滚困境卡「分不清谁的改动」 | 覆盖红闪 `useImpulse`（decay）；内容混杂滚入 `useReveal`；困境卡抖动 `useShake`（decay）；`@impulse` `@reveal` `@shake` |
| 4-B | p4-04..09 | 隔间拓扑 ·**archify full**：worktree-bind 章 `booth-per-task`+`copies-branches`+`id-rope`+`bind-no-status`+`pre-arrange`+`auto-switch`（六章接力无空窗；编号绳／门牌／认领切目录由图内承担） · 角标 `git worktree`、`wt/{name}` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 4-C | p4-10..14 | 拆除守卫 ·**archify full**：worktree-teardown 章 `default-keep`+`dirty-refuse`+`unknown-refuse`+`discard-with-branch`+`keep-for-review`（五章接力无空窗；三出口卡与流水日志条目由图内承担） · 角标 `remove_worktree`、`discard_changes`、`events.jsonl` 由图内承担 · 与前图背靠背，本图实例关入场 | archify 全屏回放主控（本镜无动效 hook） |
| 4-D | p4-15..21 | 双重校准卡 ×2——①强度对照：LottieEmphasis 门体一现（components/LottieEmphasis.tsx 承担，薄帘门→铁门锁死动画；planning §3 唯二 3D/Lottie 点缀之二）＋官方引语卡（mono，「检查不可关闭」）＋教学版对照行「换的是落笔位置」＋题词「硬阻断 · 关不掉」 caption-dup-ok: 记忆点标签，主字已压短非逐字 ②关系对照：编号绳剪影卡——教学版独有绑法 vs 官方班组页不提隔间（负证据卡，`dim`）＋小字「官方零记载」；角标 `isolation: worktree`、`You can't turn this check off` | 门体变厚锁死 `useProgress`＋LottieEmphasis 脉冲（不产生 token）；引语逐字 `useReveal`；绳子剪断 `useImpulse`（deny）；对照卡对开 `useEnter:slideL`＋`useEnter:slideR`；`@progress` `@reveal` `@impulse` `@enter:slideL` `@enter:slideR` |

## P5 插口（p5-01..16）→ `scenes/P5McpSocket.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A | p5-01..03 | 手写工具墙——齿轮机器逐台手造（三台各配验证／执行／报错三张小卡，重复堆叠示累）；「标准协议」字卡自上缘降下；角标 `search / deploy`（动机示意，不口播） | 齿轮描线生长 `useDraw`；重复小卡堆叠 `useStagger`；字卡降下 `useEnter:fall`；`@draw` `@stagger` `@enter:fall` |
| 5-B | p5-04..09 | 标准插口机制 ·**archify full**：mcp-toolpool 章 `standard-socket`+`connect-discover`+`namespace-rename`+`no-collision`+`rebuild-each-round`+`new-machine-next-round`（六章接力无空窗；插头插入／号码簿重起名／每轮重组装由图内承担） · 角标 `connect_mcp`、`tools/list`、`mcp__{server}__{tool}` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 5-C | p5-10..12 | 缓存拆解——p5-10 引子自制（提示缓存堆叠示意，角标 `prompt cache`）→ p5-11 让位 ·**archify full**：mcp-toolpool 章 `stale-list-miss`（按旧清单叫新工具、查无此号红闪由图内承担）→ p5-12 回落取舍卡「动态换新鲜」（压短形态） | 缓存堆叠 `useStagger`；取舍卡 QuoteCard；p5-11 由 ArchifyRecap 主控（空窗一句后重现，默认入场）；`@stagger` |
| 5-D | p5-13..16 | 自我介绍卡——外接机器递名片（角标 `(readOnly)`／`(destructive)` 文本标签）→ 门禁摇头（`dim` 灰门柱）→ 工坊登记表放行（`ok` 瞬态）；官方两档引语卡（mono 引语态）；金句卡衬线定格「自我介绍 · 不算数」（压短形态）；角标 `ask / blocked` | 名片递入 `useEnter:slideR`；门禁摇头 `useShake`（decay）；登记放行 `useImpulse`（ok）；引语逐字 `useReveal`；金句卡 QuoteCard〔M-003〕；`@enter:slideR` `@shake` `@impulse` `@reveal` |

## P6 收束（p6-01..23）→ `scenes/P6Finale.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A（3D） | p6-01..08 | HarnessStackP6 3D 栈放大居中（components/harness-stack.tsx 承担，终集形态：五层全亮呼吸）→ p6-02 让位 ·**archify full**：five-layer-dependency 章 `five-lit-finale` → p6-03..04 换图 ·**archify full**：collab-panorama 章 `mech-homecoming`+`tool-belt-27`（与前图背靠背，后挂实例关入场）→ p6-05 空窗回落——费曼遗产金句卡衬线定格「两种身份 · 一条消息 一个工具」＋3D 栈缩至侧位常驻 caption-dup-ok: 费曼遗产句金句卡，主字已压短非逐字 → p6-06..08 ·**archify full**：collab-panorama 章 `identity-message`+`identity-tool`+`no-branch`（三章接力） · 角标 `27 tools`、`inject / dispatch` 由图内承担 | 3D 放大与五层点亮在 HarnessStackP6 内；p6-05 金句卡 QuoteCard〔M-003〕（components/ 承担不产生 token）；三章由 ArchifyRecap 主控（空窗一句后重现，默认入场）；本镜 scene 侧无动效 hook |
| 6-B | p6-09..13 | 计划门三拍终章卡——协议单（前幕单据缩小回放）→ 真门（循环急停：传送带母题骤停冻结，core 橙〔M-001〕静置不转）→ p6-10 让位 ·**archify full**：collab-panorama 章 `gate-three-beats`（真门停机等批由章内承担） · p6-11 回落——产品自动批（官方引语卡，mono 引语态）；「拦截挪到权限层」流向箭头（真门位 → 权限层位，`dim`）；角标 `plan_approval_response` | 单据缩小回放 `useProgress`；传送带骤停（恒速→冻结）`useProgress`（decelerate）；流向箭头 `useFlowDash`（dim）；引语逐字 `useReveal`；`@progress` `@flowDash` `@reveal` |
| 6-C | p6-14..15 | 校准总句金句卡衬线定格「教室 → 厂房」＋两句并陈小卡（教学版造教室／官方改成带门禁的厂房，不站队）；转场意象——工坊线稿从课桌排布滑向门禁厂房排布 | 金句卡 QuoteCard〔M-003〕；排布滑移 `useProgress`；并陈小卡对开 `useEnter:slideL`＋`useEnter:slideR`；`@progress` `@enter:slideL` `@enter:slideR` |
| 6-D（3D） | p6-16..23 | 系列终态——p6-16..17 回到开头（P0 台面溢出微缩回放＋五物件答卡全亮 mech 金）＋系列身份卡浮现（chip 档 ×5 全亮，**终集特款**；标题主段硬编码对账 series-layers.json，**无下期卡**：next=null）→ p6-18 同一件事三步微环（要工具／等结果／再想一步，LoopRing core 橙〔M-001〕）→ p6-19 系列收束金句卡衬线定格「机制很多 · 循环一个」 caption-dup-ok: 系列总收束句金句卡，主字已压短非逐字 → p6-20 工坊灯牌逐区点亮（五区 mech 金逐区亮起）→ p6-21 让位 ·**archify full**：collab-panorama 章 `all-lit-map`（工坊地图全亮定格）→ p6-22 回落家规金句卡「装置尽管加 · 循环不乱动」＋身份卡常驻 caption-dup-ok: 家规句金句卡，主字已压短非逐字 → p6-23 完结装置：灯牌收暗渐黑，「后会有期」小字（完结语气，无下期卡） | 答卡与身份卡浮现 `useStagger`；灯牌逐区点亮 `useProgress`；p6-21 由 ArchifyRecap 主控（空窗后重现，默认入场）；家规卡 QuoteCard〔M-003〕；收暗渐黑 `useFadeOut`（末 36 帧，窗取整镜时长）；`@stagger` `@progress` `@fadeOut` |

## 字幕规范

- 底部单行、一句一条（149 句＝149 条），与 `NarrationAudio` manifest 逐句同步；字号与安全带沿系列 frozen `Subtitle.tsx`，不另设。
- zh 字幕恒单行不折行；超宽句由 Subtitle 内部缩放兜底（81 字散文句教训见 QA 记录）。
- 英文标识符只在画面角标出现，字幕跟随口播文本；`Agent` 锚句 CMU 发音标注与「行 HANG2」两处多音字标注仅影响 TTS take，不影响字幕形态。

## 实现映射

| 幕 | 组件 | 装置重心 |
|---|---|---|
| P0 一个到一群 | `scenes/P0OneToCrowd.tsx` | HarnessStackP0（3D 落板＋层点亮）、台面溢出装置、五物件剪影立碑 |
| P1 排工板 | `scenes/P1TaskBoard.tsx` | TaskBoard 母题＋3D 磁吸一现（solids-3d）、自陈／官方引语卡、金句卡 |
| P2 收件格与派工单 | `scenes/P2MailboxProtocol.tsx` | 对照卡组（临时工 vs 常驻／工具单对开）、副台渐变卡、冒泡链路图 |
| P3 班次 | `scenes/P3ShiftAutonomy.tsx` | 过载翻转装置、双向卡、复活装置、两数法对照卡 |
| P4 隔间 | `scenes/P4WorktreeBooths.tsx` | 覆盖事故卡、LottieEmphasis 门体一现、双重校准卡 ×2 |
| P5 插口 | `scenes/P5McpSocket.tsx` | 手写工具墙、缓存堆叠、名片→门禁→登记链 |
| P6 收束 | `scenes/P6Finale.tsx` | HarnessStackP6（3D 五层全亮）、真门急停、系列身份卡（无下期卡）、家规卡＋渐黑 |

公共组件清单：`Subtitle`（frozen）· `ChapterProgress`（顶部章节条，y<56）· `SceneTag`（top:64）· `QuoteCard`／`FadeUp`／`Pill`（cards.tsx，金句卡衬线体）· `Panel`／`Terminal`／`CodeCard`／`NumberedCard`／`Counter`／`Footnote`（motifs.tsx）· 母题：`LoopRing`（传送带，M-001 恒定 core 橙）＋本集新件 `TaskBoard`（排工板居中）／`MailSlot`（收件格）／`DispatchSlip`（派工单）／`ShiftDial`（班次三拍）／`BoothFrame`（隔间门牌）／`PlugSocket`（标准插口）· `HarnessStackP0`／`HarnessStackP6`／`HarnessBadge`（harness-stack.tsx，P1–P5 常驻顶边条 chip 档，层短名走 series-layers.json）· `Stage3D`／`Slab3D`／`Rim3D`（solids-3d.tsx，P1 磁吸一现）· `LottieEmphasis`（P4 门体）· `ArchifyRecap`（archify cue 载体，frozen 共享——Stage ⑧ 接入；一章锚一句，跨实例背靠背后挂实例关入场）。

## 自检对账（Stage ⑥ 收口）

- 句覆盖：0-A p0-01 → 6-D p6-23，幕内镜区间首尾相接、跨幕无缝——32 镜 149/149 全覆盖无重叠、镜号唯一（镜界沿 narration 32 个空行 beat，一镜一 beat）。
- 图集：13 图（11 新绘＋2 复用显式登记）· 6 型（state×2／workflow×2／architecture×3／sequence×1／lifecycle×2／dataflow×3）· 67 章全锚（章章有 cue，被引用章比 67/67）。
- 锚定：67/149 ≈ 0.45 ≥ 0.30；分幕最少 P0 3/15（20%），全部 ≥1 锚；最长连续无锚 run＝10（p4-15..p5-03）≤ 12，次长 9（p0-01..09）、8（p6-11..18）。
- 单调性：各图章按锚句顺序正向播放，无逆序（board-vs-todo 首章锚 p0-10 归位序内；collab-panorama 首章锚 p0-12 归位序内；five-layer-dependency 首章锚 p0-15 序内；shift-three-beats `no-fixed-timeout` 锚 p3-18、`done-two-ways` 锚 p3-22 序内；mcp-toolpool `stale-list-miss` 尾章锚 p5-11 序内）。
- `@动词` 全部为 motion/hooks.ts 实存模型：impulse／stagger／shake／progress／enter:slideL／enter:slideR／enter:rise／enter:fall／enter:pop／enter:fade／breathe／spring／reveal／draw／flowDash／fadeOut。
- 终集特款落位：P6 五层身份卡全亮、系列收束句「机制很多 · 循环一个」金句卡、费曼遗产「两种身份」金句卡、无下期卡（series-layers.json next=null）、收尾完结语气。
