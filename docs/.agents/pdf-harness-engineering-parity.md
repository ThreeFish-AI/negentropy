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

R8 增量改动（2026-05-26，Docling 公式 bbox 透传 + 残片清理）：

| 文件 | 改动 | 修复缺陷 |
|---|---|---|
| [`pdf/engines/docling.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pdf/engines/docling.py) | (a) `DoclingFormula` 加 `bbox` 字段；(b) `_extract_formulas` 优先 `doc.iterate_items()` 拿 `label='formula'` 的 item，从 `prov[0].bbox` 提取 TopLeft 坐标系 bbox，剥离 `$$...$$` / `$...$` 包裹，同 latex 去重；(c) iterate_items 不可用 / 空时降级 markdown 正则匹配（保持向后兼容）| Docling 公式适配器历史实现仅从 markdown 文本 regex 抽公式（无 bbox），assembly 五级排序键 y0 维度退化致 Section 2.1 Eq(1) Eq(2) 顺序倒置 |
| [`pipeline/stages/pdf/formula_extraction.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/formula_extraction.py) | `DoclingFormulaExtractor._run` 透传 `bbox` 字段到 `ExtractedFormula`，与 mineru 适配器契约对齐 | docling stage 与 mineru stage 元信息透传不一致 |
| [`pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) | 新增 2.5.5 段公式残片清理：`_FORMULA_FRAGMENT_RE = re.compile(r"^\s*[A-Za-z]\w*\s*=\s*[\[\(\{]\s*$")` 匹配「Identifier = Open-Bracket」短公式残片（≤ 15 字符），紧邻下一个 element 是公式时剔除 | PyMuPDF 在长公式视觉区抽出 `C = [` / `M_l = \{` 等残片绕过 `_formula_text_signature` ≥ 20 字符最小阈值兜底，与公式主体并存 |

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
| **R8 Section 2.1 公式顺序**（28 页 Context Engineering 2.0） | Eq(1) Eq(2) 顺序倒置 | **按视觉顺序**（Definition 1 → Eq(1) → ... → Eq(2)） | 与 PDF 1:1 | ✅ |
| **R8 PyMuPDF 公式残片** | `C = [` 单独成段 | **消失**（2.5.5 段剔除） | 0 残片 | ✅ |
| **R8 Definition 1 段落保留** | 被 R7 误删 | **完整保留**（docling bbox 透传后五级排序正确） | 与 PDF 1:1 | ✅ |
| **R8 char_count**（同文档） | 113108 | **114815**（+1707，恢复 Definition 1 + Eq 5/6/7 latex 主体） | 与 R3 baseline -12.6% | ✅ |
| **R8 新增单元测试** | — | 17 新 = 1604 | 0 退化 | ✅ |

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
- ~~Section 2.1 Eq(1) Eq(2) 顺序倒置~~ — **R8 已修复**（docling 公式适配器透传 bbox + assembly 五级排序的 y0 维度生效）；
- ~~PyMuPDF 公式视觉区残片 `C = [` / `M_l = \{`~~ — **R8 已修复**（assembly 2.5.5 段 `_FORMULA_FRAGMENT_RE` 残片清理）；
- **R8 已知限制**：docling 公式 latex 在 `iterate_items` 路径下输出原始字符流（如 `CE: (C, T) → f_context`）不带 `\tag{N}` 或 `\quad (N)` 编号，markdown view 中 Eq(3) Eq(4) 等的编号缺失。R5 的 inline promotion 因 docling 公式已被识别为公式元素（非 text element）不再处理。可未来在 docling 公式后置阶段从 markdown 上下文回填 `\quad (N)` 编号。
- **R5 浮现但不在本期范围**的小 gap（见 `.context/r5-defects.md`）：References `[2]` 跳号（根因在 PDF 抽取上游，R4 与 R5 均存在）；文档末尾孤儿图块视觉占满（R3 设计的兜底，避免图片丢失）；PDF 元数据残留 `§ Github` / `SII Context`（layout-aware 识别难度高）。

## 7. R9 增量：大型教材 PDF（Agentic Design Patterns，482 页 / 19.9 MB）

### 7.1 引发背景

R5-R8 修复都基于 28-71 页学术论文样本，R9 选取 *Agentic Design Patterns* 教材
（19.9 MB / 482 页 / 含大量 Python 代码示例 / 单栏排版 / Bullet list 体）作为
全新维度的回归基线，暴露三类新失真模式与一项核心基础设施缺失。

### 7.2 R9 基础设施：auto_batch + checkpoint/resume

R8 之前的 MCP 工具 `parse_pdf_to_markdown` 单次只能处理一份 PDF 全本，
backend HTTP 调用 15 min 超时窗口对 482 页教材完全不够（实测全本耗时 ~30 min）。
R9 新增两条链路（commit [`530ee730`](#) + [`cb0d1000`](#)）：

| 模块 | 改动 | 设计要点 |
|---|---|---|
| [`tools/pdf.py`](../../apps/negentropy-perceives/src/negentropy/perceives/tools/pdf.py) | MCP 工具签名加 `auto_batch` / `batch_page_size` / `batch_threshold_pages` / `resume` 四参数 | 对调用方透明（默认全启），既有调用站点零改动 |
| [`ops/pdf.py`](../../apps/negentropy-perceives/src/negentropy/perceives/ops/pdf.py) | `_run_batched_pipeline` 分批串行调度 + 单切片重试 1 次 + `error_partial` 标记 | 保留原单次路径作为默认回退；超阈值（默认 60 页）才启用 |
| [`pipeline/batch_merge.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/batch_merge.py) **新增 555 行** | `split_page_ranges` / `dedupe_image_assets` / `rewrite_image_refs_in_markdown` / `boundary_figure_caption_rescue` / `merge_slice_markdowns` | 跨切片资产 `(filename, sha256)` 双键去重 + 同名异内容重命名 `b{i}_{原名}` + boundary marker HTML 注释 |
| `ops/pdf.py` checkpoint | 切片完成立即落 `<output_dir>/.batch_state/{sha1[:12]}/slice_{i}.{json,markdown.txt}` | **基于 PDF 内容 SHA-1 keyed 目录**（不用文件名 stem），跨调用 resume 真正工作 |
| [`DocumentDetailPage`](../../apps/negentropy-ui/app/knowledge/documents/[corpusId]/[documentId]/page.tsx) + [`PipelineRunDetailPanel`](../../apps/negentropy-ui/features/knowledge/components/PipelineRunDetailPanel.tsx) | 失败 / partial 状态下按钮文案动态切换为 "Continue (resume)"，Pipelines Runs 详情面板增加 "Continue →" 跳转链接 | refresh_markdown 接口天然幂等，按钮调用同端点即触发 perceives auto_batch 的 resume 路径 |

**实测效果**：482 页 PDF 切 13 batch × 40 页串行；首次跑 + 3 次中途崩溃 + 4
次 Continue resume 累计 25 min 完成；commit `cb0d1000` 后（perceives 启动改
用 Python `subprocess.start_new_session` 与 shell wrapper 解耦）连续 14 min 单
次跑完全本 13 batch 无 SIGTERM 抢占。

### 7.3 R9 三类失真修复（commit [`c1733bb8`](#)）

| 失真 | 责任 stage | 修复手段 | 单测 |
|---|---|---|---|
| **D1: 代码块 lang 标记错位** | `assembly._code_block_to_markdown` | 识别 code 首行单一 lang 关键词（python/javascript/bash/...）并提升为 fence info string，剔除 body 首行；同义词归一（js → javascript、c++ → cpp） | [`test_assembly_code_lang_header.py`](../../apps/negentropy-perceives/tests/unit/test_assembly_code_lang_header.py)（12） |
| **D2: Unicode bullet 残留**（●​ U+25CF + ZWJ） | `markdown.formatter._normalize_unicode_bullets` | `_format_lists` 前置归一化 ●○■□▪▫◦▶▷›▸▹·•‣ + ZWJ → markdown `- ` | [`test_formatter_unicode_bullets.py`](../../apps/negentropy-perceives/tests/unit/test_formatter_unicode_bullets.py)（13） |
| **D3: 图片像素尺寸退化**（全部 `width="100%"`） | `assembly._image_to_markdown` | 取消 R9 D-7 引入的 `is_large_figure → width="100%"` 分支，回到 R7 设计：始终输出 PDF pt × 4/3 CSS px + `style="max-width:100%;height:auto"` 兜底窄屏 | [`test_assembly_image_pixel_size.py`](../../apps/negentropy-perceives/tests/unit/test_assembly_image_pixel_size.py)（7）+ 更新 [`test_assembly_helpers.py`](../../apps/negentropy-perceives/tests/unit/test_assembly_helpers.py)（2 stale 断言） |

### 7.4 R9 量化签名（[`r9-signature.json`](../../.temp/r9-signature.json)）

| 维度 | R9 D-7 旧实现 | R9 D1+D2+D3 修复后 | 变化 |
|---|---|---|---|
| `char_count` | 803722 | 804513 | +791 (合理增量) |
| `word_count` | 111326 | 111400 | +74 |
| `h1_count` / `h2_count` / `h3_count` | 23 / 170 / 33 | 23 / 170 / 33 | 一致 ✅ |
| `md_img_count` + `html_img_count` | 32 + 61 = 93 | 32 + 61 = 93 | 一致 ✅ |
| `fenced_code_count` (开/闭) | 78 (39 个块) | 78 (39 个块) | 一致；**但 lang fence 49/78 而非全空** |
| `hyphenation_residue` | 0 | 0 | ✅ |
| `batch_boundary_count` | 12 | 12 | ✅（13 切片 / 12 marker） |
| `must_contain_pass` | true | true | ✅ |
| `h_misclassified_byline` | 0 | 0 | ✅（R5 修复保持） |
| **`list_bullet_residue`** | **877** | **672** | **-205**（行首 bullet 全部归一；剩余 672 在段落中部） |

### 7.5 浏览器双 tab 实机对照（chrome_devtools，13 张截图）

落盘到 [`docs/.agents/screenshots/agentic-design-patterns/`](./screenshots/agentic-design-patterns/)：

| T# | 抽样位置 | 修复前 | 修复后 | 状态 |
|---|---|---|---|---|
| T1 | 封面 | `T1-cover-md.png` (TOC 挤一段) | `T1-cover-md-v2.png` | ⚠️ 待 D4 |
| T1 | PDF 对照 | `T1-cover-pdf.png` |  | 参照 |
| T3 | Chapter 1 起首 | `T3-chapter1-md.png` | `T3-chapter1-md-v2.png` | ✅ H2 正确 |
| T4 | Figure (royalties 水滴) | `T4-figure-md.png` (W=100%) | `T4-figure-md-v2.png` (W=635px) | ✅ D3 |
| T5 | 表格页 |  | `T5-table-md-v2.png` | ✅ 6×3 表格列对齐 |
| T6 | 代码块页 | `T6-code-md.png` (无高亮) | `T6-code-md-v2.png` (hljs 高亮激活) | ✅ D1 |
| T11 | Appendix |  | `T11-appendix-md-v2.png` | ✅ 章节结构 |
| T12 | References / Conclusion |  | `T12-references-md-v2.png` | ✅ 全段落 |

**13 张截图 ≥ 8 对样本目标达成**。

### 7.6 已知边界 / 后续工作

- **D4: 封面 TOC 表挤一段**（剩余 P1 失真）：PDF 封面"Table of Contents"列表
  在 text extraction 阶段被合并成单段。assembly 现有 `_is_toc_table_text`
  启发式（点 leader + 章节编号 + 页码列）不识别本 PDF 的 inline-style TOC
  （`Chapter N: <title>, M pages [final, last read done, code ok]`）。修复
  方案：扩展 TOC 识别规则匹配"半角逗号 + 编号"模式并分行。R10 处理。
- **代码块 lang 字面在 body 内（13 个 case）**：fence 内 `\n\njavascript\n\n`
  形态。根因是 text extraction 把 PDF "Javascript:" 标签 + 代码段合并到同
  一个文本块，**没经过 docling code_detection 路径** → 不走 `_code_block_to_markdown`。
  修复需 `_format_code_blocks` formatter 后置识别 fence 内偏移行的 lang 字面。
- **段落中部 Unicode bullet 672 个**：text extraction 把多 bullet 列表
  合并成单段并段落化（`Use Case: ... ●​ Tools: ... ●​ Agent Flow: ...`）。
  修复需 text extraction 阶段保留 PDF list-item 边界（PyMuPDF block 切分），
  或 assembly 阶段对"段落中部 ●​ 后跟英文短句"做反向分行。
- **本期已修复**（不再追踪）：~~D1 代码块 lang fence 缺失~~、~~D2 行首
  Unicode bullet 残留~~、~~D3 图片全 `width=100%`~~、~~auto_batch 缺失~~、
  ~~MCP 调用 15 min 超时~~、~~大文档无 checkpoint/resume~~。

## 8. 端到端验证 Runbook（R9 简化版）

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
