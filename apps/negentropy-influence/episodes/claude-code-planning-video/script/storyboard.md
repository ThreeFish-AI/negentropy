# 分镜：规划与协调：模型的视野是安排出来的（v2 · 169 句对齐）

> 逐字稿 SSOT：[narration.md](./narration.md)（169 句 v2，句 id 即本表定位锚，时序与 [narration.json](./narration.json) 逐句一致——p2-03／p5-04／p5-12／p5-13／p5-19 为句集空号，本表引用面只落实存句）；时长以 audio manifest 实测为准（3,603 字 ≈ 14.2 分 @254 含停顿口径，硬窗 [13.0, 14.6] 分）。
> 一镜（beat）＝2–8 句连续句共享同一主画面（单句镜沿前作先例允许），镜界沿 ⑤ 成文优化已切好的空行 beat；句区间覆盖本幕每一句、无交叠无遗漏（`check_script.py` 强制）；镜号与 `scenes/P*.tsx` 内嵌 `<Sequence name="N-X">` 规范对应，全表镜号唯一（ROW_RE 防折叠）。
>
> **本集视觉契约**（[theme.ts](../video/src/design/theme.ts)，与 [planning.md](./planning.md) §三一致）：
> `core` 陶土橙 `#D97757`＝循环内核／传送带——**全系列恒定视觉锚〔M-001〕**：锁死描边色与绝对线宽，本集戏份收窄为底盘背景＋P5 事故现场（0-A 常转、5-A 急停） · `coreDeep` `#B45A3C`＝**台面（上下文窗口）描边——本集恒定主视觉** · `mech` `#9C90EE` 紫＝**本集维度色：五件「安排台面」的装置**（工序卡／副台／抽屉／垫纸／补救梯一律紫） · `mechDeep` `#7A6BC9`＝装置深态（暗态／描边深档） · `deny` `#EF6461`＝拒绝／危险唯一语义（熄火／闸门落锁／打叉／对撞失败侧） · `ok` `#7ED321`＝恢复成功／重发通过瞬态 · 师傅（及副台翻版）／用户／过程数据一律无彩（`text` 白／`dim` 灰）——**装置才有颜色**。
> 恒定空间契约（防〔X-001〕空间逆旁白）：**台面恒居画面中央**（coreDeep 描边大矩形，继承系列「恒定锚」锚位法并换主角——执行层的锚是循环，本层的锚是台面）；五装置自**右缘／上缘**依次挂入（mech 紫），「安排台面」的动效只作用于台面内容物（增／删／换），不触碰装置自身形体；师傅剪影（text 白无彩）立于台面后侧；金句卡衬线体（`theme.serif`）。
>
> **画面纪律**：画面文字只放关键词／数字／标签（≤6 字），不复述口播（RSI-007，刻意定格处在该行注 `caption-dup-ok:` 豁免）；英文标识符只进角标（`todo_write`／`task`／`SKILL.md`／`stop_reason` 等，口播零英文——例外仅 Harness）；三处拆源码引语带归属角标「开源项目作者 · 源码分析」；顶部安全带 y<56 由章节条占用，画面内容 y≥56 起，SceneTag 维持 top:64；画面零信源站标识、零他集标题。
> **3D 面积裁定（Stage ⑥ 定）**：3D 仅 P0／P6 HarnessStack 系列装置＋P2 副台升起 solids-3d 一现（planning §3 两候选取一）；P5 补救梯**不做** Lottie 点缀——梯子全程由图集承载（`LottieEmphasis` 本集未启用）——控制 3D／动效回归面。
> **archify 资产档位**：全屏独占（`forbid_inset`，无画中画）——播放期自制装置由 ArchifyYield 淡出让位或空窗句回落；章节数据＝录制 SSOT，见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长＝拍数 × max(1100ms, 3200ms/拍数)；cue 纪律：一章锚一句（`at('句id')` + `dur('同句id')` 单参），同锚句双 cue 即 FAIL，跨实例背靠背（含镜界切换）后挂实例须 `lead={false}`。
> ⚠️ 动效列与一切散文**禁写**画面列那套档位字面标注（覆盖门按全文计数断言，多一处命中即 FAIL）；`@动词` 只用 [motion/hooks.ts](../video/src/motion/hooks.ts) 实存模型，判据＝本镜 `<Sequence>` 内由本幕 scene 自身定义的装置调用了该 `useXxx(`（`components/` 内装置承担者一律散文点名，不产生 token）。

## 图集预算表（12 图全原生重建；6 型；68 章＝cue 计划 68，锚定率 68/169≈0.40 ≥ 0.30，密度 ≈4.8/分 ≥ 3.0——时长按 14.2 分预估，以 manifest 实测为准）

| # | slug（落 `docs/assets/architecture/agent-harness/claude-code--<slug>.html`） | 型 | 服务幕/句段 | 章 |
| --- | --- | --- | --- | --- |
| 1 | plan-todo-states | lifecycle | P1 三态卡（p1-09） | 1 |
| 2 | plan-todo-swap | workflow | P1 换卡规矩＋催更回路（p1-10..16，p1-13／p1-16 空窗回落） | 5 |
| 3 | plan-side-desk | architecture | P2 副台解剖＋三条边界（p2-10..16，p2-12／p2-14 空窗回落） | 5 |
| 4 | plan-side-guards | state | P2 撞线回溯＋回执同形（p2-21..24） | 4 |
| 5 | plan-skill-layers | dataflow | P3 抽屉两层渐进披露（p3-05..09） | 5 |
| 6 | plan-skill-registry | workflow | P3 注册表按名查找（p3-10..14） | 5 |
| 7 | plan-skill-lifespan | lifecycle | P3 两层寿命差（p3-15..20） | 6 |
| 8 | plan-prompt-sections | architecture | P4 分段定义＋两类策略（p4-07..09） | 3 |
| 9 | plan-prompt-cache | workflow | P4 循环内重估＋确定性键（p4-15..17） | 3 |
| 10 | plan-recovery-ladder | state | P5 三级梯三访（p5-05..11 挂梯分诊／p5-20..26 超长＋瞬态级／p5-34 退出协议） | 15 |
| 11 | plan-truncation-order | sequence | P5 先判断后写入（p5-14..18） | 5 |
| 12 | plan-panorama | architecture | P0 全景两瞥（p0-07、p0-15）＋P1 收束一瞥（p1-26）＋P6 总装对账（p6-01..09，p6-08 空窗回落） | 11 |

> 型多样性＝lifecycle×2 / workflow×3 / architecture×3 / state×2 / dataflow×1 / sequence×1 ＝ 6 型 ≥ 5（sidecar 顶层 `type` 录制时按本表落盘）。
> **命名与复用登记**：slug＝planning.md 图集表工作名统一加 `plan-` 前缀（维度前缀区分，与系列既有各集图集及 docs 研究渲染产物零撞名，本集内一致）。`plan-panorama` 为总装全景题材的**原生重绘版**——docs 既有同题材研究渲染产物（前缀不同的另一文件）不引用、不回填；因 slug 已带维度前缀、`html_pattern` 直接命中，复用旧产物的 override 通道按 planning.md 裁决**不启用**，此处显式登记。planning.md 图集表标总装全景服务 P5 系②阶段口径，narration v2 备注将总装对账落 P6——本表按 narration SSOT 执行（主战场 P6，P0／P1 各一瞥）。

## P0 每轮从头读（p0-01..16）→ `scenes/P0FreshRead.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A（3D） | p0-01..05 | HarnessStackP0 3D 五层栈自底向上落板（components/harness-stack.tsx 承担）→ 本集层「规划与协调」点亮呼吸两次 → 缩退为顶边常驻条（HarnessBadge，P1–P6 常驻）；主问题字卡居中「谁定的」（≤6 字形态），「谁」字 `mech` 紫点睛；**中央台面首现**（coreDeep 描边大矩形〔M-001 立锚〕，全片恒定主视觉，本镜后永不换位）；底盘 LoopRing 传送带慢转（`core` 橙恒定线宽）；角标 `context window` | 栈落板/呼吸/缩退在 HarnessStackP0 内；台面描线生长 scene 装置 `useDraw`；「谁」字紫点睛一次性强调 `useImpulse`；`@draw` `@impulse` |
| 0-B | p0-06..07 | 师傅剪影（`text` 白，无彩）立于台面后侧；每轮开工「从头读」动效——视线扫描线自左向右扫过台面内容物（dim 虚线）；p0-07 句让位——全景图左半一瞥（台面＋读扫主轴） ·**archify full**：plan-panorama 章 `desk-reread` · 读毕回落自制扫描线收尾 | 剪影淡入 `useEnter:fade`；扫描线行进 `useFlowDash`（`dim`）；p0-07 由 ArchifyRecap 主控；`@enter:fade` `@flowDash` |
| 0-C | p0-08..12 | 四坑四联卡快闪：坑一「摊薄」（嘱托行逐条变淡）／坑二「长住」（文件图标堆进台面）／坑三「全付」（三大部头压上垫纸角）／坑四「白干」（末卡 `deny` 红脉冲＋程序窗格熄火图形）——四坑全落在中央台面的内容物上，台面框体恒静〔M-001〕 | 四卡依次入场 `useStagger`；台面内容物逐件恶化 `useReveal`；末卡红闪 `useImpulse`（decay 态包络，`deny`）；`@stagger` `@reveal` `@impulse` |
| 0-D | p0-13..16 | 立碑：「更聪明的师傅」字卡划线否掉 → 五装置预告剪影自右缘挂入（`mech` 紫 ×5：卡／副台／抽屉／垫纸／梯，作用于台面内容物、不触碰装置形体）；金句卡衬线预告态「看见什么 · 不由它」（压短形态）caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字 · p0-15 句让位——全景图五装置总览一闪 ·**archify full**：plan-panorama 章 `five-devices` · 角标 `Harness` | 划线否掉 `useProgress`（decelerate）；五剪影右缘滑入 `useEnter:slideR`＋常驻辉光 `useBreathe`（`mech`）；金句卡 QuoteCard；p0-15 由 ArchifyRecap 主控；`@progress` `@enter:slideR` `@breathe` |

## P1 工序卡（p1-01..27）→ `scenes/P1TodoCard.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A | p1-01..04 | 坑一对账卡（「坑一 · 跑偏」`mech` 紫点亮）＋工序卡首现——一张 `mech` 紫卡片自上下落钉入台面上缘（coreDeep 台面恒静〔M-001〕）；步骤条目「一条条写上、钉好」逐条显形（待办空格图标）；角标 `todo_write` | 对账卡淡入；工序卡下落钉位 `useEnter:fall`；条目逐条显形 `useStagger`；`@enter:fall` `@stagger` |
| 1-B | p1-05..08 | 「什么都不执行」三连否：读文件、跑命令两图标各打红叉（`deny`），内存、终端进度两图标点亮（`mech`）；终端进度条逐格推进（实景卡 mono）；角标 `CURRENT_TODOS`、`terminal render` | 四图标依次点亮/打叉 `useStagger`；红叉一次性脉冲 `useImpulse`（`deny`）；进度格滚动 `useCount`；`@stagger` `@impulse` `@count` |
| 1-C | p1-09 | 三态卡全屏独占 ·**archify full**：plan-todo-states 章 `three-states` · 角标 `pending / in_progress / completed` 由图内承担 | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担（本镜无动效 hook） |
| 1-D | p1-10..16 | 换卡规矩＋催更回路 ·**archify full**：plan-todo-swap 章 `whole-swap`+`validate-first`+`no-half-card`+`nag-counter`+`reset-on-send` · p1-13／p1-16 空窗句回落——p1-13＝「忙起来会忘」过渡小卡、p1-16＝教学自陈徽标条（「教学设计 · 产品源码无此款」，`dim` 置底）· 角标 `_normalize_todos`、`<reminder>` 由图内承担 | archify 全屏回放主控；两处空窗回落小卡 `useEnter:pop`／徽标条 `useEnter:fade`；`@enter:pop` `@enter:fade` |
| 1-E | p1-17..23 | D1 反转对撞卡：左＝拆源码侧（mono 引语卡，归属角标「开源项目作者 · 源码分析」）「两套并存 · 交互式默认任务图」／右＝官方文档页（dim 页样）；两箭头相撞后右倾（官方轨胜出）；三段口径递进小条（并存 → 反转 → 全关）；角标 `isTodoV2Enabled()`、`TodoWrite disabled by default`、`CLAUDE_CODE_ENABLE_TASKS=0` | 引语逐字流出 `useReveal`（mono）；左右页依次入场 `useStagger`；对撞右倾 `useSpring`（局部帧）；`@stagger` `@reveal` `@spring` |
| 1-F | p1-24..27 | 收束：对开小卡「工具 ≠ 规划」（左＝`mech` 工具卡划暗／右＝coreDeep 台面上规划字样恒亮）→ 同一开关翻转演示（两年前强制开 → 如今关掉换旧，mono 拨杆）；p1-26 句让位——全景图工序卡区一瞥（该装置压暗＋退场注记） ·**archify full**：plan-panorama 章 `tool-fade` · p1-27 计划模式产品锚卡（批准闸门 `deny` 红锁＋「一个字不落盘」封条）· 角标 `plan mode` | 对开小卡递进 `useStagger`；开关拨杆翻转 `useSpring`；锚卡升起 `useEnter:rise`；p1-26 由 ArchifyRecap 主控；`@stagger` `@spring` `@enter:rise` |

## P2 副台与回执（p2-01..30）→ `scenes/P2SideDesk.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..02 | 坑二对账卡（「坑二 · 过程污染」`mech` 点亮）＋上下文污染滚涨：台面内容物滚涨动画（文件图标一行行堆叠，`dim`）；滚涨计数数字卡三联（三十文件／六十轮／一百多条，叙事口径注记）；角标 `messages` | 文件图标逐行堆叠 `useStagger`；计数卡滚动 `useCount`；`@stagger` `@count` |
| 2-B（3D 一现） | p2-04..07 | 副台升起动效（components/solids-3d.tsx 承担，`mech` 紫台体自主台右侧展开——planning §3 唯一 3D 点缀）；全新台面上只放一张任务条子（白纸无彩）；主台内容对副台压暗不可见（隔离带 dim 虚线）；师傅翻版（`text` 白无彩剪影）在副台从头干起、跑自己的循环（mini LoopRing，`core` 橙微缩）；角标 `task`、`fresh context` | 3D 台体升起在 solids-3d 内（不产生 token）；任务条子落位 `useEnter:pop`；主台侧压暗 `useDim`（to 0.35）；`@enter:pop` `@dim` |
| 2-C | p2-08..09 | 回执仪式：副台干活的中间过程碎纸化（`dim` 灰淡出飘散，过程不进主台）；单张回执（`mech` 紫描边纸片）跨过台面边界落在主台台面；题词「一张回执 · 过程作废」；角标 `extract_text`、`only summary` | 碎纸消散推进 `useProgress`；回执弧线滑移落位 `useSpring`（局部帧）；`@progress` `@spring` |
| 2-D | p2-10..16 | 副台解剖＋三条边界 ·**archify full**：plan-side-desk 章 `three-borders`+`border-world`+`border-gate`+`no-sub-desk`+`recursion-capability` · p2-12／p2-14 空窗句回落——p2-12＝「同工作区」文件落地小标记、p2-14＝「拦因回传」小卡 · 角标 `same WORKDIR` 由图内承担 | archify 全屏回放主控；两处空窗回落小标记/小卡 `useEnter:pop`；`@enter:pop` |
| 2-E | p2-17..20 | D2 对撞卡：左＝拆源码侧（mono 引语卡，归属角标「开源项目作者 · 源码分析」）「派生工具默认在禁用名单」／右＝官方文档页「默认可再派 · 最深三层」；箭头相撞后右倾；收束条「教学不给工具 · 产品默认放开 · 以官方为准」（`dim` 置底）；角标 `subagents up to three layers` | 引语逐字 `useReveal`；两页依次入场 `useStagger`；对撞右倾 `useSpring`；`@stagger` `@reveal` `@spring` |
| 2-F | p2-21..24 | 撞线回溯＋回执同形 ·**archify full**：plan-side-guards 章 `turn-cap`+`backward-scan`+`same-shape`+`receipt-blind` · 角标 `turn cap`（定性）、`fallback line` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 2-G | p2-25..30 | 官方双边界两联卡：上联「干净 ≠ 空」——副台开工随行件（项目嘱托册＋代码状态快照两图标，`dim`）／下联「隔过程 · 不隔结果」——回执落在主台台面上的占位刻度条（回执也花钱）；角标 `CLAUDE.md hierarchy`、`git status snapshot` | 两联卡依次点亮 `useStagger`；占位刻度条展开 `useReveal`；`@stagger` `@reveal` |

## P3 抽屉与手册（p3-01..24）→ `scenes/P3SkillDrawers.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..04 | 坑三对账卡（「坑三 · 全款付费」`mech` 点亮）＋反例滚屏：三份大部头规范拼进垫纸（`mech` 紫垫纸层在 coreDeep 台面上）一行行滚出；「六千多行」数字卡（叙事口径注记）；每轮付费刻度累积；角标 `system prompt` | 大部头滚屏逐行 `useReveal`；数字卡滚动 `useCount`；`@reveal` `@count` |
| 3-B | p3-05..09 | 工具柜抽屉两层 ·**archify full**：plan-skill-layers 章 `drawer-labels`+`manual-inside`+`cheap-catalog`+`costly-fulltext`+`split-in-time` · 角标 `SKILL.md`、`catalog ~100 tokens` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 3-C | p3-10..14 | 注册表按名查找 ·**archify full**：plan-skill-registry 章 `name-only`+`startup-scan`+`name-for-fulltext`+`no-path-to-forge`+`designed-away` · 角标 `SKILL_REGISTRY`、`load_skill` 由图内承担（背靠背上挂——本镜实例 `lead={false}`） | archify 全屏回放主控（本镜无动效 hook） |
| 3-D | p3-15..20 | 两层寿命差 ·**archify full**：plan-skill-lifespan 章 `lifespan-split`+`manual-in-history`+`compact-sweeps`+`label-stays`+`re-paste-budget`+`pair-not-either` · 角标 `tool_result`、`auto-compaction` 由图内承担（背靠背上挂——本镜实例 `lead={false}`） | archify 全屏回放主控（本镜无动效 hook） |
| 3-E | p3-21..24 | 官方延伸双例小卡：例一「子目录惰性」（首触该目录文件才加载，`mech` 描边细态）／例二「外部工具定义先收后展」（折叠形态图标）；收束题词「先知道 · 再递手册」；角标 `deferred by default` | 双例小卡依次快闪 `useStagger`；题词淡入 `useEnter:fade`；`@stagger` `@enter:fade` |

## P4 垫纸重铺（p4-01..22）→ `scenes/P4PromptRelay.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..06 | 坑四对账卡（「写死三种死法」`mech` 点亮）＋垫纸特写（coreDeep 台面上的 `mech` 紫垫纸层）：「写死」滚屏——一大段字符串整块不可分（mono 滚出）；三种死法三小卡（整张重写／新旧打架／全量白付费，末卡 `deny` 描边）；角标 `SYSTEM = "..."` | 字符串滚屏逐行 `useReveal`；三小卡依次入场 `useStagger`；`@reveal` `@stagger` |
| 4-B | p4-07..09 | 分段拼装 ·**archify full**：plan-prompt-sections 章 `sectioned-define`+`always-sections`+`conditional-memory` · 角标 `PROMPT_SECTIONS`、`assemble_system_prompt` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 4-C | p4-10..14 | 「事实 vs 猜测」分屏：左＝问文件系统（存在性检查直接命中，`mech` 紫点亮＋文件图标）／右＝扫消息文本找关键词（问号图形，`dim` 压暗打叉 `deny`）；金句卡衬线定格「看真实状态 · 不听嘴上」（压短形态，终态可停驻〔M-003〕）caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字 · 角标 `os.path.exists`、`list(TOOL_HANDLERS)` | 分屏对开 `useEnter:slideL`＋`useEnter:slideR`；左侧命中一次性点亮 `useImpulse`（`mech`）；右侧打叉抖动 `useShake`（decay，`deny`）；金句卡 QuoteCard 终态；`@enter:slideL` `@enter:slideR` `@impulse` `@shake` |
| 4-D | p4-15..17 | 循环内重估＋缓存 ·**archify full**：plan-prompt-cache 章 `re-eval-per-turn`+`deterministic-key`+`no-builtin-hash` · 角标 `json.dumps(sort_keys=True)`、`hash() ✗` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 4-E | p4-18..22 | 最硬官方锚引语卡：官方文档页样（`dim`）＋中文摘要两行（引语态）；「垫纸是垫纸 · 条子是条子」对开小卡（两层分开铺）；门槛数字卡「开头两百行」（官方引语态注记）；角标 `delivered as a user message, not part of the system prompt` | 引语逐字 `useReveal`；对开小卡递进 `useStagger`；数字卡滚动 `useCount`；`@reveal` `@stagger` `@count` |

## P5 补救梯（p5-01..36）→ `scenes/P5RecoveryLadder.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..03 | 坑四对账卡（`deny` 红脉冲「白干 · 到期」）＋熄火演示：底盘传送带（LoopRing，`core` 橙〔M-001〕）急停停转、程序窗格黑屏熄火（`deny` 描边）；「第五件 · 保台面」题词；角标 `Error: 529 overloaded` | 急停一次性脉冲 `useImpulse`（`deny`）；窗格压暗 `useDim`；题词淡入 `useEnter:fade`；`@impulse` `@dim` `@enter:fade` |
| 5-B | p5-05..11 | 三级梯挂梯＋分诊 ·**archify full**：plan-recovery-ladder 章 `ladder-mounted`+`snap-truncated`+`snap-overflow`+`snap-transient`+`three-catches`+`layer-split`+`truncation-last` · 梯级次序锁死（截断／超长／瞬态），每级闸门 `deny` 落锁 · 角标 `stop_reason == "max_tokens"`、`prompt_too_long`、`429 / 529` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 5-C | p5-14..18 | 先判断后写入时序 ·**archify full**：plan-truncation-order 章 `raise-budget`+`resend-verbatim`+`judge-before-write`+`order-is-correctness`+`continuation-capped` · 「先写再续」支路打叉 `deny` · 角标 `max_tokens check BEFORE append` 由图内承担（背靠背上挂——本镜实例 `lead={false}`） | archify 全屏回放主控（本镜无动效 hook） |
| 5-D | p5-20..26 | 超长级＋瞬态级 ·**archify full**：plan-recovery-ladder 章 `compact-then-retry`+`compact-once-gate`+`give-up-oversize`+`backoff-with-jitter`+`jitter-anti-avalanche`+`official-ten-retries`+`fallback-chain` · 一次性闸落锁／退避时间轴间隔指数拉长＋抖动散点 · 角标 `has_attempted_reactive_compact`、`Retry-After`、`up to 10 times` 由图内承担（背靠背上挂——本镜实例 `lead={false}`） | archify 全屏回放主控（本镜无动效 hook） |
| 5-E | p5-27..33 | D3 对撞卡＋两路径对开图：上层对撞——左＝拆源码侧（mono 引语卡，归属角标「开源项目作者 · 源码分析」）「连续三次自动切备用」／右＝官方文档页「重试烧完提示手动换」；下层两路径方向对开——输入侧降档箭头↓ vs 输出侧升档箭头↑（方向相背，各标触发条件）；角标 `reduced max_tokens` vs `8K → 64K` | 引语逐字 `useReveal`；对撞右倾 `useSpring`；对开图两侧展开 `useEnter:slideL`＋`useEnter:slideR`；`@reveal` `@spring` `@enter:slideL` `@enter:slideR` |
| 5-F | p5-34..36 | p5-34 句让位——梯子终点退出协议（记日志 → 错误写回 → 退出三步，不裸崩） ·**archify full**：plan-recovery-ladder 章 `exit-protocol` · p5-35..36 回落——官方同款对照卡（「反复撑爆 · 停手报错」，`dim` 页样）＋收束题词「每条退路 · 自带一道闸」（`mech` 描边，压短形态）· 角标 `[unrecoverable]`、`Autocompact is thrashing` | 回落对照卡依次点亮 `useStagger`；题词终态停驻〔M-003〕；p5-34 由 ArchifyRecap 主控；`@stagger` |

## P6 收束（p6-01..19）→ `scenes/P6ArrangedView.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01..02 | 总装回放起手 ·**archify full**：plan-panorama 章 `question-return`+`workshop-answers` · 左半「这一轮看见什么」主轴点亮 · 角标 `context window` 由图内承担 | archify 全屏回放主控（本镜无动效 hook） |
| 6-B | p6-03..09 | 五机制收账 ·**archify full**：plan-panorama 章 `m1-pinned`+`m2-isolated`+`m3-two-books`+`m4-relaid`+`m5-protected`+`visibility-only` · 五装置逐一打钩（`mech` ×5），台面 coreDeep 恒静〔M-001〕· p6-08 空窗句回落——「零新本事」小卡（背靠背上挂——本镜实例 `lead={false}`） | archify 全屏回放主控；空窗回落小卡 `useEnter:pop`；`@enter:pop` |
| 6-C | p6-10..11 | 金句卡衬线体终态〔M-003〕：对开定格「师傅管想 · 工坊管看」（压短形态，句中点抽帧仍可读出该陈述）caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字 | 金句卡淡入定格 `useEnter:fade`（一次性特效只作入场）；`@enter:fade` |
| 6-D | p6-12..15 | 开放问题对照卡：左「逐件拆掉」vs 右「长在工坊身上」——天平悬停不落（留白不裁决）；官方两头后手注记条（关了清单工具 · 留了计划模式与能存住的任务，`dim` 页样）；角标 `plan mode`、`tasks persist across compactions` | 对照卡对开 `useEnter:slideL`＋`useEnter:slideR`；天平悬停呼吸 `useBreathe`（`dim`，刻意不停驻单侧）；`@enter:slideL` `@enter:slideR` `@breathe` |
| 6-E（3D） | p6-16..19 | HarnessStackP6 3D 栈重新放大居中（components/harness-stack.tsx 承担）＋下期层呼吸预告（NEXT_LAYER 数据驱动）＋系列身份卡（chip 档，标题主段「规划与协调：模型的视野是安排出来的」受检硬编码——数据对账 series-layers.json ↔ series.json）＋下期卡（next 走 series-layers.json，规则 8 对账；口播只说「下期」）；工坊灯牌收暗渐黑 | 3D 放大与层板点亮在 HarnessStackP6 内；身份卡/下期卡浮现 `useStagger`；灯牌收暗 `useFadeOut`（末 36 帧，窗取整镜时长）；`@stagger` `@fadeOut` |

## 字幕规范

- 底部单行、一句一条（169 句＝169 条），与 `NarrationAudio` manifest 逐句同步；字号与安全带沿系列 frozen `Subtitle.tsx`，不另设。
- zh 字幕恒单行不折行；超宽句由 Subtitle 内部缩放兜底。
- 英文标识符只在画面角标出现，字幕跟随口播文本；发音标注（`<行|HANG2>`，p3-02／p4-22 两处）仅影响 TTS take，不影响字幕形态（narration.json 的 `ttsText` 已分账）。

## 实现映射

| 幕 | 组件 | 装置重心 |
| --- | --- | --- |
| P0 每轮从头读 | `scenes/P0FreshRead.tsx` | HarnessStackP0（3D）、主问题字卡、中央台面立锚（DeskPlane）、四坑四联卡、立碑＋金句卡预告态 |
| P1 工序卡 | `scenes/P1TodoCard.tsx` | 工序卡钉入（台面恒静）、三连否图标阵、D1 对撞卡、开关翻转、计划模式锚卡 |
| P2 副台与回执 | `scenes/P2SideDesk.tsx` | solids-3d 副台一现、回执仪式（ReceiptPaper）、D2 对撞卡、官方双边界两联卡 |
| P3 抽屉与手册 | `scenes/P3SkillDrawers.tsx` | 反例滚屏＋付费刻度、官方延伸双例小卡（中段三镜全屏图集承载） |
| P4 垫纸重铺 | `scenes/P4PromptRelay.tsx` | 写死滚屏、事实 vs 猜测分屏＋金句卡、官方锚引语卡 |
| P5 补救梯 | `scenes/P5RecoveryLadder.tsx` | 熄火演示、D3 对撞卡＋两路径对开图、退出协议回落＋收束题词（梯子本体全屏图集承载，无 Lottie） |
| P6 收束 | `scenes/P6ArrangedView.tsx` | HarnessStackP6（3D）、金句卡终态、开放天平、系列身份卡/下期卡 |

公共组件清单：`Subtitle`（frozen）· `ChapterProgress`（顶部章节条，y<56）· `SceneTag`（top:64）· `QuoteCard`／`FadeUp`／`Pill`（cards.tsx，金句卡衬线体）· `Panel`／`Terminal`／`CodeCard`／`NumberedCard`／`Counter`／`Footnote`（motifs.tsx）· `LoopRing`（传送带母题，core 橙〔M-001〕系列恒定——本集底盘背景＋5-A 急停复用）· **本集新增母题（Stage ⑧ 落 motifs.tsx）**：`DeskPlane`（台面恒定主视觉，coreDeep 描边大矩形）／`ClashCard`（三连反转对撞卡共用形态，D1/D2/D3）／`ReceiptPaper`（回执纸）· scaffold 旧母题 `DispatchTable`／`GateRouter`／`SlotRing` 本集不用（Stage ⑧ 可裁）· `HarnessStackP0`／`HarnessStackP6`／`HarnessBadge`（harness-stack.tsx，P1–P6 顶边常驻条 chip 档）· `Stage3D`／`Slab3D` 等（solids-3d.tsx，P2 副台一现）· `LottieEmphasis`（本集未启用——P5 梯子由图集承载；plug-pulse.json＋gen 为 scaffold 共享基线的跨集字节一致拷贝，保留非活跃链路标记，DispatchTable/GateRouter/SlotRing 同理由保留）· `ArchifyRecap`（archify cue 载体，frozen 共享——Stage ⑧ 接入；一章锚一句，跨实例背靠背后挂实例 `lead={false}`）。

## 自检对账（Stage ⑥ 收口）

- 句覆盖：0-A p0-01 → 6-E p6-19，幕内镜区间首尾相接、跨幕无缝——38 镜 169/169 全覆盖无重叠、镜号全表唯一（p2-03／p5-04／p5-12／p5-13／p5-19 为 narration v2 句集空号，不在任何 `at()`/`dur()` 引用面）。
- 图集：12 图全原生重建（无复用登记项）· 6 型（lifecycle/workflow/architecture/state/dataflow/sequence）· 68 章＝cue 计划 68。
- 锚定：68/169 ≈ 0.40 ≥ 0.30；分幕最少 P0 2/16（0.125），七幕全部 ≥1 锚且分幕率 ≥0.05；最长连续无锚 run＝10（p1-16..25、p2-25..p3-04、p3-21..p4-06、p6-10..19 四处）≤ 12，次长 9（p0-16..p1-08、p1-27..p2-09）。
- 单调性：各图章按锚句顺序正向播放，无逆序（plan-recovery-ladder 三访 p5-05..11 → p5-20..26 → p5-34；plan-panorama p0-07 → p0-15 → p1-26 → p6-01..09）。
- 背靠背清单（后挂实例 `lead={false}`）：1-D（承 1-C）／3-C（承 3-B）／3-D（承 3-C）／5-C（承 5-B）／5-D（承 5-C）／6-B（承 6-A）。
- `@动词` 全部为 motion/hooks.ts 实存模型：draw／impulse／enter:fade／flowDash／stagger／reveal／enter:slideR／breathe／progress／enter:fall／count／spring／enter:pop／enter:rise／dim／shake／enter:slideL／fadeOut。
