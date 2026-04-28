"""SessionSummarizer 单测：验证异步工厂走 DB 凭证、不再回退到无 api_key 的硬编码默认。"""

from unittest.mock import AsyncMock, patch

import pytest

from negentropy.engine.summarization import SessionSummarizer


@pytest.mark.asyncio
async def test_create_uses_resolve_llm_config_with_max_tokens():
    """create() 必须 await resolve_llm_config() 拿到完整凭证（含 api_key），并把 max_tokens 注入 LiteLlm。"""
    resolved = (
        "openai/gpt-5-mini",
        {"temperature": 0.7, "drop_params": True, "api_key": "sk-resolved-from-db"},
    )

    with patch(
        "negentropy.config.model_resolver.resolve_llm_config",
        new=AsyncMock(return_value=resolved),
    ) as mock_resolve:
        summarizer = await SessionSummarizer.create()

    mock_resolve.assert_awaited_once_with()
    assert summarizer.model is not None
    assert summarizer.model.model == "openai/gpt-5-mini"
    # LiteLlm 把额外 kwargs 落到 _additional_args；max_tokens=20 是 title 生成的硬约束。
    assert summarizer.model._additional_args.get("max_tokens") == 20
    assert summarizer.model._additional_args.get("api_key") == "sk-resolved-from-db"


@pytest.mark.asyncio
async def test_create_does_not_mutate_resolver_kwargs():
    """create() 修改 max_tokens 不应污染 resolver 返回的 kwargs（防止 60s 缓存被污染）。"""
    shared_kwargs: dict = {"temperature": 0.7, "drop_params": True, "api_key": "sk-x"}
    resolved = ("openai/gpt-5-mini", shared_kwargs)

    with patch(
        "negentropy.config.model_resolver.resolve_llm_config",
        new=AsyncMock(return_value=resolved),
    ):
        await SessionSummarizer.create()

    # SessionSummarizer.create() 内部对 resolver 返回的 kwargs 做防御性浅拷贝，
    # 不会把 max_tokens 注入回外部传入的 dict（即使 resolver 未来不再 copy）。
    assert "max_tokens" not in shared_kwargs


def test_init_accepts_prebuilt_model_instance():
    """同步 __init__ 仅接受已构造好的 LiteLlm，不再做凭证解析。"""

    class _DummyModel:
        pass

    dummy = _DummyModel()
    summarizer = SessionSummarizer(dummy)  # type: ignore[arg-type]
    assert summarizer.model is dummy
