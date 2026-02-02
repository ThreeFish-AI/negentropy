"""
CredentialServiceFactory: Unified CredentialService Backend Factory

Uses Strategy + Factory pattern to dynamically select CredentialService implementation:
- postgres: Custom PostgresCredentialService (Default, Persistent)
- inmemory: ADK InMemoryCredentialService (Standard, triggers warnings)
- session: ADK SessionStateCredentialService (Standard, triggers warnings)
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from google.adk.auth.credential_service.base_credential_service import BaseCredentialService

from negentropy.config import settings


class CredentialBackend(str, Enum):
    """Supported CredentialService backends."""

    INMEMORY = "inmemory"
    SESSION = "session"
    POSTGRES = "postgres"


def create_inmemory_credential_service() -> BaseCredentialService:
    """Create InMemoryCredentialService (ADK Standard)"""
    from google.adk.auth.credential_service.in_memory_credential_service import (
        InMemoryCredentialService,
    )

    return InMemoryCredentialService()


def create_session_credential_service() -> BaseCredentialService:
    """Create SessionStateCredentialService (ADK Standard)"""
    from google.adk.auth.credential_service.session_state_credential_service import (
        SessionStateCredentialService,
    )

    return SessionStateCredentialService()


def create_postgres_credential_service() -> BaseCredentialService:
    """Create PostgresCredentialService (Production, Persistent)"""
    from negentropy.engine.adapters.postgres.credential_service import PostgresCredentialService

    return PostgresCredentialService()


# Backend Factory Registry (Strategy Pattern)
_BACKEND_FACTORIES = {
    CredentialBackend.INMEMORY: create_inmemory_credential_service,
    CredentialBackend.SESSION: create_session_credential_service,
    CredentialBackend.POSTGRES: create_postgres_credential_service,
}

# Module-level singleton
_credential_service_instance: Optional[BaseCredentialService] = None


def get_credential_service(backend: str | None = None) -> BaseCredentialService:
    """
    Get CredentialService instance (Factory).

    Args:
        backend: Backend type (postgres, inmemory, session).
                 If None, reads from settings.credential_service_backend

    Returns:
        BaseCredentialService instance
    """
    global _credential_service_instance

    backend_str = backend or settings.credential_service_backend
    try:
        backend_enum = CredentialBackend(backend_str.lower())
    except ValueError:
        raise ValueError(
            f"Unsupported credential backend: {backend_str}. Supported: {[b.value for b in CredentialBackend]}"
        )

    # Return cached instance if no explicit backend is requested
    if _credential_service_instance is not None and backend is None:
        return _credential_service_instance

    factory = _BACKEND_FACTORIES.get(backend_enum)
    if not factory:
        raise ValueError(f"No factory registered for backend: {backend_enum}")

    instance = factory()

    # Cache only default instance
    if backend is None:
        _credential_service_instance = instance

    return instance


def reset_credential_service() -> None:
    """Reset singleton (for testing)"""
    global _credential_service_instance
    _credential_service_instance = None
