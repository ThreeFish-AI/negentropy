# 科普视频作品总览

> 机读 SSOT：[series.json](./series.json)（顶层 `seriesList[]`，多系列并列）。顺序变更只改它 + 视觉层；
> 口播永不携带序号，校验器 [check_series.py](./pipeline/scripts/check_series.py) 保证散文/组件与清单一致。
>
> **多系列执法语义**：反串线（规则 1）**跨系列全局生效**——两个系列各自独立成片，口播互不引用；
> 顺序类规则（2/3/4）**按系列内判定**——不同系列的发布顺序互相无关，`episode` 的 `1..N`
> 连续性也只在系列内成立。

制作统一走[公共管线](./pipeline/README.md)（九阶段）；配音经 IndexTTS-2.5 本人音色克隆
（样本指纹见 [voices/refs.toml](./pipeline/voices/refs.toml)，手册 [VOICE-CLONING.md](./pipeline/VOICE-CLONING.md)）。

## 自进化系列（论文型选题）

事实源是一篇综述论文，取证走 `paper_extract.py`。

| # | 作品 | 一句话主题 | 视觉契约（主色） | 源论文 | 状态 |
|---|---|---|---|---|---|
| 1 | [《上线之后，AI 才开始上学》](./episodes/experience-era-agents-video/README.md) | 部署之后经验怎么攒 | 金/青/紫 | 清华×Frontis 88 页综述（无 arXiv 号），2026-06 | **v3 就绪**（内容校准 + sunny-steady 全片重配，成片 14:01；源码含未重渲改动：P3 格阵落格校准） |
| 2 | [《AI 如何自己变强？》](./episodes/self-improving-agents-video/README.md) | 自我进化改什么 | 蓝/橙 | arXiv:2607.13104（Schmidhuber 团队），2026-07 | 就绪（待升级 sunny-steady，未排期） |
| 3 | [《会写代码的 AI，开始给自己写代码》](./episodes/self-evolving-coding-agents-video/README.md) | 代码领域全图 | 绿/洋红 | arXiv:2608.03392（NJUST×NJU），2026-08 | 就绪（源码含未重渲改动；待升级 sunny-steady） |

## Claude Code 通俗全解（文档/代码型选题）

事实源是**在线课程 + 代码仓库**，取证走 `source_ledger.py`（固定提交 + 双指纹 + 取数日期），
断言按**证据三级**分层标注——课程作者对闭源产品源码的分析必须带归属句，不得当作产品既成事实。

| # | 作品 | 一句话主题 | 视觉契约（主色） | 信源 | 状态 |
|---|---|---|---|---|---|
| 1 | [《拆开 Claude Code：让 AI 动手的四层机制》](./episodes/claude-code-explained-video/README.md) | 工具与执行的四层机制 | 陶土橙/石青/警示红 | [Learn Claude Code](https://learn.shareai.run/zh/s01/) s01–s04 + 仓库 @ `f9e8b28`（MIT），2026-08 | **已交付**（成片 14:14；2026-08-22 画面优化版 14:12，抽帧 FAIL 0 · WARN 0） |
| 2 | [《AI 的视野是安排出来的：写下来的计划，另开的桌子》](./episodes/claude-code-planning-video/README.md) | 规划与协调：谁来安排模型看到什么 | 鸢紫 `view`（底座陶土橙/石青全系列共享） | s05–s07 · s10 · s11 @ 站点同源修订 `67a9126c`（MIT） | **已交付**（成片 13:11.81，134 句 3906 字，七幕抽帧 FAIL 0） |
| 3 | [《AI 的记忆：会丢的和不能丢的》](./episodes/claude-code-memory-video/README.md) | 记忆管理：压缩与持久层 | 苔绿 `keep` | s08 · s09 @ `67a9126c`（MIT） | **已交付**（成片 13:12.26，140 句 3900 字，七幕 FAIL 0） |
| 4 | [《AI 会自己开工吗？后台与定时》](./episodes/claude-code-concurrency-video/README.md) | 并发与调度：谁来按下开始 | 霜蓝 `later` | s13 · s14 @ `67a9126c`（MIT） | 制作中（①–⑦ 就绪：139 句 3882 字 / 27 镜 / 场景 2918 行；待配音） |
| 5 | [《一群 AI 怎么干活：看板、信箱与各自的桌子》](./episodes/claude-code-multiagent-video/README.md) | 多 Agent 平台：从一个到一群 | 赭金 `peer` | s12 · s15–s20 @ `67a9126c`（MIT） | 制作中（①–⑦ 就绪：131 句 3863 字 / 29 镜 / 场景 4865 行；待配音） |

> 章节→集归属与**站点/仓库修订分叉**（站点为 20 章旧修订、仓库 main 已整合为 17 章，故双钉）：
> 系列级登记见 [source-map/claude-code-explained.md](./source-map/claude-code-explained.md)。

**系列纪律**：各集独立成片，口播互不引用、不出现集数序号——顺序只存在于本清单与片尾视觉卡片，
发布顺序变更的 TTS 代价恒为零。
