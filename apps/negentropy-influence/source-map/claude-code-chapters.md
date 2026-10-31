# 系列信源地图——《Claude Code 的 20 个核心机制》（claude-code-chapters）

> 机读版：[claude-code-chapters.toml](./claude-code-chapters.toml)；与 [series.json](../series.json)（机器）/ [series.md](../series.md)（人读）同一配对纪律。本文件是本系列**章→集归属与钉选的唯一登记处**，各集 `research/gl-notes.md` 只链接、永不重述。

## 一、系列定位与拆集决策

- **信源**：与[旧系列地图](./claude-code-explained.md)同源（[Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)，MIT；站点 [learn.shareai.run/zh](https://learn.shareai.run/zh/)）。
- **集制**：站点 20 章版 **1:1 拆集**（2026-10-29 用户决策）——每章一集、每集约 5 分钟、单章讲透。示例：旧系列第 1 集《工具与执行》= 本系列 ep1 Agent Loop + ep2 Tool Use + ep3 Permission + ep4 Hooks 四集。
- **与旧系列关系**：并行不替代——《Claude Code Harness Engineering》（5 集制）原样保留，本系列建成后旧系列退役。
- **信源分析层**：继续沿用 [docs/research/agent-harness/171–176 精读族](../../../docs/research/agent-harness/)（C 型冻结进各集 `research/gl-notes.md`）；ep1 冻结现行 171（含 2026-10-23 I-234 词族整改后代次）。

## 二、钉选（双钉，与旧地图同款理由）

| 钉 | ref | 覆盖 | 理由 |
|---|---|---|---|
| main（17 章整合版，README.zh.md） | `7226f555`（2026-10-27） | ep1–ep4、ep6、ep8、ep9、ep19 | ep1/ep2：判据之争记忆点「认内容块别信停止标记」+「为什么还要加工具」接口论证的正源（2026-10-29 翻钉）。ep3–ep20 文案轮开工复核（2026-10-31）再翻钉四集：ep3/ep4/ep6（站点轨 s03/s04/s06 判据仍写 stop_reason、直引必与 ep1 所教自相矛盾，且 main 各有正源级增量——s03 词边界正则+测试点 5、s04 Stop 续跑写进教学正文、s06 子循环判据同款硬伤）、ep8（main s08 为全重写正源：四点论证与「为什么顺序固定」等机制级演进全部只在 main）、ep9（站点轨判据同款硬伤 + main 内容块判据）、ep19（main s14_mcp_plugin 有宿主策略/正源级三节增量）。完整证据链在各集 gl-notes 附录 B.1 |
| 站点同源修订（20 章版，README.md） | `67a9126c`（2026-07-29） | ep5、ep7、ep10–ep18、ep20 | 20 章版是本系列集制骨架；分支 HEAD 至 2026-10-31 未动，各站点页与 2026-10-07 基线零漂移（逐集复核）。维持站点轨的十二集理由：ep5/ep7（main 仅注释中文化与空输入守卫，站点轨独有「深入 CC 源码」附录族与本集叙事数字锚是正源）、ep10/ep11（main 无独立章，深潜只在站点轨）、ep12/ep13/ep14（「改号不改内容」复核成立，main 对照经 {slug}m-* 登记）、ep15–ep18（系列决策 20 章版单章成集，main s13_agent_teams 整合章仅作对照）、ep20（终章叙件「结束亦是开始」收束节与全量回归表只在站点轨） |

各集需要的另一轨独有材料——站点轨各章「深入 CC 源码」附录、main 轨对照章（s10_task_system / s11–s12 改号章 / s13_agent_teams 整合章 / s15_integrated_harness）——经各集台账 `{slug}f-*` / `{slug}m-*` 条目补登（字节归档随集），断言恒【三】级、归属由首尾署源位承接。

修订分叉全叙事（站点 20 章版 ↔ main 17 章整合版的章号不共用、I-165 根因）登记在[旧系列地图](./claude-code-explained.md)，本文件不重述。

## 三、章→集归属（20 章 × 20 集）

见机读版 `[[chapter]]` 表：`s01_agent_loop`→ep1 … `s20_comprehensive`→ep20，一集一章。ep1 已交付、ep2 文案轮待审批（2026-10-29）；ep3–ep20 已于 2026-10-31 完成脚手架与文案轮开工复核（钉选定案见 §二），文案轮 Stage ①–⑤ 推进中。

### 五大组归属（片头站点/进度点数据面的登记源）

组名与片头音频「五种核心机制」逐词对位（音频是系列级固定资产）；归属按章节主题定，在集轴上**不连续**——`harness-stack.tsx` 的 `EPISODE_GROUPS` 查表实现与本表同步：

| 组 | 章节 | 集号 |
|---|---|---|
| 工具与执行 | s01–s04 | 1–4 |
| 规划与协调 | s05–s07、s10、s11 | 5–7、10、11 |
| 记忆管理 | s08、s09 | 8、9 |
| 并发 | s13、s14 | 13、14 |
| 多 Agent | s12、s15–s20 | 12、15–20 |

## 四、口径与纪律（沿用并链接）

- 证据三级、数字复算、活数据不进口播：vibe-video skill [01-source-extraction](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/01-source-extraction.md) B/C 型；各集 `research/gl-notes.md` 头部冻结登记。
- 口播类比唯一准入：冻结件附录 A 类比登记表（一物一喻，不在视频阶段另造）；旧系列退役喻体（禁喻词表）继续禁用——清单在[旧系列地图 §口播禁喻词表](./claude-code-explained.md)。
- 观众层去站点化（check_series 规则 7）：按章节拆集只是编导结构，口播与画面零课程站痕迹；研究层具名归属照旧。
