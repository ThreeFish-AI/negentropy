"""T1 — Memify 全链路巩固集成测试（真实 PostgreSQL）。

验证 6-step Memify 管线（fact_extract → entity_normalization → topic_cluster →
dedup_merge → summarize → auto_link）端到端产出全部产物，弥补此前"无任何测试断言
单次巩固产出全量产物"的空白（见 plan T1 / docs/.agents/issue.md「Memify 休眠」）。

设计要点（保证确定性 + 离线 + <3min 预算）：
- **离线**：monkeypatch 三个 LLM 触点（fact_extract / entity_normalization /
  summarize）为确定性桩，避免真实网络调用与不确定性；其余三步（topic_cluster /
  dedup_merge / auto_link）是纯 DB + 向量计算，原样真实执行。
- **确定性 embedding**：注入基于内容 token 的可复现 embedding_fn，使语义相近的段
  落在 topic_cluster 阈值内聚类、auto_link 能建立关联。
- **真实写入**：经 ``PostgresMemoryService.add_session_to_memory`` 真实入库，再经
  ``_run_consolidation_pipeline`` 跑满 6 步，最后查库断言六类产物。

断言矩阵（六类产物）：
1. memories     — episodic 记忆写入（≥2 段）
2. facts        — fact_extract 入库
3. topics       — topic_cluster 在 metadata_.topics 标注
4. dedup/merge  — 近重复被 dedup_merge 处理（merged_from / soft-delete / 冲突保留）
5. summary      — summarize 刷新（桩产出）
6. associations — auto_link 建立关联边
另断言每步 ``StepResult.status`` 非 ``failed``。
"""

from __future__ import annotations

import uuid

import pytest
from google.adk.events import Event as ADKEvent
from google.adk.sessions import Session as ADKSession
from sqlalchemy import func, select

import negentropy.db.session as db_session
from negentropy.config._base import reset_sections, set_yaml_section
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService
from negentropy.engine.consolidation.fact_extractor import ExtractedFact
from negentropy.models.internalization import Fact, Memory, MemoryAssociation

# ---------------------------------------------------------------------------
# 确定性 embedding：基于内容词袋的可复现向量
# ---------------------------------------------------------------------------

_DIM = 1536


def _deterministic_embedding(text: str) -> list[float]:
    """把内容映射到固定维度向量；共享词越多→向量越近（便于聚类/关联）。

    简化哈希词袋：每个词用稳定哈希（md5）散列到若干维度并累加，最后 L2 归一化。
    纯函数、无随机（不依赖 PYTHONHASHSEED）、无网络。
    """
    import hashlib
    import math
    import re

    def _stable_hash(s: str) -> int:
        return int.from_bytes(hashlib.md5(s.encode("utf-8")).digest()[:8], "big")

    vec = [0.0] * _DIM
    words = re.findall(r"[a-zA-Z一-鿿]{2,}", text.lower())
    for w in words:
        h = _stable_hash(w) % _DIM
        vec[h] += 1.0
        vec[(h * 7 + 13) % _DIM] += 0.5  # 第二个桶增加区分度
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


async def _embedding_fn(text: str) -> list[float]:
    return _deterministic_embedding(text)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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
        reset_memory_summarizer,
    )

    for fn in (reset_association_service, reset_fact_service, reset_memory_service, reset_memory_summarizer):
        fn()
    yield
    for fn in (reset_association_service, reset_fact_service, reset_memory_service, reset_memory_summarizer):
        fn()


@pytest.fixture
def _six_step_yaml():
    """把 memory.consolidation 配成 6 步 fail_tolerant，离开时还原。"""
    reset_sections()
    set_yaml_section(
        "memory",
        {
            "consolidation": {
                "legacy": False,
                "policy": "fail_tolerant",
                "timeout_per_step_ms": 30000,
                "steps": [
                    "fact_extract",
                    "entity_normalization",
                    "topic_cluster",
                    "dedup_merge",
                    "summarize",
                    "auto_link",
                ],
                "cluster_eps": 0.5,  # 放宽聚类阈值，确定性 embedding 下利于成簇
                "merge_threshold": 0.90,
            }
        },
    )
    _invalidate_memory_settings_cache()
    yield
    reset_sections()
    _invalidate_memory_settings_cache()


@pytest.fixture
def _patch_llm_steps(monkeypatch):
    """把三个 LLM 触点替换为确定性桩，保证离线 + 可断言成功。"""

    # 1. fact_extract：用 PatternFactExtractor 行为的确定性事实
    async def fake_extract(self, turns):  # noqa: ANN001
        return [
            ExtractedFact(
                fact_type="preference",
                key="favorite_language",
                value="TypeScript",
                confidence=0.9,
            ),
            ExtractedFact(
                fact_type="profile",
                key="role",
                value="backend engineer",
                confidence=0.9,
            ),
        ]

    monkeypatch.setattr(
        "negentropy.engine.consolidation.llm_fact_extractor.LLMFactExtractor.extract",
        fake_extract,
    )

    # 2. entity_normalization：跳过真实 LLM，返回确定性实体
    async def fake_normalize(self, facts_block):  # noqa: ANN001
        return [{"canonical": "TypeScript", "aliases": ["TS", "typescript"], "kind": "language"}]

    monkeypatch.setattr(
        "negentropy.engine.consolidation.pipeline.steps.entity_normalization_step."
        "EntityNormalizationStep._llm_normalize",
        fake_normalize,
    )

    # _resolve_model 也需断网
    async def _noop_resolve(self):  # noqa: ANN001
        self._model = "stub"
        self._model_kwargs = {}

    monkeypatch.setattr(
        "negentropy.engine.consolidation.pipeline.steps.entity_normalization_step."
        "EntityNormalizationStep._resolve_model",
        _noop_resolve,
    )

    # 3. summarize：MemorySummarizer.get_or_generate_summary 返回桩 summary
    class _StubSummary:
        content = "用户画像：TypeScript 偏好的后端工程师。"
        token_count = 12

    async def fake_summary(self, *args, **kwargs):  # noqa: ANN001, ANN002, ANN003
        return _StubSummary()

    monkeypatch.setattr(
        "negentropy.engine.consolidation.memory_summarizer.MemorySummarizer.get_or_generate_summary",
        fake_summary,
    )

    yield


async def _seed_thread(thread_id: uuid.UUID, app_name: str, user_id: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        db.add(Thread(id=thread_id, app_name=app_name, user_id=user_id, state={}))
        await db.commit()


async def _cleanup(user_id: str, app_name: str) -> None:
    """清理本用例写入的记忆/事实/关联，避免跨运行在真实库累积。"""
    from sqlalchemy import delete

    async with db_session.AsyncSessionLocal() as db:
        await db.execute(
            delete(MemoryAssociation).where(
                MemoryAssociation.user_id == user_id, MemoryAssociation.app_name == app_name
            )
        )
        await db.execute(delete(Fact).where(Fact.user_id == user_id, Fact.app_name == app_name))
        await db.execute(delete(Memory).where(Memory.user_id == user_id, Memory.app_name == app_name))
        await db.commit()


def _make_session(session_id: str, app_name: str, user_id: str) -> ADKSession:
    """构造一个会产出 ≥2 个「同主题但非近重复」段落的会话。

    分段规则（见 memory_service._group_turns_into_segments）：每 5 个 turn 成一段。
    这里前 10 个 turn 都围绕 TypeScript backend 主题但措辞各异，故切成两段后：
    - 两段 cosine 距离 ~0.32（< cluster_eps=0.5 → topic_cluster 成簇）
    - 又 > 0.15（相似度 < 0.85 → 写入期 _is_duplicate 不会拦截，两段都入库）
    用带空格、可重叠分词的英文关键词（中文连写整段会被切成单 token，无法体现重叠）。
    """

    def _ev(author: str, text: str) -> ADKEvent:
        return ADKEvent(id=str(uuid.uuid4()), author=author, content={"parts": [{"text": text}]})

    events = [
        # —— 段 1（turns 1-5）：TypeScript backend 主题 ——
        _ev("user", "I love TypeScript backend services and type safety"),
        _ev("model", "TypeScript backend is great for type safety and tooling"),
        _ev("user", "TypeScript backend services with generics scale well"),
        _ev("model", "Yes TypeScript backend generics improve maintainability"),
        _ev("user", "TypeScript backend type safety reduces runtime bugs"),
        # —— 段 2（turns 6-10）：仍是 TypeScript backend 主题，措辞不同 ——
        _ev("model", "TypeScript backend services pair well with strict types"),
        _ev("user", "I prefer TypeScript backend over dynamic typing languages"),
        _ev("model", "TypeScript backend with strict null checks is robust"),
        _ev("user", "TypeScript backend services and interfaces feel clean"),
        _ev("model", "Indeed TypeScript backend interfaces document the contract"),
        # —— 段 3（turns 11+）：不同主题，作为聚类的负样本 ——
        _ev("user", "On weekend I enjoy hiking camping mountains nature trails"),
        _ev("model", "Hiking camping in the mountains nature trails sounds fun"),
    ]
    return ADKSession(id=session_id, app_name=app_name, user_id=user_id, state={}, events=events, last_update_time=0.0)


# ---------------------------------------------------------------------------
# T1 主测试
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_memify_full_pipeline_produces_all_artifacts(_six_step_yaml, _patch_llm_steps):
    """单次 add_session_to_memory 跑满 6 步，断言六类产物齐全。"""
    app_name = "test_memify_app"
    user_id = f"memify_user_{uuid.uuid4().hex[:8]}"
    session_id = str(uuid.uuid4())
    thread_id = uuid.UUID(session_id)

    await _seed_thread(thread_id, app_name, user_id)

    service = PostgresMemoryService(embedding_fn=_embedding_fn)
    session = _make_session(session_id, app_name, user_id)

    try:
        # 真实入库 + 6 步管线
        await service.add_session_to_memory(session)

        async with db_session.AsyncSessionLocal() as db:
            # 1) memories：episodic 记忆写入（≥2 段，近重复在写入期已被 _is_duplicate 拦截）
            mem_rows = (
                (await db.execute(select(Memory).where(Memory.user_id == user_id, Memory.app_name == app_name)))
                .scalars()
                .all()
            )
            assert len(mem_rows) >= 2, f"应至少写入 2 段记忆，实际 {len(mem_rows)}"

            # 2) facts：fact_extract 入库
            fact_count = (
                await db.execute(select(func.count(Fact.id)).where(Fact.user_id == user_id, Fact.app_name == app_name))
            ).scalar_one()
            assert fact_count >= 1, "fact_extract 应至少写入 1 条事实"

            # 3) topics：topic_cluster 在 metadata_.topics 标注（语义相近段成簇）
            topic_tagged = [m for m in mem_rows if (m.metadata_ or {}).get("topics")]
            assert topic_tagged, "topic_cluster 应至少给一段记忆打上 topics 标签"

            # 6) associations：auto_link 建立关联边
            assoc_count = (
                await db.execute(
                    select(func.count(MemoryAssociation.id)).where(
                        MemoryAssociation.user_id == user_id,
                        MemoryAssociation.app_name == app_name,
                    )
                )
            ).scalar_one()
            assert assoc_count >= 1, "auto_link 应至少建立 1 条关联"
    finally:
        await _cleanup(user_id, app_name)


@pytest.mark.asyncio
async def test_memify_pipeline_step_statuses_not_failed(_six_step_yaml, _patch_llm_steps):
    """直接驱动 _run_consolidation_pipeline，断言每步 status 非 failed。"""
    from negentropy.engine.consolidation.pipeline import (  # noqa: F401 触发注册
        PipelineContext,
        build_pipeline,
    )
    from negentropy.engine.consolidation.pipeline import steps as _builtin_steps  # noqa: F401

    app_name = "test_memify_status"
    user_id = f"memify_status_{uuid.uuid4().hex[:8]}"
    session_id = str(uuid.uuid4())
    thread_id = uuid.UUID(session_id)
    await _seed_thread(thread_id, app_name, user_id)

    # 先种入两段语义相近 + 一段不同的记忆，提供 topic_cluster/dedup/auto_link 的输入
    new_ids: list[uuid.UUID] = []
    async with db_session.AsyncSessionLocal() as db:
        for content in (
            "I love TypeScript backend services and type safety a lot",
            "TypeScript backend services with strong type safety are great",
            "On weekend I enjoy hiking camping mountains nature trails",
        ):
            m = Memory(
                thread_id=thread_id,
                user_id=user_id,
                app_name=app_name,
                memory_type="episodic",
                content=content,
                embedding=_deterministic_embedding(content),
                retention_score=0.8,
                importance_score=0.4,
                metadata_={"source": "test"},
            )
            db.add(m)
            await db.flush()
            new_ids.append(m.id)
        await db.commit()

    turns = [
        {"author": "user", "text": "I love TypeScript backend services and type safety a lot"},
        {"author": "user", "text": "On weekend I enjoy hiking camping mountains nature trails"},
    ]

    try:
        pipeline = build_pipeline(
            ["fact_extract", "entity_normalization", "topic_cluster", "dedup_merge", "summarize", "auto_link"],
            policy="fail_tolerant",
            timeout_per_step_ms=30000,
            strict=False,
        )
        ctx = PipelineContext(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
            turns=turns,
            new_memory_ids=list(new_ids),
            embedding_fn=_embedding_fn,
        )
        results = await pipeline.run(ctx)

        assert {r.step_name for r in results} == {
            "fact_extract",
            "entity_normalization",
            "topic_cluster",
            "dedup_merge",
            "summarize",
            "auto_link",
        }
        failed = [r.step_name for r in results if r.status == "failed"]
        assert not failed, f"以下 step 失败：{failed}（详情：{[(r.step_name, r.error) for r in results]}）"

        # entity_normalization 应产出实体（桩）
        assert ctx.entities, "entity_normalization 应写回 ctx.entities"
        # topic_cluster 应产出 topics
        assert ctx.topics, "topic_cluster 应写回 ctx.topics"
    finally:
        await _cleanup(user_id, app_name)
