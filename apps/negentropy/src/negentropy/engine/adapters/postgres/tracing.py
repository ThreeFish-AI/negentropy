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
from typing import Any, Optional

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider, ReadableSpan
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SpanExporter,
    SpanExportResult,
    ConsoleSpanExporter,
)

try:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
except ImportError:
    OTLPSpanExporter = None

from opentelemetry.trace import Status, StatusCode
from sqlalchemy import insert

import negentropy.db.session as db_session
from negentropy.models.observability import Trace
from negentropy.logging import get_logger

logger = get_logger(__name__)


class PostgresSpanExporter(SpanExporter):
    """将 Span 持久化到 PostgreSQL traces 表"""

    def __init__(self):
        # ORM implementation doesn't need a pool, it creates sessions on demand
        pass

    def export(self, spans: list[ReadableSpan]) -> SpanExportResult:
        """同步导出 (内部异步)"""
        import asyncio

        try:
            # Note: This run_until_complete might conflict if called from within an existing loop.
            # ...

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                loop.create_task(self._async_export(spans))
            else:
                asyncio.run(self._async_export(spans))

            return SpanExportResult.SUCCESS
        except Exception as e:
            logger.error(f"Failed to export spans to Postgres: {e}")
            return SpanExportResult.FAILURE

    async def _async_export(self, spans: list[ReadableSpan]) -> None:
        async with db_session.AsyncSessionLocal() as db:
            trace_dicts = []
            for span in spans:
                trace_dicts.append(
                    {
                        "trace_id": format(span.context.trace_id, "032x"),
                        "span_id": format(span.context.span_id, "016x"),
                        "parent_span_id": format(span.parent.span_id, "016x") if span.parent else None,
                        "operation_name": span.name,
                        "span_kind": span.kind.name if span.kind else "INTERNAL",
                        "attributes": dict(span.attributes or {}),
                        "events": [self._event_to_dict(e) for e in (span.events or [])],
                        "start_time": datetime.fromtimestamp(span.start_time / 1e9),
                        "end_time": datetime.fromtimestamp(span.end_time / 1e9) if span.end_time else None,
                        "duration_ns": (span.end_time - span.start_time) if span.end_time else None,
                        "status_code": span.status.status_code.name if span.status else "UNSET",
                        "status_message": span.status.description if span.status else None,
                    }
                )

            # Efficient batch insert
            if trace_dicts:
                # We use core insert to avoid overhead of model instantiation if possible,
                # but models are fine too. Bulk insert mappings is efficient.
                await db.execute(insert(Trace), trace_dicts)
                await db.commit()

    def _event_to_dict(self, event) -> dict:
        return {"name": event.name, "timestamp": event.timestamp, "attributes": dict(event.attributes or {})}

    def shutdown(self) -> None:
        pass


class TracingManager:
    """
    Trace 管理器 - 支持双路导出

    使用方式:
        tracing = TracingManager(enable_postgres=True, otlp_endpoint="localhost:4317")

        @tracing.trace_tool_call("calculator")
        async def calculate(x, y):
            return x + y
    """

    def __init__(
        self,
        service_name: str = "open-agent-engine",
        enable_postgres: bool = True,  # Replaced pg_pool with bool flag
        otlp_endpoint: str | None = None,
        console_export: bool = False,
        otlp_exporter: SpanExporter | None = None,  # For testing
    ):
        provider = TracerProvider()

        # 双路导出配置
        if enable_postgres:
            # PostgreSQL: 持久化审计
            provider.add_span_processor(BatchSpanProcessor(PostgresSpanExporter()))

        # OTLP: 实时可视化 (Langfuse)
        if otlp_exporter:
            # 优先使用注入的 Exporter (测试用)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        elif otlp_endpoint:
            if OTLPSpanExporter:
                provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)))
            else:
                logger.warning("OTLP Exporter requested but opentelemetry-exporter-otlp not installed.")

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
