# 分镜：《让判断变便宜：Jev 决策模型拆解》v1

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`slot` 琥珀金（格口 / 闭合输出空间 / 构造保证）· `pass` 青绿（一次编码 / 速度 / 批量问）· `calib` 兰紫（概率 / 校准 / 对账）· `route` 矢车菊蓝（分流 / 编排 / 阈值）· `danger` 警示红（投错 / 越界 / 破坏实验 / 嘴硬）· `ok` 确认绿（命中 / 校验通过 / 防线）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 保持规范对应**；动效列 `@动词` 对应 motion 模型（hooks.ts）。
> `@动词` 的判据：当且仅当本镜 `<Sequence>` 内、由本幕 `scenes/P*.tsx` 自身定义的装置调用了该 `useXxx(`。`components/` 内 hook（ArchifyClip 画框弹入 / ArchifyYield 让位 / devices.tsx 装置）与 window.ts 纯函数 `progress()` 不产生 token，但必须在散文里点名承担者。
> ⚠️ 动效列禁照搬画面列那套标注字面：覆盖门的解析数只取画面列。判定基线 FAIL 0 + WARN 0。
> ⚠️ 非 beat 用途禁写 `w('句id')` 字面形态：scene 里用与 `at` 对称的 `dur('句id')` 取长。
> 章节清单见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长 = 拍数 × max(1100ms, 3200ms/拍数)。
> archify 图集 13 张（2 张 200 精读原图 + 11 张本集新绘），`jev--` 前缀走约定；新图 .mmd 源落 `docs/assets/mermaid/agent-infra/`（溯源锚点用 § 章号 + 机制/实验键，2026-09-22 起不记行号）。

## P0 判断之贵（p0-01..30）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A | p0-01..03 | **小判断清单**：任务流水线上密密麻麻闪烁的判断节点（工单归组/动作放行/输出及格/候选排序） | 判断节点由 devices.tsx JudgeNodes useStagger 逐个亮起；`@stagger` |
| 0-B | p0-04..06 | **让作家盖章**：左侧大模型=伏案写大部头的作家，右侧一枚小章；作家放下笔写一段议论文再盖章 | 议论纸张由本幕 EssayStack useStagger 堆高；印章 useImpulse；`@stagger` `@impulse` |
| 0-C | p0-07..10 | **慢与贵**：沙漏翻转（三百多秒）+ 账单计数疯涨；角标「3–329s」「$0.20–10/MTok — 官方对照」 ·**archify full**：sorting-center 章 `sc-four-sins`（p0-07） | 账单数字由 devices.tsx TickerBar useCount 滚数；沙漏静态翻转帧；`@count` |
| 0-D | p0-11..13 | **口头概率不可信**：「九成把握」徽章亮起又碎裂（danger），碎片里露出「训练讨好」标签 | 徽章碎裂由本幕 BadgeCrack 用 useImpulse；`@impulse` |
| 0-E | p0-14..17 | **错配**：左列「答案只有几个选项」的短清单（slot 高亮）；右列「自由文字」长卷轴无限下拉 ·**archify full**：sorting-center 章 `sc-mismatch`（p0-15） | 左清单 items useStagger；右卷轴 devices.tsx ScrollDrain 用 useProgress 持续滚动；`@stagger` `@progress` |
| 0-F | p0-18..23 | **Jev 登场**：名片卡（产品名 / 系统一模型 / 卡尼曼快系统注记）→「一次前向、逐项打分」公式条 ·**archify full**：sorting-center 章 `sc-one-liner`（p0-21） | 名片卡 useSpring 升起；打分条由本幕 ScoreSweep 用 useProgress 逐项点亮；`@spring` `@progress` |
| 0-G | p0-24..30 | **分拣中心总览**：调度员台 / 老分拣员位 / 面单堆 / 小票排 / 格口墙 / 三条去向传送带全部亮灯 ·**archify full**：sorting-center 章 `sc-tour`（p0-26）；章节条七段亮起 | 总览灯光 useStagger 分区点亮；`@stagger` |

## P1 挂牌格口（p1-01..28）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A | p1-01..03 | **接口解剖**：请求卡 = 状态底单 + 几张问题；问题 key 标注「不发给模型」 ·**archify full**：question-contracts 章 `qc-anatomy`（p1-02） | 请求卡展开由本幕 RequestUnfold 用 useSpring；`@spring` |
| 1-B | p1-04..06 | **三题型**：是非小票（0–1）/ 选择小票（≤255 选项全打分）/ 打分小票（2–10 级、可落级间）三张样板 ·**archify full**：question-contracts 章 `qc-three-types`（p1-05） | 三张小票 useStagger 依次翻面；级间刻度 useDraw；`@stagger` `@draw` |
| 1-C | p1-07..08 | **答案空间先定**：选项表被调用方写死盖章（ok），模型输出通道上「另写答案」闸门焊死 ·**archify full**：question-contracts 章 `qc-closed`（p1-07） | 焊死闸门 useImpulse 落闩；`@impulse` |
| 1-D | p1-09..13 | **零幻觉的真相**：上卡「零类型错误 = 构造保证（官方文档原话）」下卡「准确率 67.8% = 官方自报」；格口墙背景 ·**archify full**：slot-wall 章 `sw-legal-vs-correct`（p1-12） | 双卡由本幕 TruthPair 用 useProgress 对开亮；`@progress` |
| 1-E | p1-14..19 | **冷数据**：67.8% 计数环；16% 零概率条（danger）；13% 翻转双箭头（选项序倒转） | 计数环 devices.tsx StatRing useCount；翻转箭头 useDraw；`@count` `@draw` |
| 1-F | p1-20..23 | **陷阱面单**：面单特写「这不是退款和账单的问题，是登录页坏了」→「退款」关键词高亮 → 满格把握投进账务格口，格口闪红 ·**archify full**：slot-wall 章 `sw-trap`（p1-22） | 关键词高亮 useImpulse；投递轨迹由本幕 WrongDrop 用 useSpring 拖入错格；`@impulse` `@spring` |
| 1-G | p1-24..28 | **B2 拆闭合**：拆解台三栏卡（改了什么/怎么坏/教训）+ 终端走廊滚原型日志（'Billing team' 越界行红显） ·**archify full**：closed-vs-open 章 `co-open-path`（p1-25）+ `co-verdict`（p1-27） | 终端行 devices.tsx TerminalFeed useStagger 滚入；越界行 useImpulse 红闪；`@stagger` `@impulse` |

## P2 一眼多票（p2-01..27）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..04 | **闭源交代**：三枚归属徽章——「逆向研究者（上万次探针）」「开源复刻 ×2」「画像 = 最可信假设」 | 徽章 useStagger 亮起并保持；`@stagger` |
| 2-B | p2-05..07 | **画像三件套**：底单只编码一次 → 每问独立分支 → 选项对决策位读出 ·**archify full**：one-pass-decision 章 `op-encode`（p2-05）+ `op-branch`（p2-06）+ `op-readout`（p2-07） | 本幕主导让位给图回放；句推进由 ArchifyYield 承担；（本镜无动效 hook，回放外无装置） |
| 2-C | p2-08..11 | **平坦性与计费口径**：延迟曲线（1 问 86.5ms → 100 问近平坦 → 1500 问 610ms）；旁挂「输出量=记账口径」账签 | 曲线 useDraw；数据点 devices.tsx FlatCurve 标注 useImpulse；`@draw` `@impulse` |
| 2-D | p2-12..13 | **隔离探针**：两条时序对照 ·**archify full**：isolation-probe 章 `ip-sibling`（p2-12）+ `ip-state`（p2-13） | 让位回放；0.00 与 0.9+ 读数卡由 ArchifyYield 衬底；`@progress`（衬底读数条由本幕 ProbeMeter 承担） |
| 2-E | p2-14..16 | **合调红利**：两根账柱 2078 vs 26078（12.5×）；官方自报 12.2× 角标 | 账柱 devices.tsx LedgerBars useCount 生长；`@count` |
| 2-F | p2-17..21 | **跨问题无不变量**：两道是非小票背对背（互不相看），概率条 0.72 + 0.47 = 1.19 溢出刻度（danger） ·**archify full**：no-cross-invariant 章 `ni-two-noul`（p2-20） | 概率条由本幕 OverSumBar 用 useProgress 累加溢出；`@progress` |
| 2-G | p2-22..27 | **B6 双执行与编排解**：退款/拒退两盏灯同时亮红；解法面板「合并成 Choice（和=1）/ 代码兜底」 ·**archify full**：no-cross-invariant 章 `ni-choice`（p2-25）+ `ni-recipe`（p2-26） | 双灯 useImpulse 齐亮；解法面板 useStagger；`@impulse` `@stagger` |

## P3 把握对账（p3-01..28）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..03 | **校准训练目标**：「说八成，就该十次对八次」对齐卡；角标 RLCD（配方未公开） | 对齐刻度 useDraw；`@draw` |
| 3-B | p3-04..08 | **把握读数公式**：概率分布条 → 公式卡「(最高概率 − 瞎猜线) ÷ 归一化」→ 文档示例 0.81 复算 ·**archify full**：confidence-readout 章 `cr-formula`（p3-06）+ `cr-no-new-info`（p3-08） | 复算行 devices.tsx TerminalFeed 滚入；公式高亮 useProgress；`@progress` `@stagger` |
| 3-C | p3-09..14 | **校准台阶**：三级台阶 0.03 → 0.107 → 0.246 逐级跌落（calib→danger 渐变）；旁挂「承认不知道：大模型九成以上 vs 它一半」对比条 ·**archify full**：calibration-ladder 章 `cl-ladder`（p3-12） | 台阶由本幕 EceSteps 逐句逐级落下（三级各锚 p3-10/11/12，纯函数 progress 派生）、当前句那级提亮加粗，标题 useProgress 提亮；对比条 useCount；`@progress` `@count` |
| 3-D | p3-15..18 | **对账与温度**：对账账本两栏（自称/实际）+「统一打折」印章盖下；旁注「排序不动 · 准确率不动」 ·**archify full**：calibration-ladder 章 `cl-ledger`（p3-16）+ `cl-temperature`（p3-18） | 打折印章 useImpulse；账本行 useStagger；`@impulse` `@stagger` |
| 3-E | p3-19..22 | **S8 原型对照**：未校准面板（直投 68% / 自称 0.7% / 实际 12% 火苗图标）→ 校准后面板（直投 19.7%） | 双面板切换由本幕 FireLedger 用 useProgress 交叉亮；火苗 useImpulse；`@progress` `@impulse` |
| 3-F | p3-23..25 | **B3 账单**：成本柱 10.8 → 4.6（绿降）+ 准确率线 0.972 → 0.91（红降）同框；金句压条「拆看得见的成本，烧看不见的质量」 | 成本柱 useCount；准确率线 useDraw；金句条 useSpring 压入；`@count` `@draw` `@spring` |
| 3-G | p3-26..28 | **分布外两难**：双门——「嘴硬」门（照投）与「闭嘴」门（全升级），中间「免费中庸」通道标 ⌀ 划掉 | 双门由本幕 TwoDoors 用 useProgress 对开；划掉 useDraw；`@progress` `@draw` |

## P4 三条去向（p4-01..25）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..05 | **三条去向**：三岔传送带——把握高直投格口 / 不足送调度员复核 / 再低滑人工异常台；闸门标 0.95 / 0.6 ·**archify full**：fast-slow-harness 章 `fs-three-lanes`（p4-03）+ gate-thresholds 章 `gt-gates`（p4-02） | 传送带流向由 devices.tsx ConveyorFlow useProgress 分流；闸门 useImpulse 落杆；`@progress` `@impulse` |
| 4-B | p4-06..11 | **官方编法与成绩单**：决策拆成「代码规则 + 窄问题」；成绩单卡 67.8% / 万分之四美元 / 0.4 秒（角标「官方自报」）；「思维链全包」对照组跌落条（54%→18%） ·**archify full**：fast-slow-harness 章 `fs-rules`（p4-06） | 跌落条由本幕 PromptDrop 用 useProgress 下滑；成绩卡 useCount；`@progress` `@count` |
| 4-C | p4-12..15 | **《我的世界》速通**：时间轴——每 15 秒一次高层规划星标 + 连续候选挑拣点；计数器 131 + 35 | 星标与挑拣点 useStagger 沿时间轴铺开；计数器 useCount；`@stagger` `@count` |
| 4-D | p4-16..18 | **评审实验**：评审席（五份固定输出 × 100 遍）对照一位人工评审；一致率 100% 环 + 三限定角标（样本极小/单一评审/联合发布） ·**archify full**：fast-slow-harness 章 `fs-judge`（p4-16） | 一致率环 useCount；三限定标签 useStagger 贴角；`@count` `@stagger` |
| 4-E | p4-19..21 | **有把握的大多数**：桶状分布图——够自信直投的两成（route）与复核+人工的八成（灰）；金句「省多少不取决于单价」 ·**archify full**：gate-thresholds 章 `gt-budget`（p4-20） | 分布桶由本幕 ConfidenceMass 用 useProgress 填充；`@progress` |
| 4-F | p4-22..25 | **杰文斯效应**：煤炉效率曲线上升 → 煤耗总量同步上升；叠化到「判断密度」网格逐格点亮 ·**archify full**：fast-slow-harness 章 `fs-jevons`（p4-24） | 双曲线 useDraw；叠化由本幕 JevonsFuse 用 useProgress 交叉；网格 useStagger 点亮；`@draw` `@progress` `@stagger` |

## P5 三方争议（p5-01..21）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..08 | **分类器之争**：左「专用分类器（固定任务又快又准）」右「零样本通才」；比分翻面动画（0.766 vs 0.727 → 反向）；选址谱滑标（任务稳定度 × 调用量 × 标注成本） | 比分卡由本幕 FlipScore 用 useProgress 翻面；滑标 useImpulse 推到位；`@progress` `@impulse` |
| 5-B | p5-09..14 | **自报基准**：考核卷构成（自出题 + 两个大模型平均答案 + 对手按自家流程答题） ·**archify full**：benchmark-audit 章 `ba-scales`（p5-10）+ `ba-pipeline`（p5-13）；倍数天平：左盘 193.6×/444.6×，右盘 75×/171× 与 1.2× | 天平倾转由本幕 ScaleTip 用 useSpring；右盘砝码 useStagger 落盘；`@spring` `@stagger` |
| 5-C | p5-15..21 | **校准外推**：外文面单特写——老分拣员自信盖章，对账账本对不上（danger）；对冲清单三卡（自家数据重新对账 / 保守阈值 / 升级通道）；直投归零的账单 | 盖章 useImpulse；账本裂线 useDraw；对冲卡 useStagger；`@impulse` `@draw` `@stagger` |

## P6 各归其位（p6-01..21）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01..03 | **分工线**：左半调度员伏案写专著（生成），右半老分拣员流水线盖章（判断），中间一道清晰接口线 ·**archify full**：decision-vs-generation 章 `dg-split`（p6-03） | 接口线 useDraw 划开；两侧灯 useStagger；`@draw` `@stagger` |
| 6-B | p6-04..10 | **四拿四缺**：左列四卡（闭合空间/只读一次/能对账/三向分流，各配机制色）右列四卡（架构零公开/构造保证≠答对率/倍数口径/中文未数据，灰 + danger 角标） ·**archify full**：decision-vs-generation 章 `dg-checklist`（p6-08） | 双列卡 useStagger 对位亮；右列印章 useImpulse；`@stagger` `@impulse` |
| 6-C | p6-11..15 | **用法四条**：清单卡逐条钉上（答案空间自己写死 / 互斥合并或代码兜底 / 阈值跟风险走留人通道 / 上线先对账） | 清单卡由本幕 UseRules 逐句钉入（四条各锚 p6-12..15，纯函数 progress 派生）、当前句那条描边提亮，标题 useProgress 淡入；`@progress` |
| 6-D | p6-16..21 | **收尾**：杰文斯回环一行字 → 金句卡「当每一次判断都便宜到随手来一次——你会拿它去量什么？」→ 信源卡（TypeSafe 官方站点 · adapter/kev/laya 固定提交 · 三组第三方实测 · 本仓精读 200）→ 渐黑 ·**archify full**：decision-vs-generation 章 `dg-open`（p6-19） | 金句卡 useSpring 升起；渐黑由本幕 EndFade 从末 beat 时长推导（useFadeOut）；`@spring`（渐黑为渲染层函数） |
