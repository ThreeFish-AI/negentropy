"""CoreBlockService — 常驻摘要块（Core Memory Block）管理

职责：
- CRUD：以 (user × app × scope × thread_id × label) 为唯一键管理 Core Block
- Token 校验：写入时计算 token_count，超限则截断并记录 metadata.truncated
- 版本递增：每次 replace 自动 version+1，配合 audit 闭环

理论基础：
[1] C. Packer et al., "MemGPT: Towards LLMs as Operating Systems," arXiv:2310.08560, 2023.
[2] J. L. McClelland et al., "Why there are complementary learning systems...," 1995.

设计取舍：
- Core Block 不参与遗忘曲线（衰减率=0），但仍受 audit_log 治理，可被
  delete/anonymize（与普通 memory 同级权限）。
- token_count 上限默认 2048（远高于普通段落的 256，但低于 Letta 的 4000，
  避免单个 block 主导整个 context）。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.engine.utils.token_counter import TokenCounter
from negentropy.logging import get_logger
from negentropy.models.internalization import MemoryCoreBlock

logger = get_logger("negentropy.engine.adapters.postgres.core_block_service")

VALID_SCOPES = frozenset({"user", "app", "thread"})
DEFAULT_LABEL = "persona"
MAX_BLOCK_TOKENS = 2048


class CoreBlockService:
    """Core Memory Block 服务（常驻摘要块）。"""

    def __init__(self, max_tokens: int = MAX_BLOCK_TOKENS) -> None:
        self._max_tokens = max_tokens

    @staticmethod
    def _validate_scope(scope: str) -> None:
        if scope not in VALID_SCOPES:
            raise ValueError(f"Invalid scope '{scope}'. Must be one of {sorted(VALID_SCOPES)}")

    @staticmethod
    def _normalize_thread_id(scope: str, thread_id: str | uuid.UUID | None) -> uuid.UUID | None:
        """scope 与 thread_id 一致性校验。

        - scope='thread' → thread_id 必填
        - scope in ('user', 'app') → thread_id 强制为 NULL
        """
        if scope == "thread":
            if thread_id is None:
                raise ValueError("scope='thread' requires thread_id")
            if isinstance(thread_id, uuid.UUID):
                return thread_id
            try:
                return uuid.UUID(str(thread_id))
            except ValueError as exc:
                raise ValueError(f"Invalid thread_id '{thread_id}'") from exc
        return None

    async def _truncate_to_budget(self, content: str) -> tuple[str, int, bool]:
        """超限截断，返回 (content, token_count, truncated_flag)。"""
        try:
            tokens = await TokenCounter.count_tokens_async(content)
        except Exception:
            tokens = len(content) // 4
        if tokens <= self._max_tokens:
            return content, tokens, False
        ratio = self._max_tokens / max(tokens, 1)
        safe_chars = max(1, int(len(content) * ratio * 0.95))
        truncated = content[:safe_chars] + "..."
        try:
            new_tokens = await TokenCounter.count_tokens_async(truncated)
        except Exception:
            new_tokens = len(truncated) // 4
        return truncated, new_tokens, True

    async def upsert(
        self,
        *,
        user_id: str,
        app_name: str,
        scope: str = "user",
        thread_id: str | uuid.UUID | None = None,
        label: str = DEFAULT_LABEL,
        content: str,
        updated_by: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """新增或替换 Core Block（按唯一键 upsert）。

        Returns:
            {"id", "version", "scope", "label", "token_count", "truncated"}
        """
        self._validate_scope(scope)
        normalized_tid = self._normalize_thread_id(scope, thread_id)
        if not content or not content.strip():
            raise ValueError("content must not be empty")

        content, token_count, truncated = await self._truncate_to_budget(content.strip())
        meta = dict(metadata or {})
        if truncated:
            meta["truncated"] = True
            meta["truncated_to"] = self._max_tokens

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(MemoryCoreBlock).where(
                MemoryCoreBlock.user_id == user_id,
                MemoryCoreBlock.app_name == app_name,
                MemoryCoreBlock.scope == scope,
                MemoryCoreBlock.label == label,
                (MemoryCoreBlock.thread_id == normalized_tid)
                if normalized_tid is not None
                else MemoryCoreBlock.thread_id.is_(None),
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing is None:
                block = MemoryCoreBlock(
                    user_id=user_id,
                    app_name=app_name,
                    scope=scope,
                    thread_id=normalized_tid,
                    label=label,
                    content=content,
                    token_count=token_count,
                    version=1,
                    updated_by=updated_by,
                    metadata_=meta,
                )
                db.add(block)
                await db.flush()
                block_id = block.id
                version = 1
            else:
                existing.content = content
                existing.token_count = token_count
                existing.version = (existing.version or 1) + 1
                existing.updated_by = updated_by
                # 合并 metadata 而非覆盖
                merged = dict(existing.metadata_ or {})
                merged.update(meta)
                existing.metadata_ = merged
                block_id = existing.id
                version = existing.version

            await db.commit()

        logger.info(
            "core_block_upsert",
            user_id=user_id,
            scope=scope,
            label=label,
            version=version,
            tokens=token_count,
            truncated=truncated,
        )
        return {
            "id": str(block_id),
            "version": version,
            "scope": scope,
            "label": label,
            "token_count": token_count,
            "truncated": truncated,
        }

    async def get(
        self,
        *,
        user_id: str,
        app_name: str,
        scope: str = "user",
        thread_id: str | uuid.UUID | None = None,
        label: str = DEFAULT_LABEL,
    ) -> dict[str, Any] | None:
        self._validate_scope(scope)
        normalized_tid = self._normalize_thread_id(scope, thread_id)

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(MemoryCoreBlock).where(
                MemoryCoreBlock.user_id == user_id,
                MemoryCoreBlock.app_name == app_name,
                MemoryCoreBlock.scope == scope,
                MemoryCoreBlock.label == label,
                (MemoryCoreBlock.thread_id == normalized_tid)
                if normalized_tid is not None
                else MemoryCoreBlock.thread_id.is_(None),
            )
            result = await db.execute(stmt)
            block = result.scalar_one_or_none()

        if block is None:
            return None
        return self._to_dict(block)

    async def list_for_context(
        self,
        *,
        user_id: str,
        app_name: str,
        thread_id: str | uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """返回 ContextAssembler 注入顺序的 Core Block 列表。

        优先级：thread 级（如果有）→ app 级 → user 级。
        """
        normalized_tid: uuid.UUID | None = None
        if thread_id is not None:
            try:
                normalized_tid = thread_id if isinstance(thread_id, uuid.UUID) else uuid.UUID(str(thread_id))
            except ValueError:
                normalized_tid = None

        async with db_session.AsyncSessionLocal() as db:
            conditions = [
                MemoryCoreBlock.user_id == user_id,
                MemoryCoreBlock.app_name == app_name,
            ]
            stmt = select(MemoryCoreBlock).where(*conditions)
            result = await db.execute(stmt)
            blocks = result.scalars().all()

        # 按 scope 优先级排序
        priority = {"thread": 0, "app": 1, "user": 2}
        filtered: list[MemoryCoreBlock] = []
        for b in blocks:
            if b.scope == "thread" and b.thread_id != normalized_tid:
                continue
            filtered.append(b)
        filtered.sort(key=lambda b: (priority.get(b.scope, 9), -(b.version or 0)))
        return [self._to_dict(b) for b in filtered]

    async def delete(
        self,
        *,
        user_id: str,
        app_name: str,
        scope: str = "user",
        thread_id: str | uuid.UUID | None = None,
        label: str = DEFAULT_LABEL,
    ) -> bool:
        self._validate_scope(scope)
        normalized_tid = self._normalize_thread_id(scope, thread_id)

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(MemoryCoreBlock).where(
                MemoryCoreBlock.user_id == user_id,
                MemoryCoreBlock.app_name == app_name,
                MemoryCoreBlock.scope == scope,
                MemoryCoreBlock.label == label,
                (MemoryCoreBlock.thread_id == normalized_tid)
                if normalized_tid is not None
                else MemoryCoreBlock.thread_id.is_(None),
            )
            result = await db.execute(stmt)
            block = result.scalar_one_or_none()
            if block is None:
                return False
            await db.delete(block)
            await db.commit()
        logger.info("core_block_deleted", user_id=user_id, scope=scope, label=label)
        return True

    async def append(
        self,
        *,
        user_id: str,
        app_name: str,
        scope: str = "user",
        thread_id: str | uuid.UUID | None = None,
        label: str = DEFAULT_LABEL,
        text: str,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        """向已有 Core Block 追加内容。不存在时新建。"""
        existing = await self.get(user_id=user_id, app_name=app_name, scope=scope, thread_id=thread_id, label=label)
        new_content = text if existing is None else f"{existing['content']}\n{text}"
        return await self.upsert(
            user_id=user_id,
            app_name=app_name,
            scope=scope,
            thread_id=thread_id,
            label=label,
            content=new_content,
            updated_by=updated_by,
        )

    @staticmethod
    def _to_dict(block: MemoryCoreBlock) -> dict[str, Any]:
        return {
            "id": str(block.id),
            "user_id": block.user_id,
            "app_name": block.app_name,
            "scope": block.scope,
            "thread_id": str(block.thread_id) if block.thread_id else None,
            "label": block.label,
            "content": block.content,
            "token_count": block.token_count,
            "version": block.version,
            "updated_by": block.updated_by,
            "metadata": block.metadata_ or {},
            "created_at": block.created_at.isoformat() if block.created_at else None,
            "updated_at": block.updated_at.isoformat() if block.updated_at else None,
        }
