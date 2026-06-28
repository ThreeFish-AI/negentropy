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

    db = _FakeDB(fetchone=("doc-uuid", "pgblob://k", "report.pdf", None, None))
    doc = asyncio.run(patrol._select_next_pending_doc(db, skip_ids=set()))
    assert doc == {
        "id": "doc-uuid",
        "content_uri": "pgblob://k",
        "original_filename": "report.pdf",
        "display_name": None,
        "metadata_title": None,
    }


def test_select_next_pending_doc_carries_corrected_title_fields():
    """display_name / metadata_title 透传到返回 dict，供 _doc_display_title 三级解析。"""
    import asyncio

    db = _FakeDB(fetchone=("doc-uuid", "pgblob://k", "report.pdf", "用户改名", None))
    doc = asyncio.run(patrol._select_next_pending_doc(db, skip_ids=set()))
    assert doc["display_name"] == "用户改名"
    assert doc["metadata_title"] is None


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


# ---------------------------------------------------------------------------
# _build_patrol_routine：构造巡检 Routine（回归 no_progress_patience 误读 settings 致全量异常）
# ---------------------------------------------------------------------------


def test_build_patrol_routine_constructs_without_attribute_error():
    """回归：_build_patrol_routine 用真实 settings 装配字段，不得抛 AttributeError。

    历史 bug：``no_progress_patience=settings.routine.no_progress_patience`` —— 该属性
    不在 RoutineSettings（是 per-Routine DB 列），致 handler 全量执行异常、Routine 从不创建。
    """
    import uuid as _uuid

    repo_id = _uuid.uuid4()
    doc = {"id": _uuid.uuid4(), "original_filename": "report.pdf"}
    routine = patrol._build_patrol_routine(
        repo_id=repo_id,
        baseline_branch="origin/feature/1.x.x",
        doc=doc,
        source_pdf_path="/tmp/patrol/source.pdf",
        source_read_dir="/tmp/patrol",
        regression_sample=["s1"],
        source_task_key="pdf_fidelity_patrol",
    )
    # 关键字段装配正确（与 routine_api.create_routine 口径对齐）
    assert routine.no_progress_patience == 3  # per-Routine 默认，非 settings
    assert routine.success_score_threshold == 100
    assert routine.status == "running"
    assert routine.repository_id == repo_id
    assert routine.baseline_branch == "origin/feature/1.x.x"
    assert routine.owner_id == "system"
    assert routine.is_template is False
    assert routine.key.startswith("pdf-fidelity-patrol/")
    # config 装配（patrol 标记 + source_task_key 回链 + system_prompt）
    assert routine.config["patrol"] is True
    assert routine.config["source_task_key"] == "pdf_fidelity_patrol"
    assert "system_prompt" in routine.config
    assert routine.config["read_dirs"] == ["/tmp/patrol"]
    # 标题源：未修正时回退 original_filename（_doc_display_title 经 SSOT 解析）
    assert routine.title == "PDF 高保真巡检：report.pdf"


def test_build_patrol_routine_uses_corrected_display_name():
    """回归本次目标：用户修正后的 display_name 透传到 Routine 标题/展示名/描述/goal，
    原始文件名不再出现在用户可见标题链路。"""
    import uuid as _uuid

    doc = {
        "id": _uuid.uuid4(),
        "original_filename": "scan_2023.pdf",
        "display_name": "用户修正标题",
        "metadata_title": None,
    }
    routine = patrol._build_patrol_routine(
        repo_id=_uuid.uuid4(),
        baseline_branch="origin/feature/1.x.x",
        doc=doc,
        source_pdf_path="/tmp/patrol/source.pdf",
        source_read_dir="/tmp/patrol",
        regression_sample=["s1"],
        source_task_key="pdf_fidelity_patrol",
    )
    assert routine.title == "PDF 高保真巡检：用户修正标题"
    assert routine.display_name == "PDF Fidelity Patrol · 用户修正标题"
    assert "用户修正标题" in routine.description
    assert "用户修正标题" in routine.goal
    # 原始文件名不得出现在用户可见标题链路
    assert "scan_2023.pdf" not in routine.title
    assert "scan_2023.pdf" not in routine.display_name


def test_build_patrol_routine_falls_back_to_metadata_title():
    """display_name 缺省时回退到 PDF 自动抽取的 metadata_title（三级解析器第二级）。"""
    import uuid as _uuid

    doc = {
        "id": _uuid.uuid4(),
        "original_filename": "scan_2023.pdf",
        "display_name": None,
        "metadata_title": "自动抽取的文档标题",
    }
    routine = patrol._build_patrol_routine(
        repo_id=_uuid.uuid4(),
        baseline_branch="origin/feature/1.x.x",
        doc=doc,
        source_pdf_path="/tmp/p.pdf",
        source_read_dir="/tmp",
        regression_sample=[],
        source_task_key="pdf_fidelity_patrol",
    )
    assert routine.title == "PDF 高保真巡检：自动抽取的文档标题"
