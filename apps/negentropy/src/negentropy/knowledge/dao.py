from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from negentropy.db.session import AsyncSessionLocal
from negentropy.models.knowledge_runtime import KnowledgeGraphRun, KnowledgePipelineRun


@dataclass(frozen=True)
class UpsertResult:
    status: str
    record: dict[str, Any]


class KnowledgeRunDao:
    def __init__(self, session_factory=AsyncSessionLocal):
        self._session_factory = session_factory

    async def get_pipeline_run(self, app_name: str, run_id: str) -> KnowledgePipelineRun | None:
        async with self._session_factory() as db:
            stmt = select(KnowledgePipelineRun).where(
                KnowledgePipelineRun.app_name == app_name,
                KnowledgePipelineRun.run_id == run_id,
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def get_latest_graph(self, app_name: str) -> KnowledgeGraphRun | None:
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
        payload: dict[str, Any],
        idempotency_key: str | None,
        expected_version: int | None,
    ) -> UpsertResult:
        return await self._upsert_run(
            model_class=KnowledgeGraphRun,
            app_name=app_name,
            run_id=run_id,
            status=status,
            payload=payload,
            idempotency_key=idempotency_key,
            expected_version=expected_version,
        )

    async def count_pipeline_runs(self, app_name: str) -> int:
        async with self._session_factory() as db:
            stmt = (
                select(func.count()).select_from(KnowledgePipelineRun).where(KnowledgePipelineRun.app_name == app_name)
            )
            result = await db.scalar(stmt)
            return result or 0

    async def list_pipeline_runs(self, app_name: str, limit: int = 50, offset: int = 0) -> list[KnowledgePipelineRun]:
        async with self._session_factory() as db:
            stmt = (
                select(KnowledgePipelineRun)
                .where(KnowledgePipelineRun.app_name == app_name)
                .order_by(KnowledgePipelineRun.updated_at.desc())
                .offset(offset)
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
        payload: dict[str, Any],
        idempotency_key: str | None,
        expected_version: int | None,
    ) -> UpsertResult:
        return await self._upsert_run(
            model_class=KnowledgePipelineRun,
            app_name=app_name,
            run_id=run_id,
            status=status,
            payload=payload,
            idempotency_key=idempotency_key,
            expected_version=expected_version,
        )

    async def _upsert_run(
        self,
        *,
        model_class: type,
        app_name: str,
        run_id: str,
        status: str,
        payload: dict[str, Any],
        idempotency_key: str | None,
        expected_version: int | None,
    ) -> UpsertResult:
        """通用 upsert 逻辑，适用于 GraphRun 和 PipelineRun

        流程:
        1. 幂等性检查（若有 idempotency_key）
        2. 查找现有记录并更新（版本控制）
        3. 创建新记录
        """
        async with self._session_factory() as db:
            # 幂等性检查
            if idempotency_key:
                stmt = select(model_class).where(
                    model_class.app_name == app_name,
                    model_class.idempotency_key == idempotency_key,
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()
                if existing:
                    return UpsertResult("idempotent", self._to_record(existing))

            # 查找现有记录
            stmt = select(model_class).where(
                model_class.app_name == app_name,
                model_class.run_id == run_id,
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                # 版本冲突检查
                if expected_version is not None and existing.version != expected_version:
                    return UpsertResult("conflict", self._to_record(existing))
                # 更新
                existing.status = status
                existing.payload = payload
                existing.version = existing.version + 1
                if idempotency_key:
                    existing.idempotency_key = idempotency_key
                await db.commit()
                await db.refresh(existing)
                return UpsertResult("updated", self._to_record(existing))

            # 创建新记录
            record = model_class(
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
            return UpsertResult("created", self._to_record(record))

    @staticmethod
    def _to_record(record: Any) -> dict[str, Any]:
        """通用记录转换"""
        return {
            "id": str(record.id),
            "run_id": record.run_id,
            "status": record.status,
            "payload": record.payload,
            "version": record.version,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
        }
