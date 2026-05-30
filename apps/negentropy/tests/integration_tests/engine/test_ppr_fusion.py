"""T4-F1 — HippoRAG PPR-Boosted Hybrid「实跑」集成测试（真实 PostgreSQL）。

补足此前空白：现有 ``test_ppr_search`` 仅是 RRF 数学 + mock 组件的单测，从未在
真实 KG 上跑通「种子链接 → PPR 扩散 → 实体反查 → RRF 融合」整链。本测试种入一个
最小但真实的图（Corpus + KgEntity×2 + KgRelation + ≥100 entity-associations），
证明 ``hipporag.enabled=true`` 时 PPR 通道真正执行并融合进结果（search_level 含 ppr），
以及数据闸（min_kg_associations）在关联不足时让其自休眠回退 Hybrid。

锚点：memory_service._maybe_fuse_ppr / _ppr_search / _rrf_fuse；
association_service.count_kg_associations / expand_via_ppr / memories_for_entity_scores。
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.config._base import reset_sections, set_yaml_section
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService
from negentropy.models.internalization import Memory, MemoryAssociation
from negentropy.models.perception import Corpus, KgEntity, KgRelation

_DIM = 1536


def _emb(seed: float) -> list[float]:
    """构造一个确定性向量：前若干维填 seed，便于 query 与 entity 对齐。"""
    v = [0.0] * _DIM
    for i in range(16):
        v[i] = seed
    # L2 normalize
    norm = (sum(x * x for x in v)) ** 0.5 or 1.0
    return [x / norm for x in v]


async def _embedding_fn(text_in: str) -> list[float]:
    # query 与种子实体共享同方向向量 → cosine 距离≈0，确保种子链接命中
    return _emb(1.0)


def _invalidate_memory_settings_cache() -> None:
    """settings.memory 是 @cached_property，需手动失效后才会重读新设的 YAML 段。"""
    from negentropy.config import settings as global_settings

    global_settings.__dict__.pop("memory", None)


@pytest.fixture(autouse=True)
def _reset_factory_singletons():
    """防御上游单测对工厂单例的污染（某些单测把 get_*_service 替换为 MagicMock 后
    未复位）。本集成测试需要真实服务，故运行前后强制重置工厂单例。"""
    from negentropy.engine.factories.memory import (
        reset_association_service,
        reset_fact_service,
        reset_memory_service,
    )

    reset_association_service()
    reset_fact_service()
    reset_memory_service()
    yield
    reset_association_service()
    reset_fact_service()
    reset_memory_service()


@pytest.fixture
def _hipporag_on():
    reset_sections()
    set_yaml_section(
        "memory",
        {
            "hipporag": {
                "enabled": True,
                "depth": 2,
                "alpha": 0.5,
                "rrf_k": 60,
                "timeout_ms": 2000,  # 测试放宽超时，避免环境抖动误判
                "seed_top_k": 5,
                "seed_threshold": 0.5,
                "min_kg_associations": 100,
            }
        },
    )
    _invalidate_memory_settings_cache()
    yield
    reset_sections()
    _invalidate_memory_settings_cache()


@pytest.fixture
def _hipporag_gated_off():
    """enabled=true 但关联数 < 阈值 → 数据闸应让 PPR 自休眠。"""
    reset_sections()
    set_yaml_section(
        "memory",
        {"hipporag": {"enabled": True, "min_kg_associations": 100, "seed_threshold": 0.5, "timeout_ms": 2000}},
    )
    _invalidate_memory_settings_cache()
    yield
    reset_sections()
    _invalidate_memory_settings_cache()


async def _seed_graph(
    *, user_id: str, app_name: str, thread_id: uuid.UUID, n_assoc: int
) -> tuple[uuid.UUID, list[uuid.UUID]]:
    """种入 Corpus + 2 实体 + 1 关系 + n_assoc 条 entity 关联 + 若干 memory。

    Returns: (corpus_id, [memory_ids])
    """
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        db.add(Thread(id=thread_id, app_name=app_name, user_id=user_id, state={}))

        corpus = Corpus(app_name=app_name, name=f"ppr_corpus_{uuid.uuid4().hex[:8]}")
        db.add(corpus)
        await db.flush()

        # 两个实体：seed 实体与 query 同向（命中种子链接），邻居实体被 PPR 扩散到
        e_seed = KgEntity(
            corpus_id=corpus.id,
            app_name=app_name,
            name="TypeScript",
            entity_type="concept",
            embedding=_emb(1.0),
            is_active=True,
        )
        e_neighbor = KgEntity(
            corpus_id=corpus.id,
            app_name=app_name,
            name="BackendService",
            entity_type="concept",
            embedding=_emb(0.9),
            is_active=True,
        )
        db.add_all([e_seed, e_neighbor])
        await db.flush()

        # 关系：seed -> neighbor（供 BFS 扩散）
        db.add(
            KgRelation(
                source_id=e_seed.id,
                target_id=e_neighbor.id,
                corpus_id=corpus.id,
                app_name=app_name,
                relation_type="RELATED_TO",
                weight=1.0,
                is_active=True,
            )
        )

        # n_assoc 条不同 memory，各自挂到一个实体上（target_type='entity'）。
        # 唯一约束 assoc_unique=(source_id, target_id, association_type) 要求
        # 每条关联的 (memory, entity) 组合唯一 → 用独立 memory 作 source。
        entities = [e_seed.id, e_neighbor.id]
        memory_ids: list[uuid.UUID] = []
        for i in range(n_assoc):
            m = Memory(
                thread_id=thread_id,
                user_id=user_id,
                app_name=app_name,
                memory_type="semantic",
                content=f"TypeScript backend service note number {i} about type safety",
                embedding=_emb(1.0),
                retention_score=0.8,
                importance_score=0.6,
                metadata_={"source": "test_ppr"},
            )
            db.add(m)
            await db.flush()
            memory_ids.append(m.id)
            db.add(
                MemoryAssociation(
                    source_id=m.id,
                    source_type="memory",
                    target_id=entities[i % len(entities)],
                    target_type="entity",
                    association_type="entity",
                    weight=0.8,
                    user_id=user_id,
                    app_name=app_name,
                )
            )
        await db.commit()
        return corpus.id, memory_ids


async def _cleanup(user_id: str, app_name: str, corpus_id: uuid.UUID | None) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(
            delete(MemoryAssociation).where(
                MemoryAssociation.user_id == user_id, MemoryAssociation.app_name == app_name
            )
        )
        await db.execute(delete(Memory).where(Memory.user_id == user_id, Memory.app_name == app_name))
        if corpus_id is not None:
            await db.execute(delete(KgRelation).where(KgRelation.corpus_id == corpus_id))
            await db.execute(delete(KgEntity).where(KgEntity.corpus_id == corpus_id))
            await db.execute(delete(Corpus).where(Corpus.id == corpus_id))
        await db.commit()


@pytest.mark.asyncio
async def test_ppr_fusion_executes_when_kg_dense(_hipporag_on):
    """KG 关联≥100 + enabled=true → PPR 通道实跑并融合（结果含 ppr 痕迹）。"""
    app_name = "t4_ppr_app"
    user_id = f"ppr_user_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    corpus_id = None
    try:
        corpus_id, _ = await _seed_graph(user_id=user_id, app_name=app_name, thread_id=thread_id, n_assoc=120)
        service = PostgresMemoryService(embedding_fn=_embedding_fn)

        # 先确认数据闸放行
        from negentropy.engine.factories.memory import get_association_service

        assoc = get_association_service()
        cnt = await assoc.count_kg_associations(user_id=user_id, app_name=app_name)
        assert cnt >= 100, f"应种入≥100 条 entity 关联，实际 {cnt}"

        resp = await service.search_memory(app_name=app_name, user_id=user_id, query="TypeScript backend type safety")
        assert resp.memories, "检索应有结果"

        # 至少一条结果带 ppr 痕迹（search_level 含 'ppr'，或 metadata.fusion 记录 ppr 通道）
        # 注意：ADK MemoryEntry 把元数据放在 custom_metadata 字段
        levels = []
        for m in resp.memories:
            meta = getattr(m, "custom_metadata", None) or {}
            lvl = meta.get("search_level", "")
            levels.append(lvl)
            fusion = meta.get("fusion", {})
            if "ppr" in lvl or (isinstance(fusion, dict) and "ppr" in (fusion.get("channels") or {})):
                break
        else:
            pytest.fail(f"未观察到 PPR 通道融合痕迹；levels={levels}")
    finally:
        await _cleanup(user_id, app_name, corpus_id)


@pytest.mark.asyncio
async def test_ppr_dormant_when_kg_sparse(_hipporag_gated_off):
    """关联数 < 100 → 数据闸生效，PPR 自休眠，结果回退纯 Hybrid（无 ppr 痕迹）。"""
    app_name = "t4_ppr_sparse"
    user_id = f"ppr_sparse_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    corpus_id = None
    try:
        corpus_id, _ = await _seed_graph(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
            n_assoc=5,  # 远低于闸值
        )
        service = PostgresMemoryService(embedding_fn=_embedding_fn)

        resp = await service.search_memory(app_name=app_name, user_id=user_id, query="TypeScript backend type safety")
        assert resp.memories, "稀疏 KG 下仍应有 Hybrid 结果"
        for m in resp.memories:
            meta = getattr(m, "custom_metadata", None) or {}
            assert "ppr" not in meta.get("search_level", ""), "数据闸未生效：稀疏 KG 不应触发 PPR"
    finally:
        await _cleanup(user_id, app_name, corpus_id)
