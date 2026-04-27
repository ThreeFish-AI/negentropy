"""验证 bootstrap._install_noop_otel_logs_metrics_providers() 抢注 NoOp Logger/Meter Provider。

OTel SDK 的 ``set_logger_provider`` / ``set_meter_provider`` 由 ``Once`` 锁保护，
首次调用全局胜出；后续调用仅打 warning。本组测试在子进程中运行——避免污染主测试
进程的 OTel 全局状态、并隔离每个用例的 Once 锁。
"""

from __future__ import annotations

import subprocess
import sys
import textwrap


def _run_in_subprocess(script: str) -> str:
    result = subprocess.run(
        [sys.executable, "-c", textwrap.dedent(script)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"subprocess failed: stderr={result.stderr}\nstdout={result.stdout}"
    return result.stdout


def test_install_noop_logger_provider_yields_sdk_provider_without_processors():
    """安装后 get_logger_provider() 返回 SDK LoggerProvider，且不挂任何 LogRecordProcessor。"""
    output = _run_in_subprocess(
        """
        from negentropy.engine.bootstrap import _install_noop_otel_logs_metrics_providers
        from opentelemetry import _logs
        from opentelemetry.sdk._logs import LoggerProvider

        _install_noop_otel_logs_metrics_providers()
        provider = _logs.get_logger_provider()
        assert isinstance(provider, LoggerProvider), f"expected SDK LoggerProvider, got {type(provider)}"
        # _multi_log_record_processor 是 SDK LoggerProvider 内部聚合所有 processor 的入口
        # 此时未注册任何 processor，下属列表应为空。
        processors = list(provider._multi_log_record_processor._log_record_processors)
        assert processors == [], f"expected zero processors, got {processors}"
        print("logger_ok")
        """
    )
    assert "logger_ok" in output


def test_install_noop_meter_provider_yields_sdk_provider_without_readers():
    """安装后 get_meter_provider() 返回 SDK MeterProvider，且不挂任何 MetricReader。"""
    output = _run_in_subprocess(
        """
        from negentropy.engine.bootstrap import _install_noop_otel_logs_metrics_providers
        from opentelemetry import metrics
        from opentelemetry.sdk.metrics import MeterProvider

        _install_noop_otel_logs_metrics_providers()
        provider = metrics.get_meter_provider()
        assert isinstance(provider, MeterProvider), f"expected SDK MeterProvider, got {type(provider)}"
        readers = list(provider._sdk_config.metric_readers) if hasattr(provider, "_sdk_config") else []
        assert readers == [], f"expected zero metric readers, got {readers}"
        print("meter_ok")
        """
    )
    assert "meter_ok" in output


def test_subsequent_set_logger_provider_is_noop_due_to_once_lock():
    """抢注后第二次 set_logger_provider（模拟 ADK _setup_telemetry_from_env）必须无效。"""
    output = _run_in_subprocess(
        """
        from negentropy.engine.bootstrap import _install_noop_otel_logs_metrics_providers
        from opentelemetry import _logs
        from opentelemetry.sdk._logs import LoggerProvider
        from opentelemetry.sdk._logs.export import BatchLogRecordProcessor, ConsoleLogExporter

        _install_noop_otel_logs_metrics_providers()
        first = _logs.get_logger_provider()

        # 模拟 ADK 上游的 set_logger_provider 调用——构造一个带 OTLP 风格 processor 的新 provider
        intruder = LoggerProvider()
        intruder.add_log_record_processor(BatchLogRecordProcessor(ConsoleLogExporter()))
        _logs.set_logger_provider(intruder)

        # Once-lock：第二次 set 静默失败，全局仍是第一个 NoOp provider
        after = _logs.get_logger_provider()
        assert after is first, "second set_logger_provider must NOT replace the first"
        # 并且首个 provider 仍然没有 processor
        processors = list(after._multi_log_record_processor._log_record_processors)
        assert processors == [], f"NoOp provider must remain processor-less; got {processors}"
        print("once_lock_ok")
        """
    )
    assert "once_lock_ok" in output
