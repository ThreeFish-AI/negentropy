"""evolution weights 解析单测 — 缓存 + fallback + invalidate（monkeypatch db）。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from negentropy.engine.evolution import weights as w


def _reset_cache():
    w._cache.clear()


@pytest.mark.asyncio
async def test_resolve_falls_back_to_code_constants_when_no_active_row(monkeypatch):
    """DB 无 active 行 → 代码常量兜底（version=0.1.0）。"""
    _reset_cache()

    class _NoRow:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def execute(self, *a, **kw):
            return SimpleNamespace(scalar_one_or_none=lambda: None)

    with patch("negentropy.engine.evolution.weights.db_session.AsyncSessionLocal", return_value=_NoRow()):
        snap, ver = await w.resolve_active_retrieval_config()
    assert ver == "0.1.0"
    assert snap == {"semantic_weight": 0.7, "keyword_weight": 0.3}


@pytest.mark.asyncio
async def test_resolve_returns_active_row_snapshot(monkeypatch):
    _reset_cache()
    row = SimpleNamespace(snapshot={"semantic_weight": 0.6, "keyword_weight": 0.4}, version="0.1.1")

    class _Db:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def execute(self, *a, **kw):
            return SimpleNamespace(scalar_one_or_none=lambda: row)

    with patch("negentropy.engine.evolution.weights.db_session.AsyncSessionLocal", return_value=_Db()):
        snap, ver = await w.resolve_active_retrieval_config()
    assert ver == "0.1.1"
    assert snap == {"semantic_weight": 0.6, "keyword_weight": 0.4}


@pytest.mark.asyncio
async def test_resolve_caches_within_ttl(monkeypatch):
    _reset_cache()
    calls = {"n": 0}

    class _Db:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def execute(self, *a, **kw):
            calls["n"] += 1
            return SimpleNamespace(
                scalar_one_or_none=lambda: SimpleNamespace(
                    snapshot={"semantic_weight": 0.7, "keyword_weight": 0.3}, version="0.1.0"
                )
            )

    with patch("negentropy.engine.evolution.weights.db_session.AsyncSessionLocal", return_value=_Db()):
        await w.resolve_active_retrieval_config()
        await w.resolve_active_retrieval_config()  # 命中缓存，不应再查
    assert calls["n"] == 1


def test_invalidate_clears_cache(monkeypatch):
    w._cache["retrieval"] = ({"semantic_weight": 0.7}, "0.1.0", 0.0)
    w.invalidate("retrieval")
    assert "retrieval" not in w._cache
    w._cache["retrieval"] = ({"semantic_weight": 0.7}, "0.1.0", 0.0)
    w._cache["other"] = ({}, "0.0.1", 0.0)
    w.invalidate()  # 全清
    assert w._cache == {}


@pytest.mark.asyncio
async def test_resolve_db_exception_falls_back(monkeypatch):
    """DB 异常（如表不存在）→ fail-soft 回退代码常量，不抛。"""
    _reset_cache()

    class _Boom:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def execute(self, *a, **kw):
            raise RuntimeError("relation does not exist")

    with patch("negentropy.engine.evolution.weights.db_session.AsyncSessionLocal", return_value=_Boom()):
        snap, ver = await w.resolve_active_retrieval_config()
    assert ver == "0.1.0"
    assert snap["semantic_weight"] == 0.7
