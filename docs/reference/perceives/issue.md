---
sidebar_position: 100
---
# Issue 处理档案

> 记录已处理的 Issue 摘要，便于同类问题跨上下文复用。
> 按“问题描述 / 表因 / 根因 / 处理方式 / 后续防范 / 同类问题影响与注意事项”结构化维护。

## [2026-05-17] parse_pdf_to_markdown Apple Silicon 调优与 Adaptive Engine Selection

### 问题描述

`parse_pdf_to_markdown` 在 Apple M 系列上仍存在四类待优化项：
1. MinerU MPS 后端依赖 `vlm-auto-engine` 自动挑选，mlx_vlm 缺失时静默回退
   transformers 慢路径，无可观测性；
2. Marker 引擎对 MPS / FP16 / INFERENCE_RAM / NUM_WORKERS 无显式支持，
   Apple Silicon 统一内存优势未释放；
3. `quick_scan` 产出的 `DocumentCharacteristics` 是死字段，
   没有路由反向作用于后续 Stage；
4. PyMuPDF text_extraction 单线程 for-loop，对 80 页 PDF 是浪费多核的瓶颈。

### 处理方式

按 4 PR 渐进交付：

- **PR1** Apple Silicon 引擎深度调优：MinerU 显式择优 `vlm-auto-engine` / `pipeline`、
  Marker 扩展 device/half_precision/inference_ram_gb/num_workers、新增
  `parse_apple_chip_generation` 并按 M1-M5+ 缩放 batch（M3 *1.25, M4+ *1.5）、
  统一 init_kwargs 标准化（`_mineru_kwargs` / `_marker_kwargs` 与
  `_docling_kwargs` 对齐）。
- **PR2** Adaptive Engine Selection：新增 `EngineSelector` Strategy Pattern
  与 `ProfileAwareSelector`，把 `DocumentCharacteristics` 激活为路由信号；
  4 个特征驱动型 Stage（table/formula/code/image）在对应特征 False 时短路；
  text_extraction 在扫描版 PDF 上优先 marker/docling，小文档（<5 页非扫描）
  走 pymupdf 快路径；layout_analysis 在简单布局小文档上走 pymupdf 快路径。
- **PR3** PyMuPDF text_extraction 多页并行：`page_count >= 10` 时按
  `chunk_size = max(1, min(8, cpu//2))` 分片，每 chunk 独立 `fitz.open()`
  在 `asyncio.to_thread + asyncio.gather` 上并发；reading_order 在聚合后
  全局重排保证与串行版本一致。
- **PR4** 基准测试矩阵 + 文档化：[scripts/benchmark/parse_pdf_bench.py](../scripts/benchmark/parse_pdf_bench.py)
  端到端基准、[docs/agents/pdf-engine-selection.md](agents/pdf-engine-selection.md)
  决策图、[docs/agents/apple-silicon-tuning.md](agents/apple-silicon-tuning.md)
  调优指南、knowledge-map 同步。

### 后续防范

- 任何引擎设备/批处理参数新增**必须**走 `build_*_init_kwargs()` 单一通道，
  避免 stage 直接 `init_kwargs={}` 导致 worker 端缓存 miss 与配置不可观测；
- 新增 Stage 短路特征：仅扩展 `ProfileAwareSelector.SKIPPABLE_STAGES_BY_FEATURE`
  并补对应空 `*Output` 占位（见
  [pipeline/orchestrator.py:_empty_output_for_stage](../src/negentropy/perceives/pipeline/orchestrator.py)）；
- 新增 selector 规则**必须**带审计 metadata（`selector_decision` 字段）；
- Marker MPS 是 opt-in（GPL-3.0 + text detection 上游警告），默认仍 CPU，
  启用前在样本扫描 PDF 上验证输出无丢字。

### 同类问题影响与注意事项

- 「stage 短路」类规则修改时优先看 `DocumentCharacteristics` 字段是否真正
  来自 `quick_scan` 而非占位（PDF 加密或 PyMuPDF 失败时 chars 为默认值，
  selector 会保守回退 YAML 默认，不会误跳过）。
- 引入新设备类型（如未来 NPU）时，扩展 `DeviceType` 枚举 +
  `_compute_gpu_batch_sizes` 即可；芯片代次解析对 Apple 之外的厂商默认 None
  → baseline 行为。
- 多页并行受 `pdf_pymupdf_parallel_pages` 配置控制，遇到内存/句柄相关问题
  优先把它降回 1 串行排障。

## [2026-05-16] parse_webpage_to_markdown 图片在 Markdown 中被"放到最大"

### 问题描述

`parse_webpage_to_markdown` 处理 Anthropic 网页（`https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents`）时，对 `<img alt="" loading="lazy" width="1000" height="1000" decoding="async" data-nimg="1" style="color:transparent" src="https://www-cdn.anthropic.com/.../...-1000x1000.svg">` 这类带尺寸属性的图片，最终 Markdown 中图片被“放到最大”，占满阅读器宽度。用户期望在保持高清原图的前提下，让 Markdown 中显示尺寸贴近源页面尺寸。

### 表因

转换链路 `preprocess_html → MarkItDown → MarkdownFormatter` 把所有 `<img>` 统一转为标准 Markdown `![alt](src)` 语法，丢失了源 HTML 上声明的 `width`/`height` 与 `style` 内尺寸信息；下游渲染器（飞书 / Notion / VSCode preview / GitHub）在缺乏尺寸约束时按图片固有尺寸（intrinsic size）或 `width:100%` 渲染。

### 根因

1. [src/negentropy/perceives/markdown/html_preprocessor.py](../src/negentropy/perceives/markdown/html_preprocessor.py) 第 115-119 行（剥离 `class`/`style`）在去除 style 时同时丢弃了 `style="width:Xpx"` 中的尺寸信息。
2. MarkItDown 内部基于 markdownify，`convert_img` 永远输出 `![alt](src)`，硬性丢弃 HTML 属性 `width`/`height`<sup>[[1]](#ref-markdownify-img)</sup>。
3. CommonMark 无原生图片尺寸语法<sup>[[2]](#ref-commonmark-images)</sup>；GitHub/Notion/飞书/VSCode 均接受内嵌 HTML `<img>` 作为事实标准（CommonMark spec § 4.6 允许 HTML blocks）<sup>[[3]](#ref-commonmark-html-blocks)</sup>。

### 处理方式

引入“占位符 + 后处理还原”模式（复用 [formatter.py](../src/negentropy/perceives/markdown/formatter.py) 已有的 `_protect_code_blocks`/`_restore_code_blocks` 思路）：

- **`html_preprocessor.py` 新增** `ImgDimensionRegistry`、`_extract_img_dimensions`、`_register_img_placeholders`：在 `_convert_media_elements` 之后、style 剥离之前遍历 `<img>`，对带尺寸的图片登记 sentinel 并以 `NavigableString(sentinel)` 替换原节点；sentinel 采用 `XIMGPLACEHOLDER<32 hex>ENDX` 纯字母数字格式，规避 markdownify 默认开启的 `escape_asterisks`/`escape_underscores`<sup>[[4]](#ref-markdownify-escape)</sup>。
- **`formatter.py` 新增** `_restore_image_placeholders` + `preserve_image_dimensions` 开关（默认 `True`）：在 `_basic_cleanup` 之后（避免其 `re.sub(r'\s+style="[^"]*"', "", ...)` 误清）、`_restore_code_blocks` 之前把 sentinel 还原为 `<img src=".." alt=".." [title=".."] [width="X"] [height="Y"] style="max-width:100%;height:auto;" />`，所有文本属性经 `html.escape(quote=True)` 实体化；`style="max-width:100%;height:auto;"` 始终输出以兼顾源尺寸与窄屏自适应（W3C 推荐响应式图片 pattern<sup>[[5]](#ref-whatwg-img)</sup>）。
- **`converter.py` 粘合调用链**：`html_to_markdown` 按 `preserve_image_dimensions` 开关条件性实例化 registry 并贯穿 preprocess + format 两阶段；`postprocess_markdown` 增 `img_registry` 透传，PDF 等非 HTML 路径不传 registry 即向后兼容。
- **`image_embedder.py` 扩展** 新增 `_HTML_IMG_RE` 正则与 `html_replacer`，让 `embed_images=True` + `preserve_image_dimensions=True` 两个开关正交可组合：HTML `<img>` 的 src 同样会被替换为 data URI，width/height/style 保留。

尺寸提取优先级遵循 W3C CSS 计算值：`style:width:Xpx` > `width` 属性；忽略 `%`/`auto`/`em`/`rem`/`vh`/`vw` 等不可转 px 的值。无尺寸的图片仍按 `![alt](src)` 输出，行为完全兼容。

### 后续防范

- 任何会改变 MarkItDown 输出形态的预处理改造，必须验证“sentinel 字面量穿透 markdownify”一项（覆盖 `*_` 转义、HTML inline 嵌套、`<a><img>` 包装三种典型路径）。
- 修改 [formatter.py](../src/negentropy/perceives/markdown/formatter.py) `_basic_cleanup` 中的属性剥离正则时，需评估对内嵌 HTML `<img>` 的副作用；当前策略是**先 cleanup 再还原**，回避耦合。
- 新增 `formatting_options` 开关时遵循“**新行为默认开**，回滚靠 `formatting_options={"...": False}`”的现行约定。
- 新增图片相关后处理 pass 时，必须同时考虑 Markdown 语法 `![alt](url)` 与 HTML 语法 `<img>` 两种形式，避免 [image_embedder.py](../src/negentropy/perceives/markdown/image_embedder.py) 这类只匹配前者的历史正则导致功能盲区。

### 同类问题影响与注意事项

- 看到“Markdown 输出图片不带尺寸”类报告时，先检查上游 HTML 是否声明了 `width`/`height`：若有，直接走本特性；若无（如 CSS 完全控制尺寸），无法在丢失 CSS 上下文后恢复，需在转换前增加自定义抓取策略。
- 若下游消费者是严格 CommonMark sanitizer（如部分 ReadMe.io / 旧版 GitBook），可能 strip 内嵌 HTML。此时通过 `formatting_options={"preserve_image_dimensions": False}` 一键退化为 `![alt](src)`。
- 超大源尺寸（>4000px）当前不截断；内联 `max-width:100%` 已限制实际显示宽度，后续若需硬上限可加 `max_image_width` 配置。

<a id="ref-markdownify-img"></a>[1] M. Tretter et al., "markdownify – convert_img," *markdownify Source*, version 1.2.x. [Online]. Available: https://github.com/matthewwithanm/python-markdownify/blob/master/markdownify/__init__.py

<a id="ref-commonmark-images"></a>[2] J. MacFarlane et al., "Images," *CommonMark Spec 0.31.2*, § 6.4. [Online]. Available: https://spec.commonmark.org/0.31.2/#images

<a id="ref-commonmark-html-blocks"></a>[3] J. MacFarlane et al., "HTML blocks," *CommonMark Spec 0.31.2*, § 4.6. [Online]. Available: https://spec.commonmark.org/0.31.2/#html-blocks

<a id="ref-markdownify-escape"></a>[4] M. Tretter et al., "markdownify – escape options," *markdownify Source*, version 1.2.x. 默认启用 `escape_asterisks=True` 与 `escape_underscores=True`，`escape_misc=False`. [Online]. Available: https://github.com/matthewwithanm/python-markdownify

<a id="ref-whatwg-img"></a>[5] WHATWG, "Embedded content – images," *HTML Living Standard*, § 4.8.4. [Online]. Available: https://html.spec.whatwg.org/multipage/embedded-content.html#the-img-element

## [2026-05-07] Docling CodeFormulaV2 在 Apple Silicon MPS 下静默回退 CPU

### 问题描述

PDF Pipeline 日志显示 Docling worker 子进程内 PyTorch MPS 已可用：

```text
子进程 torch 诊断 {'torch_version': '2.10.0', 'mps_built': True, 'mps_available_raw': True, 'mps_smoke_test': 'ok'}
```

但随后仍出现：

```text
engine_worker.docling.utils.accelerator_utils: MPS is not available in the system. Fall back to 'CPU'
```

用户期望 Apple M 系列芯片在该阶段使用 GPU，而不是静默降级到 CPU。

### 表因

最小复现显示 Docling 默认 `CodeFormulaV2` 的 `AUTO_INLINE` 路径先识别到 `device=mps`，但该 preset 没有 MLX 导出，随后退到 Transformers；Docling 的 Transformers code/formula engine 支持设备列表不含 MPS，于是把 MPS 从可用设备中移除并打印 CPU fallback 日志。

### 根因

1. PyTorch MPS 本身可用；问题不在 `torch.backends.mps.is_available()`，而在 Docling 子模型的 `supported_devices` 约束<sup>[[1]](#ref-pytorch-mps)</sup>。
2. Docling Model Catalog 标注 `codeformulav2` 支持 Transformers、不支持 MLX；`granite_docling` 同时支持 Transformers 与 MLX<sup>[[2]](#ref-docling-model-catalog)</sup>。
3. Docling 讨论区也确认旧 formula enrichment 路径会因兼容性排除 MPS，使用 CPU/CUDA 或禁用该功能<sup>[[3]](#ref-docling-formula-mps)</sup>。
4. 依赖层面存在二阶约束：`docling[vlm] -> mlx-vlm -> transformers>=5.1`，而 `marker-pdf==1.10.2` 依赖 `transformers<5.0`；不能把 MLX VLM 作为核心依赖与 Marker 同装。uv 官方建议用 `tool.uv.conflicts` 声明互斥 extras<sup>[[4]](#ref-uv-conflicts)</sup>。

### 处理方式

- **Docling MPS 策略**：`DoclingEngine` 在 `device=mps` 且 `pdf.docling_mps_enrichment=granite_mlx` 时，将 `code_formula_options` 切换为 `CodeFormulaVlmOptions.from_preset("granite_docling", engine_options=MlxVlmEngineOptions())`。
- **显式失败**：若策略要求 `granite_mlx` 但环境缺少 `mlx-vlm`，抛出 `DoclingMpsMlxUnavailableError`，提示执行 `uv sync --python 3.13 --extra docling-mlx`，不再让 Docling 静默 CPU。
- **回退开关**：新增 `pdf.docling_mps_enrichment`，默认 `granite_mlx`；设置为 `disable` 时关闭 Docling code/formula enrichment，让 MinerU/后处理兜底。
- **依赖建模**：新增 `docling-mlx` extra，并在 [pyproject.toml](../pyproject.toml) 中声明它与 `marker` / `all-engines` 冲突；保留 Marker 单独 extra 可用。
- **预热复用运行时路径**：`perceives prefetch-models --engines docling` 改为调用 `DoclingEngine()._get_converter()`，覆盖 Granite Docling MLX 模型预热。

### 后续防范

- Apple Silicon 上需要同时使用 Docling MLX 与 Marker 时，不能放在同一 venv；应拆环境或关闭 `pdf.docling_mps_enrichment`。
- TableFormer 是独立边界：Docling 官方目录标注 TableFormer 支持 CPU/CUDA/XPU，并说明 MPS 因性能问题被禁用；本次只消除 code/formula enrichment 的 CPU fallback，不承诺完整 Docling PDF pipeline 零 CPU。
- 所有本地验证命令必须固定 `--python 3.13`；项目已将 `requires-python` 收敛为 `>=3.13,<3.14`，避免 `onnxruntime` 与 VLM 依赖在 Python 3.14 split 上不可解。

### 同类问题影响与注意事项

- 看到 `accelerator_utils: MPS is not available` 时，必须先看前一行是否有 `Removing MPS from available devices because it is not in supported_devices`；若有，根因是模型支持矩阵，不是硬件探测。
- 新增 Docling 子模型时必须把“模型 preset / runtime engine / supported_devices / optional dependency conflicts”作为一个整体评审，避免只改 `AcceleratorOptions(device=MPS)` 造成虚假 GPU 配置。

<a id="ref-pytorch-mps"></a>[1] PyTorch Contributors, "MPS backend," *PyTorch Documentation*, 2026. [Online]. Available: https://docs.pytorch.org/docs/stable/notes/mps

<a id="ref-docling-model-catalog"></a>[2] Docling Project, "Model Catalog," *Docling Documentation*, 2026. [Online]. Available: https://docling-project.github.io/docling/usage/model_catalog/

<a id="ref-docling-formula-mps"></a>[3] Docling Project, "Using MPS Accelerator with formula enrichment falls back to default CPU," *GitHub Discussions*, 2025. [Online]. Available: https://github.com/docling-project/docling/discussions/2505

<a id="ref-uv-conflicts"></a>[4] Astral Software, "Resolution: conflicts," *uv Documentation*, 2026. [Online]. Available: https://docs.astral.sh/uv/concepts/resolution/

---

## [2026-05-07] Code Review Action 因 CLAUDE.md symlink 生成错误评论

### 问题描述

PR [#152](https://github.com/ThreeFish-AI/negentropy-perceives/pull/152) 的 `Code Review` workflow 结论为成功，但 `Run Claude PR review` step 失败并由 `github-actions` 留下两条 diff 评论：

- [run 25491086039](https://github.com/ThreeFish-AI/negentropy-perceives/actions/runs/25491086039)
- [run 25491508383](https://github.com/ThreeFish-AI/negentropy-perceives/actions/runs/25491508383)

评论内容为 `Claude encountered an error`，属于 action 级异常提示，不是代码审查发现。

修复 symlink 后，[run 25491978040](https://github.com/ThreeFish-AI/negentropy-perceives/actions/runs/25491978040) 继续暴露第二个外部配置问题：`ANTHROPIC_API_KEY` secret 存在但被 Anthropic API 判定为 `Invalid API key`，同样会触发 sticky error comment。

### 表因

日志显示：

```text
Restoring .claude, .mcp.json, .claude.json, .gitmodules, .ripgreprc, CLAUDE.md, CLAUDE.local.md, .husky from origin/feature/1.x.x (PR head is untrusted)
Action failed with error: ENOENT: no such file or directory, symlink
Internal error: directory mismatch for directory ".../anthropics/claude-code-action/v1/tsconfig.json"
```

### 根因

1. 仓库根目录的 [CLAUDE.md](../CLAUDE.md) 是指向 [AGENTS.md](../AGENTS.md) 的 symlink，用于避免双份 Agent 指令造成 SSoT 分裂。
2. `anthropics/claude-code-action@v1` 在 `pull_request` 场景会先快照 PR 侧的敏感启动配置，再删除并从 base 分支恢复可信版本，以防 PR 修改 `.mcp.json` / `.claude/` / `CLAUDE.md` 注入启动行为。
3. 该 action 当前对 PR 侧 `CLAUDE.md` symlink 的快照路径存在兼容性问题，导致审查 step 提前失败；workflow 用 `continue-on-error: true` 包住该 step，因此 overall check 仍为 success，但 sticky comment 会污染 PR 讨论。
4. workflow 过去只检查 `ANTHROPIC_API_KEY` 是否非空，无法识别 secret 已过期、被撤销或填错；action 直到调用 SDK 才报 `Invalid API key` 并发布错误评论。

### 处理方式

在 [.github/workflows/review.yml](../.github/workflows/review.yml) 的 `Run Claude PR review` 前增加两段防护：

1. `Validate Anthropic API key`：调用 Anthropic `/v1/models` 做认证预检，仅当 HTTP 200 时继续执行 Claude action；否则写 Step Summary 并跳过自动审查，避免 action 发布 sticky error comment。
2. `Prepare Claude trusted config restore`：处理 `CLAUDE.md` symlink 快照问题。

```bash
if [ -L CLAUDE.md ]; then
  rm CLAUDE.md
fi
```

该删除只发生在 GitHub Actions checkout 工作区，不修改仓库内容；随后 `claude-code-action` 仍会从 `origin/feature/1.x.x` 恢复 base 侧可信 `CLAUDE.md`，保持安全模型不变。

### 后续防范

- 保留 `CLAUDE.md -> AGENTS.md` symlink，避免复制 Agent 指令造成 SSoT 分裂。
- 若后续 `claude-code-action` 修复 symlink 快照 bug，可移除此 workaround。
- `ANTHROPIC_API_KEY` 预检失败时应更新 GitHub Secret，而不是在代码中 hardcode key 或关闭自动审查 workflow。
- 不要把 `continue-on-error` 去掉；自动审查属于辅助反馈，不能阻塞主 CI。

### 同类问题影响与注意事项

- 任何被 action 视为 sensitive path 的 symlink（`.claude`、`.mcp.json`、`CLAUDE.md` 等）都可能触发同类问题。
- workaround 必须放在 action 调用前；放在 action 后只会清理结果，无法避免 sticky error comment。
- 该问题与 PR 业务代码无关；排查时需区分 “workflow success 但 action step failure” 与真正 CI failed check。

---

## [2026-05-07] CI Security Audit 因 pip / python-multipart 新 CVE 阻塞

### 问题描述

PR [#152](https://github.com/ThreeFish-AI/negentropy-perceives/pull/152) 的 GitHub Actions `Security Audit` Job 失败（[run 25491086046](https://github.com/ThreeFish-AI/negentropy-perceives/actions/runs/25491086046)）。`bandit` 静态扫描通过，失败点集中在 `pip-audit` 依赖漏洞扫描。

### 表因

`pip-audit` 输出：

```text
Found 2 known vulnerabilities, ignored 2 in 2 packages
Name             Version ID             Fix Versions
---------------- ------- -------------- ------------
pip              26.0.1  CVE-2026-6357  26.1
python-multipart 0.0.26  CVE-2026-42561 0.0.27
```

### 根因

1. `uv.lock` 锁定了 `pip==26.0.1`，该包由 `pip-audit -> pip-api -> pip` 工具链传递引入；`pip-audit` 默认扫描整个 venv，因此开发期审计工具链也进入漏洞面。
2. `python-multipart==0.0.26` 由 `mcp` / `mineru` 等依赖传递引入，属于项目运行时依赖图的一部分。
3. 两个 CVE 均已有修复版本（`pip>=26.1`、`python-multipart>=0.0.27`），不符合“暂无修复版本才加入 ignore”的例外条件。

### 处理方式

最小依赖升级：仅执行 `uv lock --upgrade-package pip --upgrade-package python-multipart`，更新 [uv.lock](../uv.lock) 中两个受影响包：

- `pip 26.0.1 -> 26.1.1`
- `python-multipart 0.0.26 -> 0.0.27`

同步清理 [.github/workflows/ci.yml](../.github/workflows/ci.yml) 中过期的 `CVE-2026-3219` ignore 项；该漏洞已随 `pip` 升级脱离当前锁文件，不应继续作为静默豁免保留。

### 后续防范

- `pip-audit` 新增漏洞时先区分“有修复版本”与“暂无修复或大版本跳升需兼容评估”：有修复版本优先小步升级 lock；只有无法安全升级时才进入集中 ignore 列表。
- 对 `pip` / `setuptools` / `wheel` / `pip-api` 这类审计工具链传递依赖，若已有修复版本，也应优先升级，避免把工具链漏洞长期沉淀为 CI 例外。
- 每次修改 `pip-audit --ignore-vuln` 列表时，必须同步检查是否存在已被 lock 升级覆盖的过期 ignore。

### 同类问题影响与注意事项

- `python-multipart` 是运行时依赖图的一部分，不能按“审计工具链自带依赖”处理；有修复版本时应升级而不是 ignore。
- `uv lock --upgrade-package` 可能连带更新求解器选出的其他包，提交前必须核对 `git diff uv.lock`，确认 blast radius 没有超出目标包。
- 若未来切换为 `uv export --format requirements-txt` 后再审计，工具链传递依赖（如 `pip`）是否还进入扫描范围会变化，需要同步更新本档案与 CI 注释。

---

## [2026-05-07] 默认配置下竞态 Stage 降级为单一最佳引擎

### 问题描述

`config.default.yaml` 中 6 个 Stage（PDF `layout_analysis` / `table_extraction` / `formula_extraction` / `code_detection`，WebPage `main_content_extraction` / `markdown_conversion`）默认 `competition_mode: true`，每次解析都并发运行 2~4 个引擎抢占式竞争。在 [2026-04-27] 七战线（超时分级 + 早胜取消 + 跨 stage 缓存 + MPS 强化 + prose 阈值放宽 + 引擎预热 + 图像并发动态化）落地后，rank=1 引擎在常态负载（学术论文、博客、技术文档）已稳定胜出，多引擎竞争退化为「等首胜 + grace 5s 取消」的无效空转：占用大量 CPU/GPU/内存却几乎从未改变最终结果，并把 5s grace 等待延伸到尾部延迟。

### 表因

- 6 个 Stage 的 `competition_mode` 初始默认值为 `true`
- 早胜取消 + LLM 评审等机制是「在多引擎竞争存在的前提下」的优化，不能取消多引擎并跑本身的资源代价

### 根因

1. 项目早期缺乏验证数据，把「AI 感知 stage 不稳定」作为先验默认开启竞态，作为对未知质量风险的兜底
2. [2026-04-27] 七战线已让 rank=1 在 81 页论文等代表性负载稳定胜出（docling/mineru 实测产出与最优结果一致），多引擎竞争对最终质量的边际收益≈0
3. 跨 stage docling `_ConvertCache` 让 layout/table/code 单跑 docling 仍能命中缓存（仅一次完整推理），不再依赖竞争模式来「顺带 warm 缓存」
4. fallback 路径（`scheduler._run_fallback`）无 stage 级 `wait_for` 硬切，rank=1 引擎可充分跑满 `task_timeout_seconds=900s` 顶层预算，「单引擎跑透」满足质量诉求
5. 资源占用与尾部延迟（grace 5s）都是默认开启竞态的成本，常态场景下不应让所有用户为小概率边缘情况埋单

### 处理方式

最小干预：仅改 YAML 与文档，调度器/缓存/LLM 评审代码零改动。

1. **`src/negentropy/perceives/config.default.yaml`**（6 处）：`competition_mode: true` → `false`，每处加内联注释说明默认行为 + opt-in 路径；`competition:` 子配置块（`max_concurrent` / `timeout` / `early_win_*`）原样保留，用户改单行 `competition_mode: true` 即时复活完整竞争能力
2. **`docs/framework.md`**：「两种执行模式」段落前增补默认行为元说明；mermaid 图中 `⚡ 竞争` 改为 `⚡ 可竞争`；PDF/WebPage Stage 表格的「模式」列改为 `降级（默认）/ 竞争（opt-in）`
3. **`docs/user-guide.md`**：调整「启用四大 PDF 引擎」段落措辞，新增「切换运行模式」小节，举例 YAML 覆写单个 Stage 的 `competition_mode`，并提示超大 PDF 可上调 `task_timeout_seconds`
4. **`CHANGELOG.md`**：Unreleased / 📦 变更段新增 BREAKING 条目（默认行为变更 + 动机三条 + 回退路径）

各 Stage 默认 rank=1 引擎：

| 阶段                              | 最佳引擎    | 关键依据                                                     |
| --------------------------------- | ----------- | ------------------------------------------------------------ |
| PDF `layout_analysis`             | docling     | reading-order / heading-level 最准确                         |
| PDF `table_extraction`            | docling     | TableFormer 结构化识别；与 layout 共享 `_ConvertCache`       |
| PDF `formula_extraction`          | mineru      | LaTeX 转换保真度最高                                         |
| PDF `code_detection`              | docling     | CodeFormula 代码块检测；与 layout/table 共享 `_ConvertCache` |
| WebPage `main_content_extraction` | trafilatura | 学术/博客主内容定位行业基线                                  |
| WebPage `markdown_conversion`     | markitdown  | Microsoft 维护，标准 HTML→MD 最稳定                          |

### 后续防范

- 行为变更属于 BREAKING（默认行为变更，非 API 破坏），需在 PR / CHANGELOG 显式提示，便于用户感知
- 不引入 `pdf_competition_default_enabled` 等全局开关——避免 SSoT 与 YAML 真相分裂
- 早胜取消、LLM 评审、跨 stage 缓存代码全保留，对应单测（`tests/unit/test_scheduler_competition.py` 等）继续守护 opt-in 路径
- 用户已显式写 `competition_mode: true` 的旧 YAML 经深度合并不受影响；新装机器从默认 YAML 直接拿到新行为

### 同类问题影响与注意事项

- **`pdf_stage_timeout_multiplier` 在 fallback 模式下不生效**：`scheduler._run_fallback` 不读 `competition.timeout`，因此 stage 倍率仅在用户启用竞争时复活；超大 PDF 单跑接近 `task_timeout_seconds=900s` 上限时，应通过 MCP 入参 `timeout=1800` 或 YAML 覆写 `task_timeout_seconds` 提高顶层预算，而非调 `pdf_stage_timeout_multiplier`
- **跨 stage docling 缓存仍生效**：`pdf/engines/_docling_kwargs.py::build_docling_init_kwargs()` 让 layout/table/code 三个 Stage 单跑 docling 时共享同一 hash → worker 内 `_ConvertCache` 命中，节省 2 次完整推理（≈300s）。该机制对单引擎模式更重要——不要在 follow-up 中误删
- **rank ≥ 2 工具保持 enabled=true**：作为 fallback 兜底链（与 S3 `text_extraction` rank 1/2/3 设计一致），rank=1 失败时 `_run_fallback` 顺序尝试，不会突然 stage 失败
- **`pdf_engine_warmup_enabled=true` 仍预热全部引擎**：默认改为单引擎后，预热 rank≥2 的 marker 等会浪费 ~200ms 时间窗，作为 follow-up 优化项（不在本次范围）
- **opt-in 路径完整保留**：`competition:` 子配置（`max_concurrent` / `timeout` / `early_win_*` / LLM 评审）原样未改，改 YAML 单行 `competition_mode: true` 即恢复，用户无需重写参数

---

## [2026-04-27] parse_pdf_to_markdown 多 Stage 兜底退化与 Apple Silicon MPS 回退

### 问题描述
对 81 页 OPENDEV 论文执行 `parse_pdf_to_markdown` 时，10 个 Stage 中有 5 个发生「兜底退化」：

- `layout_analysis`：docling/mineru/marker 三家重型引擎全部 120s 超时 → pymupdf 兜底胜出，失去 reading-order/heading-level 高质量产出；
- `table_extraction`：docling 60s 超时；pymupdf 抽出候选后**70+ 页全部触发 `prose_like_cells` 过滤丢弃**，最终 markdown 表格数 = 0（论文实有 Table 1/2/3/6/8 等多张真实表格）；
- `formula_extraction`：mineru / docling 双双 60s 超时，仅 `pymupdf_heuristic` 兜底；
- `code_detection`：docling 30s 超时，仅 `algorithm_detector` 兜底；
- `image_extraction`：pymupdf 91s 抽 18 张图（每页 5s），单引擎无并发竞争。

总耗时 262s 但产出严重退化。日志同时显示 docling 子进程内 `MPS is not available in the system. Fall back to 'CPU'`，Apple M 系列 GPU 算力被弃用。

### 表因
- 各 Stage 默认 timeout（120/60/60/30s）对 81 页论文的重型模型推理过严；
- `_table_quality_score` 的 prose 检测信号 a（rows>20 + cols∈[2,5]）误杀学术真实长表（行多列少型）；
- docling 子进程冷启动后被 SIGTERM，跨 stage 重复 spawn 浪费 ~20s；
- `_preinit_torch_device` 仅做 `torch.zeros(1, device="mps")` first-touch，张量被 GC 后 MPS 状态可能退化，docling 内部 `is_available()` 复查失败。

### 根因
1. **超时一刀切**：超时配置假设了「快速兜底胜出」的语义，但当 pymupdf 总能瞬完成时，重型引擎从未有机会胜出 → 竞态退化为 fallback；
2. **无首胜取消**：scheduler `_run_competition` 用 `asyncio.as_completed` 永不主动 cancel，慢任务空转到 deadline 浪费算力；
3. **跨 Stage 不复用**：layout/table/formula/code 四个 Stage 各自向 EngineWorkerPool 发送独立 docling.convert 调用，init_kwargs 不一致 → worker 子进程内 `_ConvertCache` 完全 miss；
4. **MPS first-touch 不充分**：单 zeros(1) 的张量被 GC 后，docling 内部 `torch.backends.mps.is_available()` 判定 False；
5. **prose_like_cells 偏置**：信号 a 的 `rows>20 + cols<=5` 条件与学术论文真实长表（参数对比 / 消融实验 / 配置清单）严重重叠。

### 处理方式
分七条正交战线，详见 commit 与 [docs/development.md](development.md)：

1. **超时分级**：layout=360s / table=300s / formula=300s / code=120s；顶层 `task_timeout_seconds: 900`；新增 `pdf_stage_timeout_multiplier` 全局倍率；
2. **早胜取消**：`StageScheduler._run_competition` 新增 `early_win_cancel/min_rank/grace_seconds` 参数；rank=1 工具胜出后 grace 期内取消其余候选；
3. **跨 Stage 复用**：抽取 `pdf/engines/_docling_kwargs.py::build_docling_init_kwargs()` 帮助器，所有 4 个 docling stage 共享同一 init_kwargs hash → 子进程 `_ConvertCache` 命中节省 3-4 次完整推理；
4. **MPS 强化 first-touch**：`_preinit_torch_device` 改为 randn(1024,1024) + matmul + 模块级 `_MPS_PIN` 锚定张量引用，防止 GC 释放 MPS 设备状态；新增 `pdf_docling_force_cpu` / env `NEGENTROPY_DOCLING_FORCE_CPU` 兜底回退；
5. **prose 阈值放宽**：信号 a 阈值 rows>20→50、cols<=5→3；信号 b 断裂率 0.3→0.5；新增 `pdf_table_quality_bypass_with_title=true`，含 `Table N:` 标题的候选自动旁路 prose 检测；
6. **引擎预热**：`EngineWorkerPool.warmup(engine)` 新方法 + `convenience.run_pdf_pipeline` 在 preprocessing/quick_scan 期间异步触发，把 ~2-12s 冷启动开销移出 layout_analysis 关键路径；
7. **图像并发动态化**：`_resolve_concurrency()` 从 `pdf_image_extraction_concurrency` 读取（默认 8，M 系列芯片优化），保留 `_IMAGE_EXTRACT_CONCURRENCY=4` 兼容历史。

### 后续防范
- **预算上限**：`task_timeout_seconds=900` 顶层兜底，单任务永不超过 15 分钟；
- **降级链**：每条战线独立可关闭（`early_win_cancel=false` / `pdf_docling_force_cpu=true` / `pdf_engine_warmup_enabled=false` / `pdf_table_quality_filter_enabled=false`），出问题可快速回退；
- **可观测性**：scheduler 日志在早胜取消时显式打印 `tier-1 工具 X 胜出，立即/缓冲后取消其余 N 个`；worker 内 `_ConvertCache` 命中打印 `convert cache hit fingerprint=...`，便于验证跨 stage 复用率。
- **测试**：`tests/unit/test_table_quality_filter.py`（新增 7 个 prose 用例）、`tests/unit/test_scheduler_competition.py`（新增 6 个竞态用例）、`tests/unit/test_engine_worker_warmup.py`（新增 7 个预热用例）、`tests/unit/test_docling_init_kwargs.py`（新增 4 个跨 Stage 哈希一致性用例）。

### 同类问题影响与注意事项
- **用户 yaml 不会自动同步**：`~/.negentropy/perceives.config.yaml` 中的 stage timeout 仍是旧值（120/60/30s）；用户可通过 `pdf_stage_timeout_multiplier=3.0` 在不改 yaml 的情况下放宽；新装机器从 `config.default.yaml` 直接拿到新默认。
- **早胜取消默认仅 PDF Pipeline 启用**：webpage pipeline 未配置 `early_win_*` → 行为不变。
- **MPS pin 张量保留 ~12MB 内存**：1024×1024 float32 共 ~4MB × 3 个 tensor，对 16GB+ 机器可忽略；如内存敏感可设 `pdf_docling_force_cpu=true` 跳过 MPS。
- **docling 仍可能内部触发 CPU 回退**：当 docling 自身的 accelerator_utils 因其它原因（如 PyTorch 版本兼容性）判定 MPS 不可用时，`AcceleratorOptions(device=MPS)` 仍会被 docling 内部下调到 CPU，本次仅修复 first-touch 不充分导致的回退；其它原因需在 docling 上游解决。

---

## [2026-04-26] parse_pdf_to_markdown 图片传输从 base64 切换为磁盘落盘 + MCP Resource URI

### 问题描述
`parse_pdf_to_markdown` 把图片以 base64 字符串嵌入 MCP 响应体（`PDFResponse.image_assets[*].base64_data`），默认上限 32MB。响应体冗长导致 MCP 客户端/日志无法快速预览内容，且跨主机场景下 base64 字符串并非高效的文件传输手段。

### 表因
设计之初为补齐"Pipeline 只返回 `images_count` 而无像素数据"的缺口，选择了 base64 内嵌 + 三道护栏（开关门控、单图重压缩、总量上限）。但响应体内嵌大体积 base64 违背了 MCP 协议"结构化 JSON + 独立资源"的设计理念。

### 根因
1. MCP 协议原生支持 Resources（`resources/read`）用于二进制文件跨主机传输，但项目未利用该能力。
2. 现有 S9 资源打包 Stage 已把图片落盘到 `<output_dir>/images/`，但落盘路径未透出到响应。
3. FastMCP 3.2.4 提供 `FileResource` + `app.add_resource()` 动态注册 API，支持按需读盘返回字节，但项目未集成。

### 处理方式（Breaking Change）
- **数据模型**：`ImageAssetModel` / `ImageAsset` 移除 `base64_data`、`downscaled` 字段；新增 `image_path`（落盘绝对路径，必填）与 `resource_uri`（MCP Resource URI，由 tool 层注册后回填）。
- **落盘逻辑**：`_build_image_assets` 重写为"原字节写盘 → 返回指针"；删除 `_downscale_to_jpeg` 及三个 base64 护栏配置项。
- **MCP Resource 注册**：`tools/_image_resources.py` 新增 `register_pdf_response_images` / `register_batch_pdf_response_images`，为每个图片注册 `perceives://pdf/<job_id>/<filename>` URI 的 `FileResource`，客户端通过 `resources/read` 跨主机拉取。
- **配置清理**：`config.py` 删除 `pdf_bundle_images_in_response` / `pdf_image_max_base64_kb` / `pdf_bundle_total_base64_mb`。

### 后续防范
- 跨主机客户端迁移路径：读 `image_path`（共享卷）或调 `resources/read(resource_uri)`。
- MCP Resource 生命周期：驻留 server 进程内存，重启失效；磁盘文件由用户管理 `output_dir`。
- 若大量解析造成内存累积，后续可叠加 job_id LRU 清理。

### 同类问题影响与注意事项
- **Breaking Change**：客户端代码如读取 `base64_data` 或 `downscaled` 字段将报错。需改为读取 `image_path` 或 `resource_uri`。
- `docs/user-guide.md` 已移除三个已删除的环境变量说明。
- `tests/unit/test_asset_bundling_base64.py` 已重写为 `test_asset_bundling_disk_export.py`。

---

## [2026-04-26] CI Security Audit 因新 CVE-2026-3219 阻塞主管线

### 问题描述
GitHub Actions 在 `master` 与 `feature/1.x.x` 上的 `CI` workflow 失败（[run 24956281994](https://github.com/ThreeFish-AI/negentropy-perceives/actions/runs/24956281994)）。失败 Job 为 `Security Audit`，失败步骤为 `Run pip-audit vulnerability scan`，致使后续 `Test on macos-latest` / `Test on windows-latest` 因依赖关系被跳过。

### 表因
`pip-audit` 在该步骤里以非零码退出，输出：
```
Found 1 known vulnerability, ignored 1 in 1 package
Name Version ID            Fix Versions
---- ------- ------------- ------------
pip  26.0.1  CVE-2026-3219
```
`Fix Versions` 列为空。

### 根因
1. `pip-audit` 默认扫描整个虚拟环境的全部已安装包。`pip-audit` 自身依赖链 `pip-audit → pip-api → pip` 把 `pip` 拉入 venv（参考 `uv.lock` 中 `name = "pip"` 与 `pip-api` 段落）。因此 `pip 26.0.1` 出现在 audit 范围内。
2. 项目本体（`pyproject.toml`）从不直接依赖 `pip`，运行时也不调用 `pip`。该告警源自审计工具链本身，与产品代码无关。
3. CVE-2026-3219 在公告库中暂无修复版本（`Fix Versions` 为空），无法通过升级解决。
4. `.github/workflows/ci.yml` 的 ignore 列表此前覆盖 `CVE-2026-4539` / `CVE-2025-64340` / `CVE-2026-27124` / `CVE-2026-1839`，未含 `CVE-2026-3219`，所以新 CVE 一出现就阻塞主管线。

### 处理方式
- **`.github/workflows/ci.yml`**：把 `CVE-2026-3219` 追加到 `pip-audit --ignore-vuln` 列表，并把命令改为反斜线续行排版，便于后续审计 ignore 项；同步在脚本注释中说明：「pip 26.0.1 暂无修复版本；pip 由 `pip-audit→pip-api` 传递引入，非项目运行时依赖」。
- 不升级 `pip` / `pip-audit` / `fastmcp` / `transformers` 等依赖，亦不重写 audit 流程为 requirements-only / 隔离 venv，遵循「最小干预」原则；待上游 fix 出现或通过 `Update Dependencies` 自动 PR（`.github/workflows/dependencies.yml`）滚动评估。

### 后续防范
- `pip-audit` 出现 `Fix Versions` 为空、且漏洞包属于审计工具链或开发期工具的传递依赖时（pip / setuptools / wheel / pip-api 等），按「先记录到 `docs/issue.md`、再加入 ignore 列表」的固定流程操作，避免随手 ignore 造成审计盲点。
- ignore 列表禁止散落在多处；统一在 `ci.yml` `Run pip-audit vulnerability scan` 步骤中维护，并保留逐条 CVE 注释（漏洞包、版本、是否有 fix、忽略原因）。
- 周期性（建议每月或在每次 `dependencies.yml` 触发产生 PR 时）回顾 ignore 列表，确认上游是否发布了 fix 版本，及时清理过期 ignore。

### 同类问题影响与注意事项
- 同类阻塞会在 `pip-audit` 检出任何新公告时复发，不限于 `pip` 自身：`setuptools` / `wheel` / `pip-api` / `requests` 等审计工具链或开发期工具的传递依赖一旦中招，机制相同。
- 这类工具链漏洞与项目运行时安全姿态无关，不应阻塞主管线；但**不能扩展为静默忽略**——必须留下逐条注释与 issue 档案，便于审阅时判断风险面与跟进 fix。
- 长期方案候选（不在本次范围）：将 `pip-audit` 切换为「仅扫描 `uv export --format requirements-txt` 产物」或「在隔离 venv 中运行 audit」，把审计范围收敛到运行时依赖。决策前需评估新增 CI 时长与对开发期 lint 工具漏洞的可见性损失。

## [2026-04-26] parse_pdf_to_markdown 输出 Markdown 头部丢失首页（标题/作者/Abstract）

### 问题描述
`parse_pdf_to_markdown` 处理 `assets/2603.05344v3.pdf` 时，输出 Markdown 的头部不再是源 PDF 首页内容（标题「Building Effective AI Coding Agents for the Terminal」、作者、Abstract、「1 Introduction」开头），而是把第二页起的「Figure 1: Overview of OPENBOX...」放到了文档最前。

### 表因
直接调用 PyMuPDF (`page.get_text("blocks")`) 在源 PDF page 0 能取到全部 12 个文本块（标题/作者/Abstract/Introduction），坐标合理；但管线最终输出却把页 2 之后的算法块/图注挪到了首位。问题出现在「上游各 Stage 的 page_number 语义不一致」与「assembly 排序键依赖该字段」之间。

### 根因
1. **页码语义跨 Stage 漂移**：`pdf/engines/docling.py::_get_page_number()` 直接透传 Docling 的 1-based `prov[0].page_no`，而 PyMuPDF 链路（`text/image/table_extraction`、Camelot 显式 `page-1`）全部 0-based。Docling 表格/代码块从而被锚定到「下一页」的位置，与 PyMuPDF 文本流错位混排。
2. **`DoclingTextExtractor` 把所有段落 `page_number` 硬编码为 0**（`text_extraction.py:191`）：当文本提取走 Docling 路径时，整本书全部坐落在 page 0，与图表的真实页码彻底冲突。
3. **`AlgorithmCodeDetector` 不带 page_number / bbox**（`code_detection.py`）：把整本 PDF 文本拼成一个 `full_text` 后扫描算法块，结果所有 `ExtractedCodeBlock` 都以 `page_number=0`、`bbox=None` 落到 assembly。`assembly` 用 `(page, y0)` 排序，缺 bbox 时 `y0=reading_order*100=0`，把这些「分散在第 2-N 页」的算法块全部挤到 page 0 顶端，盖住了真正的首页文本。
4. **Docling BBox 默认 `coord_origin=BOTTOMLEFT`，PyMuPDF 默认 TopLeft**：直接把两套 y0 喂进同一个排序键，越靠上的 Docling 元素 y0 越大，反而排到 PyMuPDF 元素之后。
5. **`DoclingTable`/`DoclingImage` 数据类有 `bbox` 字段但 `_extract_tables`/`_extract_images` 从未填充**，跨类型排序失去 y0/x0 锚点，全靠 `reading_order * 100` 兜底，跨 Stage 协调失效。
6. 最近 commit `e94d2dc` 把 assembly 排序键从 `(page, reading_order)` 改成 `(page, y0)`，把上述全部隐藏的页码错位放大成了用户可见的「首页消失」。

### 处理方式
- **`pdf/engines/docling.py`**：
  - 新增常量 `_DOCLING_PAGE_OFFSET=1` 与 `_normalize_docling_page_no()` / `_get_raw_page_no()` / `_get_page_height()` / `_to_topleft_bbox()`，在 Docling 数据进入项目域的边界一次性归一化为「0-based 页码 + TopLeft bbox」。
  - `_get_page_number()` 改为返回 0-based；`_collect_figure_regions()` 与 `_filter_figure_internal_texts()` 内 `_get_bbox` 同步使用 `_to_topleft_bbox`，确保 figure 区域与 item bbox 同坐标系比较。
  - 新增 `DoclingTextBlock` 数据类与 `_extract_text_blocks()`：仿照 `_extract_code_blocks` 走 `doc.iterate_items()`，对 `title/section_header/paragraph/text/list_item/footnote/caption` 标签捕获 `text/page_no/bbox/heading_level`，并填入 `DoclingConversionResult.text_blocks`。
  - `_extract_tables()` / `_extract_images()` 补 `bbox=_to_topleft_bbox(...)` 字段填充。
- **`pipeline/stages/pdf/text_extraction.py`**：`DoclingTextExtractor._run` 优先消费 `result.text_blocks`，每个 `TextBlock` 携带正确页码与 bbox；`text_blocks` 为空时降级到 `_fallback_markdown_split()`（旧的按 `\n\n` 切段路径），保障向后兼容。
- **`pipeline/stages/pdf/code_detection.py`**：`AlgorithmCodeDetector` 改为「逐页扫描」，把 `page_idx` 直接写入 `ExtractedCodeBlock.page_number`；同时把 Docling/Marker 路径里 `cb.page_number or 0` 改为 `if ... is not None else 0`，避免把 0-based page=0 误判为「无页码」。
- **`pipeline/stages/pdf/{table,formula}_extraction.py`**：相同的 `or 0` → `if ... is not None else 0` 清理。
- **`pipeline/stages/pdf/assembly.py`**：sort_key 升级为四级稳定序「`(page, y0, x0, reading_order)`」；page 加 `max(0, ...)` 防御兜底。`x0` 作为多列布局列序兜底，`reading_order` 作为同坐标稳定序兜底。
- **`tests/integration/test_pdf_first_page_regression.py`（新）**：调用真实 `run_pdf_pipeline(2603.05344v3.pdf)`，断言「标题在前 500 字符内」「Abstract 在前 1500 字符内」「Introduction 在 Figure 1 之前」「标题在 'Overview of OPENBOX' 之前」。`@pytest.mark.slow` 隔离慢测；缺资产或缺 docling 时 skip。
- **既有单测对齐**：`tests/unit/test_docling_engine.py` 与 `tests/unit/test_figure_text_filter.py` 关于 `page_no` 的断言更新到 0-based；新增 `_normalize_docling_page_no` 的边界用例。

### 二次修复（Code Review 反馈）

合入前的 Code Review 暴露了首版补丁的三处实现缺陷，再次修订：

- **`_to_topleft_bbox` 的 BL→TL 转换 y0/y1 写反**：`_extract_bbox_tuple` 始终按 `(l, t, r, b)` 解包，BOTTOMLEFT 下 `t > b`，正确公式为 `(x0, page_h - y0, x1, page_h - y1)`，原写法 `(x0, page_h - y1, x1, page_h - y0)` 仍输出 `y0 > y1`（颠倒），会让 `figure_text_filter.is_text_inside_figure` 的 `iy1 <= iy0` 永远为真 → BL 数据下图内文字过滤完全失效。新增 `test_to_topleft_bbox_bottomleft_returns_canonical_topleft` / `test_to_topleft_bbox_topleft_passthrough` 覆盖。
- **`caption` 不应进入 `_TEXT_LABELS`**：表格/图片标题已由 `ExtractedTable.caption` / `ExtractedImage.caption` 在 assembly 阶段渲染，再作为段落输出会让同一段标题在最终 Markdown 中出现两次。从 `_TEXT_LABELS` 移除 `caption`，新增 `test_extract_text_blocks_excludes_caption_label` 守护。
- **`_extract_text_blocks` 绕过图内文字过滤**：原实现仅 `_filter_figure_internal_texts` 修改 `markdown` 字符串，新增的 `text_blocks` 路径不应用同一过滤，导致轴标签/图例/注释等图内文字重新混入正文。`_extract_text_blocks` 现接受可选 `figure_regions` 参数（不传则自行 `_collect_figure_regions`），对 `text` / `paragraph` 段落复用 `is_text_inside_figure` 剔除图区域命中条目，并通过 `is_caption_text` 兜底保留显式标题。新增 `test_extract_text_blocks_filters_figure_internal_text` 覆盖三种典型场景（图内、图外、显式标题）。

### 后续防范
- 「跨 Stage 协调字段（页码/坐标系/单位）必须在边界归一化一次」是本类问题的通用原则。后续接入新的 PDF 引擎（Marker、Unstructured 等）时，必须在该引擎的 `_extract_*` 输出口完成 0-based 页码 + TopLeft bbox 的归一化，**不要**留给下游 Stage 再适配。
- assembly 的排序键不应随手改动；任何跨 Stage 排序变更都应附带「跨页混排」的回归用例。`tests/integration/test_pdf_first_page_regression.py` 是该类回归的最小定式。
- `or 0` 在带页码字段上是反模式：它会把合法的 0-based 首页页码与「未提供」的 None 混为一谈，掩盖上游 bug。统一使用 `x if x is not None else 0`。
- 任何「按全文聚合扫描」的 Stage（如 `AlgorithmCodeDetector`）必须保留页定位信息，否则 assembly 永远没法正确排序。改为「按页扫描 + 页码绑定」是可复用范式。

### 同类问题影响与注意事项
- 凡是依赖 `prov[0].page_no` 的 Docling 数据点（包括未来新增的 `formulas`/`text_blocks`/`tables`/`pictures`/`code_blocks`/`captions`）都要走 `_get_page_number(item)` / `_normalize_docling_page_no(...)`；不要再写 `getattr(prov[0], "page_no", None)`。
- 凡是来自 Docling 的 `bbox` 都应经过 `_to_topleft_bbox(...)`；`figure_text_filter` 已经按 TopLeft 假设进行重叠判定。
- MPS 路径下 Docling 公式 enrichment 默认关闭（`do_formula_enrichment=False`），`DoclingFormula` 走 markdown 正则恢复且不带 page_no——这属于既存能力下限，不在本次修复范围；assembly 的 `max(0, page)` 兜底足以避免它把 page=0 错排。
- `_collect_figure_regions` 与 `_filter_figure_internal_texts` 必须同时使用同一坐标系（TopLeft）与同一页码语义（0-based），否则会出现「图区域永远不命中」或「全部正文被当作图内文字过滤」两种极端误差。

<a id="ref-docling-coord-origin"></a>[1] Docling Project, "BoundingBox.coord_origin," *Docling Core Documentation*, 2026. [Online]. Available: https://docling-project.github.io/docling/reference/


## [2026-04-22] parse_webpage_to_markdown 图片元素丢失（Phase 1 / 2 / 3）

### 问题描述
用户上报 `parse_webpage_to_markdown` 在真实网页（如 `https://www.anthropic.com/engineering/harness-design-long-running-apps`）下的 Markdown 输出出现如下问题：
- 大段正文 `<p>` 元素缺失（约 87% 内容丢失）
- `<video>`/`<iframe>`/`<embed>` 媒体元素缺失
- Next.js `/_next/image?url=...` 代理 URL 未解析为真实 CDN 地址
- 文章内 `Opening screen` / `Sprite editor` / `Game play` 三张配图（属 `MediaCarousel` 容器）完整丢失

### 表因
`preprocess_html()` 后段 `<p>` 与 `<img>` 数量远低于 `extract_content_area()` 阶段；`<video>` / `<iframe>` 直接消失；Markdown 中的图片 URL 仍指向代理域或根本没有图片条目。

### 根因
1. **Phase 1 — CSS Module 类名误匹配**：`unwanted_patterns` 使用 `.*(ad|...).*` 正则去匹配 class/id，CSS Module 类名（如 `reading-column`）中子串 `ad` 被命中，整段正文 `<p>` 被 `decompose`。
2. **Phase 2 — 媒体元素未转 Markdown 友好形式**：`<video>`/`<audio>`/`<iframe>`/`<embed>`/`<object>` 既未被保留也未被转链接；Next.js 图片代理 URL 未被解析为真实 CDN URL。
3. **Phase 3a — trafilatura `<img>` 降级为 TEI `<graphic>`**：`trafilatura.extract(output_format='html')` 会把 `<img>` 改写成 `<graphic>`；下游 `_convert_media_elements` / MarkItDown / html2text 仅识别 `<img>`，图片全量丢失。
4. **Phase 3b — 懒加载 / srcset-only**：真实 URL 放在 `data-src`/`data-srcset` 或只有 `srcset` 时，`<img>` 因无 `src` 被判为空。
5. **Phase 3c — trafilatura 整页丢图**：某些 Next.js / 复杂 figure 结构下 trafilatura 会直接丢弃全部图片（既非 `<graphic>` 也非 `<img>`）。
6. **Phase 3d — 媒体轮播被当广告整体移除**：`unwanted_patterns` 中 `carousel|slider|gallery|swiper|slick|modal|dialog|overlay|tooltip|popover|toast` 对 CMS 正文 `MediaCarousel` 容器过度误杀。

### 处理方式
- 为 `ad|sidebar|nav|menu` 添加词边界约束 `(?<![a-zA-Z0-9])...(?![a-zA-Z0-9])`，避免 CSS Module 子串误命中。
- 新增 `_convert_media_elements()`：`<video>/<audio>` → `[视频]/[音频]` 链接；`<iframe>`（YouTube/Vimeo/Bilibili）→ 平台播放页链接；`<picture>` 展平；`<embed>/<object>` 视频转链接；Next.js 代理 URL 解析回真实 CDN URL。
- 扩展 `_basic_cleanup()` 防御性清理残余 `video|audio|picture|source|iframe|embed|object` 标签。
- 新增 `_rehydrate_trafilatura_graphics()`：S4 `TrafilaturaTool` 输出口将 `<graphic>` 就地改名为 `<img>`，保留全部属性。
- 懒加载兜底：当 `src` 缺失或为占位符时，顺序从 `data-src`/`data-original`/`data-lazy-src`/`data-url` 迁移真实 URL；若仅有 `srcset`，取最高分辨率回填 `src`；`srcset` 中的 Next.js 代理也解析后回写。
- 轮播图片保护：`unwanted_patterns` 命中的容器若含 `<img>/<figure>/<picture>/<video>/<audio>`，跳过移除。
- trafilatura 整页丢图兜底：`raw_html` 含 ≥3 张图而主内容 0 张时，`TrafilaturaTool` 主动返回失败，触发 S4 竞争模式降级到 `readability` / `beautifulsoup_heuristic`。

### 后续防范
- 任何 `find_all(class_=pattern)` / `find_all(id=pattern)` 的 `.*` 通配正则都必须上词边界，杜绝 CSS Module 哈希误命中。
- 凡对 CMS/语义容器（carousel/gallery/modal/slider 等）执行整体 `decompose` 前，必须先做“内容元素保护”判定，避免误杀正文媒体。
- S4 / S10 类“多工具竞争”Stage 中的单个工具若对输出做了**格式改写**（如 TEI `<graphic>`），应在工具出口处就地归一化为标准 HTML，不让歧义格式外泄到下游。
- S4 这类“可能整体丢内容”的工具，应在输出口设兜底检查，一旦发现关键信号（图片、正文长度）严重偏离 `raw_html`，主动返回失败由竞争模式降级，而不是静默输出劣化结果。

### 同类问题影响与注意事项
- 其他依赖 `beautifulsoup_heuristic` 启发式路径的 Stage（如后续新增的抽取工具）若做类似“整体删除”，也需套用“内容元素保护”逻辑。
- 所有走 `output_format='html'` 的外部抽取库（如 readability 未来版本、article-extractor 等）都应假定可能存在非标准标签，建议在 S4/S5 出口统一做一次 BS4 归一化。
- 懒加载兜底也适用于 `<picture>` 内的 `<source>`；需注意某些站点（如 Medium）会把真实 URL 放在 `data-*` 外的自定义属性，必要时扩展兜底属性集合。

## [2026-04-22] parse_pdf_to_markdown 四工具全报 AttributeError 并触发 300s 兜底超时

### 问题描述
`parse_pdf_to_markdown` 在 `assets/2603.05344v3.pdf` / `assets/Context Engineering 2.0 - The Context of Context Engineering.pdf` 等 PDF 上失败，MCP 日志出现三连反应：
- `layout_analysis` 四工具（Docling / MinerU / Marker / PyMuPDF）同时报 `'DocumentCharacteristics' object has no attribute 'local_path'`；
- Stage 全败后触发旧版 Docling 全文档兜底路径，卡死在 300 秒超时；
- 会话最终以 `anyio.ClosedResourceError` 抛出，MCP 通道被阻塞。

用户进一步要求 **Docling/MinerU/Marker/PyMuPDF 四工具在 `layout_analysis` 中必须“全部可用且被充分利用”**。

### 表因
`layout_analysis` 各工具从入参读 `local_path` 时拿到的是 `DocumentCharacteristics` 实例而非 `PreprocessingOutput`，直接抛属性不存在；旧版兜底路径本就慢（300s），Stage 失败又触发它，最终 MCP 超时断链。

### 根因（三层叠加）
1. **L1 输入路由错配**：`PipelineOrchestrator.run()` 采用“上一 Stage 的 output 即下一 Stage 的 input”的隐式链式语义。S1 `quick_scan` 的 output 是 `DocumentCharacteristics`，会覆盖 `current_input` 里 S0 的 `PreprocessingOutput`，于是 S2 `layout_analysis` 及其后所有需要 `local_path` 的 Stage 全部拿错输入；同时 `assembly`/`asset_bundling` 这种需要**汇聚多个前序 Stage 结果**的复合输入，也根本无法用单一链式语义构造。
2. **L2 竞争并发上限硬截断**：`StageScheduler._run_competition()` 第 133 行 `candidates = tools[:max_concurrent]`；`layout_analysis` 配了 4 个工具但 `max_concurrent: 2`，rank=3 的 Marker 与 rank=4 的 PyMuPDF **完全不进入竞争调度**，用户观感是“只有两个工具在跑”。
3. **L3 引擎门控 + 依赖不可达**：`settings.docling_enabled / mineru_enabled / marker_enabled` 默认均为 `False`，被 `_apply_engine_gates()` 提前过滤；mineru / marker 又属于 `pyproject.toml [all-engines]` 可选依赖组，默认 `uv sync` 装不上，双重过滤导致三引擎在开箱即用下根本进不了场。

### 处理方式
- **Phase 1 · 数据路由（YAML 声明式）**：
  - `pipeline_config.StageConfig` 新增 Optional 字段 `input_from` / `input_builder`；
  - `PipelineOrchestrator.__init__` 新增 `input_builders: Dict[str, Callable]` 参数；
  - 新增 `_resolve_input(stage_cfg, results, initial_input, chain_input) -> (resolved, error)`，按「`input_builder` 优先 → `input_from` → `chain_input`」顺序解析每个 Stage 的输入；缺失/失败返回结构化错误而非抛 `AttributeError`；
  - `run()` 顺序组对每个 Stage 先 resolve 再 execute；并行组对组内每个 Stage 各自 resolve 后再 `asyncio.gather`，杜绝同一 `current_input` 污染不同并行 Stage；
  - `convenience._PDF_INPUT_BUILDERS` 注册 `assembly` / `asset_bundling` 两个复合构造器，分别汇聚 preprocessing/layout/text/tables/formulas/images/code 与 assembly/image_extraction/preprocessing；
  - `config.default.yaml` 的 `pipeline.pdf.stages` 各 Stage 显式声明 `input_from: preprocessing` 或 `input_builder: <key>`；webpage 分支不改（保持链式语义）。
- **Phase 2 · 四工具充分利用**：
  - `config.default.yaml` 放开 `layout_analysis.max_concurrent` 2→4、`table_extraction.max_concurrent` 2→4、`formula_extraction.max_concurrent` 2→3，让“声明工具数 == 参与竞争数”；
  - `config.py` 将 `docling_enabled / mineru_enabled / marker_enabled` 默认值从 `False` 翻转为 `True`，语义下沉为“允许参与调度；真实是否运行由 `is_available()` 能力检测决定”，未装依赖仍自动跳过；
  - `scheduler._resolve_tools()` 将工具 `is_available()=False` 跳过日志从 `debug` 提升为 `info`，并打印 `Stage 'X' 参与竞争 tools=[...]（声明=[...]，已过滤不可用）`；
  - `convenience._log_pdf_engines_summary_once()` 在首次调用 PDF 管线时 INFO 级打印 `[PDF engines] docling=ok(...), mineru=..., marker=..., pymupdf=ok(...)` 摘要，缺失引擎给出 `uv sync --extra all-engines` 指引。
- **Phase 3 · 文档闭环**：`docs/user-guide.md` 新增「启用四大 PDF 引擎」章节，给出 extras 安装命令与启动日志样例；同步更新 CHANGELOG 与本档。

### 后续防范
- Stage 间输入来源必须由 YAML 显式声明，严禁再依赖“上一 Stage 的 output 作为下一 Stage 的 input”的隐式约定——隐式链式语义遇到复合输入或多分支时必然断链。
- `competition.max_concurrent` 原则上等于声明工具数；若出于资源考虑要收紧，必须在注释中写明原因并确保 rank 靠后的工具在业务上确实是“备胎”。
- 引擎能力检测只允许有**一个事实源**：优先 `is_available()`（运行时可导入）；`*_enabled` 配置项退化为“显式关闭开关”，不承担能力判定。
- 新加 Stage 时，若输入需要来自非紧邻的前序 Stage 或多个前序 Stage，先在 `convenience` 注册构造器并在 YAML 用 `input_builder: <key>` 声明；单一前序用 `input_from: <name>`。

### 同类问题影响与注意事项
- webpage 管线当前通过 `StageContext` 这个**可变聚合对象**在 Stage 间共享状态，与 PDF 的 dataclass 纯值传递是两套机制；`input_from` 对 webpage 不产生影响，但未来若 webpage 也要切到纯值传递，应复用同一路由机制。
- `EngineWorkerPool` 已对每个 PDF 引擎做进程级串行化锁，`max_concurrent=4` 即便四个子进程同时启动，实际仍会串行执行昂贵模型推理，不会 OOM；但若未来引入无锁引擎需重新评估。
- 任何“竞争模式 Stage 声明 N 个工具”的改动都要同步检查 `max_concurrent ≥ N`，否则 rank 靠后的候选将无声丢失——这是 pipeline 层长期隐性缺陷，新增 Stage 时需自查。
- 引擎门控默认值翻转为 `True` 后，CI 环境若原先依赖 `*_enabled=False` 隐式禁用某引擎，应改用环境变量 `NEGENTROPY_PERCEIVES_DOCLING_ENABLED=false` 或 YAML 显式覆盖。

## [2026-04-22] PDF 管线二次修复：MinerU backend / PyMuPDF 表格 caller / 模型预热缺位

### 问题描述
前一次（Phase 1~3）修复落地后，再次跑 `parse_pdf_to_markdown`，日志暴露三处独立缺陷：

1. MinerU 子进程秒级报错 `Invalid value for '-b' / '--backend': 'vlm-mlx-engine'`，`exit_code=2`；
2. Marker 在用户请求中现场下载 `layout/2025_09_23` 模型（总量 ~1.35GB），下载到 131M/1.35G 时被 `layout_analysis` 120s 工具超时取消，最终 Stage 以 `Stage 'layout_analysis' 工具 'marker' 超时` 结束；
3. `table_extraction` 的 PyMuPDF 分支 100% 报 `EnhancedPDFProcessor.extract_tables_with_geometry() missing 1 required positional argument: 'text_blocks'`。

用户明确要求：在修复以上三项的同时，**将引擎模型通过“预触发”方式在请求外下载**，避免首请求 1.35GB 下载必超时。

### 表因
- `layout_analysis` / `formula_extraction` 中 MinerU 工具即时失败（CLI 拒绝 backend 值）；
- `layout_analysis` 中 Marker 工具在 ~120s 处超时取消（正在下载模型）；
- `table_extraction` 中 PyMuPDF 工具每次立即抛 `TypeError: missing positional argument: 'text_blocks'`。

### 根因
1. **D1 · MinerU backend 字符串错误**：`pdf/engines/mineru.py` 在 `device=mps` 与 Apple Silicon 自动检测分支把 `_resolved_backend` 硬编码为 `vlm-mlx-engine`。MinerU CLI `--backend` 的合法值只有 `pipeline / vlm-http-client / hybrid-http-client / vlm-auto-engine / hybrid-auto-engine`；`vlm-mlx-engine` 并不存在，触发 Click 的参数校验失败。
2. **D2 · 模型下载延后到首请求**：三个引擎（docling/mineru/marker）的 `is_available()` 只检查 import，`create_model_dict()` / `DocumentConverter(...)` 的模型拉取延后到第一次 `convert()` 调用。Marker layout 模型 ~1.35GB，常规家宽下载远超 120s 工具超时上限，且超时后 HuggingFace Hub 缓存可能处于半下载状态；此外，仓里没有任何预热入口可供运维在部署阶段离线拉取。
3. **D3 · PyMuPDF 表格 caller 多重错误**：`pipeline/stages/pdf/table_extraction.py` 中 `FitzTableExtractor._run()` 循环体同时犯三个错——（a）传 `page`（页对象）而不是 `doc`（文档对象）；（b）漏掉必需位置参数 `text_blocks`；（c）把 `(bbox_map, all_tables)` 返回元组当 `List[ExtractedTable]` 迭代。历史 `# type: ignore[call-arg] / [union-attr]` 注释还压住了 mypy 告警。

### 处理方式
- **D1 · backend 字符串替换**：`mineru.py` 两处 `vlm-mlx-engine` → `vlm-auto-engine`（语义：由 MinerU 自动挑选最佳 VLM 后端，MLX 可用时走 MLX，否则 fallback）；`settings.mineru_device="mlx"` / `settings.mineru_backend="auto"` 对外 API 不变；同步修正 `tests/unit/test_mineru_engine.py` 三处断言，并将 `test_mps_device_maps_to_mlx` 重命名为 `test_mps_device_maps_to_vlm_auto` 使测试意图与断言一致。
- **D3 · PyMuPDF 表格 caller 改写**：`table_extraction.py` 按仓内已通过的 `pdf/processor.py:1321-1325` 调用范式重写循环体：
  ```python
  text_blocks = page.get_text("blocks")
  _, page_tables = processor.extract_tables_with_geometry(doc, page_idx, text_blocks)
  ```
  同时移除该函数中所有 `# type: ignore[call-arg] / [union-attr]` 注释，让 mypy 重新校验。
- **D2 · `perceives prefetch-models` CLI**：
  - 新增 `src/negentropy/perceives/cli/commands/prefetch_models.py`，暴露 `run()` 作为 Typer 子命令；
  - `src/negentropy/perceives/cli/app.py` 注册 `app.command("prefetch-models")(prefetch_models.run)`；
  - 每个引擎独立 try/except + `_SkipEngine` 信号异常：docling → `DocumentConverter(format_options={...})`；marker → `from marker.models import create_model_dict; create_model_dict()`；mineru → `subprocess.run([shutil.which("mineru-models-download"), "-s", "huggingface", "-m", "all"])`；未安装引擎返回 `skipped` 并提示 `uv sync --extra <engine>`；
  - 支持 `--engines docling,marker,mineru|all` 过滤与 `--hf-home <path>` 设置 `os.environ["HF_HOME"]`；
  - 任一引擎 error → 退出码 1，全部 ok/skipped → 退出码 0；
  - `pipeline/convenience.py` 的 `[PDF engines]` 汇总日志尾追加一句 `首次使用前建议预热模型... uv run perceives prefetch-models` 提示；
  - 新增 `tests/unit/test_prefetch_models_cli.py`（11 条单测，覆盖引擎选择、未安装跳过、subprocess 失败、HF_HOME 传导、非法引擎名拒绝）。
- **文档**：`docs/development.md` 在“详细环境配置”后追加“模型预热（推荐）”小节；`docs/user-guide.md` 在 PDF 章节引用该小节；`CHANGELOG.md` Unreleased 追加 🔧 修复（D1/D3）与 ✨ 新增（prefetch-models）。

### 后续防范
- 任何调用签名形如 `f(doc, page_idx, text_blocks)` 的辅助函数，在 Stage 适配器中务必配齐位置参数并正确解包返回值；禁止用 `# type: ignore[call-arg]` 压制签名错误告警——应让 mypy 在 CI 就把错误拦下。
- 外部 CLI 的 `choices` 类参数值不要硬编码在多处（如 `vlm-mlx-engine`），应在 engine 层集中维护可选值常量，并尽量以 `auto` 类自适配值作为默认，把具体后端的选择权交回外部工具；重大版本升级需把合法值对照 Release Notes 过一遍。
- 任何涉及“首请求下载大模型”的引擎，必须提供独立的“预热 / warm-up”入口，**把下载与服务路径解耦**。CI / 部署流水线应在部署阶段执行预热，而不是把它暴露在用户请求路径上。
- 引入新引擎时需在 `is_available()`（import 级）之外补充一个可选的“模型是否已缓存”探测，或直接在部署文档写明预热命令。

### 同类问题影响与注意事项
- 虽然 `settings.mineru_backend` 允许显式覆盖（例如 `pipeline`），但在默认路径上 macOS 用户最常见；这类“平台自适配默认值”在 PR 里一定要加集成测试或至少让 `mineru --help` 的合法列表在单测中显式断言，防止再被字符串 typo 击穿。
- `extract_tables_with_geometry` 之外，仓里还有若干工具类函数被多个 Stage 适配器复用；同类 Stage 适配器在迁入新版 pipeline 时，**必须**以 `pdf/processor.py` 中的成熟调用为蓝本，不要凭直觉简化参数。
- Prefetch CLI 对未安装引擎走 `skipped` 分支，对 CI 轻量环境友好；但在镜像构建脚本里应**显式**检查 `exit_code == 0` 且 `skipped` 集合为空，否则会出现“镜像里缺 marker 依赖却没人发现”的情况。
- 首次请求预热模型会在本地缓存 HuggingFace 目录产生 GB 级数据，Docker 镜像/共享开发机请用 `--hf-home` 指向持久化卷避免重复下载。

## [2026-04-24] perceives prefetch-models 在 mineru 步骤“看似卡死”

### 问题描述
执行 `uv run perceives prefetch-models`，docling / marker 顺利完成后停在：

```
执行：…/.venv/bin/mineru-models-download -s huggingface -m all
```

长时间无任何回显——既看不到 tqdm 进度条，也无错误抛出，无法判断是“真的卡死”还是“在下只是没回声”。最终用户被迫盲等，或 `Ctrl-C` 后重试时担心丢失已下载的分片。

### 表因
- 终端无任何输出（无进度条、无 ETA、无 `Fetching ...` 日志）；
- `~/.cache/huggingface/hub/models--opendatalab--*` 目录的 mtime 仍在更新、`.locks/` 在写——**实际下载在进行**，但用户看不到；
- 默认 `-s huggingface` 在大陆从 `huggingface.co` 直拉 ~9GB，带宽通常 ≪ modelscope 国内 CDN，叠加“无回显”观感更强。

### 根因（两个独立维度同时退化）
1. **进度通道被 `capture_output=True` 吞没** — `_prefetch_mineru()` 中 `subprocess.run(cmd, capture_output=True, text=True)` 把子进程 stdout/stderr 全收进内存。huggingface_hub 内嵌的 tqdm 在检测到非 TTY 后自动降级为静默或极低频刷新，**视觉上等同卡死**；外加无 `timeout=` 参数，遇到 huggingface_hub TCP 静默断流（参见 [huggingface_hub#3580](https://github.com/huggingface/huggingface_hub/issues/3580)、[#4085](https://github.com/huggingface/huggingface_hub/issues/4085)）会无限期阻塞。
2. **传输源默认值在大陆带宽较差** — 默认硬编码 `-s huggingface`，未利用 MinerU 官方推荐的 `MINERU_MODEL_SOURCE=modelscope`（[官方文档](https://opendatalab.github.io/MinerU/usage/model_source/)）；modelscope 国内 CDN 带宽通常 10× 于直连 HF。

两个维度叠加：传输慢 → 等待时间长；进度通道哑 → 用户无从判断进度。任一维度单独存在都不至于“看似卡死”，组合则放大。

### 处理方式
- **`prefetch_models.py` 三点最小重写**（仅作用于 mineru 引擎，docling/marker 不变）：
  1. 移除 `capture_output=True`、`text=True`，让子进程 stdout/stderr 直接继承父进程终端，tqdm 即可正常实时渲染；
  2. 默认 `--mineru-source` 改为 `modelscope`，优先级 `CLI 参数 > MINERU_MODEL_SOURCE 环境变量 > 默认 modelscope`；命令行 `-s` 与环境变量双写以同时兼容老/新版 mineru CLI；
  3. 新增 `--mineru-timeout`（默认 1800 秒）；超时抛 `RuntimeError("mineru 模型下载超时（{}s）；可加大 --mineru-timeout 或切换 --mineru-source")`，由 `_dispatch` 收敛为 error 状态；保留 `_SkipEngine` 与 `shutil.which` 守门。
- **失败提示改写**：不再提供“末尾 5 行日志”——既然 stdout 已直通终端，错误信息改为引导用户“查看终端上方的 mineru-models-download 输出”，配 `returncode` 与生效 source 一并打印。
- **测试覆盖（新增/更新 6 条用例）**：默认 modelscope、CLI 覆盖源、环境变量优先级、TimeoutExpired → RuntimeError、白盒回归（`subprocess.run` kwargs 不含 `capture_output`/`stdout=PIPE`/`stderr=PIPE`）、CLI 选项透传到 `_dispatch`；新增 `_restore_mineru_source` autouse fixture 隔离环境污染。

### 后续防范
- **任何**内嵌 tqdm/进度条的子进程一律避免 `capture_output=True`/`stdout=PIPE`/`stderr=PIPE`——若真要采集日志，应使用 PTY (`pexpect` / `ptyprocess`) 或 `tee`，绝不可静默吞掉用户的进度反馈。
- **任何**下载类子进程必须显式带 `timeout=`，并将 `subprocess.TimeoutExpired` 转为可读 `RuntimeError`，避免上游 TCP 半断流时无限阻塞。
- 跨地域大体量模型下载，CLI 默认值应倾向于“目标用户群带宽更优”的源（本仓主要服务大陆开发者 → 默认 modelscope）；同时**始终**留出 `--source` 与环境变量两个出口，禁止把默认值锁死。
- Issue 排查时复用诊断三件套：`watch -n 5 'du -sh ~/.cache/huggingface/hub'` 看缓存增长、`pgrep -fl mineru-models-download` + `lsof -p <PID> | grep ESTABLISHED` 看 TCP 连接、`sudo nettop -p <PID> -P` 看实时带宽——三者综合可秒判“在下/卡死/已退出”。

### 同类问题影响与注意事项
- `_prefetch_docling()` 与 `_prefetch_marker()` 走的是 Python 函数调用（`DocumentConverter(...)` / `create_model_dict()`），不经过 `subprocess`，本次不受影响；但若未来引入新的子进程下载入口（如 paddle/easyocr 模型），**必须**照搬本规约（不捕获 stdout + 显式 timeout + 默认源覆盖）。
- modelscope 与 huggingface 在 `~/.cache` 下落点不同、不互通：切源会让已下载的 HF 副本变成沉默成本，但这是一次性代价；切源后通常十几分钟可补回。如海外环境下默认 modelscope 反而更慢，用户可显式 `--mineru-source huggingface` 或设环境变量回退。
- CI 环境是非 TTY，tqdm 在非 TTY 下会自动改为“按行输出”（每个 epoch/file 一行），不会刷屏；当前“零输出”反而更可疑——本次 stdout 直通的改动对 CI 友好。
- `--mineru-timeout` 默认 1800s 对家宽下载 ~9GB 偏紧（按 5MB/s 需 ~30 min 整）；modelscope 国内通常 ≫ 5MB/s 故已足够，但若部署在偏远节点请显式调大。

## [2026-04-24] parse_pdf_to_markdown Marker 引擎始终报 "daemonic processes are not allowed to have children"

### 问题描述
真实 PDF 处理日志中 Marker 工具每次都以 `daemonic processes are not allowed to have children` 失败退出；`layout_analysis / table_extraction / formula_extraction / code_detection` 四 Stage 的 Marker 竞争者全部失效，竞争模式不再具备对 Marker 的覆盖。

### 表因
`WARNING negentropy.perceives.pdf.engines.marker: Marker 转换失败: daemonic processes are not allowed to have children` 在 MCP server 每次处理 PDF 时都会出现。

### 根因
`EngineWorkerPool` 在 `EngineWorker.start()` 中用 `ctx.Process(..., daemon=True)` 启动子进程（`infra/engine_worker.py:106`）。Python 的硬性限制：**daemon 进程不能再派生自己的子进程**。而 Marker 内部依赖 torch `DataLoader` 的 `num_workers>0` 与 Surya OCR 的进程池，一旦需要派生子进程即抛 `AssertionError`。Docling / MinerU 目前走纯 Python 推理（或自带独立进程管理），因而表现正常。

### 处理方式
1. `infra/engine_worker.py:106` 将 `daemon=True` 改为 `daemon=False`，并在上方加 WHY 注释。
2. 在模块末尾新增 `_cleanup_on_exit()` + `atexit.register(_cleanup_on_exit)`：遍历 `_pool_singleton._workers`，对仍存活的 worker 依次 `terminate → join(0.5s) → kill → join(0.5s) → os.kill(SIGKILL)` 兜底强杀（解释器退出路径不可 `await`，全程同步且吞异常）。
3. 与 `apps/app.py:main()` 中既有的 `finally + atexit` 双路径互为防御，`_shutdown_engine_pool_sync()` 已有幂等 flag，无冲突。

### 后续防范
- 任何计划派生子进程的引擎（Marker 风格）都**必须**跑在 `daemon=False` 的 worker 上；如未来新增引擎，遵循本规约，不要回退到 daemon=True。
- `daemon=False` 后父进程异常退出会阻塞在子进程回收；`atexit` 兜底 + `apps/app.py` 生命周期 hook 必须同时存在，否则裸脚本/测试场景会出现孤儿进程。
- 单测 `tests/unit/test_engine_worker_daemon.py` 固化 `daemon=False` 与 `_cleanup_on_exit` 行为契约，防止回归。

### 同类问题影响与注意事项
- 子进程改为 non-daemon 后，若 `EngineWorker.terminate()` 路径异常早退，可能遗留 `proc` 存活；`_cleanup_on_exit` 是最后一道防线。若未来新增 worker 管理路径，复用 `_cleanup_on_exit` 模式即可。
- `pytest` 环境下使用 `_fake_fast` 引擎做 Pool 存活断言，避免真实 PDF 依赖；真实 Marker 可用性由集成测试或人工冒烟验证。

## [2026-04-24] parse_pdf_to_markdown 在 Apple Silicon 上 MPS 被误判不可用，Docling 回退 CPU

### 问题描述
`parse_pdf_to_markdown` 日志高频出现：
```
WARNING engine_worker.docling.utils.accelerator_utils:
  MPS is not available in the system. Fall back to 'CPU'.
```
Mac M 系列芯片虽然硬件与 PyTorch 均支持 MPS（`torch.backends.mps.is_built() == True`），但 Docling 的 `accelerator_utils` 检测依旧 `False`，整条推理管线降级 CPU，单次 37 页 PDF 的 Docling 推理从预期 <30s 膨胀到 >120s（layout/tables/formulas/code 四阶段各占满超时）。

### 表因
子进程内 `torch.backends.mps.is_available()` 首次调用返回 `False`；Docling 据此选择 CPU。

### 根因
**`multiprocessing` spawn 子进程内的 MPS 懒初始化缺口。** MPS 的统一内存 allocator 依赖 first-touch（首次真实分配一个 MPS tensor）才会就绪；而 `torch.backends.mps.is_available()` **自身不触发** first-touch。父进程虽已 `set_start_method('spawn')`，但 spawn 子进程是一个全新解释器，torch 在子进程里重新 `import` 后就必须再做一次 first-touch，否则 `is_available()` 会稳定返回 False。Docling 的内部设备探测跑在 worker 子进程中，恰好踩进这个缺口。

### 处理方式
1. **`infra/_engine_worker_entry.py` 新增 `_preinit_torch_device(logger)`**，`worker_main` 在子进程启动、`conn.send(ready)` 之后、首次 `call` 之前调用，仅对 `docling/mineru/marker` 三类真实 torch 引擎执行：
   - `os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")`：算子 fallback 兜底，不禁用 MPS；
   - 采集 `torch_version / start_method / mps_built / mps_available_raw`，darwin + mps_built 时执行 `torch.zeros(1, device="mps")` 作为 first-touch smoke_test；
   - 结果写入 `NEGENTROPY_MPS_READY=1/0` 环境变量，供下游 `hardware.detection._check_mps_available` 免再探测直接信任；
   - `logger.warning("子进程 torch 诊断 %s", diag)` 以 WARNING 级输出单行诊断（包含 smoke_test 结果、版本、`is_available_raw` 的首次返回值），无论成功失败都可在线上日志一眼排查。
2. **`pdf/hardware/detection.py::_check_mps_available` 防御性兜底**：`is_available()=False` 时先读 `NEGENTROPY_MPS_READY==1`，有则直接走“可用”分支；否则尝试一次 first-touch 再复查，彻底堵住“worker 内已 ok 但 Docling 子模块二次探测再次失败”的回归可能。
3. **单元测试 `tests/unit/test_mps_subprocess.py`** 8 条：torch 缺失、smoke_test ok / fail / skip（未 built）、非 darwin 跳过、默认 `PYTORCH_ENABLE_MPS_FALLBACK=1`、以及 darwin-only 真实环境断言 `READY ∈ {0,1}`，全部通过。

### 后续防范
- 任何在 spawn 子进程内依赖 torch 硬件的引擎都**必须**在 `worker_main` 的早期窗口显式 first-touch 一次设备，不能信任 `is_available()` 的首次返回。
- `_preinit_torch_device` 必须保持“永不抛异常”的契约：任何路径失败都静默降级到 `NEGENTROPY_MPS_READY=0`，避免连 worker 本身都起不来；失败原因写进诊断日志即可。
- Docling / MinerU / Marker 之外如新增真实 torch 引擎，`worker_main` 的 `engine_name in (...)` 白名单必须同步更新。

### 同类问题影响与注意事项
- CUDA 子进程无类似缺口（CUDA 初始化走 cudaInit 常规路径，不依赖 first-touch），但 XPU（Intel oneAPI）未来接入时建议同样跑一次 `torch.zeros(1, device="xpu")` first-touch 兜底。
- `PYTORCH_ENABLE_MPS_FALLBACK=1` 仅作为“少数算子不支持 MPS 时回 CPU”的兜底，**不会**整体禁用 MPS；若后续出现算子回 CPU 但整体仍过慢，需对 Docling 个别算子做 profile，而不是误以为 fallback 本身是问题。
- 若在 Intel Mac 上运行（`mps_built=False`），`smoke_test=skip:mps_not_built`、`NEGENTROPY_MPS_READY=0`，Docling 正确降级 CPU，无任何回归。

## [2026-04-24] parse_pdf_to_markdown 四个 Stage 重复调用 Docling convert，单 PDF 耗时 >250s

### 问题描述
37 页 PDF 经 `parse_pdf_to_markdown` 总耗时约 **249 秒**，日志显示 Docling 在 `layout_analysis → table_extraction → code_detection → formula_extraction` 四个 Stage 中**各完整跑了一次推理**，分别触发 120s / 75s / 30s / 126s 的 Stage 超时。

### 表因
`StageScheduler` 在 4 个 Stage 分别调用 `get_engine_pool().run("docling", method="convert", ...)`，每一次都是一次完整的 Docling DocumentConverter 推理（layout + TableFormer + 公式 + 代码一起算）。

### 根因
`EngineWorkerPool` 只复用 worker 进程与模型权重，**不缓存 `convert()` 的返回值**。而 Docling 的 `DoclingConversionResult` 已一次性聚合全部四类信息（tables / formulas / code / layout），上层 Stage 只是各取所需一个字段——但必须重跑整条管线。

### 处理方式
- **`infra/_engine_worker_entry.py` 新增 `_ConvertCache` + `_pdf_fingerprint` + `_make_cache_key`**：
  - 子进程内 LRU(capacity=4) + TTL(300s) 缓存，仅对 `docling/mineru` 白名单引擎的 `method="convert"` 生效；
  - 键 = `(engine_name, size + mtime_ns + blake2b(head_64KB), page_range, embed_images, init_kwargs_hash)`，覆盖 PDF 内容/时间/切片/选项/初始化参数五个维度；
  - 读前 64KB 算指纹，常见 PDF I/O <1ms；业务层覆盖写必改 mtime 自动失效；
  - `result is None` 不入缓存以便下次重试（对齐引擎“不可用/转换失败”语义）。
- **`worker_main` 缓存查询点**：call 分支按“load engine → cache.get → miss 时执行 → cache.put → send”调用路径织入，对上层调用协议完全透明（Stage 代码不改一行）。
- **竞争模式 / 并行度保持**：scheduler 的“4 工具并行”一字未动；docling/mineru/marker/pymupdf 仍并行，但 docling 与 mineru 在首个 Stage 之后的 3 次 convert 直接命中缓存，耗时 <1ms。
- **新增 `tests/unit/test_convert_cache.py` 24 条**覆盖指纹、键构造、LRU、TTL、Stage 重放、PDF 内容变更失效、白名单契约；全部通过。

### 后续防范
- 任何“全流程推理 → 多字段消费”的引擎（未来可能的 `sycamore / nougat / pix2text` 等）如想接入 `EngineWorkerPool`，其 `convert()` 只要保持“**纯函数 + 不可变返回值**”语义就能白盒接入本缓存，仅需在 `_CACHEABLE_ENGINES` 中补白名单。
- 同时缓存**多** PDF 时 capacity=4 是“4 Stage + 1 备用”的粗估；长跑场景若观察到 cache-thrashing（eviction 频繁），可以把 capacity 上调到 8~16，TTL 维持 5min 防止长 lived worker RSS 膨胀。
- Marker 因其内部 DataLoader 与显存占用叠加后风险偏高，暂**不**接入缓存；若后续证明必要，再单独评估。

### 同类问题影响与注意事项
- 缓存键**不可漏掉** `init_kwargs_hash`：否则同一 PDF 用不同 `DoclingEngine(...)` 配置会错误复用旧结果；已在 `_make_cache_key` 中显式纳入键。
- Pipeline 未来若引入“编辑/标注后重算”场景，务必通过 `mtime_ns` 自动失效（`os.utime` 或覆盖写）；切勿人为旁路缓存键，否则引入 stale 风险。
- 读前 64KB 指纹对“在 64KB 之后篡改内容但保留头部 + 同 size + 同 mtime_ns”的攻击向量是**不设防**的；本项目语境下 PDF 来源可信，但如未来引入不可信 PDF 来源，应改为全文件 blake2b。

## [2026-04-24] parse_pdf_to_markdown 图片提取阶段逐页串行、37 页耗时 ~15s

### 问题描述
同一份 37 页 PDF 在 `image_extraction` Stage 中提取 18 张图片耗时约 **15 秒**，日志每秒打印一条 `Extracted image img_*_...`，明显是“逐页 → 逐图”的串行流。

### 表因
`pipeline/stages/pdf/image_extraction.py` 的 `FitzImageExtractor._run` 原本：
```python
doc = fitz.open(pdf_path)
for page_idx in range(start_page, end_page):
    page_images = await processor.extract_images_from_pdf_page(doc, page_idx)
    ...
doc.close()
```
所有页共享同一个 `fitz.Document`，且没有任何并发包装，等同于 `O(pages)` 串行。

### 根因
- PyMuPDF 官方 FAQ 明确指出 `Document` 对象**非线程/非重入安全**（同一 Document 并行访问会触发 SIGSEGV 或数据损坏）<sup>[[1]](#ref-pymupdf-thread)</sup>，因此不能用 `asyncio.to_thread` 把同一 Document 丢进线程池；
- 但 `fitz.open()` 本身是 <10ms 的轻量操作，完全可以“每页一个独立 Document”，再通过 `asyncio.gather + Semaphore(4)` 限制同时打开的文件句柄。

### 处理方式
- **`image_extraction.py` 重写 `_run`**：
  1. 先一次性 `with fitz.open(pdf_path) as probe_doc:` 读取 `page_count`，保证“探测”与“抽取”阶段隔离；
  2. 为每一页协程 `_extract_one_page(page_idx)` 内部独立 `fitz.open()` + `EnhancedPDFProcessor()`，抽取完立即 `doc.close()`；
  3. `asyncio.Semaphore(4)` 限制同时在跑的页数，避免 37 页 PDF 打开 37 个 fitz 句柄；
  4. `asyncio.gather(*(_extract_one_page(p) for p in range(start, end)))` 并行触发；
  5. `metadata` 追加 `concurrency` 与 `page_count`，便于线上排查；
  6. `page_range=(5, 5)` 等空区间返回空列表，不再触发 gather 空参数。
- **`tests/unit/test_image_extraction_concurrency.py` 新增 7 条**：全量页抽取、Semaphore 限流峰值 ≤4、墙钟优于串行基线 60%、`page_range` 尊重、空区间、异常透传、`bbox` 缺省。全部通过。

### 后续防范
- 任何基于 PyMuPDF 的并发路径都必须遵循“**每协程独立 Document**”约束，不要试图在 `asyncio.to_thread` / `ThreadPoolExecutor` 中共享 `fitz.Document`；否则测试环境可能偶发通过，生产 workload 下 SIGSEGV 概率线性上升。
- `_IMAGE_EXTRACT_CONCURRENCY = 4` 与 `docling/mineru` 竞争的 Pool 并发度对齐；若未来出现“CPU 打满但 I/O 闲置”现象，再单独调参。
- 上一版本依赖全局 `doc` 在 `extract_images_from_pdf_page` 中回看 cross-page 信息（例如 caption 在相邻页）的代码**必须**走独立通道（例如把 `text_blocks` 预先计算好作为参数传入），否则并发路径无法感知跨页上下文。

### 同类问题影响与注意事项
- 其他 `PyMuPDF` 绑定 Stage（如 `text_extraction`、`extract_tables_with_geometry`）若也观察到单页耗时线性 × 页数、且 workload profile 显示 CPU 闲置，可沿用同一“每页 open + Semaphore 限流 + gather”方案；注意 Semaphore 上限要与全局 `engine_pool` 并发度协调，避免压爆系统句柄。
- 并发化后 `logger.info("Extracted image ... from page N")` 的打印顺序不再与页号递增对齐。线上排查若依赖顺序关系，请以 `page_number` 字段为准，不要以日志顺序推断页号。

<a id="ref-pymupdf-thread"></a>[1] Artifex Software, "PyMuPDF FAQ: Is PyMuPDF thread-safe?," *PyMuPDF Documentation*, 2025. [Online]. Available: https://pymupdf.readthedocs.io/en/latest/faq.html#is-pymupdf-thread-safe

## [2026-04-24] parse_pdf_to_markdown MCP 响应体缺失图片 base64 载荷

### 问题描述
同一份带图片的 PDF 在经过 `parse_pdf_to_markdown` 后，MCP 响应体仅包含 `enhanced_assets.images_count` 的计数，**不含**任何像素数据；下游（多模态 LLM、可视化展示等）消费者必须回退到服务器本地 `local_path`，违反 MCP 协议“远程友好、零本地共享”的语义。

### 表因
- `pipeline/convenience.py::run_pdf_pipeline` 在装配（assembly）阶段**重建** `PipelineResult`，只读取 `assembly_output.markdown` 等字段，**丢弃** `BuiltinBundler` 产出的 `StageResult`；
- `pipeline/models/_pdf.py::PipelineResult` 原本没有 `image_assets` 字段，即使 Stage 层构造也没地方装；
- `ops/pdf.py` 的 auto-method 分支在把 dataclass `PipelineResult` 映射为 Pydantic `PDFResponse` 时，自然也就没有 `image_assets` 出参。

### 根因
- 在流水线早期设计中，`asset_bundling` 被定位为“本地落盘 + 元数据汇总”，产物（`images/`, `tables/`, `formulas/`）被假设由客户端按 URL 回取；
- 但 MCP 的真实语境是“客户端运行在异机 / 沙箱内”，本地文件路径不可及。规范上 MCP content block 支持 `type=image` + base64 载荷<sup>[[1]](#ref-mcp-image)</sup>，因此响应体内嵌 base64 才是符合协议的正交做法；
- 直接在 `asset_bundling.py` 添字段收效甚微（会被 `convenience.py` 丢弃），需要在**真正组装** `PipelineResult` 的 `run_pdf_pipeline` 里集中处理，才能让内部数据模型与对外 Pydantic 模型端到端贯通。

### 处理方式
- **内部模型**（`pipeline/models/_pdf.py`）：新增 `ImageAsset` dataclass 与 `PipelineResult.image_assets: List[ImageAsset]` 字段；在 `pipeline/models/__init__.py` 中导出。
- **聚合器**（`pipeline/convenience.py`）：新增三道函数：
  1. `_read_image_bytes(img)`：优先读 `base64_data`；否则回退 `local_path`；两者都缺则返回 `None`（跳过）；
  2. `_downscale_to_jpeg(raw, quality=75)`：PIL 缺失或抛异常时返回 `None`，不破坏主链路；采用 JPEG q=75 实现“感知质量/体积”平衡<sup>[[2]](#ref-pillow-jpeg)</sup>；
  3. `_build_image_assets(image_output)`：三道护栏——
     - 开关：`pdf_bundle_images_in_response=False` → 返回 `[]`；
     - 单图上限：超过 `pdf_image_max_base64_kb*1024` → 走 JPEG q=75 重压缩，若仍超限则 `logger.warning` 后跳过；压缩成功则 `filename` 改写为 `*.jpg` 且 `mime_type="image/jpeg"`，避免“扩展名 vs 实际字节”的不一致；
     - 累计上限：`pdf_bundle_total_base64_mb*1024*1024` → 保序丢弃尾部（“drop-tail”）。
  并在 `run_pdf_pipeline` 的 assembly 分支把结果写入新 `PipelineResult`。
- **配置**（`config.py` + `config.default.yaml`）：新增三项 pydantic 字段：`pdf_bundle_images_in_response`（默认 `True`）、`pdf_image_max_base64_kb`（默认 `2048`）、`pdf_bundle_total_base64_mb`（默认 `32`）；YAML 配置 block 为 `pdf: {bundle_images_in_response, image_max_base64_kb, bundle_total_base64_mb}`。`_NO_FLATTEN_KEYS` 不含 `pdf`，经扁平化后正好命中以上字段。
- **对外响应**（`models.py` + `ops/pdf.py`）：新增 `ImageAssetModel(BaseModel)` 与 `PDFResponse.image_assets: Optional[List[ImageAssetModel]]`；`ops/pdf.py` 的 auto-method 分支在构造 `PDFResponse` 时把 dataclass 列表映射为 Pydantic 列表，**空列表映射为 `None`** —— 客户端据此区分“未传输”与“确实无图”。
- **单元测试**（`tests/unit/test_asset_bundling_base64.py`）：12 条用例覆盖开关关闭、empty output、base64 优先、`local_path` 回退、两源全缺跳过、单图超限重压缩/重压缩仍超限/PIL 不可用、累计上限 drop-tail、非法 base64 跳过、真实 PIL 集成校验 JPEG SOI `\xff\xd8\xff`。全部通过。

### 后续防范
- **配置默认保守**：`pdf_image_max_base64_kb=2048` 与 `pdf_bundle_total_base64_mb=32` 是基于“MCP 响应体 ≤64MB 软上限”的经验值，既能容纳常见扫描页，又为元数据和 Markdown 文本留出余量；客户端受限（如手机端）可下调，离线批处理可上调。
- **优先 base64，其次 local_path**：这种 fallback 让 `convenience` 层对“图像是否已被 asset_bundling 落盘”保持解耦；未来若引入 S3/OSS 直传，新分支放在 `_read_image_bytes` 即可，**调用点不变**。
- **整函数无异常外传**：`_read_image_bytes` / `_downscale_to_jpeg` / `_build_image_assets` 的任何失败都用 `logger.warning` 记录并跳过该图，确保“图片 bundling 失败”**不会**反向污染主 Markdown 产物。

### 同类问题影响与注意事项
- `enhanced_assets` 其他子字段（`tables/`, `formulas/`）若未来也要 base64 化嵌入 MCP 响应，可复用本次三道护栏（开关 + 单项上限 + 总量 drop-tail）；切勿为了“完整性”在响应体里夹带 MB 级纯文本 HTML 表格。
- 客户端代码升级时必须同步更新对 `image_assets` 的 `is None` vs `[]` 判定逻辑：`None` 表示“服务器未开启或未生成”，`[]` 表示“已生成但空”；二者不等价。
- PIL `Image.save(..., format="JPEG", quality=75)` 对 RGBA/P 模式图片需要先 `.convert("RGB")`，否则直接抛 `OSError`；`_downscale_to_jpeg` 已统一 `convert("RGB")` 兜底。

<a id="ref-mcp-image"></a>[1] Anthropic, "Model Context Protocol Specification: Content Types," *MCP Documentation*, 2024. [Online]. Available: https://modelcontextprotocol.io/specification/server/tools#image-content

<a id="ref-pillow-jpeg"></a>[2] A. Clark and Contributors, "Pillow Handbook: JPEG — Image File Format," *Pillow Documentation*, 2025. [Online]. Available: https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#jpeg

## [2026-04-24] parse_pdf_to_markdown 表格提取大量伪表格（对齐列表/菜单项/页眉被识别为表）

### 问题描述
用户反馈 37 页 PDF 的 Markdown 产物中出现**大量伪表格**：如分栏排版的对齐列表、带缩进的 TOC、页眉页脚等被 PyMuPDF `find_tables` 识别为表并渲染为 Markdown 三线表。

### 表因
`pdf/extraction/table.py` 在 `_extract_single_table` / `_process_found_table` 两条路径上的唯一门控是：
```python
if table.row_count < 2 or table.col_count < 2:
    return None
```
只要 PyMuPDF 返回的 `row_count/col_count ≥ 2` 即被接纳，不校验 cell 内容的“表格性”。

### 根因
- PyMuPDF `find_tables` 是基于 cell 几何对齐 + 文本块分割的启发式检测器<sup>[[1]](#ref-pymupdf-tables)</sup>，**只关心空间布局**不识别语义；对“两列以上等距对齐”的列表几乎 100% 触发误判；
- 项目在该检测器之上缺少**任何内容层面**的质量闸门，导致 PyMuPDF 的 false-positive 全量穿透到最终 Markdown；
- 仅依赖 LLM 编排 Stage 的上游评审对整页 Markdown 做改写，代价高且无法精确打击单个伪表；从源头过滤更具确定性。

### 处理方式
- **`pdf/extraction/table.py::_table_quality_score`**（新）：对 `table.extract()` 后的二维矩阵做三项指标评分——
  1. `occupancy`（非空单元格占比）；
  2. `weak_cols`（单列非空率 < 40% 视为弱列，统计弱列数是否 > `cols × max_weak_cols_ratio`）；
  3. `unique_cells`（去重后单元格种类数，≤ `min_unique_cells - 1` 视为“页眉/同值填充”）。

  任一维度不过即判定伪表格；返回 `(bool, diag_dict)`，诊断指标回传日志便于事后排查。
- **`_extract_single_table` / `_process_found_table`**：在 `merge_table_columns_and_rows` 之后、`build_markdown_from_data` 之前插入 `_table_quality_score` 闸门；未通过时 `logger.info` 记录诊断并返回 `None`。
- **配置**：`config.py` 新增 4 项 pydantic 字段 `pdf_table_quality_*`，YAML `pdf:` block 同步扩展 4 个 key；`pdf_table_quality_filter_enabled=False` 回退原 row×col 行为，保障灰度与回滚路径。
- **`tests/unit/test_table_quality_filter.py` 新增 11 条**：真实密表通过、稀疏但有效通过、低占用率/过多弱列/低唯一值/单行/单列/空矩阵被拒、关闭开关时任意输入通过、阈值放宽后接纳稀疏样例。全部通过。
- **`docs/user-guide.md` 同步** 7 个新增环境变量（C5 + C6）的说明行。

### 后续防范
- 三项阈值互相**正交**：`min_occupancy` 控稀疏、`max_weak_cols_ratio` 控单列分布、`min_unique_cells` 控同质复制；任何一项过松都可能漏判，任何一项过严都可能误杀——联调时应逐项调参，避免一次性拨动多个。
- 过滤函数**不修改**输入、**不依赖**外部状态（只读模块级阈值），`monkeypatch` 即可覆盖，保障单元测试隔离。
- 诊断 `diag` 通过 `logger.info` 输出而非 metadata 字段，避免污染 `PDFResponse`；线上排查时 grep `表格质量过滤丢弃` 即可定位被拒表格与命中原因。

### 同类问题影响与注意事项
- 若未来接入更多表格检测器（Docling TableFormer、Camelot 等），应统一在 `_table_quality_score` 处叠加过滤，而不是每个引擎自成一套；“检测 → 质量过滤 → 渲染”的三段式是可复用的正交分解。
- **谨慎降低** `min_unique_cells`：比如设成 2 会让“仅 Y/N 两个值”的逻辑表被拒（本测试用例 `TestRejection.test_two_unique_values_rejected`）。如果业务有大量二值枚举表，应明确把阈值调到 2 或在数据清洗时跳过该过滤。
- 单元测试用 `monkeypatch.setattr(table_mod, "_QF_*", ...)` 直接改模块级常量；不建议用 `patch("negentropy.perceives.pdf.extraction.table.settings", ...)`——本模块只在 import 时读一次 settings，重新 patch settings 无效。

<a id="ref-pymupdf-tables"></a>[1] Artifex Software, "PyMuPDF Table Recognition and Extraction," *PyMuPDF Documentation*, 2025. [Online]. Available: https://pymupdf.readthedocs.io/en/latest/page.html#Page.find_tables
