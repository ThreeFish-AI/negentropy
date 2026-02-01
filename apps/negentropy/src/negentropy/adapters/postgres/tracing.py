"""
OpenTelemetry 双路导出集成

架构:
┌─────────────┐     ┌──────────────────┐
│ Agent       │────▶│ TracingManager   │
│ Executor    │     │                  │
└─────────────┘     └─────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ PostgreSQL  │  │ OTLP/Langfuse│  │ Console     │
    │ (审计留存)  │  │ (实时调试)  │  │ (开发环境)  │
    └─────────────┘  └─────────────┘  └─────────────┘
"""

import json
import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider, ReadableSpan
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SpanExporter,
    SpanExportResult,
    ConsoleSpanExporter,
)
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.trace import Status, StatusCode


class PostgresSpanExporter(SpanExporter):
    """将 Span 持久化到 PostgreSQL traces 表"""

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    def export(self, spans: list[ReadableSpan]) -> SpanExportResult:
        """同步导出 (内部异步)"""
        import asyncio

        try:
            asyncio.get_event_loop().run_until_complete(self._async_export(spans))
            return SpanExportResult.SUCCESS
        except Exception:
            return SpanExportResult.FAILURE

    async def _async_export(self, spans: list[ReadableSpan]) -> None:
        async with self._pool.acquire() as conn:
            for span in spans:
                await conn.execute(
                    """
                    INSERT INTO traces
                    (trace_id, span_id, parent_span_id, operation_name, span_kind,
                     attributes, events, start_time, end_time, duration_ns,
                     status_code, status_message)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                    format(span.context.trace_id, "032x"),
                    format(span.context.span_id, "016x"),
                    format(span.parent.span_id, "016x") if span.parent else None,
                    span.name,
                    span.kind.name if span.kind else "INTERNAL",
                    json.dumps(dict(span.attributes or {})),
                    json.dumps([self._event_to_dict(e) for e in (span.events or [])]),
                    datetime.fromtimestamp(span.start_time / 1e9),
                    datetime.fromtimestamp(span.end_time / 1e9) if span.end_time else None,
                    (span.end_time - span.start_time) if span.end_time else None,
                    span.status.status_code.name if span.status else "UNSET",
                    span.status.description if span.status else None,
                )

    def _event_to_dict(self, event) -> dict:
        return {"name": event.name, "timestamp": event.timestamp, "attributes": dict(event.attributes or {})}

    def shutdown(self) -> None:
        pass


class TracingManager:
    """
    Trace 管理器 - 支持双路导出

    使用方式:
        tracing = TracingManager(pg_pool=pool, otlp_endpoint="localhost:4317")

        @tracing.trace_tool_call("calculator")
        async def calculate(x, y):
            return x + y
    """

    def __init__(
        self,
        service_name: str = "open-agent-engine",
        pg_pool: asyncpg.Pool | None = None,
        otlp_endpoint: str | None = None,
        console_export: bool = False,
        otlp_exporter: SpanExporter | None = None,  # For testing
    ):
        provider = TracerProvider()

        # 双路导出配置
        if pg_pool:
            # PostgreSQL: 持久化审计
            provider.add_span_processor(BatchSpanProcessor(PostgresSpanExporter(pg_pool)))

        # OTLP: 实时可视化 (Langfuse)
        if otlp_exporter:
            # 优先使用注入的 Exporter (测试用)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        elif otlp_endpoint:
            provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)))

        if console_export:
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

        trace.set_tracer_provider(provider)
        self.tracer = trace.get_tracer(service_name)

    def trace_tool_call(self, tool_name: str):
        def decorator(func):
            async def wrapper(*args, **kwargs):
                with self.tracer.start_as_current_span(f"tool:{tool_name}") as span:
                    span.set_attribute("tool.name", tool_name)
                    # Note: Arguments might be PII, be careful logging
                    return await func(*args, **kwargs)

            return wrapper

        return decorator
