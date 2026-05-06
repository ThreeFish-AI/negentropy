from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select

from negentropy.config import settings

from .service import AuthService, AuthUser
from .tokens import TokenError


def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    cookie_name = settings.auth.cookie_name
    if cookie_name in request.cookies:
        return request.cookies.get(cookie_name)
    return None


def get_current_user(request: Request) -> AuthUser:
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing auth token")
    try:
        return AuthService().decode_session(token)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def get_optional_user(request: Request) -> AuthUser | None:
    token = _extract_bearer_token(request)
    if not token:
        return None
    try:
        return AuthService().decode_session(token)
    except TokenError:
        return None


async def resolve_user_with_db_roles(user: AuthUser) -> AuthUser:
    """以 DB ``user_states`` 中持久化的 roles 覆盖 JWT 中的 roles。

    管理员把某个用户提升为 admin（PATCH /auth/users/{id}/roles）时，更新落在 DB
    ``UserState.state.roles``，而 JWT 仍是登录瞬间的快照（roles=["user"]）。若 admin
    端点直接用 ``get_current_user`` 解 JWT，会读到旧 roles 导致 403——前端 ``/auth/me``
    已通过 DB 覆盖把用户当作 admin 显示，前后端视图割裂（参见 ISSUE-049）。

    本函数承载该“DB 覆盖 JWT”规则的单一实现，供 admin 端点的依赖注入复用，
    避免每个 admin endpoint 自行查表 / 漏查导致权限漂移。

    DB 不可达 / UserState 不存在 / state.roles 缺失等所有失败路径**默认回退到 JWT roles**，
    保证：
    - ``dev-cookie`` 自签 token 注入（JWT roles=["admin"]）E2E 仍然有效；
    - DB 临时故障下不会把 admin 误降级为 user。
    """
    # 局部 import 避免顶层 import 触发 db.session 在测试 stub 中尚未配置时的副作用。
    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.pulse import UserState

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(UserState).where(
                    UserState.user_id == user.user_id,
                    UserState.app_name == settings.app_name,
                )
            )
            user_state = result.scalar_one_or_none()
    except Exception:  # pragma: no cover - 防御性回退：DB 不可用时保持 JWT roles
        return user

    if not user_state or not isinstance(user_state.state, dict):
        return user
    state_roles = user_state.state.get("roles")
    if not isinstance(state_roles, list):
        return user
    db_roles = [str(role) for role in state_roles]
    if db_roles == list(user.roles):
        return user
    return AuthUser(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        roles=db_roles,
        provider=user.provider,
        subject=user.subject,
        domain=user.domain,
    )


async def get_current_user_with_db_roles(
    user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    """FastAPI 依赖：返回 roles 已被 DB 覆盖的 AuthUser。

    所有 admin 端点应使用本依赖代替 ``get_current_user``；普通端点保持 JWT-only
    路径以避免每请求 DB 查询。
    """
    return await resolve_user_with_db_roles(user)


async def require_admin(
    user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    """FastAPI 依赖：admin 端点的统一入口。

    内部主动调用 ``resolve_user_with_db_roles`` 而不是依赖 ``Depends(get_current_user_with_db_roles)``，
    便于单元测试直接 ``await require_admin(jwt_user)`` 时仍能完整经过 DB 解析；
    在 FastAPI 路由中两种路径行为一致。
    """
    resolved = await resolve_user_with_db_roles(user)
    if "admin" not in resolved.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
    return resolved
