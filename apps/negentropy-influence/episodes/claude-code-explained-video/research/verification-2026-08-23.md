# 阶段④ 双校验记录（Harness Engineering 改造版 · 2026-08-23）

> 本文件记录 v-next（Harness Engineering 改造）逐字稿的真实性与易懂性双校验。
> 前版校验记录见同目录历史文件。改造范围：P0 重写、P1/P3/P4 官方锚点替换、P6 重写。

## 一、真实性校验（每条断言回溯）

| 口播句 | 断言 | 证据级 | 事实源锚点 | 判定 |
|---|---|---|---|---|
| p0-04..06 | 「Harness」官方命名 + 模型在Harness里面 + 供给五样 | 【二】 | code.claude.com/docs/en/glossary（Agentic harness 条目）· how-claude-code-works | ✅ VERIFIED |
| p1-25..27 | 三相循环交融 + 人随时可打断 | 【二】 | how-claude-code-works（gather/take/verify） | ✅ VERIFIED |
| p1-28..29 | State 十字段（角标化） | 【三】 | 第三方源码分析（归属句保留） | ✅ VERIFIED（带归属） |
| p3-06 | 权限由代码执行不由模型执行 | 【二】 | code.claude.com/docs/en/permissions | ✅ VERIFIED |
| p3-25..29 | deny→ask→allow 顺序求值 · 首中即出局 · 裸名 deny 移除工具 | 【二】 | permissions 页规则语义 | ✅ VERIFIED |
| p3-31 | 93% 提示被批准 | 【二】 | 官方遥测 2026-03（历史口径，口播带「官方遥测」） | ✅ VERIFIED |
| p3-32..34 | 分类器只看用户消息与裸命令 | 【二】 | anthropic.com/engineering/claude-code-auto-mode | ✅ VERIFIED |
| p4-23..25 | 31 个 hook 事件 × 三节奏 | 【二】 | code.claude.com/docs/en/hooks（事件表逐行计数 2026-08-22） | ✅ VERIFIED（口径已注明「官方文档口径」） |
| p4-27..32 | 沉默≠批准 · 放行穿后两站 · 单向加限制 · 六闸 | 【二】 | hooks reference + agent-sdk/permissions | ✅ VERIFIED |
| p4-33..34 | 教学版无此层是安全漏洞 | 【三】 | 第三方评语（归属句保留） | ✅ VERIFIED（带归属） |
| p5-05..06 | 官方四件套定义 | 【二】 | claude.com/blog/harnessing-claudes-intelligence | ✅ VERIFIED |
| p6-06 | 取数2026年8月 | 【二】 | 全片信源取数日期（无空格写法过 READING_TRAPS） | ✅ VERIFIED |

**口径切换记录**：hooks 事件数从 27（第三方数源码）→ 31（官方文档口径）——两口径未混用，
分镜 4-F 的 27 格矩阵同步重建为三层嵌套（31 计数）。

## 二、易懂性校验

- 新概念首现配比喻：Harness（p0-04「把动力源，套进一个可控的结构里」）；三相（p1-26「不是硬阶段」）；
  六闸（沿三闸门认知升级，画面先轨道后闸）。
- 金句节奏保留：每幕收尾金句未动（1-D/2-F/3-D/4-G2/5-C 全保留）。
- 英文标识符只在角标（agentic harness / deny/ask/allow / hook / workflow 等全画面层）。
- 句长：167 句全部 8–35 字（check_script 门过）。

## 三、遗留与决策

- 27→31 口径切换已在画面角标注明「官方文档口径」；旧 27 数字不再出现。
- 93% 为历史遥测口径（2026-03），非活数据，口播带「官方遥测」限定。
- State 十字段降级为角标清单（原 1-E 十抽屉详述压缩）——信息未删，入口移画面。

---

# 附：2026-09-06 官方文档复核（3D 强化轮）

> 范围：对轨 C 六个官方锚点逐页取原文、与口播逐条对照。完整断言表见
> [source-notes.md §十](./source-notes.md)。

## 一、修正（3 句）

| 句 | 原 | 新 | 依据 |
|---|---|---|---|
| p0-06 | 「…权限、记忆、**护栏**」 | 「…权限、记忆，**和把这些串起来的循环**」 | glossary：第五样是 "the loop that chains actions together"。**原稿此断言在事实源中无锚点**——违反「回溯不到不得进口播」 |
| p4-23 | 「官方文档口径**三十一个**」 | 「有**三十多个**，官方文档还在往上加」 | hooks 页 2026-09-06 实测 33（2026-08 为 31）。绝对数属活数据，踩 §九禁用清单第 1、2 条；改抗漂移表述，数字降入画面角标 |
| p6-06 | 「取数2026年**8**月」 | 「取数2026年**9**月」 | 本轮复核日期；写法保持年份与「年」间无空格（READING_TRAPS FAIL 项） |

字数 3979 → 3989（+10），估算 14.25 分、实测含时距 14.0 分，双口径均落窗 [13.0, 14.6]。
重合成仅 3 句，其余 164 句由音频版本库回收。

## 二、复核通过、未动的断言

p0-04/05（harness 命名）· p1-25..27（三相与打断）· p3-06（权限由代码执行）·
p3-25..28（deny→ask→allow / 首中即出局 / 裸名移除工具）· p3-31（93% 遥测）·
p3-32..34（分类器 reasoning-blind）· p4-24（三节奏）· p4-29..31（hook 放行穿两站 / 单向）·
p5-05（四件套）—— 全部 ✅ VERIFIED，原文见 source-notes §十。

## 三、根因与机制性收口

三处缺陷的共同根因：**Harness Engineering 改造引入的六个官方锚点从未进入 `sources.toml`**
（全系列 5 集皆如此）。后果双重——写错了没有事实源能拦，写对了也会随官方更新悄悄陈旧。

本轮已用 `source_ledger.py fetch --kind site` 补录 `cc-glossary` / `cc-how-it-works` /
`cc-hooks` / `cc-permissions` / `cc-auto-mode` / `cc-harness-blog` 六条，`verify` 受检面
12 → 18 条。此后官方页正文漂移会自动报 WARN。

> 补录前 `verify` 报的是「受检 12 · FAIL 0」全绿，而出问题的六页根本不在受检集里——
> **门是绿的，只因为它没在看**。这是本轮最值得记住的一条。

EP2–5 同款缺口尚在，跟进不在本轮范围。
