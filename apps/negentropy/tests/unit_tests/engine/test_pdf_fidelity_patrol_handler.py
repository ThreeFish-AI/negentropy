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
    def __init__(self, *, fetchone: Any = None, fetchall: Any = None, scalar: Any = None, rowcount: int = 0) -> None:
        self._fetchone = fetchone
        self._fetchall = fetchall
        self._scalar = scalar
        self.rowcount = rowcount

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


def test_select_next_pending_doc_sql_contains_per_doc_uniqueness_guard():
    """Fix A + 命名门控：emitted SQL 必含「命名门控」+「一文一活跃巡检」NOT EXISTS 守卫（排除 cancelled）。

    FakeDB 不解析 SQL，仅以串存在性守护不变量防回归——后续重构若误删命名门控 / NOT EXISTS /
    把 cancelled 纳入阻塞，本断言即失败。真实 SQL 语义由集成测试覆盖。
    """
    import asyncio

    db = _FakeDB(fetchone=None)
    asyncio.run(patrol._select_next_pending_doc(db, skip_ids=set()))
    stmt = db.executed[0][0]
    # 命名门控：display_name 或 metadata->>'title' 至少一个非空（杜绝原始文件名兜底）
    assert "COALESCE(NULLIF(display_name, ''), NULLIF(metadata->>'title', '')) IS NOT NULL" in stmt
    assert "NOT EXISTS" in stmt
    assert "config->>'patrol'" in stmt
    assert "config->>'doc_id'" in stmt
    assert "status <> 'cancelled'" in stmt  # cancelled 排除（取消即复位）


# ---------------------------------------------------------------------------
# _collapse_superseded_patrols：收敛「一文一巡检」（去重 + 原始文件名兜底自愈）
# ---------------------------------------------------------------------------


def test_collapse_superseded_patrols_emits_dedupe_update():
    """Fix C：发射一条「一文一巡检」去重 UPDATE（CTE 排序保留 rank 1），关键片段就位且返回 rowcount。

    FakeDB 不解析 SQL；以串存在性守护不变量防回归——保留 rank 1（非原始名/succeeded/最新优先）、
    取消 rn>1 冗余 + has_name&is_raw（有更优名源时的原始文件名兜底）。真实语义见集成测试。
    """
    import asyncio

    db = _FakeDB(rowcount=3)
    n = asyncio.run(patrol._collapse_superseded_patrols(db))
    assert n == 3
    assert len(db.executed) == 1
    stmt = db.executed[0][0]
    assert "WITH ranked" in stmt  # CTE 排序选保留项
    assert "ROW_NUMBER()" in stmt
    assert "PARTITION BY r.config->>'doc_id'" in stmt  # 按 doc 分组
    assert "status IN ('succeeded', 'failed')" in stmt  # 仅终态（不触碰 running/paused）
    assert "UPDATE negentropy.routines" in stmt
    assert "status = 'cancelled'" in stmt
    assert "superseded_patrol" in stmt
    assert "outcome_propagated" in stmt  # 不回写 ScheduledTask 聚合态
    assert "rn > 1" in stmt  # 取消冗余
    assert "has_name = 1 AND is_raw = 1" in stmt  # 有更优名源时取消原始文件名兜底


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
    # 禁用=本轮无生命周期活动 → idle 标记（让 registry 不声称聚合状态终态）
    assert r1.metrics[patrol.PATROL_LIFECYCLE_KEY] == patrol.PATROL_LIFECYCLE_IDLE

    # 巡检禁用（部署期 patrol_enabled 默认 False 的根因路径）
    monkeypatch.setattr(
        patrol,
        "settings",
        SimpleNamespace(routine=SimpleNamespace(enabled=True, patrol_enabled=False)),
    )
    r2 = asyncio.run(patrol.pdf_fidelity_patrol_handler(task))
    assert r2.status == "ok"
    assert r2.metrics["reason"] == "patrol_disabled"
    assert r2.metrics[patrol.PATROL_LIFECYCLE_KEY] == patrol.PATROL_LIFECYCLE_IDLE


# ---------------------------------------------------------------------------
# patrol_lifecycle 标记：tick 各路径（spawn/in_progress→in_flight；no_pending/repo_not_configured→idle）
# ---------------------------------------------------------------------------


def test_run_patrol_tick_carries_lifecycle_markers():
    """白盒：_run_patrol_tick 的 spawn/in_progress 路径标 in_flight、no_pending/repo_not_configured 标 idle。

    这四条路径依赖真实 PG + blob，行为级覆盖在集成测试（_finalize_execution 延迟语义）；
    此处仅断言标记就位，防止后续重构无意间丢失（与既有白盒断言同风格）。
    """
    import inspect

    body = inspect.getsource(patrol._run_patrol_tick)
    # 源码中以标识符形式出现（非常量值）：spawn + in_progress = 2 处 in_flight
    assert body.count("PATROL_LIFECYCLE_IN_FLIGHT") >= 2
    # no_pending_docs + repo_not_configured = 2 处 idle
    assert body.count("PATROL_LIFECYCLE_IDLE") >= 2
    # stage_failed 是真失败（不打标记，走既有 failed 分支）
    assert "stage_source_pdf_failed" in body


def test_finalize_terminal_patrols_branches_present():
    """白盒：_finalize_terminal_patrols 含确定性推进的关键分支（防重构丢失）。

    - ``cancelled`` 显式跳过沉淀（用户干预，文档保持可重新选中）。
    - ``persist_terminal_outcome`` 调用（best_score 兜底，修「始终拟合同一份文档」根因）。
    - 候选查询取 best_score/doc_id 且 ``ORDER BY ... best_score``（同文档多 Routine 最佳拟合胜出）。
    - ``patrol_qualified_score_threshold`` 注入合格阈值。
    """
    import inspect

    body = inspect.getsource(patrol._finalize_terminal_patrols)
    assert "cancelled" in body  # cancelled 分支（不沉淀状态）
    assert "persist_terminal_outcome" in body  # 确定性终态沉淀（SSOT 写者）
    assert "best_score" in body  # 候选查询取 best_score + ORDER BY
    assert "patrol_qualified_score_threshold" in body  # 合格阈值注入
    # _mark_memory_persisted 抽出（消除重复 UPDATE）
    assert hasattr(patrol, "_mark_memory_persisted")


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
    assert routine.success_score_threshold == 95  # 合格阈值（patrol_qualified_score_threshold；原 100→收敛即 SUCCESS）
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
    # 停滞容差带：防 Judge 聚合分 ±振荡致假阳性 no_progress 误杀（消费见 orchestrator.decide()）
    assert routine.config["no_progress_score_tolerance"] == 20
    # 标题源：未修正时回退 original_filename（_doc_display_title 经 SSOT 解析）
    assert routine.title == "PDF 高保真巡检：report.pdf"


def test_build_patrol_routine_candidate_md_is_absolute_outside_worktree():
    """回归 PR #1010：候选 Markdown 须落在源 PDF 暂存目录内（绝对路径、worktree 之外）。

    历史 bug：``candidate_md_path=CANDIDATE_MD_FILENAME``（相对文件名）→ agent 在 worktree 根写出
    候选 → ``git add -A`` 将其提交并随 PR 推出（PR 仅含 ``patrol-candidate.md``）。候选是评估用
    临时产物（perceives parse-pdf -o），须置 worktree 外、永不进 commit/PR。
    """
    import uuid as _uuid

    repo_id = _uuid.uuid4()
    doc = {"id": _uuid.uuid4(), "original_filename": "report.pdf"}
    source_read_dir = "/tmp/negentropy-patrol/013c5ebc"
    routine = patrol._build_patrol_routine(
        repo_id=repo_id,
        baseline_branch="origin/feature/1.x.x",
        doc=doc,
        source_pdf_path=f"{source_read_dir}/source.pdf",
        source_read_dir=source_read_dir,
        regression_sample=["s1"],
        source_task_key="pdf_fidelity_patrol",
    )
    expected = f"{source_read_dir}/{patrol.CANDIDATE_MD_FILENAME}"
    # 绝对路径、暂存目录内（source.pdf 同级）、worktree 之外
    assert routine.config["candidate_md_path"] == expected
    assert routine.config["candidate_md_path"] == str(Path(expected))
    assert not routine.config["candidate_md_path"].startswith(patrol.CANDIDATE_MD_FILENAME)  # 非裸相对文件名
    # goal 同步注入该绝对候选路径
    assert expected in routine.goal


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
