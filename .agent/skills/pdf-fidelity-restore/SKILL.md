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
7. **发现一处修一处（分层修复路由）**：
   - **渲染层**：`DocumentMarkdownRenderer` / sanitize schema / `DocumentImage`（图片宽高、表格、KaTeX、代码高亮、figure/figcaption、TOC 锚点）。
   - **摄取层**：图片链接重写、资产存储、元数据（`knowledge/ingestion/extraction.py`、`knowledge/_shared.py`）。
   - **管线层**：perceives 引擎选型、分批边界、跨片合并（图片去重、边界图注补救）、图片分辨率与显示尺寸提取（`perceives/ops/pdf.py`）。
   改后经 `refresh_markdown` 重摄取或重载页面，复核该项。
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

## 反模式（严禁）

- 跳过逐页核对即声明完成；
- 只比文字而忽略图 / 表 / 公式 / 代码 / 注释；
- 图片不还原原始显示尺寸（宽高）。

## 完成判据

逐页校验清单全绿 + 关键页对比截图留证 + 整本 PDF 在 Documents 页可读性与一致性达最佳。
