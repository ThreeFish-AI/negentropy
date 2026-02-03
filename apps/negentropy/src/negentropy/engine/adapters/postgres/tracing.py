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
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
except ImportError:
    OTLPSpanExporter = None

from opentelemetry.trace import Status, StatusCode
from sqlalchemy import insert, create_engine
from sqlalchemy.orm import sessionmaker

from negentropy.config import settings
from negentropy.models.observability import Trace
from negentropy.logging import get_logger

logger = get_logger(__name__)


class PostgresSpanExporter(SpanExporter):
    """将 Span 持久化到 PostgreSQL traces 表"""

    def __init__(self):
        # 创建同步 Engine，用于 OpenTelemetry 后台线程
        # 必须使用 psycopg 驱动 (sync)
        db_url = str(settings.database_url).replace("postgresql+asyncpg", "postgresql+psycopg")
        self._engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_recycle=settings.db_pool_recycle,
            echo=False,  # Tracing logs not needed
        )
        self._SessionLocal = sessionmaker(bind=self._engine)

    def export(self, spans: list[ReadableSpan]) -> SpanExportResult:
        """同步导出 (运行在 OTel 的后台线程中)"""
        try:
            with self._SessionLocal() as session:
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
                    session.execute(insert(Trace), trace_dicts)
                    session.commit()

            return SpanExportResult.SUCCESS
        except Exception as e:
            logger.error(f"Failed to export spans to Postgres: {e}")
            return SpanExportResult.FAILURE

    def _event_to_dict(self, event) -> dict:
        return {"name": event.name, "timestamp": event.timestamp, "attributes": dict(event.attributes or {})}

    def shutdown(self) -> None:
        if self._engine:
            self._engine.dispose()


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
        service_name: str = "negentropy-engine",
        enable_postgres: bool = True,  # Replaced pg_pool with bool flag
        otlp_endpoint: str | None = None,
        console_export: bool = False,
        otlp_exporter: SpanExporter | None = None,  # For testing
    ):
        self.service_name = service_name
        self.enable_postgres = enable_postgres
        self.otlp_endpoint = otlp_endpoint
        self.console_export = console_export
        self.otlp_exporter = otlp_exporter

        # Lazy initialization state
        self._initialized = False
        self._tracer = None

    def _ensure_initialized(self):
        """
        Lazily initialize OpenTelemetry provider and tracer.
        This allows ADK to initialize its own tracing first, so we can attach to it
        instead of conflicting with it.
        """
        if self._initialized:
            return

        logger.info(f"Initializing tracing for service: {self.service_name}")

        current_provider = trace.get_tracer_provider()

        provider = TracerProvider()

        # 双路导出配置
        if self.enable_postgres:
            # PostgreSQL: 持久化审计
            provider.add_span_processor(BatchSpanProcessor(PostgresSpanExporter()))

        # OTLP: 实时可视化 (Langfuse)
        if self.otlp_exporter:
            # 优先使用注入的 Exporter (测试用)
            provider.add_span_processor(BatchSpanProcessor(self.otlp_exporter))
        else:
            # 优先使用 ObservabilitySettings 配置
            langfuse = settings.observability

            # 使用传入的 endpoint 或配置中的 Langfuse OTLP 端点
            endpoint = self.otlp_endpoint or langfuse.langfuse_otlp_endpoint

            should_enable_otlp = (
                # 显式传入了 endpoint
                self.otlp_endpoint is not None
                # 或者配置了 Langfuse 且启用了 export
                or (langfuse.langfuse_enabled and langfuse.langfuse_public_key and langfuse.langfuse_secret_key)
            )

            if should_enable_otlp:
                if OTLPSpanExporter:
                    headers = {}
                    # 如果有 Langfuse 凭证，添加 Basic Auth Header
                    if langfuse.langfuse_public_key and langfuse.langfuse_secret_key:
                        import base64

                        # Langfuse 使用 Basic Auth (User=Public Key, Pass=Secret Key)
                        credentials = (
                            f"{langfuse.langfuse_public_key}:{langfuse.langfuse_secret_key.get_secret_value()}"
                        )
                        basic_auth = base64.b64encode(credentials.encode()).decode()
                        headers["Authorization"] = f"Basic {basic_auth}"

                    provider.add_span_processor(
                        BatchSpanProcessor(
                            OTLPSpanExporter(
                                endpoint=endpoint,
                                headers=headers,
                            )
                        )
                    )
                else:
                    logger.warning("OTLP Exporter requested but opentelemetry-exporter-otlp not installed.")

        if self.console_export:
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

        # Logic to attach -> merge -> or set
        is_proxy = type(current_provider).__name__ == "ProxyTracerProvider"

        if is_proxy:
            # If it is still a Proxy, it means ADK didn't set a real one yet.
            # We try to set ours.
            try:
                trace.set_tracer_provider(provider)
                self._tracer = trace.get_tracer(self.service_name)
                logger.info("Global TracerProvider set successfully.")
            except Exception as e:
                # Race condition: someone else set it just now
                logger.warning(f"Failed to set global TracerProvider ({e}), falling back to attachment.")
                # Retrieve the winner provider
                current_provider = trace.get_tracer_provider()
                is_proxy = False

        if not is_proxy:
            # Real provider (or un-overridable proxy) exists. Attach our processors.
            logger.info(f"Attaching processors to existing TracerProvider: {type(current_provider).__name__}")
            if hasattr(current_provider, "add_span_processor"):
                for processor in provider._active_span_processor._span_processors:
                    current_provider.add_span_processor(processor)
            else:
                logger.warning("Existing TracerProvider does not support add_span_processor. Traces may be lost.")

            self._tracer = trace.get_tracer(self.service_name)

        self._initialized = True

    @property
    def tracer(self):
        self._ensure_initialized()
        return self._tracer

    def trace_tool_call(self, tool_name: str):
        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Ensure initialized before use
                self._ensure_initialized()
                if self.tracer:
                    with self.tracer.start_as_current_span(f"tool:{tool_name}") as span:
                        span.set_attribute("tool.name", tool_name)
                        # Note: Arguments might be PII, be careful logging
                        return await func(*args, **kwargs)
                return await func(*args, **kwargs)

            return wrapper

        return decorator


# Module-level singleton for lazy initialization
_tracing_manager: TracingManager | None = None


def init_tracing(
    service_name: str = "negentropy-agent",
    enable_postgres: bool = False,
) -> TracingManager:
    """
    Initialize the global TracingManager singleton.

    This should be called early in the application lifecycle,
    before any spans are created. Safe to call multiple times.
    """
    global _tracing_manager
    if _tracing_manager is None:
        _tracing_manager = TracingManager(
            service_name=service_name,
            enable_postgres=enable_postgres,
        )
        logger.info(f"TracingManager initialized for service: {service_name}")
    return _tracing_manager


def get_tracing_manager() -> TracingManager | None:
    """Get the current TracingManager instance, or None if not initialized."""
    return _tracing_manager
