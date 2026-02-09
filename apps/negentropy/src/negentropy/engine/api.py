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

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact, Memory, MemoryAuditLog

from .factories.memory import (
    get_fact_service,
    get_memory_governance_service,
    get_memory_service,
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
    access_count: int
    created_at: Optional[str] = None
    last_accessed_at: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MemoryListResponse(BaseModel):
    users: List[Dict[str, str]] = Field(default_factory=list)
    timeline: List[MemoryItem] = Field(default_factory=list)
    policies: Dict[str, Any] = Field(default_factory=dict)


class MemorySearchRequest(BaseModel):
    app_name: Optional[str] = None
    user_id: str
    query: str


class MemorySearchResponse(BaseModel):
    count: int
    items: List[Dict[str, Any]] = Field(default_factory=list)


class FactItem(BaseModel):
    id: str
    user_id: str
    app_name: str
    fact_type: str
    key: str
    value: Dict[str, Any]
    confidence: float
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    created_at: Optional[str] = None


class FactListResponse(BaseModel):
    count: int
    items: List[FactItem] = Field(default_factory=list)


class FactSearchRequest(BaseModel):
    app_name: Optional[str] = None
    user_id: str
    query: str
    limit: int = 10


class AuditRequest(BaseModel):
    app_name: Optional[str] = None
    user_id: str
    decisions: Dict[str, str]
    expected_versions: Optional[Dict[str, int]] = None
    note: Optional[str] = None
    idempotency_key: Optional[str] = None


class AuditRecordResponse(BaseModel):
    memory_id: str
    decision: str
    version: Optional[int] = None
    note: Optional[str] = None
    created_at: Optional[str] = None


class AuditResponse(BaseModel):
    status: str
    audits: List[AuditRecordResponse] = Field(default_factory=list)


class MemoryDashboardResponse(BaseModel):
    user_count: int
    memory_count: int
    fact_count: int
    avg_retention_score: float
    low_retention_count: int
    recent_audit_count: int


# ============================================================================
# Helpers
# ============================================================================


def _resolve_app_name(app_name: Optional[str]) -> str:
    return app_name or settings.app_name


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/dashboard", response_model=MemoryDashboardResponse)
async def get_memory_dashboard(
    app_name: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
) -> MemoryDashboardResponse:
    """Memory 概览指标

    展示用户数、记忆总数、Facts 数量、平均 retention_score、低保留记忆告警。
    """
    resolved_app = _resolve_app_name(app_name)

    async with AsyncSessionLocal() as db:
        # 基础条件
        memory_base = select(Memory).where(Memory.app_name == resolved_app)
        fact_base = select(Fact).where(Fact.app_name == resolved_app)

        if user_id:
            memory_base = memory_base.where(Memory.user_id == user_id)
            fact_base = fact_base.where(Fact.user_id == user_id)

        # 用户数
        user_count = await db.scalar(
            select(func.count(func.distinct(Memory.user_id))).where(
                Memory.app_name == resolved_app
            )
        )

        # 记忆总数
        memory_count = await db.scalar(
            select(func.count()).select_from(memory_base.subquery())
        )

        # Facts 数量
        now = datetime.now(timezone.utc)
        fact_count = await db.scalar(
            select(func.count()).select_from(
                fact_base.where(
                    (Fact.valid_until.is_(None)) | (Fact.valid_until > now)
                ).subquery()
            )
        )

        # 平均 retention_score
        avg_retention = await db.scalar(
            select(func.avg(Memory.retention_score)).where(
                Memory.app_name == resolved_app
            )
        )

        # 低保留记忆数 (retention_score < 0.1)
        low_retention_count = await db.scalar(
            select(func.count()).select_from(
                select(Memory)
                .where(
                    Memory.app_name == resolved_app,
                    Memory.retention_score < 0.1,
                )
                .subquery()
            )
        )

        # 近期审计数
        recent_audit_count = await db.scalar(
            select(func.count()).select_from(
                select(MemoryAuditLog)
                .where(MemoryAuditLog.app_name == resolved_app)
                .subquery()
            )
        )

    return MemoryDashboardResponse(
        user_count=user_count or 0,
        memory_count=memory_count or 0,
        fact_count=fact_count or 0,
        avg_retention_score=round(float(avg_retention or 0), 4),
        low_retention_count=low_retention_count or 0,
        recent_audit_count=recent_audit_count or 0,
    )


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    app_name: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> MemoryListResponse:
    """获取 Memory 列表（含 timeline）

    返回用户列表、记忆时间线和当前治理策略。
    """
    resolved_app = _resolve_app_name(app_name)

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

        users = [
            {"id": row.user_id, "label": f"{row.user_id} ({row.count})"}
            for row in user_rows
        ]

        # 获取记忆时间线
        memory_stmt = (
            select(Memory)
            .where(Memory.app_name == resolved_app)
            .order_by(Memory.created_at.desc())
            .limit(limit)
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
            access_count=m.access_count,
            created_at=_iso(m.created_at),
            last_accessed_at=_iso(m.last_accessed_at),
            metadata=m.metadata_ or {},
        )
        for m in memories
    ]

    # 治理策略（可配置化，当前返回默认值）
    policies = {
        "decay_lambda": 0.1,
        "low_retention_threshold": 0.1,
        "auto_cleanup_enabled": False,
        "cleanup_cron": "0 2 * * *",
    }

    return MemoryListResponse(
        users=users,
        timeline=timeline,
        policies=policies,
    )


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories(payload: MemorySearchRequest) -> MemorySearchResponse:
    """搜索用户记忆

    基于混合检索 (Semantic + BM25) 搜索相关记忆。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    memory_service = get_memory_service()
    result = await memory_service.search_memory(
        app_name=resolved_app,
        user_id=payload.user_id,
        query=payload.query,
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

        items.append({
            "id": entry.id,
            "content": content_text,
            "timestamp": entry.timestamp,
            "relevance_score": entry.relevance_score,
            "metadata": entry.custom_metadata or {},
        })

    return MemorySearchResponse(count=len(items), items=items)


@router.get("/facts", response_model=FactListResponse)
async def list_facts(
    app_name: Optional[str] = Query(default=None),
    user_id: str = Query(...),
    fact_type: Optional[str] = Query(default=None),
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
    app_name: Optional[str] = Query(default=None),
    user_id: str = Query(...),
    limit: int = Query(default=100, ge=1, le=1000),
) -> Dict[str, Any]:
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
