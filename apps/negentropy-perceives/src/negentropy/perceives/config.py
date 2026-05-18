"""Negentropy Perceives MCP Server 配置管理模块。

基于 pydantic-settings 的分层配置系统，按优先级从低到高：
1. 内置默认配置（config.default.yaml，打包在 wheel 内）
2. 用户 YAML 配置（~/.negentropy/perceives.config.yaml）
3. 环境变量（NEGENTROPY_PERCEIVES_ 前缀）
4. -c/--config 显式配置（最高优先级，通过构造函数传入）

config.default.yaml 为所有配置的单一事实默认值源。
Python Field 定义仅作为安全回退（fallback）。
"""

from __future__ import annotations

import logging
import yaml
from pathlib import Path
from typing import Any, Dict, Literal, Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import (
    BaseSettings,
    InitSettingsSource,
    PydanticBaseSettingsSource,
)

from . import __version__

# 通过向后兼容层导入 PipelineConfig，避免循环引用：
# config → core.pipeline_config → core.__init__ → core.services → scraping → config.settings
from ._pipeline_config import PipelineConfig  # type: ignore[attr-defined]  # noqa: F401 — re-exports from core.pipeline_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 项目根目录定位
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


# ---------------------------------------------------------------------------
# 配置字典工具函数（展平 / 深度合并）
# ---------------------------------------------------------------------------


# 不展平的顶层键集合（嵌套结构体直接透传）
_NO_FLATTEN_KEYS = frozenset({"pipeline"})


def _flatten_nested_yaml(data: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    """将嵌套 YAML 字典递归展平为以 ``_`` 连接的扁平键。

    用于将层级化的 YAML 配置转换为与 :class:`NegentropyPerceivesSettings`
    扁平字段名一一对应的字典。例如::

        {"server": {"name": "x"}, "log_level": "INFO"}
        → {"server_name": "x", "log_level": "INFO"}

    **向后兼容**：若同一键名同时出现在顶层扁平键和嵌套展开结果中，
    **扁平键优先**，确保旧版扁平 YAML 配置无缝兼容。

    **透传机制**：:data:`_NO_FLATTEN_KEYS` 中声明的顶层键不参与展平，
    其嵌套结构体将作为完整对象直接传递给对应的 Pydantic 模型字段。

    Args:
        data: 可能包含嵌套子字典的配置字典
        prefix: 递归调用时的键名前缀（内部使用）

    Returns:
        展平后的扁平字典
    """
    nested: Dict[str, Any] = {}
    flat: Dict[str, Any] = {}
    for key, value in data.items():
        full_key = f"{prefix}{key}" if prefix else key
        if not prefix and key in _NO_FLATTEN_KEYS:
            # 顶层特殊键：不展平，整体保留
            flat[full_key] = value
        elif isinstance(value, dict):
            nested.update(_flatten_nested_yaml(value, prefix=f"{full_key}_"))
        else:
            flat[full_key] = value
    # 扁平键覆盖嵌套展开的同名键（向后兼容保证）
    nested.update(flat)
    return nested


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """递归深度合并两个字典。

    合并规则：
    - 标量值：override 覆盖 base
    - 嵌套字典：递归合并（非整体替换）
    - 列表值：override 完整替换 base（pipeline.*.stages 通过
      :func:`_merge_named_list` 单独处理，参见 :func:`_prepare_user_yaml`）
    - override 中值为 None 的键：跳过（保留 base 原值）

    Args:
        base: 底层字典（低优先级）
        override: 覆盖字典（高优先级）

    Returns:
        合并后的新字典
    """
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        elif value is not None:
            result[key] = value
    return result


def _merge_named_list(
    base: list,
    override: list,
    key: str = "name",
) -> list:
    """按 ``key`` 字段匹配合并两个对象列表。

    用于 :func:`_prepare_user_yaml` 对 ``pipeline.*.stages`` 数组执行
    按 ``name`` 匹配的智能合并，防止用户 config 的旧 stages 数组完全
    覆盖默认 config 中新增的 ``competition`` 字段（如 ``timeout`` 增大、
    ``early_win_cancel`` 等）。

    合并策略：
    1. 用户 config 中的 stage 按 ``name`` 与默认 stage 匹配并递归合并
       （保留用户显式设置的值，补充默认中新增的字段）
    2. 默认 config 中有但用户 config 中没有的 stage，追加到结果
    3. 用户 config 中新增的 stage（默认中无）也包含

    Args:
        base: 默认 config 的 stages 列表（低优先级）
        override: 用户 config 的 stages 列表（高优先级）
        key: 匹配字段名，默认 ``name``

    Returns:
        合并后的 stages 列表
    """
    base_by_name: Dict[str, Dict[str, Any]] = {
        item[key]: item for item in base if isinstance(item, dict) and key in item
    }
    result: list = []
    seen: set = set()

    for item in override:
        if not isinstance(item, dict) or key not in item:
            result.append(item)
            continue
        name = item[key]
        if name in base_by_name:
            merged = deep_merge(base_by_name[name], item)
            result.append(merged)
        else:
            result.append(item)
        seen.add(name)

    for item in base:
        if isinstance(item, dict) and key in item:
            name = item[key]
            if name not in seen:
                result.append(item)

    return result


def _get_stages(data: Dict[str, Any], pipeline_name: str) -> Optional[list]:
    """从配置字典中安全提取 pipeline stages 数组。"""
    try:
        return data.get("pipeline", {}).get(pipeline_name, {}).get("stages")
    except (AttributeError, TypeError):
        return None


def _set_stages(data: Dict[str, Any], pipeline_name: str, stages: list) -> None:
    """将合并后的 stages 写回配置字典。"""
    pipeline = data.setdefault("pipeline", {})
    pipe_cfg = pipeline.setdefault(pipeline_name, {})
    pipe_cfg["stages"] = stages


# ---------------------------------------------------------------------------
# YAML 配置加载
# ---------------------------------------------------------------------------


def _load_bundled_yaml() -> Dict[str, Any]:
    """加载内置默认 YAML 配置（打包在 wheel 内）。

    作为所有配置的基线默认值源，与用户 YAML 进行深度合并后参与运行时解析。
    同时也用于 --init-config 复制和文档参考。

    Returns:
        解析后的配置字典

    Raises:
        FileNotFoundError: 内置配置文件缺失
        yaml.YAMLError: YAML 格式错误
    """
    from importlib import resources

    bundled_path = resources.files(__package__).joinpath("config.default.yaml")
    if not bundled_path.is_file():
        raise FileNotFoundError(
            f"Bundled config not found: {bundled_path}. "
            "Ensure config.default.yaml is included in package_data."
        )
    with bundled_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _get_user_config_path() -> Path:
    """获取用户配置文件的标准路径。

    Returns:
        用户配置文件路径：~/.negentropy/perceives.config.yaml
    """
    return Path.home() / ".negentropy" / "perceives.config.yaml"


def _load_yaml_file(path: Path) -> Optional[Dict[str, Any]]:
    """安全加载 YAML 文件。

    Args:
        path: YAML 文件路径

    Returns:
        解析后的字典，或 None（文件不存在时）
    """
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except (yaml.YAMLError, OSError) as exc:
        logger.warning("加载配置文件失败 %s: %s", path, exc)
        return None


# ---------------------------------------------------------------------------
# 用户 YAML 配置数据存储（供自定义 SettingsSource 读取）
# ---------------------------------------------------------------------------

# 模块级缓存：用户 YAML 配置数据（不含 bundled 默认值）
_user_yaml_data: Dict[str, Any] = {}

# CLI 覆盖路径缓存（由 reload_settings 设置）
_config_path_override: Optional[str] = None


class _UserYamlConfigSource(PydanticBaseSettingsSource):
    """自定义配置源：将合并后的 YAML 配置数据注入 pydantic-settings 优先级链。

    包含内置默认（config.default.yaml）与用户 YAML 深度合并后的完整配置。
    环境变量可正确覆盖所有 YAML 配置的字段。

    优先级位置（靠前者优先级更高）：init_settings(-c) > env_settings > _UserYamlConfigSource(YAML)
    即：-c 显式配置 > 环境变量 > 合并后的 YAML 配置

    pydantic-settings v2 通过 ``__call__()`` 获取配置源的完整值字典，
    高优先级源的值自动覆盖低优先级源。
    """

    def __call__(self) -> Dict[str, Any]:
        """返回合并后的 YAML 配置数据，供 pydantic-settings 参与优先级链合并。"""
        return dict(_user_yaml_data)

    def get_field_value(  # type: ignore[override]
        self,
        field: Any,
        field_name: str,
    ) -> tuple[Any, str | None, bool]:
        """满足抽象方法协议（实际值已通过 __call__() 提供）。"""
        return None, None, False


# ---------------------------------------------------------------------------
# 配置发现与合并（核心编排逻辑）
# ---------------------------------------------------------------------------


def _prepare_user_yaml(
    *,
    config_path: Optional[str] = None,
) -> Dict[str, Any]:
    """加载并合并配置：内置默认 ← 用户 YAML（深度合并）。

    优先级：config.default.yaml(低) < 用户 YAML(高)
    用户 YAML 中仅声明差异项即可，未指定的字段保留内置默认值。

    Args:
        config_path: 显式指定的配置文件路径（-c/--config 参数）

    Returns:
        合并后的配置字典
    """
    global _user_yaml_data

    # 第 1 层：加载内置默认配置（所有配置的基线）
    bundled_dict = _load_bundled_yaml()

    # 第 2 层：加载用户配置（覆盖内置默认的差异项）
    effective_path = config_path or _config_path_override
    if effective_path:
        user_path = Path(effective_path).expanduser().resolve()
    else:
        user_path = _get_user_config_path()

    user_dict = _load_yaml_file(user_path) or {}

    # 深度合并：用户配置仅覆盖差异项，非全文替换
    merged = deep_merge(bundled_dict, user_dict)

    # pipeline stages 数组需要按 name 智能合并而非整体替换。
    # deep_merge 对列表执行整体替换，会导致用户 config 的旧 stages 数组
    # 丢失默认 config 中新增的字段（如 timeout 增大、early_win_cancel 等）。
    for pipeline_name in ("pdf", "webpage"):
        base_stages = _get_stages(bundled_dict, pipeline_name)
        user_stages = _get_stages(user_dict, pipeline_name)
        if base_stages is not None and user_stages is not None:
            merged_stages = _merge_named_list(base_stages, user_stages)
            _set_stages(merged, pipeline_name, merged_stages)
    # 嵌套 YAML 展平为扁平键（兼容层级化与扁平配置格式）
    merged = _flatten_nested_yaml(merged)
    _user_yaml_data = merged
    return merged


def build_settings(
    *,
    config_path: Optional[str] = None,
) -> NegentropyPerceivesSettings:
    """构建配置实例，执行完整的分层优先级合并。

    策略：
    - 无显式 config_path：加载内置默认 + ~/.negentropy/ 配置（深度合并），
      通过 _UserYamlConfigSource 注入，优先级为 内置默认 < 用户YAML < 环境变量
    - 有显式 config_path(-c)：将合并后的 YAML 作为构造参数传入，
      优先级为 内置默认 < 用户YAML < 环境变量 < -c 显式配置(最高)

    Args:
        config_path: 显式指定的配置文件路径（-c/--config 参数）

    Returns:
        完全初始化的配置实例
    """
    if config_path:
        # 显式指定配置文件：加载合并后的配置，作为构造参数传入（最高优先级）
        user_dict = _prepare_user_yaml(config_path=config_path)
        if user_dict:
            return NegentropyPerceivesSettings(**user_dict)
        return NegentropyPerceivesSettings()
    else:
        # 无显式指定：通过自定义 Source 注入合并后的配置
        _prepare_user_yaml(config_path=None)
        return NegentropyPerceivesSettings()


def reload_settings(
    *,
    config_path: Optional[str] = None,
) -> NegentropyPerceivesSettings:
    """重建全局配置单例。

    必须在任何使用 settings 之前调用（通常在 main() 入口处）。
    用于 CLI --config 覆盖场景，使全局 settings 反映用户指定的配置文件。

    Args:
        config_path: 显式指定的配置文件路径

    Returns:
        新建的全局配置实例
    """
    global settings, _config_path_override
    _config_path_override = config_path
    settings = build_settings(config_path=config_path)
    return settings


# ---------------------------------------------------------------------------
# 配置诊断
# ---------------------------------------------------------------------------


def describe_config_sources(
    *,
    config_path: Optional[str] = None,
) -> str:
    """报告配置来源详情，用于启动诊断。

    Args:
        config_path: 显式指定的配置文件路径

    Returns:
        人类可读的配置来源描述
    """
    sources: list[str] = []

    # 内置默认配置始终生效
    sources.append("bundled-default(config.default.yaml)")

    # User config
    effective_path = config_path or _config_path_override
    if effective_path:
        p = Path(effective_path).expanduser().resolve()
        label = (
            f"custom-config({p})" if p.is_file() else f"custom-config({p}, not found)"
        )
        sources.append(label)
    else:
        standard_path = _get_user_config_path()
        if standard_path.is_file():
            sources.append(f"user-config({standard_path})")

    if len(sources) == 1:  # 仅内置默认，无用户配置
        return "Using bundled defaults (config.default.yaml) and environment variables"

    return f"Loaded: {', '.join(sources)}"


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
            "剔除“空白率高 / 单值同质 / 半数列近空”的伪表格；"
            "关闭后回退到仅 row_count>=2 & col_count>=2 的原行为。"
        ),
    )
    pdf_table_quality_min_occupancy: float = Field(
        default=0.40,
        ge=0.0,
        le=1.0,
        description=(
            "单元格非空比例下限；低于该比例判定为伪表格。"
            "0.40 对应“过半单元格都是空串”的稀疏结构。"
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
        """自定义配置源优先级链。

        返回元组中从左到右优先级递减（靠前者优先级更高）：
          init_settings(-c显式配置) > env_settings(环境变量) > _UserYamlConfigSource(合并后YAML)

        注意：dotenv_settings 参数保留在签名中以符合 pydantic-settings 协议，
        但不再加入返回元组（.env 支持已移除）。
        """
        return (
            init_settings,  # -c 显式配置（最高优先级，靠前）
            env_settings,  # 环境变量（中优先级）
            _UserYamlConfigSource(settings_cls),  # 内置默认+用户YAML（低优先级，靠后）
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
        """Get Docling-specific settings as a dictionary.

        Returns settings compatible with Docling's AcceleratorOptions and
        pipeline configuration.

        Example:
            >>> settings.get_docling_settings()
            {'device': 'auto', 'num_threads': 4, 'enable_ocr': True, ...}
        """
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
