"""Memory API — Phase 4 端点鉴权防线单元测试

Review #4 — ``_require_self_or_admin`` 应当：
1. admin 角色可操作任意 user_id；
2. 普通用户只能操作自身 user_id；
3. 用户 id 缺失或为空时拒绝。
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from negentropy.auth.service import AuthUser
from negentropy.engine.api import _require_self_or_admin


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


class TestRequireSelfOrAdmin:
    def test_admin_can_target_any_user(self) -> None:
        admin = _make_user(user_id="alice", roles=["admin"])
        # 不应抛异常
        _require_self_or_admin(admin, "bob")
        _require_self_or_admin(admin, "alice")

    def test_self_user_can_target_self(self) -> None:
        user = _make_user(user_id="alice", roles=["user"])
        _require_self_or_admin(user, "alice")

    def test_normal_user_cannot_target_other(self) -> None:
        user = _make_user(user_id="alice", roles=["user"])
        with pytest.raises(HTTPException) as exc_info:
            _require_self_or_admin(user, "bob")
        assert exc_info.value.status_code == 403

    def test_empty_target_user_id_rejected(self) -> None:
        user = _make_user(user_id="alice", roles=["user"])
        with pytest.raises(HTTPException) as exc_info:
            _require_self_or_admin(user, "")
        assert exc_info.value.status_code == 403
