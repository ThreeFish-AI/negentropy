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

import asyncio
import json
import uuid
from contextvars import ContextVar
from datetime import datetime
from typing import Any, Optional

from opentelemetry import trace, context, baggage
from opentelemetry.sdk.trace import TracerProvider, ReadableSpan, SpanProcessor
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

# Context variables for storing session/user context across async boundaries
# These are set by middleware and read by the LangfuseAttributesProcessor
_session_id_context: ContextVar[Optional[str]] = ContextVar("_session_id_context", default=None)
_user_id_context: ContextVar[Optional[str]] = ContextVar("_user_id_context", default=None)


def set_tracing_context(*, session_id: Optional[str] = None, user_id: Optional[str] = None) -> None:
    """
    Set the current tracing context (session_id, user_id).

    This should be called at the start of each request to associate
    all spans created during that request with a specific session and user.

    Args:
        session_id: The Langfuse session ID
        user_id: The Langfuse user ID
    """
    if session_id is not None:
        _session_id_context.set(session_id)
    if user_id is not None:
        _user_id_context.set(user_id)


def get_tracing_context() -> tuple[Optional[str], Optional[str]]:
    """Get the current tracing context (session_id, user_id)."""
    return _session_id_context.get(None), _user_id_context.get(None)


class LangfuseAttributesProcessor(SpanProcessor):
    """
    Custom SpanProcessor that automatically injects Langfuse-specific attributes
    into all spans.

    This processor reads the session_id and user_id from the context variables
    (set by the middleware) and adds them as Langfuse attributes to each span.

    Langfuse attributes:
    - langfuse.session.id: Groups traces into sessions for replay
    - langfuse.user.id: Associates traces with a specific user
    - langfuse.tags: Optional tags for filtering and organization
    """

    def __init__(self):
        self._enabled = True

    def on_start(self, span, parent_context):
        """Called when a span is started. Add Langfuse attributes."""
        if not self._enabled:
            return

        session_id, user_id = get_tracing_context()
        if not session_id or not user_id:
            ctx = context.get_current()
            if not session_id:
                session_id = baggage.get_baggage("langfuse.session.id", ctx) or baggage.get_baggage("session.id", ctx)
            if not user_id:
                user_id = baggage.get_baggage("langfuse.user.id", ctx) or baggage.get_baggage("user.id", ctx)

        if session_id:
            span.set_attribute("langfuse.session.id", session_id)
        if user_id:
            span.set_attribute("langfuse.user.id", user_id)

    def on_end(self, span):
        """Called when a span ends. No-op for this processor."""
        pass

    def shutdown(self):
        """Shutdown the processor."""
        self._enabled = False

    def force_flush(self, timeout_millis: int = 30000):
        """Force flush (no-op for this processor)."""
        return True


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

    async def _async_export(self, spans: list[ReadableSpan]) -> SpanExportResult:
        """异步导出封装 (用于测试/异步环境)"""
        return await asyncio.to_thread(self.export, spans)

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

        # Add LangfuseAttributesProcessor FIRST - this injects session/user context into all spans
        # Must be added before any exporters so all spans have the attributes
        provider.add_span_processor(LangfuseAttributesProcessor())
        logger.info(
            "LangfuseAttributesProcessor added - will inject langfuse.session.id and langfuse.user.id into all spans"
        )

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
                    logger.info(f"OTLP Export enabled: endpoint={endpoint}")
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
                        # Log masked credentials for debugging
                        pk_preview = (
                            langfuse.langfuse_public_key[:8] + "..." if len(langfuse.langfuse_public_key) > 8 else "***"
                        )
                        logger.info(f"Using Langfuse credentials: {pk_preview}")

                    try:
                        otlp_exporter = OTLPSpanExporter(endpoint=endpoint, headers=headers)
                        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
                        logger.info(f"OTLP Exporter created and added: {type(otlp_exporter).__name__}")
                    except Exception as e:
                        logger.error(f"Failed to create OTLP Exporter: {e}")
                else:
                    logger.warning("OTLP Exporter requested but opentelemetry-exporter-otlp not installed.")
            else:
                # OTLP not enabled - log diagnostic information
                logger.warning("OTLP Export NOT enabled - checking conditions...")
                logger.warning(f"  otlp_endpoint: {self.otlp_endpoint}")
                logger.warning(f"  langfuse_enabled: {langfuse.langfuse_enabled}")
                logger.warning(f"  langfuse_public_key: {bool(langfuse.langfuse_public_key)}")
                logger.warning(f"  langfuse_secret_key: {bool(langfuse.langfuse_secret_key)}")
                logger.warning(f"  OTLPSpanExporter available: {OTLPSpanExporter is not None}")

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
