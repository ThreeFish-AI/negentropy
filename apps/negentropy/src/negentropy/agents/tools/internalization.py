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

        # 同步三元组到 kg_entities / kg_relations（强化已有实体）
        # 理论: Dong et al., 2014 Knowledge Vault 多源融合; Hogan et al., 2021 §6.3
        await _sync_triple_to_kg(
            source=entity,
            relation_type=relation,
            target=target,
            app_name=app_name,
        )

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


async def _sync_triple_to_kg(
    *,
    source: str,
    relation_type: str,
    target: str,
    app_name: str,
) -> None:
    """将 Agent 内化三元组同步到 kg_entities / kg_relations（强化模式）

    策略：查找 app_name 下同名实体，若存在则递增 mention_count（强化信号）；
    若两端实体均存在，则尝试创建 kg_relation。KG 不可用时静默跳过。

    参考文献:
    [23] Dong et al., 2014 — Knowledge Vault 多源知识融合
    [1] Hogan et al., 2021 — KG 增量填充 §6.3
    """
    from sqlalchemy import select as sql_select
    from sqlalchemy import update as sql_update

    from negentropy.models.perception import KgEntity, KgRelation

    try:
        async with db_session.AsyncSessionLocal() as db:
            for name in (source, target):
                await db.execute(
                    sql_update(KgEntity)
                    .where(
                        KgEntity.name == name,
                        KgEntity.app_name == app_name,
                        KgEntity.is_active.is_(True),
                    )
                    .values(mention_count=KgEntity.mention_count + 1)
                )

            src_row = (
                await db.execute(
                    sql_select(KgEntity.id, KgEntity.corpus_id)
                    .where(KgEntity.name == source, KgEntity.app_name == app_name, KgEntity.is_active.is_(True))
                    .limit(1)
                )
            ).first()
            tgt_row = (
                await db.execute(
                    sql_select(KgEntity.id, KgEntity.corpus_id)
                    .where(KgEntity.name == target, KgEntity.app_name == app_name, KgEntity.is_active.is_(True))
                    .limit(1)
                )
            ).first()

            if src_row and tgt_row:
                existing = (
                    await db.execute(
                        sql_select(KgRelation.id, KgRelation.is_active)
                        .where(
                            KgRelation.source_id == src_row.id,
                            KgRelation.target_id == tgt_row.id,
                            KgRelation.relation_type == relation_type,
                        )
                        .limit(1)
                    )
                ).first()

                if not existing:
                    rel = KgRelation(
                        source_id=src_row.id,
                        target_id=tgt_row.id,
                        corpus_id=src_row.corpus_id,
                        app_name=app_name,
                        relation_type=relation_type,
                        weight=1.0,
                        confidence=0.7,
                        evidence_text="Agent internalization",
                    )
                    db.add(rel)
                elif not existing.is_active:
                    await db.execute(
                        sql_update(KgRelation)
                        .where(KgRelation.id == existing.id)
                        .values(
                            is_active=True,
                            confidence=0.7,
                            evidence_text="Agent internalization (reactivated)",
                        )
                    )

            await db.commit()
            logger.debug(
                "kg_triple_synced",
                source=source,
                relation=relation_type,
                target=target,
                src_found=src_row is not None,
                tgt_found=tgt_row is not None,
            )
    except Exception as exc:
        logger.debug("kg_triple_sync_skipped", error=str(exc))
