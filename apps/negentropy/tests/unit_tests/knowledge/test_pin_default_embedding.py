"""单元测试：_pin_default_embedding_config 创建期固化全局默认 Embedding。

覆盖：
    1. 未提供 embedding_config_id 且存在全局默认 → 写入其 id
    2. 已显式提供 embedding_config_id → no-op（尊重调用方 pin）
    3. 无全局默认行 → no-op（保持未 pin，由运行期解析兜底）
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from negentropy.knowledge import _shared


@pytest.mark.asyncio
async def test_pin_stamps_default_when_absent():
    """无 models 子键且存在全局默认 → 固化默认 embedding_config_id。"""
    target = uuid4()
    config: dict = {}

    with patch(
        "negentropy.config.model_resolver.resolve_default_model_config_id",
        new=AsyncMock(return_value=target),
    ):
        await _shared._pin_default_embedding_config(config)

    assert config["models"]["embedding_config_id"] == str(target)


@pytest.mark.asyncio
async def test_pin_noop_when_explicit():
    """调用方已显式指定 embedding_config_id → 不覆盖，且不查询默认。"""
    existing = uuid4()
    config: dict = {"models": {"embedding_config_id": str(existing)}}
    mock_resolve = AsyncMock(return_value=uuid4())

    with patch(
        "negentropy.config.model_resolver.resolve_default_model_config_id",
        new=mock_resolve,
    ):
        await _shared._pin_default_embedding_config(config)

    assert config["models"]["embedding_config_id"] == str(existing)
    mock_resolve.assert_not_awaited()


@pytest.mark.asyncio
async def test_pin_noop_when_no_default():
    """无全局默认行 → 不写入 models 键，语料保持未 pin。"""
    config: dict = {}

    with patch(
        "negentropy.config.model_resolver.resolve_default_model_config_id",
        new=AsyncMock(return_value=None),
    ):
        await _shared._pin_default_embedding_config(config)

    assert "models" not in config
