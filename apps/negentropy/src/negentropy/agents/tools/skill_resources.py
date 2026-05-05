"""
Skill Resources Faculty Tool — Layer 3 资源懒加载

为 ADK agent 提供 ``fetch_skill_resource(skill_name, index)`` 工具：当 LLM 需要
查阅 Skill 资源时按需路由到对应底层服务（KG / Memory / Knowledge / 外链 / inline）。

设计准则：
- **不直接 fetch URL**：``url`` 类型仅返回 URL 字符串与 title，避免后端发起任意外部
  HTTP 请求引入 SSRF 风险；
- **fail-soft**：任何下游异常一律返回 ``{"status": "failed", "error": ...}``；
- **owner 视角**：从 ``tool_context`` 取 ``user_id`` 决定可见性。

参考文献：
[1] Google, "Agent Development Kit: Skills and Resources," *ADK Documentation*, 2026.
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

import negentropy.db.session as db_session
from negentropy.agents.skills_injector import resolve_skills
from negentropy.logging import get_logger

_logger = get_logger("negentropy.tools.skill_resources")


def _resolve_owner_id(tool_context: ToolContext | None) -> str:
    if tool_context is None:
        return "anonymous"
    invocation = getattr(tool_context, "invocation_context", None)
    if invocation is not None:
        user_id = getattr(invocation, "user_id", None)
        if user_id:
            return str(user_id)
    session = getattr(tool_context, "session", None)
    if session is not None:
        user_id = getattr(session, "user_id", None)
        if user_id:
            return str(user_id)
    return "anonymous"


async def fetch_skill_resource(
    skill_name: str,
    index: int,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """按 ``index`` 取出 Skill 第 N 项资源并按 type 路由查询。

    Args:
        skill_name: 目标 Skill 名。
        index: 0-based 索引。

    Returns:
        ``{"status": "success", "type": ..., "ref": ..., "title": ..., "payload": ...}``
        - ``type=kg_node``: payload 为 ``{neighbors: [...]}``（最多 50 邻居）
        - ``type=corpus``: payload 为 ``{documents: [...]}``（最多 5 篇 head）
        - ``type=memory``: payload 为 ``{memory_id, content, metadata}``
        - ``type=url`` / ``inline``: payload 为 ``{ref, title}``（不远程拉取）
    """
    if not skill_name or not isinstance(skill_name, str):
        return {"status": "failed", "error": "skill_name is required"}
    if not isinstance(index, int) or index < 0:
        return {"status": "failed", "error": "index must be a non-negative integer"}

    owner_id = _resolve_owner_id(tool_context)
    try:
        async with db_session.AsyncSessionLocal() as session:
            resolved = await resolve_skills(session, [skill_name], owner_id=owner_id)
        if not resolved:
            return {"status": "failed", "error": "skill_not_found", "skill_name": skill_name}
        skill = resolved[0]
        if index >= len(skill.resources):
            return {
                "status": "failed",
                "error": "index_out_of_range",
                "skill_name": skill_name,
                "total": len(skill.resources),
            }

        item = skill.resources[index] if isinstance(skill.resources[index], dict) else {}
        item_type = str(item.get("type") or "inline")
        ref = str(item.get("ref") or "")
        title = str(item.get("title") or ref or item_type)

        result: dict[str, Any] = {
            "status": "success",
            "type": item_type,
            "ref": ref,
            "title": title,
        }

        if item_type == "url" or item_type == "inline":
            result["payload"] = {"ref": ref, "title": title}
            return result

        if item_type == "kg_node":
            payload = await _fetch_kg_node(ref)
            result["payload"] = payload
            return result

        if item_type == "memory":
            payload = await _fetch_memory(ref)
            result["payload"] = payload
            return result

        if item_type == "corpus":
            payload = await _fetch_corpus_head(ref)
            result["payload"] = payload
            return result

        result["payload"] = {"note": f"unknown resource type: {item_type}"}
        return result

    except Exception as exc:
        _logger.warning(
            "fetch_skill_resource_failed",
            skill=skill_name,
            index=index,
            error=str(exc),
        )
        return {"status": "failed", "error": str(exc), "skill_name": skill_name}


async def _fetch_kg_node(ref: str) -> dict[str, Any]:
    """从 kg_entities 取节点 + 其邻居（最多 50 条）。"""
    try:
        from sqlalchemy import select

        from negentropy.models.perception import KgEntity, KgRelation

        async with db_session.AsyncSessionLocal() as db:
            entity = (
                (
                    await db.execute(
                        select(KgEntity).where(KgEntity.name == ref).where(KgEntity.is_active.is_(True)).limit(1)
                    )
                )
                .scalars()
                .first()
            )
            if entity is None:
                return {"found": False, "ref": ref}

            neighbors = (
                await db.execute(
                    select(KgRelation.relation_type, KgRelation.target_id)
                    .where(KgRelation.source_id == entity.id)
                    .where(KgRelation.is_active.is_(True))
                    .limit(50)
                )
            ).all()
        return {
            "found": True,
            "ref": ref,
            "entity_id": str(entity.id),
            "neighbors_count": len(neighbors),
            "relations": [{"relation": r[0], "target_id": str(r[1])} for r in neighbors[:20]],
        }
    except Exception as exc:
        return {"found": False, "ref": ref, "error": str(exc)}


async def _fetch_memory(ref: str) -> dict[str, Any]:
    """读取 Memory 单条记录（按 UUID）。"""
    try:
        from uuid import UUID

        from negentropy.models.internalization import Memory

        try:
            memory_uuid = UUID(ref)
        except ValueError:
            return {"found": False, "ref": ref, "error": "invalid memory uuid"}

        async with db_session.AsyncSessionLocal() as db:
            memory = await db.get(Memory, memory_uuid)
            if memory is None:
                return {"found": False, "ref": ref}
            return {
                "found": True,
                "ref": ref,
                "memory_id": str(memory.id),
                "content": memory.content,
                "metadata": dict(memory.metadata_ or {}),
            }
    except Exception as exc:
        return {"found": False, "ref": ref, "error": str(exc)}


async def _fetch_corpus_head(ref: str) -> dict[str, Any]:
    """读取 Knowledge corpus 的元信息 + 前几篇 documents 概要。"""
    try:
        from sqlalchemy import select

        from negentropy.models.perception import Corpus

        async with db_session.AsyncSessionLocal() as db:
            corpus = (await db.execute(select(Corpus).where(Corpus.name == ref).limit(1))).scalars().first()
            if corpus is None:
                return {"found": False, "ref": ref}
            return {
                "found": True,
                "ref": ref,
                "corpus_id": str(corpus.id),
                "name": corpus.name,
                "description": getattr(corpus, "description", None),
            }
    except Exception as exc:
        return {"found": False, "ref": ref, "error": str(exc)}
