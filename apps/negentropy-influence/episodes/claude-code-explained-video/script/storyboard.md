# 分镜：工具与执行：一个循环，三层外设（v1 · 141 句对齐）

> 逐字稿 SSOT：[narration.md](./narration.md)（v2，141 句 3326 字，句 id 即本表定位锚，时序与 [narration.json](./narration.json) 逐句一致）；时长以 audio manifest 实测为准（3326 字 ≈ 13.3 分 @250 含停顿口径，硬窗 [13.0, 14.6] 分）。
> 一镜（beat）＝1–6 句连续句共享同一主画面，镜界以 ⑤ 已切好的空行 beat 为主、少数幕内再切分或合并（2-A/2-B 在 p2-04 切开同一 beat，6-B 合并 ⑤ 的两个 beat）；句区间覆盖本幕每一句、无交叠无遗漏（`check_script.py` 强制）；镜号与 `scenes/P*.tsx` 内嵌 `<Sequence name="N-X">` 规范对应，全表镜号唯一。
>
> **本集视觉契约**（[theme.ts](../video/src/design/theme.ts)，与 [planning.md](./planning.md) §三一致）：
> `core` 陶土橙 `#D97757`＝**接诊循环——全片恒定视觉锚〔M-001〕**：锁死描边色（core）与绝对线宽（5px）与刻度绝对值，圆环装置同形可缩放（直径随镜适配 280–340，R11 补齐——R10 漏改本行），只换周边标签 · `mech` 石青 `#64C4C0`＝**三层外设**（开单表／把关／规程节点——一切「长在循环外」的东西） · `deny` 红 `#EF6461`＝禁忌与拦截（硬拒／阻断／实验崩溃侧） · `dim` 灰＝签字问人与人肉段（有意见但要人拍板／疲惫往返） · `ok` 绿 `#7ED321`＝放行与机制在位瞬态（消融对照绿侧） · 医生／来诊者／过程数据一律无彩（`text` 白／`dim` 灰）——**装置才有颜色**。
> 恒定空间契约（防〔X-001〕空间逆旁白）：**接诊循环恒居画面中央**（core 橙圆环〔M-001〕，全片锚位不变——同形可缩放：描边色/5px 线宽/刻度绝对值锁死，直径随镜适配 280–340）；三层外设自**右缘**依次挂入（mech 青）；行数尺（102/135/180/232 四格进度条）落**底部安全带**（y 880–920：archify 画框下缘与字幕避让带之间）——生命周期：0-D 首现 102／1-G 复亮／2-C 点 135／**P3·P4 两幕不携尺**（第三格 180 +关、第四格 232 +节点 首亮在 5-B 四版对账逐章复现）／5-B 全景 0→4 逐章重点亮／6-A 全亮——既不被 5-B 全屏画框遮盖、也不进长句字幕板区；禁忌表永远画在把关链最前且不可被覆盖（「翻不了案」的空间表达）；医生位左、科室门右，全片不换位。
>
> **画面纪律**：画面文字只放关键词／数字／标签（≤6 字），不复述口播（RSI-007，刻意定格处在该行注 `caption-dup-ok:` 豁免）；英文标识符只进角标（`messages`／`tool_use`／`tool_result`／`stop_reason`／`DENY_LIST`／`HOOKS` 等，口播零英文——例外仅 Harness 与 AI）；三处拆源码引语带归属角标「对外拆解口径」；顶部安全带 y<56 由章节条占用，画面内容 y≥56 起；画面零信源站标识、零他集标题（P6 系列身份卡五层层板为系列统一装置、沿既有先例）。
> **3D／Lottie 裁定（Stage ⑥ 定）**：本集**不启用** 3D 层栈与 Lottie（规避 ISSUE-202 headless ANGLE 挂死族）；装置全部原生 SVG＋运动层；P6 系列身份卡复用 five-layer 图集承载。
> **archify 资产档位**：全屏独占（`forbid_inset`，无画中画）——播放期自制装置让位或空窗句回落自制卡；章节数据＝录制 SSOT，见 [../video/public/archify/views/](../video/public/archify/views/)；cue 纪律：一章锚一句（`at('句id')` + `dur('同句id')` 单参），同锚句双 cue 即 FAIL，跨实例背靠背（含镜界切换）后挂实例须 `lead={false}`。
> ⚠️ 动效列与一切散文**禁写**画面列那套档位字面标注；`@动词` 只用 [motion/hooks.ts](../video/src/motion/hooks.ts) 实存模型，判据＝本镜 `<Sequence>` 内由本幕 scene 自身定义的装置调用了该 `useXxx(`（`components/` 内装置承担者一律散文点名，不产生 token）。

## 图集预算表（14 图＝13 新绘＋1 复用；5 型；67 章＝cue 计划 62，锚定率 62/141≈0.44 ≥ 0.30，密度 ≈4.7/分 ≥ 3.0——时长按 13.3 分预估，以 manifest 实测为准）

| # | slug（落 `docs/assets/architecture/agent-harness/claude-code--<slug>.html`） | 型 | 服务幕/句段 | 章 |
| --- | --- | --- | --- | --- |
| 1 | human-relay | workflow | P0 人肉往返与循环接手（p0-04/05/10/15） | 5 |
| 2 | intake-loop | architecture | P1 循环本体 5 cue·3 实例（p1-01/02/09/11/12） | 5 |
| 3 | stop-reason-race | sequence | P1 流式坑与实验 1（p1-13/16/17/18/20） | 5 |
| 4 | dispatch-table | dataflow | P2 查表分发与围栏（p2-07/08/19） | 5 |
| 5 | lookup-failure | lifecycle | P2 实验 2 全程（p2-11..15） | 5 |
| 6 | gate-three-tier | lifecycle | P3 三重把关（p3-01/04/05/06/09） | 5 |
| 7 | gate-order-ablation | workflow | P3 实验 3（p3-11..14） | 4 |
| 8 | gate-four-result | architecture | P3 生产版对照（p3-22..25） | 5 |
| 9 | hook-mount | dataflow | P4 四点位挂载（p4-05..10） | 5 |
| 10 | hookresult-tri | lifecycle | P4 三值与实验 4（p4-12/14/15/17/18） | 5 |
| 11 | stop-guard | lifecycle | P4 双保险与实验 5（p4-20..25） | 5 |
| 12 | preflight-chain | sequence | P5 全链五工序（p5-01..05） | 5 |
| 13 | four-version-ledger | lifecycle | P5 四版对账（p5-09..13） | 5 |
| 复用 | five-layer-dependency（html_overrides） | architecture | P6 系列身份卡（p6-01/09） | 3 |

> 型多样性＝workflow×2 / architecture×3 / lifecycle×5 / sequence×2 / dataflow×2 ＝ 5 型 ≥ 5（sidecar 顶层 `type` 已预置随录制落盘）。`four-version-ledger` 的 `v2-table` 章仅在 P5 引用（P2 的「执行行」句用自制代码卡对切，避免同图章跨幕回放乱序）；`human-relay·your-hands`、`gate-four-result·override`、`five-layer·loop-first`、`dispatch-table·order-in`、`dispatch-table·feed-back` 五章本集不引用（章比 62/67≈0.93 ≥ 0.30）。

## P0 失忆的医生（p0-01..15）→ `scenes/P0ForgetfulDoctor.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A | p0-01..03 | 开场设问：聊天框两侧定格（左用户敲字／右模型回复一段建议）；p0-03「白纸」隐喻——一张白纸卡从聊天框飘落、定格压短关键词「一张白纸 · 全忘」（`dim`，非逐字复述）；角标 `llm(messages)` | 聊天框双侧错峰淡入 `useStagger`；白纸卡飘落定格 `useEnter:fall`（scene 自定义白纸装置，压短形态）；`@stagger` `@enter:fall` |
| 0-B | p0-04..06 | 人肉往返 ·**archify full**：human-relay 章 `manual-full`+`talk-only` · p0-05 句让位 ·**archify full**：human-relay （talk-only） · p0-06 金句回落——自制金句卡衬线体「说完了 · 活还是你的」（压短形态）caption-dup-ok: 金句卡定格记忆点，主字压短非逐字；角标 `chat` | archify 全屏回放主控（两章同实例连播自动抑制）；金句卡 QuoteCard 衬线定格（components 承担者，散文点名，不产生 token） |
| 0-C | p0-07..11 | **诊室定场（母题定妆）**：自制诊室全景首现——中央接诊循环圆环（core 橙〔M-001〕锁线宽，五步位刻度暂虚）、左上病历本槽位（下方常驻字条 `病历本 = 唯一凭据 · 每轮全量重读`，随病历本组淡入）、左医生位（无彩剪影，位上标签 `医生 · 模型`）、右科室门；「Harness」字卡挂门楣；p0-10 句让位 ·**archify full**：human-relay 章 `loop-takes-over`（R10：诊室常驻件拆锚窗外两段——p0-10 全屏窗内诊室整体退场、p0-11 回场重放定妆＋Harness 挂牌随「这套程序叫 Harness」落位，3-F 嵌套 Sequence 范式） | 诊室四件依次入场 `useStagger`（循环母题随组淡入定妆，core 橙恒定线宽；回场段重放）；Harness 字卡钉位 pop 入场（components 承担，散文点名）；p0-10 由 ArchifyRecap 主控；`@stagger` |
| 0-D | p0-12..15 | 行数尺首现：底边四格进度条（第一格 `102` 点亮，其余虚影）＋**102 大数字卡**（120px core 橙发光计数落点，CountCard）；p0-14 三枚外设剪影（表／关／节点，mech 青）自右缘挂入循环右侧；p0-15 句让位 ·**archify full**：human-relay 章 `gap-preview`；角标 `102 行 · 教学版`（锚 p0-12..14 自制段，R11 收窗——(246,64) 在画框外、不遮盖须随自制段退场）（金句卡「三层外设」**裁定不落**：p0-15 全句窗让位给 gap-preview，集名主段定格已由 P6 系列身份卡承担——2026-10-02 评审回写） | 102 大数字卡计数点亮 `useCount`＋落点脉冲 `useImpulse`（core）；底边尺带首格静态点亮（LineGauge lit=1，components 承担者，散文点名）；三剪影右缘滑入与常驻微光由 PeripheralRow 内 `useStagger`＋`useBreathe` 承担（components 承担者，散文点名）；p0-15 由 ArchifyRecap 主控；`@count` `@impulse` |

## P1 接诊循环（p1-01..26）→ `scenes/P1IntakeLoop.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A | p1-01..06 | 循环本体五步：p1-01 句让位 ·**archify full**：intake-loop 章 `five-steps`+`full-reread` · p1-02 句让位 ·**archify full**：intake-loop （full-reread） · p1-03..06 回落自制——诊室圆环特写，五步位逐个点亮（全量进诊→落账→收单→执行→回喂，core 橙流转动）；角标 `messages`／`tool_use`／`tool_result` 逐步浮现 | 两章连播（单实例内自动抑制）；自制段五步位逐句锚定 `useProgress`×5（2026-10-02 评审修复：均匀 fit 滞后一步，改各步独立锚「第N步」句头）＋环体缓转 `useFlowDash`（core 橙）；角标逐个浮现 `useReveal`；`@progress` `@flowDash` `@reveal` |
| 1-B | p1-07..10 | 病历本两署名：p1-09 句让位 ·**archify full**：intake-loop 章 `two-signatures` · 其余句回落自制——病历本特写（两栏表头「问方／答方」逐条落字；科室报告卡片无署名栏、被贴进问方栏瞬间 `mech` 青高亮）；角标 `tool_result → user 信封` | 落字逐条 `useReveal`（mono）；贴栏瞬间一次性强调 `useImpulse`（mech）；p1-09 由 ArchifyRecap 主控；`@reveal` `@impulse` |
| 1-C | p1-11..12 | 判停分屏：p1-11 句让位 ·**archify full**：intake-loop 章 `order-or-done`+`discharge-return` · p1-12 句让位 ·**archify full**：intake-loop （discharge-return）（同图相邻两章，单实例内自动抑制）；自制判停刻度收尾（环上「开单→转／没单→停」两态拨杆）；角标：stop_reason（打叉淡出）vs 内容块（点亮）——两态对照（R11 补齐缺的半边；纯文字角标名不加反引号防章名解析） | 两章连播（单实例内自动抑制）；拨杆两态翻转 `useSpring`（局部帧）；`@spring` |
| 1-D | p1-13..15 | 流式坑：p1-13 句让位 ·**archify full**：stop-reason-race 章 `stream-order` · p1-14..15 回落自制——传真纸页逐页吐出动画（单子先落盘、盖章标记迟迟未到，`dim` 灰纸页＋迟到标记 `deny` 红闪）；角标 `流式=逐段输出` | 纸页吐出 `useStagger`（scene 传真装置）；迟到标记红闪 `useImpulse`（deny）；p1-13 由 ArchifyRecap 主控；`@stagger` `@impulse` |
| 1-E | p1-16..20 | 实验 1 对照：p1-16 前半自制实验封条卡（「破坏性实验 · 1」mono 徽标）→ p1-16 句尾让位 ·**archify full**：stop-reason-race 章 `stop-late` · p1-17 句让位 ·**archify full**：stop-reason-race 章 `stop-die` · p1-18 句让位 ·**archify full**：stop-reason-race 章 `block-live` · p1-19 回落自制双轨小卡（旧判据／新判据两卡对切）· p1-20 句让位 ·**archify full**：stop-reason-race 章 `verdict` · 金句「看内容 · 不看迟到的标记」不设卡（口播已收束，图内承担）；角标 `1 轮 0 工具 vs 3 轮 2 工具` | 封条卡落下（components 承担，散文点名）；同图四段连播（单实例内自动抑制，stop-late/stop-die 分锚 p1-16 尾/p1-17 避同锚句双 cue）；双轨小卡对切 `useStagger`；`@stagger` |
| 1-F | p1-21..23 | 生产版对照（自制卡）：千行级文件示意（大矩形虚化＋「千行级」角标，**不引具体行数**）内一小段循环内核高亮「三十来行」；四周保护壳图标阵列（超时／报错／中止／停机）；归属角标「对外拆解口径」 | 大矩形淡入 `useEnter:fade`；内核段高亮 `useImpulse`；保护壳图标阵列 `useStagger`；`@enter:fade` `@impulse` `@stagger` |
| 1-G | p1-24..26 | 交棒：行数尺第一格复亮＋医生位旁命令行卡片（拼查看／拼替换两条命令皱眉小脸）；p1-26 下一层剪影（开单表，mech 青）自右缘探入 | 命令行卡片抖动 `useSpring`（微幅）；开单表剪影探入 `useEnter:slideR`；`@spring` `@enter:slideR` |

## P2 开单表（p2-01..21）→ `scenes/P2DispatchTable.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..03 | 痛点自制：单工具时代——医生位旁一张命令单卡（仅 `bash` 一行索引）；p2-02 翻译损耗——「想读文件」意图书卡 → 拼成长命令（两卡间一条缠绕箭头，`dim`）；p2-03 解法预告——开单表册页剪影（mech 青）；角标 `bash only` | 意图书卡与命令卡对切 `useStagger`；缠绕箭头描线 `useDraw`（dim）；册页剪影探入 `useEnter:slideR`；`@stagger` `@draw` `@enter:slideR` |
| 2-B | p2-04..08 | 开单表：p2-04..06 自制——表册翻开、两笔登记动效（说明单落页＋登记行钉入，mech 青）；p2-06 五科室行逐行点亮（跑命令/读文件/写文件/改文件/找文件，五行走索引）；p2-07 句让位 ·**archify full**：dispatch-table 章 `table-lookup`+`grow-table` · p2-08 句让位 ·**archify full**：dispatch-table （grow-table）（金句「进表不进循环」由图内承担）；角标（代码字样，画内呈现）：TOOLS ／ TOOL_HANDLERS | 表册翻页 `useSpring`；两笔登记 `useStagger`；两章连播（单实例内自动抑制）；`@spring` `@stagger` |
| 2-C | p2-09..10 | 执行行唯一一回（自制代码卡对切）：两行代码卡前后翻转——`run_bash()` 写死版 → `HANDLERS[name](**input)` 查表版（mono，翻转瞬间 `mech` 青下划线）；行数尺第二格 `135` 点亮；角标 `执行行：只换过一次 · 教学版` | 代码卡翻转 `useSpring`；行数尺第二格点亮 `useCount`；`@spring` `@count` |
| 2-D | p2-11..15 | 实验 2 全程：p2-11 自制实验封条卡（「破坏性实验 · 2」）→ p2-11 句尾让位 ·**archify full**：lookup-failure 章 `unknown-in`+`hard-crash`+`soft-unknown`+`self-fix`+`verdict` · p2-12 句让位 （hard-crash） · p2-13 句让位 （soft-unknown） · p2-14 句让位 （self-fix） · p2-15 句让位 （verdict）（同图五章连播，单实例内自动抑制）；角标 `KeyError` vs `Unknown` | 封条卡（components 承担，散文点名）；五章连播 ArchifyRecap 主控（本镜无自制动效 hook） |
| 2-E | p2-16..18 | 多单与并行（自制对照卡）：左卡——一轮三张单按序过科室（教学版串行，单据排队小动画）；右卡——分批并行示意（批内同排三单齐闪、批间箭头保序）；「同一工具两个实例：只读 ✓ 并行／带删除 ✗ 排队」小注；归属角标「对外拆解口径」 | 左卡单据排队 `useStagger`（dim）；右卡同排齐闪 `useImpulse`（mech）；两卡对切 `useStagger`；`@stagger` `@impulse` |
| 2-F | p2-19..21 | 院内围栏：p2-19 句让位 ·**archify full**：dispatch-table 章 `dept-exec`（图内围栏可见：文件三科被细线围栏圈住、命令外线绕开）· p2-20..21 回落自制——围栏特写（细线描边 `mech` 青微光）＋外线通道 `deny` 红警示描边一次；埋雷定格小卡「下一幕出事」；角标 `safe_path · 仅文件科` | p2-19 由 ArchifyRecap 主控；围栏描线 `useDraw`；外线警示 `useImpulse`（deny）；埋雷小卡 `useEnter:pop`；`@draw` `@impulse` `@enter:pop` |

## P3 三重把关（p3-01..26）→ `scenes/P3ThreeGates.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..03 | 事故快闪：指令卡「清理一下项目」→ 一张整盘删除命令单（`rm -rf /` 字样）已递到科室门口、`deny` 红警示描边急闪；p3-01 句尾让位 ·**archify full**：gate-three-tier 章 `arrive` · p3-02..03 回落自制——三层筛装置剪影旋入画面右侧（mech 青）；角标 `rm -rf /` | 指令卡→命令单对切 `useStagger`；红描边急闪 `useImpulse`（deny）；三层筛旋入 `useEnter:slideR`；p3-01 由 ArchifyRecap 主控；`@stagger` `@impulse` `@enter:slideR` |
| 3-B | p3-04..09 | 三重把关主体：p3-04 句让位 ·**archify full**：gate-three-tier 章 `hard-deny`+`rule-hit`+`ask-sign`+`default-pass` · p3-05 句让位 （rule-hit） · p3-06 句让位 （ask-sign） · p3-07..08 回落自制——皆空默认直行道（单据小卡列队过闸，`ok` 绿瞬态）· p3-09 句让位 ·**archify full**：gate-three-tier （default-pass）（被拒回执在图内）；角标（代码字样，画内呈现）：DENY→RULES→ASK | 同图三章＋回环 default-pass 连播（单实例内自动抑制）；直行道单据列队 `useStagger`＋放行绿闪 `useImpulse`（ok）；`@stagger` `@impulse` |
| 3-C | p3-10..11 | 铁律卡（自制）：禁忌表格上盖封条章「翻不了案」（`deny` 红印章下压）；p3-11 句让位 ·**archify full**：gate-order-ablation 章 `normal-first`（正常序：禁忌表最先拦下——顺序的基准态）；角标：顺序=机制（画内呈现） | 封条章盖下 `useEnter:fall`＋压纸震颤 `useSpring`（微幅）；p3-11 由 ArchifyRecap 主控；`@enter:fall` `@spring` |
| 3-D | p3-12..15 | 实验 3：p3-12 句让位 ·**archify full**：gate-order-ablation 章 `reorder-early`+`one-y-pass`+`wipe-zero` · p3-13 句让位 （one-y-pass） · p3-14 句让位 （wipe-zero） · p3-15 回落自制金句卡「次序 · 就是机制」衬线定格 caption-dup-ok: 压短记忆点（口播「把关的次序，本身就是机制」缩为六字）（金句卡为 components 承担者，散文点名）；角标 `4 文件 → 0` | 同图三章连播（单实例内自动抑制）；本镜无 scene 自制动效 hook（金句卡由 components 承担） |
| 3-E | p3-16..20 | 两面性（自制卡）：左半「过拦」——绝对路径删除列表逐条划掉（`deny` 连坐线）；右半「漏拦」——命令变体／套层展开两条小字逃逸箭头绕过筛子；p3-19 作者自认引语卡（「示意 · 不是安全边界」，mono 引号）；p3-20 词边界补丁小卡（`词边界` 角标点亮，归属注「规则层补丁」）；角标 `词边界正则` | 左半划线 `useProgress`（连坐）；右半箭头逃逸 `useFlowDash`（dim）；引语卡逐字 `useReveal`；补丁卡点亮 `useImpulse`（mech）；`@progress` `@flowDash` `@reveal` `@impulse` |
| 3-F | p3-21..26 | 生产版对照：p3-21 自制过渡（「真实产品里 · 厚得多」小卡）→ p3-22 句让位 ·**archify full**：gate-four-result 章 `four-states`+`eight-sources`+`classifier`+`fallback-human` · p3-23 句让位 （eight-sources） · p3-24 句让位 （classifier） · p3-25 句让位 （fallback-human） · p3-26 回落自制收束——关卡徽章 vs 医生位（关卡侧「放行」徽（ok） 绿点亮、医生侧无徽（dim））；归属角标「对外拆解口径」＋`官方分层口径`（分层【官】、四态/八来源/分类器【三】——2026-10-02 评审改：原裸 `官方文档` 与回溯分级相悖） | 过渡小卡 `useEnter:pop`；同图四章连播（单实例内自动抑制）；收束徽章点亮 `useImpulse`（ok）；`@enter:pop` `@impulse` |

## P4 规程节点（p4-01..27）→ `scenes/P4HookNodes.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..04 | 循环膨胀（自制）：循环圆环被一行行检查代码塞胖（环体变形抖动、core 橙描边被撑皱）＋注释行「很快认不出来」mono 定格；p4-04 立场句金句卡「扩行为 · 不动循环」衬线定格 caption-dup-ok: 压短记忆点非逐字；角标 `check_permission() 内嵌` | 代码行塞入 `useStagger`；环体撑皱 `useSpring`（微幅抖动）；金句卡 QuoteCard；`@stagger` `@spring` |
| 4-B | p4-05..11 | 四点位挂载：p4-05 句让位 ·**archify full**：hook-mount 章 `four-mounts`+`pre-intercept`+`post-ledger`+`stop-recall`+`registry` · p4-06 自制回落（提交后点位小卡）· p4-07 句让位 （pre-intercept） · p4-08 句让位 （post-ledger） · p4-09 句让位 （stop-recall） · p4-10 句让位 （registry） · p4-11 回落自制——循环环体四向节点座微光定格（mech 青插座）＋「到点喊一嗓子」声波纹一次；角标 `UserPromptSubmit/PreToolUse/PostToolUse/Stop` | 同图五章穿插连播（单实例内背靠背自动抑制换章弹入）；p4-06 小卡 `useEnter:pop`；p4-11 四向节点座错峰入场 `useStagger`；四向节点微光 `useBreathe`（mech）；声波纹 `useImpulse`；`@enter:pop` `@stagger` `@breathe` `@impulse` |
| 4-C | p4-12..16 | 三值语义：p4-12 句让位 ·**archify full**：hookresult-tri 章 `tri-overview`+`first-wins`+`false-trap` · p4-13 自制回落（空槽→下一个箭头小卡）· p4-14 句让位 （first-wins） · p4-15 句让位 （false-trap） · p4-16 回落自制陷阱警示条（「空不空 ≠ 真不真」mono 条，`deny` 红下划线）；角标 `None / not None`（中文注） | 同图三章连播（单实例内自动抑制）；p4-13 小卡 `useEnter:pop`；p4-16 警示条面板入场 `useEnter:fade`；警示条下划线 `useDraw`（deny）；`@enter:pop` `@enter:fade` `@draw` |
| 4-D | p4-17..19 | 实验 4：自制封条卡（「破坏性实验 · 4」）→ p4-17 句尾让位 ·**archify full**：hookresult-tri 章 `flip-zero-tools`+`flip-stop-hijack` · p4-18 句让位 （flip-stop-hijack） · p4-19 回落自制金句卡「空不空 · 共享的契约」衬线定格 caption-dup-ok: 压短记忆点非逐字（components 承担，散文点名）；角标 `0 工具`／`轮次封顶` | 封条卡（components 承担，散文点名）；p4-19 读数角标入场 `useEnter:fade`；同图两章连播（单实例内自动抑制）；`@enter:fade` |
| 4-E | p4-20..25 | 双保险：p4-20 句让位 ·**archify full**：stop-guard 章 `recall-loop`+`cap-100`+`guard-flag`+`guard-cap8`+`stop-clean` · p4-21 句让位 （cap-100） · p4-22 自制回落（「真实产品 · 双保险」过渡小卡）· p4-23 句让位 （guard-flag） · p4-24 句让位 （guard-cap8） · p4-25 句让位 （stop-clean）；角标 `stopHookActive`（中文注）／`官方：连续 8 次硬停` | 同图五章穿插连播（单实例内自动抑制）；过渡小卡 `useEnter:pop`；`@enter:pop` |
| 4-F | p4-26..27 | 规模对账卡（自制）：三格数字并列——教学版 `4` ↔ 拆解口径 `27` ↔ 官方文档今天 `33`（第三格带日期戳角标）；p4-27 节点墙右缘再亮一列（「清单一直在长」）；背景节点墙剪影绵延淡出；角标 `2026-09 官方口径` | 三格数字递进点亮 `useCount`＋`useStagger`；节点墙入场 `useProgress`、压暗淡出 `useDim`；`@count` `@stagger` `@progress` `@dim` |

## P5 一单走全程（p5-01..16）→ `scenes/P5Preflight.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..07 | 全链五工序：p5-01 句让位 ·**archify full**：preflight-chain 章 `full-chain`+`cheap-first`+`semantic-check`+`mid-gate`+`ask-last` · p5-02 句让位 （cheap-first） · p5-03 句让位 （semantic-check） · p5-04 句让位 （mid-gate） · p5-05 句让位 （ask-last） · p5-06 自制回落（「执行」车间门开启单据驶入小卡，`ok` 绿瞬态）· p5-07 回落金句卡「核对 · 自检 · 把关 · 都在签字前」衬线定格 caption-dup-ok: 工序名列举定格（标签组合非整句复述）；角标 `schema→validate→hooks→permission→run` | 同图五章连播（单实例内自动抑制）；车间门开启 `useSpring`；单据驶过门心 ok 放行瞬态 `useImpulse`；金句卡 QuoteCard；`@spring` `@impulse` |
| 5-B | p5-08..13 | 四版对账：p5-08 引题大字「四版对账」＋自制行数尺全景（四格底边复现）→ p5-09 句让位 ·**archify full**：four-version-ledger 章 `v1-base`+`v2-table`+`v3-gates`+`v4-hooks`+`ledger` · p5-10 句让位 （v2-table） · p5-11 句让位 （v3-gates） · p5-12 句让位 （v4-hooks） · p5-13 句让位 （ledger）；角标 `执行行：只换过一次 · 教学版` | 引题大字入场 `useProgress`；行数尺四格同步点亮 `useCount`（随各章推进）；同图五章连播（单实例内自动抑制）；`@progress` `@count` |
| 5-C | p5-14..16 | 方法论卡（自制）：两列对照「骨架：留／规模：砍」＋三组数字对（4↔27／1↔8／3↔一串工序）逐组点亮；金句卡「保骨架 · 砍规模」衬线定格 caption-dup-ok: 口播 p5-14 逐字子串（顿号→间隔号）、六字卡线刻意定格记忆点 | 两列对照 `useStagger`；三组数字对递进 `useCount`；金句卡 QuoteCard；`@stagger` `@count` |

## P6 收束（p6-01..10）→ `scenes/P6Finale.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01..03 | 诊室全景收束：循环圆环恒定 core 橙缓转，三层外设（表／关／节点）依次亮 mech 青定格；行数尺四格全亮；p6-01 句让位 ·**archify full**：five-layer-dependency 章 `layer-flash`（系列五层层板、本集层点亮）；p6-03 三连「管它」排比自制小字条随节奏点亮；角标：Harness（画内呈现） | 三外设依次点亮与常驻微光由 PeripheralRow 内 `useStagger`＋`useBreathe` 承担（components 承担者，散文点名，同 0-D 口径——R9 撤无背书 token）；行数尺四格全亮 `useCount`；排比小字条随句节奏 `useReveal`；p6-01 由 ArchifyRecap 主控；`@count` `@reveal` |
| 6-B | p6-04..08 | 分工定格：医生位与关卡分屏——开单动作（左，无彩）与放行闸（右，`ok` 绿徽章）各亮一次；关卡侧「放行」徽章恒亮、医生侧无徽章；p6-06..08 观看方法论两步卡「先找循环 → 再数挂件」（两步依次点亮）；金句卡「循环稳 · 外设全」衬线定格 caption-dup-ok: 金句卡为压短形态 | 分屏对切 `useStagger`；徽章点亮 `useImpulse`（ok）；两步卡递进 `useProgress`；金句卡 QuoteCard；`@stagger` `@impulse` `@progress` |
| 6-C | p6-09..10 | 系列收束装置：five-layer 层板浮现定格（本集层点亮 · 下期层 mech 预告 · 余三层留白——与 four-dark-zones 留白语义互证）→ 系列身份卡 → 下期预告卡（视觉层含本集主段「一个循环，三层外设」与下期主段「模型的视野是安排出来的」——规则 8 受检硬编码）→ 收尾渐黑窗口；p6-09 句让位 ·**archify full**：five-layer-dependency 章 `four-dark-zones`（四层还没开灯＝后续各层的留白预告；ISSUE-209 修复：L1 视角重派生） | 层板入场 `useStagger`；下期层 mech 预告脉冲 `useImpulse`；身份卡→下期卡交替 `useEnter:fade`；渐黑由 P6 幕级 `useFadeOut` 承担（SceneFade 末幕不淡出，防双重渐黑）；p6-09 由 ArchifyRecap 主控；`@stagger` `@impulse` `@enter:fade` |
