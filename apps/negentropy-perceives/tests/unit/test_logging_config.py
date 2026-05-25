"""单元测试：集中式日志配置模块 (_logging.py)。"""

import logging

from negentropy.perceives.core.logging import (
    LOG_DATE_FORMAT,
    ColoredFormatter,
    build_uvicorn_log_config,
    setup_logging,
)


class TestSetupLogging:
    """测试 setup_logging 函数。"""

    def test_sets_root_level_from_argument(self):
        """根据参数正确设置 root logger 级别。"""
        setup_logging("DEBUG")
        assert logging.getLogger().level == logging.DEBUG
        # 恢复默认
        setup_logging("INFO")

    def test_suppresses_docling_logger(self):
        """第三方库 docling 的日志级别被压制到 WARNING。"""
        setup_logging("DEBUG")
        docling_logger = logging.getLogger("docling")
        assert docling_logger.level >= logging.WARNING
        setup_logging("INFO")

    def test_suppresses_urllib3_logger(self):
        """第三方库 urllib3 的日志级别被压制到 WARNING。"""
        setup_logging("INFO")
        assert logging.getLogger("urllib3").level >= logging.WARNING

    def test_root_handler_is_stream_handler(self):
        """root logger 配置了 StreamHandler。"""
        setup_logging("INFO")
        root = logging.getLogger()
        assert len(root.handlers) >= 1
        handler = root.handlers[0]
        assert isinstance(handler, logging.StreamHandler)

    def test_idempotent_no_duplicate_handlers(self):
        """重复调用不叠加 handler（dictConfig 覆盖语义）。"""
        setup_logging("INFO")
        handler_count = len(logging.getLogger().handlers)
        setup_logging("INFO")
        assert len(logging.getLogger().handlers) == handler_count

    def test_case_insensitive_level(self):
        """日志级别参数大小写不敏感。"""
        setup_logging("debug")
        assert logging.getLogger().level == logging.DEBUG
        setup_logging("INFO")


class TestBuildUvicornLogConfig:
    """测试 Uvicorn 日志配置构建。"""

    def test_returns_valid_dict_config(self):
        """返回的字典包含 dictConfig 必需的 version 字段。"""
        config = build_uvicorn_log_config("INFO")
        assert config["version"] == 1
        assert "formatters" in config
        assert "handlers" in config
        assert "loggers" in config

    def test_format_matches_app_format(self):
        """Uvicorn 日志格式与应用日志格式一致（使用相同的 ColoredFormatter）。"""
        config = build_uvicorn_log_config("INFO")
        for fmt_name in ("default", "access"):
            assert (
                config["formatters"][fmt_name]["()"]
                == "negentropy.perceives.core.logging.ColoredFormatter"
            )
            assert config["formatters"][fmt_name]["datefmt"] == LOG_DATE_FORMAT

    def test_respects_log_level(self):
        """日志级别参数正确传递到 Uvicorn logger 配置。"""
        config = build_uvicorn_log_config("DEBUG")
        assert config["loggers"]["uvicorn"]["level"] == "DEBUG"
        assert config["loggers"]["uvicorn.access"]["level"] == "DEBUG"
        assert config["loggers"]["uvicorn.error"]["level"] == "DEBUG"

    def test_uvicorn_loggers_do_not_propagate(self):
        """Uvicorn logger 设置 propagate=False 避免重复输出。"""
        config = build_uvicorn_log_config("INFO")
        for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
            assert config["loggers"][logger_name]["propagate"] is False

    def test_handlers_output_to_stderr(self):
        """所有 handler 输出到 stderr（避免 STDIO 协议污染）。"""
        config = build_uvicorn_log_config("INFO")
        for handler_name in ("default", "access"):
            assert config["handlers"][handler_name]["stream"] == "ext://sys.stderr"


class TestColoredFormatterNonTTY:
    """测试 ColoredFormatter 非 TTY 模式的列对齐格式。"""

    def _make_record(self, name: str, level: int, msg: str) -> logging.LogRecord:
        return logging.LogRecord(
            name=name,
            level=level,
            pathname=__file__,
            lineno=1,
            msg=msg,
            args=(),
            exc_info=None,
        )

    def test_non_tty_uses_pipe_separator(self) -> None:
        """非 TTY 模式使用 | 分隔符而非 [] 。"""
        fmt = ColoredFormatter(datefmt=LOG_DATE_FORMAT)
        fmt._use_colors = False
        record = self._make_record(
            "negentropy.perceives.apps.app", logging.INFO, "hello"
        )
        output = fmt.format(record)
        assert " | " in output
        # 不应出现旧格式的 [LEVEL] name: 模式
        assert "] " not in output.split("|")[0] if "|" in output else True

    def test_non_tty_includes_service_prefix(self) -> None:
        """非 TTY 模式在 logger 列包含服务名前缀。"""
        fmt = ColoredFormatter(datefmt=LOG_DATE_FORMAT)
        fmt._use_colors = False
        record = self._make_record(
            "negentropy.perceives.apps.app", logging.INFO, "hello"
        )
        output = fmt.format(record)
        assert "perceives:" in output

    def test_non_tty_column_alignment(self) -> None:
        """非 TTY 模式各列正确右对齐。"""
        fmt = ColoredFormatter(datefmt=LOG_DATE_FORMAT)
        fmt._use_colors = False
        record = self._make_record("test", logging.WARNING, "test message")
        output = fmt.format(record)
        parts = output.split(" | ")
        assert len(parts) == 4
        assert parts[1].strip() == "WARNING"

    def test_non_tty_level_right_aligned(self) -> None:
        """级别列右对齐至 8 字符宽度。"""
        fmt = ColoredFormatter(datefmt=LOG_DATE_FORMAT)
        fmt._use_colors = False
        record = self._make_record("test", logging.DEBUG, "msg")
        output = fmt.format(record)
        parts = output.split(" | ")
        assert len(parts[1]) == 8
