"""
Internalization Faculty Tools - 内化系部专用工具

提供记忆写入、知识结构化能力。
"""

from __future__ import annotations

import uuid
from typing import Any

from google.adk.tools import ToolContext
from sqlalchemy.dialects.postgresql import insert

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact, Memory

logger = get_logger("negentropy.tools.internalization")


async def save_to_memory(content: str, tags: list[str] | None, tool_context: ToolContext) -> dict[str, Any]:
    """将内容保存到长期记忆。

    Args:
        content: 要保存的内容
        tags: 可选的标签列表

    Returns:
        保存结果
    """
    metadata = {"tags": tags or []}
    app_name = settings.app_name
    user_id = "anonymous"
    thread_id = None
    if tool_context:
        session = getattr(tool_context, "session", None)
        if session:
            app_name = getattr(session, "app_name", app_name)
            user_id = getattr(session, "user_id", user_id)
            thread_id = getattr(session, "id", None)
        invocation = getattr(tool_context, "invocation_context", None)
        if invocation:
            app_name = getattr(invocation, "app_name", app_name)
            user_id = getattr(invocation, "user_id", user_id)

    thread_uuid = None
    if thread_id:
        try:
            thread_uuid = uuid.UUID(str(thread_id))
        except ValueError:
            thread_uuid = None

    try:
        async with db_session.AsyncSessionLocal() as db:
            memory = Memory(
                thread_id=thread_uuid,
                user_id=user_id,
                app_name=app_name,
                memory_type="semantic",
                content=content,
                metadata_=metadata,
            )
            db.add(memory)
            await db.commit()
            await db.refresh(memory)
        return {
            "status": "success",
            "memory_id": str(memory.id),
            "app_name": app_name,
            "user_id": user_id,
        }
    except Exception as exc:
        logger.error("memory save failed", exc_info=exc)
        if tool_context and hasattr(tool_context, "state"):
            state = tool_context.state
            buffer = state.get("ephemeral_memory")
            if not isinstance(buffer, list):
                buffer = []
            buffer.append({"content": content, "metadata": metadata})
            state["ephemeral_memory"] = buffer
            return {
                "status": "degraded",
                "message": "Memory backend unavailable; stored in session state",
                "count": len(buffer),
            }
        return {"status": "failed", "error": str(exc)}


async def update_knowledge_graph(entity: str, relation: str, target: str, tool_context: ToolContext) -> dict[str, Any]:
    """更新知识图谱中的关系。

    Args:
        entity: 源实体
        relation: 关系类型
        target: 目标实体

    Returns:
        更新结果
    """
    app_name = settings.app_name
    user_id = "anonymous"
    if tool_context:
        session = getattr(tool_context, "session", None)
        if session:
            app_name = getattr(session, "app_name", app_name)
            user_id = getattr(session, "user_id", user_id)
        invocation = getattr(tool_context, "invocation_context", None)
        if invocation:
            app_name = getattr(invocation, "app_name", app_name)
            user_id = getattr(invocation, "user_id", user_id)

    key = f"{entity}::{relation}"
    value = {"entity": entity, "relation": relation, "target": target}
    try:
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                insert(Fact)
                .values(
                    user_id=user_id,
                    app_name=app_name,
                    fact_type="relation",
                    key=key,
                    value=value,
                )
                .on_conflict_do_update(
                    index_elements=["user_id", "app_name", "fact_type", "key"],
                    set_={"value": value},
                )
                .returning(Fact.id)
            )
            result = await db.execute(stmt)
            fact_id = result.scalar_one()
            await db.commit()
        return {
            "status": "success",
            "fact_id": str(fact_id),
            "relation": value,
        }
    except Exception as exc:
        logger.error("knowledge graph update failed", exc_info=exc)
        if tool_context and hasattr(tool_context, "state"):
            state = tool_context.state
            buffer = state.get("knowledge_graph")
            if not isinstance(buffer, list):
                buffer = []
            buffer.append(value)
            state["knowledge_graph"] = buffer
            return {
                "status": "degraded",
                "message": "Knowledge graph backend unavailable; stored in session state",
                "count": len(buffer),
            }
        return {"status": "failed", "error": str(exc)}
