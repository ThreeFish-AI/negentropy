"""``pdf_fidelity_patrol`` handler — PDF→Markdown 高保真自拟合巡检的**节奏权威**。

由统一调度引擎按 ``interval``（默认 3600s / 1h）tick。每 tick（轻量、仅 DB + 短 IO）：

1. **确保巡检 Repository**：幂等 upsert 名为 ``negentropy`` 的 Repository（local_path 从
   ``settings.routine.patrol_repo_local_path`` 或 negentropy 包路径推导；无法确定则返回
   not configured，引导改用 Interface/Repositories 手工注册）。
2. **确定性沉淀终态巡检 Routine 的文档终态**：扫到 ``config->>'patrol'=true`` 且已终态但未落记忆的
   Routine，依 ``best_score`` + 合格阈值（``patrol_qualified_score_threshold``，契约自报 done 兜底）
   把文档标 done（合格）/unfixable（尽力）——保证文档必进 ``skip_ids``、被推进，不再死循环；
   cancelled 不沉淀（用户干预，文档保持可被重新选中）。
3. **跳过并发**：存在 ``status='running'`` 的巡检 Routine → 本 tick SKIP（保证「上一轮结束后
   再启下一轮」；ScheduledTask 的 ``interval`` 计 ``next_fire_at = 完成时刻 + 3600s``，叠加此
   互斥即满足「巡检进行中则等待其结束 + 1h」语义）。
4. **选下一份待检生产 PDF**：``knowledge_documents`` 中 ``content_type LIKE '%pdf%'`` 且
   ``markdown_extract_status='completed'``，排除记忆中已 done/unfixable 的 doc_id。
5. **预取源 PDF**：``BlobStorage.download(content_uri)`` → 暂存到 ``patrol_input_dir/<doc_id>/``。
6. **创建并启动巡检 Routine**（``status='running'``，绑定 Repository，worktree + FINALIZE PR +
   0-100 评估闭环）。其 Claude Code 会话即 NegentropyEngine，依三系部协议循环拟合至合格阈值
   （``success_score_threshold=patrol_qualified_score_threshold``，默认 95）即 SUCCESS、推进下一份。

真正的 Claude Code 长耗执行交由 ``routine_inspector``（25s tick）驱动的 Routine 编排闭环异步完成，
本 handler 恒不阻塞调度心跳。

参考文献：
[1] AGENTS.md · 复用驱动 / 边界管理 / 最小干预。
[2] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer 工作流。
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.perception import resolve_effective_display_name
from negentropy.models.repository import Repository
from negentropy.models.routine import Routine

from . import (
    PATROL_LIFECYCLE_IDLE,
    PATROL_LIFECYCLE_IN_FLIGHT,
    PATROL_LIFECYCLE_KEY,
    HandlerDescriptor,
    HandlerResult,
    register_descriptor,
    register_handler,
)

if TYPE_CHECKING:
    from negentropy.models.scheduled_task import ScheduledTask

logger = get_logger("negentropy.engine.schedulers.handlers.pdf_fidelity_patrol")

PATROL_HANDLER_KIND = "pdf_fidelity_patrol"
PATROL_REPO_NAME = "negentropy"
PATROL_KEY_PREFIX = "pdf-fidelity-patrol"
CANDIDATE_MD_FILENAME = "patrol-candidate.md"
SOURCE_PDF_FILENAME = "source.pdf"


def _doc_display_title(doc: dict[str, Any]) -> str:
    """文档展示标题（复用 ``perception.resolve_effective_display_name`` SSOT 内核）。

    raw-SQL dict 直喂纯解析器：``display_name``（用户修正）→ ``metadata_title``
    （PDF 自动抽取）→ ``original_filename``（兜底）。避免把 knowledge 重图拖入 engine 顶层。
    """
    return resolve_effective_display_name(doc.get("display_name"), doc.get("metadata_title"), doc["original_filename"])


register_descriptor(
    HandlerDescriptor(
        handler_kind=PATROL_HANDLER_KIND,
        label="PDF Fidelity Patrol",
        description=(
            "每 1h 轮询一份生产 PDF 文档，启动一个 NegentropyEngine 巡检 Routine："
            "视觉对比 Markdown↔PDF、改 perceives、重转、评分，拟合至满分；"
            "Perceives 改进经非回归校验后以 PR 合回基线。"
        ),
        supported_trigger_types=("interval",),
        default_trigger_type="interval",
    )
)


@register_handler(PATROL_HANDLER_KIND)
async def pdf_fidelity_patrol_handler(task: ScheduledTask) -> HandlerResult:
    """单次巡检 tick。"""
    if not settings.routine.enabled:
        return HandlerResult(
            status="ok",
            output_summary="routine subsystem disabled",
            metrics={"reason": "routine_disabled", PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IDLE},
        )
    if not settings.routine.patrol_enabled:
        return HandlerResult(
            status="ok",
            output_summary="patrol disabled (settings.routine.patrol_enabled)",
            metrics={"reason": "patrol_disabled", PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IDLE},
        )

    try:
        return await _run_patrol_tick(task_key=task.key)
    except Exception as exc:  # noqa: BLE001 — 心跳不因单 tick 异常中断
        logger.warning("pdf_fidelity_patrol_tick_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


async def _run_patrol_tick(*, task_key: str) -> HandlerResult:
    baseline_branch = settings.routine.patrol_baseline_branch

    async with AsyncSessionLocal() as db:
        repo_id = await _ensure_patrol_repository(db, baseline_branch=baseline_branch)
        if repo_id is None:
            await db.rollback()
            return HandlerResult(
                status="ok",
                output_summary=(
                    "patrol repo not configured: set NE_ROUTINE_PATROL_REPO_LOCAL_PATH "
                    "to a valid negentropy checkout, or register via Interface/Repositories"
                ),
                metrics={"reason": "repo_not_configured", PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IDLE},
            )
        finalized = await _finalize_terminal_patrols(db)
        propagated = await _propagate_patrol_outcomes(db)
        await db.commit()
        if propagated:
            logger.info("patrol_outcomes_propagated", count=propagated)

    # 跳过并发（独立短事务，避免长读）
    async with AsyncSessionLocal() as db:
        if await _has_running_patrol(db):
            return HandlerResult(
                status="ok",
                output_summary="patrol in progress, skipped",
                metrics={
                    "reason": "in_progress",
                    "finalized": finalized,
                    PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IN_FLIGHT,
                },
            )

    # 选下一份待检 PDF
    async with AsyncSessionLocal() as db:
        from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

        store = PatrolMemoryStore(db)
        skip_ids = await store.get_skip_doc_ids()
        doc = await _select_next_pending_doc(db, skip_ids=skip_ids)
    if doc is None:
        return HandlerResult(
            status="ok",
            output_summary="no pending PDF documents",
            metrics={"reason": "no_pending_docs", "finalized": finalized, PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IDLE},
        )

    # 预取源 PDF（blob IO，独立于 DB 事务）
    doc_id = str(doc["id"])
    try:
        source_pdf_path, source_read_dir = await _stage_source_pdf(doc_id=doc_id, uri=doc["content_uri"])
    except Exception as exc:
        logger.warning("patrol_stage_source_pdf_failed", doc_id=doc_id, error=str(exc))
        return HandlerResult(
            status="failed",
            error=f"stage source pdf failed: {exc}",
            metrics={"reason": "stage_source_pdf_failed", "doc_id": doc_id},
        )

    # 确保回归基线集 + 创建并启动巡检 Routine
    async with AsyncSessionLocal() as db:
        regression_sample = await _ensure_regression_sample(db)
        routine_id = await _create_and_start_patrol_routine(
            db,
            repo_id=repo_id,
            baseline_branch=baseline_branch,
            doc=doc,
            source_pdf_path=source_pdf_path,
            source_read_dir=source_read_dir,
            regression_sample=regression_sample,
            source_task_key=task_key,
        )
        await db.commit()

    logger.info(
        "patrol_routine_started",
        doc_id=doc_id,
        routine_id=str(routine_id),
        doc_title=_doc_display_title(doc),
    )
    return HandlerResult(
        status="ok",
        output_summary=f"patrol started: doc={doc_id} ({_doc_display_title(doc)})",
        metrics={
            "reason": "spawned",
            "doc_id": doc_id,
            "routine_id": str(routine_id),
            "finalized": finalized,
            PATROL_LIFECYCLE_KEY: PATROL_LIFECYCLE_IN_FLIGHT,
        },
    )


# ---------------------------------------------------------------------------
# Repository 确保运行期 upsert（local_path 运行期解析，不写迁移）
# ---------------------------------------------------------------------------


def _derive_repo_root(*, configured: str | None = None) -> str | None:
    """解析引擎宿主机上的 negentropy 主仓 checkout 根（.git 所在目录）。

    优先 ``configured``（测试注入）或 ``settings.routine.patrol_repo_local_path``；
    为空则从 negentropy 包文件向上找 ``.git`` + ``apps/``。
    """
    cfg = settings.routine.patrol_repo_local_path if configured is None else configured
    cfg = (cfg or "").strip()
    if cfg:
        return cfg if os.path.isdir(cfg) else None
    try:
        import negentropy  # noqa: PLC0415 — 延迟 import 避免循环

        pkg_file = Path(negentropy.__file__).resolve()
    except Exception:  # noqa: BLE001
        return None
    for parent in pkg_file.parents:
        if (parent / ".git").exists() and (parent / "apps").is_dir():
            return str(parent)
    return None


async def _ensure_patrol_repository(db, *, baseline_branch: str) -> uuid.UUID | None:
    """幂等确保名为 ``negentropy`` 的 Repository；返回其 id（无法确定 local_path → None）。"""
    repo_root = _derive_repo_root()
    if not repo_root or not os.path.isdir(os.path.join(repo_root, ".git")):
        logger.warning("patrol_repo_root_unresolved")
        return None

    row = await db.execute(
        sa.text("SELECT id FROM negentropy.repositories WHERE name = :n").bindparams(n=PATROL_REPO_NAME)
    )
    existing_id = row.scalar()
    if existing_id:
        return uuid.UUID(str(existing_id))

    repo = Repository(
        owner_id="system",
        visibility="PUBLIC",
        name=PATROL_REPO_NAME,
        display_name="Negentropy（主仓）",
        description="pdf-fidelity-patrol 巡检自动注册的 negentropy 主仓锚点（worktree 派生源）。",
        github_url=settings.routine.patrol_repo_github_url,
        local_path=repo_root,
        baseline_branch=baseline_branch,
        default_remote=settings.routine.git_remote,
        is_enabled=True,
        is_system=True,
        config={},
        sort_order=0,
    )
    db.add(repo)
    await db.flush()
    return repo.id


# ---------------------------------------------------------------------------
# 终态巡检 Routine 的契约记忆沉淀
# ---------------------------------------------------------------------------


async def _finalize_terminal_patrols(db) -> int:
    """对终态但未落记忆的巡检 Routine，**确定性**沉淀文档终态 → 标记 memory_persisted。

    每个 succeeded/failed 终态 Routine 必定把其文档标为 done（合格）/unfixable（尽力），
    从而文档进 skip_ids、被推进——不再因 agent 不自报 done 而死循环（修「始终拟合同一份文档」根因）。
    cancelled 不沉淀状态（用户干预，文档保持可被重新选中），仅标记避免每 tick 重扫。

    终态判定（``PatrolMemoryStore.persist_terminal_outcome``）：契约自报 done **或** best_score ≥
    ``patrol_qualified_score_threshold`` → done；否则 unfixable；cancelled 跳过。
    score 写 best_score（跨迭代权威峰值，非末轮分）；契约缺失/解析失败亦以 best_score 兜底沉淀。

    同文档多 Routine 时按 ``best_score ASC NULLS FIRST`` 处理 → upsert 末写即最高 best_score，
    保证「最佳拟合」语义（cancelled/NULL 先处理、被高分覆盖）。

    返回处理条数。
    """
    rows = await db.execute(
        sa.text(
            "SELECT id, status, best_score, config->>'doc_id' AS doc_id "
            "FROM negentropy.routines "
            "WHERE config->>'patrol' = 'true' "
            "AND status IN ('succeeded','failed','cancelled') "
            "AND (config->>'memory_persisted' IS NULL OR config->>'memory_persisted' <> 'true') "
            "ORDER BY best_score ASC NULLS FIRST"
        )
    )
    candidates = rows.fetchall()
    if not candidates:
        return 0

    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore, parse_contract

    store = PatrolMemoryStore(db)
    qualified_threshold = settings.routine.patrol_qualified_score_threshold
    count = 0
    for routine_id, routine_status, best_score, doc_id_cfg in candidates:
        rid = uuid.UUID(str(routine_id))

        if routine_status == "cancelled":
            # 用户干预：不沉淀状态记忆（文档保持可被重新选中），仅标记避免每 tick 重扫。
            await _mark_memory_persisted(db, rid)
            count += 1
            continue

        # 末轮契约（doc_id 兜底 + regions/patterns 提取；best_score 兜底保证契约缺失亦沉淀）
        summ_row = await db.execute(
            sa.text(
                "SELECT summary FROM negentropy.routine_iterations "
                "WHERE routine_id = :rid AND status = 'evaluated' "
                "ORDER BY seq DESC LIMIT 1"
            ).bindparams(rid=rid)
        )
        summary = summ_row.scalar()
        contract = parse_contract(summary if isinstance(summary, str) else None)

        # doc_id 优先 routine config（handler 创建时权威写入），契约内兜底
        doc_id = str(doc_id_cfg or "").strip() or str((contract or {}).get("doc_id") or "").strip()
        if not doc_id:
            # config 与契约均无 doc_id（异常）——无法沉淀，仅标记避免重扫（防御性，不应发生）。
            logger.warning("patrol_finalize_missing_doc_id", routine_id=str(rid))
            await _mark_memory_persisted(db, rid)
            count += 1
            continue

        try:
            await store.persist_terminal_outcome(
                doc_id=doc_id,
                routine_id=str(rid),
                best_score=int(best_score) if best_score is not None else None,
                qualified_threshold=qualified_threshold,
                contract=contract,
                routine_status=routine_status,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("patrol_persist_terminal_outcome_failed", routine_id=str(rid), error=str(exc))
            await _mark_memory_persisted(db, rid)
            count += 1
            continue

        await _mark_memory_persisted(db, rid)
        count += 1
    return count


async def _mark_memory_persisted(db, rid: uuid.UUID) -> None:
    """幂等标记 Routine 的契约记忆已沉淀（避免每 tick 重扫致日志/IO 膨胀）。"""
    await db.execute(
        sa.text(
            "UPDATE negentropy.routines "
            "SET config = COALESCE(config,'{}'::jsonb) || jsonb_build_object('memory_persisted', true) "
            "WHERE id = :rid"
        ).bindparams(rid=rid)
    )


# ---------------------------------------------------------------------------
# 终态 Routine 成败回写 ScheduledTask（聚合状态唯一权威写者）
# ---------------------------------------------------------------------------


async def _propagate_patrol_outcomes(db) -> int:
    """把终态 patrol Routine 的成败回写到派生它的 ScheduledTask。

    patrol 是 fire-and-forget：spawn 成功 ≠ Routine 成功。per-tick 的 ``_finalize_execution``
    见 ``patrol_lifecycle`` 标记后不再写 ``ScheduledTask.last_status/last_error/
    consecutive_failures``，改由本函数在 Routine 终态时统一回写，使 Scheduler 任务状态与
    Routine 终态一致——``succeeded``→``ok``、``failed``→``failed``、``cancelled``→``cancelled``。
    ``consecutive_failures`` 语义与 ``_finalize_execution`` 对齐（failed→+1、succeeded→清零、
    cancelled→不变）。

    通过 ``Routine.config->>'source_task_key'``（SSOT 软关联）反查 ScheduledTask；
    ``config->>'outcome_propagated'='true'`` 幂等（与 ``memory_persisted`` 独立标记）。
    返回回写条数。
    """
    rows = await db.execute(
        sa.text(
            "SELECT id, status, termination_reason, config->>'source_task_key' AS source_task_key "
            "FROM negentropy.routines "
            "WHERE config->>'patrol' = 'true' "
            "AND status IN ('succeeded','failed','cancelled') "
            "AND config->>'outcome_propagated' IS DISTINCT FROM 'true' "
            "AND config->>'source_task_key' IS NOT NULL"
        )
    )
    candidates = rows.fetchall()
    if not candidates:
        return 0

    count = 0
    for routine_id, routine_status, termination_reason, source_task_key in candidates:
        if routine_status == "succeeded":
            last_status, cf_clause = "ok", "consecutive_failures = 0"
        elif routine_status == "failed":
            last_status, cf_clause = "failed", "consecutive_failures = consecutive_failures + 1"
        else:  # cancelled
            last_status, cf_clause = "cancelled", "consecutive_failures = consecutive_failures"
        last_error = termination_reason if routine_status == "failed" else None

        updated = await db.execute(
            sa.text(
                "UPDATE negentropy.scheduled_tasks "
                "SET last_status = :last_status, last_error = :last_error, "
                f"{cf_clause} "
                "WHERE key = :source_task_key"
            ).bindparams(
                last_status=last_status,
                last_error=last_error,
                source_task_key=source_task_key,
            )
        )
        if updated.rowcount == 0:
            # 源 ScheduledTask 不存在（已删 / key 漂移）—— 仍标记 Routine 已传播，避免每 tick 重扫。
            logger.warning(
                "patrol_propagate_source_task_missing",
                routine_id=str(routine_id),
                source_task_key=source_task_key,
            )

        await db.execute(
            sa.text(
                "UPDATE negentropy.routines "
                "SET config = COALESCE(config,'{}'::jsonb) || jsonb_build_object('outcome_propagated', true) "
                "WHERE id = :rid"
            ).bindparams(rid=routine_id)
        )
        count += 1
    return count


# ---------------------------------------------------------------------------
# 并发跳过
# ---------------------------------------------------------------------------


async def _has_running_patrol(db) -> bool:
    row = await db.execute(
        sa.text("SELECT 1 FROM negentropy.routines WHERE config->>'patrol' = 'true' AND status = 'running' LIMIT 1")
    )
    return row.fetchone() is not None


# ---------------------------------------------------------------------------
# 选下一份待检 PDF
# ---------------------------------------------------------------------------


async def _select_next_pending_doc(db, *, skip_ids: set[str]) -> dict[str, Any] | None:
    """选最早入库、未 done/unfixable 的 PDF 文档（content_type=pdf 且转换已完成）。"""
    params: dict[str, Any] = {"app": settings.app_name}
    exclude_clause = ""
    if skip_ids:
        exclude_clause = "AND id::text NOT IN :skip"
        params["skip"] = tuple(skip_ids)

    sql = (
        "SELECT id, content_uri, original_filename, display_name, metadata->>'title' "
        "FROM negentropy.knowledge_documents "
        "WHERE app_name = :app "
        "AND COALESCE(content_type,'') ILIKE '%pdf%' "
        "AND markdown_extract_status = 'completed' "
        f"{exclude_clause} "
        "ORDER BY created_at ASC LIMIT 1"
    )
    stmt = sa.text(sql)
    if skip_ids:
        stmt = stmt.bindparams(sa.bindparam("skip", expanding=True))
    row = await db.execute(stmt, params)
    r = row.fetchone()
    if not r:
        return None
    return {
        "id": r[0],
        "content_uri": r[1],
        "original_filename": r[2],
        "display_name": r[3],
        "metadata_title": r[4],
    }


async def _select_regression_sample(db, *, size: int) -> list[str]:
    """分层抽取近 ``size`` 份已转换 PDF 作为回归基线样本（doc_id 字符串列表）。"""
    rows = await db.execute(
        sa.text(
            "SELECT id::text FROM negentropy.knowledge_documents "
            "WHERE app_name = :app "
            "AND COALESCE(content_type,'') ILIKE '%pdf%' "
            "AND markdown_extract_status = 'completed' "
            "ORDER BY created_at DESC LIMIT :n"
        ).bindparams(app=settings.app_name, n=size)
    )
    return [r[0] for r in rows.fetchall()]


async def _ensure_regression_sample(db) -> list[str]:
    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

    store = PatrolMemoryStore(db)
    baseline = await store.get_baseline()
    sample = (baseline or {}).get("sample_doc_ids") or []
    if sample:
        return sample
    sample = await _select_regression_sample(db, size=settings.routine.patrol_regression_sample_size)
    if sample:
        await store.set_baseline(sample_doc_ids=sample, scores=None)
    return sample


# ---------------------------------------------------------------------------
# 源 PDF 预取（blob → 本地暂存，read_dirs 只读授予）
# ---------------------------------------------------------------------------


async def _stage_source_pdf(*, doc_id: str, uri: str) -> tuple[str, str]:
    """下载源 PDF 字节到 ``<input_dir>/<doc_id>/source.pdf``；返回 (绝对路径, 所在目录)。"""
    from negentropy.storage import get_blob_storage

    doc_dir = Path(settings.routine.patrol_input_dir) / doc_id
    doc_dir.mkdir(parents=True, exist_ok=True)
    source_path = doc_dir / SOURCE_PDF_FILENAME
    # 已暂存且非空则复用（幂等，省 blob 读取）
    if not (source_path.exists() and source_path.stat().st_size > 0):
        data = await get_blob_storage().download(uri)
        source_path.write_bytes(data)
    return str(source_path), str(doc_dir)


# ---------------------------------------------------------------------------
# 创建并启动巡检 Routine（= NegentropyEngine · 单文档拟合至满分）
# ---------------------------------------------------------------------------


def _build_patrol_routine(
    *,
    repo_id: uuid.UUID,
    baseline_branch: str,
    doc: dict[str, Any],
    source_pdf_path: str,
    source_read_dir: str,
    regression_sample: list[str],
    source_task_key: str,
    known_unfixable_regions: list[dict[str, Any]] | None = None,
) -> Routine:
    """构造巡检 Routine ORM 对象（纯函数，无 DB —— 可单测验证字段装配无 AttributeError）。

    字段口径与 ``routine_api.create_routine`` 对齐。注意 ``no_progress_patience`` 是
    per-Routine DB 列（默认 3），**非** ``RoutineSettings`` 属性——勿读 settings（曾致
    ``'RoutineSettings' object has no attribute 'no_progress_patience'`` 全量执行异常）。
    """
    from negentropy.engine.routine import phase as phase_mod
    from negentropy.engine.routine.patrol_prompt import (
        build_acceptance_criteria,
        build_goal,
        build_routine_config,
    )

    doc_id = str(doc["id"])
    doc_title = _doc_display_title(doc)
    short = uuid.uuid4().hex[:8]
    qualified_threshold = settings.routine.patrol_qualified_score_threshold
    return Routine(
        key=f"{PATROL_KEY_PREFIX}/{doc_id}/{short}",
        title=f"PDF 高保真巡检：{doc_title}",
        display_name=f"PDF Fidelity Patrol · {doc_title}",
        description=(
            f"NegentropyEngine 巡检生产 PDF《{doc_title}》→ Markdown 高保真自拟合。"
            "三系部循环（视觉对比→改 perceives→重转→记忆）至合格阈值；PR 合回基线。"
        ),
        goal=build_goal(
            doc_id=doc_id,
            doc_title=doc_title,
            source_pdf_path=source_pdf_path,
            candidate_md_path=CANDIDATE_MD_FILENAME,
            qualified_threshold=qualified_threshold,
            known_unfixable_regions=known_unfixable_regions,
        ),
        acceptance_criteria=build_acceptance_criteria(
            baseline_branch=baseline_branch,
            qualified_threshold=qualified_threshold,
        ),
        cwd=None,  # 由 repository_id 派生 worktree cwd（单一事实源指针）
        baseline_branch=baseline_branch,
        repository_id=repo_id,
        verification_command=None,
        status="running",
        max_iterations=settings.routine.patrol_max_iterations_per_doc,
        max_cost_usd=settings.routine.patrol_max_cost_usd_per_doc,
        deadline_at=None,
        success_score_threshold=qualified_threshold,  # 合格阈值（默认 95）：收敛即 SUCCESS，不再误标 Failed
        no_progress_patience=3,  # per-Routine DB 列默认值（非 RoutineSettings 属性）
        approval_mode="auto",
        config=build_routine_config(
            doc_id=doc_id,
            source_pdf_path=source_pdf_path,
            candidate_md_path=CANDIDATE_MD_FILENAME,
            source_read_dir=source_read_dir,
            regression_sample=regression_sample,
            extra={"source_task_key": source_task_key},
        ),
        current_phase=phase_mod.initial_phase({}),  # 扁平工作流：IMPLEMENT 起；worktree 仍开 FINALIZE
        reflections={},
        owner_id="system",
        agent_id=None,
        is_template=False,
    )


async def _create_and_start_patrol_routine(
    db,
    *,
    repo_id: uuid.UUID,
    baseline_branch: str,
    doc: dict[str, Any],
    source_pdf_path: str,
    source_read_dir: str,
    regression_sample: list[str],
    source_task_key: str,
) -> uuid.UUID:
    """构造（_build_patrol_routine）+ 落库 + flush，返回 routine id。

    DB 写集中于此；构造逻辑（字段装配）抽到纯函数 _build_patrol_routine 便于无 DB 单测。
    构造前取出该文档**已知 unfixable 区域**注入 goal（跨 Routine 复用避让——修复「只写不读」半失效）。
    """
    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore

    known_unfixable_regions = await PatrolMemoryStore(db).get_unfixable_regions(str(doc["id"]))
    routine = _build_patrol_routine(
        repo_id=repo_id,
        baseline_branch=baseline_branch,
        doc=doc,
        source_pdf_path=source_pdf_path,
        source_read_dir=source_read_dir,
        regression_sample=regression_sample,
        source_task_key=source_task_key,
        known_unfixable_regions=known_unfixable_regions,
    )
    db.add(routine)
    await db.flush()
    return routine.id


__all__ = ["pdf_fidelity_patrol_handler"]
