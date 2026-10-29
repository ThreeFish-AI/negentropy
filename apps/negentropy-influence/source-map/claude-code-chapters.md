# 系列信源地图——《Claude Code 机制二十讲》（claude-code-chapters）

> 机读版：[claude-code-chapters.toml](./claude-code-chapters.toml)；与 [series.json](../series.json)（机器）/ [series.md](../series.md)（人读）同一配对纪律。本文件是本系列**章→集归属与钉选的唯一登记处**，各集 `research/gl-notes.md` 只链接、永不重述。

## 一、系列定位与拆集决策

- **信源**：与[旧系列地图](./claude-code-explained.md)同源（[Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)，MIT；站点 [learn.shareai.run/zh](https://learn.shareai.run/zh/)）。
- **集制**：站点 20 章版 **1:1 拆集**（2026-10-29 用户决策）——每章一集、每集约 5 分钟、单章讲透。示例：旧系列第 1 集《工具与执行》= 本系列 ep1 Agent Loop + ep2 Tool Use + ep3 Permission + ep4 Hooks 四集。
- **与旧系列关系**：并行不替代——《Claude Code Harness Engineering》（5 集制）原样保留，本系列建成后旧系列退役。
- **信源分析层**：继续沿用 [docs/research/agent-harness/171–176 精读族](../../../docs/research/agent-harness/)（C 型冻结进各集 `research/gl-notes.md`）；ep1 冻结现行 171（含 2026-10-23 I-234 词族整改后代次）。

## 二、钉选（双钉，与旧地图同款理由）

| 钉 | ref | 覆盖 | 理由 |
|---|---|---|---|
| main（17 章整合版，README.zh.md） | `7226f555`（2026-10-27） | ep1 | 判据之争记忆点「看内容块别信停止标记」正源是 main 修正后的写法（认内容块、不追加空 tool_result）；2026-10-29 复核：自旧钉 `ce8f9f18` 前移 13 提交，s01 仅 code.py 改 2 行空输入守卫（无叙事影响），README.zh.md 逐字一致 |
| 站点同源修订（20 章版，README.md） | `67a9126c`（2026-07-29） | ep2–ep20 | 20 章版是本系列集制骨架；分支 HEAD 至 2026-10-29 未动，站点 s01 页复验一致。ep2–ep20 为**规划态**钉，逐集开工时按当章内容复核是否翻钉 main |

ep1 需要的站点轨独有材料——「深入 CC 源码」附录（needsFollowUp / State 10 字段 / 多条退出路径 / StreamingToolExecutor）——经本集台账 `s01f-readme` / `s01f-code` 条目补登（字节归档随集），断言恒【三】级、口播带归属句。

修订分叉全叙事（站点 20 章版 ↔ main 17 章整合版的章号不共用、I-165 根因）登记在[旧系列地图](./claude-code-explained.md)，本文件不重述。

## 三、章→集归属（20 章 × 20 集）

见机读版 `[[chapter]]` 表：`s01_agent_loop`→ep1 … `s20_comprehensive`→ep20，一集一章。ep2–ep20 规划态（未脚手架、未登记 series.json），开工时逐集复核。

## 四、口径与纪律（沿用并链接）

- 证据三级、数字复算、活数据不进口播：vibe-video skill [01-source-extraction](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/01-source-extraction.md) B/C 型；各集 `research/gl-notes.md` 头部冻结登记。
- 口播类比唯一准入：冻结件附录 A 类比登记表（一物一喻，不在视频阶段另造）；旧系列退役喻体（禁喻词表）继续禁用——清单在[旧系列地图 §口播禁喻词表](./claude-code-explained.md)。
- 观众层去站点化（check_series 规则 7）：按章节拆集只是编导结构，口播与画面零课程站痕迹；研究层具名归属照旧。
