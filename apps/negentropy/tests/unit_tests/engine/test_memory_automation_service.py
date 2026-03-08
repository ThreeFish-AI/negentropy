from __future__ import annotations

import pytest

from negentropy.engine.adapters.postgres.memory_automation_service import (
    DEFAULT_AUTOMATION_CONFIG,
    MemoryAutomationService,
)


@pytest.fixture
def service() -> MemoryAutomationService:
    return MemoryAutomationService()


def test_merge_config_preserves_defaults(service: MemoryAutomationService):
    merged = service._merge_config(  # noqa: SLF001
        DEFAULT_AUTOMATION_CONFIG,
        {
            "retention": {
                "auto_cleanup_enabled": True,
            }
        },
    )

    assert merged["retention"]["auto_cleanup_enabled"] is True
    assert merged["retention"]["cleanup_schedule"] == DEFAULT_AUTOMATION_CONFIG["retention"]["cleanup_schedule"]
    assert merged["consolidation"]["enabled"] is False


def test_validate_config_rejects_invalid_ratios(service: MemoryAutomationService):
    invalid = service._merge_config(  # noqa: SLF001
        DEFAULT_AUTOMATION_CONFIG,
        {
            "context_assembler": {
                "memory_ratio": 0.8,
                "history_ratio": 0.5,
            }
        },
    )

    with pytest.raises(ValueError, match="sum to <= 1"):
        service._validate_config(invalid)  # noqa: SLF001


def test_build_cleanup_job_runtime_uses_managed_sql(service: MemoryAutomationService):
    enabled, schedule, command = service._build_job_runtime(  # noqa: SLF001
        job_key="cleanup_memories",
        config=DEFAULT_AUTOMATION_CONFIG,
    )

    assert enabled is False
    assert schedule == "0 2 * * *"
    assert "cleanup_low_value_memories" in command
    assert "negentropy.cleanup_low_value_memories" in command
