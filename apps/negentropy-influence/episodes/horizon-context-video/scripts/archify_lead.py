"""测定每段 archify 章节 webm 的「视频钟零点」并回写 sidecar 的 lead_sec。

动机：录制器在播放前插一帧全屏白闪（场记板）。webm 的前段还含页面加载与
入场落定，**不是**故事起点；用 Python 墙钟去推视频钟会带 ±0.3s 误差（≈9 帧）。
本脚本直接在像素上找白闪的**末帧**，其后一帧即故事第一拍 —— 把估算换成测量。

remotion 内置 ffmpeg 编译时 `--disable-filters`（signalstats/movie 均不可用），
故走「抽帧 + PIL 测亮度」而非 lavfi 滤镜链。

用法（工程根）：
  uv run --no-project --with pillow python scripts/archify_lead.py [--window 6.0]
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ARCHIFY = ROOT / "video" / "public" / "archify"
FFMPEG = ROOT / "video" / "node_modules" / ".bin" / "remotion"
WHITE = 200.0  # 白闪判据：32x18 灰度均值（页面底色 #0E1116 ≈ 14）


def probe_lead(webm: Path, window: float, fps: int = 25) -> float | None:
    """返回白闪末帧之后的时间戳（秒）；找不到白闪返回 None。"""
    with tempfile.TemporaryDirectory() as td:
        out = Path(td)
        r = subprocess.run(
            [
                str(FFMPEG),
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(webm.resolve()),
                "-t",
                str(window),
                "-vf",
                "scale=32:18",
                "-f",
                "image2",
                str(out / "f%04d.png"),
            ],
            capture_output=True,
            text=True,
            timeout=180,
            cwd=str(ROOT / "video"),
            check=False,
        )
        frames = sorted(out.glob("f*.png"))
        if not frames:
            print(f"    ⚠️ 抽帧失败：{r.stderr[:160]}")
            return None
        last_white = -1
        for i, f in enumerate(frames):
            px = list(Image.open(f).convert("L").getdata())
            if sum(px) / len(px) >= WHITE:
                last_white = i
        if last_white < 0:
            return None
        return round((last_white + 1) / fps, 3)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--window", type=float, default=6.0, help="只在片头这么多秒内找白闪"
    )
    a = ap.parse_args()
    if not FFMPEG.is_file():
        raise SystemExit("缺 video/node_modules —— 先 pnpm install --ignore-workspace")

    total = fixed = missing = 0
    for sc in sorted(ARCHIFY.glob("*.json")):
        d = json.loads(sc.read_text(encoding="utf-8"))
        if not isinstance(d, dict) or not d.get("chapters"):
            continue
        print(f"{sc.stem}")
        for ch in d["chapters"]:
            total += 1
            webm = ARCHIFY / ch["file"]
            if not webm.is_file():
                print(f"  {ch['id']:<22} ✗ 缺 webm")
                missing += 1
                continue
            lead = probe_lead(webm, a.window)
            if lead is None:
                print(
                    f"  {ch['id']:<22} ⚠️ 未找到场记板白闪（保留 lead_sec={ch['lead_sec']}）"
                )
                missing += 1
                continue
            ch["lead_sec"] = lead
            fixed += 1
            print(f"  {ch['id']:<22} lead_sec = {lead:.3f}s")
        d["clapper_found"] = missing == 0
        d["lead_sec"] = d["chapters"][0]["lead_sec"]
        sc.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        f"\n>> 场记板测定：{fixed}/{total} 章已回写真实 lead_sec"
        f"{f'（{missing} 章未找到，沿用原值）' if missing else ''}"
    )


if __name__ == "__main__":
    main()
