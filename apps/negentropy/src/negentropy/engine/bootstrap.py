import sys
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
from negentropy.instrumentation import LiteLLMLoggingCallback

# Initialize logging early
configure_logging(
    level=settings.log_level,
    sinks=settings.log_sinks,
    fmt=settings.log_format,
    file_path=settings.log_file_path,
    gcloud_project=settings.vertex_project_id,
    gcloud_log_name=settings.gcloud_log_name,
)

# Register LiteLLM callback for clean usage logging
try:
    import litellm

    litellm.success_callback = [LiteLLMLoggingCallback(), "otel"]
    litellm.failure_callback = [LiteLLMLoggingCallback(), "otel"]
except ImportError:
    pass

logger = get_logger("negentropy.bootstrap")

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
            from negentropy.engine.adapters.postgres.tracing import get_tracing_manager

            class TracingInitMiddleware(BaseHTTPMiddleware):
                async def dispatch(self, request: Request, call_next):
                    try:
                        manager = get_tracing_manager()
                        if manager:
                            # ensure_initialized is idempotent and fast after first run
                            manager._ensure_initialized()
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
            if hasattr(mod, "create_app") and mod.create_app != patched_create_app and mod.create_app == original_create_app:
                mod.create_app = patched_create_app

    logger.info(f"ADK service factories patched successfully: {', '.join(patched_items)}")
    logger.info(f"Using configured credential backend: {settings.credential_service_backend}")
