"""
Memory API Router

提供用户记忆 (Memory) 的独立 REST API，与 Knowledge API 正交分离。

Memory 是动态、个人化、受遗忘曲线影响的用户记忆，
与 Knowledge（静态、共享、持久化）在概念和职责上完全独立。

核心职责:
1. Memory Timeline: 列出用户记忆时间线
2. Facts: 管理结构化语义记忆 (key-value)
3. Search: 搜索记忆与 Facts
4. Audit: 审计治理 (Retain/Delete/Anonymize)
5. Dashboard: Memory 指标概览

复用:
- engine/factories/memory.py → get_memory_service(), get_fact_service(), get_memory_governance_service()
- engine/adapters/postgres/memory_service.py → PostgresMemoryService
- engine/adapters/postgres/fact_service.py → FactService
- engine/governance/memory.py → MemoryGovernanceService
- models/internalization.py → Memory, Fact, MemoryAuditLog

参考文献:
[1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.
[2] Google ADK, "MemoryBank" pattern for structured fact storage.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact, Memory, MemoryAuditLog

from .adapters.postgres.memory_automation_service import MemoryAutomationUnavailableError
from .factories.memory import (
    get_association_service,
    get_conflict_resolver,
    get_fact_service,
    get_memory_automation_service,
    get_memory_governance_service,
    get_memory_service,
    get_proactive_recall_service,
)

logger = get_logger("negentropy.engine.api")
router = APIRouter(prefix="/memory", tags=["memory"])


# ============================================================================
# Request / Response Models
# ============================================================================


class MemoryItem(BaseModel):
    id: str
    user_id: str
    app_name: str
    memory_type: str
    content: str
    retention_score: float
    importance_score: float = 0.5
    access_count: int
    created_at: str | None = None
    last_accessed_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryListResponse(BaseModel):
    users: list[dict[str, str]] = Field(default_factory=list)
    timeline: list[MemoryItem] = Field(default_factory=list)
    policies: dict[str, Any] = Field(default_factory=dict)


class MemorySearchRequest(BaseModel):
    app_name: str | None = None
    user_id: str
    query: str
    memory_type: str | None = None
    date_from: str | None = None  # ISO 8601 date
    date_to: str | None = None  # ISO 8601 date
    limit: int = 10
    offset: int = 0


class MemorySearchResponse(BaseModel):
    count: int
    total: int = 0
    items: list[dict[str, Any]] = Field(default_factory=list)


class FactItem(BaseModel):
    id: str
    user_id: str
    app_name: str
    fact_type: str
    key: str
    value: dict[str, Any]
    confidence: float
    importance_score: float = 0.5
    valid_from: str | None = None
    valid_until: str | None = None
    created_at: str | None = None


class FactListResponse(BaseModel):
    count: int
    items: list[FactItem] = Field(default_factory=list)


class FactSearchRequest(BaseModel):
    app_name: str | None = None
    user_id: str
    query: str
    limit: int = 10


class AuditRequest(BaseModel):
    app_name: str | None = None
    user_id: str
    decisions: dict[str, str]
    expected_versions: dict[str, int] | None = None
    note: str | None = None
    idempotency_key: str | None = None


class AuditRecordResponse(BaseModel):
    memory_id: str
    decision: str
    version: int | None = None
    note: str | None = None
    created_at: str | None = None


class AuditResponse(BaseModel):
    status: str
    audits: list[AuditRecordResponse] = Field(default_factory=list)


class MemoryDashboardResponse(BaseModel):
    user_count: int
    memory_count: int
    fact_count: int
    avg_retention_score: float
    avg_importance_score: float = 0.0
    low_retention_count: int
    high_importance_count: int = 0
    recent_audit_count: int


class MemoryAutomationFunctionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    schema_name: str = Field(alias="schema", serialization_alias="schema")
    status: str
    definition: str
    managed: bool = True


class MemoryAutomationJobResponse(BaseModel):
    job_key: str
    process_label: str
    function_name: str
    enabled: bool
    status: str
    job_id: int | None = None
    schedule: str
    command: str
    active: bool = False


class MemoryAutomationProcessResponse(BaseModel):
    key: str
    label: str
    description: str
    config: dict[str, Any] = Field(default_factory=dict)
    job: MemoryAutomationJobResponse | None = None
    functions: list[MemoryAutomationFunctionResponse] = Field(default_factory=list)


class MemoryAutomationCapabilitiesResponse(BaseModel):
    pg_cron_installed: bool
    pg_cron_available: bool
    management_mode: str
    degraded_reasons: list[str] = Field(default_factory=list)


class MemoryAutomationHealthResponse(BaseModel):
    status: str
    recent_log_count: int


class MemoryAutomationSnapshotResponse(BaseModel):
    capabilities: MemoryAutomationCapabilitiesResponse
    config: dict[str, Any]
    processes: list[MemoryAutomationProcessResponse]
    functions: list[MemoryAutomationFunctionResponse]
    jobs: list[MemoryAutomationJobResponse]
    health: MemoryAutomationHealthResponse


class MemoryAutomationLogItemResponse(BaseModel):
    job_id: int | None = None
    run_id: int | None = None
    database: str | None = None
    username: str | None = None
    command: str | None = None
    status: str | None = None
    return_message: str | None = None
    start_time: str | None = None
    end_time: str | None = None


class MemoryAutomationLogsResponse(BaseModel):
    count: int
    items: list[MemoryAutomationLogItemResponse] = Field(default_factory=list)


class MemoryAutomationConfigUpdateRequest(BaseModel):
    app_name: str | None = None
    config: dict[str, Any]


class MemoryAutomationRunResponse(BaseModel):
    job_key: str
    process_label: str
    result: int | None = None
    snapshot: MemoryAutomationSnapshotResponse


# ============================================================================
# Helpers
# ============================================================================


def _resolve_app_name(app_name: str | None) -> str:
    return app_name or settings.app_name


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _require_admin(user: AuthUser) -> AuthUser:
    if "admin" not in user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
    return user


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/dashboard", response_model=MemoryDashboardResponse)
async def get_memory_dashboard(
    app_name: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> MemoryDashboardResponse:
    """Memory 概览指标

    展示用户数、记忆总数、Facts 数量、平均 retention_score、低保留记忆告警。
    """
    resolved_app = _resolve_app_name(app_name)

    async with AsyncSessionLocal() as db:
        # 基础条件（统一 user_id 过滤，确保所有查询行为一致）
        memory_filters = [Memory.app_name == resolved_app]
        audit_filters = [MemoryAuditLog.app_name == resolved_app]
        fact_filters = [Fact.app_name == resolved_app]

        if user_id:
            memory_filters.append(Memory.user_id == user_id)
            audit_filters.append(MemoryAuditLog.user_id == user_id)
            fact_filters.append(Fact.user_id == user_id)

        # 用户数
        user_count = await db.scalar(select(func.count(func.distinct(Memory.user_id))).where(*memory_filters))

        # 记忆总数
        memory_count = await db.scalar(
            select(func.count()).select_from(select(Memory).where(*memory_filters).subquery())
        )

        # Facts 数量
        now = datetime.now(UTC)
        fact_count = await db.scalar(
            select(func.count()).select_from(
                select(Fact)
                .where(
                    *fact_filters,
                    (Fact.valid_until.is_(None)) | (Fact.valid_until > now),
                )
                .subquery()
            )
        )

        # 平均 retention_score
        avg_retention = await db.scalar(select(func.avg(Memory.retention_score)).where(*memory_filters))

        # 平均 importance_score
        avg_importance = await db.scalar(select(func.avg(Memory.importance_score)).where(*memory_filters))

        # 低保留记忆数 (retention_score < 0.1)
        low_retention_count = await db.scalar(
            select(func.count()).select_from(
                select(Memory)
                .where(
                    *memory_filters,
                    Memory.retention_score < 0.1,
                )
                .subquery()
            )
        )

        # 高重要性记忆数 (importance_score >= 0.7)
        high_importance_count = await db.scalar(
            select(func.count()).select_from(
                select(Memory)
                .where(
                    *memory_filters,
                    Memory.importance_score >= 0.7,
                )
                .subquery()
            )
        )

        # 近期审计数
        recent_audit_count = await db.scalar(
            select(func.count()).select_from(select(MemoryAuditLog).where(*audit_filters).subquery())
        )

    return MemoryDashboardResponse(
        user_count=user_count or 0,
        memory_count=memory_count or 0,
        fact_count=fact_count or 0,
        avg_retention_score=round(float(avg_retention or 0), 4),
        avg_importance_score=round(float(avg_importance or 0), 4),
        low_retention_count=low_retention_count or 0,
        high_importance_count=high_importance_count or 0,
        recent_audit_count=recent_audit_count or 0,
    )


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    app_name: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> MemoryListResponse:
    """获取 Memory 列表（含 timeline）

    返回用户列表、记忆时间线和当前治理策略。
    """
    resolved_app = _resolve_app_name(app_name)
    automation = get_memory_automation_service()

    async with AsyncSessionLocal() as db:
        # 获取用户列表
        user_stmt = (
            select(Memory.user_id, func.count(Memory.id).label("count"))
            .where(Memory.app_name == resolved_app)
            .group_by(Memory.user_id)
            .order_by(func.count(Memory.id).desc())
        )
        user_result = await db.execute(user_stmt)
        user_rows = user_result.all()

        users = [{"id": row.user_id, "label": f"{row.user_id} ({row.count})"} for row in user_rows]

        # 获取记忆时间线
        memory_stmt = (
            select(Memory).where(Memory.app_name == resolved_app).order_by(Memory.created_at.desc()).limit(limit)
        )
        if user_id:
            memory_stmt = memory_stmt.where(Memory.user_id == user_id)

        memory_result = await db.execute(memory_stmt)
        memories = memory_result.scalars().all()

    timeline = [
        MemoryItem(
            id=str(m.id),
            user_id=m.user_id,
            app_name=m.app_name,
            memory_type=m.memory_type,
            content=m.content,
            retention_score=m.retention_score,
            importance_score=m.importance_score,
            access_count=m.access_count,
            created_at=_iso(m.created_at),
            last_accessed_at=_iso(m.last_accessed_at),
            metadata=m.metadata_ or {},
        )
        for m in memories
    ]

    policies = await automation.list_policy_summary(app_name=resolved_app)

    return MemoryListResponse(
        users=users,
        timeline=timeline,
        policies=policies,
    )


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories(payload: MemorySearchRequest) -> MemorySearchResponse:
    """搜索用户记忆

    基于混合检索 (Semantic + BM25) 搜索相关记忆。
    支持按记忆类型、日期范围过滤，以及分页。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    # 解析日期参数
    date_from = None
    date_to = None
    if payload.date_from:
        try:
            date_from = datetime.fromisoformat(payload.date_from)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date_from format: {payload.date_from}",
            ) from exc
    if payload.date_to:
        try:
            date_to = datetime.fromisoformat(payload.date_to)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date_to format: {payload.date_to}",
            ) from exc

    memory_service = get_memory_service()
    result = await memory_service.search_memory(
        app_name=resolved_app,
        user_id=payload.user_id,
        query=payload.query,
        limit=payload.limit,
        offset=payload.offset,
        memory_type=payload.memory_type,
        date_from=date_from,
        date_to=date_to,
    )

    items = []
    for entry in result.memories:
        content_text = ""
        if isinstance(entry.content, dict) and "parts" in entry.content:
            for part in entry.content["parts"]:
                if isinstance(part, dict) and "text" in part:
                    content_text += part["text"]
        elif isinstance(entry.content, str):
            content_text = entry.content

        items.append(
            {
                "id": entry.id,
                "content": content_text,
                "timestamp": entry.timestamp,
                "relevance_score": entry.relevance_score,
                "metadata": entry.custom_metadata or {},
            }
        )

    # TODO: total 应通过独立 COUNT 查询获取全量匹配数
    return MemorySearchResponse(count=len(items), total=-1, items=items)


@router.get("/facts", response_model=FactListResponse)
async def list_facts(
    app_name: str | None = Query(default=None),
    user_id: str = Query(...),
    fact_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> FactListResponse:
    """获取用户的 Facts (语义记忆)"""
    resolved_app = _resolve_app_name(app_name)
    fact_service = get_fact_service()

    facts = await fact_service.list_facts(
        user_id=user_id,
        app_name=resolved_app,
        fact_type=fact_type,
        limit=limit,
    )

    items = [
        FactItem(
            id=str(f.id),
            user_id=f.user_id,
            app_name=f.app_name,
            fact_type=f.fact_type,
            key=f.key,
            value=f.value,
            confidence=f.confidence,
            importance_score=f.importance_score,
            valid_from=_iso(f.valid_from),
            valid_until=_iso(f.valid_until),
            created_at=_iso(f.created_at),
        )
        for f in facts
    ]

    return FactListResponse(count=len(items), items=items)


@router.post("/facts/search", response_model=FactListResponse)
async def search_facts(payload: FactSearchRequest) -> FactListResponse:
    """搜索用户 Facts

    优先使用向量语义检索，回退到 key ilike 匹配。
    """
    resolved_app = _resolve_app_name(payload.app_name)
    fact_service = get_fact_service()

    facts = await fact_service.search_facts(
        user_id=payload.user_id,
        app_name=resolved_app,
        query=payload.query,
        limit=payload.limit,
    )

    items = [
        FactItem(
            id=str(f.id),
            user_id=f.user_id,
            app_name=f.app_name,
            fact_type=f.fact_type,
            key=f.key,
            value=f.value,
            confidence=f.confidence,
            importance_score=f.importance_score,
            valid_from=_iso(f.valid_from),
            valid_until=_iso(f.valid_until),
            created_at=_iso(f.created_at),
        )
        for f in facts
    ]

    return FactListResponse(count=len(items), items=items)


@router.post("/audit", response_model=AuditResponse)
async def submit_audit(payload: AuditRequest) -> AuditResponse:
    """提交记忆审计决策

    支持 Retain / Delete / Anonymize 三种操作，
    同时覆盖 Memory 和关联 Fact（GDPR 合规）。
    """
    resolved_app = _resolve_app_name(payload.app_name)
    governance = get_memory_governance_service()

    try:
        records = await governance.audit_memory(
            user_id=payload.user_id,
            app_name=resolved_app,
            decisions=payload.decisions,
            expected_versions=payload.expected_versions,
            note=payload.note,
            idempotency_key=payload.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    audits = [
        AuditRecordResponse(
            memory_id=r.memory_id,
            decision=r.decision,
            version=r.version,
            note=r.note,
            created_at=_iso(r.created_at),
        )
        for r in records
    ]

    return AuditResponse(status="ok", audits=audits)


@router.get("/audit/history")
async def get_audit_history(
    app_name: str | None = Query(default=None),
    user_id: str = Query(...),
    limit: int = Query(default=100, ge=1, le=1000),
) -> dict[str, Any]:
    """获取审计历史"""
    resolved_app = _resolve_app_name(app_name)
    governance = get_memory_governance_service()

    records = await governance.get_audit_history(
        user_id=user_id,
        app_name=resolved_app,
        limit=limit,
    )

    return {
        "count": len(records),
        "items": [
            {
                "memory_id": r.memory_id,
                "decision": r.decision,
                "version": r.version,
                "note": r.note,
                "created_at": _iso(r.created_at),
            }
            for r in records
        ],
    }


@router.get("/automation", response_model=MemoryAutomationSnapshotResponse)
async def get_memory_automation_snapshot(
    app_name: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> MemoryAutomationSnapshotResponse:
    _require_admin(user)
    service = get_memory_automation_service()
    snapshot = await service.get_snapshot(app_name=_resolve_app_name(app_name))
    return MemoryAutomationSnapshotResponse.model_validate(snapshot)


@router.get("/automation/logs", response_model=MemoryAutomationLogsResponse)
async def get_memory_automation_logs(
    app_name: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    user: AuthUser = Depends(get_current_user),
) -> MemoryAutomationLogsResponse:
    _require_admin(user)
    service = get_memory_automation_service()
    _ = _resolve_app_name(app_name)
    items = await service.get_logs(limit=limit)
    return MemoryAutomationLogsResponse(count=len(items), items=items)


@router.post("/automation/config", response_model=MemoryAutomationSnapshotResponse)
async def update_memory_automation_config(
    payload: MemoryAutomationConfigUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> MemoryAutomationSnapshotResponse:
    _require_admin(user)
    service = get_memory_automation_service()
    resolved_app = _resolve_app_name(payload.app_name)
    try:
        await service.update_config(
            app_name=resolved_app,
            config=payload.config,
            updated_by=user.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    snapshot = await service.get_snapshot(app_name=resolved_app)
    return MemoryAutomationSnapshotResponse.model_validate(snapshot)


@router.post("/automation/jobs/{job_key}/enable", response_model=MemoryAutomationSnapshotResponse)
async def enable_memory_automation_job(
    job_key: str,
    app_name: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> MemoryAutomationSnapshotResponse:
    _require_admin(user)
    service = get_memory_automation_service()
    try:
        snapshot = await service.enable_job(app_name=_resolve_app_name(app_name), job_key=job_key)  # type: ignore[arg-type]
    except MemoryAutomationUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MemoryAutomationSnapshotResponse.model_validate(snapshot)


@router.post("/automation/jobs/{job_key}/disable", response_model=MemoryAutomationSnapshotResponse)
async def disable_memory_automation_job(
    job_key: str,
    app_name: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> MemoryAutomationSnapshotResponse:
    _require_admin(user)
    service = get_memory_automation_service()
    try:
        snapshot = await service.disable_job(app_name=_resolve_app_name(app_name), job_key=job_key)  # type: ignore[arg-type]
    except MemoryAutomationUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MemoryAutomationSnapshotResponse.model_validate(snapshot)


@router.post("/automation/jobs/{job_key}/reconcile", response_model=MemoryAutomationSnapshotResponse)
async def reconcile_memory_automation_job(
    job_key: str,
    app_name: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> MemoryAutomationSnapshotResponse:
    _require_admin(user)
    service = get_memory_automation_service()
    try:
        snapshot = await service.reconcile_job(app_name=_resolve_app_name(app_name), job_key=job_key)  # type: ignore[arg-type]
    except MemoryAutomationUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return MemoryAutomationSnapshotResponse.model_validate(snapshot)


@router.post("/automation/jobs/{job_key}/run", response_model=MemoryAutomationRunResponse)
async def run_memory_automation_job(
    job_key: str,
    app_name: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> MemoryAutomationRunResponse:
    _require_admin(user)
    service = get_memory_automation_service()
    try:
        result = await service.run_job(app_name=_resolve_app_name(app_name), job_key=job_key)  # type: ignore[arg-type]
    except MemoryAutomationUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    result["snapshot"] = MemoryAutomationSnapshotResponse.model_validate(result["snapshot"])
    return MemoryAutomationRunResponse.model_validate(result)


# ============================================================================
# Retrieval Feedback — 检索效果反馈闭环
# ============================================================================


class RetrievalFeedbackRequest(BaseModel):
    """检索效果反馈请求（显式反馈通道）

    对齐 Rocchio 相关性反馈<sup>[[27]](#ref27)</sup>和 RLHF 偏好信号收集<sup>[[33]](#ref33)</sup>。
    """

    log_id: str = Field(..., description="检索日志 ID")
    outcome: str = Field(..., description="反馈结果: helpful | irrelevant | harmful")


class RetrievalMetricsResponse(BaseModel):
    """检索效果指标响应

    指标定义对齐 Manning et al.<sup>[[31]](#ref31)</sup>和 Shani & Gunawardana<sup>[[32]](#ref32)</sup>。
    """

    total_retrievals: int
    precision_at_k: float
    utilization_rate: float
    noise_rate: float


@router.post("/retrieval/feedback")
async def submit_retrieval_feedback(
    payload: RetrievalFeedbackRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, str]:
    """提交检索效果反馈（显式反馈通道）

    对齐 Rocchio 相关性反馈<sup>[[27]](#ref27)</sup>：用户对检索结果的
    helpful/irrelevant/harmful 判定作为后续检索权重调整的信号源。
    """
    from negentropy.engine.adapters.postgres.retrieval_tracker import RetrievalTracker

    tracker = RetrievalTracker()
    try:
        success = await tracker.record_feedback(
            log_id=UUID(payload.log_id),
            outcome=payload.outcome,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retrieval log not found")
    return {"status": "ok"}


@router.get("/retrieval/metrics", response_model=RetrievalMetricsResponse)
async def get_retrieval_metrics(
    user_id: str = Query(..., description="用户 ID"),
    app_name: str | None = Query(default=None, description="应用名称"),
    days: int = Query(default=30, ge=1, le=365, description="统计时间窗口（天）"),
    user: AuthUser = Depends(get_current_user),
) -> RetrievalMetricsResponse:
    """获取检索效果指标

    返回 Precision@K、利用率、噪声率等指标，对齐 LongMemEval 评估维度。
    """
    from negentropy.engine.adapters.postgres.retrieval_tracker import RetrievalTracker

    tracker = RetrievalTracker()
    metrics = await tracker.get_effectiveness_metrics(
        user_id=user_id,
        app_name=_resolve_app_name(app_name),
        days=days,
    )
    return RetrievalMetricsResponse(**metrics)


# ============================================================================
# Conflict Resolution Endpoints
# ============================================================================


class ConflictItem(BaseModel):
    id: str
    user_id: str
    app_name: str
    old_fact_id: str | None = None
    new_fact_id: str | None = None
    conflict_type: str
    resolution: str
    detected_by: str
    created_at: str | None = None


class ConflictListResponse(BaseModel):
    count: int
    items: list[ConflictItem] = Field(default_factory=list)


class ManualResolveRequest(BaseModel):
    resolution: str  # supersede, keep_old, keep_new, merge


@router.get("/conflicts", response_model=ConflictListResponse)
async def list_conflicts(
    user_id: str | None = Query(default=None),
    app_name: str | None = Query(default=None),
    resolution: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ConflictListResponse:
    """列出记忆冲突记录"""
    resolved_app = _resolve_app_name(app_name)
    resolver = get_conflict_resolver()

    conflicts = await resolver.list_conflicts(
        user_id=user_id,
        app_name=resolved_app,
        resolution=resolution,
        limit=limit,
        offset=offset,
    )

    items = [
        ConflictItem(
            id=str(c.id),
            user_id=c.user_id,
            app_name=c.app_name,
            old_fact_id=str(c.old_fact_id) if c.old_fact_id else None,
            new_fact_id=str(c.new_fact_id) if c.new_fact_id else None,
            conflict_type=c.conflict_type,
            resolution=c.resolution,
            detected_by=c.detected_by,
            created_at=_iso(c.created_at),
        )
        for c in conflicts
    ]

    return ConflictListResponse(count=len(items), items=items)


@router.post("/conflicts/{conflict_id}/resolve")
async def manual_resolve_conflict(
    conflict_id: str,
    payload: ManualResolveRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, str]:
    """手动解决冲突"""
    from uuid import UUID as UUIDType

    resolver = get_conflict_resolver()

    try:
        conflict_uuid = UUIDType(conflict_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conflict ID") from None

    result = await resolver.manual_resolve(
        conflict_id=conflict_uuid,
        resolution=payload.resolution,
    )

    if not result:
        raise HTTPException(status_code=404, detail="Conflict not found")

    return {"status": "resolved", "conflict_id": str(result.id), "resolution": result.resolution}


@router.get("/facts/{fact_id}/history")
async def get_fact_history(
    fact_id: str,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """获取事实的版本历史链"""
    from uuid import UUID as UUIDType

    try:
        fact_uuid = UUIDType(fact_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fact ID") from None

    resolver = get_conflict_resolver()
    history = await resolver.get_fact_history(fact_uuid)

    return {
        "count": len(history),
        "items": [
            {
                "id": str(f.id),
                "key": f.key,
                "value": f.value,
                "confidence": f.confidence,
                "status": f.status,
                "superseded_by": str(f.superseded_by) if f.superseded_by else None,
                "created_at": _iso(f.created_at),
            }
            for f in history
        ],
    }


# ============================================================================
# Proactive Recall Endpoints
# ============================================================================


@router.post("/proactive/{user_id}")
async def trigger_proactive_recall(
    user_id: str,
    app_name: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """手动触发主动召回计算"""
    resolved_app = _resolve_app_name(app_name)
    service = get_proactive_recall_service()

    result = await service.get_or_compute_preload(
        user_id=user_id,
        app_name=resolved_app,
    )

    return {
        "context": result.get("context", ""),
        "memory_count": len(result.get("memory_ids", [])),
        "fact_count": len(result.get("fact_ids", [])),
        "token_count": result.get("token_count", 0),
    }


@router.get("/proactive/{user_id}")
async def get_proactive_recall(
    user_id: str,
    app_name: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """获取缓存的主动召回上下文"""
    resolved_app = _resolve_app_name(app_name)
    service = get_proactive_recall_service()

    result = await service.get_or_compute_preload(
        user_id=user_id,
        app_name=resolved_app,
    )

    return {
        "context": result.get("context", ""),
        "memory_count": len(result.get("memory_ids", [])),
        "fact_count": len(result.get("fact_ids", [])),
        "token_count": result.get("token_count", 0),
        "cached": True,
    }


# ============================================================================
# Association Endpoints
# ============================================================================


class AssociationItem(BaseModel):
    id: str
    source_id: str
    source_type: str
    target_id: str
    target_type: str
    association_type: str
    weight: float


class AssociationListResponse(BaseModel):
    count: int
    items: list[AssociationItem] = Field(default_factory=list)


class CreateAssociationRequest(BaseModel):
    source_id: str
    target_id: str
    association_type: str = "semantic"
    weight: float = 0.5
    source_type: str = "memory"
    target_type: str = "memory"


@router.get("/{memory_id}/associations", response_model=AssociationListResponse)
async def get_memory_associations(
    memory_id: str,
    association_type: str | None = Query(default=None),
    direction: str = Query(default="both"),
    limit: int = Query(default=20, ge=1, le=100),
    user: AuthUser = Depends(get_current_user),
) -> AssociationListResponse:
    """获取记忆/事实的关联"""
    from uuid import UUID as UUIDType

    try:
        item_uuid = UUIDType(memory_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID") from None

    service = get_association_service()
    assocs = await service.get_associations(
        item_id=item_uuid,
        association_type=association_type,
        direction=direction,
        limit=limit,
    )

    items = [
        AssociationItem(
            id=str(a.id),
            source_id=str(a.source_id),
            source_type=a.source_type,
            target_id=str(a.target_id),
            target_type=a.target_type,
            association_type=a.association_type,
            weight=a.weight,
        )
        for a in assocs
    ]

    return AssociationListResponse(count=len(items), items=items)


@router.post("/associations")
async def create_association(
    payload: CreateAssociationRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, str]:
    """手动创建关联"""
    from uuid import UUID as UUIDType

    service = get_association_service()

    # 从 context 推断 user_id/app_name
    auth_user_id = user.email if hasattr(user, "email") else "anonymous"
    app_name = settings.app_name

    try:
        assoc = await service.create_manual_association(
            source_id=UUIDType(payload.source_id),
            target_id=UUIDType(payload.target_id),
            association_type=payload.association_type,
            weight=payload.weight,
            user_id=auth_user_id,
            app_name=app_name,
            source_type=payload.source_type,
            target_type=payload.target_type,
        )
        return {"status": "created", "association_id": str(assoc.id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from None


@router.delete("/associations/{association_id}")
async def delete_association(
    association_id: str,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, str]:
    """删除关联"""
    from uuid import UUID as UUIDType

    service = get_association_service()

    try:
        assoc_uuid = UUIDType(association_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid association ID") from None

    deleted = await service.delete_association(assoc_uuid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Association not found")

    return {"status": "deleted", "association_id": association_id}
