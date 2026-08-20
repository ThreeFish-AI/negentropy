"""tts_bench 的环境判据 —— 「耗时 A/B 是否可信」的守门人。

夹具是 2026-08-20 在本机（M4 base / 24 GB / MPS fp32）实测的三组真实读数。它们的价值
不只是回归基线，更是**判据设计被现实纠正过三次**的记录：

  1. 最初用「随运行序的秩相关」当门 —— 秩相关**无标度**，稳态尾部 15.19/15.31/15.42
     （极差仅 1.016×）会被判成「完美单调上升 +1.00」。改为量级判据（相对漂移）。
  2. 接着用「弃掉头部、判定尾部」 —— 只能从头裁，遇到末次突然**变快**（15.15 → 13.35，
     风扇起转）就永远裁不掉，把明显合格的环境判成不合格。改为最长连续稳定窗口。
  3. 静态内存门（可用内存 ≥10 GB、命令行扫描其它实例）被实测逐条否决：9.7 GB 可用时
     换页增量仅 31 MB（内存不是瓶颈），而命令行扫描连续两次把调用方的包装 shell 误判
     成实例。故静态指标全部降级为提示，判据只用直接测量量。

结论：漂移的真实成因是**热节流**（换页 ≈ 0、MPS 分配器占用恒定，却随运行序单调爬升且
全部由 cfm 段承担），唯一有效缓解是冷却间隔。
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from tts_bench import (  # noqa: E402
    MAX_CV,
    MAX_REL_DRIFT,
    MAX_SPREAD_RATIO,
    _rel_drift,
    stable_window,
)

#: 无冷却 8 连跑：单调爬升 2.37×，热节流的教科书形态
NO_COOLDOWN = [15.36, 15.51, 16.76, 20.61, 28.42, 36.46, 35.43, 31.10]
#: 75 s 冷却 6 次：前两次带上一轮余热，#3 起进入稳态
COOLDOWN = [24.50, 18.60, 15.19, 15.19, 15.31, 15.42]
#: 验收 6 次：#1–#5 稳定，末次突然变快（13.35）——只裁头部的判据会在此误判
ACCEPT = [15.50, 15.86, 15.34, 15.27, 15.15, 13.35]


def _ok(walls: list[float]) -> bool:
    i, j, sp, cv, dr = stable_window(walls)
    return (
        sp <= MAX_SPREAD_RATIO
        and cv <= MAX_CV
        and abs(dr) <= MAX_REL_DRIFT
        and (j - i + 1) >= 3
    )


def test_no_cooldown_is_rejected():
    """热节流下的单调爬升必须判不合格 —— 否则会把噪声当成参数效应。"""
    assert not _ok(NO_COOLDOWN)


@pytest.mark.parametrize(("walls", "expect"), [(COOLDOWN, (2, 5)), (ACCEPT, (0, 4))])
def test_stable_window_located(walls, expect):
    """冷却节奏下应判合格，且窗口位置符合物理解释（余热在头 / 异常在尾）。"""
    i, j, *_ = stable_window(walls)
    assert (i, j) == expect
    assert _ok(walls)


def test_window_tolerates_tail_outlier():
    """回归第 2 次纠正：末次变快不得导致误判（只裁头部的判据会在此失败）。"""
    i, j, sp, _cv, _dr = stable_window(ACCEPT)
    assert j == len(ACCEPT) - 2, "末次异常点应被排除在窗口外"
    assert sp <= MAX_SPREAD_RATIO


def test_window_prefers_longest():
    """同为合格窗口时取最长 —— 点数越多，后续 A/B 的统计功效越高。"""
    i, j, *_ = stable_window([15.2, 15.3, 15.25, 15.28, 15.22, 40.0])
    assert (i, j) == (0, 4)


def test_rel_drift_is_scale_aware():
    """回归第 1 次纠正：相对漂移必须有标度，微小单调上升不能被判成显著漂移。"""
    # 稳态尾部：单调上升但幅度仅 1.5%，秩相关会给 +1.00，量级判据须放行
    assert abs(_rel_drift([15.19, 15.19, 15.31, 15.42])) <= MAX_REL_DRIFT
    # 真实漂移：翻倍，必须拦下
    assert _rel_drift([15.0, 16.0, 28.0, 36.0]) > MAX_REL_DRIFT


def test_no_qualifying_window_returns_steadiest_triple():
    """无合格窗口时回报最稳的 3 连窗口，让人看到「差多少」而不是空手。"""
    i, j, sp, cv, dr = stable_window(NO_COOLDOWN)
    assert j - i == 2, "回退分支应给出 3 点窗口"
    assert not (sp <= MAX_SPREAD_RATIO and cv <= MAX_CV and abs(dr) <= MAX_REL_DRIFT), (
        "回退窗口本身不应满足判据"
    )
