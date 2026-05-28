from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.adapters.postgres.memory_automation_service import (
    DEFAULT_AUTOMATION_CONFIG,
    JOB_FUNCTION_NAMES,
    JOB_LABELS,
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


def test_reweight_relevance_label_and_function_registered():
    assert "reweight_relevance" in JOB_LABELS
    assert JOB_LABELS["reweight_relevance"] == "Rocchio Reweight"
    assert "reweight_relevance" in JOB_FUNCTION_NAMES
    assert JOB_FUNCTION_NAMES["reweight_relevance"] == "reweight_all_users_relevance"


def test_cleanup_label_and_function_registered():
    assert JOB_LABELS["cleanup_memories"] == "Ebbinghaus Cleanup"
    assert JOB_FUNCTION_NAMES["cleanup_memories"] == "cleanup_low_value_memories"


def test_trigger_consolidation_label_and_function_registered():
    assert JOB_LABELS["trigger_consolidation"] == "Maintenance Consolidation"
    assert JOB_FUNCTION_NAMES["trigger_consolidation"] == "trigger_maintenance_consolidation"


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


def test_build_function_definitions_includes_reweight():
    funcs = _build_function_definitions(DEFAULT_AUTOMATION_CONFIG)
    assert "reweight_all_users_relevance" in funcs
    sql = funcs["reweight_all_users_relevance"]
    assert "memory_retrieval_logs" in sql
    assert "outcome_feedback IS NOT NULL" in sql


# ---- Reweight relevance tests ----


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


# ---- Consolidation SQL parameter boundary tests ----


def test_consolidation_handler_sql_uses_cast_not_double_colon():
    """Handler 层 _run_consolidation SQL 构造行必须使用 CAST 而非 :: 直接 cast。"""
    import inspect

    from negentropy.engine.schedulers.handlers.memory_automation import _run_consolidation

    source = inspect.getsource(_run_consolidation)
    sql_lines = [line for line in source.splitlines() if "sql = text(" in line]
    assert len(sql_lines) == 1, f"预期恰好 1 行 sql = text(...)，实际 {len(sql_lines)} 行"
    assert "CAST(:lookback AS interval)" in sql_lines[0], (
        f"sql 构造行应使用 CAST(:lookback AS interval)，实际: {sql_lines[0]}"
    )


def test_consolidation_service_run_job_sql_uses_cast_not_double_colon():
    """Service 层 run_job(trigger_consolidation) SQL 构造行必须使用 CAST。"""
    import inspect

    from negentropy.engine.adapters.postgres.memory_automation_service import MemoryAutomationService

    source = inspect.getsource(MemoryAutomationService.run_job)
    # 筛选 trigger_consolidation 分支内的 sql = text(...) 行
    in_consolidation_branch = False
    sql_lines = []
    for line in source.splitlines():
        if '"trigger_consolidation"' in line:
            in_consolidation_branch = True
        elif in_consolidation_branch and ("elif " in line or "else:" in line):
            in_consolidation_branch = False
        if in_consolidation_branch and "sql = text(" in line:
            sql_lines.append(line)
    assert len(sql_lines) == 1, f"预期 1 行 sql = text(...)，实际 {len(sql_lines)} 行"
    assert "CAST(:lookback AS interval)" in sql_lines[0], (
        f"sql 构造行应使用 CAST(:lookback AS interval)，实际: {sql_lines[0]}"
    )


def test_sync_config_payload_uses_cast_not_double_colon():
    """_sync_config_to_scheduled_tasks 中 payload 赋值应使用 CAST 规范。"""
    import inspect

    from negentropy.engine.adapters.postgres.memory_automation_service import MemoryAutomationService

    source = inspect.getsource(MemoryAutomationService._sync_config_to_scheduled_tasks)
    assert "CAST(:payload AS jsonb)" in source, (
        "_sync_config_to_scheduled_tasks 应使用 CAST(:payload AS jsonb) 而非 :payload ::jsonb"
    )
    assert ":payload ::jsonb" not in source, (
        "_sync_config_to_scheduled_tasks 不应使用 :payload ::jsonb —— 脆弱写法，应统一为 CAST 规范"
    )


@pytest.mark.asyncio
async def test_handler_run_consolidation_success():
    """Handler _run_consolidation 成功路径：返回 ok + count。"""
    from negentropy.models.scheduled_task import ScheduledTask

    mock_result = MagicMock()
    mock_result.first.return_value = (3,)

    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)

    task = MagicMock(spec=ScheduledTask)
    task.payload = {"job_type": "trigger_consolidation", "lookback_interval": "2 hours"}

    with patch(
        "negentropy.engine.schedulers.handlers.memory_automation.AsyncSessionLocal",
        return_value=mock_db,
    ):
        from negentropy.engine.schedulers.handlers.memory_automation import _run_consolidation

        result = await _run_consolidation(task)

    assert result.status == "ok"
    assert result.metrics["consolidated"] == 3

    # 验证 SQL 使用 CAST 而非 ::
    call_args = mock_db.execute.call_args
    sql_text = str(call_args[0][0])
    assert "CAST(:lookback AS interval)" in sql_text
    assert ":lookback::interval" not in sql_text


@pytest.mark.asyncio
async def test_service_run_job_consolidation_success():
    """Service run_job(trigger_consolidation) 成功路径：验证 SQL 使用 CAST。"""
    from negentropy.engine.adapters.postgres.memory_automation_service import MemoryAutomationService

    mock_select_result = MagicMock()
    mock_select_result.first.return_value = (5,)

    mock_db = AsyncMock()
    # _reconcile_functions 创建 5 个 function → 5 次 DDL execute
    # + consolidation SELECT → 1 次 execute = 6 次
    mock_db.execute.side_effect = [MagicMock()] * 5 + [mock_select_result]
    mock_db.commit = AsyncMock()
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)

    mock_get_config = AsyncMock(return_value=DEFAULT_AUTOMATION_CONFIG)
    mock_get_snapshot = AsyncMock(return_value={})

    service = MemoryAutomationService()
    with (
        patch(
            "negentropy.engine.adapters.postgres.memory_automation_service.AsyncSessionLocal",
            return_value=mock_db,
        ),
        patch.object(service, "get_effective_config", mock_get_config),
        patch.object(service, "get_snapshot", mock_get_snapshot),
    ):
        result = await service.run_job(app_name="test", job_key="trigger_consolidation")

    assert result["result"] == 5

    # 最后一个 execute 调用是 consolidation SQL
    consolidation_call = mock_db.execute.call_args_list[-1]
    sql_text = str(consolidation_call[0][0])
    assert "CAST(:lookback AS interval)" in sql_text, f"SQL 应包含 CAST，实际: {sql_text}"
