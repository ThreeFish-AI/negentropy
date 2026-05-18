"""Integration 测试：``permissions.get_visible_plugin_ids`` 在真实 PG 上的并集语义。

动机：
    迁移 0031 将 ``builtin_tools.visibility`` 误建为 ``VARCHAR(20)``，而 ORM 把
    该字段映射为 ``Enum(PluginVisibility, schema="negentropy")``，导致 SQLAlchemy
    生成的 ``WHERE visibility = $N::negentropy.pluginvisibility`` 在 VARCHAR 列上
    报 ``UndefinedFunctionError``，``GET /interface/tools`` / ``GET /interface/stats``
    500（见 docs/agents/issue.md ISSUE-089，与 ISSUE-012 同源）。

本测试用真实 PG round-trip 守护：
    1. 4 类 plugin（builtin_tool / mcp_server / skill / sub_agent）的 visibility
       列类型与 ORM 声明一致，``= PluginVisibility.PUBLIC`` 查询不报错；
    2. 并集语义：own + PUBLIC + 授权（PluginPermission） + is_system 全部纳入；
       其他用户的 PRIVATE 行不可见。

下次任何 plugin 表的 visibility 漂移（ORM Enum vs 迁移 VARCHAR）会被本测试立即捕获。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from uuid import uuid4

import pytest
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.auth.service import AuthUser
from negentropy.interface.permissions import get_visible_plugin_ids
from negentropy.models.plugin import (
    BuiltinTool,
    McpServer,
    PluginPermission,
    PluginPermissionType,
    PluginVisibility,
    Skill,
    SubAgent,
)


def _make_user(user_id: str, *, admin: bool = False) -> AuthUser:
    return AuthUser(
        user_id=user_id,
        email=None,
        name=None,
        picture=None,
        roles=["admin"] if admin else ["user"],
        provider="test",
        subject=user_id,
        domain=None,
    )


@dataclass(frozen=True)
class _PluginCase:
    """4 类 plugin 的最小可插入工厂 + 表 unique name 命名空间。"""

    plugin_type: str
    model: type
    factory: Callable[..., object]


def _builtin_tool_factory(
    *, owner_id: str, visibility: PluginVisibility, name: str, is_system: bool = False
) -> BuiltinTool:
    return BuiltinTool(
        owner_id=owner_id,
        visibility=visibility,
        name=name,
        tool_type="search",
        is_system=is_system,
    )


def _mcp_server_factory(
    *, owner_id: str, visibility: PluginVisibility, name: str, is_system: bool = False
) -> McpServer:
    return McpServer(
        owner_id=owner_id,
        visibility=visibility,
        name=name,
        transport_type="stdio",
        is_system=is_system,
    )


def _skill_factory(*, owner_id: str, visibility: PluginVisibility, name: str, is_system: bool = False) -> Skill:
    return Skill(
        owner_id=owner_id,
        visibility=visibility,
        name=name,
        is_system=is_system,
    )


def _sub_agent_factory(*, owner_id: str, visibility: PluginVisibility, name: str, is_system: bool = False) -> SubAgent:
    return SubAgent(
        owner_id=owner_id,
        visibility=visibility,
        name=name,
        agent_type="llm_agent",
        is_system=is_system,
    )


PLUGIN_CASES: list[_PluginCase] = [
    _PluginCase("builtin_tool", BuiltinTool, _builtin_tool_factory),
    _PluginCase("mcp_server", McpServer, _mcp_server_factory),
    _PluginCase("skill", Skill, _skill_factory),
    _PluginCase("sub_agent", SubAgent, _sub_agent_factory),
]


@pytest.fixture
def alice() -> AuthUser:
    return _make_user(f"test-alice-{uuid4().hex[:8]}")


@pytest.fixture
def bob() -> AuthUser:
    return _make_user(f"test-bob-{uuid4().hex[:8]}")


@pytest.mark.parametrize("case", PLUGIN_CASES, ids=lambda c: c.plugin_type)
@pytest.mark.asyncio
async def test_get_visible_plugin_ids_union_semantics(
    case: _PluginCase,
    alice: AuthUser,
    bob: AuthUser,
) -> None:
    """4 类 plugin 的可见性并集语义在真实 PG 上一致：own + PUBLIC + 授权 + is_system。

    本测试覆盖的核心回归路径：
        - ``WHERE visibility = $N::negentropy.pluginvisibility`` 必须能在真实 PG
          上 round-trip（防止再次出现 VARCHAR vs ENUM 漂移）；
        - PUBLIC / SHARED / PRIVATE 与 ``is_system`` / ``PluginPermission`` 的并集
          行为符合 ``permissions.get_visible_plugin_ids`` 文档约定。
    """
    ns = uuid4().hex[:8]  # 用 name 唯一前缀避开同表 UNIQUE(name)

    own_private = case.factory(
        owner_id=alice.user_id, visibility=PluginVisibility.PRIVATE, name=f"{case.plugin_type}-own-private-{ns}"
    )
    own_public = case.factory(
        owner_id=alice.user_id, visibility=PluginVisibility.PUBLIC, name=f"{case.plugin_type}-own-public-{ns}"
    )
    other_private = case.factory(
        owner_id=bob.user_id, visibility=PluginVisibility.PRIVATE, name=f"{case.plugin_type}-other-private-{ns}"
    )
    other_public = case.factory(
        owner_id=bob.user_id, visibility=PluginVisibility.PUBLIC, name=f"{case.plugin_type}-other-public-{ns}"
    )
    other_shared_with_alice = case.factory(
        owner_id=bob.user_id, visibility=PluginVisibility.SHARED, name=f"{case.plugin_type}-other-shared-{ns}"
    )
    system_row = case.factory(
        owner_id="system",
        # 与 is_system 维度正交：即便 PRIVATE，is_system=True 也对全员可见。
        visibility=PluginVisibility.PRIVATE,
        name=f"{case.plugin_type}-system-{ns}",
        is_system=True,
    )

    rows: list[object] = [own_private, own_public, other_private, other_public, other_shared_with_alice, system_row]
    row_ids: list = []
    perm_id = None

    try:
        async with db_session.AsyncSessionLocal() as db:
            db.add_all(rows)
            await db.commit()
            for r in rows:
                await db.refresh(r)
            row_ids = [r.id for r in rows]  # type: ignore[attr-defined]

        async with db_session.AsyncSessionLocal() as db:
            perm = PluginPermission(
                plugin_type=case.plugin_type,
                plugin_id=other_shared_with_alice.id,  # type: ignore[attr-defined]
                user_id=alice.user_id,
                permission=PluginPermissionType.VIEW,
            )
            db.add(perm)
            await db.commit()
            await db.refresh(perm)
            perm_id = perm.id

        async with db_session.AsyncSessionLocal() as db:
            visible = await get_visible_plugin_ids(db, case.plugin_type, alice)

        visible_set = set(visible)
        assert own_private.id in visible_set, "owner_id 自有 PRIVATE 应可见"  # type: ignore[attr-defined]
        assert own_public.id in visible_set, "owner_id 自有 PUBLIC 应可见"  # type: ignore[attr-defined]
        assert other_public.id in visible_set, "他人 PUBLIC 应可见"  # type: ignore[attr-defined]
        assert other_shared_with_alice.id in visible_set, "他人 SHARED + PluginPermission 授权应可见"  # type: ignore[attr-defined]
        assert system_row.id in visible_set, "is_system=True 对全员可见"  # type: ignore[attr-defined]
        assert other_private.id not in visible_set, "他人 PRIVATE 不应可见"  # type: ignore[attr-defined]

    finally:
        async with db_session.AsyncSessionLocal() as db:
            if perm_id is not None:
                await db.execute(delete(PluginPermission).where(PluginPermission.id == perm_id))
            if row_ids:
                await db.execute(delete(case.model).where(case.model.id.in_(row_ids)))
            await db.commit()


@pytest.mark.asyncio
async def test_get_visible_plugin_ids_builtin_tool_public_query_does_not_raise() -> None:
    """ISSUE-089 直接回归测试：``builtin_tool`` 的 PUBLIC 子查询不再触发
    ``UndefinedFunctionError: operator does not exist: character varying = negentropy.pluginvisibility``。

    只要 0036 迁移已应用、ORM 与 DB 列类型一致，本调用即可顺利完成 round-trip
    （即便无任何匹配行也不应抛 ProgrammingError）。
    """
    alice = _make_user(f"test-alice-{uuid4().hex[:8]}")
    async with db_session.AsyncSessionLocal() as db:
        ids = await get_visible_plugin_ids(db, "builtin_tool", alice)
    assert isinstance(ids, list)
