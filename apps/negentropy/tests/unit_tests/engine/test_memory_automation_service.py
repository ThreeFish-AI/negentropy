from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.adapters.postgres.memory_automation_service import (
    DEFAULT_AUTOMATION_CONFIG,
    JOB_TEMPLATES,
    MemoryAutomationService,
    MemoryAutomationUnavailableError,
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
async def test_scheduler_actions_raise_when_pg_cron_unavailable(
    service: MemoryAutomationService, monkeypatch: pytest.MonkeyPatch
):
    async def fake_capabilities():
        return {
            "pg_cron_installed": True,
            "pg_cron_available": False,
            "pg_cron_logs_accessible": False,
        }

    monkeypatch.setattr(service, "_get_capabilities", fake_capabilities)

    with pytest.raises(MemoryAutomationUnavailableError):
        await service._ensure_scheduler_available(job_key="cleanup_memories")  # noqa: SLF001


def test_reweight_relevance_in_job_templates():
    assert "reweight_relevance" in JOB_TEMPLATES
    template = JOB_TEMPLATES["reweight_relevance"]
    assert template.process_label == "Rocchio Reweight"
    assert template.function_name == "reweight_all_users_relevance"


def test_reweight_relevance_default_config():
    assert "reweight_relevance" in DEFAULT_AUTOMATION_CONFIG
    assert DEFAULT_AUTOMATION_CONFIG["reweight_relevance"]["enabled"] is False
    assert DEFAULT_AUTOMATION_CONFIG["reweight_relevance"]["schedule"] == "0 */6 * * *"


def test_set_job_enabled_reweight_relevance(service: MemoryAutomationService):
    config = {
        "retention": {"auto_cleanup_enabled": False},
        "consolidation": {"enabled": False},
        "reweight_relevance": {"enabled": False},
    }
    service._set_job_enabled(config, "reweight_relevance", True)  # noqa: SLF001
    assert config["reweight_relevance"]["enabled"] is True

    service._set_job_enabled(config, "reweight_relevance", False)  # noqa: SLF001
    assert config["reweight_relevance"]["enabled"] is False


def test_build_job_runtime_reweight_relevance(service: MemoryAutomationService):
    enabled, schedule, command = service._build_job_runtime(  # noqa: SLF001
        job_key="reweight_relevance",
        config=DEFAULT_AUTOMATION_CONFIG,
    )
    assert enabled is False
    assert schedule == "0 */6 * * *"
    assert "reweight_all_users_relevance" in command


def test_build_function_definitions_includes_reweight():
    funcs = _build_function_definitions(DEFAULT_AUTOMATION_CONFIG)
    assert "reweight_all_users_relevance" in funcs
    sql = funcs["reweight_all_users_relevance"]
    assert "memory_retrieval_logs" in sql
    assert "outcome_feedback IS NOT NULL" in sql


@pytest.mark.asyncio
async def test_run_reweight_relevance_dispatches(service: MemoryAutomationService):
    """Verify _run_reweight_relevance queries users with feedback and calls reweight_memories."""

    fake_row_1 = MagicMock(user_id="user_a", app_name="app1")
    fake_row_2 = MagicMock(user_id="user_b", app_name="app1")

    mock_result = MagicMock()
    mock_result.all.return_value = [fake_row_1, fake_row_2]

    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)

    mock_rw_module = MagicMock()
    mock_rw_module.reweight_memories = AsyncMock(side_effect=[5, 3])

    with (
        patch(
            "negentropy.engine.adapters.postgres.memory_automation_service.AsyncSessionLocal",
            return_value=mock_db,
        ),
        patch.dict("sys.modules", {"negentropy.engine.relevance.rocchio_reweighter": mock_rw_module}),
    ):
        result = await service._run_reweight_relevance()  # noqa: SLF001

    assert result["users_processed"] == 2
    assert result["reweighted_memories"] == 8
    assert result["failed_users"] == 0
    assert mock_rw_module.reweight_memories.call_count == 2


@pytest.mark.asyncio
async def test_run_reweight_relevance_no_feedback(service: MemoryAutomationService):
    """When no feedback exists, should return 0 reweighted and 0 users."""

    mock_result = MagicMock()
    mock_result.all.return_value = []

    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)

    with patch(
        "negentropy.engine.adapters.postgres.memory_automation_service.AsyncSessionLocal",
        return_value=mock_db,
    ):
        result = await service._run_reweight_relevance()  # noqa: SLF001

    assert result["users_processed"] == 0
    assert result["reweighted_memories"] == 0
    assert result["failed_users"] == 0


@pytest.mark.asyncio
async def test_run_reweight_relevance_partial_failure(service: MemoryAutomationService):
    """When reweight_memories fails for one user, others should still be processed."""

    fake_row_ok = MagicMock(user_id="user_ok", app_name="app1")
    fake_row_fail = MagicMock(user_id="user_fail", app_name="app1")
    fake_row_ok2 = MagicMock(user_id="user_ok2", app_name="app1")

    mock_result = MagicMock()
    mock_result.all.return_value = [fake_row_ok, fake_row_fail, fake_row_ok2]

    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)

    mock_rw_module = MagicMock()
    mock_rw_module.reweight_memories = AsyncMock(side_effect=[7, RuntimeError("boom"), 4])

    with (
        patch(
            "negentropy.engine.adapters.postgres.memory_automation_service.AsyncSessionLocal",
            return_value=mock_db,
        ),
        patch.dict("sys.modules", {"negentropy.engine.relevance.rocchio_reweighter": mock_rw_module}),
    ):
        result = await service._run_reweight_relevance()  # noqa: SLF001

    assert result["reweighted_memories"] == 11  # 7 + 4
    assert result["users_processed"] == 2
    assert result["failed_users"] == 1
    assert mock_rw_module.reweight_memories.call_count == 3
