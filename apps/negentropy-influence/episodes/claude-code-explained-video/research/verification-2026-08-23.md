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
