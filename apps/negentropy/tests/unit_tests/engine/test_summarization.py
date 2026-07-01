"""SessionSummarizer 单测：验证异步工厂走 DB 凭证、不再回退到无 api_key 的硬编码默认。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from google.genai import types

from negentropy.engine.summarization import (
    _TITLE_MAX_TOKENS,
    SessionSummarizer,
    is_semantically_vacant_title,
)


@pytest.mark.asyncio
async def test_create_uses_resolve_llm_config_with_max_tokens():
    """create() 必须 await resolve_llm_config() 拿到完整凭证（含 api_key），并把
    max_tokens 与 reasoning_effort 注入 LiteLlm。

    reasoning_effort='minimal' 是 gpt-5 / o1 / o3 / o4 模型族的关键修复：不显式降低
    推理预算时，``max_tokens`` 会被内部 reasoning tokens 吃光，导致空响应。
    """
    resolved = (
        "openai/gpt-5-mini",
        {"temperature": 0.7, "drop_params": True, "api_key": "sk-resolved-from-db"},
    )

    with patch(
        "negentropy.config.model_resolver.resolve_llm_config_for_task",
        new=AsyncMock(return_value=resolved),
    ) as mock_resolve:
        summarizer = await SessionSummarizer.create()

    mock_resolve.assert_awaited_once_with("session.title")
    assert summarizer.model is not None
    assert summarizer.model.model == "openai/gpt-5-mini"
    # LiteLlm 把额外 kwargs 落到 _additional_args；title 生成的硬约束由 _TITLE_MAX_TOKENS 提供。
    assert summarizer.model._additional_args.get("max_tokens") == _TITLE_MAX_TOKENS
    assert summarizer.model._additional_args.get("api_key") == "sk-resolved-from-db"
    # 关键：gpt-5 系模型必须强制 reasoning_effort=minimal，避免响应空内容
    assert summarizer.model._additional_args.get("reasoning_effort") == "minimal"


@pytest.mark.asyncio
async def test_create_disables_thinking_for_anthropic_models():
    """Anthropic 模型族走 thinking={"type":"disabled"} 路径——同源问题但参数协议不同。"""
    resolved = (
        "anthropic/claude-sonnet-4-6",
        {"temperature": 0.7, "drop_params": True, "api_key": "sk-resolved-from-db"},
    )

    with patch(
        "negentropy.config.model_resolver.resolve_llm_config_for_task",
        new=AsyncMock(return_value=resolved),
    ):
        summarizer = await SessionSummarizer.create()

    assert summarizer.model._additional_args.get("thinking") == {"type": "disabled"}
    assert "reasoning_effort" not in summarizer.model._additional_args


@pytest.mark.asyncio
async def test_create_leaves_non_reasoning_model_kwargs_clean():
    """对不支持 reasoning 的模型（如 openai/gpt-4o-mini），不注入 reasoning_effort/thinking。"""
    resolved = (
        "openai/gpt-4o-mini",
        {"temperature": 0.7, "drop_params": True, "api_key": "sk-resolved-from-db"},
    )

    with patch(
        "negentropy.config.model_resolver.resolve_llm_config_for_task",
        new=AsyncMock(return_value=resolved),
    ):
        summarizer = await SessionSummarizer.create()

    assert "reasoning_effort" not in summarizer.model._additional_args
    assert "thinking" not in summarizer.model._additional_args


@pytest.mark.asyncio
async def test_create_does_not_mutate_resolver_kwargs():
    """create() 修改 max_tokens 不应污染 resolver 返回的 kwargs（防止 60s 缓存被污染）。"""
    shared_kwargs: dict = {"temperature": 0.7, "drop_params": True, "api_key": "sk-x"}
    resolved = ("openai/gpt-5-mini", shared_kwargs)

    with patch(
        "negentropy.config.model_resolver.resolve_llm_config_for_task",
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


# ---------------------------------------------------------------------------
# 质量门禁 is_semantically_vacant_title —— 标题质量 SoT 的表驱动验证
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("title", "expected_vacant"),
    [
        # 生产观察到的坏标题（截图实证）
        ("首次标题", True),
        ("标题 v2", True),
        ("标题v3", True),
        ("会话标题自动生成", True),
        ("标题自动生成", True),
        ("无标题", True),
        ("新对话", True),
        ("新会话", True),
        ("未命名", True),
        ("未命名会话", True),
        ("对话总结", True),
        ("摘要", True),
        # 英文元描述
        ("Title", True),
        ("Session Title", True),
        ("Session", True),
        ("Summary", True),
        ("Conversation", True),
        ("Untitled", True),
        ("New chat", True),
        # 复述指令
        ("会话标题自动生成器", True),
        # 边界
        ("", True),
        ("   ", True),
        ("ab", True),
        # 正常标题（不应误伤）
        ("AfterShip Q3 财报查询", False),
        ("Next.js OAuth2 setup", False),
        ("中译英翻译请求", False),
        ("项目进度同步", False),
        # 含元词但有实体（回归保护：去元词后实质 >=3 即放行）
        ("用户画像摘要", False),
        ("会话功能设计", False),
        ("标题渲染 bug 修复", False),
        ("新闻聚合器", False),
    ],
)
def test_is_semantically_vacant_title(title, expected_vacant):
    assert is_semantically_vacant_title(title) is expected_vacant


class _StubModel:
    """桩模型：``generate_content_async`` 产出单条固定文本响应，绕过真实 LLM。"""

    def __init__(self, text: str) -> None:
        self._text = text

    async def generate_content_async(self, request):  # noqa: ANN001
        yield SimpleNamespace(content=SimpleNamespace(parts=[SimpleNamespace(text=self._text, thought=False)]))


def _user_content(text: str) -> types.Content:
    return types.Content(role="user", parts=[types.Part(text=text)])


@pytest.mark.asyncio
async def test_generate_title_rejects_vacant_llm_output():
    """LLM 返回元描述性标题（如「会话标题自动生成」）时，质量门禁应拒绝、回退 None。"""
    summarizer = SessionSummarizer(_StubModel("会话标题自动生成"))
    title = await summarizer.generate_title([_user_content("帮我查 AfterShip 财报")])
    assert title is None


@pytest.mark.asyncio
async def test_generate_title_accepts_semantic_llm_output():
    """LLM 返回有实体语义的标题时正常通过门禁。"""
    summarizer = SessionSummarizer(_StubModel("AfterShip Q3 财报查询"))
    title = await summarizer.generate_title([_user_content("帮我查 AfterShip 财报")])
    assert title == "AfterShip Q3 财报查询"
