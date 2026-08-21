"""tts.py 引擎护栏：漏写 --engine 的克隆参数硬失败 + 音色签名标记。"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from tts import check_voice_marker, server_launch_hint, write_voice_marker  # noqa: E402


def test_engine_guard_blocks_clone_flags_without_engine(tmp_path):
    """照抄文档打了 --ref/--style 却丢了 --engine → 必须退出非零（合成路径不再静默降级）。"""
    import subprocess

    script = Path(__file__).resolve().parents[1] / "scripts" / "tts.py"
    r = subprocess.run(
        [sys.executable, str(script), "--style", "sunny"],
        capture_output=True,
        text=True,
        check=False,
        cwd=tmp_path,
    )
    assert r.returncode != 0
    assert "--engine indextts" in (r.stderr + r.stdout)


def test_voice_marker_mismatch_blocks(tmp_path, capsys):
    write_voice_marker(tmp_path, "indextts|indextts|passionate|3ed0d9d60d4b")
    try:
        check_voice_marker(
            tmp_path, "indextts|indextts|sunny|54b699cce97f", allow_switch=False
        )
        raise AssertionError("应硬失败")
    except SystemExit as e:
        assert "音色签名与上次合成不一致" in str(e.code)
        assert "--allow-voice-switch" in str(e.code)


def test_voice_marker_same_signature_passes(tmp_path):
    write_voice_marker(tmp_path, "edge|zh-CN-YunxiNeural|+4%")
    check_voice_marker(
        tmp_path, "edge|zh-CN-YunxiNeural|+4%", allow_switch=False
    )  # 不抛即过


def test_voice_marker_explicit_switch_allowed(tmp_path):
    write_voice_marker(tmp_path, "edge|zh-CN-YunxiNeural|+4%")
    check_voice_marker(
        tmp_path, "indextts|indextts|sunny|54b699cce97f", allow_switch=True
    )


def test_voice_marker_absent_passes(tmp_path):
    check_voice_marker(tmp_path, "whatever", allow_switch=False)  # 无标记（首次合成）


def test_server_launch_hint_has_no_placeholder():
    hint = server_launch_hint()
    assert "<仓库路径>" not in hint
    assert "tts_server.py" in hint and "index-tts" in hint
    assert "checkpoints" in hint
