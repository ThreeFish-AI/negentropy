"""Memory API — Phase 4 端点鉴权防线单元测试

Review #4 — ``_require_self_or_admin`` 应当：
1. admin 角色可操作任意 user_id；
2. 普通用户只能操作自身 user_id；
3. 用户 id 缺失或为空时拒绝。

ISSUE-049 — admin 判断以 DB ``user_states`` 为权威而非 JWT roles，``_require_*``
现在为 async 协程；本文件以 ``pytest.mark.asyncio`` + ``monkeypatch`` 替换 DB 解析
helper 来覆盖两种 roles 来源（JWT 与 DB）的等价性。
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from negentropy.auth.service import AuthUser
from negentropy.engine import api as engine_api
from negentropy.engine.api import (
    _memory_entry_content_text,
    _memory_entry_relevance_score,
    _require_self_or_admin,
)


def _make_user(*, user_id: str, roles: list[str]) -> AuthUser:
    return AuthUser(
        user_id=user_id,
        email=None,
        name=None,
        picture=None,
        roles=roles,
        provider="test",
        subject=user_id,
        domain=None,
    )


@pytest.fixture(autouse=True)
def _stub_db_role_resolution(monkeypatch: pytest.MonkeyPatch) -> None:
    """单元测试默认让 DB 解析直接回传入参（即"DB 与 JWT roles 一致"）。

    具体测试若需验证 DB 覆盖逻辑，可在用例内部再 monkeypatch 出更具体的 stub。
    避免单元测试触发真实 DB 连接（pytest 环境 AsyncSessionLocal 未配置）。
    """

    async def _identity(user: AuthUser) -> AuthUser:
        return user

    monkeypatch.setattr(engine_api, "resolve_user_with_db_roles", _identity)


class TestRequireSelfOrAdmin:
    @pytest.mark.asyncio
    async def test_admin_can_target_any_user(self) -> None:
        admin = _make_user(user_id="alice", roles=["admin"])
        # 不应抛异常
        await _require_self_or_admin(admin, "bob")
        await _require_self_or_admin(admin, "alice")

    @pytest.mark.asyncio
    async def test_self_user_can_target_self(self) -> None:
        user = _make_user(user_id="alice", roles=["user"])
        await _require_self_or_admin(user, "alice")

    @pytest.mark.asyncio
    async def test_normal_user_cannot_target_other(self) -> None:
        user = _make_user(user_id="alice", roles=["user"])
        with pytest.raises(HTTPException) as exc_info:
            await _require_self_or_admin(user, "bob")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_empty_target_user_id_rejected(self) -> None:
        user = _make_user(user_id="alice", roles=["user"])
        with pytest.raises(HTTPException) as exc_info:
            await _require_self_or_admin(user, "")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_db_roles_promote_user_to_admin(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """ISSUE-049：JWT roles=["user"] 但 DB roles=["user", "admin"] → admin 通过。"""
        jwt_user = _make_user(user_id="alice", roles=["user"])

        async def _db_promote(user: AuthUser) -> AuthUser:
            return _make_user(user_id=user.user_id, roles=["user", "admin"])

        monkeypatch.setattr(engine_api, "resolve_user_with_db_roles", _db_promote)
        # admin 越权访问别人的 user_id，DB 提升后应当通过
        await _require_self_or_admin(jwt_user, "bob")


class TestMemoryEntryHelpers:
    def test_adk_memory_entry_content_and_score_are_metadata_backed(self) -> None:
        from google.adk.memory.base_memory_service import MemoryEntry

        entry = MemoryEntry(
            id="m1",
            content={"parts": [{"text": "hello"}, {"text": " world"}]},
            custom_metadata={"relevance_score": 0.42},
        )

        assert _memory_entry_content_text(entry) == "hello world"
        assert _memory_entry_relevance_score(entry) == 0.42
