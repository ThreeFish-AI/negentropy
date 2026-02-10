"""
Session API Router

提供 Session 标题的轻量更新能力，与 ADK 原生 Session CRUD 解耦。
"""

from __future__ import annotations

from typing import Optional

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from negentropy.engine.factories.session import get_session_service
from negentropy.logging import get_logger

router = APIRouter(tags=["sessions"])
logger = get_logger("negentropy.engine.sessions_api")


class SessionTitleUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=100)


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
