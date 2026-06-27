"""``pdf_fidelity_patrol`` handler — PDF→Markdown 高保真自拟合巡检的**节奏权威**。

由统一调度引擎按 ``interval``（默认 3600s / 1h）tick。每 tick（轻量、仅 DB + 短 IO）：

1. **确保巡检 Repository**：幂等 upsert 名为 ``negentropy`` 的 Repository（local_path 从
   ``settings.routine.patrol_repo_local_path`` 或 negentropy 包路径推导；无法确定则返回
   not configured，引导改用 Interface/Repositories 手工注册）。
2. **沉淀终态巡检 Routine 的契约记忆**：扫到 ``config->>'patrol'=true`` 且已终态但未落记忆的
   Routine，解析其末轮 ``pdf-fidelity-contract`` JSON，写 done/unfixable/pattern 记忆。
3. **跳过并发**：存在 ``status='running'`` 的巡检 Routine → 本 tick SKIP（保证「上一轮结束后
   再启下一轮」；ScheduledTask 的 ``interval`` 计 ``next_fire_at = 完成时刻 + 3600s``，叠加此
   互斥即满足「巡检进行中则等待其结束 + 1h」语义）。
4. **选下一份待检生产 PDF**：``knowledge_documents`` 中 ``content_type LIKE '%pdf%'`` 且
   ``markdown_extract_status='completed'``，排除记忆中已 done/unfixable 的 doc_id。
5. **预取源 PDF**：``BlobStorage.download(content_uri)`` → 暂存到 ``patrol_input_dir/<doc_id>/``。
6. **创建并启动巡检 Routine**（``status='running'``，绑定 Repository，worktree + FINALIZE PR +
   0-100 评估闭环）。其 Claude Code 会话即 NegentropyEngine，依三系部协议循环拟合至满分。

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
from negentropy.models.repository import Repository
from negentropy.models.routine import Routine

from . import HandlerDescriptor, HandlerResult, register_descriptor, register_handler

if TYPE_CHECKING:
    from negentropy.models.scheduled_task import ScheduledTask

logger = get_logger("negentropy.engine.schedulers.handlers.pdf_fidelity_patrol")

PATROL_HANDLER_KIND = "pdf_fidelity_patrol"
PATROL_REPO_NAME = "negentropy"
PATROL_KEY_PREFIX = "pdf-fidelity-patrol"
CANDIDATE_MD_FILENAME = "patrol-candidate.md"
SOURCE_PDF_FILENAME = "source.pdf"

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
        return HandlerResult(status="ok", output_summary="routine subsystem disabled")
    if not settings.routine.patrol_enabled:
        return HandlerResult(status="ok", output_summary="patrol disabled (settings.routine.patrol_enabled)")

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
            )
        finalized = await _finalize_terminal_patrols(db)
        await db.commit()

    # 跳过并发（独立短事务，避免长读）
    async with AsyncSessionLocal() as db:
        if await _has_running_patrol(db):
            return HandlerResult(
                status="ok",
                output_summary="patrol in progress, skipped",
                metrics={"finalized": finalized},
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
            metrics={"finalized": finalized},
        )

    # 预取源 PDF（blob IO，独立于 DB 事务）
    doc_id = str(doc["id"])
    try:
        source_pdf_path, source_read_dir = await _stage_source_pdf(doc_id=doc_id, uri=doc["content_uri"])
    except Exception as exc:
        logger.warning("patrol_stage_source_pdf_failed", doc_id=doc_id, error=str(exc))
        return HandlerResult(status="failed", error=f"stage source pdf failed: {exc}", metrics={"doc_id": doc_id})

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
        doc_title=doc["original_filename"],
    )
    return HandlerResult(
        status="ok",
        output_summary=f"patrol started: doc={doc_id} ({doc['original_filename']})",
        metrics={"doc_id": doc_id, "routine_id": str(routine_id), "finalized": finalized},
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
    """对终态但未落记忆的巡检 Routine，解析末轮契约 → 写记忆 → 标记 memory_persisted。

    返回沉淀条数。
    """
    rows = await db.execute(
        sa.text(
            "SELECT id, key FROM negentropy.routines "
            "WHERE config->>'patrol' = 'true' "
            "AND status IN ('succeeded','failed','cancelled') "
            "AND (config->>'memory_persisted' IS NULL OR config->>'memory_persisted' <> 'true')"
        )
    )
    candidates = rows.fetchall()
    if not candidates:
        return 0

    from negentropy.engine.routine.patrol_memory import PatrolMemoryStore, parse_contract

    store = PatrolMemoryStore(db)
    count = 0
    for routine_id, _key in candidates:
        rid = uuid.UUID(str(routine_id))
        summ_row = await db.execute(
            sa.text(
                "SELECT summary FROM negentropy.routine_iterations "
                "WHERE routine_id = :rid AND status = 'evaluated' "
                "ORDER BY seq DESC LIMIT 1"
            ).bindparams(rid=rid)
        )
        summary = summ_row.scalar()
        contract = parse_contract(summary if isinstance(summary, str) else None)
        if contract:
            try:
                await store.persist_contract(contract=contract, routine_id=str(rid))
            except Exception as exc:  # noqa: BLE001
                logger.warning("patrol_persist_contract_failed", routine_id=str(rid), error=str(exc))
                continue
        await db.execute(
            sa.text(
                "UPDATE negentropy.routines "
                "SET config = COALESCE(config,'{}'::jsonb) || jsonb_build_object('memory_persisted', true) "
                "WHERE id = :rid"
            ).bindparams(rid=rid)
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
        "SELECT id, content_uri, original_filename FROM negentropy.knowledge_documents "
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
    return {"id": r[0], "content_uri": r[1], "original_filename": r[2]}


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
    from negentropy.engine.routine import phase as phase_mod
    from negentropy.engine.routine.patrol_prompt import (
        build_acceptance_criteria,
        build_goal,
        build_routine_config,
    )

    doc_id = str(doc["id"])
    doc_title = doc["original_filename"]
    short = uuid.uuid4().hex[:8]
    routine = Routine(
        key=f"{PATROL_KEY_PREFIX}/{doc_id}/{short}",
        title=f"PDF 高保真巡检：{doc_title}",
        display_name=f"PDF Fidelity Patrol · {doc_title}",
        description=(
            f"NegentropyEngine 巡检生产 PDF《{doc_title}》→ Markdown 高保真自拟合。"
            "三系部循环（视觉对比→改 perceives→重转→记忆）至满分；PR 合回基线。"
        ),
        goal=build_goal(
            doc_id=doc_id,
            doc_title=doc_title,
            source_pdf_path=source_pdf_path,
            candidate_md_path=CANDIDATE_MD_FILENAME,
        ),
        acceptance_criteria=build_acceptance_criteria(baseline_branch=baseline_branch),
        cwd=None,  # 由 repository_id 派生 worktree cwd（单一事实源指针）
        baseline_branch=baseline_branch,
        repository_id=repo_id,
        verification_command=None,
        status="running",
        max_iterations=settings.routine.patrol_max_iterations_per_doc,
        max_cost_usd=settings.routine.default_max_cost_usd,
        deadline_at=None,
        success_score_threshold=100,
        no_progress_patience=settings.routine.no_progress_patience,
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
    db.add(routine)
    await db.flush()
    return routine.id


__all__ = ["pdf_fidelity_patrol_handler"]
