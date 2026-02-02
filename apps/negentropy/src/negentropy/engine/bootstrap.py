import logging
import sys
from typing import Any, Optional
from pathlib import Path

# Import the original factory module to be patched
import google.adk.cli.utils.service_factory as original_factory

# Import our custom factories
from negentropy.engine.session_factory import get_session_service
from negentropy.engine.memory_factory import get_memory_service
from negentropy.engine.artifacts_factory import get_artifact_service
from negentropy.config import settings

logger = logging.getLogger("negentropy.bootstrap")

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

    # Patch the module directly
    original_factory.create_session_service_from_options = patched_create_session_service_from_options
    original_factory.create_memory_service_from_options = patched_create_memory_service_from_options
    original_factory.create_artifact_service_from_options = patched_create_artifact_service_from_options

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

    logger.info("ADK service factories patched successfully.")
