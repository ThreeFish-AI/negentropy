# Negentropy Engine Package


def __getattr__(name: str):
    if name in {
        "get_memory_service",
        "reset_memory_service",
        "get_memory_governance_service",
        "reset_memory_governance_service",
        "get_runner",
        "reset_runner",
        "get_session_service",
        "reset_session_service",
        "get_artifact_service",
        "reset_artifact_service",
        "get_credential_service",
        "reset_credential_service",
    }:
        from negentropy.engine import factories

        return getattr(factories, name)
    raise AttributeError(f"module 'negentropy.engine' has no attribute {name}")


__all__ = [
    "get_memory_service",
    "reset_memory_service",
    "get_memory_governance_service",
    "reset_memory_governance_service",
    "get_session_service",
    "reset_session_service",
    "get_runner",
    "reset_runner",
    "get_artifact_service",
    "reset_artifact_service",
    "get_credential_service",
    "reset_credential_service",
]
