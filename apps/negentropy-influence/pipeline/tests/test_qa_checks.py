"""qa_check 判据（PIL 合成图）与 WCAG 对比度计算。"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from qa_frames import check_frames, check_theme, tail_row_has_fade, wcag_ratio  # noqa: E402


def make_png(path: Path, mode: str, scale: float = 1.0) -> None:
    """合成测试帧。几何须与真实成片一致（见 qa_frames.SUBTITLE_BOX_H_PX）：

    字幕安全带 = 底部 160px；其中**下** 132px 是字幕框自身占位，只有**上** 28px
    （y ∈ [h-160, h-132)）是「不该有东西」的窄带 —— 侵入判据只看这一条。
    """
    w, h = round(1920 * scale), round(1080 * scale)
    arr = np.zeros((h, w), dtype=np.uint8)  # 深色底 #0E1116 ≈ 17
    arr[:] = 17
    if mode == "subtitle":  # 底部中央字幕条（落在框占位区内，不构成侵入）
        bw = round(600 * scale)
        x0 = (w - bw) // 2
        arr[h - round(80 * scale) : h - round(20 * scale), x0 : x0 + bw] = 235
    elif mode == "intrude":  # 压进框上方窄带的角标
        arr[
            h - round(158 * scale) : h - round(136 * scale),
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
    """字幕框**上方**窄带（y∈[h-160,h-132)）出现亮块 = 角标压进安全区。"""
    out = tmp_path / "frames"
    out.mkdir(exist_ok=True)
    w, h = 1920, 1080
    arr = np.full((h, w), 17, dtype=np.uint8)
    arr[h - 80 : h - 20, (w - 600) // 2 : (w + 600) // 2] = 235  # 字幕（框占位区内）
    arr[h - 158 : h - 136, 60:220] = 210  # 角标压进框上方窄带
    Image.fromarray(arr).save(out / "p5-99.png")
    msgs: list[str] = []
    check_frames(out, ["p5-99"], 1.0, False, msgs)
    assert any("侵入" in m for m in msgs)


def test_translucent_subtitle_does_not_self_report(tmp_path):
    """回归 2026-08-21 假报：半透明字幕底（灰度 ≈0.12）+ 亮笔画，不得报侵入。

    旧判据「亮列连通段 + 最宽段=字幕框」会把每个汉字当独立亮段（14 字 → 14 段），
    于是字幕自己刷出十几条「侵入」——本集全片 500+ 条假 WARN 的根因。
    """
    out = tmp_path / "frames"
    out.mkdir(exist_ok=True)
    w, h = 1920, 1080
    arr = np.full((h, w), 17, dtype=np.uint8)
    box_x0, box_x1 = (w - 900) // 2, (w + 900) // 2
    arr[h - 120 : h - 54, box_x0:box_x1] = 30  # 半透明底：rgba(6,8,12,.68) 压深色底
    for k in range(14):  # 14 个字，每个 44px 宽、间隔 20px —— 笔画远亮于底
        x = box_x0 + 24 + k * 62
        arr[h - 108 : h - 66, x : x + 44] = 240
    Image.fromarray(arr).save(out / "p7-01.png")
    msgs: list[str] = []
    check_frames(out, ["p7-01"], 1.0, False, msgs)
    assert not any("侵入" in m for m in msgs), msgs


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


def test_tail_row_has_fade_ignores_trailing_prose(tmp_path):
    """渐黑行距文件末尾有散文节时（EP1/EP2 真实形态），豁免仍须命中。"""
    board = tmp_path / "storyboard.md"
    board.write_text(
        "| 6-F2 三条曲线 | p6-13c..13d | … | 三线描画 |\n"
        "| 6-G 原文卡 | p6-14..15 | …；渐黑 | 卡片停留 + 渐黑 |\n"
        "\n## 字幕规范\n\n- 单行字幕。\n\n## 实现映射\n\n每幕一个组件。\n",
        encoding="utf-8",
    )
    assert tail_row_has_fade(board)


def test_tail_row_has_fade_false_without_marker(tmp_path):
    board = tmp_path / "storyboard.md"
    board.write_text("| 6-G 原文卡 | p6-14..15 | … | 卡片停留 |\n", encoding="utf-8")
    assert not tail_row_has_fade(board)
    assert not tail_row_has_fade(tmp_path / "absent.md")  # 缺文件不炸、不豁免
