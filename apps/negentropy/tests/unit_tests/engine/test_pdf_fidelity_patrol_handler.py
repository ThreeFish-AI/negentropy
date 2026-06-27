"""pdf_fidelity_patrol handler 单测 — 纯逻辑 + FakeDB（无真实 PG/网络）。

覆盖：``_derive_repo_root``（配置优先 + 包路径回退）、``_select_next_pending_doc``
（skip 集合 + 结果映射）、``_has_running_patrol``、``_select_regression_sample``。
DB 触达用 FakeDB 捕获；handler 主流程（建 Routine / blob 下载）依赖真实 PG + blob，
留待集成测试。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import negentropy
from negentropy.engine.schedulers.handlers import pdf_fidelity_patrol as patrol

# ---------------------------------------------------------------------------
# FakeDB
# ---------------------------------------------------------------------------


class _FakeResult:
    def __init__(self, *, fetchone: Any = None, fetchall: Any = None, scalar: Any = None) -> None:
        self._fetchone = fetchone
        self._fetchall = fetchall
        self._scalar = scalar

    def fetchone(self):  # noqa: ANN201
        return self._fetchone

    def fetchall(self):  # noqa: ANN201
        return self._fetchall or []

    def scalar(self):  # noqa: ANN201
        return self._scalar


class _FakeDB:
    def __init__(self, **scripted: Any) -> None:
        self._result = _FakeResult(**scripted)
        self.executed: list[tuple[str, Any]] = []

    async def execute(self, stmt: Any, params: Any = None) -> _FakeResult:  # noqa: D401
        self.executed.append((str(stmt), params))
        return self._result


# ---------------------------------------------------------------------------
# _derive_repo_root
# ---------------------------------------------------------------------------


def test_derive_repo_root_configured_existing(tmp_path: Path):
    d = tmp_path / "repo"
    d.mkdir()
    assert patrol._derive_repo_root(configured=str(d)) == str(d)


def test_derive_repo_root_configured_missing(tmp_path: Path):
    missing = tmp_path / "nope"
    assert patrol._derive_repo_root(configured=str(missing)) is None


def test_derive_repo_root_package_fallback(tmp_path: Path, monkeypatch):
    # 构造 <root>/apps + <root>/.git + <root>/pkg/negentropy/__init__.py
    root = tmp_path / "monorepo"
    (root / "apps").mkdir(parents=True)
    (root / ".git").mkdir()
    pkg_init = root / "pkg" / "negentropy" / "__init__.py"
    pkg_init.parent.mkdir(parents=True)
    pkg_init.write_text("")
    monkeypatch.setattr(negentropy, "__file__", str(pkg_init))

    assert patrol._derive_repo_root(configured="") == str(root)


def test_derive_repo_root_package_fallback_finds_ancestor():
    # configured 为空时，从 negentropy 包路径向上找到最近含 .git + apps/ 的祖先（仓库根）。
    # 在仓库树内运行时即真实工作区根；断言结果非空且其下有 apps/ 子目录。
    result = patrol._derive_repo_root(configured="")
    assert result is not None
    assert (Path(result) / "apps").is_dir()


# ---------------------------------------------------------------------------
# _select_next_pending_doc
# ---------------------------------------------------------------------------


def test_select_next_pending_doc_returns_dict():
    import asyncio

    db = _FakeDB(fetchone=("doc-uuid", "pgblob://k", "report.pdf"))
    doc = asyncio.run(patrol._select_next_pending_doc(db, skip_ids=set()))
    assert doc == {"id": "doc-uuid", "content_uri": "pgblob://k", "original_filename": "report.pdf"}


def test_select_next_pending_doc_none_when_empty():
    import asyncio

    db = _FakeDB(fetchone=None)
    assert asyncio.run(patrol._select_next_pending_doc(db, skip_ids={"a", "b"})) is None


def test_select_next_pending_doc_skip_set_passes_expanding_param():
    """skip 非空时走 expanding bindparam；FakeDB 不解析 SQL，仅断言不抛且参数透传。"""
    import asyncio

    db = _FakeDB(fetchone=None)
    asyncio.run(patrol._select_next_pending_doc(db, skip_ids={"x1", "x2"}))
    assert db.executed  # 发出了一次 execute
    _stmt, params = db.executed[0]
    assert params["app"]  # 含 app_name 绑定
    assert "skip" in params


# ---------------------------------------------------------------------------
# _has_running_patrol / _select_regression_sample
# ---------------------------------------------------------------------------


def test_has_running_patrol_true_and_false():
    import asyncio

    assert asyncio.run(patrol._has_running_patrol(_FakeDB(fetchone=(1,)))) is True
    assert asyncio.run(patrol._has_running_patrol(_FakeDB(fetchone=None))) is False


def test_select_regression_sample_shape():
    import asyncio

    db = _FakeDB(fetchall=[("s1",), ("s2",), ("s3",)])
    sample = asyncio.run(patrol._select_regression_sample(db, size=3))
    assert sample == ["s1", "s2", "s3"]


# ---------------------------------------------------------------------------
# handler 禁用门控 → 结构化 metrics.reason（根因：patrol_enabled 默认 False 致 silent no-op）
# ---------------------------------------------------------------------------


def test_handler_disabled_gates_return_reason(monkeypatch):
    """禁用门控（routine_enabled / patrol_enabled）必须在 metrics.reason 体现，不再 silent ok。"""
    import asyncio
    from types import SimpleNamespace

    task = SimpleNamespace(key="pdf_fidelity_patrol")

    # routine 子系统禁用
    monkeypatch.setattr(
        patrol,
        "settings",
        SimpleNamespace(routine=SimpleNamespace(enabled=False, patrol_enabled=True)),
    )
    r1 = asyncio.run(patrol.pdf_fidelity_patrol_handler(task))
    assert r1.status == "ok"
    assert r1.metrics["reason"] == "routine_disabled"

    # 巡检禁用（部署期 patrol_enabled 默认 False 的根因路径）
    monkeypatch.setattr(
        patrol,
        "settings",
        SimpleNamespace(routine=SimpleNamespace(enabled=True, patrol_enabled=False)),
    )
    r2 = asyncio.run(patrol.pdf_fidelity_patrol_handler(task))
    assert r2.status == "ok"
    assert r2.metrics["reason"] == "patrol_disabled"
