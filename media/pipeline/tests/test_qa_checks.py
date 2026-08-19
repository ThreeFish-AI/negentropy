"""qa_check 判据（PIL 合成图）与 WCAG 对比度计算。"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from qa_frames import check_frames, check_theme, wcag_ratio  # noqa: E402


def make_png(path: Path, mode: str, scale: float = 1.0) -> None:
    w, h = round(1920 * scale), round(1080 * scale)
    arr = np.zeros((h, w), dtype=np.uint8)  # 深色底 #0E1116 ≈ 17
    arr[:] = 17
    if mode == "subtitle":  # 底部中央字幕条（亮块）
        bw = round(600 * scale)
        x0 = (w - bw) // 2
        arr[h - round(80 * scale) : h - round(20 * scale), x0 : x0 + bw] = 235
    elif mode == "intrude":  # 字幕带左侧侵入的亮角标
        arr[
            h - round(120 * scale) : h - round(40 * scale),
            round(60 * scale) : round(220 * scale),
        ] = 210
    elif mode == "bright":
        arr[:] = 120
    path.write_bytes(b"")
    Image.fromarray(arr).save(path)


def run_check(tmp_path: Path, names: list[str], scale: float = 1.0) -> list[str]:
    out = tmp_path / "frames"
    out.mkdir(exist_ok=True)
    for n in names:
        make_png(
            out / f"{n}.png",
            n if n.startswith(("subtitle", "intrude", "bright")) else "subtitle",
            scale,
        )
    msgs: list[str] = []
    check_frames(out, names, scale, fade_exempt_last=False, msgs=msgs)
    return msgs


def test_black_frame_fails(tmp_path):
    msgs = run_check(tmp_path, ["bright", "subtitle"], scale=1.0)
    # 直接构造全黑帧再测
    out = tmp_path / "frames"
    Image.fromarray(np.zeros((1080, 1920), dtype=np.uint8)).save(out / "p9-99.png")
    msgs = []
    check_frames(out, ["p9-99"], 1.0, False, msgs)
    assert any("黑帧" in m and m.startswith("FAIL") for m in msgs)


def test_normal_subtitle_frame_clean(tmp_path):
    msgs = run_check(tmp_path, ["subtitle"])
    assert not any(m.startswith("FAIL") for m in msgs)
    assert not any("侵入" in m for m in msgs)


def test_intrusion_warns(tmp_path):
    # 需要同时有字幕块与左侧侵入块——intrude 模式画在字幕带左外侧
    out = tmp_path / "frames"
    out.mkdir(exist_ok=True)
    w, h = 1920, 1080
    arr = np.full((h, w), 17, dtype=np.uint8)
    arr[h - 80 : h - 20, (w - 600) // 2 : (w + 600) // 2] = 235  # 字幕
    arr[h - 120 : h - 40, 60:220] = 210  # 左侧角标侵入
    Image.fromarray(arr).save(out / "p5-99.png")
    msgs: list[str] = []
    check_frames(out, ["p5-99"], 1.0, False, msgs)
    assert any("侵入" in m for m in msgs)


def test_frozen_frame_warns(tmp_path):
    out = tmp_path / "frames"
    out.mkdir(exist_ok=True)
    img = np.full((1080, 1920), 17, dtype=np.uint8)
    img[100:200, 100:400] = 200
    for n in ("p2-01", "p2-02"):
        Image.fromarray(img).save(out / f"{n}.png")
    msgs: list[str] = []
    check_frames(out, ["p2-01", "p2-02"], 1.0, False, msgs)
    assert any("冻帧" in m for m in msgs)


def test_wcag_known_ratios():
    # WCAG 2.x 已知值：黑 vs 白 = 21:1；#F5C542 vs #0E1116 ≈ 11.66:1（与三集实测一致）
    assert abs(wcag_ratio((0, 0, 0), (255, 255, 255)) - 21.0) < 0.01
    assert abs(wcag_ratio((245, 197, 66), (14, 17, 22)) - 11.66) < 0.05


def test_theme_check_passes_and_fails(tmp_path):
    theme = tmp_path / "video/src/design/theme.ts"
    theme.parent.mkdir(parents=True)
    theme.write_text(
        "export const theme = {\n  bg: '#0E1116',\n  good: '#F5C542',\n  bad: '#5A6274',\n} as const;\n",
        encoding="utf-8",
    )
    msgs: list[str] = []
    check_theme(tmp_path, msgs)
    joined = "\n".join(msgs)
    assert "good" not in joined  # 4.5:1 以上不进 msgs
    assert any("bad" in m and m.startswith("FAIL") for m in msgs)
