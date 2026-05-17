"""单元测试：/interface/task-models 与 /knowledge/corpus/.../task-models 端点。

覆盖：
    - 注册表只读端点（任何登录用户可访问）
    - 全局映射端点要求 admin
    - 未知 task_key 返回 400
    - task scope=corpus 不允许在全局端点配置
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from negentropy.auth.service import AuthUser


def _make_user(roles: list[str]) -> AuthUser:
    return AuthUser(
        user_id="test",
        email="t@example.com",
        name="T",
        picture=None,
        roles=roles,
        provider="test",
        subject="test",
        domain=None,
    )


@pytest.fixture
def admin_user() -> AuthUser:
    return _make_user(["admin"])


@pytest.fixture
def non_admin_user() -> AuthUser:
    return _make_user(["user"])


@pytest.mark.asyncio
async def test_get_registry_does_not_require_admin(non_admin_user):
    """注册表是只读元信息，普通登录用户也能读。"""
    from negentropy.interface.task_models_api import get_task_registry

    payload = await get_task_registry(current_user=non_admin_user)
    assert "tasks" in payload
    keys = {t["task_key"] for t in payload["tasks"]}
    assert "session.title" in keys
    assert "knowledge.kg.extraction.entity" in keys


@pytest.mark.asyncio
async def test_list_global_settings_requires_admin(non_admin_user):
    from negentropy.interface.task_models_api import list_global_task_settings

    with pytest.raises(Exception) as exc:
        await list_global_task_settings(current_user=non_admin_user)
    assert getattr(exc.value, "status_code", None) == 403


@pytest.mark.asyncio
async def test_upsert_global_setting_rejects_unknown_task_key(admin_user):
    """task_key 不在注册表内应返回 400。"""
    from negentropy.interface.task_models_api import TaskModelUpsert, upsert_global_task_setting

    payload = TaskModelUpsert(model_config_id=uuid4())
    with patch("negentropy.interface.task_models_api._require_admin", new=AsyncMock(return_value=admin_user)):
        with pytest.raises(Exception) as exc:
            await upsert_global_task_setting(
                task_key="not.a.real.task",
                payload=payload,
                current_user=admin_user,
            )
    assert getattr(exc.value, "status_code", None) == 400


@pytest.mark.asyncio
async def test_upsert_global_setting_rejects_model_type_mismatch(admin_user):
    """task=session.title 期望 llm，传 embedding 类 model_config 应 400。"""
    from negentropy.interface.task_models_api import TaskModelUpsert, upsert_global_task_setting
    from negentropy.models.model_config import ModelType

    target_id = uuid4()
    fake_mc = MagicMock()
    fake_mc.id = target_id
    fake_mc.enabled = True
    fake_mc.model_type = ModelType.EMBEDDING  # 不匹配

    fake_db = AsyncMock()
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = fake_mc
    fake_db.execute.return_value = fake_result

    with (
        patch("negentropy.interface.task_models_api._require_admin", new=AsyncMock(return_value=admin_user)),
        patch("negentropy.interface.task_models_api.AsyncSessionLocal") as mock_session,
    ):
        mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
        mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
        with pytest.raises(Exception) as exc:
            await upsert_global_task_setting(
                task_key="session.title",
                payload=TaskModelUpsert(model_config_id=target_id),
                current_user=admin_user,
            )
    assert getattr(exc.value, "status_code", None) == 400


@pytest.mark.asyncio
async def test_corpus_setting_rejects_global_only_task(admin_user):
    """scope=global 的 task 不应允许在 corpus 端点配置。"""
    from negentropy.interface.task_models_api import TaskModelUpsert, upsert_corpus_task_setting

    corpus_id = uuid4()
    fake_db = AsyncMock()
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = corpus_id  # corpus 存在
    fake_db.execute.return_value = fake_result

    with patch("negentropy.interface.task_models_api.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
        mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
        with pytest.raises(Exception) as exc:
            await upsert_corpus_task_setting(
                corpus_id=corpus_id,
                task_key="session.title",  # global scope
                payload=TaskModelUpsert(model_config_id=uuid4()),
                current_user=admin_user,
            )
    detail = str(exc.value.detail) if hasattr(exc.value, "detail") else str(exc.value)
    assert getattr(exc.value, "status_code", None) == 400
    assert "not corpus-scoped" in detail
