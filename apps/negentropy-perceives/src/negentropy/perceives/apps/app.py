"""FastMCP application entry point for Negentropy Perceives."""

import argparse
import asyncio
import atexit
import logging
import sys
from pathlib import Path

import yaml

from ..config import (
    _get_user_config_path,
    _load_bundled_yaml,
    describe_config_sources,
    reload_settings,
    settings,
)
from ..core.logging import (
    _lockdown_fastmcp_logging,
    build_uvicorn_log_config,
    setup_logging,
)
from ..infra.engine_worker import shutdown_engine_pool

logger = logging.getLogger(__name__)


def _active_cli_name() -> str:
    """Return the current CLI executable name for user-facing diagnostics."""
    argv0 = sys.argv[0] if sys.argv else "negentropy-perceives"
    return Path(argv0).name or "negentropy-perceives"


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """解析命令行参数。

    Args:
        argv: 参数列表，默认使用 sys.argv[1:]

    Returns:
        解析后的参数命名空间
    """
    parser = argparse.ArgumentParser(
        prog="negentropy-perceives",
        description="Negentropy Perceives MCP Server — 商业级 Web 内容与 PDF 提取服务",
    )
    parser.add_argument(
        "-c",
        "--config",
        type=str,
        default=None,
        metavar="PATH",
        help="指定自定义 YAML 配置文件路径（优先级高于用户配置）",
    )
    parser.add_argument(
        "--init-config",
        action="store_true",
        default=False,
        help="生成用户配置模板后退出（配合 --force 写入完整参考配置）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        default=False,
        help="与 --init-config 配合使用，强制覆盖为完整参考配置",
    )
    return parser.parse_args(argv)


_USER_CONFIG_TEMPLATE = """\
# =============================================================================
# Negentropy Perceives 用户配置
# =============================================================================
#
# 本文件仅需声明与内置默认不同的配置项（差异项覆盖）。
# 内置默认值参见包内 config.default.yaml 或运行:
#   negentropy-perceives --init-config --force
#
# 配置优先级（从低到高）：
#   1. 内置默认 config.default.yaml
#   2. 本文件（~/.negentropy/perceives.config.yaml）
#   3. NEGENTROPY_PERCEIVES_* 环境变量
#   4. -c / --config 显式指定的配置文件
#
# 示例（取消注释并修改即可生效）：
# ---
# transport:
#   mode: stdio
#
# http:
#   host: 0.0.0.0
#   port: 2992
#
# log:
#   level: DEBUG
#
# concurrent_requests: 32
"""


def _ensure_user_config(*, force: bool = False) -> None:
    """确保用户配置文件存在，首次运行时生成最小化模板。

    生成的模板仅包含注释引导和已注释的示例配置项，
    避免写入完整默认值导致版本升级时"配置漂移"。

    Args:
        force: 强制覆盖已有配置文件（用于 --init-config --force）
    """
    user_path = _get_user_config_path()
    if user_path.exists() and not force:
        return

    try:
        user_path.parent.mkdir(parents=True, exist_ok=True)
        if force:
            # --force 模式：写入完整的内置默认配置作为参考
            bundled_dict = _load_bundled_yaml()
            with user_path.open("w", encoding="utf-8") as f:
                yaml.dump(
                    bundled_dict,
                    f,
                    default_flow_style=False,
                    allow_unicode=True,
                    sort_keys=False,
                )
            logger.info("已生成完整参考配置文件: %s", user_path)
        else:
            # 常规模式：写入最小化模板（仅注释引导）
            user_path.write_text(_USER_CONFIG_TEMPLATE, encoding="utf-8")
            logger.info("已生成用户配置模板: %s", user_path)
    except OSError as exc:
        logger.warning("无法创建用户配置文件 %s: %s", user_path, exc)


def main(argv: list[str] | None = None) -> None:
    """Run the MCP server."""
    # ── 步骤 0：解析 CLI 参数 ──
    args = _parse_args(argv)

    # --init-config 模式：生成配置文件后退出
    if args.init_config:
        _ensure_user_config(force=args.force)
        print(f"用户配置已生成至: {_get_user_config_path()}")
        sys.exit(0)

    # ── 步骤 1：构建配置（必须在其他操作之前） ──
    reload_settings(config_path=args.config)
    _ensure_user_config()

    # ── 步骤 2：初始化日志体系（必须在导入 tools 之前） ──
    setup_logging(settings.log_level)

    # ── 步骤 3：延迟导入 tools（触发 @app.tool 注册，此时 logger 已就绪） ──
    from ..tools import app  # noqa: E402

    # ── 步骤 3.5：拦截 FastMCP RichHandler，统一日志格式 ──
    _lockdown_fastmcp_logging()

    cli_name = _active_cli_name()
    logger.info("Starting %s v%s", settings.server_name, settings.server_version)
    logger.info("CLI entrypoint: %s", cli_name)
    logger.info("Transport mode: %s", settings.transport_mode)
    logger.info(
        "JavaScript support: %s",
        "Enabled" if settings.enable_javascript else "Disabled",
    )
    logger.info(
        "Random User-Agent: %s",
        "Enabled" if settings.use_random_user_agent else "Disabled",
    )
    logger.info("Proxy: %s", "Enabled" if settings.use_proxy else "Disabled")
    logger.info(
        "Resolved settings: server_name=%s, host=%s, port=%s, path=%s",
        settings.server_name,
        settings.http_host,
        settings.http_port,
        settings.http_path,
    )
    logger.info("Config sources: %s", describe_config_sources())

    # ── 步骤 3.6：注册 atexit 兜底清理（确保进程退出时子进程全部回收） ──
    atexit.register(_shutdown_engine_pool_sync)

    try:
        if settings.transport_mode in ["http", "sse"]:
            transport_type = "HTTP" if settings.transport_mode == "http" else "SSE"
            binding_host = settings.http_host
            binding_port = settings.http_port
            binding_path = settings.http_path

            if binding_host == "0.0.0.0":  # nosec B104
                logger.info(
                    "Starting %s server on %s:%s",
                    transport_type,
                    binding_host,
                    binding_port,
                )
                logger.info(
                    "Local endpoint: http://localhost:%s%s",
                    binding_port,
                    binding_path,
                )
                logger.info(
                    "Network endpoint: http://%s:%s%s",
                    binding_host,
                    binding_port,
                    binding_path,
                )
            else:
                logger.info(
                    "Starting %s server on %s:%s",
                    transport_type,
                    binding_host,
                    binding_port,
                )
                endpoint_url = f"http://{binding_host}:{binding_port}{binding_path}"
                logger.info("%s endpoint: %s", transport_type, endpoint_url)

            logger.info("CORS origins: %s", settings.http_cors_origins)

            # ── 步骤 4：构建 Uvicorn 日志配置并启动 ──
            uvicorn_log_config = build_uvicorn_log_config(settings.log_level)

            app.run(
                transport=settings.transport_mode,
                host=binding_host,
                port=binding_port,
                path=binding_path,
                show_banner=False,
                uvicorn_config={
                    "log_config": uvicorn_log_config,
                    "timeout_graceful_shutdown": 5,
                },
            )
        else:
            logger.info("Starting STDIO server")
            app.run(show_banner=False)
    finally:
        _shutdown_engine_pool_sync()


_shutdown_done = False


def _shutdown_engine_pool_sync() -> None:
    """同步封装 shutdown_engine_pool，兼顾 finally 与 atexit 两条收尾路径。

    atexit 路径下 stdio/日志流可能已被解释器关闭，异常需静默吞掉避免
    次生 I/O 错误污染退出码；同时用模块级 flag 保证幂等，避免重复执行。
    """
    global _shutdown_done
    if _shutdown_done:
        return
    _shutdown_done = True
    try:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(shutdown_engine_pool())
        finally:
            loop.close()
    except Exception:  # nosec B110
        # 退出阶段日志流可能已关闭；静默失败即可，worker 子进程已是 daemon
        # 即便未及时回收也会随主进程退出而终止
        pass


if __name__ == "__main__":
    main()
