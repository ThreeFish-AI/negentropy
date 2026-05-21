# Knowledge Map（知识索引）

本项目所有文档与关键模块的索引入口，按主题分组。文档目录变更时**必须**
同步更新本表（AGENTS.md 「Knowledge Map」条款）。

## 协作约定

- [AGENTS.md](../../AGENTS.md) — 工程行为准则、命令规范、Pre-commit 流程。
- [browser-validation.md](./browser-validation.md) — 浏览器自动化与登录态约束。
- [reference-specifications.md](./reference-specifications.md) — IEEE 引用规范。

## PDF Pipeline

- [pdf-engine-selection.md](./pdf-engine-selection.md) — Adaptive Engine
  Selection 决策图（PR #163）：`DocumentCharacteristics` 驱动的 Stage 短路
  与 tool 重排。
- [apple-silicon-tuning.md](./apple-silicon-tuning.md) — Apple M 系列 GPU
  调优指南：设备探测、代次缩放、Docling/MinerU/Marker 各引擎的 MPS 策略、
  PyMuPDF 多页并行。
- [../framework.md](../framework.md) — PDF/Webpage 双 Pipeline 整体架构、
  10 Stage 流程、5 级引擎降级链。
- [../user-guide.md](../user-guide.md) — MCP 工具使用指南。
- [../issue.md](../issue.md) — 历史 Issue 摘要与教训。

## 基准与脚本

- [scripts/benchmark/parse_pdf_bench.py](../../scripts/benchmark/parse_pdf_bench.py)
  — `parse_pdf_to_markdown` 端到端基准测试（输出每 Stage `engine_used` /
  `elapsed_ms` / `selector_decision`）。

## 测试入口

- 单元：`tests/unit/`（含 `test_engine_selector.py`、
  `test_chip_generation.py`、`test_pymupdf_parallel.py`、
  `test_engine_init_kwargs.py` 等）
- 集成：`tests/integration/`
- 运行：[`scripts/test/run-tests.sh`](../../scripts/test/run-tests.sh)

## 配置

- 默认配置：[`src/negentropy/perceives/config.default.yaml`](../../src/negentropy/perceives/config.default.yaml)
- Settings 定义：[`src/negentropy/perceives/config.py`](../../src/negentropy/perceives/config.py)
- 环境变量前缀：`NEGENTROPY_PERCEIVES_`
