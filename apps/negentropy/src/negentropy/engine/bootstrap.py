import sys
import os
import base64
from typing import Any, Optional
from pathlib import Path

# Import the original factory module to be patched
import google.adk.cli.utils.service_factory as original_factory

# Import our custom factories
from negentropy.engine.factories import (
    get_session_service,
    get_memory_service,
    get_artifact_service,
    get_credential_service,
)
from negentropy.config import settings
from negentropy.logging import configure_logging, get_logger
from negentropy.instrumentation import LiteLLMLoggingCallback, patch_litellm_otel_cost

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
    session_service_uri: Optional[str] = None,
    session_db_kwargs: Optional[dict[str, Any]] = None,
    app_name_to_dir: Optional[dict[str, str]] = None,
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
    memory_service_uri: Optional[str] = None,
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
    artifact_service_uri: Optional[str] = None,
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


def apply_adk_patches():
    """
    Apply monkey-patches to ADK service factories.
    This allows ADK CLI commands (like `adk web`) to use services configured
    in .env without needing explicit CLI arguments.
    """

    logger.info("Monkey-patching ADK service factories to use negentropy configuration...")

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

    # Patch create_app to inject Middleware
    if hasattr(fast_api, "create_app"):
        original_create_app = fast_api.create_app

        def patched_create_app(*args, **kwargs):
            app = original_create_app(*args, **kwargs)
            logger.info("Injecting TracingInitMiddleware into ADK FastAPI app")

            from starlette.middleware.base import BaseHTTPMiddleware
            from starlette.requests import Request
            from negentropy.engine.adapters.postgres.tracing import get_tracing_manager, set_tracing_context
            import uuid

            class TracingInitMiddleware(BaseHTTPMiddleware):
                async def dispatch(self, request: Request, call_next):
                    try:
                        manager = get_tracing_manager()
                        if manager:
                            # ensure_initialized is idempotent and fast after first run
                            manager._ensure_initialized()

                            # Extract or generate session_id for Langfuse grouping
                            # Priority: Header > Query > Generated
                            session_id = (
                                request.headers.get("X-Session-ID")
                                or request.query_params.get("session_id")
                                or str(uuid.uuid4())
                            )

                            # Extract user_id if available
                            user_id = request.headers.get("X-User-ID") or request.query_params.get("user_id")

                            # Set tracing context so all spans get Langfuse attributes
                            set_tracing_context(session_id=session_id, user_id=user_id)

                            # Store session_id in request state for later use
                            request.state.session_id = session_id
                            if user_id:
                                request.state.user_id = user_id

                            logger.debug(f"Tracing context set: session_id={session_id}, user_id={user_id}")

                    except Exception as e:
                        logger.warning(f"Failed to ensure tracing init in middleware: {e}")

                    return await call_next(request)

            app.add_middleware(TracingInitMiddleware)
            return app

        fast_api.create_app = patched_create_app
        patched_items.append("create_app (Middleware Injection)")

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
            # Patch create_app in modules if present
            if (
                hasattr(mod, "create_app")
                and mod.create_app != patched_create_app
                and mod.create_app == original_create_app
            ):
                mod.create_app = patched_create_app

    logger.info(f"ADK service factories patched successfully: {', '.join(patched_items)}")
    logger.info(f"Using configured credential backend: {settings.credential_service_backend}")
