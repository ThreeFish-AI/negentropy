"""check_script 的覆盖性 / 预算 / 淡入不变式判定。"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_script.py"


def run_check(root: Path, *extra: str) -> tuple[int, str]:
    r = subprocess.run(
        [sys.executable, str(SCRIPT), "--project", str(root), *extra],
        capture_output=True,
        text=True,
        check=False,
    )
    return r.returncode, r.stdout + r.stderr


def write_board(root: Path, table: str) -> None:
    (root / "script" / "storyboard.md").write_text(table, encoding="utf-8")


def write_config(root: Path, toml: str) -> None:
    (root / "pipeline.toml").write_text(toml, encoding="utf-8")


BOARD_OK = """# 分镜
## P0
| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A | p0-01..02 | x | y |
## P1
| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A | p1-01..02 | x | y |
"""

CFG_OK = """[narration]
target_minutes = [0.0, 99.0]
chars_per_min = 280
"""


def test_all_green(project):
    write_board(project, BOARD_OK)
    write_config(project, CFG_OK)
    rc, out = run_check(project)
    assert rc == 0, out
    assert not [line for line in out.splitlines() if line.strip().startswith("FAIL")]


def test_missing_sentence_fails(project):
    board = BOARD_OK.replace("| 1-A | p1-01..02 |", "| 1-A | p1-01..01 |")
    write_board(project, board)
    write_config(project, CFG_OK)
    rc, out = run_check(project)
    assert rc == 1
    assert "p1-02" in out and "未覆盖" in out


def test_unknown_id_fails(project):
    board = BOARD_OK.replace("p1-01..02", "p1-01..p9-99")
    write_board(project, board)
    write_config(project, CFG_OK)
    rc, out = run_check(project)
    assert rc == 1
    assert "p9-99" in out


def test_overlap_warns_but_passes(project):
    board = BOARD_OK.replace(
        "| 0-A | p0-01..02 | x | y |",
        "| 0-A | p0-01..02 | x | y |\n| 0-B | p0-02 | 标题卡 | 压尾 |",
    )
    write_board(project, board)
    write_config(project, CFG_OK)
    rc, out = run_check(project)
    assert rc == 0  # WARN 不判死
    assert "重叠" in out


def test_annotated_overlap_silent(project):
    board = BOARD_OK.replace(
        "| 0-A | p0-01..02 | x | y |",
        "| 0-A | p0-01..02 | x | y |\n| 0-B | p0-02 尾 | 标题卡 | 压尾 |",
    )
    write_board(project, board)
    write_config(project, CFG_OK)
    rc, out = run_check(project)
    assert rc == 0
    assert "重叠" not in out  # 「尾」标注 = 刻意惯例，静默


def test_budget_window_fails(project):
    write_board(project, BOARD_OK)
    write_config(
        project, "[narration]\ntarget_minutes = [0.0, 0.01]\nchars_per_min = 280\n"
    )
    rc, out = run_check(project)
    assert rc == 1
    assert "超预算" in out


def test_measured_budget_uses_manifest(project):
    write_board(project, BOARD_OK)
    # fixture manifest 实测 ≈ (3.10+0.32)+(2.05+1.22)+(4.77+0.32)+(1.02)+tail 2.0 ≈ 14.8s
    write_config(
        project, "[narration]\ntarget_minutes = [0.0, 0.5]\nchars_per_min = 280\n"
    )
    rc, out = run_check(project)
    assert rc == 0, out
    assert "实测口径" in out


def test_fade_invariant(project):
    (project / "video/src/timing.json").write_text(
        '{"fps":30,"sentenceGapSec":0.32,"sceneGapSec":0.9,"leadInSec":0.6,"tailSec":2.0,"sceneCrossFadeSec":0.9}',
        encoding="utf-8",
    )
    write_board(project, BOARD_OK)
    write_config(project, CFG_OK)
    rc, out = run_check(project)
    assert rc == 1
    assert "淡入淡出" in out or "sceneCrossFadeSec" in out
