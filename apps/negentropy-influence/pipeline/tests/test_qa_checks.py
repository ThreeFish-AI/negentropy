"""qa_check 判据（PIL 合成图）与 WCAG 对比度计算。"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from qa_frames import (  # noqa: E402
    beat_head_samples,
    check_frames,
    check_theme,
    frame_diff,
    tail_row_has_fade,
    wcag_ratio,
)


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


def declared_action(script: str, flag: str) -> str | None:
    """→ 源码里 `add_argument("<flag>", …)` 声明的 action 字面量（无则 None）。

    parser 建在 `main()` 内、拿不到对象，判据只能落在源码上；用 AST 而非字符串
    匹配，是因为 ruff format 会改换行、正则必漂。找不到该 flag 直接炸——「检测器
    自己失效」必须是硬失败，不能退化成静默放行（此前那版 `hasattr(build_parser)`
    守卫恒为假、断言从不执行，等于没有门）。
    """
    import ast

    src = (Path(__file__).resolve().parents[1] / "scripts" / script).read_text(
        encoding="utf-8"
    )
    for node in ast.walk(ast.parse(src)):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "add_argument"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and node.args[0].value == flag
        ):
            for kw in node.keywords:
                if kw.arg == "action" and isinstance(kw.value, ast.Constant):
                    return kw.value.value
            return None
    raise AssertionError(f"{script} 里找不到 {flag} 的 add_argument——检测器该更新了")


def test_scene_selector_accumulates_multiple_scenes():
    """`--scene` 可重复传，且**不静默丢弃**先传的幕。

    回归：原先是单值 store，`--scene P0 --scene P6` 只查末幕却照样打
    `FAIL 0`——输出与「全幕通过」不可区分（EP2 交付前实际踩过）。
    """
    import argparse

    parser = argparse.ArgumentParser()
    # 与 qa_frames.main 的声明保持一致（此处只测选择器语义，不跑抽帧）
    parser.add_argument("--scene", action="append", metavar="Pn")
    args = parser.parse_args(["--scene", "P0", "--scene", "P6"])
    assert args.scene == ["P0", "P6"], "重复传 --scene 必须累积而非覆盖"

    # 真实声明面也必须是 append（防有人改回 store），两端各查一次：抽帧工具本体，
    # 与 pipeline.py 的转发面（后者若退回单值，多幕会在编排器这一层就被丢掉）
    assert declared_action("qa_frames.py", "--scene") == "append"
    assert declared_action("pipeline.py", "--scene") == "append"


def test_multi_scene_sampling_is_per_scene(tmp_path):
    """多幕抽样按**各幕自身**句数定步长，句少的幕不会被整幕跳过。

    若用合并后的总数算步长，短幕（如 2 句）在长幕（如 30 句）面前会被
    `[::N]` 直接跨过——又一次静默漏检。
    """
    # 模拟 timeline：P0 三句、P6 两句
    tl = {f"p0-{i:02d}": (float(i), 1.0) for i in range(1, 4)}
    tl |= {f"p6-{i:02d}": (float(10 + i), 1.0) for i in range(1, 3)}
    ids = []
    for scene in ("P0", "P6"):
        prefix = scene.lower() + "-"
        scene_ids = [k for k in tl if k.startswith(prefix)]
        ids += scene_ids[:: max(1, len(scene_ids) // 8)]
    assert [i for i in ids if i.startswith("p0-")], "P0 必须有帧被抽到"
    assert [i for i in ids if i.startswith("p6-")], "P6 必须有帧被抽到"
    assert len(ids) == 5


# ── beat 头部采样 + A/B 帧差（纯函数） ────────────────────────────────────


def test_beat_head_samples_covers_every_beat_head():
    """每 beat 首句起点连抽 N 帧，帧号 = start*fps + i（与句中点采样互补的盲区面）。"""

    beats = [
        ("0-A", "p0-01", "p0-02", "p0-01..02"),
        ("0-B", "p0-03", "p0-04", "p0-03..04"),
        ("1-A", "p1-01", "p1-03", "p1-01..03"),
    ]
    tl = {
        "p0-01": (0.6, 3.0),
        "p0-02": (3.6, 3.0),
        "p0-03": (6.6, 3.0),
        "p0-04": (9.6, 3.0),
        "p1-01": (12.6, 4.0),
    }
    got = beat_head_samples(beats, tl, fps=30, n=3)
    names = [n for n, _ in got]
    assert names == [
        "0-A-h0",
        "0-A-h1",
        "0-A-h2",
        "0-B-h0",
        "0-B-h1",
        "0-B-h2",
        "1-A-h0",
        "1-A-h1",
        "1-A-h2",
    ]
    # 第一帧恰在 beat 起点（0.6s），其后按 1/fps 递增
    assert got[0][1] == 0.6
    assert abs(got[1][1] - (0.6 + 1 / 30)) < 1e-9
    assert abs(got[6][1] - 12.6) < 1e-9


def test_beat_head_samples_scene_filter_and_stale_beats():
    beats = [("0-A", "p0-01", "p0-02", ""), ("4-A", "p4-01", "p4-02", "")]
    tl = {"p0-01": (0.6, 3.0), "p4-01": (99.0, 3.0)}
    only4 = beat_head_samples(beats, tl, fps=30, n=1, scene_filter=["P4"])
    assert [n for n, _ in only4] == ["4-A-h0"]
    # 区间首句不在 manifest（分镜陈旧）→ 该 beat 整体跳过，不静默错位
    stale = beat_head_samples([("2-A", "p2-99", "p2-99", "")], tl, fps=30, n=2)
    assert stale == []


def test_frame_diff_quantifies_and_localizes(tmp_path):
    same = tmp_path / "same.png"
    make_png(same, "subtitle")  # make_png 返回 None，路径自持
    d = frame_diff(same, same)
    assert d["frac"] == 0.0 and d["bbox"] is None

    # 右下角一块 40×40 的差异：frac ≈ 1600/总像素，bbox 指向差异区
    img = Image.open(same).convert("RGB")
    arr = np.array(img)
    arr[-40:, -40:] = [255, 255, 255]
    other = tmp_path / "other.png"
    Image.fromarray(arr).save(other)
    d = frame_diff(same, other)
    assert 0 < d["frac"] < 0.05
    x0, y0, x1, y1 = d["bbox"]
    assert x1 - x0 < 45 and y1 - y0 < 45  # bbox 紧贴差异块而非全图
