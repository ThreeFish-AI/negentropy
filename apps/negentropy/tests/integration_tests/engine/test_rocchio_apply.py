"""T4-Rocchio — 相关性反馈闭环「读侧应用」集成测试（真实 PostgreSQL）。

补足此前空白：现有 ``test_rocchio_feedback_loop`` 仅覆盖「反馈→写侧 reweight」，
但不验证 ``relevance.enabled=true`` 时**读侧排序确实被 relevance_weight 改写**。
本测试证明 Rocchio 闭环最后一环（读侧 apply）在开箱默认下真正生效。

锚点：``memory_service._apply_relevance_weights``（受 ``memory.relevance.enabled`` 门控，
对 metadata_.relevance_weight 做 base*weight 后重排，权重 clamp 在 compute 阶段 [0.5,2.0]）。
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import update

import negentropy.db.session as db_session
from negentropy.config._base import reset_sections, set_yaml_section
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService
from negentropy.engine.relevance.rocchio_reweighter import compute_relevance_weight
from negentropy.models.internalization import Memory


async def _embedding_fn(text: str) -> list[float]:
    # 所有记忆共享相同向量 → 向量检索分数相同，凸显 relevance_weight 的排序作用
    return [0.2] * 1536


async def _seed_thread(thread_id: uuid.UUID, app_name: str, user_id: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        db.add(Thread(id=thread_id, app_name=app_name, user_id=user_id, state={}))
        await db.commit()


async def _cleanup(user_id: str, app_name: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(Memory.__table__.delete().where(Memory.user_id == user_id, Memory.app_name == app_name))
        await db.commit()


def _invalidate_memory_settings_cache() -> None:
    """settings.memory 是 @cached_property，需手动失效后才会重读新设的 YAML 段。"""
    from negentropy.config import settings as global_settings

    global_settings.__dict__.pop("memory", None)


@pytest.fixture
def _relevance_enabled():
    reset_sections()
    set_yaml_section("memory", {"relevance": {"enabled": True}})
    _invalidate_memory_settings_cache()
    yield
    reset_sections()
    _invalidate_memory_settings_cache()


@pytest.fixture
def _relevance_disabled():
    reset_sections()
    set_yaml_section("memory", {"relevance": {"enabled": False}})
    _invalidate_memory_settings_cache()
    yield
    reset_sections()
    _invalidate_memory_settings_cache()


async def _set_weight(memory_id: uuid.UUID, weight: float) -> None:
    """直接把预计算 relevance_weight 写入 metadata_（模拟 cron reweight 产物）。"""
    async with db_session.AsyncSessionLocal() as db:
        m = await db.get(Memory, memory_id)
        meta = dict(m.metadata_ or {})
        meta["relevance_weight"] = weight
        await db.execute(update(Memory).where(Memory.id == memory_id).values(metadata_=meta))
        await db.commit()


async def _seed_two_memories(service, user_id, app_name, thread_id):
    """种两条同向量记忆：low 给高权重、high 给低权重，以便观察排序翻转。"""
    low = await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content="alpha deployment runbook staging environment",
        memory_type="procedural",
    )
    high = await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content="beta deployment runbook staging environment",
        memory_type="procedural",
    )
    return uuid.UUID(low["id"]), uuid.UUID(high["id"])


@pytest.mark.asyncio
async def test_rocchio_compute_weight_clamped_and_gated():
    """compute_relevance_weight：低于 min_count 返 1.0；高正反馈夹至 ≤2.0。"""
    # 反馈不足门槛 → 中性 1.0
    assert compute_relevance_weight(2, 0, 2, min_count=3) == 1.0
    # 全 helpful：1.0 + 0.75*1 = 1.75
    assert compute_relevance_weight(10, 0, 10, min_count=3) == pytest.approx(1.75)
    # 全 irrelevant：1.0 - 0.15*1 = 0.85
    assert compute_relevance_weight(0, 10, 10, min_count=3) == pytest.approx(0.85)
    # 上限夹紧
    assert compute_relevance_weight(100, 0, 100, beta=5.0, min_count=3) == 2.0
    # 下限夹紧
    assert compute_relevance_weight(0, 100, 100, gamma=5.0, min_count=3) == 0.5


@pytest.mark.asyncio
async def test_relevance_weight_applied_when_enabled(_relevance_enabled):
    """enabled=true：给 low 记忆更高 relevance_weight → 其检索排名升至首位。"""
    app_name = "t4_rocchio_apply"
    user_id = f"rocchio_apply_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    low_id, high_id = await _seed_two_memories(service, user_id, app_name, thread_id)
    # low 记忆赋高权重（1.8），high 记忆赋低权重（0.6）
    await _set_weight(low_id, 1.8)
    await _set_weight(high_id, 0.6)

    resp = await service.search_memory(app_name=app_name, user_id=user_id, query="deployment runbook staging")
    texts = [m.content.parts[0].text for m in resp.memories]
    assert texts, "检索应有结果"
    # 高权重的 alpha 记忆应排在低权重 beta 之前
    alpha_idx = next((i for i, t in enumerate(texts) if "alpha" in t), None)
    beta_idx = next((i for i, t in enumerate(texts) if "beta" in t), None)
    assert alpha_idx is not None and beta_idx is not None
    assert alpha_idx < beta_idx, f"enabled=true 时高权重 alpha 应排在 beta 前；实际顺序 {texts}"

    await _cleanup(user_id, app_name)


@pytest.mark.asyncio
async def test_relevance_weight_not_applied_when_disabled(_relevance_disabled):
    """enabled=false：relevance_weight 不参与排序（与开启态形成对照，证明门控有效）。"""
    app_name = "t4_rocchio_noapply"
    user_id = f"rocchio_noapply_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    low_id, high_id = await _seed_two_memories(service, user_id, app_name, thread_id)
    await _set_weight(low_id, 1.8)
    await _set_weight(high_id, 0.6)

    resp = await service.search_memory(app_name=app_name, user_id=user_id, query="deployment runbook staging")
    # 关闭态下不应出现 relevance_weight_applied 标记（ADK MemoryEntry 用 custom_metadata）
    for m in resp.memories:
        meta = getattr(m, "custom_metadata", None) or {}
        assert "relevance_weight_applied" not in meta

    await _cleanup(user_id, app_name)
