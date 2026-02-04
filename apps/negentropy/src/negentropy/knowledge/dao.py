from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from negentropy.db.session import AsyncSessionLocal
from negentropy.models.knowledge_runtime import KnowledgeGraphRun, KnowledgePipelineRun, MemoryAuditLog


@dataclass(frozen=True)
class UpsertResult:
    status: str
    record: Dict[str, Any]


class KnowledgeRunDao:
    def __init__(self, session_factory=AsyncSessionLocal):
        self._session_factory = session_factory

    async def get_latest_graph(self, app_name: str) -> Optional[KnowledgeGraphRun]:
        async with self._session_factory() as db:
            stmt = (
                select(KnowledgeGraphRun)
                .where(KnowledgeGraphRun.app_name == app_name)
                .order_by(KnowledgeGraphRun.updated_at.desc())
                .limit(1)
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def list_graph_runs(self, app_name: str, limit: int = 20) -> list[KnowledgeGraphRun]:
        async with self._session_factory() as db:
            stmt = (
                select(KnowledgeGraphRun)
                .where(KnowledgeGraphRun.app_name == app_name)
                .order_by(KnowledgeGraphRun.updated_at.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def upsert_graph_run(
        self,
        *,
        app_name: str,
        run_id: str,
        status: str,
        payload: Dict[str, Any],
        idempotency_key: Optional[str],
        expected_version: Optional[int],
    ) -> UpsertResult:
        async with self._session_factory() as db:
            if idempotency_key:
                stmt = select(KnowledgeGraphRun).where(
                    KnowledgeGraphRun.app_name == app_name,
                    KnowledgeGraphRun.idempotency_key == idempotency_key,
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()
                if existing:
                    return UpsertResult("idempotent", self._to_graph_record(existing))

            stmt = select(KnowledgeGraphRun).where(
                KnowledgeGraphRun.app_name == app_name,
                KnowledgeGraphRun.run_id == run_id,
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                if expected_version is not None and existing.version != expected_version:
                    return UpsertResult("conflict", self._to_graph_record(existing))
                existing.status = status
                existing.payload = payload
                existing.version = existing.version + 1
                if idempotency_key:
                    existing.idempotency_key = idempotency_key
                await db.commit()
                await db.refresh(existing)
                return UpsertResult("updated", self._to_graph_record(existing))

            record = KnowledgeGraphRun(
                app_name=app_name,
                run_id=run_id,
                status=status,
                payload=payload,
                idempotency_key=idempotency_key,
                version=1,
            )
            db.add(record)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                return UpsertResult("conflict", {"run_id": run_id})
            await db.refresh(record)
            return UpsertResult("created", self._to_graph_record(record))

    async def list_pipeline_runs(self, app_name: str, limit: int = 50) -> list[KnowledgePipelineRun]:
        async with self._session_factory() as db:
            stmt = (
                select(KnowledgePipelineRun)
                .where(KnowledgePipelineRun.app_name == app_name)
                .order_by(KnowledgePipelineRun.updated_at.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def upsert_pipeline_run(
        self,
        *,
        app_name: str,
        run_id: str,
        status: str,
        payload: Dict[str, Any],
        idempotency_key: Optional[str],
        expected_version: Optional[int],
    ) -> UpsertResult:
        async with self._session_factory() as db:
            if idempotency_key:
                stmt = select(KnowledgePipelineRun).where(
                    KnowledgePipelineRun.app_name == app_name,
                    KnowledgePipelineRun.idempotency_key == idempotency_key,
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()
                if existing:
                    return UpsertResult("idempotent", self._to_pipeline_record(existing))

            stmt = select(KnowledgePipelineRun).where(
                KnowledgePipelineRun.app_name == app_name,
                KnowledgePipelineRun.run_id == run_id,
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                if expected_version is not None and existing.version != expected_version:
                    return UpsertResult("conflict", self._to_pipeline_record(existing))
                existing.status = status
                existing.payload = payload
                existing.version = existing.version + 1
                if idempotency_key:
                    existing.idempotency_key = idempotency_key
                await db.commit()
                await db.refresh(existing)
                return UpsertResult("updated", self._to_pipeline_record(existing))

            record = KnowledgePipelineRun(
                app_name=app_name,
                run_id=run_id,
                status=status,
                payload=payload,
                idempotency_key=idempotency_key,
                version=1,
            )
            db.add(record)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                return UpsertResult("conflict", {"run_id": run_id})
            await db.refresh(record)
            return UpsertResult("created", self._to_pipeline_record(record))

    async def record_memory_audits(
        self,
        *,
        app_name: str,
        user_id: str,
        decisions: Dict[str, str],
        idempotency_key: Optional[str],
        expected_versions: Optional[Dict[str, int]],
        note: Optional[str],
    ) -> list[MemoryAuditLog]:
        audits: list[MemoryAuditLog] = []
        async with self._session_factory() as db:
            for memory_id, decision in decisions.items():
                if idempotency_key:
                    stmt = select(MemoryAuditLog).where(
                        MemoryAuditLog.app_name == app_name,
                        MemoryAuditLog.user_id == user_id,
                        MemoryAuditLog.memory_id == memory_id,
                        MemoryAuditLog.idempotency_key == idempotency_key,
                    )
                    result = await db.execute(stmt)
                    existing = result.scalar_one_or_none()
                    if existing:
                        audits.append(existing)
                        continue

                stmt = select(func.max(MemoryAuditLog.version)).where(
                    MemoryAuditLog.app_name == app_name,
                    MemoryAuditLog.user_id == user_id,
                    MemoryAuditLog.memory_id == memory_id,
                )
                result = await db.execute(stmt)
                current_version = result.scalar_one()
                expected = (expected_versions or {}).get(memory_id)
                if expected is not None:
                    if current_version is None and expected != 0:
                        raise ValueError("memory_audit_version_conflict")
                    if current_version is not None and expected != current_version:
                        raise ValueError("memory_audit_version_conflict")
                next_version = 1 if current_version is None else int(current_version) + 1

                audit = MemoryAuditLog(
                    app_name=app_name,
                    user_id=user_id,
                    memory_id=memory_id,
                    decision=decision,
                    note=note,
                    idempotency_key=idempotency_key,
                    version=next_version,
                )
                db.add(audit)
                audits.append(audit)

            await db.commit()
            for audit in audits:
                await db.refresh(audit)
        return audits

    async def list_memory_audits(
        self, app_name: str, user_id: Optional[str] = None, limit: int = 100
    ) -> list[MemoryAuditLog]:
        async with self._session_factory() as db:
            stmt = select(MemoryAuditLog).where(MemoryAuditLog.app_name == app_name)
            if user_id:
                stmt = stmt.where(MemoryAuditLog.user_id == user_id)
            stmt = stmt.order_by(MemoryAuditLog.created_at.desc()).limit(limit)
            result = await db.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    def _to_graph_record(record: KnowledgeGraphRun) -> Dict[str, Any]:
        return {
            "id": str(record.id),
            "run_id": record.run_id,
            "status": record.status,
            "payload": record.payload,
            "version": record.version,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
        }

    @staticmethod
    def _to_pipeline_record(record: KnowledgePipelineRun) -> Dict[str, Any]:
        return {
            "id": str(record.id),
            "run_id": record.run_id,
            "status": record.status,
            "payload": record.payload,
            "version": record.version,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
        }
