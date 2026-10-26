# 信源原图资产库（source-figures）

> 精读笔记引用的**信源原图**本地副本：代码仓、文档站、博客、官网与论文里自带的图，原样保存或仅做格式转换后入库。
> 与 [`../architecture/`](../architecture/) 的自绘 archify 图分开存放——自绘图讲清结构，原图提供可对照的一手实证。
> 判据、入库方式与 wiki 渲染约束见 [doc-media-assets §2](../../.agents/doc-media-assets.md#2-决策表)。

## 约定

- **目录**：`<research 分组>/<主题>--src-<NN>-<slug>.png`，`NN` 与正文「信源原图 N」编号一致；正文以纯 Markdown `![]()` 相对路径嵌入。
- **只做格式转换，不改内容**：位图原样复制；SVG 以无头浏览器 2× 栅格化为 PNG（规避读者缺 CJK 字体与 wiki 主题反向）；透明底图烘成不透明底（浅字图烘暗底、深字图烘白底）；裁切须在题注注明。
- **单文件 ≤ 1280 KiB**（pre-commit `check-added-large-files` 硬门）。
- **署名与许可**：每张图的题注写明出处与许可；无开放许可者标「版权归原作者，仅作学习引用」。许可禁止再分发的材料（如 arXiv non-exclusive-distrib 1.0）不入库，正文改为链接。
- **时效**：取自活体网页（无版本号的博客、SPA 官网、云产品页）的图记抓取日期；描绘已删除机制的图只作矛盾佐证，题注必须写明。

## 清单

### cognitive-context · OpenViking 精读（[014](../../research/cognitive-context/014-openviking.md)）

抓取日期均为 2026-10-25；代码仓图钉点 [`6227af51`](https://github.com/volcengine/OpenViking/tree/6227af5102b3874d162d65a0503bfeef849686c2)。

| N | 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- | --- |
| 1 | [openviking--src-01-old-model-pain.png](./cognitive-context/openviking--src-01-old-model-pain.png) | [博客《OpenViking User / Peer》](https://blog.openviking.ai/post/openviking-user-peer-model/) Figure 2 | 版权归原作者，仅作学习引用 | 原样 |
| 2 | [openviking--src-02-user-peer-isolation.png](./cognitive-context/openviking--src-02-user-peer-isolation.png) | [火山引擎 OpenViking Context 产品页](https://www.volcengine.com/product/openviking-service)「应用场景 · 知识管理」架构图 | 版权归原作者，仅作学习引用 | 透明底烘白底 |
| 3 | [openviking--src-03-peer-memory-tree.png](./cognitive-context/openviking--src-03-peer-memory-tree.png) | [博客《Agent Swarms Don't Lack Scale — They Lack Memory》](https://blog.openviking.ai/post/agent-swarm-memory/) Figure 3（tosaki、Alice (Agent Hub)） | 版权归原作者，仅作学习引用 | 裁去底部折叠的 peer 列表（670×1700 → 670×1475） |
| 4 | [openviking--src-04-l0l1-progressive-loading.png](./cognitive-context/openviking--src-04-l0l1-progressive-loading.png) | [火山引擎 OpenViking Context 产品页](https://www.volcengine.com/product/openviking-service)「应用场景 · AI Coding 助手」架构图1 | 版权归原作者，仅作学习引用 | 原样 |
| 5 | [openviking--src-05-gateway-one-turn.png](./cognitive-context/openviking--src-05-gateway-one-turn.png) | 钉点 [`docs/images/gateway/one-turn.zh.svg`](https://github.com/volcengine/OpenViking/blob/6227af5102b3874d162d65a0503bfeef849686c2/docs/images/gateway/one-turn.zh.svg) | AGPL-3.0 | SVG 2× 栅格化 |
| 6 | [openviking--src-06-gateway-tool-loop.png](./cognitive-context/openviking--src-06-gateway-tool-loop.png) | 钉点 [`docs/images/gateway/tool-loop.zh.svg`](https://github.com/volcengine/OpenViking/blob/6227af5102b3874d162d65a0503bfeef849686c2/docs/images/gateway/tool-loop.zh.svg) | AGPL-3.0 | SVG 2× 栅格化 |
| 7 | [openviking--src-07-gateway-topology.png](./cognitive-context/openviking--src-07-gateway-topology.png) | 钉点 [`docs/images/gateway/architecture.zh.svg`](https://github.com/volcengine/OpenViking/blob/6227af5102b3874d162d65a0503bfeef849686c2/docs/images/gateway/architecture.zh.svg) | AGPL-3.0 | SVG 2× 栅格化 |
| 8 | [openviking--src-08-readme-benchmark.png](./cognitive-context/openviking--src-08-readme-benchmark.png) | 钉点 [`docs/images/benchmark-dark.svg`](https://github.com/volcengine/OpenViking/blob/6227af5102b3874d162d65a0503bfeef849686c2/docs/images/benchmark-dark.svg)（README 基准图） | AGPL-3.0 | SVG 2× 栅格化，透明底烘暗底 `#020617`，四周留 24px 边距 |
| 9 | [openviking--src-09-vikingmem-schema.png](./cognitive-context/openviking--src-09-vikingmem-schema.png) | [VikingMem, arXiv:2605.29640v3](https://arxiv.org/html/2605.29640v3#S2.F1) Figure 1（J. Fu *et al.*） | CC BY-NC-SA 4.0 | 原样 |
| 10 | [openviking--src-10-product-retrieval-claims.png](./cognitive-context/openviking--src-10-product-retrieval-claims.png) | [openviking.ai/product](https://openviking.ai/product)「三层结构，按需加载」与「理解结构的检索」两节（前端 bundle `index-BfoH6ZUa.js`） | 版权归原作者，仅作学习引用 | 无头浏览器暗色 2× 截图，隐藏吸顶导航 |
