"""验证 bootstrap._disable_adk_otel_logs_metrics_exporters() 抑制 ADK 自动注册 OTLP logs/metrics。

ADK ``google.adk.telemetry.setup.maybe_set_otel_providers`` 内部调用唯一拼装入口
``_get_otel_exporters()``：在 ``OTEL_EXPORTER_OTLP_ENDPOINT`` 存在时无差别构造
``OTLPSpanExporter``、``OTLPMetricExporter``、``OTLPLogExporter`` 三件套。Langfuse 仅
承接 ``/v1/traces``，后两者上报会命中 SPA 404。

本组测试在子进程中运行——避免污染主测试进程的 OTel 全局状态、并隔离每个用例的
``Once`` 锁初始状态。
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


def test_patch_disables_metric_and_log_exporters_but_keeps_traces():
    """patch 后 _get_otel_exporters 返回 traces span_processor，但 metric_readers / log_record_processors 为空。"""
    output = _run_in_subprocess(
        """
        import os
        os.environ['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://localhost:4318'

        from negentropy.engine.bootstrap import _disable_adk_otel_logs_metrics_exporters
        from google.adk.telemetry import setup as adk_setup

        _disable_adk_otel_logs_metrics_exporters()

        # patch 标记必须可见（用于幂等保护与外部断言）
        assert getattr(adk_setup._get_otel_exporters, '_negentropy_patched', False), 'missing _negentropy_patched flag'

        hooks = adk_setup._get_otel_exporters()
        # traces 链路保留：env var 存在时返回 1 个 BatchSpanProcessor(OTLPSpanExporter)
        assert len(hooks.span_processors) == 1, f'expected 1 span processor, got {hooks.span_processors!r}'
        # logs / metrics 永久置空——ADK maybe_set_otel_providers 的 if 分支由此短路
        assert hooks.metric_readers == [], f'expected zero metric readers, got {hooks.metric_readers!r}'
        assert hooks.log_record_processors == [], f'expected zero log processors, got {hooks.log_record_processors!r}'
        print('exporters_ok')
        """
    )
    assert "exporters_ok" in output


def test_patch_is_idempotent():
    """重复调用 patch helper 不应叠加替换、不应重复 wrap 原函数。"""
    output = _run_in_subprocess(
        """
        import os
        os.environ['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://localhost:4318'

        from negentropy.engine.bootstrap import _disable_adk_otel_logs_metrics_exporters
        from google.adk.telemetry import setup as adk_setup

        _disable_adk_otel_logs_metrics_exporters()
        first = adk_setup._get_otel_exporters

        _disable_adk_otel_logs_metrics_exporters()
        second = adk_setup._get_otel_exporters

        # 第二次调用必须 no-op：函数对象保持同一引用
        assert first is second, 'patch is not idempotent — wrapped twice'
        print('idempotent_ok')
        """
    )
    assert "idempotent_ok" in output


def test_adk_maybe_set_otel_providers_does_not_touch_logger_meter_globals():
    """模拟 ADK 启动期调用 maybe_set_otel_providers，验证全局 LoggerProvider/MeterProvider 未被 SDK 实例覆盖。

    若未应用 patch，ADK 会调用 ``set_logger_provider`` / ``set_meter_provider`` 注册 SDK
    实例（带 OTLPLogExporter / OTLPMetricExporter），这是历史 WARNING 的根源。本用例验证
    patch 后这两个全局调用根本不会发生——全局保持默认 ProxyProvider（NoOp）。
    """
    output = _run_in_subprocess(
        """
        import os
        os.environ['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://localhost:4318'

        from negentropy.engine.bootstrap import _disable_adk_otel_logs_metrics_exporters
        from google.adk.telemetry import setup as adk_setup
        from opentelemetry import _logs, metrics
        from opentelemetry.sdk._logs import LoggerProvider as SdkLoggerProvider
        from opentelemetry.sdk.metrics import MeterProvider as SdkMeterProvider

        _disable_adk_otel_logs_metrics_exporters()

        # 模拟 ADK 上游调用 maybe_set_otel_providers（无额外 hooks，只走 _get_otel_exporters 路径）
        adk_setup.maybe_set_otel_providers(otel_hooks_to_setup=None)

        # 关键断言：全局 LoggerProvider / MeterProvider 必须仍是默认 ProxyProvider 而非 SDK 实例
        # （ADK if 分支因 list 为空而短路，set_*_provider 根本未被调用）
        assert not isinstance(_logs.get_logger_provider(), SdkLoggerProvider), \
            f'LoggerProvider must remain default ProxyLoggerProvider, got {type(_logs.get_logger_provider())}'
        assert not isinstance(metrics.get_meter_provider(), SdkMeterProvider), \
            f'MeterProvider must remain default ProxyMeterProvider, got {type(metrics.get_meter_provider())}'
        print('no_set_provider_ok')
        """
    )
    assert "no_set_provider_ok" in output
