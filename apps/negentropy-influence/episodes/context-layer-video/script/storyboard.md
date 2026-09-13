# 分镜：《自己动手，给 AI 搭一个上下文层》v2

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`blueprint` 工程蓝（架构/五层）·
> `grown` 苔绿（生命周期/自纠）· `activate` 暖橙（resolve/MCP 插头）· `danger` 警示红（冲突/越权/错数）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 逐字一致**（抽帧 QA 对照用）。
> 动效列 `@动词` 对应 motion 模型（hooks.ts），`--check-motion` 机检。
> v2 新增母题：**archify 回放窗**（components/ArchifyClip：OffthreadVideo + 暗框 + 角标）与
> **代码走廊**（CodeCard 逐段高亮 + 终端卡滚真实 selftest / JSON-RPC 报文）。

## P0 你的 AI 也在裸奔吗（p0-01..10）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A | p0-01..05 | AI 助手 + 三张对话卡（周报✓/查数?/错✗）；「入职第一天」日历碎裂 | 三卡 stagger；日历碎裂 impulse 粒子四散；问号 breathe ；`@stagger` `@impulse` `@breathe` |
| 0-B | p0-06..10 | 大楼远景拉近又拉回 → 蓝图纸展开 + 片名（右下小终端角标「每块积木都配代码 ✔」预告实景） | 大楼 pushIn 双向；蓝图纸 spring 四角展开；片名 draw 描线；终端角标 impulse ；`@pushIn` `@spring` `@draw` `@impulse` |

## P1 五块积木（p1-01..22）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A | p1-01..05 | 两问开场 → 积木① 对象（抽屉柜卡） | 问号 rise；积木 spring 落位 ；`@enter:rise` `@spring` |
| 1-B | p1-06..10 | 积木② 目录：账本页指针行指回源对象 +「复制一份」红叉 + 四类信号小标签 | 指针箭头 draw 逐条；叉路 shake 划红；四标签 stagger 贴边 ；`@draw` `@shake` `@stagger` |
| 1-C | p1-11..18 | 积木③④⑤ 落位拼成机器轮廓 + 正交演示（音响三层换一层，其余纹丝不动） | 三积木 stagger；机身轮廓 draw 点亮；音箱层 travel 抽出 + 「不动」徽章 impulse ；`@stagger` `@draw` `@travel` |
| 1-D | p1-19..22 | **archify 回放窗 ①**（blueprint-architecture.webm，故事段 ~14s）：对象层→目录→富化双轨→治理→激活逐段点亮；角标「archify 工程图 · context-layer-blueprint」 | 回放窗 spring 落位（全屏 88% 宽）；视频播放（OffthreadVideo 裁片头）；末句 dim 收束 ；`@spring` `@dim` |

## P2 万物皆对象（p2-01..27）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A | p2-01..06 | 维基条目卡：字段槽点亮，三个关键槽（synonyms/instructions/verified）描金框 | 条目卡 rise；字段槽 stagger；金框 draw + impulse ；`@enter:rise` `@stagger` `@draw` |
| 2-B | p2-07..10 | 同义词隐形：三提问气泡飞向检索窗玻璃，「进账」撞玻璃弹回裂纹 | 气泡 travel；命中线 draw；撞玻璃 spring 反向 + shake 裂纹 ；`@travel` `@draw` `@shake` |
| 2-C | p2-11..13 | **代码走廊 ①**：CodeCard 展示 `Metric("revenue", "sum", "orders", "total", synonyms=("sales", "毛收入", "营收"))` 同义词参数段高亮；角标「本仓 lab」 | 代码逐行显；synonyms 段按句高亮（`grown`）+ impulse ；`@progress` `@impulse` |
| 2-D | p2-14..17 | 说明书分屏：定义卡内嵌注意事项随版本翻新 vs 散落提示词蒙灰 | 版本 flip；说明行 draw 重描；贴纸 dim ；`@draw` `@dim` |
| 2-E | p2-18..21 | 签名问答卡：钢笔划线 + AI 命中念答案 | 签名 draw；命中 impulse + 角标 spring ；`@draw` `@spring` |
| 2-F | p2-22..24 | **archify 回放窗 ②**（object-lifecycle.webm，故事段 ~11s）：draft→governed→conflict 岔道裁决→superseded/rejected 状态机走完；角标「archify 工程图 · object-lifecycle」 | 回放窗 spring 落位；视频播放；dim 收束 ；`@spring` `@dim` |
| 2-G | p2-25..27 | **代码走廊 ②**：终端卡滚出 D6 报错原文 `✗ relationship bad: … not PRIMARY KEY/UNIQUE` + 金句「谁说了算，从人情变流程」 | 报错行打字机 + 红光 impulse；金句 serif 淡入压轴 ；`@progress` `@impulse` |

## P3 养上下文：双轨与冲突（p3-01..34）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A | p3-01..04 | 写不动：金漆只刷墙一角（<5% 角标）+ 新表涌入 | 金漆 progress 慢刷；新表 flowDash；百分比 count 爬停 ；`@progress` `@flowDash` `@count` |
| 3-B | p3-05..10 | 双轨汇流：人写金标准（满格权威条）+ 机器草稿人审 + 痕迹挖掘（半格），汇入目录 | 双轨 draw 并行；权威条双速 count；汇流点 impulse ；`@draw` `@count` `@impulse` |
| 3-C | p3-11..17 | 纠错环考卷：错答红叉 → **代码走廊 ③**：CodeCard 两行（`e.synonyms = tuple(sorted(e.synonyms + (g["question"],)))` / `e.popularity = 120` 语义化「补词/降热度」高亮）+ 终端卡滚出 C4 原文 → 重排绿勾 | 笔迹 draw；红叉 impulse；代码两行 stagger 高亮（`grown`）；终端行上滚；绿勾 snap ；`@draw` `@impulse` `@stagger` `@spring` |
| 3-D | p3-18..27 | 冲突：对峙卡 → D4 反事实（错卡登座 danger 红光、对卡坠落）+ 实测日志行浮现（角标 D4） | 对峙 travel 相向；热度柱 count；错卡 spring 登座 + breathe；日志行 impulse 高亮 ；`@travel` `@count` `@spring` |
| 3-E | p3-28..34 | CONFLICT 卡片（数字区空白虚线框）+ 裁决灯落下 + 金句「我不懂的时候，我说我不懂」 | 双卡 stagger；空白框 draw；裁决灯 travel；金句 progress 淡入 ；`@stagger` `@draw` `@travel` `@progress` |

## P4 一个窗口 + 一个插头（p4-01..39）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A | p4-01..08 | 唯一窗口：三 AI 排队 → resolve 收（问题+身份）出（上下文包）；无覆盖显式警告条 | 排队 stagger travel；窗口 spring；吸入/递出 travel 往返；警告 impulse 黄闪 ；`@stagger` `@travel` `@spring` `@impulse` |
| 4-B | p4-09..13 | 四因子天平 + 出身压秤（人写块沉 vs 机器挖块轻） | 四砝码 stagger 落盘；天平 rotate 微倾；出身块 spring 下沉 ；`@stagger` `@spring` |
| 4-C | p4-14..20 | 对数封顶：线性刻度爆款碾压 → 转轴对数刻度回落 + **代码走廊 ④**：`pop = log1p / log1p(POP_CAP)` 一行高亮；tie-break 三级判序小卡 | 坐标 draw；爆款柱 count 爆长 + shake；转轴 impulse 刻度翻转柱高回落；判序卡 stagger ；`@draw` `@count` `@shake` `@impulse` `@stagger` |
| 4-D | p4-21..25 | USB-C 插头滑入插入「上下文层 MCP 服务」机身，八盏治理灯点亮；异形设备逐一接入 | 插头 travel + snap 咬合；治理灯 stagger；设备 stagger 接入各自屏幕亮 ；`@travel` `@spring` `@stagger` |
| 4-E | p4-26..32 | **MCP 实录终端**：左右分栏 JSON-RPC 报文——initialize 握手、tools/list（→ 四工具名清单）、list_context_objects（→ 目录层那本账：条目/来源/信任分）、compile_metric（→ 三个数）逐对滚动；对账徽章「=签名答案 ✓」 | 报文对逐对上滚（progress 等速）；当前行 impulse 高亮；对账徽章 spring 盖章 ；`@progress` `@impulse` `@spring` |
| 4-F | p4-33..36 | 三行测试日志：T5 拒绝 / T6 排序易位 / T8 子进程往返（原文上滚） | 日志行 stagger 上滚；T5 红字 impulse；T6 箭头方向 flip ；`@stagger` `@impulse` |
| 4-G | p4-37..39 | 收束：五积木全景，激活积木（窗口+插头）放大高亮，其余微光 | 五积木 stagger 复亮；激活块 pushIn 放大 + activate 辉光；其余 dim ；`@stagger` `@pushIn` `@dim` |

## P5 治理的边界（p5-01..23）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A | p5-01..08 | 477 vs 48：四道绿灯工序 + 上游预聚合紫烟 + 数字对撞裂缝（第三方归属角标） | 绿灯 stagger；紫烟 flowDash；对撞 travel + 裂缝 draw ；`@stagger` `@flowDash` `@travel` `@draw` |
| 5-B | p5-09..14 | 三级对策台阶（注册期扫描/出口对账/eval 兜底）+ 对账徽章复现（引擎重算=验证答案）+ 脱敏审计双卡 | 台阶 stagger 升起；扫描 progress / 报警 impulse / 回溯网 draw；审计日志打字机 ；`@stagger` `@progress` `@impulse` `@draw` |
| 5-C | p5-15..19 | 价值数字复引（星号常驻「自家基准 · 自己测」） | 大数 count 翻牌；星号 impulse 两闪 + breathe 常驻 ；`@count` `@impulse` `@breathe` |
| 5-D | p5-20..23 | 通用化折损：大厂一体浇筑楼 vs 自建后装闸机；金句「防线换了位置，纪律不能换」 | 左楼 draw 整体成形；右闸机 spring 后装卡扣；金句 progress ；`@draw` `@spring` `@progress` |

## P6 路线图与诚实（p6-01..21）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A | p6-01..05 | P0 已完成卡墙：六机制卡翻绿 + 七次破坏实验小卡 + SELFTEST PASSED 徽章 | 机制卡 stagger 翻绿；破坏卡 stagger 亮红再收绿；徽章 snap 盖章 ；`@stagger` `@spring` |
| 6-B | p6-06..11 | 路线图四级台阶：P0 实心亮 / P1–P3 虚线呼吸 + P1 验收双小卡 | 台阶 draw 逐级；P0 impulse；虚线 flowDash 流动；验收卡 stagger ；`@draw` `@impulse` `@flowDash` `@stagger` |
| 6-C | p6-12..16 | 诚实两卡（已完成仅 P0 vs 路线图 P1–P3）+ 两档尺寸图 | 分界 draw；左实心 spring / 右虚线 flowDash；尺寸图 stagger 对比 ；`@draw` `@spring` `@flowDash` `@stagger` |
| 6-D | p6-17..22 | 金句「含义被治理好之前，AI 的聪明都是租来的」+ 信源卡（pinned commit + 蓝图/原型/**archify 工程图**路径）+ 渐黑 | 金句 progress + impulse；信源卡 rise；末句起亮度均匀降 0（渐黑窗口=beat 时长）；`@progress` `@impulse` `@enter:rise` `@dim` |
