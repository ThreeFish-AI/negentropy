from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy import update as sql_update
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

    async def finalize_stale_pipeline_runs(
        self,
        *,
        app_name: str | None = None,
        stale_threshold_minutes: int = 30,
        cancelling_threshold_minutes: int = 5,
    ) -> dict[str, int]:
        """将卡死的中间态 Pipeline 强制收敛到终态。

        - `running` 超过 `stale_threshold_minutes` 分钟未更新 → 标记为 `failed`
          （兼容既有进程崩溃 / task 卡住场景）；
        - `cancelling` 超过 `cancelling_threshold_minutes` 分钟未更新 → 强制收敛
          到 `cancelled`（task 已被 kill 或检查点触发前进程重启时的兜底）。

        Returns:
            dict: `{"forced_failed": int, "forced_cancelled": int}`。
        """
        now = datetime.now(UTC)
        failed_cutoff = now - timedelta(minutes=stale_threshold_minutes)
        cancelled_cutoff = now - timedelta(minutes=cancelling_threshold_minutes)

        async with self._session_factory() as db:
            # 1) running > stale_threshold → failed
            failed_conditions = [
                KnowledgePipelineRun.status == "running",
                KnowledgePipelineRun.updated_at < failed_cutoff,
            ]
            if app_name is not None:
                failed_conditions.append(KnowledgePipelineRun.app_name == app_name)
            failed_stmt = (
                sql_update(KnowledgePipelineRun)
                .where(*failed_conditions)
                .values(
                    status="failed",
                    payload=KnowledgePipelineRun.payload.op("||")(
                        {
                            "error": {
                                "type": "StalePipelineReconciliation",
                                "message": (
                                    f"Pipeline was running for over {stale_threshold_minutes}"
                                    " minutes and was forcibly marked as failed."
                                ),
                            }
                        }
                    ),
                )
            )
            failed_result = await db.execute(failed_stmt)

            # 2) cancelling > cancelling_threshold → cancelled
            #    （task 在感知 cancel 信号后未及时 cancel() 落盘，例如进程重启或 kill）
            cancelled_conditions = [
                KnowledgePipelineRun.status == "cancelling",
                KnowledgePipelineRun.updated_at < cancelled_cutoff,
            ]
            if app_name is not None:
                cancelled_conditions.append(KnowledgePipelineRun.app_name == app_name)
            cancelled_stmt = (
                sql_update(KnowledgePipelineRun)
                .where(*cancelled_conditions)
                .values(
                    status="cancelled",
                    payload=KnowledgePipelineRun.payload.op("||")(
                        {
                            "cancellation": {
                                "forced_by_watchdog": True,
                                "cancelled_at": now.isoformat(),
                                "reason": (
                                    f"Pipeline was cancelling for over {cancelling_threshold_minutes}"
                                    " minutes and was forcibly converged to cancelled."
                                ),
                            }
                        }
                    ),
                )
            )
            cancelled_result = await db.execute(cancelled_stmt)

            await db.commit()
            return {
                "forced_failed": failed_result.rowcount or 0,
                "forced_cancelled": cancelled_result.rowcount or 0,
            }

    async def request_pipeline_run_cancel(
        self,
        *,
        app_name: str,
        run_id: str,
        cancellation_meta: dict[str, Any],
    ) -> tuple[str, KnowledgePipelineRun | None]:
        """对 Pipeline Run 发起取消（条件 UPDATE，规避 race B）。

        规避 race B（R-7）：`tracker._persist` 在每个 stage 边界写 running 状态，与 cancel
        API 写 cancelling 并发；若用 `upsert_pipeline_run` 会 bump version 且无条件覆盖，
        后写者覆盖前写者；改用条件 UPDATE：
        - `WHERE status NOT IN ('completed','failed','cancelled')` —— 只在非终态时变更，
          避免抢占已完成 run 的状态；
        - `pending` → `cancelled`（task 尚未启动，无需协作）；
        - `running` → `cancelling`（信号已发，task 在下个检查点感知后调 `tracker.cancel()`）；
        - `cancelling` → 不变（幂等命中，返回 `noop`）。
        - 同时 `version + 1`，并把 `cancellation_meta` 合并进 `payload.cancellation`。

        DB 行锁串行化 cancel 与 _persist 的并发；_persist 写入前先读 DB（R-7 第 2 步）
        进一步保证 running 不会覆盖 cancelling。

        Returns:
            (status, record):
            - `("not_found", None)`：run 不存在；
            - `("terminal", record)`：已是 completed/failed/cancelled，409；
            - `("noop", record)`：已是 cancelling，幂等命中；
            - `("cancelled", record)`：pending → cancelled；
            - `("cancelling", record)`：running → cancelling。
        """
        async with self._session_factory() as db:
            stmt = (
                select(KnowledgePipelineRun)
                .where(
                    KnowledgePipelineRun.app_name == app_name,
                    KnowledgePipelineRun.run_id == run_id,
                )
                .with_for_update()
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing is None:
                return ("not_found", None)

            current_status = (existing.status or "").lower()
            if current_status in ("completed", "failed", "cancelled"):
                return ("terminal", existing)
            if current_status == "cancelling":
                return ("noop", existing)

            new_status = "cancelled" if current_status == "pending" else "cancelling"
            existing.status = new_status
            # 合并 cancellation 元数据：保留既有 payload，叠加 cancellation 字段
            new_payload = dict(existing.payload or {})
            existing_cancellation = new_payload.get("cancellation") or {}
            new_payload["cancellation"] = {**existing_cancellation, **cancellation_meta}
            existing.payload = new_payload
            existing.version = (existing.version or 0) + 1
            await db.commit()
            await db.refresh(existing)
            return (new_status, existing)

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
