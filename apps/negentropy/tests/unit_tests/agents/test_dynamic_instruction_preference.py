"""单测：``make_instruction_provider`` 注入 ``preferred_subagent`` prefix。

业务背景：Home Composer 通过 ``@Agent`` 选中某 SubAgent 后，前端将其 ``name`` 经
``forwardedProps.preferred_subagent`` → BFF ``state_delta`` → ADK session.state
透传到根 Agent 的 ``ReadonlyContext``。本测试覆盖：

- 命中 → instruction 头部 prepend「用户偏好」段落（Agent 名嵌入正文）；
- 未命中 / 非法 / 异常 → 返回原始 instruction，永不破坏 fallback；
- DB 解析异常 → 走 fallback 仍能注入 prefix。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.agents._dynamic_instruction import make_instruction_provider

_FALLBACK = "FALLBACK_INSTRUCTION_BODY"


def _ctx_with_state(state: dict | None) -> MagicMock:
    ctx = MagicMock()
    ctx.state = state
    return ctx


# ----------------------------------------------------------------------------
# 命中：注入 prefix
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_preferred_subagent_prepends_prefix_when_db_returns_text():
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_INSTRUCTION_BODY"),
    ):
        result = await provider(_ctx_with_state({"preferred_subagent": "PerceptionFaculty"}))

    assert result.startswith("## 用户偏好")
    assert "`PerceptionFaculty`" in result
    assert 'agent_name="PerceptionFaculty"' in result
    # 正文不丢
    assert result.endswith("DB_INSTRUCTION_BODY")


@pytest.mark.asyncio
async def test_preferred_subagent_prepends_prefix_on_fallback_path():
    """DB 解析失败 → fallback；prefix 仍然注入（用户偏好高于 instruction 来源）。"""
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(side_effect=RuntimeError("db down")),
    ):
        result = await provider(_ctx_with_state({"preferred_subagent": "ActionFaculty"}))

    assert result.startswith("## 用户偏好")
    assert "`ActionFaculty`" in result
    assert result.endswith(_FALLBACK)


@pytest.mark.asyncio
async def test_preferred_subagent_prepends_prefix_when_db_returns_empty():
    """DB 返回空串 → 走 fallback；prefix 注入。"""
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value=""),
    ):
        result = await provider(_ctx_with_state({"preferred_subagent": "InfluenceFaculty"}))

    assert result.startswith("## 用户偏好")
    assert result.endswith(_FALLBACK)


# ----------------------------------------------------------------------------
# 未命中：保持原 instruction
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_preferred_subagent_returns_instruction_as_is():
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_BODY"),
    ):
        result = await provider(_ctx_with_state({}))

    assert result == "DB_BODY"
    assert "用户偏好" not in result


@pytest.mark.asyncio
async def test_state_is_none_returns_instruction_as_is():
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value=None),
    ):
        result = await provider(_ctx_with_state(None))

    assert result == _FALLBACK
    assert "用户偏好" not in result


# ----------------------------------------------------------------------------
# 非法字符 / 异常类型：防御性忽略
# ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "preferred",
    [
        "",  # 空串
        "  ",  # 仅空白
        "PerceptionFaculty; DROP TABLE users",  # SQL 注入风格
        "Perception Faculty",  # 含空格
        "@PerceptionFaculty",  # 含 @
        "../../etc/passwd",  # 路径穿越风格
        "<script>alert(1)</script>",
        "数据采集系部",  # 非 ASCII（当前正则只允许 ASCII 标识符；按设计拒绝）
        "X" * 200,  # 超长（>128）
        123,  # 非字符串
        ["PerceptionFaculty"],  # 非字符串
        None,  # None
    ],
)
@pytest.mark.asyncio
async def test_invalid_preferred_subagent_ignored(preferred):
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_BODY"),
    ):
        result = await provider(_ctx_with_state({"preferred_subagent": preferred}))

    assert result == "DB_BODY"
    assert "用户偏好" not in result


@pytest.mark.asyncio
async def test_state_get_raises_does_not_break_provider():
    """state.get 抛异常 → 仍能返回 instruction（fail-soft）。"""
    bad_state = MagicMock()
    bad_state.get = MagicMock(side_effect=RuntimeError("bad state"))
    ctx = MagicMock()
    ctx.state = bad_state

    provider = make_instruction_provider("NegentropyEngine", _FALLBACK)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_BODY"),
    ):
        result = await provider(ctx)

    assert result == "DB_BODY"
