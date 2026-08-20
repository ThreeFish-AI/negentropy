"""check_script 的覆盖性 / 预算 / 淡入不变式判定。"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

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


# ---------------- 读法陷阱（上游中文归一化的实测错读写法）----------------
#
# 每条断言对应一次在本机 index-tts venv 上直接跑 TextNormalizer.normalize() 的实测
# （2026-08-20）。反例组同样重要：`0.5~1.0 秒`→`零点五到一点零秒`、`9:30`→`九点三十分`
# 实测**正确**，故不得报错——加规则前先跑探针，别凭直觉扩大清单。


def write_narration(root: Path, texts: list[str]) -> None:
    """按 BOARD_OK 的 4 句骨架（p0-01/02 + p1-01/02）写 narration.json。"""
    import json as _json

    ids = ["p0-01", "p0-02", "p1-01", "p1-02"]
    items = [
        {"id": i, "scene": "P0" if i.startswith("p0") else "P1", "text": t}
        for i, t in zip(ids, texts, strict=True)
    ]
    (root / "script" / "narration.json").write_text(
        _json.dumps(items, ensure_ascii=False), encoding="utf-8"
    )


BENIGN = "这是一句普通的中文口播。"


@pytest.mark.parametrize(
    ("bad", "frag"),
    [
        ("论文发表于 2026 年六月。", "两千零二十六"),  # 4 位年份 + 空格
        ("升级到版本 2.5.1 之后。", "三段版本号"),
        ("速度快了 3-5 倍。", "三减五"),
        ("测量误差是 ±3 个点。", "正负"),
        ("整体提速 10x 左右。", "十x"),
    ],
)
def test_reading_trap_fails(project, bad, frag):
    write_board(project, BOARD_OK)
    write_config(project, CFG_OK)
    write_narration(project, [bad, BENIGN, BENIGN, BENIGN])
    rc, out = run_check(project)
    assert rc == 1, out
    assert "读法陷阱" in out and frag in out


def test_sentence_without_han_fails(project):
    """整句无汉字会被上游 use_chinese() 路由到英文归一化（2.5 → two point five）。"""
    write_board(project, BOARD_OK)
    write_config(project, CFG_OK)
    write_narration(project, ["IndexTTS 2.5", BENIGN, BENIGN, BENIGN])
    rc, out = run_check(project)
    assert rc == 1, out
    assert "整句无汉字" in out


@pytest.mark.parametrize(
    "ok",
    [
        "论文发表于 2026年六月。",  # 无空格才读「二零二六年」
        "耗时 0.5~1.0 秒。",  # 实测 → 零点五到一点零秒（正确）
        "上午 9:30 开始录制。",  # 实测 → 九点三十分（正确）
        "提升 16.2 个百分点。",  # 实测正确
        "6 月 20 日发布。",  # 实测正确
        "第 3 章第 1.2 节。",  # 实测正确
        "AI 与 LLM 都能做到。",  # 纯缩写原样透传
    ],
)
def test_reading_trap_no_false_positive(project, ok):
    write_board(project, BOARD_OK)
    write_config(project, CFG_OK)
    write_narration(project, [ok, BENIGN, BENIGN, BENIGN])
    rc, out = run_check(project)
    assert rc == 0, out
    assert "命中 0 处" in out


def test_model_designator_warns_not_fails(project):
    """`1080P` 读成「一千零八十P」——是缺陷但不阻断（型号写法多样，避免误伤）。"""
    write_board(project, BOARD_OK)
    write_config(project, CFG_OK)
    write_narration(project, ["输出 1080P 视频。", BENIGN, BENIGN, BENIGN])
    rc, out = run_check(project)
    assert rc == 0, out
    assert "WARN" in out and "一千零八十" in out
