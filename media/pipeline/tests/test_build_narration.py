"""build_narration 解析/校验分支（经 subprocess 走真实 CLI 入口）。"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_narration.py"


def run_build(root: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--project", str(root)],
        capture_output=True,
        text=True,
        check=False,
    )


def make_project(tmp_path: Path, md: str) -> Path:
    root = tmp_path / "ep"
    (root / "script").mkdir(parents=True)
    (root / "script" / "narration.md").write_text(md, encoding="utf-8")
    return root


def test_happy_path_and_golden_json(tmp_path):
    root = make_project(
        tmp_path,
        "## P0 开场\n\n- [p0-01] 甲句。\n> 备注不入稿\n- [p0-02] 乙句。\n\n## 不相关标题\n",
    )
    r = run_build(root)
    assert r.returncode == 0, r.stderr
    data = json.loads((root / "script" / "narration.json").read_text(encoding="utf-8"))
    assert data == [
        {"id": "p0-01", "scene": "P0", "text": "甲句。"},
        {"id": "p0-02", "scene": "P0", "text": "乙句。"},
    ]
    assert "不相关标题" not in json.dumps(data, ensure_ascii=False)


def test_missing_file_actionable_exit(tmp_path):
    root = tmp_path / "empty"
    (root / "script").mkdir(parents=True)
    r = run_build(root)
    assert r.returncode != 0
    assert "narration.md 不存在" in r.stderr or "narration.md 不存在" in r.stdout


def test_duplicate_id(tmp_path):
    root = make_project(tmp_path, "## P0\n- [p0-01] 甲。\n- [p0-01] 乙。\n")
    r = run_build(root)
    assert r.returncode != 0
    assert "重复句 id" in (r.stderr + r.stdout)


def test_scene_prefix_mismatch_names_scene(tmp_path):
    root = make_project(tmp_path, "## P1\n- [p1-01] 对。\n- [p0-09] 错。\n")
    r = run_build(root)
    assert r.returncode != 0
    assert "p0-09" in (r.stderr + r.stdout) and "P1" in (r.stderr + r.stdout)


def test_sentence_before_any_scene_heading(tmp_path):
    root = make_project(tmp_path, "- [p0-01] 无幕句。\n\n## P0\n- [p0-02] 有幕句。\n")
    r = run_build(root)
    assert r.returncode != 0
    assert "## Pn" in (r.stderr + r.stdout)  # 报真正原因而非「与所在幕  不一致」
