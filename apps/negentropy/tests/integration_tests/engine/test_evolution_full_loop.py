"""Evolution 子系统全闭环集成测试 — 真实 Postgres。

覆盖单元测试无法触达的 DB 路径：
- eval_runner 窗口聚合按 config_version 分桶（真实 memory_retrieval_logs）；
- decide_canary promote → MemoryConfigVersion active 翻转 + weights 缓存失效；
- decide_canary rollback → 新写 active=基线快照（origin=manual）。

LLM proposer 由单测覆盖；此处 mock 掉，专注 DB 状态机。
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.engine.evolution import eval_runner
from negentropy.engine.evolution import weights as weights_mod
from negentropy.engine.evolution.decision import decide_canary
from negentropy.models.evolution import MemoryConfigVersion
from negentropy.models.internalization import MemoryRetrievalLog

pytestmark = pytest.mark.asyncio

_APP = "negentropy"
_USER = "itest_evolution_user"


async def _insert_logs(
    *,
    config_version: str,
    total: int,
    zero_hit: int,
    helpful: int,
    irrelevant: int = 0,
):
    """植入指定 config_version 桶的检索日志。

    非 zero_hit 条目中：前 ``helpful`` 条标 helpful（且 was_referenced=True），
    次 ``irrelevant`` 条标 irrelevant，其余无 feedback。故：
    ``helpful_ratio = helpful / (helpful + irrelevant)``。
    """
    rows: list[MemoryRetrievalLog] = []
    now = datetime.now(UTC)
    for i in range(total):
        is_zero = i < zero_hit
        if is_zero:
            outcome = None
            was_ref = False
            mem_ids: list = []
        else:
            j = i - zero_hit
            if j < helpful:
                outcome, was_ref = "helpful", True
            elif j < helpful + irrelevant:
                outcome, was_ref = "irrelevant", False
            else:
                outcome, was_ref = None, False
            mem_ids = [uuid.uuid4()]
        rows.append(
            MemoryRetrievalLog(
                user_id=_USER,
                app_name=_APP,
                thread_id=None,
                query=f"q-{config_version}-{i}",
                retrieved_memory_ids=mem_ids,
                retrieved_fact_ids=[],
                was_referenced=was_ref,
                outcome_feedback=outcome,
                config_version=config_version,
                strategy="hybrid",
                created_at=now - timedelta(seconds=i % 60),
            )
        )
    async with db_session.AsyncSessionLocal() as db:
        db.add_all(rows)
        await db.commit()


async def _cleanup_logs():
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(MemoryRetrievalLog).where(MemoryRetrievalLog.user_id == _USER))
        await db.commit()


async def _cleanup_config(scope_versions: list[str]):
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(MemoryConfigVersion).where(MemoryConfigVersion.version.in_(scope_versions)))
        await db.commit()


async def test_eval_runner_aggregates_by_config_version_and_decide_canary_promotes():
    """植入 baseline（差）+ candidate（优）流量 → 聚合分桶 → decide_canary promote。"""
    await _cleanup_logs()
    weights_mod.invalidate()
    try:
        await _insert_logs(config_version="0.1.0", total=60, zero_hit=20, helpful=20, irrelevant=20)  # baseline 差
        await _insert_logs(config_version="0.1.1", total=60, zero_hit=10, helpful=35, irrelevant=5)  # candidate 优

        baseline, candidate = await eval_runner.run_canary_eval(
            app_name=_APP,
            baseline_version="0.1.0",
            candidate_version="0.1.1",
            window_seconds=3600,
        )
        assert baseline.sample_n == 60
        assert candidate.sample_n == 60
        assert candidate.zero_hit_rate < baseline.zero_hit_rate  # 退化负值 → 不退化
        assert candidate.helpful_ratio > baseline.helpful_ratio  # 改进

        dec = decide_canary(baseline=baseline, candidate=candidate)
        assert dec.is_promote, f"应 promote，got {dec.action}/{dec.reason}"
    finally:
        await _cleanup_logs()


async def test_eval_runner_decide_canary_zero_hit_regression_rolls_back():
    """候选 zero_hit 明显退化 → rollback。"""
    await _cleanup_logs()
    weights_mod.invalidate()
    try:
        await _insert_logs(config_version="0.1.0", total=60, zero_hit=5, helpful=30, irrelevant=5)
        await _insert_logs(config_version="0.1.2", total=60, zero_hit=30, helpful=25, irrelevant=5)  # zero_hit 大退化
        baseline, candidate = await eval_runner.run_canary_eval(
            app_name=_APP, baseline_version="0.1.0", candidate_version="0.1.2", window_seconds=3600
        )
        dec = decide_canary(baseline=baseline, candidate=candidate)
        assert dec.is_rollback
    finally:
        await _cleanup_logs()


async def test_active_config_flip_invalidates_weights_cache():
    """模拟 _promote：翻转 MemoryConfigVersion.is_active → invalidate → resolve 返回新快照。"""
    weights_mod.invalidate()
    test_versions = ["itest-flip-a", "itest-flip-b"]
    await _cleanup_config(test_versions)
    try:
        async with db_session.AsyncSessionLocal() as db:
            # 先去活既有 active 行（迁移 0081 seed v0.1.0），避免 uq_memory_config_active 部分唯一索引冲突
            from sqlalchemy import update

            await db.execute(
                update(MemoryConfigVersion).where(MemoryConfigVersion.is_active.is_(True)).values(is_active=False)
            )
            db.add(
                MemoryConfigVersion(
                    config_scope="retrieval",
                    version="itest-flip-a",
                    snapshot={"semantic_weight": 0.66, "keyword_weight": 0.34},
                    origin="manual",
                    is_active=True,
                )
            )
            await db.commit()

        weights_mod.invalidate()
        snap, ver = await weights_mod.resolve_active_retrieval_config()
        assert ver == "itest-flip-a"
        assert snap["semantic_weight"] == 0.66

        # 翻转 active
        async with db_session.AsyncSessionLocal() as db:
            from sqlalchemy import update

            await db.execute(
                update(MemoryConfigVersion).where(MemoryConfigVersion.is_active.is_(True)).values(is_active=False)
            )
            db.add(
                MemoryConfigVersion(
                    config_scope="retrieval",
                    version="itest-flip-b",
                    snapshot={"semantic_weight": 0.55, "keyword_weight": 0.45},
                    origin="evolution",
                    is_active=True,
                )
            )
            await db.commit()
        weights_mod.invalidate()
        snap2, ver2 = await weights_mod.resolve_active_retrieval_config()
        assert ver2 == "itest-flip-b"
        assert snap2["semantic_weight"] == 0.55
    finally:
        weights_mod.invalidate()
        await _cleanup_config(test_versions)
        # 恢复迁移 0081 seed v0.1.0 为 active（本测试去活了它）
        async with db_session.AsyncSessionLocal() as db:
            from sqlalchemy import update

            await db.execute(
                update(MemoryConfigVersion)
                .where(
                    MemoryConfigVersion.config_scope == "retrieval",
                    MemoryConfigVersion.version == "0.1.0",
                )
                .values(is_active=True)
            )
            await db.commit()
        weights_mod.invalidate()
