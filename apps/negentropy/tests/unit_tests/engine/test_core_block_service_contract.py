"""Core Block ORM / service contract regression tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from negentropy.engine.adapters.postgres.core_block_service import CoreBlockService
from negentropy.models.internalization import MemoryCoreBlock


def test_memory_core_block_maps_created_at() -> None:
    assert "created_at" in MemoryCoreBlock.__table__.columns


def test_core_block_to_dict_serializes_created_at() -> None:
    now = datetime(2026, 5, 2, 12, 0, tzinfo=UTC)
    block = MemoryCoreBlock(
        id=uuid4(),
        user_id="alice",
        app_name="app",
        scope="user",
        label="persona",
        content="Alice prefers concise answers.",
        token_count=5,
        version=1,
        created_at=now,
        updated_at=now,
    )

    out = CoreBlockService._to_dict(block)

    assert out["created_at"] == now.isoformat()
    assert out["updated_at"] == now.isoformat()
