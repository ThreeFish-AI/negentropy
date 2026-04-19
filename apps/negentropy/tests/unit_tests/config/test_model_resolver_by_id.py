"""单元测试：model_resolver resolve_llm_config_by_id / resolve_embedding_config_by_id。

覆盖 None 回退默认、行不存在/已禁用/类型不匹配时的 warning 回退。
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_resolve_llm_config_by_id_none_falls_back_to_default():
    """config_id=None 时应回退到 resolve_llm_config。"""
    from negentropy.config.model_resolver import resolve_llm_config_by_id

    with patch(
        "negentropy.config.model_resolver.resolve_llm_config",
        new_callable=AsyncMock,
        return_value=("openai/gpt-4o", {"api_key": "sk-test"}),
    ) as mock_default:
        name, kwargs = await resolve_llm_config_by_id(None)
    mock_default.assert_awaited_once()
    assert name == "openai/gpt-4o"


@pytest.mark.asyncio
async def test_resolve_embedding_config_by_id_none_falls_back_to_default():
    from negentropy.config.model_resolver import resolve_embedding_config_by_id

    with patch(
        "negentropy.config.model_resolver.resolve_embedding_config",
        new_callable=AsyncMock,
        return_value=("openai/text-embedding-3-small", {"api_key": "sk-test"}),
    ) as mock_default:
        name, kwargs = await resolve_embedding_config_by_id(None)
    mock_default.assert_awaited_once()
    assert name == "openai/text-embedding-3-small"


@pytest.mark.asyncio
async def test_resolve_by_id_returns_none_on_missing_row():
    """model_configs 行不存在时返回 None，触发上层回退默认。"""
    from negentropy.config.model_resolver import _resolve_from_model_config_row

    fake_db = AsyncMock()
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = None
    fake_db.execute.return_value = fake_result

    with patch("negentropy.db.session.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
        mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
        result = await _resolve_from_model_config_row("llm", uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_resolve_by_id_returns_none_on_disabled():
    """model_configs 行 enabled=False 时返回 None。"""
    from negentropy.config.model_resolver import _resolve_from_model_config_row
    from negentropy.models.model_config import ModelType

    fake_row = MagicMock()
    fake_row.enabled = False
    fake_row.model_type = ModelType.LLM

    fake_db = AsyncMock()
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = fake_row
    fake_db.execute.return_value = fake_result

    with patch("negentropy.db.session.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
        mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
        result = await _resolve_from_model_config_row("llm", uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_resolve_by_id_returns_none_on_type_mismatch():
    """model_configs 行 model_type 与请求不符时返回 None。"""
    from negentropy.config.model_resolver import _resolve_from_model_config_row
    from negentropy.models.model_config import ModelType

    fake_row = MagicMock()
    fake_row.enabled = True
    fake_row.model_type = ModelType.EMBEDDING  # 请求 llm 但行是 embedding

    fake_db = AsyncMock()
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = fake_row
    fake_db.execute.return_value = fake_result

    with patch("negentropy.db.session.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
        mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
        result = await _resolve_from_model_config_row("llm", uuid4())

    assert result is None
