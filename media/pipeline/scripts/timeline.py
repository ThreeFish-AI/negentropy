"""时间轴计算的 Python 侧实现——与各集 video/src/timing.ts:computeTimeline 同构。

此前 qa_frames.py 顶部手抄了 timing.ts 的 4 个常量做镜像，唯一的守卫是 README 里
一句散文；两处漂移会让所有抽帧时间静默错位。本模块改为直读每集
`video/src/timing.json`（时序常数的单一事实源），与 timing.ts 同一份事实。

⚠️ 与 timing.ts 的对齐契约：compute() 的游标推进逻辑必须逐行同构——
  - 句时长 = max(1, round((durationSec + gap) * fps))，gap 在幕界 = 句间 + 幕间；
  - 总时长 = 游标 + round(tailSec * fps)。
任何一侧改动须同步另一侧，并以 tests/test_timeline.py 的黄金帧号兜底。

用法（被 qa_frames.py / captions.py 复用，也可独立调用对拍）：

    from timeline import compute, load_constants
    c = load_constants(Path("<工程根>"))
    rows = compute(manifest_items, c)   # [{id, fromFrame, durationInFrames, startSec, ...}]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

#: timing.json 必备字段（与 video/src/timing.ts 的消费面一致）
REQUIRED_KEYS = (
    "fps",
    "sentenceGapSec",
    "sceneGapSec",
    "leadInSec",
    "tailSec",
    "sceneCrossFadeSec",
)


def load_constants(project_root: Path) -> dict:
    """读 <工程>/video/src/timing.json；缺失或字段不全时给可操作退出。"""
    path = Path(project_root) / "video" / "src" / "timing.json"
    if not path.is_file():
        sys.exit(
            f"timing.json 不存在: {path}\n"
            "  —— 时序常数单一事实源缺失，请从任一既有集复制 video/src/timing.json"
            "（qa_frames/captions 与 timing.ts 读同一文件，不可再手抄常量）"
        )
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = [k for k in REQUIRED_KEYS if k not in data]
    if missing:
        sys.exit(f"{path} 缺少字段: {', '.join(missing)}")
    return data


def compute(items: list[dict], c: dict) -> list[dict]:
    """与 timing.ts:computeTimeline 同构的时间轴展开。

    items 为 manifest 形态的 [{id, scene, text, durationSec}]；返回逐句行，含
    fromFrame / durationInFrames（全片帧位）与 startSec / spanSec（秒，供抽帧与字幕）。
    spanSec 与 durationInFrames 一样含句间停顿（成片内该句占满的时间窗）。
    """
    fps = c["fps"]
    timed: list[dict] = []
    cursor = round(c["leadInSec"] * fps)
    for i, item in enumerate(items):
        nxt = items[i + 1] if i + 1 < len(items) else None
        gap = (
            c["sentenceGapSec"] + c["sceneGapSec"]
            if nxt and nxt["scene"] != item["scene"]
            else c["sentenceGapSec"]
        )
        duration_in_frames = max(1, round((item["durationSec"] + gap) * fps))
        timed.append(
            {
                **item,
                "fromFrame": cursor,
                "durationInFrames": duration_in_frames,
                "startSec": cursor / fps,
                "spanSec": duration_in_frames / fps,
            }
        )
        cursor += duration_in_frames
    return timed


def total_duration_in_frames(items: list[dict], c: dict) -> int:
    rows = compute(items, c)
    if not rows:
        return round(c["tailSec"] * c["fps"])
    last = rows[-1]
    return last["fromFrame"] + last["durationInFrames"] + round(c["tailSec"] * c["fps"])
