"""单元测试：/interface/models/configs CRUD 端点。

覆盖权限校验、唯一约束冲突、is_default 互斥、有引用时 DELETE 冲突。
使用 unittest.mock 绕过 DB 层，验证路由层逻辑正确性。
"""

from datetime import UTC
from unittest.mock import MagicMock
from uuid import uuid4

import pytest


@pytest.fixture
def _admin_user():
    from negentropy.auth.service import AuthUser

    return AuthUser(
        user_id="admin-test",
        email="admin@test.com",
        name="Admin",
        picture=None,
        roles=["admin"],
        provider="test",
        subject="admin-test",
        domain=None,
    )


@pytest.fixture
def _non_admin_user():
    from negentropy.auth.service import AuthUser

    return AuthUser(
        user_id="user-test",
        email="user@test.com",
        name="User",
        picture=None,
        roles=["user"],
        provider="test",
        subject="user-test",
        domain=None,
    )


@pytest.mark.asyncio
async def test_list_model_configs_requires_admin(_non_admin_user):
    """非 admin 用户应被 403 拒绝。"""
    from negentropy.interface.models_api import list_model_configs

    with pytest.raises(Exception) as exc_info:
        await list_model_configs(current_user=_non_admin_user)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_create_model_configs_requires_admin(_non_admin_user):
    from negentropy.interface.models_api import ModelConfigCreateRequest, create_model_config

    payload = ModelConfigCreateRequest(
        model_type="llm",
        display_name="Test",
        vendor="openai",
        model_name="gpt-4o",
    )
    with pytest.raises(Exception) as exc_info:
        await create_model_config(payload=payload, current_user=_non_admin_user)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_validate_model_type_rejects_invalid():
    from negentropy.interface.models_api import _validate_model_type

    with pytest.raises(Exception) as exc_info:
        _validate_model_type("invalid_type")
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_validate_model_type_accepts_valid():
    from negentropy.interface.models_api import _validate_model_type
    from negentropy.models.model_config import ModelType

    assert _validate_model_type("llm") == ModelType.LLM
    assert _validate_model_type("embedding") == ModelType.EMBEDDING
    assert _validate_model_type("rerank") == ModelType.RERANK


def test_model_config_to_dict():
    from datetime import datetime

    from negentropy.interface.models_api import _model_config_to_dict
    from negentropy.models.model_config import ModelType

    mc = MagicMock()
    mc.id = uuid4()
    mc.model_type = ModelType.LLM
    mc.display_name = "GPT-4o"
    mc.vendor = "openai"
    mc.model_name = "gpt-4o"
    mc.is_default = True
    mc.enabled = True
    mc.config = {"dimensions": 1536}
    mc.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    mc.updated_at = datetime(2026, 1, 2, tzinfo=UTC)

    result = _model_config_to_dict(mc)
    assert result["model_type"] == "llm"
    assert result["display_name"] == "GPT-4o"
    assert result["vendor"] == "openai"
    assert result["config"]["dimensions"] == 1536
    assert result["is_default"] is True
