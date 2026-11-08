# 信源原图资产库（source-figures）

> 精读笔记引用的**信源原图**本地副本：代码仓、文档站、博客、官网与论文里自带的图，原样保存或仅做格式转换后入库。
> 与 [`../architecture/`](../architecture/) 的自绘 archify 图分开存放——自绘图讲清结构，原图提供可对照的一手实证。
> 判据、入库方式与 wiki 渲染约束见 [doc-media-assets §2](../../.agents/doc-media-assets.md#2-决策表)。

## 约定

- **目录**：`<research 分组>/<主题>--src-<NN>-<slug>.png`，`NN` 与正文「信源原图 N」编号一致；论文原图沿用正文「原文图 N」的编号命名（如 `ktp--fig<N>-<slug>.png`）；正文以纯 Markdown `![]()` 相对路径嵌入。
- **只做格式转换，不改内容**：位图原样复制；SVG 以无头浏览器 2× 栅格化为 PNG（规避读者缺 CJK 字体与 wiki 主题反向）；透明底图烘成不透明底（浅字图烘暗底、深字图烘白底）；裁切须在题注注明。
- **单文件 ≤ 1280 KiB**（pre-commit `check-added-large-files` 硬门）。
- **署名与许可**：每张图的题注写明出处与许可；无开放许可者标「版权归原作者，仅作学习引用」。许可禁止再分发的材料（如 arXiv non-exclusive-distrib 1.0）默认不入库、正文改为链接；经用户明示决策入库的例外可入库，署名同上并在本 README 该篇清单注明用户授权与日期。
- **时效**：取自活体网页（无版本号的博客、SPA 官网、云产品页）的图记抓取日期；描绘已删除机制的图只作矛盾佐证，题注必须写明。

## 清单

### multimodal-models · KTP 论文精读（[240](../../research/multimodal-models/240-visual-generation-knowledge-transfer.md)）

KTP 论文图 1–7 由 TeX 源码包矢量 PDF 渲染为 PNG，2026-10-26 自 `docs/assets/papers/`（PR #1211 建）迁入统一本库，文件与路径未改名（历史链接按 git 追溯）。抓取基准为 arXiv:2610.21459v1 TeX 源码包，逐图署名与读数核验见 [240 正文](../../research/multimodal-models/240-visual-generation-knowledge-transfer.md)。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [ktp--fig1-overview.png](./multimodal-models/ktp--fig1-overview.png) ~ [fig7](./multimodal-models/ktp--fig7-sensenova-visual-cot-case.png) | KTP TeX 源码包 Fig.1–7 | 版权归原作者，仅作学习引用 | 矢量 PDF 渲染 PNG，单图 ≤ 1 MiB |


### multimodal-models · Omnimodal Embeddings 综述精读（[253](../../research/multimodal-models/253-omnimodal-embeddings-survey.md)）

arXiv:2611.00172v1 HTML 版四张外链 SVG（研究全景、收敛四义、四种共享方式、四时代阶梯）经无头 Chrome 按 viewBox 等比渲染为 PNG（fig3 以 3× 采样保证可读，其余 1.5×），仅格式转换不改内容；逐图署名见 [253 正文](../../research/multimodal-models/253-omnimodal-embeddings-survey.md)。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [oe--fig1-research-map.png](./multimodal-models/oe--fig1-research-map.png) | arXiv 2611.00172v1 Fig.1 | 版权归原作者，arXiv 非独占分发许可 | SVG→PNG 1.5×，435 KiB |
| [oe--fig3-convergence-four-meanings.png](./multimodal-models/oe--fig3-convergence-four-meanings.png) | arXiv 2611.00172v1 Fig.3 | 同上 | SVG→PNG 3×，92 KiB |
| [oe--fig5-sharing-work.png](./multimodal-models/oe--fig5-sharing-work.png) | arXiv 2611.00172v1 Fig.5 | 同上 | SVG→PNG 1.5×，264 KiB |
| [oe--fig6-omnimodal-paths.png](./multimodal-models/oe--fig6-omnimodal-paths.png) | arXiv 2611.00172v1 Fig.6 | 同上 | SVG→PNG 1.5×，786 KiB |

### agent-harness · Agent-Reflex 精读（[252](../../research/agent-harness/252-agent-reflex.md)）

抓取基准为 [arXiv:2610.17953v1](https://arxiv.org/abs/2610.17953) e-print 源码包（2026-11-06 下载解包，只取图件不构建）；四图由矢量 PDF 经 pdftoppm 200dpi 渲染（RGB 无透明底，无内容改动，单图 ≤ 1280 KiB）。论文许可为 arXiv non-exclusive-distrib 1.0（摘要页标注，许可 SSOT；HTML 全文页脚「perpetual non-exclusive」为页面样板行，以摘要页为准）——属本 README「默认不入库」类，**经用户 2026-11-06 明示决策入库**（例外通道见上方约定），署名「版权归原作者，仅作学习引用」；Figure 2 与笔记自制三阶段管线图同构、未入库（正文提及并链接 [原文图 2](https://arxiv.org/html/2610.17953v1/figure2_final.png)）。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [agent-reflex--fig1-motivation.png](./agent-harness/agent-reflex--fig1-motivation.png) | Figure 1（fig1_motivation_compact.pdf，3242×1440） | 版权归原作者，仅作学习引用（non-exclusive-distrib 1.0，用户授权 2026-11-06） | 矢量 PDF 渲染 PNG（557 KiB） |
| [agent-reflex--fig3-orpo.png](./agent-harness/agent-reflex--fig3-orpo.png) | Figure 3（Figure3_new.pdf，3623×1481） | 同上 | 矢量 PDF 渲染 PNG（676 KiB） |
| [agent-reflex--fig4-algorithm-comparison.png](./agent-harness/agent-reflex--fig4-algorithm-comparison.png) | Figure 4（Agent-Reflex_algorithm_comparison_vector.pdf，1976×668） | 同上 | 矢量 PDF 渲染 PNG（208 KiB） |
| [agent-reflex--fig5-noise-radar.png](./agent-harness/agent-reflex--fig5-noise-radar.png) | Figure 5（Agent-Reflex_noise_radar_vector.pdf，2070×1004） | 同上 | 矢量 PDF 渲染 PNG（251 KiB） |

### physical-ai · Physical AI monograph 精读（[251](../../research/physical-ai/251-physical-ai-monograph.md)）

arXiv HTML 版（2610.27045v1）自带 PNG 原图，2026-11-05 curl 取自 `https://arxiv.org/html/2610.27045v1/<file>`；摘要页标注 **CC BY 4.0**（开放许可，署名可转载）。全部 RGB 无透明底、未做内容改动、单图 ≤ 1280 KiB。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [pai--fig1-1-scope-expansion.png](./physical-ai/pai--fig1-1-scope-expansion.png) | Figure 1.1（1-1.png，1791×534） | CC BY 4.0 | 原样入库（991 KiB） |
| [pai--fig1-5-application-landscape.png](./physical-ai/pai--fig1-5-application-landscape.png) | Figure 1.5（1-4.png，1002×747） | CC BY 4.0 | 原样入库（158 KiB） |
| [pai--fig4-2-data-pyramid.png](./physical-ai/pai--fig4-2-data-pyramid.png) | Figure 4.2（4-2.png，1251×632） | CC BY 4.0 | 原样入库（232 KiB） |
| [pai--fig5-3-training-panorama.png](./physical-ai/pai--fig5-3-training-panorama.png) | Figure 5.3（5-3.png，1252×543） | CC BY 4.0 | 原样入库（148 KiB） |

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

### self-evolution · Trustworthy RSI 精读（[145](../../research/self-evolution/145-trustworthy-rsi.md)）

抓取基准为 [arXiv:2610.35193v1](https://arxiv.org/html/2610.35193v1) HTML 版（2026-10-30 curl 快照，与 abs 页元数据双核验；webReader 首取文本与快照不一致判为幽灵全文，一切以 curl 快照为准）；图件取 HTML 版引用的原始 PNG，fig10 超单图体积门等比降采样（无内容改动）；论文许可 arXiv.org perpetual non-exclusive license（未另附开放许可，按署名学习引用处理）。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [trustworthy-rsi--fig1-overview.png](./self-evolution/trustworthy-rsi--fig1-overview.png) | 论文 Fig.1（main_figure.png，1600×900） | 版权归原作者，仅作学习引用 | 原样（526 KiB） |
| [trustworthy-rsi--fig3-rsi-process.png](./self-evolution/trustworthy-rsi--fig3-rsi-process.png) | 论文 Fig.3（RSI_process.png，1737×1070） | 版权归原作者，仅作学习引用 | 原样（472 KiB） |
| [trustworthy-rsi--fig4-theme1-risks-safeguards.png](./self-evolution/trustworthy-rsi--fig4-theme1-risks-safeguards.png) | 论文 Fig.4（chap3_figure.png，1737×1070） | 版权归原作者，仅作学习引用 | 原样（616 KiB） |
| [trustworthy-rsi--fig9-three-level-comparison.png](./self-evolution/trustworthy-rsi--fig9-three-level-comparison.png) | 论文 Fig.9（chap7.2_figure.png，2029×739） | 版权归原作者，仅作学习引用 | 原样（576 KiB） |
| [trustworthy-rsi--fig10-application-settings.png](./self-evolution/trustworthy-rsi--fig10-application-settings.png) | 论文 Fig.10（assets/chap8_figure.png，原图 1667×766） | 版权归原作者，仅作学习引用 | 等比降采样 1440px（1195 KiB） |

### cognitive-context · PowerContext 精读（[016](../../research/cognitive-context/016-powercontext-context-runtime.md)）

抓取基准为 [oceanbase/powercontext](https://github.com/oceanbase/powercontext) master `5032075ad`（2026-11-01 curl 快照，v1.4.1；仓库许可 Apache-2.0）；4 张官方 SVG 图以 Chrome headless `--headless=new` 2× 栅格化（按各自 viewBox 定尺寸，仅格式转换）、5 张博客 PNG 等比降采样至 1400px（原图 ~1.5 MiB 超单图体积门，无内容改动）。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [powercontext--src-01-context-formation.png](./cognitive-context/powercontext--src-01-context-formation.png) | 官网文档图「一个 Scope 内的两类制品形成路径」（website/public/docs-diagrams/context-formation-zh.svg，900×490） | Apache-2.0 | SVG 无头浏览器 2× 栅格化（1800×980） |
| [powercontext--src-02-context-deployment.png](./cognitive-context/powercontext--src-02-context-deployment.png) | 官网文档图「各组件运行在哪里」（website/public/docs-diagrams/context-deployment-zh.svg，900×490） | Apache-2.0 | SVG 无头浏览器 2× 栅格化（1800×980） |
| [powercontext--src-03-workflow-handoff.png](./cognitive-context/powercontext--src-03-workflow-handoff.png) | README 工作流图「你和 Agent 交接工作」（docs/assets/readme-workflow.svg，1080×360，暗色主题） | Apache-2.0 | SVG 无头浏览器 2× 栅格化（2160×720） |
| [powercontext--src-04-benchmark-summary.png](./cognitive-context/powercontext--src-04-benchmark-summary.png) | README 基准对比图「LoCoMo 与 SWE-bench Pro 紧凑对比」（docs/assets/readme-benchmark-summary.svg，960×272，暗色主题） | Apache-2.0 | SVG 无头浏览器 2× 栅格化（1920×544） |
| [powercontext--src-05-blog-multimodal-chain.png](./cognitive-context/powercontext--src-05-blog-multimodal-chain.png) | 官方博客《构建持久的项目上下文》图 1「从多模态输入到验证结果」（docs/assets/blog/building-durable-project-context/figure-1.png，1668×943） | Apache-2.0 | 等比降采样 1400px（1155 KiB） |
| [powercontext--src-06-blog-source-linked-index.png](./cognitive-context/powercontext--src-06-blog-source-linked-index.png) | 同博客图 2「索引始终关联原始材料」（figure-2.png） | Apache-2.0 | 等比降采样 1400px（1112 KiB） |
| [powercontext--src-07-blog-seekdb-multi-path.png](./cognitive-context/powercontext--src-07-blog-seekdb-multi-path.png) | 同博客图 3「seekdb：多路径检索证据」（figure-3.png） | Apache-2.0 | 等比降采样 1400px（1074 KiB） |
| [powercontext--src-08-blog-four-context-lifecycles.png](./cognitive-context/powercontext--src-08-blog-four-context-lifecycles.png) | 同博客图 4「四类上下文，分别管理生命周期」（figure-4.png） | Apache-2.0 | 等比降采样 1400px（1096 KiB） |
| [powercontext--src-09-blog-cross-session-handoff.png](./cognitive-context/powercontext--src-09-blog-cross-session-handoff.png) | 同博客图 6「跨会话交接，恢复时重新核对」（figure-6.png） | Apache-2.0 | 等比降采样 1400px（1084 KiB） |

### cognitive-context · Anthropic Agent 记忆精读（[254](../../research/cognitive-context/254-anthropic-agent-memory-components.md)）

抓取基准为 [Anthropic Engineering 博客《The components of agent memory》](https://www.anthropic.com/research/components-of-agent-memory)（Lance Martin，2026-11-06 发布，抓取日期 2026-11-08；图 Monika Tuchowska），图件为页面引用的 `www-cdn.anthropic.com/images/4zrzovbb/website/` 位图。页面只载「© 2026 Anthropic PBC」，无开放许可、也无禁止转载字样，署名「© 2026 Anthropic PBC，仅作学习引用」；**经用户 2026-11-08 明示指令（保留信源优质图）入库**，属本 README 的例外通道。位图原样入库，仅原文图 4 含半透明像素、烘贴边底色为不透明 RGB；单图 ≤ 1280 KiB。原文图 2、6、9、13（图 1 的箭头变体）与题图未入库，由笔记自绘图合并替代；原文图 7、12、15 正文只以文字带过。

| 文件 | 出处 | 许可 | 处理 |
| --- | --- | --- | --- |
| [amc--fig1-memory-hierarchy.png](./cognitive-context/amc--fig1-memory-hierarchy.png) | 原文图 1（3840×1754，记忆层级总图） | © 2026 Anthropic PBC，仅作学习引用（用户授权 2026-11-08） | 原样（146 KiB） |
| [amc--fig3-clbench-memory-gain.png](./cognitive-context/amc--fig3-clbench-memory-gain.png) | 原文图 3（3840×2160，CL-Bench 数据库任务六模型有无记忆） | 同上 | 原样（454 KiB） |
| [amc--fig4-pokemon-memory-dirs.png](./cognitive-context/amc--fig4-pokemon-memory-dirs.png) | 原文图 4（3840×2545，两个记忆目录同比例对比） | 同上 | 半透明像素烘贴边底色为 RGB（214 KiB） |
| [amc--fig5-steering.png](./cognitive-context/amc--fig5-steering.png) | 原文图 5（3840×2310，steering 两面） | 同上 | 原样（203 KiB） |
| [amc--fig8-cerulean-progress.png](./cognitive-context/amc--fig8-cerulean-progress.png) | 原文图 8（3840×2636，抵达 Cerulean 进度） | 同上 | 原样（350 KiB） |
| [amc--fig10-wiki-scaling.png](./cognitive-context/amc--fig10-wiki-scaling.png) | 原文图 10（3136×1432，wiki 随会话增长） | 同上 | 原样（1112 KiB） |
| [amc--fig11-wiki-benefit-by-task.png](./cognitive-context/amc--fig11-wiki-benefit-by-task.png) | 原文图 11（3840×3694，wiki 收益大与小的任务） | 同上 | 原样（1178 KiB） |
| [amc--fig14-shared-page-collision.png](./cognitive-context/amc--fig14-shared-page-collision.png) | 原文图 14（3840×1822，共享页覆盖与一合同一页） | 同上 | 原样（219 KiB） |
