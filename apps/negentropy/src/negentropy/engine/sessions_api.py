"""
Session API Router

提供 Session 标题的轻量更新能力，与 ADK 原生 Session CRUD 解耦。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from negentropy.engine.factories.session import get_session_service
from negentropy.logging import get_logger

router = APIRouter(tags=["sessions"])
logger = get_logger("negentropy.engine.sessions_api")


class SessionTitleUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=100)


class ApprovalRespondRequest(BaseModel):
    action_id: str = Field(..., min_length=1)
    decision: str = Field(..., pattern="^(approved|denied)$")
    reason: str | None = Field(default=None, max_length=500)


class SessionArchiveResponse(BaseModel):
    status: str = "ok"
    archived: bool


@router.patch("/apps/{app_name}/users/{user_id}/sessions/{session_id}/title")
async def update_session_title(
    app_name: str,
    user_id: str,
    session_id: str,
    req: SessionTitleUpdateRequest,
):
    service = get_session_service()
    title = req.title.strip() if req.title else None
    if hasattr(service, "update_session_title"):
        try:
            updated = await service.update_session_title(
                app_name=app_name,
                user_id=user_id,
                session_id=session_id,
                title=title,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    else:
        # 兼容不支持 metadata_ 的后端：回退到 state_delta 写入 metadata
        session = await service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        try:
            from google.adk.events.event import Event, EventActions
        except Exception as exc:
            logger.warning("Failed to import ADK Event for title update fallback: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Session backend does not support title update",
            ) from exc

        state_delta = {"metadata": {"title": title}} if title else {"metadata": {}}
        state_update_event = Event(
            invocation_id="p-" + str(uuid.uuid4()),
            author="user",
            actions=EventActions(state_delta=state_delta),
        )
        await service.append_event(session=session, event=state_update_event)

    return {"status": "ok", "title": title}


async def _update_archive_state(
    *,
    app_name: str,
    user_id: str,
    session_id: str,
    archived: bool,
) -> SessionArchiveResponse:
    service = get_session_service()
    if not hasattr(service, "archive_session"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session backend does not support archive",
        )

    try:
        updated = await service.archive_session(
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            archived=archived,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    return SessionArchiveResponse(archived=archived)


@router.post("/apps/{app_name}/users/{user_id}/sessions/{session_id}/archive", response_model=SessionArchiveResponse)
async def archive_session(
    app_name: str,
    user_id: str,
    session_id: str,
) -> SessionArchiveResponse:
    return await _update_archive_state(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        archived=True,
    )


@router.post(
    "/apps/{app_name}/users/{user_id}/sessions/{session_id}/unarchive",
    response_model=SessionArchiveResponse,
)
async def unarchive_session(
    app_name: str,
    user_id: str,
    session_id: str,
) -> SessionArchiveResponse:
    return await _update_archive_state(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        archived=False,
    )


@router.post("/apps/{app_name}/users/{user_id}/sessions/{session_id}/delete")
async def hard_delete_session(
    app_name: str,
    user_id: str,
    session_id: str,
):
    """从数据库永久删除会话（threads 表 DELETE，级联清理 events）。

    与 archive/unarchive 的"软删/恢复"语义解耦：本路由调用
    ``service.hard_delete_session()`` 直接物理删除，**不可恢复**。前端入口应配
    destructive 二次确认对话框（参见 ``SessionList.tsx`` 中的 ConfirmDialog 用法）。

    设计动机：ADK 基类的 ``delete_session`` 在本实现中被重写为"归档"以保持兼
    容契约；为避免覆盖该兼容行为，硬删除走独立方法。本路由刻意使用
    ``POST .../delete`` 而非 ``DELETE``，原因是 ADK Web Server 已在
    ``DELETE /apps/{app}/users/{user}/sessions/{id}`` 上注册自己的处理器（调用
    被重写为"归档"的 ``delete_session``），FastAPI 在路由匹配时先命中 ADK 版
    会让本路由形同虚设。``POST .../delete`` 既绕开冲突，又与同模块
    ``POST .../archive`` / ``POST .../unarchive`` 的风格一致，便于前端复用 BFF
    转发模板。
    """
    service = get_session_service()
    if not hasattr(service, "hard_delete_session"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session backend does not support hard delete",
        )

    deleted = await service.hard_delete_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return {"status": "ok"}


@router.post("/apps/{app_name}/users/{user_id}/sessions/{session_id}/approval_response")
async def submit_approval_response(
    app_name: str,
    user_id: str,
    session_id: str,
    req: ApprovalRespondRequest,
):
    """前端 ApprovalDialog 将用户决策写回 session state.approval_responses。

    后端 polling 中的 consume_approval_response 从同一字段读取，
    从而完成「前端决策 → 后端 tool 获知」的闭环。
    """
    import time

    service = get_session_service()
    session = await service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    try:
        from google.adk.events.event import Event, EventActions
    except Exception as exc:
        logger.warning("Failed to import ADK Event for approval response: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session backend does not support state update",
        ) from exc

    # 合并到已有的 approval_responses 字典
    existing = session.state.get("approval_responses", {}) if isinstance(session.state, dict) else {}
    existing = dict(existing) if isinstance(existing, dict) else {}
    existing[req.action_id] = {
        "decision": req.decision,
        "reason": req.reason,
        "responded_at": time.time(),
    }

    state_update_event = Event(
        invocation_id="p-" + str(uuid.uuid4()),
        author="user",
        actions=EventActions(state_delta={"approval_responses": existing}),
    )
    await service.append_event(session=session, event=state_update_event)

    return {"status": "ok", "action_id": req.action_id, "decision": req.decision}
