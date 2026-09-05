"""scripts/ 目录共享日志配置工具。

独立脚本不经 ``negentropy.engine.bootstrap``（后者在 import 期配置日志，但会拉起
ADK / LiteLLM 等重型依赖），若不显式配置，structlog 将停留在**出厂默认**：
不过滤 DEBUG + stock ``ConsoleRenderer``（``_name`` 键泄漏、格式与后端不一致），
且 ``NE_LOG_LEVEL`` 完全失效。

本模块把 ``settings.log_*`` 映射到项目唯一的日志入口 ``configure_logging``，
让脚本与后端共享同一套级别控制与输出格式。脚本通过 ``sys.path[0]`` 解析同目录
模块，可直接 ``from _logging import configure_script_logging``。
"""

from __future__ import annotations

from negentropy.config import settings
from negentropy.logging import configure_logging


def configure_script_logging(*, level: str | None = None) -> None:
    """按项目配置初始化脚本日志（级别默认取 ``settings.log_level``，尊重 ``NE_LOG_LEVEL``）。

    注意：``configure_logging`` 会以 ``StreamToLogger`` 接管 ``sys.stdout`` /
    ``sys.stderr``，故调用方的 ``print`` 会被转为日志行——脚本应改用 logger 输出汇总。
    失败路径必须显式走 ``logger.error`` / ``logger.exception``：print 只落 INFO 级，
    会被 ``NE_LOG_LEVEL>=WARNING`` 过滤为静默失败。
    """
    configure_logging(
        level=level or settings.log_level,
        sinks=settings.log_sinks,
        fmt=settings.log_format,
        file_path=settings.log_file_path,
        gcloud_project=settings.vertex_project_id,
        gcloud_log_name=settings.gcloud_log_name,
        console_timestamp_format=settings.log_console_timestamp_format,
        console_level_width=settings.log_console_level_width,
        console_logger_width=settings.log_console_logger_width,
        console_separator=settings.log_console_separator,
        service_name=settings.log_service_name,
    )
