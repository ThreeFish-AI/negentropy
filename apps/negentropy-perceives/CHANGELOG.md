# Changelog

All notable changes to the Negentropy Perceives project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### 🚀 性能

- **`parse_pdf_to_markdown` Apple Silicon 引擎深度调优（PR1/4）** — 把各 Stage 在 Apple M 系列 GPU 上的吞吐推进到最优。具体落点：(1) MinerU MPS 后端显式择优：Apple Silicon + mlx_vlm + macOS 13.5+ → `vlm-auto-engine`（MinerU 内部命中 mlx-engine，较 vlm-transformers 加速 100-200%），资格不满足时显式降级 `pipeline`，避免静默回退 transformers 慢路径，新增 `settings.mineru_mps_backend` 三档配置覆盖。(2) Marker 扩展 `device` / `inference_ram_gb` / `num_workers` / `half_precision` 参数；`device='mps' + half_precision=True` 时通过 monkey-patch `MODEL_DTYPE=torch.float16` 启用 fp16；透传 `TORCH_DEVICE` / `INFERENCE_RAM` / `NUM_WORKERS` 环境变量；默认仍 `TORCH_DEVICE=cpu` 保持向后兼容。(3) 新增 `parse_apple_chip_generation` 解析 M1-M5+；`HardwareInfo.chip_generation` 字段；`_compute_gpu_batch_sizes` 按代次缩放（M1/M2 1.0x · M3 1.25x · M4+ 1.5x），24GB MPS 上 M4 ocr_batch 由 16 提升到 24。(4) Stage init_kwargs 标准化：新增 `_mineru_kwargs.py` / `_marker_kwargs.py` 构造器，与 `_docling_kwargs.py` 同形态；`layout_analysis` / `formula_extraction` / `code_detection` / `text_extraction` 全部走统一通道，修复 `text_extraction.docling` 此前 `init_kwargs={}` 导致的跨 Stage `_ConvertCache` miss。新增 189 个单测，既有 138 个 PDF 单测无回退。

- **Adaptive Engine Selection — 基于文档画像的 Stage 路由（PR2/4）** — 把 `quick_scan` 产出的 `DocumentCharacteristics` 从「死字段」激活为「路由信号」，对每个并行 Stage 的 `tool_configs` 进行**动态重排**或**短路跳过**，进一步降低无效计算。设计采用 Strategy Pattern：新增 `EngineSelector` 协议、`IdentitySelector`（兼容路径）、`ProfileAwareSelector`（核心策略）。决策规则：(1) `has_tables` / `has_formulas` / `has_code_blocks` / `has_images` 为 False 时对应 Stage **短路返回**带 `selector_decision` metadata 的成功空结果；(2) `text_extraction` 在扫描版 PDF 上重排 `marker > docling > opendataloader > pymupdf > pypdf`，非扫描小文档（<5 页）走 `pymupdf` 快路径跳过 docling 10s 冷启动；(3) `layout_analysis` 在非复杂布局 + 小文档 + 非扫描时走 `pymupdf` 快路径；(4) 缺失 characteristics / 未知 stage 保守回退 YAML 默认。`PipelineOrchestrator` 接入 selector hook：`_execute_stage` 接收 `results_so_far`，通过 `_build_selection_context` 从 quick_scan / preprocessing 提取 chars，selector skip 时返回 success + 空 dataclass output；通过 `build_selector()` 工厂从 `settings.pipeline_engine_selector` ∈ {`profile_aware`（默认）, `identity`} 决定策略。新增 27 个 selector + orchestrator 集成单测。

- **PyMuPDF text_extraction 多页并发分片（PR3/4）** — `FitzTextExtractor._run` 引入并行路径：`page_count >= 10` 时按 `chunk_size = max(1, min(8, cpu//2))` 分片（Apple Silicon E-core 不参与，上限 8 防止 fitz 句柄爆炸），每 chunk 独立 `fitz.open()`（Document 非线程安全），通过 `asyncio.to_thread + asyncio.gather` 调度到默认线程池，释放事件循环同时利用多核 / 统一内存 fan-out。`reading_order` 由分片完成后全局按 `(page_idx, in-page order)` 重排，保证与串行版本结果一致。chunk_size 由 `settings.pdf_pymupdf_parallel_pages` 控制（0 = 自动；>0 显式覆盖）；<10 页强制串行（开销 > 收益）。新增 7 个单测覆盖 chunk_size 解析、小文档串行、大文档并行、并行/串行等价、page_range 在并行下被尊重。

### 📚 文档

- **PDF 调优文档矩阵（PR4/4）** — 新增 [docs/agents/pdf-engine-selection.md](docs/agents/pdf-engine-selection.md) 决策图（含 Mermaid 流程图）、[docs/agents/apple-silicon-tuning.md](docs/agents/apple-silicon-tuning.md) Apple M 系列调优指南（含 IEEE 引用）；[docs/agents/knowledge-map.md](docs/agents/knowledge-map.md) 从 WIP 补全为完整索引；[docs/issue.md](docs/issue.md) 新增 [2026-05-17] PR1-4 决策档案。新增 [scripts/benchmark/parse_pdf_bench.py](scripts/benchmark/parse_pdf_bench.py) 端到端基准脚本，输出每 Stage `engine_used` / `elapsed_ms` / `selector_decision`，支持 `--selector` / `--device` / `--method` / `--page-range` 多维对比。

### ✨ 新增

- **OpenDataLoader PDF 引擎集成** — 引入 [OpenDataLoader PDF](https://github.com/opendataloader-project/opendataloader-pdf) v2.4.3 作为第六个 PDF 提取引擎，定位为 Docling（MIT/GPU）之后的 rank=2 降级路径。核心优势：Apache-2.0 许可证（无 copyleft 感染）、CPU-only（零 GPU 依赖）、全元素 bounding box（非占位）、XY-Cut++ 阅读顺序、Tagged PDF 原生结构支持。官方 benchmark Overall 0.907（200 篇真实 PDF），reading order 0.934，table 0.928。架构策略：复用 `EngineWorkerPool` 进程隔离机制，将 JVM 常驻于 worker 子进程，化解每次 `convert()` 启动 JVM 的固有开销；一次转换同时输出 Markdown + JSON（含 bbox），从 JSON 中提取结构化 tables/images/headings/captions。覆盖 Stage：layout_analysis / text_extraction / table_extraction / image_extraction / code_detection。新增文件：`pdf/engines/opendataloader.py`（引擎主类）、`pdf/engines/_opendataloader_schema.py`（Pydantic 模型）。依赖：`opendataloader-pdf>=2.4.3`（运行时需 Java 11+）。

- **LLM 竞态评审器** — Pipeline 竞争模式新增 `LLMCompetitionJudge`，当多个引擎同时产出成功结果时，通过 LLM 从准确性、结构完整性、格式规范性三个维度进行质量评估并择优。支持 OpenAI API 兼容协议的自定义端点（`llm_api_base_url`），默认使用 `gpt-5.4-mini` 模型。LLM 不可用时自动回退到基于质量信号的启发式评分。评审器通过 `CompetitionJudgeConfig` 配置（strategy / model / temperature / max_tokens），由 `PipelineOrchestrator` 在初始化时延迟加载，不阻塞无 LLM 场景的启动。涉及文件：`pipeline/llm_judge.py`（新增）、`pipeline/scheduler.py`（judge 参数透传）、`pipeline/orchestrator.py`（初始化与注入）、`pdf/llm/client.py`（新增 `api_base_url` 支持）、`config.py`（新增 `llm_api_base_url` 字段）、`config.default.yaml`（默认模型改为 `gpt-5.4-mini`）。

### 🔧 修复

- **`parse_pdf_to_markdown` 两端对齐文本被误识别为表格** — 纯文本路径 `extract_tables_from_text()` 缺失质量过滤（几何路径已有），导致学术论文中两端对齐的段落文本被错误解析为 Markdown 表格。修复方式三层防御：（1）强化 `_has_multiple_space_separators()` 新增中英文停用词密度检测（>25% 视为散文）和最大 segment 占比限制（>65% 拒绝）；（2）新增列数一致性检查 `_check_column_consistency()`，超过 30% 行列数与众数不一致则拒绝；（3）新增 `_parse_table_lines_to_cells()` 将文本行转为二维数组后复用 `_table_quality_score()` 进行占用率/弱列/唯一单元格三指标过滤。涉及文件：`pdf/extraction/table.py`。
- **`parse_pdf_to_markdown` 图片未嵌入最终 Markdown** — 装配阶段（S8）仅收集 text/table/formula/code 作为内容元素，`ExtractedImage` 的 `reading_order` 和 `page_number` 信息未被利用。修复方式：（1）图片提取阶段按 bbox y0 排序分配 `reading_order`；（2）装配阶段新增图片元素收集，通过 `_image_to_markdown()` 生成 `![caption](./images/filename)` 并按阅读顺序插入，同时跳过已有 `<!-- image -->` 占位符的图片避免重复。涉及文件：`pipeline/stages/pdf/image_extraction.py`、`pipeline/stages/pdf/assembly.py`。

### ✨ 新增（历史）

- **`perceives prefetch-models` 模型预热 CLI** — 新增子命令 `uv run perceives prefetch-models`，一次性幂等地将 Docling / Marker / MinerU 所需模型拉取到本地缓存，避免首次 MCP 请求被 ~1.35GB Marker Layout 模型下载阻塞触发 `Stage 'layout_analysis' 工具 'marker' 超时 (120s)`。命令支持 `--engines docling,marker,mineru|all` 按需过滤与 `--hf-home <path>` 指定 HuggingFace 缓存位置；每个引擎独立 try/except，未安装引擎输出 `skipped` 并给出 `uv sync --extra <engine>` 提示，不中断其它引擎；任一引擎 error → 退出码 1，全部 ok/skipped → 退出码 0。触发方式全部复用各 engine 已验证的下载入口（`DocumentConverter(...)` / `create_model_dict()` / `mineru-models-download -s huggingface -m all`），不自建下载栈。涉及文件：`src/negentropy/perceives/cli/commands/prefetch_models.py`（新增）、`src/negentropy/perceives/cli/app.py`（注册子命令）、`src/negentropy/perceives/pipeline/convenience.py`（`[PDF engines]` 汇总日志追加预热提示）、`tests/unit/test_prefetch_models_cli.py`（11 用例覆盖引擎选择、未安装跳过、subprocess 失败、HF_HOME 传导）。

### 🔧 修复

- **`perceives prefetch-models` 在 mineru 步骤“看似卡死”** — `_prefetch_mineru()` 调用 `subprocess.run(cmd, capture_output=True, text=True)` 时把子进程 stdout/stderr 全收进内存，huggingface_hub 内嵌 tqdm 检测到非 TTY 后自动降级为静默或极低频，**视觉上等同卡死**；叠加默认 `-s huggingface` 在大陆从 `huggingface.co` 直拉 ~9GB（带宽通常 ≪ modelscope 国内 CDN）以及无 `timeout=` 参数（遇 huggingface_hub TCP 静默断流会无限期阻塞），用户实际看到的是“docling/marker 跑完后停在 mineru 步骤毫无回响”。修复方式三点：（1）移除 `capture_output=True`/`text=True`，让子进程 stdout/stderr 直接继承父终端，tqdm 实时可见；（2）默认 `--mineru-source` 改为 `modelscope`（MinerU 官方推荐大陆默认源），优先级 `CLI 参数 > MINERU_MODEL_SOURCE 环境变量 > 默认 modelscope`，命令行 `-s` 与环境变量双写以同时兼容老/新版 mineru CLI；（3）新增 `--mineru-timeout`（默认 1800s）+ `try/except subprocess.TimeoutExpired` 转 `RuntimeError("mineru 模型下载超时（{}s）；可加大 --mineru-timeout 或切换 --mineru-source")`。同步更新 `tests/unit/test_prefetch_models_cli.py`：调整 `test_prefetch_mineru_subprocess_failure_raises` 断言（不再读 stdout/stderr）、新增 `test_prefetch_mineru_default_source_is_modelscope` / `test_prefetch_mineru_respects_user_env` / `test_prefetch_mineru_cli_source_override` / `test_prefetch_mineru_timeout_raises` / `test_prefetch_mineru_does_not_capture_stdout` / `test_run_passes_mineru_options_to_dispatch` 共 6 条；新增 `_restore_mineru_source` autouse fixture 隔离环境污染。涉及文件：`src/negentropy/perceives/cli/commands/prefetch_models.py`、`tests/unit/test_prefetch_models_cli.py`。
- **MinerU 在 macOS/MLX 路径上硬编码非法 CLI backend `vlm-mlx-engine` 导致 `layout_analysis` / `formula_extraction` 全部失败** — `pdf/engines/mineru.py` 在 `device=mps` 与 Apple Silicon 自动检测分支将 `_resolved_backend` 设为 `vlm-mlx-engine`，而 MinerU CLI `--backend` 的合法值仅为 `pipeline / vlm-http-client / hybrid-http-client / vlm-auto-engine / hybrid-auto-engine`，因此在 Apple Silicon 用户环境下调用 `mineru` 即报 `Invalid value for '-b' / '--backend'` 并 `exit_code=2`。修复方式：两处字符串替换为 `vlm-auto-engine`（语义：由 MinerU 自动挑选最佳 VLM 后端，MLX 可用时走 MLX，否则 fallback），对外 `settings.mineru_device="mlx"` / `settings.mineru_backend="auto"` API 不变；同步更新 `tests/unit/test_mineru_engine.py` 三处断言，并将 `test_mps_device_maps_to_mlx` 重命名为 `test_mps_device_maps_to_vlm_auto`。涉及文件：`src/negentropy/perceives/pdf/engines/mineru.py`、`tests/unit/test_mineru_engine.py`。
- **`table_extraction` PyMuPDF 分支 `EnhancedPDFProcessor.extract_tables_with_geometry() missing 1 required positional argument: 'text_blocks'`** — `pipeline/stages/pdf/table_extraction.py` 中 `FitzTableExtractor._run()` 循环体同时犯了三个错：把 `page`（页对象）当 `doc`（文档对象）传入、漏掉必需位置参数 `text_blocks`、把 `(bbox_map, all_tables)` 返回元组当列表迭代；历史 `# type: ignore[call-arg] / [union-attr]` 还压住了 mypy 告警。修复方式：参照仓内已通过的 `pdf/processor.py:1321-1325` 调用范式，按 `(pdf_document, page_num, text_blocks)` 传参并新增 `text_blocks = page.get_text("blocks")`，正确解包 `_, page_tables = ...`，同时移除所有 type-ignore 注释让 mypy 重新校验。涉及文件：`src/negentropy/perceives/pipeline/stages/pdf/table_extraction.py`。
- **`parse_pdf_to_markdown` 因 Stage 输入被 `DocumentCharacteristics` 覆盖导致 layout_analysis 四工具全报 AttributeError** — 新版 Stage 流水线中 `PipelineOrchestrator.run()` 此前采用链式 `current_input` 传递：`quick_scan` 输出的 `DocumentCharacteristics` 会覆盖 S0 `preprocessing` 的 `PreprocessingOutput`，之后 `layout_analysis` / `text_extraction` / 表格/公式/图片/代码 Stage 读取 `input_data.local_path` 时全部抛 `'DocumentCharacteristics' object has no attribute 'local_path'`，Stage 全败触发旧版 Docling 全文档兜底 300s 超时，进而引发 MCP 连接 `anyio.ClosedResourceError`。修复方式：引入 YAML 声明式输入路由（`input_from` / `input_builder`），由 `PipelineOrchestrator._resolve_input()` 按 Stage 配置显式从指定前序 Stage 取 `StageResult.output`，或调用 convenience 中注册的复合构造器（`assembly` / `asset_bundling`）聚合多个 Stage 输出；引用缺失或失败 Stage 时返回结构化 `StageResult(success=False, error=...)` 而非 `AttributeError`，并行组内各 Stage 各自 resolve、互不污染。涉及文件：`core/pipeline_config.py`（新增 `input_from` / `input_builder` Optional 字段）、`pipeline/orchestrator.py`（`_resolve_input` + `input_builders` 注入，并行分支改收 `(cfg, resolved)` 元组）、`pipeline/convenience.py`（注册 `_build_assembly_input` / `_build_asset_bundling_input`）、`config.default.yaml`（PDF 各 Stage 追加 `input_from: preprocessing`，`assembly`/`asset_bundling` 追加 `input_builder`）。新增 `tests/unit/test_pipeline_orchestrator_routing.py`（13 用例覆盖链式回退、`input_from`、`input_builder`、缺失/未注册/失败的结构化错误、并行组隔离、`_resolve_input` 优先级）。

### 📦 变更

- **`config.default.yaml` 6 个竞态 Stage 默认改为降级模式（BREAKING：默认行为变更）** — PDF Pipeline 的 `layout_analysis` / `table_extraction` / `formula_extraction` / `code_detection`，与 WebPage Pipeline 的 `main_content_extraction` / `markdown_conversion`，`competition_mode` 默认值由 `true` 改为 `false`，仅运行各 Stage 的 rank=1 最佳引擎（依次为 docling / docling / mineru / docling / trafilatura / markitdown）。动机：（1）#150 七战线后 rank=1 引擎已稳定胜出，多引擎竞争退化为「等首胜+取消」无效空转，浪费 CPU/GPU 与 5s grace 尾部延迟；（2）跨 stage `_docling_kwargs.py` 缓存让单跑 docling 也能命中 worker 内 `_ConvertCache`，节省 layout 后 table/code 各一次完整推理；（3）fallback 路径（`scheduler._run_fallback`）无 stage 级 `wait_for` 硬切，rank=1 可充分跑满 `task_timeout_seconds=900s` 顶层预算，「单引擎跑透」即可拿到与原竞争模式等价的产出。竞争完整能力（`competition:` 子配置、`max_concurrent` / `timeout` / 早胜取消 / LLM 评审）原样保留，用户/高质量场景可在 YAML 中将对应 Stage 的 `competition_mode` 改回 `true` 一键恢复，无需重写参数。rank≥2 工具保持 `enabled=true` 作为 fallback 兜底链（与 S3 `text_extraction` 现行设计一致），rank=1 失败时自动顺序尝试。涉及文件：`src/negentropy/perceives/config.default.yaml`（6 处 + 内联注释）、`docs/framework.md`（mermaid `⚡ 竞争` → `⚡ 可竞争`、PDF/WebPage 表格「模式」列改为「降级（默认）/ 竞争（opt-in）」、增补默认行为元说明）、`docs/user-guide.md`（措辞调整、新增「切换运行模式」小节）、`docs/issue.md`（新增 [2026-05-07] 决策档案）。调度器 / `_docling_kwargs.py` / LLM 评审代码零改动；现有单测全部继续守护 opt-in 路径。

- **竞争模式 `max_concurrent` 放开至候选工具数，消除 rank 靠后工具被硬截断** — `StageScheduler._run_competition()` 以 `tools[:max_concurrent]` 截断候选；原 `layout_analysis` / `table_extraction` 配置 `max_concurrent: 2`，导致 rank=3/4 的 `marker` / `pymupdf` / `pdfplumber` 永远拿不到参赛席位。本次在 `config.default.yaml` 中将 `layout_analysis` / `table_extraction` 放开至 `4`、`formula_extraction` 放开至 `3`，使得 Docling/MinerU/Marker/PyMuPDF 四工具在 `layout_analysis` 中均有机会同台竞争；由于 `is_available()` 过滤未装引擎 + `EngineWorkerPool` 按引擎单例序列化，实际并发压力可控。
- **PDF 引擎门控默认放行，运行时 `is_available()` 作为单一事实源** — `settings.docling_enabled` / `mineru_enabled` / `marker_enabled` 默认值从 `False` 改为 `True`，同步 `config.default.yaml` 与 `tests/unit/test_config.py` 相关断言。"包是否真的可用"下沉到工具的 `is_available()`（能否 import 依赖）判定；用户如需在已安装环境下显式禁用某引擎，仍可通过 `NEGENTROPY_PERCEIVES_*_ENABLED=false` 或 YAML 覆盖为 `false`。
- **Stage 调度可观测性增强** — `pipeline/scheduler.py` 中工具因 `is_available()=False` 被跳过时的日志由 `debug` 提升为 `info`，并在每个 Stage 选出候选后打印 `Stage '...' 参与竞争 tools=[...]（声明=[...]，已过滤不可用）`；`pipeline/convenience.py` 首次调用 PDF 管线时追加一次 `[PDF engines]` 能力汇总（`docling/mineru/marker/pymupdf` 各自 ok/missing 原因），便于定位"某引擎为何未生效"。
- **文档** — `docs/development.md` 详细环境配置补充 `uv sync --extra all-engines` 与单独 `docling` / `mineru` / `marker` extras 的启用指引，并附"引擎可用性"说明；`docs/user-guide.md` 在 PDF → Markdown 章节追加"启用四大 PDF 引擎"子节，指向 development.md 并展示 `[PDF engines]` 日志样例；`docs/issue.md` 按 AGENTS.md `Operational Excellence` 第 6 条新增本次 Issue 条目（问题描述 / 表因根因三层 / 处理方式 / 后续防范 / 同类问题影响与注意事项）。

- **默认 HTTP 端口迁移 `8092` → `2992`** — 同步更新 `src/negentropy/perceives/config.default.yaml`（`http.port`）与 `config.py` 中 `http_port` Pydantic `Field(default=...)`、SDK 向后兼容常量 `DEFAULT_BASE_URL`、`apps/app.py` 用户配置模板注释、`examples/sdk/python_sdk_usage.py` 示例 URL，以及单元测试断言（`tests/unit/test_config.py`、`test_app_entrypoint.py`、`test_sdk.py`）。文档同步刷新：`README.md`、`docs/zh-CN/README.md`、`docs/user-guide.md`（快速入门、SDK 示例、环境变量默认值表 ×2、YAML 示例、Claude MCP JSON 示例、SSE 启动命令、`netstat` 调试提示）、`docs/framework.md` SDK 默认端点。用户显式设置 `http.port` 或 `NEGENTROPY_PERCEIVES_HTTP_PORT` 不受影响；使用默认配置的本地 Claude MCP 客户端需将 `url` 中的端口同步更新为 `2992`。

### 🔧 修复

- **WebPage Pipeline HTML 预处理正则误匹配导致内容大量丢失** — `preprocess_html()` 中 `unwanted_patterns` 的正则 `.*(ad|...).*` 误匹配 CSS Module 类名中的子串（如 `reading` 含 `ad`），导致大量正文 `<p>` 元素被错误删除（约 87% 内容丢失）。修复方式：为关键词匹配添加词边界约束 `(?<![a-zA-Z0-9])...(?![a-zA-Z0-9])`，确保独立 `ad` 类名被命中而复合词中的子串不被误匹配。同时扩展 `unwanted_patterns` 新增 newsletter/social/cookie/copy-button/carousel/tooltip 等非内容模式；新增移除交互元素（`<button>`/`<noscript>`/无文字 `<svg>`）及剥离 `class`/`style` 属性的逻辑，消除原始 HTML/CSS 类名泄漏。涉及文件：`markdown/html_preprocessor.py`
- **WebPage Pipeline 视频/嵌入媒体元素丢失** — `<video>`/`<audio>`/`<iframe>`（YouTube/Vimeo/Bilibili）/`<embed>`/`<object>` 等媒体元素在预处理后既未被移除也未被转换为 Markdown 友好形式，导致 MarkItDown/html2text 转换时输出中完全缺失。修复方式：新增 `_convert_media_elements()` 函数，在 `unwanted_patterns` 移除之前将媒体元素转换为可转换的等价 HTML（`<video>` → `<a>[视频]</a>`、iframe 视频 → 平台播放页链接、`<audio>` → `<a>[音频]</a>`、视频 `<embed>`/`<object>` → 链接），支持提取 `poster` 封面、`<source>` 子元素 URL、相对路径解析。涉及文件：`markdown/html_preprocessor.py`
- **Next.js 图片优化代理 URL 未解析** — 使用 Next.js 图片优化代理 `/_next/image?url=<encoded_cdn_url>&w=...&q=...` 的 `<img>` 标签，其 `src`/`srcset` 指向代理服务而非真实 CDN，导致 `embed_images_in_markdown` 下载时失败或返回非预期内容。修复方式：在 `_convert_media_elements()` 中识别并解析 Next.js 代理 URL，提取 `url` 查询参数中的真实 CDN URL 并替换原始属性。同时新增 `<picture>` 元素展平逻辑，从 `<source srcset>` 中选取最高分辨率 URL 写入关联 `<img>` 的 `src`。涉及文件：`markdown/html_preprocessor.py`
- **残余 HTML 媒体标签泄漏** — `_basic_cleanup()` 防御性后处理未覆盖 `video|audio|picture|source|iframe|embed|object` 标签，若媒体转换因异常未完全处理，残留标签会泄漏到最终 Markdown。修复方式：扩展 `_basic_cleanup()` 的标签清除正则，新增上述媒体标签类型。涉及文件：`markdown/formatter.py`
- **trafilatura 主内容提取路径下图片全量丢失** — S4 `TrafilaturaTool` 以 `output_format='html'` 提取时，会将所有 `<img>` 降级为 TEI `<graphic src="..." alt=".../>`（trafilatura 内部为保持 TEI 兼容）。下游 S5 `_convert_media_elements`、S9 `rich_elements/image.py`、S10 MarkItDown/html2text 均只识别标准 `<img>`，导致 Next.js 代理 URL 未解析、图片 Markdown 完全缺失。仅在运行环境安装 trafilatura 且 S4 竞争获胜时触发（beautifulsoup_heuristic 兜底路径不受影响）。修复方式：在 `TrafilaturaTool._run()` 输出口新增 `_rehydrate_trafilatura_graphics()`，以 BS4 将所有 `<graphic>` 标签名就地改回 `<img>`，保留全部属性；上游/下游零侵入。涉及文件：`pipeline/stages/webpage/main_content_extraction.py`
- **懒加载 `<img>` 与 srcset-only 图片不识别** — `_convert_media_elements()` 仅消费 `src` 属性，而 Next.js/Medium/知乎/CMS 类站点常将真实 URL 放在 `data-src` / `data-original` / `data-lazy-src` / `data-url` / `data-srcset`，或仅提供 `srcset`（无 `src`），导致这些图片在 S9/S10 阶段被丢弃。修复方式：遍历 `<img>` 时新增懒加载属性兜底（占位符 src 或空 src 时迁移 `data-*` 真实 URL），若仅有 `srcset` 则通过 `_pick_best_srcset_url()` 回填 `src`；同时将 `srcset` 中的 Next.js 代理 URL 也解析后回写到 `src`，确保 `srcset-only` 图片被 MarkItDown 正常识别。涉及文件：`markdown/html_preprocessor.py`
- **正文媒体轮播被误当作广告整体移除** — `preprocess_html()` 的 `unwanted_patterns` 中 `carousel|slider|gallery|swiper|slick`（以及 `modal|dialog|overlay|tooltip|popover|toast` 等）会整体 `decompose` 匹配类名/ID 的容器。而现代 CMS（如 Next.js `MediaCarousel-module-scss-module__..._media-carousel`）常将正文内的多图展示包装为 `media-carousel`/`gallery` 容器，导致文章关键正文图片（如 Anthropic engineering 博客中 Opening screen/Sprite editor/Game play 三张配图）被一并删除。修复方式：在这些容器命中 `unwanted_patterns` 时，新增“内容媒体保护”判定——若容器内存在 `<img>`/`<figure>`/`<picture>`/`<video>`/`<audio>` 中任一内容元素，则跳过移除，让后续清洗流程保留真实正文。涉及文件：`markdown/html_preprocessor.py`
- **trafilatura 整页丢图兜底** — 即使 `<graphic>` 被还原为 `<img>`，仍存在 trafilatura 在部分 Next.js / 复杂 figure 结构下直接在主内容提取阶段丢弃全部图片的情况。修复方式：在 `TrafilaturaTool._run()` 的输出处比对 `raw_html` 与提取结果的 `<img>` 数量——若 `raw_html` 至少含 3 张图而主内容为 0 张，则主动返回 `success=False`，触发 S4 竞争模式降级到 `readability` 或 `beautifulsoup_heuristic` 兜底。涉及文件：`pipeline/stages/webpage/main_content_extraction.py`
- **Ruff 代码检查 (47 错)** — 清除全项目 ruff lint 错误至零：
  - F401 未使用导入（34 处）— 自动移除 `src/` 和 `tests/` 中 34 个未使用导入
  - F841 未使用变量（10 处）— 移除或加 `_` 前缀标记有意忽略的变量
  - E741 歧义变量名（2 处）— `l` → `link` / `line`
  - E402 导入位置（1 处）— `conftest.py` 中 `Path` 导入上移至文件顶部
- **Ruff 格式化 (62 files)** — 统一全项目代码格式

## v0.3.0-fix.2 — MCP 取消传导彻底修复

> 修复 MCP Client 取消/超时后 PDF→Markdown 进程仍在后台持续吞噬 CPU/GPU/内存的资源泄漏问题。取消信号可从 MCP 传输层一路下钻至原生引擎，真正做到"叫得停"。

### 🔧 修复

- **取消信号传导链路缺失** — 此前 `docling/mineru/marker_engine.convert(...)` 同步阻塞事件循环，外层 `asyncio.timeout` / FastMCP anyio.CancelScope 无法在 await 检查点抛出 `CancelledError`；即便包入 `asyncio.to_thread`，Python 也无法强制终止线程，原生 C++/CUDA 推理继续吃满资源直至自然结束
- **原生引擎进程隔离** — Docling/MinerU/Marker 全部下沉到独立子进程执行；取消时走 `SIGTERM → grace → SIGKILL` 真正释放 GPU/CPU/显存
- **Pipeline Stage 迁移** — `pipeline/stages/pdf/{layout_analysis,table_extraction,code_detection,formula_extraction,text_extraction}.py` 七处 `engine.convert` 调用点统一改走 `EngineWorkerPool.run(...)`
- **ops 层超时治理** — `ops/pdf.py`、`ops/markdown.py` 原先各自的 `asyncio.timeout(...)` 替换为 ContextVar 级 `bind_cancel_scope(...)`，保持 `PDFResponse.error="任务超时：..."` 既有语义的同时，新增 `"任务已取消：..."` 客户端主动取消路径
- **Middleware 观测性** — `tools/_middleware.py` 在 `on_call_tool` 捕获 `CancelledError` 时登记 `scope.mark_cancelled("client_cancelled")` 并输出"任务取消 tool=... reason=... elapsed=..."日志

### ✨ 新增

- **`core/cancellation.py`** — `CancelScope` 数据类（`threading.Event` + `deadline_monotonic` + `reason`）+ `cancel_scope_var` ContextVar + `bind_cancel_scope(timeout=...)` 异步上下文管理器；同步/线程/子进程代码均可轮询 event 协作式退出
- **`infra/engine_worker.py` + `_engine_worker_entry.py`** — `EngineWorker`（单子进程包装，支持 `SIGTERM/SIGKILL`）+ `EngineWorkerPool`（Supervisor 模式，按引擎维护常驻 worker，取消时 pop + 后台 terminate + 懒启动替身）；子进程侧按 `init_kwargs` 哈希缓存引擎实例，避免重复冷启动
- **配置项** — `pdf_engine_isolation`（`process`/`thread`/`inline`，默认 `process`）、`pdf_worker_pool_size`（默认 `1`）、`pdf_worker_max_tasks`（默认 `50`，周期性回收防内存泄漏）、`pdf_worker_kill_grace_seconds`（默认 `2.0`）；同步暴露为 `NEGENTROPY_PERCEIVES_PDF_*` 环境变量
- **应用生命周期** — `apps/app.py:main()` 退出路径 `finally + atexit.register` 双保险调用 `shutdown_engine_pool()`，确保进程退出时所有 worker 子进程被回收
- **测试覆盖** — `tests/unit/test_cancellation.py`（21 用例，CancelScope 各维度）+ `tests/integration/test_cancellation_flow.py`（10 用例，覆盖超时杀进程、客户端取消、pool 复原、thread 降级、子进程 PID 已消失等场景）

### 📚 参考设计模式

- **Cancel Scope**（Trio/Anyio/Go `context.Context`）— 跨层隐式上下文传递取消信号
- **Warm Worker Pool + Kill-on-Revoke**（Celery `terminate=True` / Gunicorn worker 重启）— 取消即杀，按需懒启动补齐
- **Supervisor Pattern**（Erlang/OTP）— Pool 作为 supervisor，worker 崩溃/被 kill 后自动 respawn
- **Process Isolation for Native Code**（Chromium 渲染进程 / CPython GIL 规避）— 把不可中断的 C++/CUDA 推理放独立进程

## v0.3.0-fix.1 — CI 流水线修复

> 修复 GitHub Actions CI 全线失败问题，恢复 7/7 Job 全绿。

### 🔧 修复

- **Ruff 代码检查 (34 错)** — 清除 Pipeline 模块中 32 个未使用导入（F401）、1 个未使用变量（F841）、1 个 availability-check 导入标记（noqa）
- **Ruff 格式化 (24 files)** — 统一 Pipeline + Tools 模块代码格式（`ruff format`）
- **Bandit 安全扫描 (B110)** — 将 `asset_bundling.py` 和 `page_fetching.py` 中 2 处空 `except: pass` 替换为 `logging.debug()` 异常日志
- **文档完整性测试** — 创建 `docs/configuration.md` 重定向页，修复 `test_configuration_doc_exists` 断言
- **表格覆盖度测试** — 修正 `test_docs_configuration.py` 正则表达式，兼容 Markdown 表格列对齐空格
- **安全依赖升级** — `cryptography` 46.0.6 → 46.0.7 (CVE-2026-39892)、`pypdf` 6.9.2 → 6.10.0 (GHSA-3crg-w4f6-42mx)
- **CVE 豁免** — `transformers` CVE-2026-1839 暂时豁免（修复版本 5.0.0rc3 为 major 跳升，需单独评估）
- **Mypy 类型检查 (93 错)** — 修复此前被 ruff 失败遮蔽的全部预存 mypy 错误：
  - `callable` → `Callable[[Any], Any]`：修正 `figure_text_filter.py` 中 4 处类型注解误用
  - 隐式 Optional 修复：`converter.py` 中 `str = None` → `Optional[str] = None`
  - 类型安全加固：`processor.py` `Optional[EnhancedPDFProcessor]` 注解、`config.py` `transport_mode` Literal 化、`engine.py` driver 类型注解
  - 添加 `types-PyYAML` 开发依赖解决 `yaml` 模块 import-untyped 错误
  - 精准 `# type: ignore[error-code]` 注释处理 BeautifulSoup 联合类型等 ~70 处无法通过代码修改解决的类型问题

## v0.3.0 — 流水线觉醒，工具瘦身

> 引入 Stage 化 Pipeline 编排框架，将文档处理拆解为可组合、可竞争的流水线；同时精简 MCP 工具至 6 个，聚焦核心转换能力。

### ✨ 核心亮点

- **Pipeline 编排框架** — 全新 `pipeline/` 子包，Stage 基类 + 竞争 Stage + 工具注册表 + 调度器 + 编排器，配置驱动
- **PDF Pipeline（S0-S9）** — 10 阶段管线：预处理 → 文档扫描 → 版面分析 → 并行提取（文本/表格/公式/图片/代码） → 组装 → 资源打包
- **WebPage Pipeline（S1-S12）** — 12 阶段管线：合规检查 → 网页获取 → 反检测 → 主内容提取 → 并行抽取（公式/代码/表格/图片） → Markdown 转换 → 资源打包
- **竞争模式** — 不稳定 Stage（版面分析、表格/公式/代码识别、主内容提取）支持多工具并行竞争、择优返回
- **工具精简（12 → 6）** — 删除 6 个低价值/可内化工具，保留核心转换入口；`method="auto"` 优先走 Pipeline，降级走原有路径

### 🔧 更多特性

- **配置驱动**: `config.default.yaml` 新增 `pipeline:` 节，Stage 级工具列表、rank 排序、竞争参数全部可配置
- **引擎级门控**: `docling_enabled` / `mineru_enabled` / `marker_enabled` 统一控制 Pipeline 中的引擎可用性
- **PASSTHROUGH_KEYS**: 配置展平桥接函数新增 `pipeline` 透传，保持嵌套结构完整性

## v0.2.0 — 隐身的眼睛，睁开了

> 给 AI Agent 装上一双能看懂网页和 PDF 的眼睛，而且这双眼睛会隐身。

### ✨ 核心亮点

- **复杂 PDF，一句话搞定** — 5 引擎自动降级 + LLM 三阶段编排（分析→并行调度→择优融合）
- **反爬墙？穿墙** — Selenium / Playwright 隐身双引擎，鼠标轨迹 + 随机延迟，无感绕过
- **网页→Markdown，9 道工序精炼** — 去噪、表格对齐、代码检测、排版复原，一步到位
- **12 工具 · 6 领域 · 5 层架构** — 退避 + 限速 + 缓存三层弹性护盾，生产级底座

### 🔧 更多特性

- **结构化提取**: CSS 选择器精准映射 + 5 种数据模板，内置 robots.txt 合规检查
- **PDF 深度内容**: 表格识别、LaTeX 公式保持、图像 base64 嵌入，增强模式可选
- **4 层配置体系**: 内置默认 → 用户 YAML → 环境变量 → CLI（pydantic-settings 驱动）
- **多传输模式**: STDIO / StreamableHTTP / SSE，默认 StreamableHTTP，开箱即用
- **异步 SDK**: NegentropyPerceivesClient，类型安全，async/await 原生
- **批量并发**: 网页批抓、PDF 批转均走 asyncio，吞吐拉满
