"""CoreBlockService — 序列化单元测试。"""

from __future__ import annotations

from datetime import UTC, datetime

from negentropy.engine.adapters.postgres.core_block_service import CoreBlockService
from negentropy.models.internalization import MemoryCoreBlock


class TestCoreBlockSerialization:
    def test_to_dict_handles_timestamp_columns_on_transient_model(self) -> None:
        assert "created_at" in MemoryCoreBlock.__table__.c

        block = MemoryCoreBlock(
            user_id="alice",
            app_name="negentropy",
            scope="user",
            label="persona",
            content="Alice prefers concise answers.",
            token_count=8,
            version=2,
            metadata_={"source": "test"},
        )

        data = CoreBlockService._to_dict(block)

        assert data["created_at"] is None
        assert data["updated_at"] is None
        assert data["content"] == "Alice prefers concise answers."
        assert data["metadata"] == {"source": "test"}

    def test_to_dict_serializes_timestamp_values(self) -> None:
        now = datetime(2026, 5, 2, 12, 0, tzinfo=UTC)
        block = MemoryCoreBlock(
            user_id="alice",
            app_name="negentropy",
            scope="user",
            label="persona",
            content="Alice prefers concise answers.",
        )
        block.created_at = now
        block.updated_at = now

        data = CoreBlockService._to_dict(block)

        assert data["created_at"] == "2026-05-02T12:00:00+00:00"
        assert data["updated_at"] == "2026-05-02T12:00:00+00:00"
