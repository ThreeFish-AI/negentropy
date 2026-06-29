"""PG 集成测试：pdf_fidelity_patrol 真实创建并持久化巡检 Routine。

验证用户反馈的核心断点——「派生 Routine 完全没有挂载和执行」。根因是
``no_progress_patience=settings.routine.no_progress_patience``（该属性不存在于
RoutineSettings）致 handler 在创建 Routine 前抛 AttributeError。本测试用真实 PG
（conftest 的 ``_isolate_test_database`` 已 alembic upgrade head 建全 schema +
``db_engine`` fixture）落库一条 running 巡检 Routine，证明修复后「真实挂载」成立。

依赖：PG 可用（与其它 routine PG 测试同）。无网络 / 无 Claude Code（仅验证 DB 落库链路）。
"""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from negentropy.engine.schedulers import registry as registry_mod
from negentropy.engine.schedulers.handlers import (
    PATROL_LIFECYCLE_IDLE,
    PATROL_LIFECYCLE_IN_FLIGHT,
    PATROL_LIFECYCLE_KEY,
    HandlerResult,
)
from negentropy.engine.schedulers.handlers import (
    pdf_fidelity_patrol as patrol,
)
from negentropy.models.plugin_common import PluginVisibility
from negentropy.models.repository import Repository
from negentropy.models.routine import Routine, RoutineIteration
from negentropy.models.scheduled_task import ScheduledTask, TaskExecution


async def test_create_and_start_patrol_routine_persists_real_row(db_engine):
    """_create_and_start_patrol_routine 真实落库一条 running 巡检 Routine（回归 no_progress_patience 全量异常）。"""
    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)

    # 1) 先插一个 Repository（routine.repository_id FK 指向它）
    async with session_factory() as db:
        repo = Repository(
            owner_id="system",
            visibility=PluginVisibility.PUBLIC,
            name=f"negentropy-test-{uuid.uuid4().hex[:8]}",
            display_name="patrol-integration-test",
            github_url="https://github.com/ThreeFish-AI/negentropy",
            local_path="/tmp/nonexistent-patrol-repo",
            baseline_branch="origin/feature/1.x.x",
            default_remote="origin",
        )
        db.add(repo)
        await db.flush()
        repo_id = repo.id

        # 2) 创建并落库巡检 Routine（真实 settings + 真实 DB）
        doc = {"id": uuid.uuid4(), "original_filename": "spec.pdf"}
        routine_id = await patrol._create_and_start_patrol_routine(
            db,
            repo_id=repo_id,
            baseline_branch="origin/feature/1.x.x",
            doc=doc,
            source_pdf_path="/tmp/patrol/source.pdf",
            source_read_dir="/tmp/patrol",
            regression_sample=[],
            source_task_key="pdf_fidelity_patrol",
        )
        await db.commit()

    # 3) 新会话查询，证明真实持久化（非 in-memory）
    async with session_factory() as db:
        row = (await db.execute(select(Routine).where(Routine.id == routine_id))).scalar_one()
        assert row.status == "running"
        assert row.repository_id == repo_id
        assert row.baseline_branch == "origin/feature/1.x.x"
        assert row.no_progress_patience == 3  # per-Routine 默认（非 settings）—— 回归点
        assert row.success_score_threshold == 95  # 合格阈值（patrol_qualified_score_threshold；原 100→收敛即 SUCCESS）
        assert row.max_iterations == 400  # settings.routine.patrol_max_iterations_per_doc（×50：原 8）
        assert row.max_cost_usd == 1500.0  # patrol 专属预算（×50：原 30；非全局 default_max_cost_usd=5）
        assert row.owner_id == "system"
        assert row.is_template is False
        assert row.key.startswith("pdf-fidelity-patrol/")
        # config 装配（patrol 标记 + source_task_key 回链 + system_prompt + read_dirs）
        assert row.config["patrol"] is True
        assert row.config["source_task_key"] == "pdf_fidelity_patrol"
        assert "system_prompt" in row.config
        assert row.config["read_dirs"] == ["/tmp/patrol"]


# ---------------------------------------------------------------------------
# _propagate_patrol_outcomes：终态 Routine 成败回写 ScheduledTask（聚合状态唯一权威写者）
# ---------------------------------------------------------------------------


def _sf(db_engine):
    return async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)


async def _seed_terminal_patrol(
    db_engine, *, status, termination_reason, source_task_key, initial_cf=0, initial_last_status="running"
):
    """落库一条终态 patrol Routine + 其派生的 ScheduledTask；返回 routine_id。

    Routine 经 _create_and_start_patrol_routine（真实装配）落 running，再翻转为指定终态。
    ScheduledTask 用唯一 key 隔离（避免与种子任务或其它测试串扰）。
    """
    factory = _sf(db_engine)
    async with factory() as db:
        repo = Repository(
            owner_id="system",
            visibility=PluginVisibility.PUBLIC,
            name=f"negentropy-prop-{uuid.uuid4().hex[:8]}",
            display_name="prop-test",
            github_url="https://github.com/ThreeFish-AI/negentropy",
            local_path="/tmp/nonexistent-patrol-repo",
            baseline_branch="origin/feature/1.x.x",
            default_remote="origin",
        )
        db.add(repo)
        await db.flush()
        doc = {"id": uuid.uuid4(), "original_filename": "spec.pdf"}
        routine_id = await patrol._create_and_start_patrol_routine(
            db,
            repo_id=repo.id,
            baseline_branch="origin/feature/1.x.x",
            doc=doc,
            source_pdf_path="/tmp/patrol/source.pdf",
            source_read_dir="/tmp/patrol",
            regression_sample=[],
            source_task_key=source_task_key,
        )
        routine = await db.get(Routine, routine_id)
        routine.status = status
        routine.termination_reason = termination_reason
        task = ScheduledTask(
            key=source_task_key,
            handler_kind="pdf_fidelity_patrol",
            trigger_type="interval",
            interval_seconds=3600.0,
            consecutive_failures=initial_cf,
            last_status=initial_last_status,
        )
        db.add(task)
        await db.commit()
    return routine_id


async def test_propagate_failed_routine_flips_scheduled_task(db_engine):
    """Routine failed → ScheduledTask.last_status=failed / consecutive_failures+1 / last_error=reason。"""
    task_key = f"pdf_fidelity_patrol-prop-{uuid.uuid4().hex[:6]}"
    routine_id = await _seed_terminal_patrol(
        db_engine,
        status="failed",
        termination_reason="unrecoverable_error",
        source_task_key=task_key,
        initial_cf=0,
    )
    factory = _sf(db_engine)
    async with factory() as db:
        count = await patrol._propagate_patrol_outcomes(db)
        await db.commit()
    assert count >= 1

    async with factory() as db:
        task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == task_key))).scalar_one()
        assert task.last_status == "failed"
        assert task.last_error == "unrecoverable_error"
        assert task.consecutive_failures == 1
        routine = await db.get(Routine, routine_id)
        assert routine.config["outcome_propagated"] is True


async def test_propagate_succeeded_routine_resets_failures(db_engine):
    """Routine succeeded → last_status=ok / consecutive_failures 清零 / last_error=NULL。"""
    task_key = f"pdf_fidelity_patrol-prop-{uuid.uuid4().hex[:6]}"
    await _seed_terminal_patrol(
        db_engine,
        status="succeeded",
        termination_reason="success",
        source_task_key=task_key,
        initial_cf=3,
    )
    factory = _sf(db_engine)
    async with factory() as db:
        await patrol._propagate_patrol_outcomes(db)
        await db.commit()
    async with factory() as db:
        task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == task_key))).scalar_one()
        assert task.last_status == "ok"
        assert task.last_error is None
        assert task.consecutive_failures == 0


async def test_propagate_cancelled_routine_keeps_failures(db_engine):
    """Routine cancelled → last_status=cancelled / consecutive_failures 不变（与既有 cancelled 语义对齐）。"""
    task_key = f"pdf_fidelity_patrol-prop-{uuid.uuid4().hex[:6]}"
    await _seed_terminal_patrol(
        db_engine,
        status="cancelled",
        termination_reason=None,
        source_task_key=task_key,
        initial_cf=2,
    )
    factory = _sf(db_engine)
    async with factory() as db:
        await patrol._propagate_patrol_outcomes(db)
        await db.commit()
    async with factory() as db:
        task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == task_key))).scalar_one()
        assert task.last_status == "cancelled"
        assert task.consecutive_failures == 2  # 不变
        assert task.last_error is None


async def test_propagate_idempotent(db_engine):
    """outcome_propagated 标记保证幂等：二次调用不重复累加 consecutive_failures。"""
    task_key = f"pdf_fidelity_patrol-prop-{uuid.uuid4().hex[:6]}"
    await _seed_terminal_patrol(
        db_engine,
        status="failed",
        termination_reason="max_cost",
        source_task_key=task_key,
        initial_cf=0,
    )
    factory = _sf(db_engine)
    async with factory() as db:
        await patrol._propagate_patrol_outcomes(db)
        await db.commit()
    async with factory() as db:
        await patrol._propagate_patrol_outcomes(db)
        await db.commit()
    async with factory() as db:
        task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == task_key))).scalar_one()
        assert task.consecutive_failures == 1  # 未因二次调用重复累加


# ---------------------------------------------------------------------------
# _finalize_terminal_patrols：终态确定性沉淀 → 文档推进（修「始终拟合同一份文档」根因）
# ---------------------------------------------------------------------------


def _contract_summary(*, score, status):
    """构造一份 ``pdf-fidelity-contract`` JSON 块 summary（喂 routine_iterations.summary）。"""
    import json

    payload = {
        "doc_id": "x",
        "score": score,
        "status": status,
        "defects": [],
        "unfixable_regions": [],
        "patterns": [],
        "perceives_diff_summary": "",
        "non_regression": "n/a",
    }
    return f"```pdf-fidelity-contract\n{json.dumps(payload)}\n```"


async def _seed_terminal_patrol_with_outcome(
    db_engine,
    *,
    status,
    best_score=None,
    contract_summary=None,
    doc_id=None,
):
    """落库一条终态 patrol Routine（可选 best_score + 末轮 evaluated 契约 summary）。

    返回 ``(routine_id, doc_id)``；doc_id 取自创建时写入（_create_and_start 用 doc['id']）。
    """
    factory = _sf(db_engine)
    async with factory() as db:
        repo = Repository(
            owner_id="system",
            visibility=PluginVisibility.PUBLIC,
            name=f"negentropy-fin-{uuid.uuid4().hex[:8]}",
            display_name="fin-test",
            github_url="https://github.com/ThreeFish-AI/negentropy",
            local_path="/tmp/nonexistent-patrol-repo",
            baseline_branch="origin/feature/1.x.x",
            default_remote="origin",
        )
        db.add(repo)
        await db.flush()
        doc_id = doc_id or str(uuid.uuid4())
        doc = {"id": doc_id, "original_filename": "spec.pdf"}
        routine_id = await patrol._create_and_start_patrol_routine(
            db,
            repo_id=repo.id,
            baseline_branch="origin/feature/1.x.x",
            doc=doc,
            source_pdf_path="/tmp/patrol/source.pdf",
            source_read_dir="/tmp/patrol",
            regression_sample=[],
            source_task_key=f"pdf_fidelity_patrol-fin-{uuid.uuid4().hex[:6]}",
        )
        routine = await db.get(Routine, routine_id)
        routine.status = status
        routine.termination_reason = (
            "success" if status == "succeeded" else ("user_cancelled" if status == "cancelled" else "no_progress")
        )
        if best_score is not None:
            routine.best_score = best_score
        if contract_summary is not None:
            db.add(
                RoutineIteration(
                    routine_id=routine_id,
                    seq=1,
                    status="evaluated",
                    summary=contract_summary,
                    score=best_score,
                )
            )
        await db.commit()
    return routine_id, str(doc_id)


async def _status_memory(db_engine, doc_id):
    """读取某 doc 的 pdf-fidelity-status 记忆 (status, score)；无则 None。"""
    from sqlalchemy import text

    from negentropy.config import settings

    factory = _sf(db_engine)
    async with factory() as db:
        return (
            await db.execute(
                text(
                    "SELECT metadata->>'status' AS st, metadata->>'score' AS sc "
                    "FROM negentropy.memories "
                    "WHERE app_name = :app AND user_id = 'system' "
                    "AND metadata->>'tag' = 'pdf-fidelity-status' AND metadata->>'doc_id' = :d "
                    "LIMIT 1"
                ),
                {"app": settings.app_name, "d": str(doc_id)},
            )
        ).fetchone()


async def test_finalize_failed_high_score_marks_done_and_advances(db_engine):
    """failed best_score=97 ≥ 95 → done(score=97)，doc 进 skip_ids（推进生效，不再死循环）。"""
    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

    factory = _sf(db_engine)
    _, doc_id = await _seed_terminal_patrol_with_outcome(db_engine, status="failed", best_score=97)
    async with factory() as db:
        n = await patrol._finalize_terminal_patrols(db)
        await db.commit()
    assert n >= 1

    row = await _status_memory(db_engine, doc_id)
    assert row is not None and row.st == "done" and row.sc == "97"

    async with factory() as db:
        assert doc_id in await PatrolMemoryStore(db).get_skip_doc_ids()


async def test_finalize_failed_low_score_marks_unfixable_and_advances(db_engine):
    """failed best_score=52 < 95 → unfixable(score=52)，doc 仍进 skip_ids（尽力亦推进）。"""
    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

    factory = _sf(db_engine)
    _, doc_id = await _seed_terminal_patrol_with_outcome(db_engine, status="failed", best_score=52)
    async with factory() as db:
        await patrol._finalize_terminal_patrols(db)
        await db.commit()
    row = await _status_memory(db_engine, doc_id)
    assert row is not None and row.st == "unfixable" and row.sc == "52"
    async with factory() as db:
        assert doc_id in await PatrolMemoryStore(db).get_skip_doc_ids()


async def test_finalize_progressing_contract_advances(db_engine):
    """末轮 progressing 契约 + best_score=96 ≥ 95 → done（核心：progressing 不再致死循环）。"""
    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

    factory = _sf(db_engine)
    _, doc_id = await _seed_terminal_patrol_with_outcome(
        db_engine,
        status="failed",
        best_score=96,
        contract_summary=_contract_summary(score=80, status="progressing"),
    )
    async with factory() as db:
        await patrol._finalize_terminal_patrols(db)
        await db.commit()
    row = await _status_memory(db_engine, doc_id)
    assert row is not None and row.st == "done"  # best_score 兜底，progressing 不阻断推进
    async with factory() as db:
        assert doc_id in await PatrolMemoryStore(db).get_skip_doc_ids()


async def test_finalize_missing_contract_falls_back_to_best_score(db_engine):
    """末轮无 evaluated summary（契约缺失）+ best_score=88 < 95 → unfixable（best_score 兜底沉淀）。"""
    _, doc_id = await _seed_terminal_patrol_with_outcome(db_engine, status="failed", best_score=88)
    factory = _sf(db_engine)
    async with factory() as db:
        await patrol._finalize_terminal_patrols(db)
        await db.commit()
    row = await _status_memory(db_engine, doc_id)
    assert row is not None and row.st == "unfixable"


async def test_finalize_cancelled_does_not_persist_status(db_engine):
    """cancelled best_score=97 → 不写状态记忆、doc 不进 skip_ids（保持可重选），memory_persisted=true。"""
    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

    factory = _sf(db_engine)
    routine_id, doc_id = await _seed_terminal_patrol_with_outcome(
        db_engine,
        status="cancelled",
        best_score=97,
    )
    async with factory() as db:
        n = await patrol._finalize_terminal_patrols(db)
        await db.commit()
    assert n >= 1
    assert await _status_memory(db_engine, doc_id) is None  # 不沉淀状态
    async with factory() as db:
        assert doc_id not in await PatrolMemoryStore(db).get_skip_doc_ids()  # 保持可被重新选中
        routine = await db.get(Routine, routine_id)
        assert routine.config.get("memory_persisted") is True  # 仍标记（避免每 tick 重扫）


async def test_finalize_multiple_routines_same_doc_best_wins(db_engine):
    """同 doc 两条终态 Routine（best_score 52 与 97）→ 最终 done(score=97)（ORDER BY best_score 最佳拟合胜出）。"""
    doc_id = str(uuid.uuid4())
    await _seed_terminal_patrol_with_outcome(db_engine, status="failed", best_score=52, doc_id=doc_id)
    await _seed_terminal_patrol_with_outcome(db_engine, status="failed", best_score=97, doc_id=doc_id)
    factory = _sf(db_engine)
    async with factory() as db:
        await patrol._finalize_terminal_patrols(db)
        await db.commit()
    row = await _status_memory(db_engine, doc_id)
    assert row is not None and row.st == "done" and row.sc == "97"


async def _seed_knowledge_pdf(db_engine, *, filename):
    """落库一条 knowledge_documents（pdf + completed）；返回其 id。"""
    from negentropy.config import settings
    from negentropy.models.perception import KnowledgeDocument

    factory = _sf(db_engine)
    async with factory() as db:
        doc = KnowledgeDocument(
            app_name=settings.app_name,
            file_hash=uuid.uuid4().hex,
            original_filename=filename,
            content_uri=f"pgblob://test/{uuid.uuid4().hex}",
            content_type="application/pdf",
            file_size=1024,
            markdown_extract_status="completed",
        )
        db.add(doc)
        await db.commit()
        return doc.id


async def test_select_advances_after_done(db_engine):
    """端到端推进：把 A 标 done → _select_next_pending_doc 不再返回 A（推进生效，不再卡 A）。

    用相对断言（``≠ A``）而非「== B」：测试库（``negentropy_test``）不跨 session 清空，全局
    ``_select_next_pending_doc`` 可能命中前次遗留文档；核心是证明「已合格的 A 不再被选中」，
    鲁棒于累积数据。B 仅用于保证「仍有 pending 文档」。
    """
    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

    factory = _sf(db_engine)
    doc_a = await _seed_knowledge_pdf(db_engine, filename="patrol-advance-a.pdf")
    await _seed_knowledge_pdf(db_engine, filename="patrol-advance-b.pdf")  # 保证至少一份 pending

    # A 经一次终态 Routine 标 done
    await _seed_terminal_patrol_with_outcome(db_engine, status="failed", best_score=97, doc_id=str(doc_a))
    async with factory() as db:
        await patrol._finalize_terminal_patrols(db)
        await db.commit()

    async with factory() as db:
        skip = await PatrolMemoryStore(db).get_skip_doc_ids()
        next_doc = await patrol._select_next_pending_doc(db, skip_ids=skip)
    assert str(doc_a) in skip  # A 已 done → 进 skip_ids（推进核心信号）
    assert next_doc is not None  # 仍有待检文档（B 或其它 pending）
    assert str(next_doc["id"]) != str(doc_a)  # 推进：不再选中已合格的 A（修「始终卡 A」根因）


# ---------------------------------------------------------------------------
# _finalize_execution：patrol_lifecycle 标记的延迟语义（per-tick 不声称聚合状态终态）
# ---------------------------------------------------------------------------


async def _seed_task_and_execution(db_engine, *, last_status, last_error, consecutive_failures):
    """落库一条 ScheduledTask + running TaskExecution；返回 (task_id, execution_id)。"""
    factory = _sf(db_engine)
    async with factory() as db:
        task = ScheduledTask(
            key=f"finalize-{uuid.uuid4().hex[:6]}",
            handler_kind="pdf_fidelity_patrol",
            trigger_type="interval",
            interval_seconds=3600.0,
            last_status=last_status,
            last_error=last_error,
            consecutive_failures=consecutive_failures,
        )
        db.add(task)
        await db.flush()
        exec_row = TaskExecution(task_id=task.id, started_at=datetime.now(UTC), status="running")
        db.add(exec_row)
        await db.commit()
        return task.id, exec_row.id


async def test_finalize_in_flight_marker_preserves_failure(db_engine, monkeypatch):
    """patrol_lifecycle=in_flight：last_status=running，保留 last_error/consecutive_failures。"""
    factory = _sf(db_engine)
    monkeypatch.setattr(registry_mod, "AsyncSessionLocal", factory)  # registry 直接 import，需显式指向测试库
    registry = registry_mod.ScheduledTaskRegistry()

    task_id, exec_id = await _seed_task_and_execution(
        db_engine, last_status="failed", last_error="prev failure", consecutive_failures=2
    )
    await registry._finalize_execution(
        exec_id,
        task_id,
        HandlerResult(status="ok", metrics={PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IN_FLIGHT}),
        datetime.now(UTC),
        time.monotonic(),
    )

    async with factory() as db:
        t = await db.get(ScheduledTask, task_id)
        assert t.last_status == "running"
        assert t.last_error == "prev failure"  # 保留（未被覆盖）
        assert t.consecutive_failures == 2  # 保留（未清零）
        assert t.total_runs == 1


async def test_finalize_idle_marker_preserves_all(db_engine, monkeypatch):
    """patrol_lifecycle=idle：last_status/last_error/consecutive_failures 三字段全保留。"""
    factory = _sf(db_engine)
    monkeypatch.setattr(registry_mod, "AsyncSessionLocal", factory)
    registry = registry_mod.ScheduledTaskRegistry()

    task_id, exec_id = await _seed_task_and_execution(
        db_engine, last_status="failed", last_error="prev failure", consecutive_failures=2
    )
    await registry._finalize_execution(
        exec_id,
        task_id,
        HandlerResult(status="ok", metrics={PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IDLE}),
        datetime.now(UTC),
        time.monotonic(),
    )

    async with factory() as db:
        t = await db.get(ScheduledTask, task_id)
        assert t.last_status == "failed"  # 保留（未被 ok 覆盖）
        assert t.last_error == "prev failure"
        assert t.consecutive_failures == 2
        assert t.total_runs == 1


async def test_finalize_normal_ok_resets_failures(db_engine, monkeypatch):
    """回归：无 patrol_lifecycle 标记（普通 handler / patrol stage_failed）→ 既有 ok 语义不变。"""
    factory = _sf(db_engine)
    monkeypatch.setattr(registry_mod, "AsyncSessionLocal", factory)
    registry = registry_mod.ScheduledTaskRegistry()

    task_id, exec_id = await _seed_task_and_execution(
        db_engine, last_status="failed", last_error="prev failure", consecutive_failures=2
    )
    await registry._finalize_execution(
        exec_id,
        task_id,
        HandlerResult(status="ok"),  # 无标记
        datetime.now(UTC),
        time.monotonic(),
    )

    async with factory() as db:
        t = await db.get(ScheduledTask, task_id)
        assert t.last_status == "ok"
        assert t.last_error is None  # ok 覆盖
        assert t.consecutive_failures == 0  # 清零
