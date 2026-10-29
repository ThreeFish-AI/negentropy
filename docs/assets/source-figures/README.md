# 信源原图资产库（source-figures）

> 精读笔记引用的**信源原图**本地副本：代码仓、文档站、博客、官网与论文里自带的图，原样保存或仅做格式转换后入库。
> 与 [`../architecture/`](../architecture/) 的自绘 archify 图分开存放——自绘图讲清结构，原图提供可对照的一手实证。
> 判据、入库方式与 wiki 渲染约束见 [doc-media-assets §2](../../.agents/doc-media-assets.md#2-决策表)。

## 约定

- **目录**：`<research 分组>/<主题>--src-<NN>-<slug>.png`，`NN` 与正文「信源原图 N」编号一致；论文原图沿用正文「原文图 N」的编号命名（如 `ktp--fig<N>-<slug>.png`）；正文以纯 Markdown `![]()` 相对路径嵌入。
- **只做格式转换，不改内容**：位图原样复制；SVG 以无头浏览器 2× 栅格化为 PNG（规避读者缺 CJK 字体与 wiki 主题反向）；透明底图烘成不透明底（浅字图烘暗底、深字图烘白底）；裁切须在题注注明。
- **单文件 ≤ 1280 KiB**（pre-commit `check-added-large-files` 硬门）。
- **署名与许可**：每张图的题注写明出处与许可；无开放许可者标「版权归原作者，仅作学习引用」。许可禁止再分发的材料（如 arXiv non-exclusive-distrib 1.0）不入库，正文改为链接。
- **时效**：取自活体网页（无版本号的博客、SPA 官网、云产品页）的图记抓取日期；描绘已删除机制的图只作矛盾佐证，题注必须写明。

## 清单

### multimodal-models · KTP 论文精读（[240](../../research/multimodal-models/240-visual-generation-knowledge-transfer.md)）

KTP 论文图 1–7 由 TeX 源码包矢量 PDF 渲染为 PNG，2026-10-26 自 `docs/assets/papers/`（PR #1211 建）迁入统一本库，文件与路径未改名（历史链接按 git 追溯）。抓取基准为 arXiv:2610.21459v1 TeX 源码包，逐图署名与读数核验见 [240 正文](../../research/multimodal-models/240-visual-generation-knowledge-transfer.md)。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [ktp--fig1-overview.png](./multimodal-models/ktp--fig1-overview.png) ~ [fig7](./multimodal-models/ktp--fig7-sensenova-visual-cot-case.png) | KTP TeX 源码包 Fig.1–7 | 版权归原作者，仅作学习引用 | 矢量 PDF 渲染 PNG，单图 ≤ 1 MiB |

### agent-harness · DSA 精读（[178](../../research/agent-harness/178-daily-stock-analysis.md)）

仓内样例均取自钉点 [`4e622643`](https://github.com/ZhuLinsen/daily_stock_analysis/tree/4e6226430b76124e5f43b19201fc6338a62f5e1d)；论文图取自 arXiv:2608.26990v1 PDF。

| N | 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- | --- |
| 1 | [dsa--src-01-dapan-review.png](./agent-harness/dsa--src-01-dapan-review.png) | 仓内样例 `docs/assets/dapan_2026-01-13_22-14-52.png`（大盘复盘真实产出，2026-01-13） | MIT（仓库 LICENSE） | 原样（157 KiB） |
| 2 | [dsa--src-02-decision-dashboard.png](./agent-harness/dsa--src-02-decision-dashboard.png) | 仓内样例 `docs/assets/sample.png`（决策仪表盘真实产出，2026-01-10 永鼎股份） | MIT（仓库 LICENSE） | 原样（RGB 无透明，88 KiB） |
| 3 | [dsa--src-03-alert-center.png](./agent-harness/dsa--src-03-alert-center.png) | 仓内样例 `docs/assets/alert-center-p5-web.png`（告警中心 Web 界面：规则表与触发历史） | MIT（仓库 LICENSE） | 原样（249 KiB） |
| — | [dsa--fig1-evidence-pipeline.png](./agent-harness/dsa--fig1-evidence-pipeline.png) | [DSA, arXiv:2608.26990v1](https://arxiv.org/abs/2608.26990) Figure 1（L. Zhu 与 Y. Shi） | CC BY 4.0 | 自论文 PDF 页 2 题注锚定裁切（57 KiB） |
| — | [dsa--fig2-agentic-synthesis.png](./agent-harness/dsa--fig2-agentic-synthesis.png) | [DSA, arXiv:2608.26990v1](https://arxiv.org/abs/2608.26990) Figure 2（L. Zhu 与 Y. Shi） | CC BY 4.0 | 自论文 PDF 页 4 题注锚定裁切（95 KiB） |

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

### cognitive-context · Memadapter 论文精读（[015](../../research/cognitive-context/015-memadapter-counterfactual-adaptation.md)）

Memadapter 论文图 1–3 取自 [arXiv:2610.05162v1](https://arxiv.org/html/2610.05162v1) HTML 版（抓取 2026-10-28；论文摘要页许可 CC BY 4.0，允许署名再分发），编号沿用正文「原文图 N」。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [memadapter--fig1-two-paradigms.png](./cognitive-context/memadapter--fig1-two-paradigms.png) | [arXiv:2610.05162v1](https://arxiv.org/html/2610.05162v1#S1.F1) 原文图 1（R. Ning *et al.*） | CC BY 4.0 | 原样 |
| [memadapter--fig2a-accuracy-with-memory.png](./cognitive-context/memadapter--fig2a-accuracy-with-memory.png) | [arXiv:2610.05162v1](https://arxiv.org/html/2610.05162v1#S1.F2) 原文图 2(a)（R. Ning *et al.*） | CC BY 4.0 | SVG 无头浏览器 2× 栅格化（白底，595×346 视口） |
| [memadapter--fig2b-cardiologist-case.png](./cognitive-context/memadapter--fig2b-cardiologist-case.png) | [arXiv:2610.05162v1](https://arxiv.org/html/2610.05162v1#S1.F2) 原文图 2(b)（R. Ning *et al.*） | CC BY 4.0 | 原样 |
| [memadapter--fig3-pipeline.png](./cognitive-context/memadapter--fig3-pipeline.png) | [arXiv:2610.05162v1](https://arxiv.org/html/2610.05162v1#S2.F3) 原文图 3（R. Ning *et al.*） | CC BY 4.0 | 原样 |

### agent-harness · Harness 到 Harness² 精读（[179](../../research/agent-harness/179-harness-to-harness2.md)）

抓取基准为 arXiv:2610.14224v1 TeX 源码包（e-print，2026-10-28 下载），矢量 PDF 经 pdftoppm 200dpi 渲染 PNG（RGB 白底，无透明通道）；论文许可 CC BY 4.0。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [harness2--fig2-eight-components.png](./agent-harness/harness2--fig2-eight-components.png) | Harness² 论文 Fig.2（components.pdf） | CC BY 4.0 | 矢量 PDF 渲染 PNG |
| [harness2--fig3-ppc-pipeline.png](./agent-harness/harness2--fig3-ppc-pipeline.png) | Harness² 论文 Fig.3（harness2_main_new.pdf） | CC BY 4.0 | 矢量 PDF 渲染 PNG |
| [harness2--fig4-recursion-forms.png](./agent-harness/harness2--fig4-recursion-forms.png) | Harness² 论文 Fig.4（scaling.pdf） | CC BY 4.0 | 矢量 PDF 渲染 PNG |
| [harness2--fig9-jobbench-case.png](./agent-harness/harness2--fig9-jobbench-case.png) | Harness² 论文 Fig.9（case_jobbench.pdf） | CC BY 4.0 | 矢量 PDF 渲染 PNG |

### agent-harness · Agent4Sci 精读（[181](../../research/agent-harness/181-agent4sci-scientific-hills.md)）

抓取基准为 arXiv:2610.28763v1 HTML 版（2026-10-29 下载，字节一致双快照）；图件取 HTML 版引用的原始 PNG，fig2 超单图体积门降采样至 2600px（RGB 无透明，无内容改动）；论文许可 arXiv.org perpetual non-exclusive license（未另附开放许可，按署名学习引用处理）。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [agent4sci--fig1-hillclimb-task-gains.png](./agent-harness/agent4sci--fig1-hillclimb-task-gains.png) | Agent4Sci 论文 Fig.1（intro_hillclimb.png，1774×887） | 版权归原作者，仅作学习引用 | 原样（RGB，1046 KiB） |
| [agent4sci--fig2-evaluation-protocol.png](./agent-harness/agent4sci--fig2-evaluation-protocol.png) | Agent4Sci 论文 Fig.2（agent4sci_protocol.png，原图 7664×3284） | 版权归原作者，仅作学习引用 | 等比降采样 2600×1114（949 KiB） |
| [agent4sci--fig3-methods-word-clouds.png](./agent-harness/agent4sci--fig3-methods-word-clouds.png) | Agent4Sci 论文 Fig.3(a)（methods_word_clouds.png，2037×428） | 版权归原作者，仅作学习引用 | 原样（RGB，383 KiB） |
| [agent4sci--fig5-neurips2025-filtering-funnel.png](./agent-harness/agent4sci--fig5-neurips2025-filtering-funnel.png) | Agent4Sci 论文 Fig.5(a)（neurips2025_filtering_overview.png，3703×579） | 版权归原作者，仅作学习引用 | 原样（RGB，1023 KiB） |
