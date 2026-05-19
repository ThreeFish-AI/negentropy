"""Negentropy Perceives MCP Server 配置管理模块。

基于 pydantic-settings 的分层配置系统，按优先级从低到高：
1. 内置默认配置（config.default.yaml，打包在 wheel 内）
2. 用户 YAML 配置（~/.negentropy/perceives.config.yaml）
3. 环境变量（NEGENTROPY_PERCEIVES_ 前缀）
4. -c/--config 显式配置（最高优先级，通过构造函数传入）

config.default.yaml 为所有配置的单一事实默认值源。
Python Field 定义仅作为安全回退（fallback）。

内部结构：
- 本文件：配置模型（NegentropyPerceivesSettings）+ 全局单例
- _config_yaml.py：YAML 工具函数（展平、深度合并、文件加载）
- _config_loader.py：配置发现、合并与全局单例管理
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, Literal, Optional, Union

if TYPE_CHECKING:
    from .core.pipeline_config import PipelineConfig

from pydantic import Field, field_validator
from pydantic_settings import (
    BaseSettings,
    InitSettingsSource,
    PydanticBaseSettingsSource,
)

from . import __version__

# 直接加载 core/pipeline_config.py，绕过 core.__init__ 以避免循环引用
import importlib.util
import sys as _sys

_pc_mod_name = "negentropy.perceives.core.pipeline_config"
_pc_spec = importlib.util.spec_from_file_location(
    _pc_mod_name,
    str(Path(__file__).parent / "core" / "pipeline_config.py"),
    submodule_search_locations=[],
)
if _pc_spec is None:
    raise ImportError(f"Cannot locate {_pc_mod_name}")
_pc_mod = _sys.modules.setdefault(
    _pc_mod_name, importlib.util.module_from_spec(_pc_spec)
)
_pc_spec.loader.exec_module(_pc_mod)  # type: ignore[union-attr]
PipelineConfig = _pc_mod.PipelineConfig  # type: ignore[misc]  # noqa: F401 — re-exports for downstream consumers

# Re-export YAML 工具函数（向后兼容）
from ._config_yaml import (  # noqa: F401, E402
    deep_merge,
    _flatten_nested_yaml,
    _load_bundled_yaml,
    _load_yaml_file,
    _get_user_config_path,
)

# Re-export 加载函数（向后兼容）
# NOTE: _user_yaml_data 不在此处 re-export，因其为模块级可变全局变量：
# _prepare_user_yaml 会通过 `global` 重新绑定 _config_loader 中的名称，
# 此处的 import 绑定无法随之更新（快照语义）。调用方应通过
# _config_loader._user_yaml_data 或 _UserYamlConfigSource 访问最新值。
from ._config_loader import (  # noqa: F401, E402
    build_settings,
    describe_config_sources,
    reload_settings,
    _UserYamlConfigSource,
    _prepare_user_yaml,
)


# ---------------------------------------------------------------------------
# 配置模型
# ---------------------------------------------------------------------------


class NegentropyPerceivesSettings(BaseSettings):
    """Negentropy Perceives MCP Server 配置。

    所有字段保持扁平结构，通过 YAML 注释提供层次化视图。
    配置值通过深度合并实现层级覆盖，高优先级源仅覆盖差异项。

    优先级（低 → 高）：
      内置默认(config.default.yaml) < 用户YAML配置(~/.negentropy/) < 环境变量 < -c显式配置(构造函数参数)
    """

    # ── 服务标识 ──────────────────────────────────────────────
    server_name: str = Field(
        default="negentropy-perceives", description="MCP 服务器标识名称"
    )
    server_version: str = Field(
        default=__version__, description="版本号（从 pyproject.toml 自动获取）"
    )

    # ── 传输层 ────────────────────────────────────────────────
    transport_mode: Literal["stdio", "http", "sse"] = Field(
        default="http", description="MCP 传输协议模式：stdio / http / sse"
    )
    http_host: str = Field(default="localhost", description="HTTP 服务器绑定主机")
    http_port: int = Field(default=2992, description="HTTP 服务器监听端口")
    http_path: str = Field(default="/mcp", description="HTTP 端点路径")
    http_cors_origins: Optional[str] = Field(
        default="*", description="CORS 来源白名单（null 禁用）"
    )

    # ── 抓取引擎 ──────────────────────────────────────────────
    concurrent_requests: int = Field(default=16, gt=0, description="并发请求上限")
    download_delay: float = Field(default=1.0, ge=0.0, description="下载间隔（秒）")
    randomize_download_delay: bool = Field(default=True, description="随机化下载间隔")
    autothrottle_enabled: bool = Field(default=True, description="启用自动节流")
    autothrottle_start_delay: float = Field(
        default=1.0, ge=0.0, description="自动节流初始延迟（秒）"
    )
    autothrottle_max_delay: float = Field(
        default=60.0, ge=0.0, description="自动节流最大延迟（秒）"
    )
    autothrottle_target_concurrency: float = Field(
        default=1.0, ge=0.0, description="自动节流目标并发度"
    )

    # ── 速率限制 ──────────────────────────────────────────────
    rate_limit_requests_per_minute: int = Field(
        default=60, ge=1, description="每分钟请求频率上限"
    )

    # ── 重试策略 ──────────────────────────────────────────────
    max_retries: int = Field(default=3, ge=0, description="失败重试最大次数")
    retry_delay: float = Field(default=1.0, ge=0.0, description="重试间隔（秒）")

    # ── 缓存系统 ──────────────────────────────────────────────
    enable_caching: bool = Field(default=True, description="启用响应缓存")
    cache_ttl_hours: int = Field(default=24, gt=0, description="缓存生存时间（小时）")

    # ── 日志系统 ──────────────────────────────────────────────
    log_level: str = Field(
        default="INFO",
        description="日志级别：DEBUG / INFO / WARNING / ERROR / CRITICAL",
    )
    log_requests: Optional[bool] = Field(default=None, description="记录请求详情")
    log_responses: Optional[bool] = Field(default=None, description="记录响应详情")

    # ── 浏览器引擎 ────────────────────────────────────────────
    enable_javascript: bool = Field(default=False, description="启用 JavaScript 执行")
    browser_headless: bool = Field(default=True, description="无头浏览器模式")
    browser_timeout: int = Field(default=30, ge=0, description="浏览器操作超时（秒）")
    browser_window_size: Union[str, tuple] = Field(
        default="1920x1080", description="浏览器窗口尺寸"
    )

    # ── 用户代理 ──────────────────────────────────────────────
    use_random_user_agent: bool = Field(
        default=True, description="启用随机 User-Agent 轮换"
    )
    default_user_agent: str = Field(
        default="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        description="默认 User-Agent 字符串",
    )

    # ── 代理服务 ──────────────────────────────────────────────
    use_proxy: bool = Field(default=False, description="启用代理服务器")
    proxy_url: Optional[str] = Field(
        default=None, description="代理服务器 URL（启用代理时必填）"
    )

    # ── 请求设置 ──────────────────────────────────────────────
    request_timeout: float = Field(
        default=30.0, gt=0.0, description="HTTP 请求超时（秒）"
    )

    # ── 任务级超时（PDF / Webpage 解析任务兜底） ─────────────────
    task_timeout_seconds: int = Field(
        default=900,
        ge=1,
        description=(
            "单次解析任务（PDF/Webpage）默认超时秒数。15 分钟兜底覆盖大型 PDF "
            "多 stage 竞态；可被 MCP 入参 timeout 或 yaml 覆盖。"
        ),
    )

    # ── PDF 引擎进程池（取消传导 + 资源释放） ─────────────────────
    pdf_engine_isolation: Literal["process", "thread", "inline"] = Field(
        default="process",
        description=(
            "PDF 引擎（Docling/MinerU/Marker）隔离策略："
            "process=独立子进程（默认，取消时 kill 真正释放 GPU/CPU）；"
            "thread=asyncio.to_thread（兜底，无法强制 kill）；"
            "inline=同步调用（仅调试）。"
        ),
    )
    pdf_worker_pool_size: int = Field(
        default=1,
        ge=1,
        description="每种 PDF 引擎的 warm worker 数量。值 1 足以覆盖 95% 单实例场景。",
    )
    pdf_worker_max_tasks: int = Field(
        default=50,
        ge=1,
        description="单个 worker 处理任务数上限；达到后自动回收以防内存泄漏。",
    )
    pdf_worker_kill_grace_seconds: float = Field(
        default=2.0,
        ge=0.0,
        description="取消时先 terminate，等待此秒数后若仍存活再 kill。",
    )

    # ── LLM 编排 ──────────────────────────────────────────────
    llm_api_key: Optional[str] = Field(default=None, description="LLM API Key")
    llm_api_base_url: Optional[str] = Field(
        default=None,
        description="LLM API Base URL（OpenAI 兼容协议，如 https://api.openai.com/v1）",
    )
    llm_model: str = Field(
        default="gpt-5-nano",
        description="LiteLLM 模型标识（如 gpt-5-nano、gpt-5.4-mini）",
    )
    llm_temperature: float = Field(
        default=0.1, ge=0.0, le=2.0, description="LLM 温度参数"
    )
    llm_max_tokens: int = Field(default=4096, gt=0, description="LLM 最大输出 token")
    llm_timeout: float = Field(default=60.0, gt=0.0, description="LLM API 超时（秒）")
    llm_max_retries: int = Field(default=2, ge=0, description="LLM API 重试次数")

    # ── 硬件加速 ──────────────────────────────────────────────
    accelerator_device: str = Field(
        default="auto",
        description="推理设备：auto / cpu / cuda (NVIDIA) / mps (Apple Silicon) / xpu (Intel)",
    )
    accelerator_num_threads: int = Field(default=8, ge=1, description="CPU 推理线程数")
    accelerator_ocr_batch_size: int = Field(
        default=0,
        ge=0,
        description="OCR 推理 batch size（0 = 根据设备显存自动推断）",
    )
    accelerator_layout_batch_size: int = Field(
        default=0,
        ge=0,
        description="Layout 推理 batch size（0 = 根据设备显存自动推断）",
    )
    accelerator_table_batch_size: int = Field(
        default=0,
        ge=0,
        description="Table 推理 batch size（0 = 根据设备显存自动推断）",
    )

    # ── Docling PDF 引擎 ──────────────────────────────────────
    docling_enabled: bool = Field(
        default=True,
        description=(
            "允许 Docling 参与 PDF Pipeline 调度（默认 True）。"
            "实际是否运行仍取决于 `is_available()` 运行时能力检测——"
            "未安装 docling 可选依赖时会自动跳过，不会影响其它工具。"
            "如需在已安装环境下显式禁用，可通过环境变量或 YAML 覆盖为 False。"
        ),
    )
    docling_ocr_enabled: bool = Field(default=True, description="为扫描版 PDF 启用 OCR")
    docling_table_extraction_enabled: bool = Field(
        default=True, description="启用 Docling 高级表格提取"
    )
    docling_formula_extraction_enabled: bool = Field(
        default=True, description="启用 Docling 数学公式提取"
    )

    # ── MinerU PDF 引擎 ──────────────────────────────────────
    mineru_enabled: bool = Field(
        default=True,
        description=(
            "允许 MinerU 参与 PDF Pipeline 调度（Apache 2.0，最佳 LaTeX 公式提取，CDM 90.85）。"
            "默认 True，实际是否运行取决于 `is_available()`：未安装 mineru 可选依赖时会自动跳过。"
            "如需显式禁用，可通过环境变量或 YAML 覆盖为 False。"
        ),
    )
    mineru_device: str = Field(
        default="auto",
        description="MinerU 推理设备：auto / cpu / mlx (Apple Silicon) / cuda",
    )
    mineru_backend: str = Field(
        default="auto",
        description="MinerU 后端：auto（触发自动检测，不直接传递）/ pipeline / vlm-auto-engine",
    )
    mineru_mps_backend: str = Field(
        default="auto",
        description=(
            "Apple Silicon (MPS) 下的 MinerU 后端策略："
            "auto（探测 mlx_vlm 与 macOS 版本择优）/ vlm-auto-engine（强制 VLM，"
            "MinerU 内部命中 mlx-engine 时加速 100-200%）/ pipeline（强制 CPU pipeline，"
            "绕过 VLM 路径，避免回退 transformers 的慢路径）。"
            "默认 auto：mlx_vlm 已装 + macOS 13.5+ → vlm-auto-engine；否则 → pipeline。"
        ),
    )

    # ── Pipeline Engine Selector ────────────────────────────
    pipeline_engine_selector: str = Field(
        default="profile_aware",
        description=(
            "Adaptive Engine Selection 策略："
            "profile_aware（默认）= 基于 DocumentCharacteristics 动态重排各 Stage 的 "
            "tool 顺序、并在 has_tables/has_formulas/has_code_blocks/has_images "
            "为 False 时短路对应 Stage；identity = 保持 YAML 静态顺序，回退 PR2 前行为。"
        ),
    )

    # ── PyMuPDF 多页并行 ────────────────────────────────────
    pdf_pymupdf_parallel_pages: int = Field(
        default=0,
        ge=0,
        description=(
            "PyMuPDF text/image stage 内的多页并行 chunk 大小。"
            "0 = 自动按 CPU 推断（max(1, min(8, cpu//2))，Apple Silicon E-core 不参与）；"
            ">0 = 显式覆盖。<10 页文档强制串行（开销 > 收益）。"
        ),
    )

    # ── Marker PDF 引擎 ──────────────────────────────────────
    marker_enabled: bool = Field(
        default=True,
        description=(
            "允许 Marker 参与 PDF Pipeline 调度（GPL-3.0，最佳整体准确率 95.67）。"
            "默认 True，实际是否运行取决于 `is_available()`：未安装 marker 可选依赖时会自动跳过。"
            "注意 GPL-3.0 许可证，商业使用需评估；如需显式禁用，可通过环境变量或 YAML 覆盖为 False。"
        ),
    )
    marker_llm_enhanced: bool = Field(
        default=False,
        description="启用 Marker LLM 增强模式（需额外 LLM 配置）",
    )
    marker_license_acknowledged: bool = Field(
        default=False,
        description="确认 Marker GPL-3.0 许可证条款（商业使用需评估）",
    )
    marker_torch_device: Optional[str] = Field(
        default=None,
        description=(
            "Marker TORCH_DEVICE 透传值：None（默认 CPU 强制，最稳定）/ 'cpu' / "
            "'mps'（Apple Silicon，自担 text detection 风险）/ 'cuda'。"
            "切换到 'mps' 时建议先在样本 PDF 上验证 detection 输出无丢字。"
        ),
    )
    marker_inference_ram_gb: int = Field(
        default=0,
        ge=0,
        description=(
            "Marker INFERENCE_RAM 透传值（GB）。0 = 不设置（使用 Marker 默认）。"
            "Apple Silicon 推荐设为统一内存的 ~50%（如 36GB 内存设 16-18），"
            "超过 50% 易触发 page out。"
        ),
    )
    marker_num_workers: int = Field(
        default=0,
        ge=0,
        description=(
            "Marker NUM_WORKERS 透传值（每 GPU 并行进程数）。0 = 不设置。"
            "受 INFERENCE_RAM / VRAM_PER_TASK 约束。"
        ),
    )
    marker_half_precision: bool = Field(
        default=False,
        description=(
            "marker_torch_device='mps' 时通过 monkey-patch 启用 MODEL_DTYPE=float16。"
            "默认 False（保持 float32 数值稳定）；启用后内存 -50%，吞吐显著提升，"
            "但需在样本 PDF 上验证精度。"
        ),
    )

    # ── OpenDataLoader PDF 引擎（Apache 2.0 / CPU-only / 全元素 bbox）─────────
    opendataloader_enabled: bool = Field(
        default=True,
        description=(
            "允许 OpenDataLoader 参与 PDF Pipeline 调度（Apache-2.0，CPU-only）。"
            "默认 True，实际是否运行取决于 `is_available()`：需 Java 11+ 且安装 opendataloader-pdf。"
        ),
    )
    opendataloader_use_struct_tree: bool = Field(
        default=True,
        description="利用 Tagged PDF 原生结构（若存在），提供高质量 reading order。",
    )
    opendataloader_sanitize: bool = Field(
        default=False,
        description="启用 prompt injection / PII 过滤（影响内容完整性，默认关闭）。",
    )
    opendataloader_hybrid_enabled: bool = Field(
        default=False,
        description="启用 hybrid 模式（需 opendataloader-pdf-hybrid 边车 server）。",
    )
    opendataloader_hybrid_endpoint: Optional[str] = Field(
        default=None,
        description="hybrid server 端点 URL（hybrid_enabled=True 时必填）。",
    )
    opendataloader_java_check_timeout: int = Field(
        default=3,
        description="Java 可用性检测超时（秒）。",
    )

    # ── 表格质量过滤（PyMuPDF find_tables 兜底启发式） ─────────
    pdf_table_quality_filter_enabled: bool = Field(
        default=True,
        description=(
            "启用后在 PyMuPDF find_tables 结果上再叠加质量过滤，"
            "剔除「空白率高 / 单值同质 / 半数列近空」的伪表格；"
            "关闭后回退到仅 row_count>=2 & col_count>=2 的原行为。"
        ),
    )
    pdf_table_quality_min_occupancy: float = Field(
        default=0.40,
        ge=0.0,
        le=1.0,
        description=(
            "单元格非空比例下限；低于该比例判定为伪表格。"
            "0.40 对应「过半单元格都是空串」的稀疏结构。"
        ),
    )
    pdf_table_quality_max_weak_cols_ratio: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description=(
            "列弱占比上限；单列非空率 < 40% 视为弱列，"
            "若弱列数 > 总列数 × 该比例则判定为伪表格。"
        ),
    )
    pdf_table_quality_min_unique_cells: int = Field(
        default=3,
        ge=1,
        description=(
            "单元格不同值数量下限；所有单元格去重后 ≤ 该值判定为页眉/重复行伪表格。"
        ),
    )
    pdf_table_quality_prose_rows_threshold: int = Field(
        default=50,
        ge=2,
        description=(
            "信号 a 触发阈值：行数 > 该值且列数在 prose_cols_max 内时判定为正文段落。"
            "学术论文真实表格极少超过 50 行；调高可保护多行长表，调低更激进。"
        ),
    )
    pdf_table_quality_prose_cols_max: int = Field(
        default=3,
        ge=1,
        description=(
            "信号 a 列数上限：列数 ≤ 该值时启用正文段落检测。"
            "默认 3 仅对 2-3 列文本敏感；4-5 列更可能是真实数据表，跳过该信号。"
        ),
    )
    pdf_table_quality_prose_fragment_ratio: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description=(
            "信号 b 单词断裂率阈值：相邻单元格间字母-小写连接占比超过该值视为正文。"
            "学术表格中相邻列的领域术语断裂率约 0.2-0.4，0.5 为安全上限。"
        ),
    )
    pdf_table_quality_bypass_with_title: bool = Field(
        default=True,
        description=(
            "对带有 'Table N: ...' 标题的候选跳过散文检测信号。"
            "仅信号 a/b 被旁路；occupancy/weak_cols/uniqueness 三道结构过滤仍生效。"
        ),
    )

    # ── PDF 阶段超时倍率（统一全局缩放，便于硬件慢机调试）────
    pdf_stage_timeout_multiplier: float = Field(
        default=1.0,
        gt=0.0,
        le=10.0,
        description=(
            "Pipeline 中各 Stage timeout 的全局倍率；>1 放宽，<1 收紧。"
            "支持环境变量 NEGENTROPY_PERCEIVES_PDF_STAGE_TIMEOUT_MULTIPLIER 覆盖。"
        ),
    )

    # ── 图片抽取并发度（PyMuPDF 单页非线程安全，按页协程级并发）──
    pdf_image_extraction_concurrency: int = Field(
        default=8,
        ge=1,
        le=32,
        description=(
            "image_extraction Stage 的页级 Semaphore 并发上限。"
            "M 系列芯片大内存机型可适当上调以减少 18 张图 91s 的单线性瓶颈。"
        ),
    )

    # ── Docling MPS 策略 ──────────────────────────────────────
    pdf_docling_force_cpu: bool = Field(
        default=False,
        description=(
            "强制 Docling 在 CPU 上推理，跳过 MPS 注入。"
            "用于诊断 MPS 兼容性问题或在 macOS 上回退到稳定路径。"
        ),
    )
    pdf_docling_mps_enrichment: Literal["granite_mlx", "disable"] = Field(
        default="granite_mlx",
        description=(
            "Apple Silicon MPS 下 Docling code/formula enrichment 策略："
            "granite_mlx 使用 Granite Docling + MLX，避免 CodeFormulaV2 退回 CPU；"
            "disable 关闭 Docling code/formula enrichment，使用其它引擎/后处理兜底。"
        ),
    )

    # ── 引擎预热 ──────────────────────────────────────────────
    pdf_engine_warmup_enabled: bool = Field(
        default=True,
        description=(
            "在 preprocessing/quick_scan 期间异步预热 docling/mineru/marker worker，"
            "把 ~2-12s 冷启动开销移出 layout_analysis 关键路径。"
        ),
    )

    # ── Pipeline 编排 ─────────────────────────────────────────
    pipeline: Optional[PipelineConfig] = Field(
        default=None,
        description="Pipeline Stage 编排配置（PDF/WebPage 处理管线）",
    )

    model_config = {
        "extra": "ignore",
        "env_prefix": "NEGENTROPY_PERCEIVES_",
        "env_ignore_empty": True,
        "frozen": True,
    }

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: InitSettingsSource,  # type: ignore[override]
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        """自定义配置源优先级链。"""
        return (
            init_settings,
            env_settings,
            _UserYamlConfigSource(settings_cls),
        )

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v):
        """Validate log level is one of the standard logging levels."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"log_level must be one of: {valid_levels}")
        return v.upper()

    @field_validator("transport_mode")
    @classmethod
    def validate_transport_mode(cls, v):
        """Validate transport mode is one of the supported modes."""
        valid_modes = ["stdio", "http", "sse"]
        if v.lower() not in valid_modes:
            raise ValueError(f"transport_mode must be one of: {valid_modes}")
        return v.lower()

    @field_validator("accelerator_device")
    @classmethod
    def validate_accelerator_device(cls, v):
        """Validate accelerator device is one of the supported devices."""
        valid_devices = ["auto", "cpu", "cuda", "mps", "xpu"]
        if v.lower() not in valid_devices:
            raise ValueError(f"accelerator_device must be one of: {valid_devices}")
        return v.lower()

    def get_scrapy_settings(self) -> Dict[str, Any]:
        """Get Scrapy-specific settings as a dictionary."""
        return {
            "CONCURRENT_REQUESTS": self.concurrent_requests,
            "DOWNLOAD_DELAY": self.download_delay,
            "RANDOMIZE_DOWNLOAD_DELAY": self.randomize_download_delay,
            "AUTOTHROTTLE_ENABLED": self.autothrottle_enabled,
            "AUTOTHROTTLE_START_DELAY": self.autothrottle_start_delay,
            "AUTOTHROTTLE_MAX_DELAY": self.autothrottle_max_delay,
            "AUTOTHROTTLE_TARGET_CONCURRENCY": self.autothrottle_target_concurrency,
            "RETRY_TIMES": self.max_retries,
            "DOWNLOAD_TIMEOUT": self.request_timeout,
            "USER_AGENT": self.default_user_agent,
        }

    def get_docling_settings(self) -> Dict[str, Any]:
        """Get Docling-specific settings as a dictionary."""
        return {
            "device": self.accelerator_device,
            "num_threads": self.accelerator_num_threads,
            "enable_ocr": self.docling_ocr_enabled,
            "enable_table_extraction": self.docling_table_extraction_enabled,
            "enable_formula_extraction": self.docling_formula_extraction_enabled,
            "ocr_batch_size": self.accelerator_ocr_batch_size,
            "layout_batch_size": self.accelerator_layout_batch_size,
            "table_batch_size": self.accelerator_table_batch_size,
            "mps_enrichment": self.pdf_docling_mps_enrichment,
        }


# ---------------------------------------------------------------------------
# 全局设置实例（模块级惰性初始化）
# ---------------------------------------------------------------------------

settings = build_settings()
