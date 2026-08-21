#!/usr/bin/env python3
"""TTS 长跑进度与热漂移监视器——R2 期间旁路跑，不动合成进程。

## 为什么需要它

IndexTTS 整集合成是 2 小时量级的无人值守长跑，而本机（M4 base）实测同一工作
量在 6 次连续调用内漂 3.4×（成因已定因为**热节流**：换页/分配器/泄漏均排除，
加 75s 冷却后极差比收敛到 1.016–1.047×，见 INDEXTTS-2.5-ADVANCED.md §6.5）。
长跑中途若机器被别的任务压热，剩余句的耗时估算会成倍失真——排期窗口被悄悄
击穿。本工具从**旁路**观测：读逐句 mp3 的 mtime 序列重建墙钟进度，与合成
进程零耦合（不连服务、不碰缓存摘要）。

判据遵循 §6.5 的「量级不用秩相关」原则：单调秩在稳态尾部 15.19/15.31/15.42
会被判成「完美 +1.00 单调上升」的假阳性；只有比值量级（滚动秒/字 vs 基线）
承载可归因信息。

## 口径

- 每句墙钟 = 相邻 mp3 的 mtime 差（首句 = 最早 mtime − 跑前最后一个 mtime 不可
  得，故首句墙钟缺失，不进均值/中位）；
- 秒/字 = 墙钟 ÷ 该句字数（narration.json 的 `text`，即人读面）；
- 基线 1.868 s/字：EP1 v3 B 遍（sunny-steady）187 句实测墙钟折算——同机同档
  的历史口径，非上游论文数字。

用法：uv run --no-project $R/tts_progress.py --project $P [--window 30]
退出码恒 0（监视器不打断长跑；处置决策在人）。
"""

from __future__ import annotations

import argparse
import json
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

#: 同机同档（sunny-steady，EP1 v3 B 遍 187 句）的历史实测折算，监视判据的分母。
SEC_PER_CHAR_BASELINE = 1.868
#: 判据阈值（对基线的倍数）：>1.2× 提示（机器被压热，暂停别的任务或等它跑完）；
#: >1.5× 建议（热节流已坐实，先中止再按 §6.5 协议验证环境）。
PAUSE_RATIO = 1.2
ABORT_RATIO = 1.5


def main() -> None:
    ap = argparse.ArgumentParser(
        description="TTS 长跑旁路监视：进度 / 每句墙钟 / 秒/字漂移 vs 基线"
    )
    ap.add_argument("--project", default=".", help="视频工程根目录（含 video/）")
    ap.add_argument(
        "--window",
        type=int,
        default=30,
        help="滚动窗口句数（取最近 N 句的秒/字中位数，默认 30）",
    )
    args = ap.parse_args()

    root = Path(args.project).resolve()
    audio = root / "video" / "public" / "audio"
    narration = root / "script" / "narration.json"
    if not narration.is_file():
        sys.exit(f"narration.json 不存在: {narration} —— 先运行 build_narration.py")
    items = json.loads(narration.read_text(encoding="utf-8"))
    chars = {i["id"]: len(i["text"]) for i in items}

    done = sorted(
        (p.stat().st_mtime, p.stem)
        for p in audio.glob("*.mp3")
        if p.stem in chars  # 只认当前逐字稿的句 id——历史残留 mp3 不算进度
    )
    if not done:
        print(f">> 进度 0/{len(items)} 句 · {audio} 下无当前稿的 mp3（尚未开始？）")
        print("   监视器只读 mtime，不启动合成；开始后复跑本命令即可。")
        return

    mtimes = [t for t, _ in done]
    span = mtimes[-1] - mtimes[0] if len(mtimes) > 1 else 0.0
    if len(done) == len(items) or span < 1.0:
        # 两种「非在跑」形态：全部句已产出且 mtime 几乎相同（git checkout / cp 整批
        # 落盘，mtime 序列不承载墙钟信息）；或整集本就合成完毕（长跑已结束）。
        # 强行计算只会输出 -0.0s 一类噪声——明确说出判据失效的原因。
        print(
            f">> 进度 {len(done)}/{len(items)} 句 · 全部 mp3 的 mtime 跨度 "
            f"{span:.1f}s（批量落盘或已完成的整集）——mtime 序列无法重建墙钟，"
            "热漂移判据不适用"
        )
        return
    elapsed = span
    # 每句墙钟 = 相邻 mtime 差；首句差值不可得（跑前时刻未知），不进统计
    walls = [
        (done[k + 1][1], mtimes[k + 1] - mtimes[k], chars[done[k + 1][1]])
        for k in range(len(done) - 1)
    ]
    per_s = [w for _, w, _ in walls]
    spc = [w / max(1, c) for _, w, c in walls]
    win = spc[-args.window :] if args.window > 0 else spc
    roll = st.median(win)
    ratio = roll / SEC_PER_CHAR_BASELINE

    print(
        f">> 进度 {len(done)}/{len(items)} 句 · 已跑 {elapsed / 60:.0f} 分钟"
        f"（自首句产出起）"
    )
    print(
        f"   每句墙钟（mtime 差口径）：均值 {st.mean(per_s):.1f}s · "
        f"滚动{len(win)}句中位 {st.median([w for _, w, _ in walls[-args.window :]]):.1f}s"
    )
    print(
        f"   秒/字：滚动{len(win)}句中位 {roll:.3f} vs 基线 {SEC_PER_CHAR_BASELINE}"
        f"（EP1 v3 B 遍同机口径）= {ratio:.2f}×"
    )
    if ratio > ABORT_RATIO:
        print(
            f"   ❌ {ratio:.1f}× > {ABORT_RATIO}×：热节流征象已坐实（§6.5）。建议中止长跑，"
            f"先跑 tts_bench.py --check-only 确认环境，空闲时段再续（逐句缓存可无损续跑）"
        )
    elif ratio > PAUSE_RATIO:
        print(
            f"   ⚠️  {ratio:.1f}× > {PAUSE_RATIO}×：机器疑似被并行任务压热。暂停闲置负载 "
            f"20 分钟再观察；仍 >{ABORT_RATIO}× 则按上一条处置"
        )
    else:
        print("   ✅ OK：节奏与基线同量级（判据用量级不用秩相关，见 §6.5）")
    # 剩余句粗估：滚动秒/字 × 剩余字数（量级参考，非承诺）
    done_ids = {sid for _, sid in done}
    left_ids = [i["id"] for i in items if i["id"] not in done_ids]
    left_chars = sum(chars[i] for i in left_ids)
    if left_chars:
        print(
            f"   剩余 {len(left_ids)} 句 / {left_chars} 字 · 按当前节奏约 "
            f"{left_chars * roll / 60:.0f} 分钟"
        )


if __name__ == "__main__":
    main()
