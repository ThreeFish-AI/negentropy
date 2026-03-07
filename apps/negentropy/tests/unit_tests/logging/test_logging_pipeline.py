import io
import logging
from pathlib import Path

import pytest

from negentropy.logging import core
from negentropy.logging.core import add_logger_name, multi_sink_renderer, rename_event_key
from negentropy.logging.formatters import ConsoleFormatter
from negentropy.logging.interceptors import RedirectStdLibHandler
from negentropy.logging.io import ExternalProcessLogStream, StreamToLogger, derive_external_process_source
from negentropy.logging.sinks import FileSink, StdioSink


class _RecorderSink:
    def __init__(self) -> None:
        self.events: list[dict] = []
        self.closed = False

    def emit(self, event_dict):
        self.events.append(dict(event_dict))

    def close(self):
        self.closed = True


def test_rename_event_key_and_add_logger_name() -> None:
    event = {"_name": "negentropy.test", "event": "hello"}

    event = rename_event_key(None, "info", event)
    event = add_logger_name(None, "info", event)

    assert event["message"] == "hello"
    assert event["logger"] == "negentropy.test"
    assert "_name" not in event


def test_multi_sink_renderer_fans_out_and_swallows_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    recorder = _RecorderSink()

    class _BrokenSink:
        def emit(self, event_dict):
            raise RuntimeError("boom")

        def close(self):
            pass

    monkeypatch.setattr(core, "_sinks", [recorder, _BrokenSink()])

    assert multi_sink_renderer(None, "info", {"message": "ok"}) == ""
    assert recorder.events == [{"message": "ok"}]


def test_stdio_sink_writes_json_output() -> None:
    stream = io.StringIO()

    StdioSink(fmt="json", stream=stream).emit({"message": "hello", "level": "info"})

    assert '"message":"hello"' in stream.getvalue()


def test_file_sink_rotates_when_size_limit_exceeded(tmp_path: Path) -> None:
    log_path = tmp_path / "negentropy.log"
    sink = FileSink(log_path, max_bytes=1, backup_count=2)

    sink.emit({"message": "first"})
    sink.emit({"message": "second"})
    sink.close()

    assert log_path.exists()
    assert log_path.with_suffix(".1.log").exists()


def test_console_formatter_formats_stdout_source_without_color() -> None:
    ConsoleFormatter.configure(level_width=5, logger_width=24, separator=" | ")

    rendered = ConsoleFormatter.format(
        {
            "level": "info",
            "message": "{\"ok\":true}",
            "logger": "stdout",
            "source": "package.module.worker",
            "timestamp": "2026-03-07T10:00:00+00:00",
            "extra": "value",
        },
        use_color=False,
    )

    assert "stdout:module.worker" in rendered
    assert '{"ok":true}' in rendered
    assert "extra=value" in rendered


def test_redirect_stdlib_handler_simplifies_logger_name_and_emits(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[tuple[int, str, str]] = []

    class _Logger:
        def log(self, level, event, **kwargs):
            events.append((level, event, kwargs.get("_name", "")))

    monkeypatch.setattr("negentropy.logging.interceptors.get_logger", lambda name: _Logger())

    handler = RedirectStdLibHandler()
    record = logging.LogRecord(
        name="google.adk.cli.utils.logs",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )

    handler.emit(record)

    assert events[0][0] == logging.INFO
    assert events[0][1] == "hello world"


def test_stream_to_logger_buffers_until_newline() -> None:
    messages: list[tuple[int, str, dict]] = []

    class _Logger:
        def log(self, level, event=None, **kwargs):
            messages.append((level, event, kwargs))

    stream = StreamToLogger(_Logger(), logging.INFO, io.StringIO())
    stream.write("hello")
    assert messages == []

    stream.write(" world\n")
    stream.flush()

    assert messages[0][1] == "hello world"


def test_external_process_log_stream_parses_prefixed_lines() -> None:
    messages: list[tuple[int, str, dict]] = []

    class _Logger:
        def log(self, level, event=None, **kwargs):
            messages.append((level, event, kwargs))

    stream = ExternalProcessLogStream(_Logger(), source="mcp.zai-mcp-server")
    stream.write("[2026-03-07T06:29:09.030Z] INFO: MCP Server Application initialized\n")

    assert messages == [
        (
            logging.INFO,
            "MCP Server Application initialized",
            {"source": "mcp.zai-mcp-server", "timestamp": "2026-03-07T06:29:09.030Z"},
        )
    ]


def test_external_process_log_stream_buffers_and_falls_back_for_plain_lines() -> None:
    messages: list[tuple[int, str, dict]] = []

    class _Logger:
        def log(self, level, event=None, **kwargs):
            messages.append((level, event, kwargs))

    stream = ExternalProcessLogStream(_Logger(), source="mcp.npx")
    stream.write("partial line")
    assert messages == []

    stream.write(" completed")
    stream.flush()

    assert messages == [(logging.INFO, "partial line completed", {"source": "mcp.npx"})]


def test_derive_external_process_source_prefers_first_non_flag_arg() -> None:
    assert derive_external_process_source("npx", ["-y", "@zilliz/zai-mcp-server"]) == "mcp.zai-mcp-server"
    assert derive_external_process_source("uvx", ["mcp-server-fetch"]) == "mcp.mcp-server-fetch"
