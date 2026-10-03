# 分镜表 · 《多 Agent 平台：七件设施，一条走廊》（v1，对齐 narration v2）

> **句 id 对齐**：镜内句区间引用 narration.md v2（147 句 / 40 beats / 7 幕），区间覆盖无交叠无遗漏。
> **时长**：以 `video/public/audio/manifest.json` 实测为准（edge 终声 +12%：纯语音 13.71 分，含时距 14.3 分，@30fps）。
> **本集视觉契约**（与 planning.md §3 一致）：赭金 `#D9B36B`＝七件设施·公共制度（accents）；core 橙 `#D97757`＝环形走廊＝循环（〔M-001〕恒定锚：锁死描边色与绝对线宽 6px，全片同形出场只换标签）；深赭 `#A8823F`＝私人房层（仅装饰线/填充，不作文本色）；deny 红 `#FF5C5C`＝消融警示侧；确认绿 `#7ED321`＝拦截成功侧；底座 bg/panel/text/dim 不变。楼体母题面色 `#10151d`（P0/P6 楼体，共享常量 `LODGE_INK`）与夜幕底 `#04060a`/`#05070a`（P0 开场黑罩 / P6 6-J 夜幕）为母题装饰底，不占语义槽。
> **构图纪律**：公共设施层恒在楼下、私人房层恒在楼上〔X-001〕；消融恒左坏右好；顶部安全带 y<56 归章节条（内容 y≥56 起）；角标 bottom ≥150 避字幕带。
> **全屏独占三分法**：archify 逐章回放镜为全屏独占（forbid_inset），装置镜与回放镜分镜不混排；跨实例背靠背（含镜界）后挂实例 `lead={false}`。

## P0 失忆的楼（p0-01..p0-12）→ `scenes/P0ForgetfulLodge.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A 钩子·楼亮灯 | p0-01..p0-03 | 深夜城市一角：一栋两层小楼剪影自左向右逐窗亮灯（2D；楼下层五格设施位虚位、楼上房带暗格）；一位师傅剪影在窗前伏案又「擦除重来」（对话窗口溢出碎屑）。首秒高反差：全黑城市→单楼亮起，与口播「这是」同步发力。角标：`agent loop`、`context window` | 楼窗逐亮 `@stagger`；师傅擦除 `@dim`；楼体入场 `@enter:flyIn`〔开篇首镜视听合力定式〕 |
| 0-B 单干塌 | p0-04..p0-07 | 单师傅工位放大：四模块细节卡（认证/数据库/路由/测试）从对话窗口边缘溢出掉落；旧待办清单随会话切换蒸发（淡出）。p0-07 主问题金句卡浮起：「计划放在谁手里？」（衬线金句卡） | 掉落 `@enter:fall`；蒸发 `@dim`；金句卡 `@enter:rise`＋`@spring` 落位 |
| 0-C 换房·七件套预告 | p0-08..p0-12 | ·**archify full**：seven-artifacts `overview`+`public-five`+`private-rooms`+`corridor`（全屏逐章：楼体总图→公共层五设施→楼上房带→走廊环点亮〔M-001：core 橙 6px 定妆〕；第七位留黑「?」）；章毕缩为右上角常驻坐标装置（lodge-map 缩略几何，后续换幕高亮） | 逐章回放；设施点亮 `@impulse`；缩略收角 `@enter:fade` |

## P1 任务墙（p1-01..p1-25）→ `scenes/P1TaskWall.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A 设施开张·卡解剖 | p1-01..p1-05 | 大厅任务墙母题首亮相（纵向墙面，磁挂牌）：·**archify full**：task-card-anatomy `card-fields`+`three-states`+`two-actions`（全屏独占逐章：六字段网格→三态→两动作） | 逐章回放（ArchifyRecap 主控）；坐标装置高亮「任务墙」 |
| 1-B 墙不挂脑子 | p1-06..p1-07 | 装置镜：进程小人倒地（灰）、墙面磁卡仍在（金）；新师傅走进读墙。金句字幕位「进程死了，墙还在」（画面只放关键词：进程 ✕ / 墙 ✓） | 小人倒地 `@enter:fall`；墙卡常驻〔M-003〕；读墙扫光 `@flow` |
| 1-C 走查·守卫 | p1-08..p1-14 | ·**archify full**：dependency-failclosed `four-cards`+`walkthrough`+`blocked`+`failclosed`（四卡上墙→认领建库表三关→完成播报解锁→写测试被阻塞→幽灵编号分支；fail-closed 章红色强调） | 逐章回放； Animated State Trace 由图章承载 |
| 1-D 自取三条件 | p1-15..p1-16 | 装置镜：空闲师傅扫墙（三条件闸门卡：待办∧无主∧前置全清，三盏灯依次亮）；写名占住（名字盖上卡） | 闸灯 `@stagger`；写名盖章 `@impulse` |
| 1-E 消融①② | p1-17..p1-20 | ·**archify full**：claim-guards-break `three-gates`+`b1`+`b2-b2v`+`ok`（三闸串联→三条拆除支路红侧→绿侧对照） | 逐章回放（左坏右好构图由图承载） |
| 1-F 消融③·t5race | p1-21..p1-25 | ·**archify full**：claim-race-window `two-lifelines`+`interleaved`+`overwrite`+`window`（双生命线交错→落笔重叠→竞争窗口红色高亮）。p1-25 金句卡压尾：「守卫挡得住明抢，挡不住同一瞬间」 | 逐章回放；金句卡 `@enter:rise` |

## P2 递话口（p2-01..p2-19）→ `scenes/P2MailSlot.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A 帮工 vs 队友 | p2-01..p2-04 | 门上递话口母题首亮相：影子帮工（来去半透明）vs 常驻队友（门牌+工位长亮）对照；队友=后台线程小图（说明单/对话/工具箱三件） | 影子 `@enter:fade`；工位亮 `@breathe`；三件 `@stagger` |
| 2-B 口的规矩 | p2-05..p2-08 | ·**archify full**：mailslot-consume `append`+`take-all`（追加一行→整摞取走清空；只看不取的探测支线） | 逐章回放 |
| 2-C 楼替人盯口 | p2-09..p2-13 | 装置镜：队列汇流——键盘事件与口内信条两条流汇入同一注入口（师傅剪影被叫醒）；甲乙两口信先后入队长的口、整摞取走同屏 | 双流 `@flow`；汇流 `@travel`；取走 `@count`（2 条） |
| 2-D 边界在工具单 | p2-14..p2-15 | 队友工具单特写：四件工具卡中「招队友」「开新活」两格灰缺（✕ 标记）；嵌套示意（套娃被打叉） | 灰缺格 `@dim`；打叉 `@impulse` |
| 2-E 消融④ | p2-16..p2-17 | ·**archify full**：mailslot-consume `wake`+`b3`（唤醒回路→红侧：同一封信被读第二遍、活儿重做） | 逐章回放 |
| 2-F 官方对照 | p2-18..p2-19 | 官方对照卡（页样+三行摘要：实验性/默认关/环境开关；收件箱=文件·逐条校验）【官】角标 | 卡片 `@enter:rise`；要点 `@reveal` |

## P3 回执簿与值班钟（p3-01..p3-23）→ `scenes/P3LedgerClock.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A 双设施开张 | p3-01..p3-03 | 前台回执簿（单据一式两份+编号章）与墙角值班钟（钟摆+表盘）双母题亮相；两个场景卡（关机/报备）各一闪 | 双母题 `@enter:slideL`/`@enter:slideR`；场景卡 `@impulse` |
| 3-B 三道核验 | p3-04..p3-09 | ·**archify full**：receipt-ledger `roundtrip`+`three-checks`+`settle`（单号往返→三闸→销账；第二张回执不理会）＋ receipt-fsm `approve-reject`（一套状态机两协议：待定→已批准/已拒绝；背靠背 lead={false}——勿反引号，会被对账器当章token） | 逐章回放 |
| 3-C 消融⑤·翻烧饼 | p3-10..p3-12 | ·**archify full**：receipt-ledger `b4`（错类销错单→重复翻面→终态被拒，账面翻烧饼三连红） | 逐章回放 |
| 3-D 诚实缺口① | p3-13..p3-14 | 诚实边界卡：计划门=只发了一封信（信封图标飞出、线程仍在跑——小灯常亮）；「天亮前回来合上」伏笔标记（金句位挂「缺口①」角标） | 信封 `@enter:flyIn`；小灯 `@breathe`；伏笔角标 `@impulse` |
| 3-E 值班钟节拍 | p3-15..p3-19 | ·**archify full**：duty-clock-loop `three-states`+`tick-order`+`timeout`（三态环→每五秒先口后墙→六十秒十二拍收工留结论） | 逐章回放 |
| 3-F 消融⑥·钟不停 | p3-20..p3-21 | ·**archify full**：duty-clock-loop `b5`（红侧：板上没活、钟转十倍仍不停；对照绿侧到点收工） | 逐章回放 |
| 3-G 工牌重注入 | p3-22..p3-23 | 装置镜：对话被压短（卡片压缩动画）→师傅头顶工牌淡出→楼（梁上一只手）重挂工牌点亮 | 压缩 `@dim`；工牌淡出 `@enter:fade`；重挂 `@impulse`＋`@spring` |

## P4 门牌房（p4-01..p4-18）→ `scenes/P4RoomPlate.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A 事故现场 | p4-01..p4-03 | 楼上房带亮灯；事故重演：同目录两笔写同一文件（两支笔交错、后写覆盖先写红闪）；回滚箭头打结 | 覆盖 `@shake`＋红闪；打结 `@draw` |
| 4-B 账本与房间 | p4-04..p4-06 | ·**archify full**：room-ledger-bind `ledger`+`branches`（中央账本→三条独立线→三间门牌房） | 逐章回放 |
| 4-C 绑定与校验 | p4-07..p4-08 | ·**archify full**：room-ledger-bind `bind`+`namecheck`（任务卡加房号字段只写字段不改状态→名字过校验防跳板） | 逐章回放 |
| 4-D 认领进房·缺口② | p4-09..p4-11 | 装置镜：认领带房号的卡→读写落房（目录标签切换）；诚实边界卡：这一段只把房号写进提醒、目录不真切（虚线箭头+「缺口②」角标，天亮前合上） | 目录切换 `@travel`；虚线 `@draw`；角标 `@impulse` |
| 4-E 拆房三出口 | p4-12..p4-16 | ·**archify full**：room-teardown `entry`+`refuse`+`force-keep`+`audit`（默认不拆→清点→拒拆/强删连分支/保留等审→事件日志）。p4-15 金句位「有改动，拒拆」 | 逐章回放 |
| 4-F 产品对照 | p4-17..p4-18 | 产品对照角标卡：任务卡与门牌房=两套独立系统（图示拆开的双系统）【三】归属角标 | 卡片 `@enter:rise`；拆开 `@spring` |

## P5 认证插座（p5-01..p5-16）→ `scenes/P5SocketPlate.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A 插座开张 | p5-01..p5-02 | 楼下插座位亮灯；内部服务矩阵（工单/部署/知识库）逐个亮起又打「重写接入？」问号 | 矩阵 `@stagger`；问号 `@impulse` |
| 5-B 连接发现挂牌 | p5-03..p5-07 | ·**archify full**：socket-pool `connect-discover`+`prefix`（连接→报清单→前缀挂牌入池；两服务同叫「查」不相撞） | 逐章回放 |
| 5-C 拆缓存的账 | p5-08..p5-12 | ·**archify full**：socket-pool `rebuild`+`stale`（每轮重组回路→红侧：旧清单叫新工具·查无此号；代价注记「图新鲜，就不吃缓存」） | 逐章回放 |
| 5-D 铭牌与边界 | p5-13..p5-16 | 铭牌特写：「只读/破坏性」文字标签+「不拦截」角标（门装在收官段的钩子上——门形图标虚位）；教学版外接仅队长边界卡；产品丰富度角标【三】 | 铭牌 `@enter:pop`；虚位门 `@dim`；角标 `@impulse` |

## P6 环形走廊（p6-01..p6-31）→ `scenes/P6CorridorFinale.tsx`

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A 第七件揭晓 | p6-01..p6-03 | 坐标装置放大回全屏：六设施灯全亮、第七位揭晓动画——core 橙走廊环点亮贯通全楼（标题回收帧「第七件设施」）；「全组最重要一张表」引子 | 走廊环点亮 `@draw`＋`@breathe`〔M-001〕；回收帧 `@impulse` |
| 6-B 终考·空格自填 | p6-04..p6-06 | ·**archify full**：collab-panorama `four-prep`（沿途图空格态三秒——格子虚线+「?」；观众自填后逐格点亮：输入钩子/通知注入/压缩/组装） | 逐章回放（空格→点亮的节奏由章内 pulse 承载）；`@enter:fade` 前置空格帧 |
| 6-C 终考·岔口与回流 | p6-07..p6-09 | ·**archify full**：collab-panorama `llm-judge`+`dispatch`+`externals`（调模型→单岔口判据→权限→三分发→回填/停止；外部状态不在循环里） | 逐章回放（lead={false} 接续前章） |
| 6-D 判据卡 | p6-10..p6-11 | 装置镜：判据卡——「工具调用块在场 ✓」vs「嘴上说的停 ✗」叉勾对照（角标 `tool_use`/`stop_reason`）；金句位「看单子，不看嘴」 | 叉勾 `@impulse`；金句 `@enter:rise` |
| 6-E 五增量·合口 | p6-12..p6-18 | 五增量卡逐张：权限钩子（门前检查）/ 真门急停（走廊冻结帧+「缺口① 合口」标记点亮）/ 四层压缩管线（四层阶梯）/ 恢复梯子（三级台阶）/ 切目录（「缺口② 合口」标记点亮，实线箭头替换 4-D 虚线） | 五卡 `@stagger`；合口标记 `@impulse`＋`@count`（2/2）；走廊冻结 `@dim` |
| 6-F 两种身份 | p6-19..p6-20 | 两种身份入场图：一条消息流与一个工具流汇入走廊（循环体高亮「零分支」——岔口仍是那一个） | 双流 `@flow`；汇入 `@travel`；零分支标注 `@impulse` |
| 6-G 数字卡 | p6-21 | 数字卡（useCount 双标尺）：27 件内置工具滚动点名（工具名小字流过）；2130 行标尺（基线=教学码实测口径，双档口径色角标） | `@count` 滚动；标尺 `@draw` |
| 6-H 收官断言 | p6-22..p6-24 | 收官断言金句卡（衬线体两句照读）；五层身份卡半亮预备（第五层呼吸） | 金句卡 `@enter:rise`；第五层 `@breathe` |
| 6-I 边界护栏卡 | p6-25..p6-26 | 边界护栏卡：证明了什么（自洽 ✓）/ 没证明什么（并发正确 ✗——墙上同瞬间双认领小图回指；闭源内部只有一层转述 ✗） | 双栏 `@enter:slideL`/`@enter:slideR`；✓✗ `@impulse` |
| 6-J 天亮·回收 | p6-27..p6-29 | 天亮转场（窗外泛白，楼体暖光）；主问题回收卡（P0 金句卡回归：「计划放在谁手里？」→「谁都不持有——墙持有、簿持有、账本持有，走廊只是转」三设施图标+走廊环） | 泛白 `@dim`（提亮）；回收卡 `@enter:rise`；走廊环末次定妆〔M-001〕 |
| 6-K 终章·五层全亮 | p6-30..p6-31 | ·**archify full**：five-layer-dependency `five-lit-finale`（五层栈全亮终态，系列身份卡底图）；五层身份卡（HarnessStackP6）叠出：本集层高亮+已发布四层点亮、无下期层；系列金句压底。渐黑+完结语（FinaleTail 挂末 Sequence 最后子节点，渐黑窗从末 beat 时长推导） | 逐章回放→身份卡 `@stagger`；完结语 `@reveal`；`@fadeout`（FinaleTail） |

## 字幕规范

底部单行、一句一条（frozen Subtitle：zh 恒单行 30px，fitText 自适应≤1528px）；与配音逐句同步（manifest 实测驱动）；字幕带高约 54+44px——各镜角标/公式 bottom ≥150 避让；画面文字只放关键词/数字/标签，禁与口播逐字复述（check 复述门执法；金句卡同文处已按关键词锚点设计，若命中逐字重合以 `caption-dup-ok:` 逐处豁免）。

## 实现映射

| 幕 | 组件 | 公共装置 |
|---|---|---|
| P0 | `P0ForgetfulLodge` | 楼体剖面缩略坐标装置（`components/motifs.tsx` 的 `LodgeMap`：下层设施带+上层房带+走廊环，换幕高亮 API）；走廊环母题 `CorridorRing`（同文件；core 橙 6px 描边恒定〔M-001〕，自 ep1 `LoopRing` 复制裁剪） |
| P1 | `P1TaskWall` | 磁挂牌墙（`MagnetCard`）；闸门三灯卡；金句卡（frozen cards） |
| P2 | `P2MailSlot` | 门+递话口装置（`DoorWithSlot`，幕内定义）；队列汇流（`@flow` 双流） |
| P3 | `P3LedgerClock` | 回执簿（单据+编号章，幕内定义）；值班钟（钟摆 `@spring`）；工牌 |
| P4 | `P4RoomPlate` | 账本-房间拓扑装置；覆盖事故红闪；伏笔角标组件（缺口①②，P6 复用点亮态） |
| P5 | `P5SocketPlate` | 插排+插头+挂牌（幕内定义）；铭牌卡 |
| P6 | `P6CorridorFinale` | `harness-stack.tsx`/`solids-3d.tsx`（自 ep4 复制：P6 五层身份卡全亮+完结语气，无下期层）；终考空格帧；数字卡双标尺；边界护栏卡；FinaleTail（渐黑+完结语，挂 P6 末 Sequence 最后子节点） |

archify 逐章回放统一走 `ArchifyRecap`（frozen）；cue 写法：章 id+锚句+fit，同锚句唯一；跨实例背靠背（6-B→6-C 镜界）后挂实例 `lead={false}`；fit 缺省自动挡（stretch/hold/trim），显式 fit 留给超窗章。
