"""单元测试：model_resolver.resolve_llm_config_for_task 多级回退链。

覆盖：
    1. corpus_id 映射命中
    2. corpus_id 映射未命中 → 全局映射命中
    3. 两层都未命中 → 默认链路
    4. 缓存命中（同 key 二次调用应不再触发 lookup）
    5. invalidate_cache(prefix="task:") 后缓存失效
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from negentropy.config import model_resolver


@pytest.fixture(autouse=True)
def _clear_cache():
    """每个用例前后清空缓存，避免相互污染。"""
    model_resolver.invalidate_cache(None)
    yield
    model_resolver.invalidate_cache(None)


@pytest.mark.asyncio
async def test_resolve_for_task_corpus_hit():
    """corpus 级映射命中：应返回该模型，不再查全局。"""
    corpus_id = uuid4()
    target_id = uuid4()

    async def _lookup(task_key, corpus):
        if corpus == corpus_id:
            return target_id
        raise AssertionError("global lookup should not happen when corpus mapping hits")

    async def _resolve_row(_mt, _cid):
        return ("anthropic/claude-haiku", {"api_key": "anth-key"})

    with (
        patch.object(model_resolver, "_lookup_task_model_config_id", new=AsyncMock(side_effect=_lookup)),
        patch.object(model_resolver, "_resolve_from_model_config_row", new=AsyncMock(side_effect=_resolve_row)),
    ):
        name, kwargs = await model_resolver.resolve_llm_config_for_task(
            "consolidation.fact_extract", corpus_id=corpus_id
        )
    assert name == "anthropic/claude-haiku"


@pytest.mark.asyncio
async def test_resolve_for_task_global_hit_when_corpus_miss():
    """corpus 级未命中 → 落到全局映射。"""
    corpus_id = uuid4()
    global_target_id = uuid4()

    async def _lookup(_task_key, corpus):
        return global_target_id if corpus is None else None

    async def _resolve_row(_mt, cid):
        if cid == global_target_id:
            return ("openai/gpt-4o", {"api_key": "oa-key"})
        return None

    with (
        patch.object(model_resolver, "_lookup_task_model_config_id", new=AsyncMock(side_effect=_lookup)),
        patch.object(model_resolver, "_resolve_from_model_config_row", new=AsyncMock(side_effect=_resolve_row)),
    ):
        name, _ = await model_resolver.resolve_llm_config_for_task("consolidation.fact_extract", corpus_id=corpus_id)
    assert name == "openai/gpt-4o"


@pytest.mark.asyncio
async def test_resolve_for_task_falls_back_to_default():
    """corpus + 全局都未命中 → 走默认 resolve_llm_config。"""

    async def _lookup(_task_key, _corpus):
        return None

    with (
        patch.object(model_resolver, "_lookup_task_model_config_id", new=AsyncMock(side_effect=_lookup)),
        patch.object(
            model_resolver,
            "resolve_llm_config",
            new=AsyncMock(return_value=("gemini/gemini-2.5-flash", {"api_key": "ge-key"})),
        ),
    ):
        name, _ = await model_resolver.resolve_llm_config_for_task("session.title")
    assert name == "gemini/gemini-2.5-flash"


@pytest.mark.asyncio
async def test_resolve_for_task_uses_cache_second_time():
    """同样的 (task, corpus) 第二次调用应命中缓存，不再走 lookup。"""
    corpus_id = uuid4()
    target_id = uuid4()
    lookup_mock = AsyncMock(side_effect=lambda _t, c: target_id if c == corpus_id else None)

    async def _resolve_row(_mt, _cid):
        return ("anthropic/claude-haiku", {"api_key": "k"})

    with (
        patch.object(model_resolver, "_lookup_task_model_config_id", lookup_mock),
        patch.object(model_resolver, "_resolve_from_model_config_row", new=AsyncMock(side_effect=_resolve_row)),
    ):
        await model_resolver.resolve_llm_config_for_task("consolidation.fact_extract", corpus_id=corpus_id)
        await model_resolver.resolve_llm_config_for_task("consolidation.fact_extract", corpus_id=corpus_id)

    # 只调用了一次 lookup（第二次命中缓存）
    assert lookup_mock.await_count == 1


@pytest.mark.asyncio
async def test_invalidate_cache_clears_task_namespace():
    """invalidate_cache(prefix="task:") 后下一次解析应重新查询。"""
    corpus_id = uuid4()
    target_id = uuid4()
    lookup_mock = AsyncMock(side_effect=lambda _t, c: target_id if c == corpus_id else None)

    async def _resolve_row(_mt, _cid):
        return ("anthropic/claude-haiku", {"api_key": "k"})

    with (
        patch.object(model_resolver, "_lookup_task_model_config_id", lookup_mock),
        patch.object(model_resolver, "_resolve_from_model_config_row", new=AsyncMock(side_effect=_resolve_row)),
    ):
        await model_resolver.resolve_llm_config_for_task("consolidation.fact_extract", corpus_id=corpus_id)
        model_resolver.invalidate_cache(prefix="task:")
        await model_resolver.resolve_llm_config_for_task("consolidation.fact_extract", corpus_id=corpus_id)

    assert lookup_mock.await_count == 2
