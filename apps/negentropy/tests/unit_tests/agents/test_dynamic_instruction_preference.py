"""单测：``make_instruction_provider`` 注入 ``preferred_agent`` prefix。

业务背景：Home Composer 通过 ``@Agent`` 选中某 Agent 后，前端将其 ``name`` 经
``forwardedProps.preferred_agent`` → BFF ``state_delta`` → ADK session.state
透传到根 Agent 的 ``ReadonlyContext``。本测试覆盖：

- ``is_root=True`` + 命中 → instruction 头部 prepend「用户偏好」段落（Agent 名嵌入正文）；
- ``is_root=False``（默认；faculty 共用 provider）→ 永不注入，避免自指令/跨派系污染；
- 未命中 / 非法 / 异常 → 返回原始 instruction，永不破坏 fallback；
- DB 解析异常 → 走 fallback 仍能注入 prefix（仅 root 路径）。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.agents._dynamic_instruction import make_instruction_provider

_FALLBACK = "FALLBACK_INSTRUCTION_BODY"


@pytest.fixture(autouse=True)
def _neutralize_global_skills_injection():
    """隔离全局技能注入：本文件专测「偏好 prefix + fallback 选择」逻辑，与全局技能注入正交。

    ``make_instruction_provider`` 在 DB 未命中（``text is None``）分支会调用
    ``skills_injector.append_global_skills_block`` 注入全局技能块——该路径依赖真实 DB
    且受种子技能（迁移 0064 的 ``pdf-fidelity-restore``）影响，会向 fallback 追加
    ``<available_skills>`` 块，破坏本文件对 ``== _FALLBACK`` / ``endswith(_FALLBACK)``
    的断言。全局注入有独立单测 ``test_skills_injector.py`` 覆盖，故此处以 async 透传桩
    中和该并发关注点（``_dynamic_instruction`` 内为函数级 import，须 patch 源模块属性）。
    """
    with patch(
        "negentropy.agents.skills_injector.append_global_skills_block",
        new=AsyncMock(side_effect=lambda base: base),
    ):
        yield


def _ctx_with_state(state: dict | None) -> MagicMock:
    ctx = MagicMock()
    ctx.state = state
    return ctx


# ----------------------------------------------------------------------------
# 命中：仅 is_root=True 时注入 prefix
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_preferred_agent_prepends_prefix_when_db_returns_text():
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_INSTRUCTION_BODY"),
    ):
        result = await provider(_ctx_with_state({"preferred_agent": "PerceptionFaculty"}))

    assert result.startswith("## 用户偏好")
    assert "`PerceptionFaculty`" in result
    assert 'agent_name="PerceptionFaculty"' in result
    # 正文不丢
    assert result.endswith("DB_INSTRUCTION_BODY")


@pytest.mark.asyncio
async def test_legacy_preferred_subagent_key_still_honored():
    """向后兼容：迁移前已写入 ``preferred_subagent`` 的会话仍应被识别。

    后端 reader 采用双键读取（``preferred_agent`` 优先、``preferred_subagent`` 回退），
    使现存持久化会话零迁移、零丢失。"""
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_INSTRUCTION_BODY"),
    ):
        result = await provider(_ctx_with_state({"preferred_subagent": "PerceptionFaculty"}))

    assert result.startswith("## 用户偏好")
    assert "`PerceptionFaculty`" in result
    assert result.endswith("DB_INSTRUCTION_BODY")


@pytest.mark.asyncio
async def test_preferred_agent_takes_precedence_over_legacy_key():
    """双键并存时新键 ``preferred_agent`` 优先于历史键 ``preferred_subagent``。"""
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_BODY"),
    ):
        result = await provider(
            _ctx_with_state({"preferred_agent": "ActionFaculty", "preferred_subagent": "PerceptionFaculty"})
        )

    assert "`ActionFaculty`" in result
    assert "PerceptionFaculty" not in result


@pytest.mark.asyncio
async def test_preferred_agent_prepends_prefix_on_fallback_path():
    """DB 解析失败 → fallback；prefix 仍然注入（用户偏好高于 instruction 来源）。"""
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(side_effect=RuntimeError("db down")),
    ):
        result = await provider(_ctx_with_state({"preferred_agent": "ActionFaculty"}))

    assert result.startswith("## 用户偏好")
    assert "`ActionFaculty`" in result
    assert result.endswith(_FALLBACK)


@pytest.mark.asyncio
async def test_preferred_agent_prepends_prefix_when_db_returns_empty():
    """DB 返回空串 → 走 fallback；prefix 注入。"""
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value=""),
    ):
        result = await provider(_ctx_with_state({"preferred_agent": "InfluenceFaculty"}))

    assert result.startswith("## 用户偏好")
    assert result.endswith(_FALLBACK)


# ----------------------------------------------------------------------------
# 非 root：永不注入 prefix（防止 faculty 共用 provider 被污染）
# ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "agent_name",
    [
        "PerceptionFaculty",
        "ActionFaculty",
        "ContemplationFaculty",
        "InternalizationFaculty",
        "InfluenceFaculty",
    ],
)
@pytest.mark.asyncio
async def test_non_root_faculty_never_injects_prefix(agent_name):
    """faculty 共用同一 provider 工厂；is_root 默认为 False，``preferred_agent``
    即使在 state 命中也不应污染 faculty instruction，避免：
    - 自指令（faculty 自己被命中 → ``transfer_to_agent(self)`` 死循环风险）；
    - 跨派系委派提示（其它 faculty 读到要求委派给另一 faculty 的指令）。
    """
    provider = make_instruction_provider(agent_name, _FALLBACK)  # is_root 默认 False
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value=f"{agent_name}_DB_BODY"),
    ):
        result = await provider(_ctx_with_state({"preferred_agent": "PerceptionFaculty"}))

    assert result == f"{agent_name}_DB_BODY"
    assert "用户偏好" not in result


@pytest.mark.asyncio
async def test_is_root_false_explicit_skips_prefix_even_with_root_name():
    """显式 ``is_root=False``，即便 ``agent_name`` 是 root 名也不注入。
    确保参数语义可控（不会因 agent_name 巧合命中而隐式启用偏好）。"""
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=False)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="ROOT_DB_BODY"),
    ):
        result = await provider(_ctx_with_state({"preferred_agent": "ActionFaculty"}))

    assert result == "ROOT_DB_BODY"
    assert "用户偏好" not in result


# ----------------------------------------------------------------------------
# 未命中：保持原 instruction
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_preferred_agent_returns_instruction_as_is():
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_BODY"),
    ):
        result = await provider(_ctx_with_state({}))

    assert result == "DB_BODY"
    assert "用户偏好" not in result


@pytest.mark.asyncio
async def test_state_is_none_returns_instruction_as_is():
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
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
async def test_invalid_preferred_agent_ignored(preferred):
    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_BODY"),
    ):
        result = await provider(_ctx_with_state({"preferred_agent": preferred}))

    assert result == "DB_BODY"
    assert "用户偏好" not in result


@pytest.mark.asyncio
async def test_state_get_raises_does_not_break_provider():
    """state.get 抛异常 → 仍能返回 instruction（fail-soft）。"""
    bad_state = MagicMock()
    bad_state.get = MagicMock(side_effect=RuntimeError("bad state"))
    ctx = MagicMock()
    ctx.state = bad_state

    provider = make_instruction_provider("NegentropyEngine", _FALLBACK, is_root=True)
    with patch(
        "negentropy.agents._dynamic_instruction.resolve_subagent_instruction",
        new=AsyncMock(return_value="DB_BODY"),
    ):
        result = await provider(ctx)

    assert result == "DB_BODY"
