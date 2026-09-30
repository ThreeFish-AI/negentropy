# 分镜：工具与执行：一个循环，三层装置（v2.1 减脂）

> 逐字稿 SSOT：[narration.md](./narration.md)（164 句 v2.1——减脂删 13 句、剩余句保留原号，句 id 即本表定位锚，时序与 [narration.json](./narration.json) 逐句一致）；时长以 audio manifest 实测为准（规划 3,900 字 ≈ 13.9 分 @280 等效口径，硬窗 [13.0, 14.6] 分）。
> 一镜（beat）＝2–8 句连续句共享同一主画面，镜界沿 ⑤ 成文优化已切好的空行 beat；句区间覆盖本幕每一句、无交叠无遗漏（`check_script.py` 强制）；镜号与 `scenes/P*.tsx` 内嵌 `<Sequence name="N-X">` 规范对应。
>
> **本集视觉契约**（[theme.ts](../video/src/design/theme.ts)，与 [planning.md](./planning.md) §三一致）：
> `core` 陶土橙 `#D97757`＝循环内核／传送带——**全系列恒定视觉锚〔M-001〕**：锁死描边色与绝对线宽，全片同形出场只换周边标签 · `coreDeep` `#B45A3C`＝内核细节（验活分屏的内容块清单高亮）· `mech` `#64C4C0`＝挂在循环外的可拆卸装置（本集维度色）· `mechDeep` `#4A8F8B`＝装置深态 · `deny` `#EF6461`＝拒绝／危险唯一语义 · `dim` `#9AA7B8`＝人色（审批／对讲机——人开口才上色）· `ok` `#7ED321`＝放行确认瞬态 · 师傅／用户／数据流一律无彩（`text` 白／`dim` 灰）。
> 恒定空间契约（防〔X-001〕空间逆旁白）：内核恒居画面**左中锚位**（core 橙），装置自**右缘／上缘**挂入（mech 青），「加机制」的动效永不触碰内核图形；金句卡衬线体（`theme.serif`）。
>
> **画面纪律**：画面文字只放关键词／数字／标签（≤6 字），不复述口播（RSI-007，刻意定格处在该行注 `caption-dup-ok:` 豁免）；英文标识符只进角标（`while True`／`tool_use_id`／`PreToolUse` 等）；顶部安全带 y<56 由章节条占用，画面内容 y≥56 起，SceneTag 维持 top:64。
> **archify 资产档位**：全屏独占（`forbid_inset`，无画中画）——播放期自制装置由 ArchifyYield 淡出让位或空窗句回落；章节数据＝录制 SSOT，见 [../video/public/archify/views/](../video/public/archify/views/)，每章时长＝拍数 × max(1100ms, 3200ms/拍数)；cue 纪律：一章锚一句（`at('句id')` + `dur('同句id')` 单参），同锚句双 cue 即 FAIL，跨实例背靠背后挂实例须 `lead={false}`。
> ⚠️ 动效列与一切散文**禁写**画面列那套档位字面标注（覆盖门按全文计数断言，多一处命中即 FAIL）；`@动词` 只用 [motion/hooks.ts](../video/src/motion/hooks.ts) 实存模型，判据＝本镜 `<Sequence>` 内由本幕 scene 自身定义的装置调用了该 `useXxx(`（`components/` 内装置承担者一律散文点名，不产生 token）。

## 图集预算表（12 图＝10 新绘＋2 复用；5 型；65 章；cue 计划 64（stop-veto `master-overruled` 随锚句删除不锚，views 保留），锚定率 64/164≈0.39 ≥ 0.30，密度 ≈4.5/分 ≥ 3.0）

| # | slug（新绘落 `docs/assets/architecture/agent-harness/claude-code--<slug>.html`） | 型 | 服务幕/句段 | 章 |
| --- | --- | --- | --- | --- |
| 1 | loop-anatomy | lifecycle | P1 循环三步（p1-08..12） | 5 |
| 2 | loop-verdict | workflow | P1 判据之争（p1-18..22, p1-25） | 5 |
| 3 | dispatch-map | dataflow | P2 号码簿（p2-04..10） | 5 |
| 4 | registry-contract | dataflow | P2 注册暗契约（p2-11..16） | 5 |
| 5 | tool-batch-layers | workflow | P2 托盘三账（p2-17..24） | 6 |
| 6 | three-gates | state | P3 三道门禁（p3-04..09） | 6 |
| 7 | fence-to-intercom | architecture | P3 拆墙换门＋回执（p3-19..23, p3-25） | 6 |
| 8 | hook-channels | dataflow | P4 插线口信道（p4-07..11, p4-26） | 6 |
| 9 | stop-veto | lifecycle | P4 退出否决（p4-16..17） | 3（锚 2，`master-overruled` 不锚） |
| 10 | checkchain-order | workflow | P5 校验链（p5-03..09） | 6 |
| 11 | execution-panorama（**复用**：主仓既有 `claude-code-tooling--execution-panorama.html`，guided-views 为空——录制前按本集 views 回填章节、focus 对齐既有节点语义） | lifecycle | P0 一闪（p0-06）＋P5 全景对账（p5-12..16） | 6 |
| 12 | five-layer-dependency（**复用**：主仓既有 `claude-code-harness--five-layer-dependency.html`，同上回填） | architecture | P0 立碑一闪（p0-15）＋P6 收束（p6-01..05, p6-17..18） | 6 |

> 型多样性＝lifecycle×3 / workflow×3 / dataflow×3 / state×1 / architecture×2 ＝ 5 型 ≥ 5（sidecar 顶层 `type` 录制时按本表落盘）；复用图与 `html_pattern` 不匹配，已在此显式登记。P0/P6 归 3D 系列装置（HarnessStack）＋上表 11/12 两张收束图。

## P0 人肉循环（p0-01..16）→ `scenes/P0HumanLoop.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A（3D） | p0-01 | HarnessStackP0 3D 五层栈自底向上落板（components/harness-stack.tsx 承担）→ 本集层「工具与执行」点亮呼吸两次 → 其余层压暗待缩退；主问题字卡居中「凭什么敢」（≤6 字形态），「敢」字 `deny` 红点睛；角标 `while True`（预告） | 栈落板/呼吸在 HarnessStackP0 内；「敢」字红点一次性强调由 scene 字卡调用 `useImpulse`；`@impulse` |
| 0-B | p0-02..04 | 无循环世界分屏：左＝师傅剪影（`text` 白，无彩）吐出一条命令即摊手停住；右＝人工回路——用户剪影（`dim` 灰人色）跑命令、贴输出的往复箭头；角标 `cat`、终端往复 | 左右屏自两侧滑入由 scene 分屏壳调用 `useEnter`；人工回路箭头行进虚线 `useFlowDash`（`dim`）；`@enter:slideL` `@enter:slideR` `@flowDash` |
| 0-C | p0-05..07 | 「人肉循环」字卡淡出，`while True` 字卡（mono 角标放大）落下把「人」换下场；循环三拍微缩首现（motifs.LoopRing 环形，`core` 橙恒定描边——M-001 首锚）；p0-06 句让位 archify 全景一瞥 ·**archify full**：execution-panorama 章 `belt-lap` | 字卡下落 `useEnter:fall`；LoopRing 描线/光点在 motifs 内（不产生 token）；p0-06 由 ArchifyRecap 主控（本镜 scene 侧仅字卡动效）；`@enter:fall` |
| 0-D | p0-08..13 | 三债三卡并列：安全债卡（`deny` 红）／能力债卡、扩展债卡（`mech` 青）；循环体膨胀滚屏——日志/约束一行行叠进 while True 框体；危险命令卡闪现（`rm -rf`，`deny`，不口播）；角标 `while True` | 三卡依次入场 `useStagger`；膨胀滚屏逐行流出 `useReveal`；危险卡红闪 `useImpulse`（decay 态包络）；`@stagger` `@reveal` `@impulse` |
| 0-E | p0-14..16 | 悬念立碑：「更聪明的循环」字卡被划线否掉 → 三层装置剪影自右缘挂入（`mech` 青 ×3，不触碰左中 core 内核锚位）；金句卡衬线体定格「三债三挂法 · 循环一行不改」（压短形态） ·**archify full**：five-layer-dependency 章 `layer-preview` caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字 | 划线否掉 `useProgress`（decelerate）；三剪影右缘滑入 `useEnter:slideR` + 常驻辉光 `useBreathe`（`mech`）；金句卡在 cards.QuoteCard 内；p0-15 由 ArchifyRecap 主控；`@progress` `@enter:slideR` `@breathe` |

## P1 循环与验活（p1-01..29）→ `scenes/P1LoopVerify.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A（3D 一现） | p1-01..07 | 工坊剧场首秀：通宵工坊轮廓 draw 生长；师傅剪影（`text` 白无彩）立于传送带旁；3D 传送带转轮一现（components/solids-3d.tsx 承担，planning §3 唯二 3D 点缀之一）→ 收敛定格为 2D 传送带母题（motifs.LoopRing，`core` 橙恒线宽〔M-001〕，全片同形）；「最小配置」字卡＋数字卡「内核 30 余行（循环内核口径）」；金句卡衬线定格「一个工具 · 一个循环 · 一个 Agent」（p1-05）；p1-07 伏笔句小字标「收尾收账」；角标 `Agent`、`Harness` | 工坊轮廓描线 `useDraw`；数字卡滚动 `useCount`；师傅剪影淡入 `useEnter:fade`；3D 转轮与 LoopRing 在 components/motifs 内（不产生 token）；金句卡 QuoteCard；`@draw` `@count` `@enter:fade` |
| 1-B | p1-08..12 | 循环三步逐拍点亮＋对话记录列表逐条追加 ·**archify full**：loop-anatomy 章 `belt-turn`+`append-first`+`hand-check`+`no-tool-exit`+`pair-backfill` · 五句五接力无空窗 · 角标 `messages.append`、`tool_use_id`、`tool_result` 由图内承担 | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担（本镜无动效 hook） |
| 1-C | p1-13..16 | 验活动作分屏：左＝「手里」内容块清单（`coreDeep` 高亮逐条）／右＝「嘴上」停止标记（`dim` 灰置）；题词「看手里 · 不看嘴上」（≤6 字标签，p1-14 记忆点）；判据终态可停驻〔M-003〕——p1-16 句中点抽帧仍可读出该判据；角标 `tool_use` / `stop marker` | 左列逐条点亮 `useStagger`；右侧嘴上栏压暗 `useDim`（to 0.4）；终态停驻＝一次性特效只作入场（不加持续动效）；`@stagger` `@dim` |
| 1-D | p1-18..22 | p1-18 引子：两修订对撞卡左右对开（2D，`dim` 描边）；p1-19 起让位——两修订判据对撞＋官方文档页灰置「不披露实现层」 ·**archify full**：loop-verdict 章 `two-revisions`+`trust-mouth`+`trust-hand`+`official-silent` · 角标 `stop_reason` | 对撞卡对开弹入 `useEnter:pop`（p1-18 空窗句）；p1-19..22 由 ArchifyRecap 主控四章接力；`@enter:pop` |
| 1-E | p1-23..26 | p1-23..24【三】引语卡（mono 等宽引语态，角标「开源项目作者 · 源码分析」归属）；p1-25 让位——流式响应出现工具调用→独立标志位置真 ·**archify full**：loop-verdict 章 `flag-flips`；p1-26 理由句回落衬线小卡「声明 滞于事实」 | 引语逐字流出 `useReveal`（mono）；p1-25 由 ArchifyRecap 主控；回落小卡由 QuoteCard 承担；`@reveal` |
| 1-F | p1-27..28 | 官方产品层对照：三阶段横向流程卡「收集上下文 → 行动 → 验证结果」（`mech` 青段条，官方对照层用装置色）；打断演示——用户手型点击＋退出键撤回正在跑的调用；角标 `gather context / take action / verify results`、`Esc` | 三段卡依次点亮 `useStagger`；打断点击一次性脉冲 `useImpulse`；`@stagger` `@impulse` |
| 1-G | p1-29 | 小护栏三件套快闪：衬纸指令卡／危险模式黑名单卡／截断剪刀卡（三张小卡，`mech` 描边细态）；镜尾过渡——散装补丁三卡缩小让位，传送带流向右下「下一件装置」预告位 | 三卡快闪 `useStagger`；镜尾流向预告 `useFlowDash`（`core`）；`@stagger` `@flowDash` |

## P2 工具号码簿（p2-01..27）→ `scenes/P2ToolRegistry.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..03 | 翻译层痛点：师傅举「读这个文件」字条（中文），手里却要在命令行拼 `cat path/to/file`——逐字敲出、末字拼错闪红；左右对照「想说的 / 只会拼的」；角标 `cat path/to/file` | 命令逐字敲出 `useReveal`（mono）；拼错抖动 `useShake`（decay，`deny`）；`@reveal` `@shake` |
| 2-B | p2-04..09 | 号码簿翻页、四工具上带、簿厚带不动 ·**archify full**：dispatch-map 章 `switch-line`+`name-handler`+`four-new-tools`+`ledger-grows`+`belt-still` · p2-06 空窗句回落：motifs.DispatchTable 查号装置一现（mech 命中行辉光） · 角标 `TOOL_HANDLERS`、`TOOLS` | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担；空窗句回落装置在 motifs 内（不产生 token）（本镜无动效 hook） |
| 2-C | p2-11..16 | 两步注册与暗契约 ·**archify full**：registry-contract 章 `two-step-signup`+`hidden-third-boom`+`unknown-fallback`+`per-tool-try`+`loop-immune` · p2-12 空窗句回落：契约文卡「参数名＝形参名」小卡升起 · 角标 `handler(**block.input)`、`Unknown: {name}`、`try/except` | 空窗句文卡升起 `useEnter:rise`；其余由 ArchifyRecap 主控；`@enter:rise` |
| 2-D | p2-17..24 | 托盘三账对照 ·**archify full**：tool-batch-layers 章 `one-tray`+`teach-serial`+`index-promises`+`official-parallel`+`author-schedule`+`args-decide` · p2-20、p2-22 空窗句回落——p2-20＝「零并发原语」实测对账条、p2-22＝【三】归属引语小卡（dim） · 角标 `PostToolBatch`、`parallel tool calls` | 空窗句对账条压暗入场 `useDim`＋`useEnter:fade`；其余由 ArchifyRecap 主控；`@dim` `@enter:fade` |
| 2-E | p2-25..27 | 围墙装置首现：`mech` 青细框围住文件工具区四台机器，bash 命令行机器在框外（空间契约：围栏从右缘展开、不触碰左中内核）；越界路径箭头撞框报错（`deny` 闪）；镜尾埋雷——框外 bash 机器上浮一颗警示点；角标 `safe_path`、`is_relative_to(WORKDIR)` | 围栏描线合拢 `useDraw`；越界撞框红闪 `useImpulse`；警示点 `useBreathe`（`deny` 低频）；`@draw` `@impulse` `@breathe` |

## P3 三道门禁（p3-01..29）→ `scenes/P3ThreeGates.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..02 | 债到期卡：「安全债 · 到期」卡（`deny` 红脉冲）＋上一版末尾警告引语卡回放（mono 小字）；角标 `bash 不受 safe_path 保护` | 到期脉冲 `useImpulse`；引语小字逐字 `useReveal`；`@impulse` `@reveal` |
| 3-B | p3-03..09 | p3-03 引子：三道门禁装置自右缘推入（2D，门体剪影 `mech`）；p3-04 起让位——三道闸门空间装置与接入点 ·**archify full**：three-gates 章 `welded-gate`+`bash-scope`+`rule-gate`+`intercom-gate`+`order-locked`+`one-line-join` · 六句六接力，三道门次序锁死永不换位——焊死门 deny／规则门 mech／对讲机 dim · 角标 `DENY_LIST`、`PERMISSION_RULES`、`ask_user [y/N]`、`check_permission()` | 门禁装置推入 `useEnter:rise`（p3-03 空窗句）；p3-04..09 由 ArchifyRecap 主控；`@enter:rise` |
| 3-C | p3-11..12 | 危险品名册按词辨认：命令行逐字敲出，命令位上的 `rm`／`del` 词块命中高亮（`deny`）；对照行——变量名 `model`、参数词 `delimiter` 灰置不报；「按词 · 不按串」题词；角标 `DESTRUCTIVE_COMMAND_WORD` | 命令逐字敲出 `useReveal`；命令位命中一次性高亮 `useImpulse`；对照词灰置 `useDim`；`@reveal` `@impulse` `@dim` |
| 3-D | p3-14..16 | 官方对齐卡：官方文档页样＋次序条「拒绝 → 询问 → 放行」三段（`deny`／`dim`／`ok`）首中即决打点；反例卡——`Bash(aws *)` 具体放行想在拒绝上开洞、被划掉；角标 `deny → ask → allow` | 次序条三段依次点亮 `useStagger`；反例划掉抖动 `useShake`（decay）；`@stagger` `@shake` |
| 3-E | p3-17..18 | 闸门倒置假想卡：次序翻转箭头弹转（放行挪到最前），拒绝表上的命令被放走（`deny` 红闪）；回正——金句卡衬线定格「铁门 永在对讲机前」（压短形态） caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字 | 翻转弹转 `useSpring`；放走红闪 `useShake`（decay）；金句卡 QuoteCard 终态〔M-003〕；`@spring` `@shake` |
| 3-F | p3-19..23 | 拆墙双联画 ·**archify full**：fence-to-intercom 章 `quiet-big-day`+`fence-removed`+`downgrade-ask`+`wall-to-intercom`+`net-effect` · 左联「有墙无门」／右联「有门无墙」，拆除以虚线残影呈现 · 角标 `safe_path` 拆除标记 | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担（本镜无动效 hook） |
| 3-G | p3-24..28 | p3-24 引子：回执卡概念（2D 小字）；p3-25 让位——拒绝结果以 `tool_result` 形态回灌对话列表 ·**archify full**：fence-to-intercom 章 `denied-receipt`；p3-26..28 回落——师傅看得见被拒（对话列表滚动）＋分工伏笔句：「门禁 · 工坊执行」（题词，工坊门常驻）；角标 `Permission denied.`（tool_result 形态） | 引子小字淡入 `useEnter:fade`；p3-25 由 ArchifyRecap 主控；回落段对话列表滚入 `useEnter:rise`＋工坊门呼吸 `useBreathe`（`mech`）；`@enter:fade` `@enter:rise` `@breathe` |
| 3-H | p3-29 | 产品面速览（一句带过不展开）：两张小卡——默认免批面／模式多档（`Shift+Tab`）；角标 `Shift+Tab` | 两卡快闪 `useStagger`；`@stagger` |

## P4 插线口（p4-01..29）→ `scenes/P4HookSockets.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..02 | 循环体膨胀滚屏复现（P0 呼应）：日志／自动留档一行行叠进 while True 框体 → 整框毛玻璃模糊「认不出来了」（`dim`）；角标 `git add` 类横切行为示意（不口播） | 滚屏逐行 `useReveal`；模糊度推进 `useProgress`；`@reveal` `@progress` |
| 4-B | p4-03..06 | 插线口母题：传送带（`core` 橙锁芯恒静〔M-001〕）边沿展开一排插口（motifs.SlotRing 四角插槽）；LottieEmphasis plug-pulse 装置插入脉冲（components/LottieEmphasis.tsx＋`lottie/plug-pulse.json`，`mech` 青——planning §3 唯二 3D/Lottie 点缀之二）；金句卡衬线定格「挂在循环上 · 不写进循环里」（p4-04）；角标 `HOOKS`、`register_hook()` / `trigger_hooks()` | 插头卡弹入 `useEnter:pop`；插口描线展开 `useDraw`；plug-pulse 在 LottieEmphasis 内（不产生 token）；金句卡 QuoteCard；`@enter:pop` `@draw` |
| 4-C | p4-07..08 | 四事件口与两函数 ·**archify full**：hook-channels 章 `four-event-sockets`+`two-functions` · 四事件名由图内承担：用户递话／执行前／执行后／收工 · 角标 `UserPromptSubmit / PreToolUse / PostToolUse / Stop` | archify 全屏回放主控：章内拍脉冲＋换章弹入由 ArchifyRecap 承担（本镜无动效 hook） |
| 4-D | p4-09..11 | 返回值唯一信道 ·**archify full**：hook-channels 章 `return-channel`+`none-vs-object`+`brake-gas` · 刹车／油门手柄图形——执行前握刹车 deny、收工握油门 core · 角标 `return None` / `return 非 None` | archify 全屏回放主控（本镜无动效 hook） |
| 4-E | p4-12..15 | 权限「降级为第一个插头」仪式动效：门禁模块从左中内核旁摘下（`core` 残影原地淡出）→ 沿弧线滑移 → 插进执行前带边首口（`mech` 青描边首口，插入瞬间 plug-pulse 呼应）；「特权 → 第一个插件」题词；末句——循环内单行代码翻牌：点名门禁 → 统一触发；角标 `PreToolUse [0]`、`check_permission → permission_hook` | 模块滑移 `useSpring`（局部帧）；插入脉冲 `useImpulse`；残影淡出 `useProgress`；翻牌由 motifs.Terminal 承担；`@spring` `@impulse` `@progress` |
| 4-F | p4-16..17 | 退出否决回环 ·**archify full**：stop-veto 章 `stop-not-solo`+`message-yank` · 退出拽回回环箭头（core 橙回环） · 角标 `Stop` 返回非空 → 注入 user 消息 → `continue` | archify 全屏回放主控（本镜无动效 hook） |
| 4-G | p4-19..23 | 三瑕疵卡（限定「教学版」徽标置顶）：三张账目卡逐条打勾——串行短路／执行后返回值丢弃／文档口径落差；底部不外推提示条「教学版的账」（`dim`，与产品区压暗分隔）；角标串行短路／返回值丢弃／注入落差 | 三卡逐条打勾 `useStagger`；产品区压暗 `useDim`；`@stagger` `@dim` |
| 4-H | p4-25..29 | p4-25 引子：官方双向对照卡对开（左＝教学版／右＝产品，箭头对张）；p4-26 让位——产品并行运行图 ·**archify full**：hook-channels 章 `parallel-merge` · p4-27..29 回落对照卡——执行后真实语义（能反馈/能改写）、副作用不可撤销警示条（deny）、退出护栏数字卡「连续拽回 8 次 → 强制收工」 · 角标 `All matching hooks run in parallel`、`deny > defer > ask > allow`、`stop_hook_active` | 对照卡对开 `useEnter:slideL`＋`useEnter:slideR`；数字卡滚动 `useCount`；p4-26 由 ArchifyRecap 主控；`@enter:slideL` `@enter:slideR` `@count` |

## P5 上件前扫码（p5-01..21）→ `scenes/P5CheckChain.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..02 | 镜头拉远：工坊全景母图缩略（前面各幕装置小图标各归其位），活件（一次工具调用）滑向扫码口队列；题词「一次调用的旅程」 | 拉远匀速缩放 `useProgress`（decelerate）；活件滑行在 scene 装置内以 `useEnter:slideR` 呈现；`@progress` `@enter:slideR` |
| 5-B | p5-03..05 | 三道扫码口逐道点亮 ·**archify full**：checkchain-order 章 `scan-form`+`scan-claim`+`scan-permit` · 第三道内部分两拍：前置钩子先过、权限判定后审 · 角标 `PreToolUse → permission prompt`（顺序官方锚） | archify 全屏回放主控（本镜无动效 hook） |
| 5-C | p5-06..09 | 全绿通电与红灯拦截 ·**archify full**：checkchain-order 章 `green-relay`+`red-halt`+`order-stable`（p5-08 空窗句回落：「接入点会换 · 次序不乱」小卡弹入）；扫码口红 `deny`／人闸 `dim`／通电 `ok` | 空窗句小卡弹入 `useEnter:pop`；其余由 ArchifyRecap 主控；`@enter:pop` |
| 5-D | p5-10..11 | 成本排序条：横向刻度轴——机器快扫段（毫秒级刻度，`mech`）vs 人应答段（分钟级刻度，`dim` 人色，刻度跨距夸张对比）；「越便宜越靠前 · 人的时间最后」题词 | 刻度条两段展开 `useStagger`；毫秒刻度滚动 `useCount`；`@stagger` `@count` |
| 5-E | p5-12..16 | 全景对账 ·**archify full**：execution-panorama 章 `recount`+`debt-ledger`+`device-per-chapter`+`skeleton-verbatim`+`vow-cashed`（五句五接力；三债各归其位逐一打钩、循环骨架四章叠影逐字同头、立碑兑现终态） | archify 全屏回放主控（本镜无动效 hook） |
| 5-F | p5-17..21 | 官方安全不变量三连卡（官方文档页样）：「钩子绕不过拒绝询问／阻断压过放行／沉默≠批准」逐条点亮；金句衬线定格「只能收紧 · 不能放松」（压短形态，p5-21）＋对句小字「能加锁 · 不能配钥匙」（画面代言，口播已删）；角标 `Hook decisions don't bypass permission rules`、`exit 2`、`staying silent doesn't approve it` caption-dup-ok: 金句定格记忆点，主字已压短非逐字 | 三连卡逐条点亮 `useStagger`；金句终态停驻〔M-003〕；`@stagger` |

## P6 收束（p6-01..21）→ `scenes/P6OneLoop.tsx`

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A（3D） | p6-01..06 | 回答主线：HarnessStackP6 3D 栈重新放大居中（components/harness-stack.tsx 承担）＋五层还债链收束 ·**archify full**：five-layer-dependency 章 `debt-chain`+`one-loop`+`grown-where`（p6-02、p6-03、p6-06 空窗回落：p6-02＝3D 栈回答句、p6-06＝循环代码页翻页装置「几乎不用重印」）；金句卡衬线定格「机制很多 · 循环一个」（p6-04） caption-dup-ok: 金句定格记忆点，主字已压短非逐字 | 3D 放大与层板点亮在 HarnessStackP6 内；三章由 ArchifyRecap 主控；代码页翻页 `useProgress`；金句卡 QuoteCard；`@progress` |
| 6-B | p6-07..12 | 分工双人卡：左＝师傅剪影（`text` 白，题词「决定 · 调什么」）／右＝门禁描边（`mech`，题词「放行 · 放不放」），中缝一道分界线；官方 Note 引语卡（mono 引语态）；金句卡衬线定格「决定权 ≠ 放行权」（p6-08 费曼遗产句，压短形态）；p6-10 开头伏笔句回放小字；角标 `Permission rules are enforced by Claude Code, not by the model` | 双人卡对开 `useStagger`；引语逐字 `useReveal`；金句卡 QuoteCard 终态；`@stagger` `@reveal` |
| 6-C | p6-13..16 | 开放问题对照卡：左「第一个插头 · 结构美感」（教学版，`mech`）vs 右「独立成层 · 安全底线」（产品，`mechDeep`），中间天平悬停不落——留白不裁决；末句「各对规模负责 · 不站队」题词 | 对照卡对开 `useEnter:slideL`＋`useEnter:slideR`；天平悬停呼吸 `useBreathe`（`dim`，刻意不停驻单侧）；`@enter:slideL` `@enter:slideR` `@breathe` |
| 6-D（3D） | p6-17..21 | 收尾装置串：p6-17..18 让位——读图法与未开灯四区 ·**archify full**：five-layer-dependency 章 `read-map`+`four-dark-zones`；p6-19..21 回落 3D——工坊地图四区暗态、系列身份卡（chip 档，标题主段受检硬编码，数据对账 series-layers.json ↔ series.json）＋下期卡（next 走 series-layers.json，规则 8 对账）＋工坊灯牌收暗渐黑 | 身份卡/下期卡浮现 `useStagger`；灯牌收暗全镜 `useFadeOut`（末 36 帧，窗取整镜时长）；两章由 ArchifyRecap 主控（跨实例背靠背，后段 `lead={false}`）；`@stagger` `@fadeOut` |

## 字幕规范

- 底部单行、一句一条（164 句＝164 条），与 `NarrationAudio` manifest 逐句同步；字号与安全带沿系列 frozen `Subtitle.tsx`，不另设。
- zh 字幕恒单行不折行；超宽句由 Subtitle 内部缩放兜底（81 字散文句教训见 QA 记录）。
- 英文标识符只在画面角标出现，字幕跟随口播文本（`Agent` 锚句带 CMU 发音标注仅影响 TTS take，不影响字幕形态）。

## 实现映射

| 幕 | 组件 | 装置重心 |
| --- | --- | --- |
| P0 人肉循环 | `scenes/P0HumanLoop.tsx` | HarnessStackP0（3D）、分屏、三债卡、悬念立碑＋金句卡 |
| P1 循环与验活 | `scenes/P1LoopVerify.tsx` | 3D 转轮一现→LoopRing 母题（M-001）、验活分屏、判据对撞、引语卡 |
| P2 工具号码簿 | `scenes/P2ToolRegistry.tsx` | DispatchTable、围墙装置、实测对账条 |
| P3 三道门禁 | `scenes/P3ThreeGates.tsx` | GateRouter 母题、危险品名册、官方次序条、倒置假想卡、回执卡 |
| P4 插线口 | `scenes/P4HookSockets.tsx` | SlotRing＋LottieEmphasis plug-pulse、权限搬家仪式、三瑕疵卡、对照卡 |
| P5 上件前扫码 | `scenes/P5CheckChain.tsx` | 成本排序条、安全不变量三连卡、全景对账 |
| P6 收束 | `scenes/P6OneLoop.tsx` | HarnessStackP6（3D）、分工双人卡、开放天平、系列身份卡/下期卡 |

公共组件清单：`Subtitle`（frozen）· `ChapterProgress`（顶部章节条，y<56）· `SceneTag`（top:64）· `QuoteCard`／`FadeUp`／`Pill`（cards.tsx，金句卡衬线体）· `Panel`／`Terminal`／`CodeCard`／`NumberedCard`／`Counter`／`Footnote`（motifs.tsx）· 母题四件：`LoopRing`（传送带，M-001 恒定）／`DispatchTable`（号码簿）／`GateRouter`（三闸门）／`SlotRing`（插线口）· `HarnessStackP0`／`HarnessStackP6`／`HarnessBadge`（harness-stack.tsx，P1–P6 常驻顶边条 chip 档）· `Stage3D`／`Slab3D`／`Rim3D`（solids-3d.tsx，P1 转轮一现）· `LottieEmphasis`（plug-pulse——**本集 headless ANGLE 实渲已通过并成片 v1**，重渲边界与退役判据见 issue.md ISSUE-202）· `ArchifyRecap`（archify cue 载体，frozen 共享——Stage ⑧ 接入；一章锚一句，跨实例背靠背后挂实例 `lead={false}`）。

## 自检对账（Stage ⑥ 收口）

- 句覆盖：0-A p0-01 → 6-D p6-21，幕内镜区间首尾相接、跨幕无缝——43 镜 164/164 全覆盖无重叠、镜号唯一（v2.1 减脂：10 镜缩区间、0 镜删除；1-G／3-H 缩为单句镜）。
- 图集：12 图（10 新绘＋2 复用显式登记）· 5 型（lifecycle/workflow/dataflow/state/architecture）· 每图 3–6 章 · 65 章／64 cue 计划（stop-veto `master-overruled` 随锚句删除不锚）。
- 锚定：64/164 ≈ 0.39 ≥ 0.30；分幕最少 P0 2/16，全部 ≥1 锚；最长连续无锚 run＝11（p6-06..16）≤ 12，次长 9（p3-26..p4-06）。
- 单调性：各图章按锚句顺序正向播放，无逆序（loop-verdict flag-flips 尾章锚 p1-25 归位序内；fence-to-intercom denied-receipt 尾章锚 p3-25 序内；hook-channels parallel-merge 尾章锚 p4-26 序内）。
- `@动词` 全部为 motion/hooks.ts 实存模型：impulse／flowDash／enter:slideL／enter:slideR／enter:fall／stagger／reveal／progress／breathe／draw／count／enter:fade／dim／enter:pop／enter:rise／spring／shake／fadeOut。
