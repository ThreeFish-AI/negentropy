"""集中式日志配置。进程级单次初始化，由 apps/app.py 入口调用。"""

import logging
import logging.config
import sys
import warnings
from typing import Any

from .task_context import (
    method_var,
    pipeline_var,
    source_var,
    stage_var,
    task_id_var,
)

# 统一格式常量（与 pyproject.toml [tool.pytest.ini_options] log_cli_format 风格对齐）
LOG_FORMAT = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


class TaskContextFilter(logging.Filter):
    """从 `contextvars` 读取任务上下文并写入 LogRecord。

    Why Filter：复用 Python 标准日志扩展点，在不修改任何 `logger.info(...)` 调用
    的前提下，给每条 LogRecord 附加 `task_id / source / pipeline / stage / method`
    属性，供 `ColoredFormatter` 渲染前缀。Filter 对已抑制的第三方 logger 同样生效。
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.task_id = task_id_var.get()
        record.source = source_var.get()
        record.pipeline = pipeline_var.get()
        record.stage = stage_var.get()
        record.method = method_var.get()
        return True


def _render_task_prefix(record: logging.LogRecord) -> str:
    """根据 LogRecord 上的任务上下文字段组装 `[k=v ...]` 前缀；全空则返回空串。

    渲染顺序固定：task → pipeline → stage → method。source 不渲染在前缀中，
    仅在中间件的入口/收尾行显式输出，避免日志冗长。
    """

    parts: list[str] = []
    task_id = getattr(record, "task_id", None)
    if task_id:
        parts.append(f"task={task_id}")
    pipeline = getattr(record, "pipeline", None)
    if pipeline:
        parts.append(f"pipeline={pipeline}")
    stage = getattr(record, "stage", None)
    if stage:
        parts.append(f"stage={stage}")
    method = getattr(record, "method", None)
    if method:
        parts.append(f"method={method}")
    if not parts:
        return ""
    return "[" + " ".join(parts) + "] "


class ColoredFormatter(logging.Formatter):
    """为 TTY 终端添加 ANSI 颜色标注；非 TTY 自动降级纯文本。

    TTY 模式下同步对 logger 名称按包层级缩写，提升可读性。
    """

    RESET = "\033[0m"

    _LEVEL_COLORS: dict[int, str] = {
        logging.CRITICAL: "\033[1;31m",  # 粗体红
        logging.ERROR: "\033[31m",  # 红
        logging.WARNING: "\033[33m",  # 黄
        logging.INFO: "\033[32m",  # 绿
        logging.DEBUG: "\033[36m",  # 青
    }
    _TIME_COLOR = "\033[2;37m"  # 暗灰（timestamp）
    _NAME_COLOR = "\033[34m"  # 蓝（logger name）

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        # 进程启动时 isatty() 已稳定，不需运行时重算
        self._use_colors: bool = hasattr(sys.stderr, "isatty") and sys.stderr.isatty()

    @staticmethod
    def _abbreviate_name(name: str, keep_last: int = 2) -> str:
        """按包层级缩短 logger 名称，保留末尾 keep_last 个组件完整。

        示例：negentropy.perceives.apps.app → n.p.apps.app
        """
        parts = name.split(".")
        if len(parts) <= keep_last:
            return name
        return ".".join([p[0] for p in parts[:-keep_last]] + parts[-keep_last:])

    def format(self, record: logging.LogRecord) -> str:
        prefix = _render_task_prefix(record)
        if not self._use_colors:
            base = super().format(record)
            if prefix:
                # 非 TTY 模式下前缀不着色，插在消息体前，保持可 grep
                return base.replace(
                    record.getMessage(), f"{prefix}{record.getMessage()}", 1
                )
            return base

        level_color = self._LEVEL_COLORS.get(record.levelno, "")
        asctime = self.formatTime(record, self.datefmt)
        display_name = self._abbreviate_name(record.name)

        message = record.getMessage()
        if record.exc_info:
            if not record.exc_text:
                record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            message = f"{message}\n{record.exc_text}"
        if record.stack_info:
            message = f"{message}\n{self.formatStack(record.stack_info)}"

        colored_prefix = f"{self._NAME_COLOR}{prefix}{self.RESET}" if prefix else ""
        return (
            f"{self._TIME_COLOR}{asctime}{self.RESET} "
            f"[{level_color}{record.levelname:<8}{self.RESET}] "
            f"{self._NAME_COLOR}{display_name}{self.RESET}: "
            f"{colored_prefix}{message}"
        )


def _lockdown_fastmcp_logging() -> None:
    """拦截 FastMCP 日志 handler，统一格式为项目标准。

    FastMCP 3.x 在 server.run() 内部向 'fastmcp' logger 追加 rich.RichHandler，
    导致与项目日志格式割裂。通过在 run() 调用前将 addHandler 替换为 no-op，
    确保所有 fastmcp.* 日志经由 root logger（已配置 ColoredFormatter）输出。

    须在工具模块导入后、app.run() 调用前执行。
    """
    fmcp_logger = logging.getLogger("fastmcp")
    fmcp_logger.propagate = True
    fmcp_logger.handlers.clear()
    fmcp_logger.addHandler = lambda _: None  # type: ignore[assignment]


# 高 verbosity 第三方 logger 的默认静音级别
_THIRD_PARTY_OVERRIDES: dict[str, str] = {
    "docling": "WARNING",
    "docling.pipeline": "WARNING",
    "docling.document_converter": "WARNING",
    "docling.datamodel": "WARNING",
    "urllib3": "WARNING",
    "httpcore": "WARNING",
    "httpx": "WARNING",
    "selenium": "WARNING",
    "undetected_chromedriver": "WARNING",
    "playwright": "WARNING",
    "mcp.server.lowlevel": "WARNING",
    "mcp.server.lowlevel.server": "WARNING",
}


def _configure_warning_filters() -> None:
    """抑制第三方依赖链中已知无害的 DeprecationWarning。

    这些警告源自 Docling 的传递依赖（SWIG 绑定、PyTorch），会被
    MCP 低层服务器的 ``warnings.catch_warnings(record=True)`` 捕获并
    以 INFO 级别重新记录。在 warnings 模块层面过滤可从源头阻断。
    """
    # SWIG 类型（Docling → Poppler/pdfium 绑定）
    warnings.filterwarnings(
        "ignore",
        message=r"builtin type Swig.*has no __module__ attribute",
        category=DeprecationWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message=r"builtin type swigvarlink has no __module__ attribute",
        category=DeprecationWarning,
    )
    # torch.jit.script_method（PyTorch，Docling ML 模型使用）
    warnings.filterwarnings(
        "ignore",
        message=r"`torch\.jit\.script_method` is deprecated",
        category=DeprecationWarning,
    )


def setup_logging(log_level: str = "INFO") -> None:
    """配置进程日志体系。

    - 设置 root logger 的级别与格式
    - 将所有日志输出到 stderr（避免 STDIO 传输模式下污染 MCP 协议流）
    - 压制高 verbosity 第三方库的日志级别
    - 抑制已知无害的 DeprecationWarning

    Args:
        log_level: 应用日志级别（来自 settings.log_level）
    """
    _configure_warning_filters()

    level = getattr(logging, log_level.upper(), logging.INFO)

    config: dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "task_context": {
                "()": "negentropy.perceives.core.logging.TaskContextFilter",
            },
        },
        "formatters": {
            "colored": {
                "()": "negentropy.perceives.core.logging.ColoredFormatter",
                "datefmt": LOG_DATE_FORMAT,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "colored",
                "stream": "ext://sys.stderr",
                "filters": ["task_context"],
            },
        },
        "root": {
            "level": level,
            "handlers": ["console"],
        },
    }

    logging.config.dictConfig(config)

    # 压制第三方库噪音
    for logger_name, override_level in _THIRD_PARTY_OVERRIDES.items():
        effective_level = getattr(logging, override_level, logging.WARNING)
        logging.getLogger(logger_name).setLevel(effective_level)


def build_uvicorn_log_config(log_level: str = "INFO") -> dict[str, Any]:
    """构建 Uvicorn 的 log_config 字典，使 access/error 日志格式与应用统一。

    通过 ``app.run(uvicorn_config={"log_config": ...})`` 传入 FastMCP。

    Args:
        log_level: 日志级别字符串

    Returns:
        Uvicorn LOGGING_CONFIG 兼容的字典
    """
    upper_level = log_level.upper()
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "task_context": {
                "()": "negentropy.perceives.core.logging.TaskContextFilter",
            },
        },
        "formatters": {
            "default": {
                "()": "negentropy.perceives.core.logging.ColoredFormatter",
                "datefmt": LOG_DATE_FORMAT,
            },
            "access": {
                "()": "negentropy.perceives.core.logging.ColoredFormatter",
                "datefmt": LOG_DATE_FORMAT,
            },
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "stream": "ext://sys.stderr",
                "filters": ["task_context"],
            },
            "access": {
                "class": "logging.StreamHandler",
                "formatter": "access",
                "stream": "ext://sys.stderr",
                "filters": ["task_context"],
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default"],
                "level": upper_level,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": upper_level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["access"],
                "level": upper_level,
                "propagate": False,
            },
        },
    }
