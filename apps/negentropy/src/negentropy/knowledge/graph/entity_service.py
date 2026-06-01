"""
知识图谱一等公民 — 服务层 (Dual-Write Strategy)

将原本散落在 knowledge.metadata_ JSONB 中的实体/关系信息提升为一等数据库对象
(kg_entities / kg_relations / kg_entity_mentions)，同时保持向后兼容。

双写策略:
  - 写入时: AgeGraphRepository.create_entity() 同时写入 knowledge 表 + kg_entities 表
  - 读取时: 保持原有逻辑不变（向后兼容）
  - 未来: 逐步切换读取到新表

设计模式:
  - KgEntityService: 实体/关系的 CRUD + 双写协调
  - 异步 fire-and-forget 写入，不阻塞主 ingest 流水线
"""

from __future__ import annotations

from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])


class KgEntityService:
    """知识图谱一等公民服务

    职责:
    1. 协调双写策略（knowledge metadata_ → kg_entities 同步）
    2. 提供实体/关系的独立 CRUD 接口
    3. 管理实体提及时序 (KgEntityMention)
    """

    async def sync_entity_from_knowledge(
        self,
        db: AsyncSession,
        *,
        knowledge_id: UUID,
        name: str,
        entity_type: str,
        confidence: float = 0.0,
        embedding: list[float] | None = None,
        metadata: dict | None = None,
        corpus_id: UUID | None = None,
        app_name: str = "negentropy",
        document_id: UUID | None = None,
    ) -> bool:
        """从 knowledge 记录同步实体到 kg_entities 表（双写）

        此方法应在 AgeGraphRepository.create_entity() 之后调用，
        将同一实体信息写入新的一等公民表。

        Args:
            db: 数据库会话
            knowledge_id: 关联的 Knowledge (chunk) ID
            name: 实体名称
            entity_type: 实体类型（PERSON/ORG/LOCATION/TECH/CONCEPT 等）
            confidence: 置信度 (0-1)
            embedding: 实体的向量表示（可选，用于向量搜索）
            metadata: 额外元数据
            corpus_id: 所属语料库 ID
            app_name: 应用名称（默认 "negentropy"）

        Returns:
            ``True`` 表示创建了新的 kg_entities 行；``False`` 表示命中既有行做幂等更新。
            调用方据此区分 ``created`` / ``updated``，避免误把幂等更新当新增计入指标
            （参 issue.md ISSUE-032）。
        """
        from negentropy.models.perception import KgEntity, KgEntityMention

        # 检查是否已存在（幂等），仅使用 (corpus_id, canonical_name) 匹配
        # 与 UNIQUE 约束 uq_kg_entity_corpus_name 对齐，避免同名称不同 entity_type 时
        # SELECT 漏匹配导致 INSERT 触发 UniqueViolationError（Issue 0 根因修复）
        canonical = name.strip().lower()
        existing = await db.execute(
            sa.select(KgEntity).where(
                KgEntity.canonical_name == canonical,
                KgEntity.corpus_id == corpus_id if corpus_id else True,
            )
        )
        existing_rec = existing.scalar_one_or_none()

        if existing_rec is not None:
            # entity_type 优先级：更具体的类型优先于泛化类型
            _TYPE_PRECEDENCE = {
                "person": 10,
                "organization": 9,
                "location": 8,
                "product": 7,
                "event": 6,
                "concept": 5,
                "document": 4,
                "other": 1,
            }
            old_score = _TYPE_PRECEDENCE.get(existing_rec.entity_type, 0)
            new_score = _TYPE_PRECEDENCE.get(entity_type, 0)
            if new_score > old_score:
                existing_rec.entity_type = entity_type
            if confidence > existing_rec.confidence:
                existing_rec.confidence = confidence
            if embedding is not None:
                existing_rec.embedding = embedding
            if metadata:
                merged = {**(existing_rec.properties or {}), **metadata}
                existing_rec.properties = merged
            existing_rec.mention_count += 1
            # 为当前 document 创建 mention（幂等：已存在则跳过）
            if document_id is not None:
                existing_mention = await db.execute(
                    sa.select(KgEntityMention)
                    .where(
                        KgEntityMention.entity_id == existing_rec.id,
                        KgEntityMention.document_id == document_id,
                    )
                    .limit(1)
                )
                if existing_mention.scalar_one_or_none() is None:
                    extra_mention = KgEntityMention(
                        entity_id=existing_rec.id,
                        corpus_id=corpus_id,
                        document_id=document_id,
                        context_snippet=f"Entity '{name}' mentioned in document",
                    )
                    db.add(extra_mention)
                    await db.flush()
            logger.debug(
                "kg_entity_updated",
                extra={
                    "entity_id": str(existing_rec.id),
                    "entity_name": name,
                    "mention_count": existing_rec.mention_count,
                },
            )
            return False

        # 创建新记录
        new_entity = KgEntity(
            corpus_id=corpus_id,
            app_name=app_name,
            name=name,
            canonical_name=canonical,
            entity_type=entity_type,
            confidence=confidence,
            embedding=embedding,
            properties=metadata or {},
            mention_count=1,
        )
        db.add(new_entity)
        await db.flush()  # flush to generate new_entity.id

        # 创建 mention 记录（此时 new_entity.id 已生成）
        # 注意：knowledge_chunk_id 不在此设置，因为 knowledge_id 在批量同步场景中
        # 可能指向不存在的 Knowledge 记录，会导致 FK 约束违规

        mention = KgEntityMention(
            entity_id=new_entity.id,
            corpus_id=corpus_id,
            document_id=document_id,
            context_snippet=f"Entity '{name}' extracted from chunk",
        )
        db.add(mention)
        await db.flush()

        logger.info(
            "kg_entity_created",
            extra={
                "entity_id": str(new_entity.id),
                "entity_name": name,
                "entity_type": entity_type,
                "corpus_id": str(corpus_id) if corpus_id else None,
            },
        )
        return True

    async def sync_relation(
        self,
        db: AsyncSession,
        *,
        source_name: str,
        target_name: str,
        relation_type: str,
        weight: float = 1.0,
        evidence_text: str | None = None,
        corpus_id: UUID | None = None,
        app_name: str = "negentropy",
    ) -> bool:
        """同步关系到 kg_relations 表

        通过名称匹配找到 source/target 实体后创建关系。
        如果任一端点不存在，则跳过（延迟创建）。

        Returns:
            ``True`` 表示新行插入；``False`` 表示跳过（端点缺失 / 重复三元组）。
            调用方按返回值累加 ``relations_synced`` / ``relations_skipped`` 计数，
            构成 SSoT 闭环；避免"未抛异常 = 成功"导致计数虚高（issue.md ISSUE-032）。
        """
        from negentropy.models.perception import KgEntity, KgRelation

        _corpus_filters = [KgEntity.corpus_id == corpus_id] if corpus_id else []

        src_result = await db.execute(
            sa.select(KgEntity)
            .where(
                KgEntity.canonical_name == source_name.strip().lower(),
                *_corpus_filters,
            )
            .limit(1)
        )
        tgt_result = await db.execute(
            sa.select(KgEntity)
            .where(
                KgEntity.canonical_name == target_name.strip().lower(),
                *_corpus_filters,
            )
            .limit(1)
        )

        src = src_result.scalar_one_or_none()
        tgt = tgt_result.scalar_one_or_none()

        if src is None or tgt is None:
            # 端点缺失：日志级别提升到 warning 便于运维定位（之前 debug 不可见，
            # 导致 152→143 静默丢失 9 条关系长期未被发现，参 issue.md ISSUE-032）。
            logger.warning(
                "kg_relation_skipped",
                extra={
                    "source": source_name,
                    "target": target_name,
                    "relation_type": relation_type,
                    "reason": "endpoint_not_found",
                    "src_resolved": src is not None,
                    "tgt_resolved": tgt is not None,
                },
            )
            return False

        # 检查是否已存在相同关系
        existing = await db.execute(
            sa.select(KgRelation)
            .where(
                KgRelation.source_id == src.id,
                KgRelation.target_id == tgt.id,
                KgRelation.relation_type == relation_type,
            )
            .limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            logger.debug(
                "kg_relation_skipped",
                extra={
                    "source": source_name,
                    "target": target_name,
                    "relation_type": relation_type,
                    "reason": "duplicate_triple",
                },
            )
            return False

        relation = KgRelation(
            source_id=src.id,
            target_id=tgt.id,
            relation_type=relation_type,
            weight=weight,
            evidence_text=evidence_text,
            corpus_id=corpus_id,
            app_name=app_name,
        )
        db.add(relation)
        await db.flush()

        logger.debug(
            "kg_relation_created",
            extra={
                "relation_id": str(relation.id),
                "source": source_name,
                "target": target_name,
                "type": relation_type,
            },
        )
        return True

    async def batch_sync_from_graph_build(
        self,
        db: AsyncSession,
        *,
        nodes: list[dict],
        edges: list[dict],
        corpus_id: UUID | None = None,
        app_name: str = "negentropy",
    ) -> dict[str, int]:
        """从图谱构建结果批量同步实体和关系

        Args:
            db: 数据库会话
            nodes: 图谱节点列表（每个含 id, label, node_type, metadata 等）
            edges: 图谱边列表（每个含 source, target, label, edge_type, weight 等）
            corpus_id: 语料库 ID
            app_name: 应用名称（默认 "negentropy"）

        Returns:
            统计信息 {"entities_synced": N, "relations_synced": M}
        """
        entities_created = 0
        entities_updated = 0
        entities_failed = 0
        relations_created = 0
        relations_skipped = 0
        relations_failed = 0

        for node in nodes:
            try:
                node_doc_ids = node.get("document_ids") or []
                primary_doc_id = UUID(node_doc_ids[0]) if node_doc_ids else None

                async with db.begin_nested():  # SAVEPOINT: 单条失败仅回滚此 savepoint
                    created = await self.sync_entity_from_knowledge(
                        db,
                        knowledge_id=UUID(node.get("id", "00000000-0000-0000-0000-000000000000")),
                        name=node.get("label") or node.get("id", "unknown"),
                        entity_type=node.get("node_type", "UNKNOWN"),
                        confidence=float(node.get("confidence", 0)),
                        metadata=node.get("metadata"),
                        corpus_id=corpus_id,
                        app_name=app_name,
                        document_id=primary_doc_id,
                    )
                if created:
                    entities_created += 1
                else:
                    entities_updated += 1
                # 为额外的 document 创建 mention（幂等）
                if len(node_doc_ids) > 1:
                    await self._ensure_extra_document_mentions(
                        db,
                        node=node,
                        extra_doc_ids=node_doc_ids[1:],
                        corpus_id=corpus_id,
                    )
            except Exception as exc:
                entities_failed += 1
                logger.warning(
                    "batch_sync_entity_failed",
                    extra={
                        "node_id": node.get("id"),
                        "error": str(exc),
                    },
                )

        for edge in edges:
            try:
                async with db.begin_nested():  # SAVEPOINT: 单条失败仅回滚此 savepoint
                    inserted = await self.sync_relation(
                        db,
                        source_name=edge.get("source", ""),
                        target_name=edge.get("target", ""),
                        relation_type=edge.get("edge_type") or edge.get("label", "related_to"),
                        weight=float(edge.get("weight", 1.0)),
                        evidence_text=edge.get("evidence_text"),
                        corpus_id=corpus_id,
                    )
                if inserted:
                    relations_created += 1
                else:
                    relations_skipped += 1
            except Exception as exc:
                relations_failed += 1
                logger.warning(
                    "batch_sync_relation_failed",
                    extra={
                        "edge_source": edge.get("source"),
                        "error": str(exc),
                    },
                )

        # entities_synced / relations_synced 字段含义升级（issue.md ISSUE-032）：
        # 仅统计真实新增行；调用方与历史端点保持字段名兼容（旧含义"未抛异常即计数"
        # 已修正为"实际写入"）。skipped / failed / updated 显式拆分供运维诊断。
        entities_synced = entities_created
        relations_synced = relations_created

        logger.info(
            "kg_batch_sync_completed",
            extra={
                "entities_synced": entities_synced,
                "entities_updated": entities_updated,
                "entities_failed": entities_failed,
                "relations_synced": relations_synced,
                "relations_skipped": relations_skipped,
                "relations_failed": relations_failed,
                "corpus_id": str(corpus_id) if corpus_id else None,
            },
        )

        return {
            "entities_synced": entities_synced,
            "entities_updated": entities_updated,
            "entities_failed": entities_failed,
            "relations_synced": relations_synced,
            "relations_skipped": relations_skipped,
            "relations_failed": relations_failed,
        }

    async def _ensure_extra_document_mentions(
        self,
        db: AsyncSession,
        *,
        node: dict,
        extra_doc_ids: list[str],
        corpus_id: UUID | None,
    ) -> None:
        """为多 document 实体的额外 document 创建 mention（幂等）。

        当一个实体从多个 document 的 chunk 中被提取时，主 document 已在
        sync_entity_from_knowledge 中创建 mention，此方法为剩余 document 补建。
        """
        from negentropy.models.perception import KgEntity, KgEntityMention

        name = node.get("label") or node.get("id", "unknown")
        canonical = name.strip().lower()
        _corpus_filters = [KgEntity.corpus_id == corpus_id] if corpus_id else []

        entity_result = await db.execute(
            sa.select(KgEntity).where(KgEntity.canonical_name == canonical, *_corpus_filters).limit(1)
        )
        entity_rec = entity_result.scalar_one_or_none()
        if entity_rec is None:
            return

        for doc_id_str in extra_doc_ids:
            try:
                doc_uuid = UUID(doc_id_str)
                existing = await db.execute(
                    sa.select(KgEntityMention)
                    .where(
                        KgEntityMention.entity_id == entity_rec.id,
                        KgEntityMention.document_id == doc_uuid,
                    )
                    .limit(1)
                )
                if existing.scalar_one_or_none() is None:
                    mention = KgEntityMention(
                        entity_id=entity_rec.id,
                        corpus_id=corpus_id,
                        document_id=doc_uuid,
                        context_snippet=f"Entity '{name}' extracted from document",
                    )
                    db.add(mention)
                    await db.flush()
            except Exception as exc:
                logger.warning(
                    "extra_document_mention_failed",
                    extra={
                        "entity": name,
                        "document_id": doc_id_str,
                        "error": str(exc),
                    },
                )

    async def list_entities(
        self,
        db: AsyncSession,
        *,
        corpus_id: UUID,
        entity_type: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """分页实体列表

        Args:
            sort_by: "importance" 按重要性降序，默认按 mention_count 降序

        Returns:
            (items, total_count)
        """
        from sqlalchemy import func as sql_func

        from negentropy.models.perception import KgEntity

        base = sa.select(KgEntity).where(
            KgEntity.corpus_id == corpus_id,
            KgEntity.is_active == True,  # noqa: E712
        )

        if entity_type:
            base = base.where(KgEntity.entity_type == entity_type)
        if search:
            base = base.where(KgEntity.name.ilike(f"%{search}%"))

        count_q = sa.select(sql_func.count()).select_from(base.subquery())
        total = (await db.execute(count_q)).scalar_one()

        if sort_by == "importance":
            items_q = base.order_by(
                KgEntity.importance_score.desc().nullslast(),
                KgEntity.mention_count.desc(),
            )
        else:
            items_q = base.order_by(KgEntity.mention_count.desc(), KgEntity.confidence.desc())

        items_q = items_q.limit(limit).offset(offset)
        rows = (await db.execute(items_q)).scalars().all()

        items = [
            {
                "id": str(r.id),
                "name": r.name,
                "entity_type": r.entity_type,
                "confidence": float(r.confidence) if r.confidence else 0,
                "mention_count": r.mention_count,
                "importance_score": float(r.importance_score) if r.importance_score else None,
                "community_id": r.community_id,
                "description": r.description,
                "is_active": r.is_active,
            }
            for r in rows
        ]
        return items, total

    async def get_entity_detail(
        self,
        db: AsyncSession,
        entity_id: UUID,
        *,
        corpus_id: UUID | None = None,
    ) -> dict | None:
        """获取实体详情含关系

        Args:
            corpus_id: 可选语料库过滤，传入后仅返回该语料库下的实体

        Returns:
            实体详情 dict 或 None（未找到）
        """
        from sqlalchemy.orm import selectinload

        from negentropy.models.perception import KgEntity, KgRelation

        filters = [KgEntity.id == entity_id]
        if corpus_id is not None:
            filters.append(KgEntity.corpus_id == corpus_id)

        result = await db.execute(
            sa.select(KgEntity)
            .where(*filters)
            .options(
                selectinload(KgEntity.outgoing_relations).selectinload(KgRelation.target_entity),
                selectinload(KgEntity.incoming_relations).selectinload(KgRelation.source_entity),
            )
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            return None

        relations: list[dict] = []
        for rel in entity.outgoing_relations:
            peer = rel.target_entity
            relations.append(
                {
                    "id": str(rel.id),
                    "direction": "outgoing",
                    "relation_type": rel.relation_type,
                    "weight": rel.weight,
                    "confidence": rel.confidence,
                    "evidence_text": rel.evidence_text,
                    "peer_entity_id": str(peer.id),
                    "peer_entity_name": peer.name,
                    "peer_entity_type": peer.entity_type,
                }
            )
        for rel in entity.incoming_relations:
            peer = rel.source_entity
            relations.append(
                {
                    "id": str(rel.id),
                    "direction": "incoming",
                    "relation_type": rel.relation_type,
                    "weight": rel.weight,
                    "confidence": rel.confidence,
                    "evidence_text": rel.evidence_text,
                    "peer_entity_id": str(peer.id),
                    "peer_entity_name": peer.name,
                    "peer_entity_type": peer.entity_type,
                }
            )

        return {
            "id": str(entity.id),
            "name": entity.name,
            "entity_type": entity.entity_type,
            "confidence": float(entity.confidence) if entity.confidence else 0,
            "mention_count": entity.mention_count,
            "description": entity.description,
            "aliases": entity.aliases,
            "properties": entity.properties,
            "is_active": entity.is_active,
            "community_id": entity.community_id,
            "relations": relations,
        }
