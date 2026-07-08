---
name: pdf-fidelity-restore
description: 用 negentropy-perceives 的 parse_pdf_to_markdown 经 Knowledge Base Documents Ingest 将 PDF 一比一还原为可渲染 Markdown（文字、段落顺序、高清原图、图片显示尺寸、目录、表格、数学公式、代码块、注释），大文件分批，逐页浏览器对比、发现一处修一处，直至完全一致。Use when ingesting/restoring a PDF into a Knowledge corpus with high fidelity.
allowed-tools: data-extractor, negentropy-perceives, playwright, filesystem, zai-mcp-server, Read, Grep, Glob
---

# PDF 高保真还原 (PDF Fidelity Restore)

> SSOT：本文件与 `apps/negentropy/src/negentropy/agents/skill_templates/pdf_fidelity_restore.yaml` 同源
> （文件技能供 Routine 的 Claude Code 发现，DB 技能供一核五翼）。两处正文骨架须保持一致。

你是「PDF 高保真还原」专家。目标：把 PDF **一比一**还原为可在 Knowledge / Documents 页正确渲染的
Markdown，并通过浏览器逐页对比将差异修复至完全一致。

## 输入

- `pdf_source`：本地绝对路径或 http(s) URL
- `corpus_name`：目标 Corpus（默认 `Harness Engineering`）
- `method`：perceives 引擎（`auto` / `smart` / `docling` / `mineru` / `marker` / `pymupdf` / `pypdf`）
- 分批：`batch_page_size`（默认 40）、`batch_threshold_pages`（默认 60）

## 一比一还原范围（缺一不可）

文字、段落顺序、高清原图、**图片显示尺寸**、目录(TOC/锚点)、表格、数学公式(LaTeX/KaTeX)、
代码块(语言与高亮)、脚注/注释。

## 流程（自驱闭环）

1. **基准**：用用户常用浏览器（真实登录态）打开源 PDF（`file://` 或 URL）作为对照基线；不得绕过/模拟任何登录。
2. **路由就绪**：确认目标 Corpus 的 `config.extractor_routes` 已把 `source_kind=pdf` 路由到
   `negentropy-perceives.parse_pdf_to_markdown`，`tool_options` 开启 `extract_images/tables/formulas`，
   并设 `auto_batch=true` 与合适的 `batch_page_size`。
3. **分批摄取**：经 Documents Ingest 上传 PDF。大文件依赖 perceives 的 `auto_batch`
   （总页数 > `batch_threshold_pages` 时自动切片，`resume` 断点续传），确保**整本**最终合并为单一 Markdown 文档。
4. **等待完成**：轮询文档 `markdown_extract_status` 至 `completed`（失败则查 `markdown_extract_error` 并 `refresh_markdown` 重试）。
5. **渲染核对**：在 Documents 页 View 渲染结果（react-markdown + remark-gfm/math + rehype-katex/raw/highlight/sanitize）。
6. **逐页对比**：按上「一比一还原范围」逐页 / 逐模块比对源 PDF 与渲染 Markdown，逐条记录差异（页号 + 类别 + 现象）。
7. **发现一处修一处（三杠杆分层修复路由 + 归因）**：每个缺陷先走「双源验证决策树」归因到杠杆/层，再定点改（单轮一个逻辑根因，≤3 文件 ≤2 杠杆）：
   - **①工程代码·管线层**：perceives 引擎选型、分批边界、跨片合并（图片去重、边界图注补救）、图片分辨率与显示尺寸提取（`pipeline/stages/pdf/*`、`engine_selector.py`、`ops/pdf.py`）。
   - **①工程代码·摄取层**：图片链接重写、资产存储、元数据（`knowledge/ingestion/extraction.py`、`knowledge/_shared.py`）。
   - **①工程代码·导出层**：wiki 发布资产 bake / 链接重写（`knowledge/lifecycle/wiki_export_service.py`）。
   - **①工程代码·渲染层 wiki**：`MarkdownRenderer.tsx` / `ZoomableImage` / `ResponsiveTable` / `CodeBlock` / sanitize schema（图片宽高、表格、KaTeX、代码高亮、TOC 锚点）。
   - **①工程代码·渲染层 ui**：`DocumentMarkdownRenderer.tsx` / `DocumentImage` figcaption / `parsePixelValue` / `documentSanitizeSchema`（注意 wiki 与 ui 的 sanitize `style` 放行 / figcaption 行为不对称）。
   - **②Skills 本体**：本 Skill 的规则集——发现的跨 doc 结构性 insight 回写此处（如「图注双源铁律」），升级归因路由表。
   - **③流程自身**：巡检/还原流程的采样、评分、归因编排（慎改，影响面大）。
   - **双源验证决策树（归因前必走，防误归到 perceives）**：Step A 缺陷在候选 Markdown 源码里？是→管线/摄取；否→渲染层或流程伪缺陷。Step B 图片链接形式判摄取/导出。Step C wiki 错还是 ui 错→render_wiki/render_ui；皆对仅旧模拟栈错→流程伪缺陷（不计分）。
   - **热更铁律（改 perceives `src/` 后必做，否则改动不生效）**：① 重启 perceives MCP 进程（Python 无热重载）；② 清 checkpoint `rm -rf <output_dir>/output/.batch_state/*`（auto_batch resume 按 PDF 内容 SHA-1 缓存切片，不清则复用旧切片、跳过新代码，且完成异常快）。
   改后经 `refresh_markdown(resume=false)` 重摄取（**清 checkpoint 全量重跑**）或重载页面，复核该项。
8. **循环**：重复 6–7，直到逐页校验清单全绿；保留关键页源 PDF vs 渲染 Markdown 对比截图为证。

## 逐页校验清单

- [ ] 文字内容与段落顺序一致
- [ ] 高清原图齐全且清晰
- [ ] 图片显示尺寸（宽/高）还原
- [ ] 目录 / 章节锚点可跳转
- [ ] 表格结构与对齐正确
- [ ] 数学公式 KaTeX 渲染正确
- [ ] 代码块语言识别与高亮正确
- [ ] 脚注 / 注释完整

## 关键洞察（R10 / 三杠杆改造 沉淀）

- **auto_batch 切片间无共享可变状态**：引擎实例在 pool 复用时产物落盘目录须 per-call 唯一（`tempfile.mkdtemp`）；级联/册封类状态（如 `_first_h1_seen`）须显式接收 `slice_index`，否则跨切片泄漏（标题层级错乱 / 公式重现）。
- **1:1 验收必须走到浏览器渲染态**：figure 过度捕获、KaTeX ParseError、公式双份等缺陷在 DB markdown 层不可见，仅浏览器渲染后暴露。
- **figure 图注双源风险**：多数图注已烘入 figure region PNG 像素，故 wiki/ui **不得**再从 `alt` 渲染 `figcaption`（会双图注）；caption 语义由 `alt` 承载（无障碍 + 去重指纹），视觉由图内像素承载。
- **三套渲染栈系统性差异**：旧 `_fidelity_render`（Python-Markdown 近似）/ wiki（react-markdown + remark/rehype）/ ui（另一套 react-markdown + sanitize）三栈不同——公式/Mermaid/figure/figcaption/图片尺寸/代码高亮会假阳性/假阴性。对照须用**真实 wiki 渲染栈**（巡检经 `patrol_wiki_env` 起 `next dev` 真页截图，非模拟渲染）。
- **全绿率评分口径**：`score = round(pass_pages/total_pages×100)`（逐页校验清单全绿率），替代主观「100-Σ扣分」——CC 自评与 Judge 复核锁同一份程序化预筛 + defects，根治 ±20 振荡（ISSUE-128）。
- **双源验证防误归因**：渲染层缺陷（候选 MD 正确、渲染器渲染错）会被误归到 perceives；归因前必走「候选 MD 源码层 vs 渲染层」双源决策树（见步骤 7）。

## 反模式（严禁）

- 跳过逐页核对即声明完成；
- 只比文字而忽略图 / 表 / 公式 / 代码 / 注释；
- 图片不还原原始显示尺寸（宽高）。

## 完成判据

逐页校验清单全绿 + 关键页对比截图留证 + 整本 PDF 在 Documents 页可读性与一致性达最佳。

## 资源 / 基线示例（R10）

- 基线 PDF：`Self-Improving Agents in the Era of Experience: A Survey of Self- to Meta-Evolution.pdf`（88 页 / A4 双栏 LaTeX；corpus「Harness Engineering」）。
- 基线 wiki 渲染对照：`http://localhost:3092/wiki/harness-engineering/paper/self-improving-agents-in-the-era-of-experience-a-survey-of-self-to-meta-evolution-pdf/`
- perceives 管线源码：`apps/negentropy-perceives`（monorepo `ThreeFish-AI/negentropy`，默认分支 `master`）。
- 迭代记录：`docs/.agents/pdf-harness-engineering-parity.md` §9（R10 九项修复）。
