from __future__ import annotations

import json
import re
from typing import Optional

from fastapi import status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from negentropy.config import settings
from negentropy.config.auth import AuthMode

from .service import AuthService
from .tokens import TokenError

_USER_PATH_PATTERN = re.compile(r"/users/(?P<user_id>[^/]+)")


def _extract_user_id(request: Request, body: Optional[bytes]) -> Optional[str]:
    header_user = request.headers.get("x-user-id")
    if header_user:
        return header_user

    query_user = request.query_params.get("user_id")
    if query_user:
        return query_user

    match = _USER_PATH_PATTERN.search(request.url.path)
    if match:
        return match.group("user_id")

    if body and "application/json" in (request.headers.get("content-type") or ""):
        try:
            payload = json.loads(body)
            if isinstance(payload, dict):
                user_id = payload.get("user_id")
                if isinstance(user_id, str):
                    return user_id
        except json.JSONDecodeError:
            return None
    return None


def _extract_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    cookie_name = settings.auth.cookie_name
    return request.cookies.get(cookie_name)


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._service = AuthService()
        self._settings = settings.auth
        self._allowlist = ("/auth", "/health", "/docs", "/openapi.json")

    async def dispatch(self, request: Request, call_next):
        if not self._settings.enabled or self._settings.mode == AuthMode.OFF:
            return await call_next(request)

        if request.url.path.startswith(self._allowlist):
            return await call_next(request)

        token = _extract_token(request)
        if not token:
            if self._settings.mode == AuthMode.STRICT:
                return JSONResponse({"error": "missing auth token"}, status_code=status.HTTP_401_UNAUTHORIZED)
            return await call_next(request)

        body = await request.body()
        request._body = body  # reuse by downstream handlers

        try:
            user = self._service.decode_session(token)
        except TokenError:
            if self._settings.mode == AuthMode.STRICT:
                return JSONResponse({"error": "invalid auth token"}, status_code=status.HTTP_401_UNAUTHORIZED)
            return await call_next(request)

        request.state.user = user

        user_id = _extract_user_id(request, body)
        if user_id and user_id != user.user_id:
            # Allow admins to access other users' data
            is_admin = user.roles and "admin" in user.roles
            if not is_admin:
                return JSONResponse({"error": "user_id mismatch"}, status_code=status.HTTP_403_FORBIDDEN)

        return await call_next(request)
