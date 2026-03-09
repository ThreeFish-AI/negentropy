from __future__ import annotations

import pytest

from negentropy.engine.adapters.postgres.memory_automation_service import (
    DEFAULT_AUTOMATION_CONFIG,
    MemoryAutomationUnavailableError,
    MemoryAutomationService,
    _build_function_definitions,
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


def test_context_assembler_config_updates_managed_function_defaults():
    config = {
        **DEFAULT_AUTOMATION_CONFIG,
        "context_assembler": {
            "max_tokens": 8192,
            "memory_ratio": 0.4,
            "history_ratio": 0.4,
        },
    }

    function_sql = _build_function_definitions(config)["get_context_window"]

    assert "p_max_tokens INTEGER DEFAULT 8192" in function_sql
    assert "p_memory_ratio FLOAT DEFAULT 0.4" in function_sql
    assert "p_history_ratio FLOAT DEFAULT 0.4" in function_sql


@pytest.mark.asyncio
async def test_scheduler_actions_raise_when_pg_cron_unavailable(service: MemoryAutomationService, monkeypatch: pytest.MonkeyPatch):
    async def fake_capabilities():
        return {
            "pg_cron_installed": True,
            "pg_cron_available": False,
            "pg_cron_logs_accessible": False,
        }

    monkeypatch.setattr(service, "_get_capabilities", fake_capabilities)

    with pytest.raises(MemoryAutomationUnavailableError):
        await service._ensure_scheduler_available(job_key="cleanup_memories")  # noqa: SLF001
