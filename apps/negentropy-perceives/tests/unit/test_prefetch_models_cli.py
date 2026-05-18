"""``perceives prefetch-models`` CLI 单元测试。

覆盖：
1. 引擎子集选择（monkeypatch 真实下载函数，断言仅触发所选引擎）；
2. 未安装引擎走 ``_SkipEngine`` 分支，输出 ``skipped`` 且不抛异常；
3. ``--hf-home`` 正确设置 ``os.environ["HF_HOME"]``；
4. 任一引擎失败 → 退出码 1；全部 ok/skipped → 退出码 0；
5. ``--engines`` 解析（``all`` / 逗号 / 非法值）。
"""

from __future__ import annotations

import os

import pytest
from typer.testing import CliRunner

from negentropy.perceives.cli.app import app
from negentropy.perceives.cli.commands import prefetch_models as pm


runner = CliRunner()


@pytest.fixture(autouse=True)
def _restore_hf_home():
    """隔离 HF_HOME 环境变量污染。"""
    saved = os.environ.get("HF_HOME")
    yield
    if saved is None:
        os.environ.pop("HF_HOME", None)
    else:
        os.environ["HF_HOME"] = saved


@pytest.fixture(autouse=True)
def _restore_mineru_source():
    """隔离 MINERU_MODEL_SOURCE 环境变量污染。"""
    saved = os.environ.get("MINERU_MODEL_SOURCE")
    yield
    if saved is None:
        os.environ.pop("MINERU_MODEL_SOURCE", None)
    else:
        os.environ["MINERU_MODEL_SOURCE"] = saved


# ---------------------------------------------------------------------------
# _parse_engines
# ---------------------------------------------------------------------------


def test_parse_engines_all():
    assert pm._parse_engines("all") == ["docling", "marker", "mineru"]
    assert pm._parse_engines("") == ["docling", "marker", "mineru"]


def test_parse_engines_subset_and_dedup():
    assert pm._parse_engines("docling,marker") == ["docling", "marker"]
    assert pm._parse_engines("marker,marker,docling") == ["marker", "docling"]


def test_parse_engines_rejects_unknown():
    import typer

    with pytest.raises(typer.BadParameter):
        pm._parse_engines("docling,foobar")


# ---------------------------------------------------------------------------
# CLI 行为
# ---------------------------------------------------------------------------


def _patch_all_ok(monkeypatch: pytest.MonkeyPatch, called: list[str]):
    def _docling() -> str:
        called.append("docling")
        return "docling-note"

    def _marker() -> str:
        called.append("marker")
        return "marker-note"

    def _mineru(source=None, timeout=1800) -> str:  # noqa: ARG001 — 兼容新签名
        called.append("mineru")
        return "mineru-note"

    monkeypatch.setattr(pm, "_prefetch_docling", _docling)
    monkeypatch.setattr(pm, "_prefetch_marker", _marker)
    monkeypatch.setattr(pm, "_prefetch_mineru", _mineru)


def test_cli_all_engines_ok(monkeypatch: pytest.MonkeyPatch):
    called: list[str] = []
    _patch_all_ok(monkeypatch, called)

    result = runner.invoke(app, ["prefetch-models"])
    assert result.exit_code == 0, result.output
    assert called == ["docling", "marker", "mineru"]
    assert "ok" in result.output


def test_cli_engines_subset_only_calls_selected(monkeypatch: pytest.MonkeyPatch):
    called: list[str] = []
    _patch_all_ok(monkeypatch, called)

    result = runner.invoke(app, ["prefetch-models", "--engines", "docling,marker"])
    assert result.exit_code == 0, result.output
    assert called == ["docling", "marker"]
    assert "mineru" not in called


def test_cli_skipped_engine_still_exits_zero(monkeypatch: pytest.MonkeyPatch):
    """未安装引擎 → skipped，不影响退出码。"""

    def _skip() -> str:
        raise pm._SkipEngine("not installed")

    def _ok() -> str:
        return "ok-note"

    def _ok_mineru(source=None, timeout=1800) -> str:  # noqa: ARG001
        return "ok-note"

    monkeypatch.setattr(pm, "_prefetch_docling", _ok)
    monkeypatch.setattr(pm, "_prefetch_marker", _skip)
    monkeypatch.setattr(pm, "_prefetch_mineru", _ok_mineru)

    result = runner.invoke(app, ["prefetch-models"])
    assert result.exit_code == 0, result.output
    assert "skipped" in result.output
    assert "not installed" in result.output


def test_cli_error_engine_exits_nonzero(monkeypatch: pytest.MonkeyPatch):
    def _boom() -> str:
        raise RuntimeError("kaboom")

    def _ok() -> str:
        return "ok"

    def _ok_mineru(source=None, timeout=1800) -> str:  # noqa: ARG001
        return "ok"

    monkeypatch.setattr(pm, "_prefetch_docling", _ok)
    monkeypatch.setattr(pm, "_prefetch_marker", _boom)
    monkeypatch.setattr(pm, "_prefetch_mineru", _ok_mineru)

    result = runner.invoke(app, ["prefetch-models"])
    assert result.exit_code == 1
    assert "error" in result.output
    assert "kaboom" in result.output


def test_cli_hf_home_sets_env(monkeypatch: pytest.MonkeyPatch, tmp_path):
    """--hf-home 应当把环境变量传导给底层下载栈。"""
    called: list[str] = []

    def _check() -> str:
        called.append(os.environ.get("HF_HOME", ""))
        return "ok"

    def _check_mineru(source=None, timeout=1800) -> str:  # noqa: ARG001
        called.append(os.environ.get("HF_HOME", ""))
        return "ok"

    monkeypatch.setattr(pm, "_prefetch_docling", _check)
    monkeypatch.setattr(pm, "_prefetch_marker", _check)
    monkeypatch.setattr(pm, "_prefetch_mineru", _check_mineru)

    custom = str(tmp_path / "hf_cache")
    result = runner.invoke(app, ["prefetch-models", "--hf-home", custom])
    assert result.exit_code == 0, result.output
    # 每个引擎都应看到已设置的 HF_HOME
    assert all(env == custom for env in called), called


def test_cli_unknown_engine_returns_error(monkeypatch: pytest.MonkeyPatch):
    _patch_all_ok(monkeypatch, [])
    result = runner.invoke(app, ["prefetch-models", "--engines", "nope"])
    assert result.exit_code != 0
    # Typer BadParameter 的输出
    assert "nope" in result.output or "Usage" in result.output


# ---------------------------------------------------------------------------
# 触发下载的守门逻辑（不触网）
# ---------------------------------------------------------------------------


def test_prefetch_docling_missing_module_skips(monkeypatch: pytest.MonkeyPatch):
    """docling 未安装 → _SkipEngine。"""
    import builtins

    real_import = builtins.__import__

    def _fake_import(name, *args, **kwargs):
        if name.startswith("docling"):
            raise ImportError(f"no module {name}")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _fake_import)
    with pytest.raises(pm._SkipEngine):
        pm._prefetch_docling()


def test_prefetch_docling_uses_runtime_converter(monkeypatch: pytest.MonkeyPatch):
    """docling 预热应复用 DoclingEngine 初始化路径，覆盖 MPS/MLX 策略。"""
    from negentropy.perceives.pdf.engines.docling import DoclingEngine

    called = {"count": 0}

    def _fake_get_converter(self):  # noqa: ANN001
        called["count"] += 1
        return object()

    monkeypatch.setattr(DoclingEngine, "_get_converter", _fake_get_converter)

    note = pm._prefetch_docling()
    assert called["count"] == 1
    assert "code/formula" in note


def test_prefetch_mineru_missing_binary_skips(monkeypatch: pytest.MonkeyPatch):
    """mineru 导入成功但 CLI 缺失 → _SkipEngine。"""
    import sys
    import types

    fake = types.ModuleType("mineru")
    monkeypatch.setitem(sys.modules, "mineru", fake)
    monkeypatch.setattr(pm.shutil, "which", lambda name: None)

    with pytest.raises(pm._SkipEngine):
        pm._prefetch_mineru()


def test_prefetch_mineru_subprocess_failure_raises(monkeypatch: pytest.MonkeyPatch):
    """子进程非零退出 → RuntimeError（被 _dispatch 上报为 error）。

    新实现不再 capture stdout/stderr（让 tqdm 进度条直通终端），故错误消息
    只依赖 returncode；测试相应放宽断言。
    """
    import sys
    import types

    fake = types.ModuleType("mineru")
    monkeypatch.setitem(sys.modules, "mineru", fake)
    monkeypatch.setattr(pm.shutil, "which", lambda name: "/tmp/fake-mineru")

    class _R:
        returncode = 2

    def _run(cmd, **kw):  # noqa: ANN001
        return _R()

    monkeypatch.setattr(pm.subprocess, "run", _run)

    with pytest.raises(RuntimeError) as ei:
        pm._prefetch_mineru()
    assert "2" in str(ei.value)


def test_prefetch_mineru_default_source_is_modelscope(
    monkeypatch: pytest.MonkeyPatch,
):
    """未设置 MINERU_MODEL_SOURCE 且未传 --mineru-source → 默认 modelscope。

    既要在 cmd 上体现 ``-s modelscope``（向后兼容旧版 CLI），也要在
    ``MINERU_MODEL_SOURCE`` 环境变量上体现（新版 mineru 以 env 为准）。
    """
    import sys
    import types

    fake = types.ModuleType("mineru")
    monkeypatch.setitem(sys.modules, "mineru", fake)
    monkeypatch.setattr(pm.shutil, "which", lambda name: "/tmp/fake-mineru")
    monkeypatch.delenv("MINERU_MODEL_SOURCE", raising=False)

    captured_cmd: list[str] = []
    captured_env: dict[str, str] = {}

    class _R:
        returncode = 0

    def _run(cmd, **kw):  # noqa: ANN001
        captured_cmd.extend(cmd)
        captured_env["MINERU_MODEL_SOURCE"] = os.environ.get("MINERU_MODEL_SOURCE", "")
        return _R()

    monkeypatch.setattr(pm.subprocess, "run", _run)

    pm._prefetch_mineru()
    assert "-s" in captured_cmd
    s_idx = captured_cmd.index("-s")
    assert captured_cmd[s_idx + 1] == "modelscope"
    assert captured_env["MINERU_MODEL_SOURCE"] == "modelscope"


def test_prefetch_mineru_respects_user_env(monkeypatch: pytest.MonkeyPatch):
    """用户预设 MINERU_MODEL_SOURCE → 即使 CLI 默认 modelscope 也不覆盖。"""
    import sys
    import types

    fake = types.ModuleType("mineru")
    monkeypatch.setitem(sys.modules, "mineru", fake)
    monkeypatch.setattr(pm.shutil, "which", lambda name: "/tmp/fake-mineru")
    monkeypatch.setenv("MINERU_MODEL_SOURCE", "huggingface")

    captured_cmd: list[str] = []

    class _R:
        returncode = 0

    def _run(cmd, **kw):  # noqa: ANN001
        captured_cmd.extend(cmd)
        return _R()

    monkeypatch.setattr(pm.subprocess, "run", _run)

    pm._prefetch_mineru()  # CLI 未显式指定 source
    s_idx = captured_cmd.index("-s")
    assert captured_cmd[s_idx + 1] == "huggingface"
    assert os.environ["MINERU_MODEL_SOURCE"] == "huggingface"


def test_prefetch_mineru_explicit_source_wins_over_env(
    monkeypatch: pytest.MonkeyPatch,
):
    """显式传入 source（CLI 直传） > 环境变量 > 默认 modelscope。"""
    import sys
    import types

    fake = types.ModuleType("mineru")
    monkeypatch.setitem(sys.modules, "mineru", fake)
    monkeypatch.setattr(pm.shutil, "which", lambda name: "/tmp/fake-mineru")
    monkeypatch.setenv("MINERU_MODEL_SOURCE", "modelscope")

    captured_cmd: list[str] = []

    class _R:
        returncode = 0

    def _run(cmd, **kw):  # noqa: ANN001
        captured_cmd.extend(cmd)
        return _R()

    monkeypatch.setattr(pm.subprocess, "run", _run)

    pm._prefetch_mineru(source="huggingface")
    s_idx = captured_cmd.index("-s")
    assert captured_cmd[s_idx + 1] == "huggingface"
    # 同步刷新 env 让子进程一致看到
    assert os.environ["MINERU_MODEL_SOURCE"] == "huggingface"


def test_prefetch_mineru_timeout_raises(monkeypatch: pytest.MonkeyPatch):
    """子进程超时 → RuntimeError，错误消息含"超时"提示与切换建议。"""
    import subprocess as sp_real
    import sys
    import types

    fake = types.ModuleType("mineru")
    monkeypatch.setitem(sys.modules, "mineru", fake)
    monkeypatch.setattr(pm.shutil, "which", lambda name: "/tmp/fake-mineru")

    def _run(cmd, **kw):  # noqa: ANN001
        raise sp_real.TimeoutExpired(cmd=cmd, timeout=kw.get("timeout", 0))

    monkeypatch.setattr(pm.subprocess, "run", _run)

    with pytest.raises(RuntimeError) as ei:
        pm._prefetch_mineru(timeout=1)
    assert "超时" in str(ei.value)


def test_prefetch_mineru_does_not_capture_stdout(monkeypatch: pytest.MonkeyPatch):
    """关键回归保护：不能再用 capture_output / PIPE 吞掉 tqdm 进度条。"""
    import sys
    import types

    fake = types.ModuleType("mineru")
    monkeypatch.setitem(sys.modules, "mineru", fake)
    monkeypatch.setattr(pm.shutil, "which", lambda name: "/tmp/fake-mineru")

    captured_kw: dict = {}

    class _R:
        returncode = 0

    def _run(cmd, **kw):  # noqa: ANN001
        captured_kw.update(kw)
        return _R()

    monkeypatch.setattr(pm.subprocess, "run", _run)

    pm._prefetch_mineru()
    assert captured_kw.get("capture_output") in (None, False), captured_kw
    assert captured_kw.get("stdout") is None, captured_kw
    assert captured_kw.get("stderr") is None, captured_kw


def test_cli_mineru_source_override_passed_through(monkeypatch: pytest.MonkeyPatch):
    """`--mineru-source huggingface` 应当被透传到 _prefetch_mineru。"""
    captured_kwargs: dict = {}

    def _docling() -> str:
        return "ok"

    def _marker() -> str:
        return "ok"

    def _mineru(source=None, timeout=1800) -> str:
        captured_kwargs["source"] = source
        captured_kwargs["timeout"] = timeout
        return "ok"

    monkeypatch.setattr(pm, "_prefetch_docling", _docling)
    monkeypatch.setattr(pm, "_prefetch_marker", _marker)
    monkeypatch.setattr(pm, "_prefetch_mineru", _mineru)

    result = runner.invoke(
        app,
        [
            "prefetch-models",
            "--engines",
            "mineru",
            "--mineru-source",
            "huggingface",
            "--mineru-timeout",
            "120",
        ],
    )
    assert result.exit_code == 0, result.output
    assert captured_kwargs["source"] == "huggingface"
    assert captured_kwargs["timeout"] == 120
