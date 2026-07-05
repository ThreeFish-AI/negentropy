"""ADK ``BaseArtifactService`` 的 PostgreSQL 实现。

继承 Google ADK ``BaseArtifactService``，把 agent 会话制品持久化到
``adk_artifacts`` 表（见 :class:`~negentropy.models.storage.AdkArtifact`）。
GCS 退役后取代 ADK 内置 ``GcsArtifactService``。

范本：:class:`negentropy.engine.adapters.postgres.session_service.PostgresSessionService`
（同样继承 ADK base、SQLAlchemy ORM、``AsyncSessionLocal``、延迟导入模型以避免
在选择其他后端时注册 ORM 表）。

制品序列化：``types.Part`` 为 Pydantic 模型，以 ``model_dump_json`` 序列化为
字节存储，``model_validate_json`` 还原，忠实保留 inline_data / text / file_data
所有变体。版本号从 0 单调递增（与 ADK ``InMemoryArtifactService`` 一致）。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from google.adk.artifacts import BaseArtifactService
from google.adk.artifacts.base_artifact_service import ArtifactVersion, ensure_part
from google.genai import types
from sqlalchemy import delete, func, select

import negentropy.db.session as db_session
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.adapters.postgres.artifact")

_CANONICAL_SCHEME = "pgartifact"


def _canonical_uri(*, app_name: str, user_id: str, session_id: str | None, filename: str, version: int) -> str:
    base = f"{_CANONICAL_SCHEME}://apps/{app_name}/users/{user_id}"
    if session_id is not None:
        base += f"/sessions/{session_id}"
    return f"{base}/artifacts/{filename}/versions/{version}"


def _derive_mime_type(part: types.Part) -> str | None:
    """从 Part 推断 MIME（与 ADK ``InMemoryArtifactService`` 逻辑一致）。"""
    if part.inline_data is not None:
        return part.inline_data.mime_type
    if part.text is not None:
        return "text/plain"
    if part.file_data is not None:
        return part.file_data.mime_type
    return None


class PostgresArtifactService(BaseArtifactService):
    """``BaseArtifactService`` 的 PostgreSQL ``adk_artifacts`` 实现。"""

    def __init__(self) -> None:
        # 延迟导入模型，仅在实例化（即选择 postgres artifact 后端）时注册 ORM，
        # 避免在选择其他 ArtifactService 时把 adk_artifacts 表挂入 metadata。
        from negentropy.models.storage import AdkArtifact

        self.AdkArtifact = AdkArtifact

    # ------------------------------------------------------------------
    # 内部查询辅助
    # ------------------------------------------------------------------

    def _scope_filters(self, *, app_name: str, user_id: str, session_id: str | None):
        """构造作用域过滤条件（session_id=None 时精确匹配 IS NULL）。"""
        A = self.AdkArtifact
        filters = [
            A.app_name == app_name,
            A.user_id == user_id,
        ]
        if session_id is None:
            filters.append(A.session_id.is_(None))
        else:
            filters.append(A.session_id == session_id)
        return filters

    async def _next_version(self, db, *, app_name: str, user_id: str, session_id: str | None, filename: str) -> int:
        A = self.AdkArtifact
        result = await db.execute(
            select(func.max(A.version)).where(
                *self._scope_filters(app_name=app_name, user_id=user_id, session_id=session_id),
                A.filename == filename,
            )
        )
        current = result.scalar()
        # 注意：不可用 ``(current or -1) + 1``——当 max(version)==0（仅 v0 存在）
        # 时 0 为假值会被误判为 None，导致重复返回 0 而违反唯一约束。
        return (current + 1) if current is not None else 0

    # ------------------------------------------------------------------
    # BaseArtifactService 抽象方法实现
    # ------------------------------------------------------------------

    async def save_artifact(
        self,
        *,
        app_name: str,
        user_id: str,
        filename: str,
        artifact: types.Part | dict[str, Any],
        session_id: str | None = None,
        custom_metadata: dict[str, Any] | None = None,
    ) -> int:
        """保存制品并返回新版本号。"""
        part = ensure_part(artifact)
        data = part.model_dump_json(exclude_none=True).encode("utf-8")
        mime_type = _derive_mime_type(part)

        async with db_session.AsyncSessionLocal() as db:
            version = await self._next_version(
                db, app_name=app_name, user_id=user_id, session_id=session_id, filename=filename
            )
            row = self.AdkArtifact(
                app_name=app_name,
                user_id=user_id,
                session_id=session_id,
                filename=filename,
                version=version,
                data=data,
                mime_type=mime_type,
                custom_metadata=custom_metadata,
            )
            db.add(row)
            await db.commit()

        logger.info(
            "artifact_saved",
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            filename=filename,
            version=version,
        )
        return version

    async def load_artifact(
        self,
        *,
        app_name: str,
        user_id: str,
        filename: str,
        session_id: str | None = None,
        version: int | None = None,
    ) -> types.Part | None:
        """加载制品；``version=None`` 返回最新版本；不存在返回 ``None``。"""
        A = self.AdkArtifact
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(A)
                .where(
                    *self._scope_filters(app_name=app_name, user_id=user_id, session_id=session_id),
                    A.filename == filename,
                )
                .order_by(A.version.desc())
            )
            if version is not None:
                # 负索引语义：-1 = 最新；与 ADK 约定一致
                if version < 0:
                    stmt = stmt.limit(1)
                else:
                    stmt = stmt.where(A.version == version).limit(1)
            else:
                stmt = stmt.limit(1)
            result = await db.execute(stmt)
            row = result.scalar_one_or_none()

        if row is None:
            return None
        return types.Part.model_validate_json(row.data.decode("utf-8"))

    async def list_artifact_keys(self, *, app_name: str, user_id: str, session_id: str | None = None) -> list[str]:
        """列出作用域内所有制品文件名（去重）。"""
        A = self.AdkArtifact
        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                select(A.filename)
                .where(*self._scope_filters(app_name=app_name, user_id=user_id, session_id=session_id))
                .distinct()
            )
            return [r[0] for r in result.all()]

    async def delete_artifact(
        self,
        *,
        app_name: str,
        user_id: str,
        filename: str,
        session_id: str | None = None,
    ) -> None:
        """删除制品的所有版本。"""
        A = self.AdkArtifact
        async with db_session.AsyncSessionLocal() as db:
            await db.execute(
                delete(A).where(
                    *self._scope_filters(app_name=app_name, user_id=user_id, session_id=session_id),
                    A.filename == filename,
                )
            )
            await db.commit()
        logger.info(
            "artifact_deleted",
            app_name=app_name,
            user_id=user_id,
            session_id=session_id,
            filename=filename,
        )

    async def list_versions(
        self,
        *,
        app_name: str,
        user_id: str,
        filename: str,
        session_id: str | None = None,
    ) -> list[int]:
        """列出制品的全部版本号（升序）。"""
        A = self.AdkArtifact
        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                select(A.version)
                .where(
                    *self._scope_filters(app_name=app_name, user_id=user_id, session_id=session_id),
                    A.filename == filename,
                )
                .order_by(A.version.asc())
            )
            return [r[0] for r in result.all()]

    async def list_artifact_versions(
        self,
        *,
        app_name: str,
        user_id: str,
        filename: str,
        session_id: str | None = None,
    ) -> list[ArtifactVersion]:
        """列出制品全部版本及其元数据。"""
        A = self.AdkArtifact
        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                select(A)
                .where(
                    *self._scope_filters(app_name=app_name, user_id=user_id, session_id=session_id),
                    A.filename == filename,
                )
                .order_by(A.version.asc())
            )
            rows = result.scalars().all()

        return [self._row_to_version(r) for r in rows]

    async def get_artifact_version(
        self,
        *,
        app_name: str,
        user_id: str,
        filename: str,
        session_id: str | None = None,
        version: int | None = None,
    ) -> ArtifactVersion | None:
        """获取指定版本的元数据；``version=None`` 返回最新；不存在返回 ``None``。"""
        A = self.AdkArtifact
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(A)
                .where(
                    *self._scope_filters(app_name=app_name, user_id=user_id, session_id=session_id),
                    A.filename == filename,
                )
                .order_by(A.version.desc())
            )
            if version is not None and version >= 0:
                stmt = stmt.where(A.version == version)
            stmt = stmt.limit(1)
            result = await db.execute(stmt)
            row = result.scalar_one_or_none()

        return self._row_to_version(row) if row is not None else None

    # ------------------------------------------------------------------
    # 映射辅助
    # ------------------------------------------------------------------

    def _row_to_version(self, row) -> ArtifactVersion:
        create_time = row.created_at.timestamp() if row.created_at else datetime.now(UTC).timestamp()
        return ArtifactVersion(
            version=row.version,
            canonical_uri=_canonical_uri(
                app_name=row.app_name,
                user_id=row.user_id,
                session_id=row.session_id,
                filename=row.filename,
                version=row.version,
            ),
            custom_metadata=row.custom_metadata or {},
            create_time=create_time,
            mime_type=row.mime_type,
        )
