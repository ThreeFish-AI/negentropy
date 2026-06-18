"""ContextAssembler.get_memory_summary 来源标注单测（引用规范）。

mock summarizer / DB / fact service 边界，不连真实数据。
"""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.adapters.postgres import context_assembler as ca_module
from negentropy.engine.adapters.postgres.context_assembler import ContextAssembler


@pytest.mark.asyncio
async def test_structured_summary_prepends_provenance_header():
    """结构化摘要路径：返回内容首行标注「来源：记忆画像摘要 + 生成日期」。"""
    summary = SimpleNamespace(content="用户偏好 async-first 架构。", updated_at=datetime(2026, 6, 1))
    summarizer = MagicMock()
    summarizer.get_or_generate_summary = AsyncMock(return_value=summary)

    with patch("negentropy.engine.factories.memory.get_memory_summarizer", return_value=summarizer):
        result = await ContextAssembler().get_memory_summary(user_id="u-1", app_name="negentropy")

    first_line, body = result.split("\n", 1)
    assert "来源：记忆画像摘要" in first_line
    assert "2026-06-01" in first_line
    assert "画像摘要而非具体记忆条目" in first_line
    assert body == "用户偏好 async-first 架构。"


@pytest.mark.asyncio
async def test_degraded_memory_and_fact_lines_carry_id_and_date():
    """降级拼接路径：Memory/Fact 行附 id 短码 + 类型 + 日期（供 [N] Memory 引用）。"""
    memory = SimpleNamespace(
        id="a1b2c3d4-5678-90ab-cdef-1234567890ab",
        content="Routine 收尾前必须运行 ruff 与 pytest。",
        memory_type="procedural",
        retention_score=0.9,
        created_at=datetime(2026, 5, 12),
    )
    fact = SimpleNamespace(
        id="deadbeef-0000-0000-0000-000000000000",
        fact_type="preference",
        key="lang",
        value={"v": "TypeScript"},
        created_at=datetime(2026, 4, 1),
    )

    # summarizer 无摘要 → 走降级路径
    summarizer = MagicMock()
    summarizer.get_or_generate_summary = AsyncMock(return_value=None)

    fake_session = MagicMock()
    fake_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [memory])))
    fake_session_cm = MagicMock()
    fake_session_cm.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session_cm.__aexit__ = AsyncMock(return_value=False)

    fact_service = MagicMock()
    fact_service.list_facts = AsyncMock(return_value=[fact])

    assembler = ContextAssembler()
    with (
        patch("negentropy.engine.factories.memory.get_memory_summarizer", return_value=summarizer),
        patch.object(ca_module.db_session, "AsyncSessionLocal", return_value=fake_session_cm),
        patch.object(ca_module, "get_fact_service", return_value=fact_service),
        patch.object(assembler, "_collect_kg_context", new=AsyncMock(return_value=[])),
    ):
        result = await assembler.get_memory_summary(user_id="u-1", app_name="negentropy")

    assert "[Memory a1b2c3d4 | procedural | 2026-05-12] Routine 收尾前必须运行" in result
    assert "[Fact:preference | deadbeef | 2026-04-01] lang:" in result
