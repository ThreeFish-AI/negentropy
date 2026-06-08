"""单元测试：model_resolver._resolve 消费 model_configs.is_default。

覆盖 Interface/Model「Default」开关的权威解析链：
    1. is_default 行命中 → 返回该模型，且不触达 vendor_configs 回退层
    2. 无 is_default 行 → 回退硬编码默认（关键向后兼容保护）
    3. _load_default_model_config_row 查询带 is_default + enabled 过滤
    4. is_default 查询抛异常 → 记日志并降级，不崩溃
    5. LLM 对称命中 + _DEFAULT_LLM_KWARGS 仍被合并（守护抽取 helper 不丢合并）
    6. 缓存命中：二次解析不再触发 is_default 查询
    7. invalidate_cache 后重解析 → 再次触发查询
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.config import model_resolver


@pytest.fixture(autouse=True)
def _clear_cache():
    """每个用例前后清空模块级缓存，避免相互污染（_cache 为全局）。"""
    model_resolver.invalidate_cache(None)
    yield
    model_resolver.invalidate_cache(None)


def _fake_row(vendor: str, model_name: str, config: dict | None = None) -> MagicMock:
    mc = MagicMock()
    mc.vendor = vendor
    mc.model_name = model_name
    mc.config = config or {}
    return mc


@pytest.mark.asyncio
async def test_resolve_embedding_uses_is_default_row():
    """is_default embedding 行命中：返回该模型，且不回退到 vendor_configs 层。"""
    row = _fake_row("openai", "text-embedding-3-small", {"dimensions": 1536})

    with (
        patch.object(model_resolver, "_load_default_model_config_row", new=AsyncMock(return_value=row)),
        patch.object(model_resolver, "_get_vendor_config", new=AsyncMock(return_value=None)),
        patch.object(model_resolver, "_resolve_from_vendor_configs", new=AsyncMock()) as mock_vendor,
    ):
        name, kwargs = await model_resolver._resolve("embedding")

    assert name == "openai/text-embedding-3-small"
    assert kwargs["dimensions"] == 1536
    mock_vendor.assert_not_awaited()  # is_default 命中应短路，不触达硬编码默认路径


@pytest.mark.asyncio
async def test_resolve_embedding_falls_back_when_no_default():
    """无 is_default 行 → 回退硬编码 gemini/text-embedding-004（向后兼容关键保护）。"""
    with (
        patch.object(model_resolver, "_load_default_model_config_row", new=AsyncMock(return_value=None)),
        patch.object(model_resolver, "_get_vendor_config", new=AsyncMock(return_value=None)),
    ):
        name, _ = await model_resolver._resolve("embedding")

    assert name == "gemini/text-embedding-004"


@pytest.mark.asyncio
async def test_load_default_row_query_filters_is_default_and_enabled():
    """_load_default_model_config_row 的查询须同时过滤 is_default 与 enabled。

    保证「被设为默认但随后禁用」的行不会被选中（写端点对二者独立更新）。
    """
    captured: dict = {}
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = None

    async def _execute(stmt, *args, **kwargs):
        captured["stmt"] = stmt
        return fake_result

    fake_db = AsyncMock()
    fake_db.execute = AsyncMock(side_effect=_execute)

    with patch("negentropy.db.session.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
        mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
        row = await model_resolver._load_default_model_config_row("embedding")

    assert row is None
    sql = str(captured["stmt"])
    assert "is_default" in sql
    assert "enabled" in sql


@pytest.mark.asyncio
async def test_resolve_embedding_db_error_falls_back():
    """is_default 查询抛异常 → 记日志并降级到 vendor_configs/硬编码，不冒泡。"""
    with (
        patch.object(
            model_resolver,
            "_load_default_model_config_row",
            new=AsyncMock(side_effect=RuntimeError("db down")),
        ),
        patch.object(model_resolver, "_get_vendor_config", new=AsyncMock(return_value=None)),
    ):
        name, _ = await model_resolver._resolve("embedding")

    assert name == "gemini/text-embedding-004"


@pytest.mark.asyncio
async def test_resolve_llm_uses_is_default_and_merges_default_kwargs():
    """LLM 对称：is_default 命中，且 _DEFAULT_LLM_KWARGS 仍被合并入 kwargs。"""
    row = _fake_row("openai", "gpt-5-mini", {})

    with (
        patch.object(model_resolver, "_load_default_model_config_row", new=AsyncMock(return_value=row)),
        patch.object(model_resolver, "_get_vendor_config", new=AsyncMock(return_value=None)),
    ):
        name, kwargs = await model_resolver._resolve("llm")

    assert name == "openai/gpt-5-mini"
    # 抽取共享 helper 后，LLM 默认 kwargs（temperature/drop_params）不得丢失
    assert kwargs.get("temperature") == 0.7
    assert kwargs.get("drop_params") is True


@pytest.mark.asyncio
async def test_resolve_caches_default_row():
    """命中后写入缓存：TTL 内二次解析不再触发 is_default 查询。"""
    mock_default = AsyncMock(return_value=("openai/text-embedding-3-small", {"dimensions": 1536}))

    with patch.object(model_resolver, "_resolve_from_default_model_config", new=mock_default):
        await model_resolver._resolve("embedding")
        await model_resolver._resolve("embedding")

    assert mock_default.await_count == 1


@pytest.mark.asyncio
async def test_invalidate_cache_reresolves_default_row():
    """invalidate_cache(None) 后缓存失效，重解析应再次触发 is_default 查询。"""
    mock_default = AsyncMock(return_value=("openai/text-embedding-3-small", {"dimensions": 1536}))

    with patch.object(model_resolver, "_resolve_from_default_model_config", new=mock_default):
        await model_resolver._resolve("embedding")
        model_resolver.invalidate_cache(None)
        await model_resolver._resolve("embedding")

    assert mock_default.await_count == 2
