# 科普视频作品总览

> 机读 SSOT：[series.json](./series.json)（顶层 `seriesList[]`，多系列并列）。顺序变更只改它 + 视觉层；
> 口播永不携带序号，校验器 [check_series.py](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/scripts/check_series.py) 保证散文/组件与清单一致。
>
> **多系列执法语义**：反串线（规则 1）**跨系列全局生效**——两个系列各自独立成片，口播互不引用；
> 顺序类规则（2/3/4）**按系列内判定**——不同系列的发布顺序互相无关，`episode` 的 `1..N`
> 连续性也只在系列内成立。

制作统一走[公共管线](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/README.md)（九阶段）；配音经 IndexTTS-2.5 本人音色克隆
（样本指纹见 [voices/refs.toml](./voices/refs.toml)，手册 [VOICE-CLONING.md](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/VOICE-CLONING.md)）。

## 自进化系列（论文型选题）

事实源是论文（综述与研究论文），取证走 `paper_extract.py`。

| #   | 作品                                                                                          | 一句话主题         | 视觉契约（主色） | 源论文                                         | 状态                                                                                           |
| --- | --------------------------------------------------------------------------------------------- | ------------------ | ---------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | [《上线之后，AI 才开始上学》](./episodes/experience-era-agents-video/README.md)               | 部署之后经验怎么攒 | 金/青/紫         | 清华×Frontis 88 页综述（无 arXiv 号），2026-06 | **v3 就绪**（内容校准 + sunny-steady 全片重配，成片 14:01；源码含未重渲改动：P3 格阵落格校准） |
| 2   | [《AI 如何自己变强？》](./episodes/self-improving-agents-video/README.md)                     | 自我进化改什么     | 蓝/橙            | arXiv:2607.13104（Schmidhuber 团队），2026-07  | 就绪（待升级 sunny-steady，未排期）                                                            |
| 3   | [《会写代码的 AI，开始给自己写代码》](./episodes/self-evolving-coding-agents-video/README.md) | 代码领域全图       | 绿/洋红          | arXiv:2608.03392（NJUST×NJU），2026-08         | 就绪（源码含未重渲改动；待升级 sunny-steady）                                                  |
| 4   | [《翻旧账不花钱：AI 在梦里改章程》](./episodes/dream-rsi-video/README.md)                   | 元探索策略怎么改   | 冰蓝/暖白/嫩绿   | arXiv:2609.14858（UMD×DeepMind×UVA），2026-09  | **v2 终渲待审**（章节导航条版 10:30.87 · archify 混合 16 图；2026-09-23，归档 ~/Documents/video） |

## Claude Code Harness Engineering（文档/代码型选题）

拆解 Claude Code 的 **harness 工程**：内容准绳是官方文档（code.claude.com）与 Anthropic 工程实践，
开源课程仓库的 20 章/5 阶段结构只作组织骨架（观众层匿名化——`check_series.py` 规则 7）；
取证走 `source_ledger.py`（固定提交 + 双指纹 + 取数日期），断言按**证据三级**分层标注——
第三方对闭源产品源码的分析必须带归属句，不得当作产品既成事实。

| #   | 作品                                                                                  | 一句话主题                    | 视觉契约（主色）                         | 信源                                                                                              | 状态                                                                        |
| --- | ------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | [《工具与执行：一个循环，三层装置》](./episodes/claude-code-explained-video/README.md) | 循环不变式与三层挂载装置 | core #D97757 恒定/mech 石青 | 站点 s01–s04 钉 main `0dcafa2`（MIT）＋官方文档轨 C；台账 12 条 audit FAIL 0 | ✅ **完全重制 v1 交付**（14:02.6 · 164 句 · 12 图 65 章 · 归档 v1+_captions） |
| 2   | [《规划与协调：视野错位的五种修正手法》](./episodes/claude-code-planning-video/README.md) | 五种视野错位与修正 | mech 鸢紫 #9C90EE | s05–s07·s10·s11 @ `67a9126c` ＋ 176 C 型 | 🔄 **完全重制中**（2026-10-02 启动：C 型 GL 信源 176 + 新标题，旧版 v1/v2 归档保留） |
| 3   | [《记忆管理：会丢的和不能丢的》](./episodes/claude-code-memory-video/README.md) | 两套咬合的机制 | mech 苔绿 #A9C46C | s08·s09 @ `67a9126c` ＋轨 C（main 演进彩蛋） | ✅ **完全重制 v1 交付**（14:13.3 · 163 句 · 12 图 62 章） |
| 4   | [《并发：谁来按下开始》](./episodes/claude-code-concurrency-video/README.md) | 后台不等＋定时钟自动 | mech 霜蓝 #7FB2E0 | s13·s14 @ `67a9126c` ＋轨 C | ✅ **完全重制 v1 交付**（14:10.8 · 170 句 · 12 图 59 章 · Lottie 根因修复） |
| 5   | [《多 Agent 平台：从一个到一群》](./episodes/claude-code-multiagent-video/README.md) | 从一个到一群的五物件 | mech 协作金 #D9B36B | s12·s15–s20 @ `67a9126c` ＋轨 C 八校准 | ✅ **完全重制 v1 交付**（13:42.8 · 149 句 · 13 图 67 章 · 终集收束） |

> 章节→集归属与**站点/仓库修订分叉**（站点为 20 章旧修订、仓库 main 已整合为 17 章，故双钉）：
> 系列级登记见 [source-map/claude-code-explained.md](./source-map/claude-code-explained.md)。

**系列纪律**：各集独立成片，口播互不引用、不出现集数序号——顺序只存在于本清单与片尾视觉卡片，
发布顺序变更的 TTS 代价恒为零。

## Context Layer · 上下文层系列（doc 型 · 3 集）

信源为本仓研究文档族（B 型 · 固定提交取证）：前两集上游 Snowflake 官方页不直接取证、只经 011 精读笔记的 IEEE 引用链间接可溯；第三集上游 volcengine/OpenViking 官方页与代码仓不直接取证、只经 014 精读笔记的 `path:line@14a7b81` 锚点链间接可溯。系列纪律同前（口播互不引用、无集数序号）。

| #   | 作品                                                                              | 一句话主题                     | 视觉契约（主色）              | 信源                                                                                     | 状态                                                          |
| --- | --------------------------------------------------------------------------------- | ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | [《拆解 Horizon Context》](./episodes/horizon-context-video/README.md)            | Horizon Context：含义怎么治理  | 琥珀金/青碧/淡紫              | 011 精读笔记 + 最小原型 @ `097076eb`，2026-09-19                                          | **v5 终渲待审**（15:11 · archify 67 图 156 cue · 锚定 83.4%） |
| 2   | [《给 AI 发一张工卡：Agent 上下文层蓝图》](./episodes/context-layer-video/README.md) | Context Layer：蓝图怎么复刻    | 钢蓝/工业橙/校准绿            | 013 蓝图完全重铸版 + 011 + lab/mcp 原型 @ `a77c65822`，2026-09-29                        | **v2 终渲待审**（14:02 · 机务工卡剧场 · 13 图 76 章 71 cue · 锚定 36.8%） |
| 3   | [《给 AI 一座图书馆：OpenViking 上下文数据库》](./episodes/openviking-video/README.md) | OpenViking：文件系统范式怎么做上下文 | 玫红/薄荷绿/长春花蓝        | 014 精读笔记 + 015 映射 + openviking_lab @ `348d8797`，2026-09-24                          | **v1 终渲待审**（10:37 · archify 9 图 54 cue 回放）          |

## Agent 基础设施系列（doc 型 · 1 集）

信源为本仓 `docs/research/agent-infra/` 精读笔记与最小原型（B 型 · 固定提交取证），并直接取证上游开放标准的固定提交（规范、指南与参考实现源码）；本仓实现的映射结论不进正片。系列纪律同前（口播互不引用、无集数序号）。

| #   | 作品 | 一句话主题 | 视觉契约（主色） | 信源 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1   | [《经验淬炼成手册：Agent 的轻量蒸馏与按需装配》](./episodes/agent-skills-video/README.md) | Agent Skills：经验怎么交给 AI | 玫瑰焰/矢车菊蓝/兰花紫 | 090 精读 + 最小原型 @ `80b456fb` + agentskills/agentskills @ `69ef37e9`，2026-09-23 | **v1 终渲待审**（15:25 · archify 12 图 58 章 · 归档 ~/Documents/video） |
| 2   | [《只填格的判读员：Jev 决策模型》](./episodes/jev-decision-model-video/README.md) | Jev：小判断的交付方式怎么变 | 格黄/柱青/闸品 | 200 精读 + 原型 + laya 复刻 @ `40bf690` + TypeSafe 官方/adapter/kev/laya/nibzard 钉提交，2026-09-26 | **v1 终渲待审**（14.2 分 · story 配音 · archify 13 图 54 章 · 归档 ~/Documents/video） |
