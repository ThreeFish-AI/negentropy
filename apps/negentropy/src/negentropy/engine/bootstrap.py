import base64
import contextlib
import os
import sys
from pathlib import Path
from typing import Any

# Import the original factory module to be patched
import google.adk.cli.utils.service_factory as original_factory

from negentropy.config import settings

# Import our custom factories
from negentropy.engine.factories import (
    get_artifact_service,
    get_credential_service,
    get_memory_service,
    get_session_service,
)
from negentropy.instrumentation import LiteLLMLoggingCallback, patch_litellm_otel_cost
from negentropy.logging import configure_logging, get_logger

# Initialize logging early
configure_logging(
    level=settings.log_level,
    sinks=settings.log_sinks,
    fmt=settings.log_format,
    file_path=settings.log_file_path,
    gcloud_project=settings.vertex_project_id,
    gcloud_log_name=settings.gcloud_log_name,
    console_timestamp_format=settings.log_console_timestamp_format,
    console_level_width=settings.log_console_level_width,
    console_logger_width=settings.log_console_logger_width,
    console_separator=settings.log_console_separator,
)

# Initialize logger AFTER configure_logging
logger = get_logger("negentropy.bootstrap")


def _disable_adk_otel_logs_metrics_exporters() -> None:
    """让 ADK ``_get_otel_exporters`` 仅构造 traces 的 ``span_processors``。

    Langfuse 仅承接 ``/v1/traces``；ADK 上游 ``_get_otel_exporters()`` 在
    ``OTEL_EXPORTER_OTLP_ENDPOINT`` 存在时会无差别构造 ``OTLPSpanExporter``、
    ``OTLPMetricExporter``、``OTLPLogExporter`` 三件套——后两者对 Langfuse
    ``/v1/metrics`` 与 ``/v1/logs`` 的上报会命中 SPA 404 错误页。

    旧实现调用 ``original()`` 后再丢弃 ``metric_readers`` /
    ``log_record_processors``——但 ``PeriodicExportingMetricReader`` /
    ``BatchLogRecordProcessor`` 实例已经被构造且各自启动了守护线程，
    导致 reader 从未注册到 MeterProvider 时仍每 60s 触发
    ``Cannot call collect on a MetricReader ...`` WARNING。

    本实现绕过 ``original()``，仅当 ``OTEL_EXPORTER_OTLP_ENDPOINT`` /
    ``OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`` 存在时调用上游
    ``_get_otel_span_exporter()`` 构造 traces 通道，根源避免 OTLP metrics /
    logs exporter 被构造（既消除 WARNING，也省掉无效 daemon 线程）。

    未来若启用支持 logs/metrics 的后端（SigNoz、Phoenix 等），切回 ADK 全量
    上报的正确路径是：恢复对 ``adk_otel_setup._get_otel_exporters`` 原函数的
    调用（保留为闭包变量），或直接构造完整 ``OTelHooks``（含 metric_readers /
    log_record_processors）后返回。
    """
    import opentelemetry.sdk.environment_variables as otel_env
    from google.adk.telemetry import setup as adk_otel_setup

    if getattr(adk_otel_setup._get_otel_exporters, "_negentropy_patched", False):
        return

    def _patched_get_otel_exporters():
        span_processors = []
        if os.getenv(otel_env.OTEL_EXPORTER_OTLP_ENDPOINT) or os.getenv(otel_env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT):
            try:
                span_processors.append(adk_otel_setup._get_otel_span_exporter())
            except (ImportError, ModuleNotFoundError):
                pass  # ADK 2.0: OTLP HTTP exporter not installed; skip trace export
        return adk_otel_setup.OTelHooks(
            span_processors=span_processors,
            metric_readers=[],
            log_record_processors=[],
        )

    _patched_get_otel_exporters._negentropy_patched = True  # type: ignore[attr-defined]
    adk_otel_setup._get_otel_exporters = _patched_get_otel_exporters


# Configure OpenTelemetry environment variables for LiteLLM's "otel" callback
# This MUST be done before importing litellm, as the callback reads these at import time
langfuse = settings.observability
if langfuse.langfuse_enabled and langfuse.langfuse_public_key and langfuse.langfuse_secret_key:
    # Set OTLP endpoint for LiteLLM's otel callback
    # Note: Use the base OTLP endpoint without /v1/traces suffix
    # LiteLLM will append the correct path based on the protocol
    base_endpoint = langfuse.langfuse_host.rstrip("/")

    # For HTTP/protobuf exporter, the endpoint should be the base URL
    # LiteLLM/OTel will append /v1/traces automatically
    os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = f"{base_endpoint}/api/public/otel"

    # Set Basic Auth headers for Langfuse
    credentials = f"{langfuse.langfuse_public_key}:{langfuse.langfuse_secret_key.get_secret_value()}"
    basic_auth = base64.b64encode(credentials.encode()).decode()
    os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {basic_auth}"

    _disable_adk_otel_logs_metrics_exporters()

    logger.info(f"Configured LiteLLM OTel callback to use Langfuse: {base_endpoint}/api/public/otel")
else:
    logger.warning("Langfuse not configured - LiteLLM OTel callback will use default endpoint (localhost:4317)")

# Register LiteLLM callbacks
try:
    import litellm

    # LiteLLM's "otel" callback uses the OpenTelemetry environment variables set above
    # to send traces to Langfuse. This is the PRIMARY mechanism for creating traces from LLM calls.
    # We also keep our custom LiteLLMLoggingCallback for additional logging.
    patch_litellm_otel_cost()
    litellm.success_callback = [LiteLLMLoggingCallback(), "otel"]
    litellm.failure_callback = [LiteLLMLoggingCallback(), "otel"]

    logger.info("LiteLLM callbacks registered: custom logging + otel")
except ImportError:
    pass

# ------------------------------------------------------------------------------
# Save original implementations to allow fallback
# ------------------------------------------------------------------------------
_original_create_session = original_factory.create_session_service_from_options
_original_create_memory = original_factory.create_memory_service_from_options
_original_create_artifact = original_factory.create_artifact_service_from_options


# ------------------------------------------------------------------------------
# Monkey-patch implementations
# ------------------------------------------------------------------------------
def patched_create_session_service_from_options(
    *,
    base_dir: Path | str,
    session_service_uri: str | None = None,
    session_db_kwargs: dict[str, Any] | None = None,
    app_name_to_dir: dict[str, str] | None = None,
    use_local_storage: bool = True,
):
    """
    Patched factory that prefers negentropy settings if no explicit URI is provided.
    """
    if session_service_uri:
        # If CLI/User explicitly provided a URI, use the standard logic
        logger.info(f"Using explicit session_service_uri: {session_service_uri}")
        return _original_create_session(
            base_dir=base_dir,
            session_service_uri=session_service_uri,
            session_db_kwargs=session_db_kwargs,
            app_name_to_dir=app_name_to_dir,
            use_local_storage=use_local_storage,
        )

    # Otherwise, use our configured backend from .env
    logger.info(f"Using configured session backend: {settings.session_service_backend}")
    return get_session_service()


def patched_create_memory_service_from_options(
    *,
    base_dir: Path | str,
    memory_service_uri: str | None = None,
):
    """
    Patched factory that prefers negentropy settings if no explicit URI is provided.
    """
    if memory_service_uri:
        logger.info(f"Using explicit memory_service_uri: {memory_service_uri}")
        return _original_create_memory(
            base_dir=base_dir,
            memory_service_uri=memory_service_uri,
        )

    logger.info(f"Using configured memory backend: {settings.memory_service_backend}")
    return get_memory_service()


def patched_create_artifact_service_from_options(
    *,
    base_dir: Path | str,
    artifact_service_uri: str | None = None,
    strict_uri: bool = False,
    use_local_storage: bool = True,
):
    """
    Patched factory that prefers negentropy settings if no explicit URI is provided.
    """
    if artifact_service_uri:
        logger.info(f"Using explicit artifact_service_uri: {artifact_service_uri}")
        return _original_create_artifact(
            base_dir=base_dir,
            artifact_service_uri=artifact_service_uri,
            strict_uri=strict_uri,
            use_local_storage=use_local_storage,
        )

    logger.info(f"Using configured artifact backend: {settings.artifact_service_backend}")
    return get_artifact_service()


_NEGENTROPY_LIFESPAN_TIMEOUT_REGISTRY = 15.0
_NEGENTROPY_LIFESPAN_TIMEOUT_DISPOSERS = 5.0


def _compose_with_negentropy_lifespan(existing):
    """把已有 ``lifespan`` 与 :func:`_negentropy_lifespan` 嵌套合并。

    返回一个新的 lifespan ``async context manager``，进入时依次：
        _negentropy_lifespan(app) → existing(app)（若非 None）→ yield
    退出时反向退栈，保证 negentropy 业务收尾发生在 existing 之后、ADK runner
    清理之前（详见 patched_get_fast_api_app 的注释）。
    """

    @contextlib.asynccontextmanager
    async def _combined(app):
        async with _negentropy_lifespan(app):
            if existing is not None:
                async with existing(app):
                    yield
            else:
                yield

    return _combined


@contextlib.asynccontextmanager
async def _negentropy_lifespan(app):
    """Negentropy 业务 lifespan：替代旧 ``@app.on_event`` 钩子。

    职责：
    - **startup**：``ensure_registry_started()`` 启动统一心跳调度器；挂到
      ``app.state.unified_scheduler_registry`` 让 SSE / 测试可访问；
    - **shutdown**：``await registry.aclose(15s)`` 让心跳与 inflight handler 在
      uvicorn ``timeout_graceful_shutdown`` 窗口内退出；再 ``dispose_all(5s)``
      释放 DB pool / tracer provider / 反应式 task。

    由 ``AdkWebServer.get_fast_api_app(lifespan=...)`` 注入，嵌套在 ADK
    ``internal_lifespan`` 内部，关停顺序：
        ADK runner cleanup → negentropy shutdown → ADK observer teardown

    fail-soft：startup 失败不阻塞 FastAPI 启动（与旧 on_event 行为一致），
    shutdown 阶段任意子步骤抛错均被捕获并记 warning。
    """
    registry = None
    try:
        from negentropy.engine.schedulers.registry import ensure_registry_started

        registry = await ensure_registry_started()
        if registry is None:
            logger.info("unified_scheduler_skipped_or_disabled")
        else:
            app.state.unified_scheduler_registry = registry
            logger.info(
                "unified_scheduler_started_via_lifespan",
                poll_interval=registry.poll_interval,
            )
    except Exception as exc:
        logger.warning("unified_scheduler_bootstrap_failed", error=str(exc))

    try:
        yield
    finally:
        logger.info("negentropy_lifespan_shutdown_started")
        if registry is not None:
            try:
                await registry.aclose(timeout=_NEGENTROPY_LIFESPAN_TIMEOUT_REGISTRY)
                logger.info("unified_scheduler_stopped_via_lifespan")
            except Exception as exc:
                logger.warning("unified_scheduler_stop_failed", error=str(exc))
        try:
            from negentropy.engine.lifecycle import dispose_all

            await dispose_all(timeout=_NEGENTROPY_LIFESPAN_TIMEOUT_DISPOSERS)
            logger.info("negentropy_lifespan_disposers_completed")
        except Exception as exc:
            logger.warning("negentropy_lifespan_disposers_failed", error=str(exc))
        logger.info("negentropy_lifespan_shutdown_completed")


def apply_adk_patches():
    """
    Apply monkey-patches to ADK service factories.
    This allows ADK CLI commands (like `adk web`) to use services configured
    in .env without needing explicit CLI arguments.
    """

    logger.info("Monkey-patching ADK service factories to use negentropy configuration...")

    # ADK 2.0 workaround (eager): fast_api.get_fast_api_app() has a scoping bug where
    # ApiServer is conditionally imported inside `if web:` branches. When web=True
    # and DevServer import succeeds, ApiServer is never assigned as a local variable,
    # but setup_observer() references it as a type annotation, causing UnboundLocalError.
    #
    # The wrapper-based fix below (Patch #2) is insufficient because apply_adk_patches()
    # is called INSIDE get_fast_api_app (via services.py import by ADK agent loader),
    # meaning the current call already bypasses the wrapper. We must set sys.modules
    # eagerly here so the conditional import at lines 519-535 sees the None entry.
    _saved_dev_server = sys.modules.get("google.adk.cli.dev_server")
    if _saved_dev_server is not None:
        sys.modules["google.adk.cli.dev_server"] = None  # type: ignore[assignment]
        logger.debug("Set sys.modules['google.adk.cli.dev_server'] = None to force ApiServer fallback")

    patched_items = []

    # Helper to clean factory names for display
    def _add_patch(target_name: str, factory_func):
        # Extract "SessionService" from "patched_create_session_service_from_options"
        # Logic: remove "patched_create_" prefix and "_from_options" suffix, title case
        name = factory_func.__name__
        if name.startswith("patched_create_"):
            name = name.replace("patched_create_", "").replace("_from_options", "")
            # Convert snake_case to CamelCase (simple title casing for display)
            parts = name.split("_")
            name = "".join(part.title() for part in parts)

        patched_items.append(name)
        return factory_func

    # Patch the module directly
    original_factory.create_session_service_from_options = _add_patch(
        "SessionService", patched_create_session_service_from_options
    )

    original_factory.create_memory_service_from_options = _add_patch(
        "MemoryService", patched_create_memory_service_from_options
    )

    original_factory.create_artifact_service_from_options = _add_patch(
        "ArtifactService", patched_create_artifact_service_from_options
    )

    # Patch InMemoryCredentialService to use our Factory
    # This avoids the experimental warning while allowing flexible backend configuration
    from google.adk.cli import fast_api

    # fast_api.py calls: credential_service = InMemoryCredentialService()
    # So we replace the class with a factory function that returns our instance.
    fast_api.InMemoryCredentialService = get_credential_service
    # For classes/functions, just use __name__ or __qualname__
    patched_items.append("CredentialService")  # get_credential_service is a function, return type implies service logic
    logger.info("Intercepted ADK default CredentialService to use configurable backend")

    def _inject_negentropy_routes(app):
        logger.info("Injecting TracingInitMiddleware into ADK FastAPI app")

        import uuid

        from opentelemetry import baggage, trace
        from opentelemetry import context as otel_context
        from opentelemetry.sdk.trace import Status, StatusCode
        from starlette.middleware.base import BaseHTTPMiddleware
        from starlette.requests import Request

        from negentropy.auth.api import router as auth_router
        from negentropy.auth.middleware import AuthMiddleware
        from negentropy.engine.adapters.postgres.tracing import get_tracing_manager, set_tracing_context
        from negentropy.engine.api import router as memory_router
        from negentropy.engine.sessions_api import router as sessions_router
        from negentropy.interface.api import router as interface_router
        from negentropy.interface.models_api import router as interface_models_router
        from negentropy.interface.scheduler_api import router as interface_scheduler_router
        from negentropy.interface.task_models_api import corpus_router as interface_task_models_corpus_router
        from negentropy.interface.task_models_api import router as interface_task_models_router
        from negentropy.knowledge.api import router as knowledge_router

        class TracingInitMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request: Request, call_next):
                token = None
                try:
                    manager = get_tracing_manager()
                    if manager:
                        # ensure_initialized is idempotent and fast after first run
                        manager._ensure_initialized()

                        # Extract or generate session_id for Langfuse grouping
                        # Priority: Header > Query > JSON Body > Generated
                        session_id = request.headers.get("X-Session-ID") or request.query_params.get("session_id")
                        session_source = (
                            "header"
                            if request.headers.get("X-Session-ID")
                            else ("query" if request.query_params.get("session_id") else None)
                        )
                        user_id = request.headers.get("X-User-ID") or request.query_params.get("user_id")
                        user_source = (
                            "header"
                            if request.headers.get("X-User-ID")
                            else ("query" if request.query_params.get("user_id") else None)
                        )

                        if session_id is None:
                            try:
                                if request.method in {"POST", "PATCH"} and "application/json" in (
                                    request.headers.get("content-type") or ""
                                ):
                                    body = await request.json()
                                    session_id = body.get("sessionId") or body.get("session_id")
                                    if session_id and session_source is None:
                                        session_source = "body"
                                    if user_id is None:
                                        user_id = body.get("userId") or body.get("user_id")
                                        if user_id and user_source is None:
                                            user_source = "body"
                            except Exception as e:
                                logger.debug(f"Failed to read request JSON for session/user id: {e}")

                        if session_id is None:
                            session_id = str(uuid.uuid4())
                            session_source = "generated"

                        # Set tracing context so all spans get Langfuse attributes
                        set_tracing_context(session_id=session_id, user_id=user_id)

                        # Propagate via OTel baggage for cross-thread/task spans
                        ctx = otel_context.get_current()
                        if session_id:
                            ctx = baggage.set_baggage("langfuse.session.id", session_id, context=ctx)
                            ctx = baggage.set_baggage("session.id", session_id, context=ctx)
                        if user_id:
                            ctx = baggage.set_baggage("langfuse.user.id", user_id, context=ctx)
                            ctx = baggage.set_baggage("user.id", user_id, context=ctx)
                        token = otel_context.attach(ctx)

                        # Store session_id in request state for later use
                        request.state.session_id = session_id
                        if user_id:
                            request.state.user_id = user_id

                        logger.debug(
                            "Tracing context set: session_id=%s (source=%s), user_id=%s (source=%s)",
                            session_id,
                            session_source,
                            user_id,
                            user_source,
                        )

                except Exception as e:
                    logger.warning(f"Failed to ensure tracing init in middleware: {e}")

                # 为 HTTP 请求创建 Span
                tracer = trace.get_tracer("negentropy.http")
                span_name = f"{request.method} {request.url.path}"

                with tracer.start_as_current_span(span_name) as span:
                    # 设置 HTTP 属性
                    span.set_attribute("http.method", request.method)
                    span.set_attribute("http.url", str(request.url))
                    span.set_attribute("http.route", request.url.path)

                    try:
                        response = await call_next(request)
                        span.set_attribute("http.status_code", response.status_code)

                        if 200 <= response.status_code < 400:
                            span.set_status(Status(StatusCode.OK))
                        else:
                            span.set_status(Status(StatusCode.ERROR))

                        return response
                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        raise
                    finally:
                        if token is not None:
                            otel_context.detach(token)

        app.add_middleware(TracingInitMiddleware)
        app.add_middleware(AuthMiddleware)
        if not any(route.path.startswith("/knowledge") for route in app.router.routes):
            app.include_router(knowledge_router)
            logger.info("Knowledge API router mounted under /knowledge")

        # 全局 DBAPIError handler：pgvector 共享库缺失时返回 503 而非 500
        from fastapi.responses import JSONResponse
        from sqlalchemy.exc import DBAPIError

        @app.exception_handler(DBAPIError)
        async def _pgvector_missing_handler(request, exc):
            msg = (str(exc.orig) if exc.orig else str(exc)).lower()
            if "vector" in msg and ("could not access" in msg or "undefined file" in msg):
                logger.error("pgvector_library_missing_on_request", path=request.url.path, error=str(exc))
                return JSONResponse(
                    status_code=503,
                    content={
                        "code": "PGVECTOR_UNAVAILABLE",
                        "message": "数据库 pgvector 扩展不可用，Knowledge Graph 功能无法使用。请安装 pgvector 后重试。",
                        "hint": (
                            "安装 pgvector 扩展后执行: psql -d negentropy -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
                        ),
                    },
                )
            raise exc

        if not any(route.path.startswith("/memory") for route in app.router.routes):
            app.include_router(memory_router)
            logger.info("Memory API router mounted under /memory")
        if not any(route.path.startswith("/interface") for route in app.router.routes):
            app.include_router(interface_router)
            app.include_router(interface_models_router)
            app.include_router(interface_task_models_router)
            logger.info("Interface API router mounted under /interface")
        if not any(route.path.startswith("/scheduler") for route in app.router.routes):
            app.include_router(interface_scheduler_router)
            logger.info("Scheduler API router mounted under /scheduler")
        # Corpus 级 task-models 路由独立挂载（prefix=/knowledge/corpus/...），
        # 不与 /interface 共享 prefix，需判定挂载唯一性。
        if not any(
            getattr(route, "path", "").startswith("/knowledge/corpus/{corpus_id}/task-models")
            for route in app.router.routes
        ):
            app.include_router(interface_task_models_corpus_router)
            logger.info("Corpus task-models router mounted under /knowledge/corpus/{id}/task-models")
        if not any(route.path.startswith("/auth") for route in app.router.routes):
            app.include_router(auth_router)
            logger.info("Auth API router mounted under /auth")
        if not any(getattr(route, "path", "").endswith("/sessions/{session_id}/title") for route in app.router.routes):
            app.include_router(sessions_router)
            logger.info("Sessions API router mounted for title updates")

        # Phase 4：统一心跳调度引擎（5s tick + Registry + Handlers）。
        # 6 个旧 startup hook（cache_warm / pgvector_check / skill_scheduler /
        # pipeline_watchdog / session_title_inspector + 示例 agent_inspection）
        # 全部以 ScheduledTask 行的形式注册到 ``scheduled_tasks`` 表，
        # 由 ScheduledTaskRegistry._heartbeat_tick 统一扫表分派到 handler。
        #
        # Feature flags：
        #   NEGENTROPY_UNIFIED_SCHEDULER_ENABLED=false → 跳过 Registry 启动（灰度回退）
        #   NEGENTROPY_SCHEDULER_HEARTBEAT_SECONDS=<float> → 调整 tick 周期（默认 5.0）
        # 启停职责已迁移到模块级 :func:`_negentropy_lifespan` 上下文管理器，
        # 通过 ``AdkWebServer.get_fast_api_app(lifespan=...)`` 注入。详见下方
        # patched_get_fast_api_app 的注释。
        return app

    # Patch get_fast_api_app via AdkWebServer so it applies to current call
    try:
        from google.adk.cli.adk_web_server import AdkWebServer

        if not getattr(AdkWebServer.get_fast_api_app, "_negentropy_patched", False):
            original_get_fast_api_app = AdkWebServer.get_fast_api_app

            def patched_get_fast_api_app(self, *args, **kwargs):
                # P0-2 关键注入点：在 ADK 构造 ``FastAPI(lifespan=internal_lifespan)``
                # 之前，把 negentropy 业务 lifespan 包裹到 ``lifespan`` 参数。
                #
                # 关键发现：ADK 的 ``cli_tools_click.cli_web`` 入口已显式传
                # ``lifespan=_lifespan``（用于打印「ADK Web Server started/shutting
                # down」横幅），因此 ``kwargs["lifespan"]`` 几乎一定**非空**。
                # 必须用 ``_compose_with_lifespan`` 把现有 lifespan 与 negentropy
                # lifespan 嵌套合并，而不是「仅当为空时替换」。
                #
                # 嵌套结构（外到内）：
                #   _negentropy_lifespan ← combined ← 原 lifespan (ADK banner) ← yield
                # 关停时反向退栈：
                #   原 lifespan finally (banner) → _negentropy_lifespan finally
                #     (registry.aclose + dispose_all) → ADK internal_lifespan finally
                #     (observer / runners cleanup)
                # 这保证 negentropy 业务关停发生在 ADK runner 清理**之前**，避免
                # 调度任务在 runner 被 close 后还试图访问其 ADK service 句柄。
                existing_lifespan = kwargs.get("lifespan")
                kwargs["lifespan"] = _compose_with_negentropy_lifespan(existing_lifespan)
                app = original_get_fast_api_app(self, *args, **kwargs)
                return _inject_negentropy_routes(app)

            patched_get_fast_api_app._negentropy_patched = True
            AdkWebServer.get_fast_api_app = patched_get_fast_api_app
            patched_items.append("AdkWebServer.get_fast_api_app (Middleware + Lifespan Injection)")
    except Exception as exc:
        logger.warning(f"Failed to patch AdkWebServer.get_fast_api_app: {exc}")

    # Also patch cli.cli which imports these functions

    # List of modules that import these functions directly
    modules_to_patch = [
        "google.adk.cli.cli",
        "google.adk.cli.fast_api",
    ]

    for module_name in modules_to_patch:
        if module_name in sys.modules:
            logger.info(f"Patching module: {module_name}")
            mod = sys.modules[module_name]
            # Check and patch each function
            if hasattr(mod, "create_session_service_from_options"):
                mod.create_session_service_from_options = patched_create_session_service_from_options
            if hasattr(mod, "create_memory_service_from_options"):
                mod.create_memory_service_from_options = patched_create_memory_service_from_options
            if hasattr(mod, "create_artifact_service_from_options"):
                mod.create_artifact_service_from_options = patched_create_artifact_service_from_options

    # ADK 2.0 workaround (wrapper): safety net for subsequent calls to get_fast_api_app.
    # The primary fix is the eager sys.modules override above. This wrapper protects
    # any future calls that might bypass the eager fix (e.g., if services.py is imported
    # before get_fast_api_app is first called).
    try:
        from google.adk.cli import fast_api as _fast_api_mod

        _original_get_fast_api_app = _fast_api_mod.get_fast_api_app

        def _patched_get_fast_api_app(*args, **kwargs):
            # Temporarily remove dev_server from sys.modules so the
            # `from .dev_server import DevServer` always fails, ensuring
            # the except block imports ApiServer as a local variable.
            saved = sys.modules.get("google.adk.cli.dev_server")
            sys.modules["google.adk.cli.dev_server"] = None  # type: ignore[assignment]
            try:
                return _original_get_fast_api_app(*args, **kwargs)
            finally:
                if saved is not None:
                    sys.modules["google.adk.cli.dev_server"] = saved
                else:
                    sys.modules.pop("google.adk.cli.dev_server", None)

        _fast_api_mod.get_fast_api_app = _patched_get_fast_api_app
        patched_items.append("get_fast_api_app (ADK 2.0 ApiServer scoping fix)")
        logger.info("Patched fast_api.get_fast_api_app to work around ADK 2.0 ApiServer scoping bug")
    except Exception as exc:
        logger.warning(f"Failed to patch get_fast_api_app: {exc}")

    logger.info(f"ADK service factories patched successfully: {', '.join(patched_items)}")
    logger.info(f"Using configured credential backend: {settings.credential_service_backend}")
