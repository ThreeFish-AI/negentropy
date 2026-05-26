# PDF → Markdown 一比一还原 · 质量迭代笔记

> 学术 PDF 端到端"一比一"还原质量迭代记录。基准文档：71 页双栏 LaTeX 学术论文。

## 1. 目标与范围

让 [`negentropy-perceives.parse_pdf_to_markdown`](../../apps/negentropy-perceives/src/negentropy/perceives/tools/pdf.py) 与 [`negentropy-ui` Document View](../../apps/negentropy-ui/app/knowledge/documents/[corpusId]/[documentId]/page.tsx) 联合，把学术 PDF（双栏、含图表、公式、代码、目录、参考文献）转换为 Markdown 后达到一比一还原 — 段落顺序、字号层级、图片尺寸、表格列对齐、公式 LaTeX、代码块、引用列表都与源 PDF 对应。

回归基线 PDF 与对照 PDF 见 [issue.md ISSUE-094](./issue.md)。

## 2. Pipeline 现状（修复后）

`parse_pdf_to_markdown` 走 9 个 Stage：preprocessing → quick_scan → layout_analysis → text_extraction → table_extraction → formula_extraction → image_extraction → code_detection → assembly → asset_bundling。

本期改动集中在 4 个文件：

| 文件 | 改动 | 修复缺陷 |
|---|---|---|
| [`pipeline/stages/pdf/quick_scan.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/quick_scan.py) | 新增 `_compute_scan_page_indices`（first/middle/last 三段采样） | 公式 Stage 被 selector 短路漏检 |
| [`pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) | 扩展 `_is_author_byline` + 新增 `_is_table_caption` `_is_toc_table_text` `_byline_to_paragraph` `_table_caption_to_paragraph` | 作者署名误判 H4、Table caption 误判 H4、TOC 表错乱 |
| [`pdf/math_formula.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pdf/math_formula.py) | `_MATH_DELIMITERS` 加 USD 货币号 negative lookahead + 禁跨行 | inline `$ ... $` 误识货币 |
| [`markdown/formatter.py`](../../apps/negentropy-perceives/src/negentropy/perceives/markdown/formatter.py) | `_typography_inner` 加 `[a-z]- [a-z]` 合并 | 跨行断字残留 |
| [`markdown/image_ref_normalizer.py`](../../apps/negentropy-perceives/src/negentropy/perceives/markdown/image_ref_normalizer.py) | 新增 Phase 3 `_append_orphan_images` | 落盘图未被 markdown 引用 |

R5 增量改动（2026-05-26，本期单文件聚焦）：

| 文件 | 改动 | 修复缺陷 |
|---|---|---|
| [`pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) | (a) `_orphan_block_formulas` → `_orphan_formulas` 共池兜底；(b) 新增 `_extract_formula_eq_number` 三模式编号识别；(c) 2.4 段 `_formula_eq_nums` 集合扩容支持 inline；(d) 新增 2.4.5 "邻接文本段编号借入"；(e) 新增 2.5 "inline 公式 promotion"（`$<core> \quad (N)$` 包裹）；(f) `\tag → \quad` KaTeX 兼容写法 | inline `$...$` 公式被 assembly 静默丢弃、等式编号借入失败致重复 plain text、KaTeX `tag works only in display equations` ParseError |

R6 增量改动（2026-05-26，layout-aware Figure 区域消费）：

| 文件 | 改动 | 修复缺陷 |
|---|---|---|
| [`pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) | (a) `special_regions` 构造扩展：消费 `input_data.layout.regions` 中 `region_type in ("figure", "picture")` 的 bbox（覆盖完整 figure 视觉框含矢量标签）；(b) 新增 `_is_figure_or_table_caption_text` + `_FIGURE_TABLE_CAPTION_RE`：`Figure N:` / `Fig. N:` / `Table N:` / `Tab N -` 等 caption 例外保留为段落；(c) `_block_overlaps_special` 命中后对 caption 例外加入 elements | PyMuPDF 把 Figure 矢量 overlay 标签（Context 1.0..4.0、Context Input、Intelligence Level、Passive Executor 等）作为独立 text block 抽出散落到图下方破坏阅读流 |

R7 增量改动（2026-05-26，layout figure region 整图渲染 + PDF pt → CSS px 比例）：

| 文件 | 改动 | 修复缺陷 |
|---|---|---|
| [`pipeline/stages/pdf/image_extraction.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/image_extraction.py) | (a) `_OVERLAP_THRESHOLD = 0.5` 改名为 `_FIGURE_CONTAINS_RASTER_THRESHOLD = 0.8` 并**反转去重方向**：从「figure 让位 raster」改为「figure 整图渲染替代被包含的 raster」；(b) `_render_figure_regions` 返回签名变为 `Tuple[List[ExtractedImage], Set[int]]`，新增 `raster_drop_indices`；(c) stage 主流程消费 `drop_indices` 剔除被替代的 raster；(d) `region_type` 接受范围从 `"figure"` 扩展到 `("figure", "picture")` | layout figure region 整图渲染分支早已存在但被"figure 让位 raster"去重逻辑屏蔽，导致 Figure 矢量绘图层信息（4 列 Context 标题 / 分类标签等）全部丢失，仅剩中间嵌入位图 |
| [`pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) | 新增 `_PDF_PT_TO_CSS_PX = 96.0 / 72.0` 常量，`_image_to_markdown` 中 bbox 宽高按 4/3 系数换算后输出，与 web 默认 96 DPI 渲染对齐 | PDF 点（72pt = 1in）直接当作 CSS 像素（96px = 1in）输出致 figure 显示宽度仅占阅读容器 ~75%（A4 全宽 595pt 显示为 595px 而非 793px） |

## 3. 量化效果（71 页学术 PDF 全本）

| 维度 | 修复前 | 修复后 | 目标 | 状态 |
|---|---|---|---|---|
| 断字残留 (`[a-z]- [a-z]`) | 218 | **0** | ≤0 | ✅ |
| 公式抽取 | `skipped:no_has_formulas` (0/0) | `mineru` 3 块 + 2 inline | >0 | ✅ |
| 误判 H4（作者署名 / Table caption） | 2 | **0** | ≤0 | ✅ |
| TOC 错乱表行 | 83 | **0** | ≤5 | ✅ |
| 图片落盘 vs markdown ref | 19 文件 / 13 ref | 14 文件 / 13 ref + orphan fallback | 一致 | ✅ |
| 切片前 5 页耗时 | 24s | 24s | ≤30s | ✅ |
| 全本耗时 | 60s（formula 漏检） | 180–300s | ≤320s | ✅（mineru 是固有开销） |
| 既有单元测试 | 525 | 525 + 61 新 = 586 | 0 退化 | ✅ |
| **R5 inline `$...$` 公式包裹**（28 页 Context Engineering 2.0 论文） | 0 | **2**（eq 3 + eq 4） | ≥2 | ✅ |
| **R5 KaTeX 渲染**（浏览器实机） | 1 ParseError（`\tag` 不兼容 inline） | **0 ParseError**（5 display + 2 inline） | 0 | ✅ |
| **R5 等式编号借入**（eq 6 重复 plain text 剔除） | 存在 | **消失** | 0 | ✅ |
| **R5 新增单元测试** | — | 29 新 = 1567 | 0 退化 | ✅ |
| **R6 Figure 矢量 overlay 标签抑制**（28 页 Context Engineering 2.0） | 7+ 散落标签段 | **0**（caption 例外保留） | 0 | ✅ |
| **R6 char_count**（同文档） | 113917 | **113806**（-111，等于被抑制标签合计长度） | 与 R4 整体 -13.3% | ✅ |
| **R6 新增单元测试** | — | 10 新 = 1577 | 0 退化 | ✅ |
| **R7 Figure layout region 整图渲染**（28 页 Context Engineering 2.0） | 仅嵌入位图（机器人）| **完整演进图**（含 4 列 Context 标题 + 分类标签 + caption） | 1:1 PDF 还原 | ✅ |
| **R7 PDF pt → CSS px 比例**（Figure 1 显示宽度） | 373px（容器 ~1/3）| **497px**（容器 ~50-60%，A4 全宽 figure 接近 ~793px） | 与 PDF 1:1 | ✅ |
| **R7 char_count**（同文档） | 113806 | **113108**（-698，被 figure 整图替代的孤儿 raster 引用清零） | 整体 -13.9% vs R3 | ✅ |
| **R7 新增单元测试** | — | 10 新 = 1587 | 0 退化 | ✅ |

## 4. 端到端实机验证

1. **CLI Pipeline**：通过 `.temp/pdf-parity/run.py` 调 `run_pdf_pipeline`，目标 PDF 切片 + 全本均成功；[基线 gap 报告](../../.temp/pdf-parity/baseline-findings.md)。
2. **UI Ingest**：accra-v1 起独立 perceives MCP（port 2993），临时切 Corpus extractor route，通过 backend `POST .../refresh_markdown` 重提取，UI Document View 实机渲染验证。
3. **截图对照**：浏览器双 tab（左 PDF Viewer / 右 Markdown View）抽样：
   - `B3-pdf-p1.png` vs `B3-md-view-p1.png` — 封面、标题、作者署名、Abstract；
   - `B3-md-fig1-area.png` — Figure 1 完整大尺寸渲染 + Caption 在下方，Contents 标题保留无错乱表；
   - `B3-md-section3.png` — Figure 5 渲染 + Section 2.6 标题与段落；
   - `B3-md-tables.png` — Section 3.5 Summary + H2 标题切换；
   - `B3-md-deep.png` — References 列表全部为段落（无误判 H4）。
4. **图片显示尺寸**：13 张图片，5 张 raster（原图 2430-6926px）按视口自适应缩到 958px，8 张 vector（原图 743-981px）几乎原尺寸（width 属性透传 + `[&_img]:h-auto`）。

## 5. 测试与 golden

- **5 个新单测套件 + 1 个集成测试套件**：
  - [`tests/unit/test_formatter_hyphenation.py`](../../apps/negentropy-perceives/tests/unit/test_formatter_hyphenation.py)（7）
  - [`tests/unit/test_formatter_math_protection.py`](../../apps/negentropy-perceives/tests/unit/test_formatter_math_protection.py)（扩展 +2，共 10）
  - [`tests/unit/test_quick_scan_sampling.py`](../../apps/negentropy-perceives/tests/unit/test_quick_scan_sampling.py)（6）
  - [`tests/unit/test_assembly_byline_filter.py`](../../apps/negentropy-perceives/tests/unit/test_assembly_byline_filter.py)（17）
  - [`tests/unit/test_assembly_toc_filter.py`](../../apps/negentropy-perceives/tests/unit/test_assembly_toc_filter.py)（6）
  - [`tests/unit/test_image_ref_normalizer.py`](../../apps/negentropy-perceives/tests/unit/test_image_ref_normalizer.py)（扩展 +5，共 27）
  - [`tests/integration/test_pdf_harness_engineering_parity.py`](../../apps/negentropy-perceives/tests/integration/test_pdf_harness_engineering_parity.py)（7 集成）
- **Golden 特征签名**：[`tests/fixtures/pdf/harness-engineering/expected_signature.json`](../../apps/negentropy-perceives/tests/fixtures/pdf/harness-engineering/expected_signature.json)（计数 + 容差 + must_contain/must_not_contain 子串）。

## 6. 已知边界 / 后续工作

- 学术 PDF 的 mineru 公式提取是性能主瓶颈（200s+，28 页 Context Engineering 2.0 实测 600s 超时降级 docling），无法在保留公式质量的前提下显著降低；R5 通过 assembly 末段 markdown 层 inline promotion 把"短文本型公式"恢复为 KaTeX 可渲染形态，绕过对 `formula_extraction` stage 的强依赖；
- TOC 表识别用启发式（点 leader + 章节编号 + 页码列），极少数 PDF 的非常规 TOC 可能漏识别（fallback：仍输出 docling 提取的原 TOC 表，不影响整体阅读）；
- 双栏全宽元素的 y 分层（assembly 双栏检测后的二阶排序）本期未启用 — 当前算法 `column → y0 → x0` 五级稳定排序在该 PDF 上已无可察的段落交错，未触发重写动力；
- ~~inline `$...$` 公式包裹缺失~~ — **R5 已修复**（assembly 2.5 段 promotion + 2.4.5 段编号借入 + KaTeX `\quad` 语法兼容）；
- ~~Figure 矢量 overlay 标签散落~~ — **R6 已修复**（assembly `special_regions` 消费 layout `figure` region + caption 例外保留）；
- ~~PDF 矢量绘图层的 figure 内部分类标签丢失~~ — **R7 已修复**（image_extraction 反转去重方向，layout figure region 整图渲染替代散落的嵌入位图，完整保留 PDF 原版视觉信息）；
- ~~Figure 显示宽度仅占容器 ~75%~~ — **R7 已修复**（assembly `_image_to_markdown` 应用 PDF pt → CSS px 4/3 比例换算，与 web 96 DPI 渲染对齐）；
- **R5 浮现但不在本期范围**的小 gap（见 `.context/r5-defects.md`）：References `[2]` 跳号（根因在 PDF 抽取上游，R4 与 R5 均存在）；文档末尾孤儿图块视觉占满（R3 设计的兜底，避免图片丢失）；PDF 元数据残留 `§ Github` / `SII Context`（layout-aware 识别难度高）。

## 7. 端到端验证 Runbook

```bash
# 1. accra-v1 启 perceives MCP
NEGENTROPY_PERCEIVES_HTTP_PORT=2993 \
  uv run negentropy-perceives  # 后台

# 2. 切 Corpus extractor route 到新 MCP（DB SQL）
psql -d negentropy -c "
  UPDATE negentropy.mcp_servers SET url='http://localhost:2993/mcp'
  WHERE id='8027a003-879c-4699-b19e-24de9929f842';
"

# 3. UI 触发 ingest（或 backend curl）
curl -X POST "http://localhost:3292/knowledge/base/{corpus}/documents/{doc}/refresh_markdown" \
  -H "Content-Type: application/json" -d '{"app_name":"negentropy"}'

# 4. 轮询直到 markdown_extract_status=completed
# 5. 浏览器（chrome_devtools）打开 Document View 截图对照 PDF

# 验证完恢复：UPDATE ... SET url='http://localhost:2992/mcp' WHERE id=...
```
