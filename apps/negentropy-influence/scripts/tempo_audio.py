#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["mutagen"]
# ///
"""配音整体提速（atempo 后处理）：把 tts 产出的逐句 mp3 按 timing.json 的 narrationTempo 加速。

流水线位置：`pipeline.py tts` 之后、`build/check/render` 之前。

    uv run --no-project apps/negentropy-influence/scripts/tempo_audio.py --project <集目录>
    uv run --no-project apps/negentropy-influence/scripts/tempo_audio.py --project <集目录> --check

设计要点：

* 速率 SSOT = `<集>/video/src/timing.json` 的 `narrationTempo`（仅本脚本读取；timing.ts 与
  skill 的 timeline.py 按名取键，多余键无副作用）。缺省或 1.0 = 不加速。
* 源恒为 tts-store 里的 raw take（`<store>/<slug>/<id>.<digest12>.mp3`），不读 public/audio
  当前内容：改速率可重算、重复运行幂等、raw 缺失则拒绝覆盖（保证随时可恢复 1.0×）。
* `<id>.sha` 不动，`tts` 复跑仍判本地命中并保留加速结果；但新 worktree / `--force` 会把
  1.0× 的 raw 恢复回来，须在 `tts` 后重跑本脚本（`--check` 可作渲染前门）。
* 回写 manifest.json 的 durationSec（mutagen 实测），TS 与 Python 两侧 timeline、captions、
  qa 自动一致；其余字段与排版同 tts.py（indent=1）。
* ffmpeg 取 Remotion 自带二进制（`video/node_modules/.bin/remotion ffmpeg`，含 atempo/libmp3lame）。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path

from mutagen.mp3 import MP3

DEFAULT_STORE = "~/Library/Application Support/vibe-video/tts-store"
ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
#: MPEG-2 Layer III（22.05kHz）合法码率档，源 take 的均值码率向上取最近档
STD_KBPS = (8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160)
RATE_RANGE = (0.5, 2.0)  # atempo 单级滤镜的合法域
DUR_TOL = 0.002  # manifest 与实测时长容差（秒；manifest 取 3 位小数）
RAW_TOL = 0.1  # 实测 ≈ raw/rate 的容差（秒；编码器首尾填充）


class TempoError(Exception):
    """可操作的失败：消息直接给用户看。"""


def read_rate(project: Path) -> float:
    path = project / "video" / "src" / "timing.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise TempoError(f"读不到 {path}：{e}") from e
    rate = data.get("narrationTempo", 1.0)
    if isinstance(rate, bool) or not isinstance(rate, (int, float)):
        raise TempoError(f"narrationTempo 应为数字，实际 {rate!r}")
    lo, hi = RATE_RANGE
    if not lo <= rate <= hi:
        raise TempoError(f"narrationTempo 应落在 [{lo}, {hi}]，实际 {rate}")
    return float(rate)


def store_root() -> Path:
    env = os.environ.get("VIBE_VIDEO_TTS_STORE")
    if env == "":
        raise TempoError(
            "VIBE_VIDEO_TTS_STORE 置空：无 tts-store 即无 raw 源，拒绝加速"
        )
    return Path(env or DEFAULT_STORE).expanduser()


def find_ffmpeg(project: Path, override: str | None) -> list[str]:
    if override:
        return [override]
    remotion = project / "video" / "node_modules" / ".bin" / "remotion"
    if not remotion.is_file():
        raise TempoError(
            f"缺 {remotion}：先在 {project / 'video'} 下 `pnpm install`，或用 --ffmpeg 指路径"
        )
    return [str(remotion), "ffmpeg"]


def mp3_duration(path: Path) -> float:
    return float(MP3(str(path)).info.length)


def pick_kbps(path: Path) -> int:
    bps = MP3(str(path)).info.bitrate
    kbps = bps / 1000
    return next((k for k in STD_KBPS if k >= kbps - 0.5), STD_KBPS[-1])


def stretch(src: Path, dst: Path, rate: float, ffmpeg: list[str]) -> None:
    """src → dst：atempo=rate（保音高）；rate=1.0 直拷。dst 由调用方保证是临时文件。"""
    if abs(rate - 1.0) < 1e-9:
        dst.write_bytes(src.read_bytes())
        return
    cmd = [
        *ffmpeg, "-y", "-v", "error", "-i", str(src),
        "-filter:a", f"atempo={rate:g}",
        "-c:a", "libmp3lame", "-b:a", f"{pick_kbps(src)}k", "-f", "mp3", str(dst),
    ]  # fmt: skip
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0 or not dst.is_file() or dst.stat().st_size == 0:
        raise TempoError(f"ffmpeg 失败（{src.name}）：{proc.stderr.strip()[-300:]}")


def marker_text(rate: float, digest: str) -> str:
    return f"{rate:g}:{digest[:12]}"


def _safe_audio_path(audio_dir: Path, name: str) -> Path:
    p = (audio_dir / name).resolve()
    if p.parent != audio_dir.resolve():
        raise TempoError(f"路径越界：{name}")
    return p


def _raw_take(store: Path, slug: str, sid: str, digest: str) -> Path:
    """同 vibe-tts store_has 口径：mp3 非空且 .sha 邻档存全量 digest。"""
    mp3 = store / slug / f"{sid}.{digest[:12]}.mp3"
    sha = mp3.with_suffix(".sha")
    try:
        ok = (
            mp3.is_file()
            and mp3.stat().st_size > 0
            and sha.is_file()
            and sha.read_text(encoding="utf-8") == digest
        )
    except (OSError, UnicodeError):
        ok = False
    if not ok:
        raise TempoError(
            f"tts-store 缺 raw take（{mp3}）：拒绝覆盖，先 `tts` 恢复或重配"
        )
    return mp3


def load_manifest(audio_dir: Path) -> list[dict]:
    path = audio_dir / "manifest.json"
    try:
        items = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise TempoError(f"读不到 {path}（先跑 tts）：{e}") from e
    if not isinstance(items, list) or not all(
        isinstance(i, dict) and "id" in i for i in items
    ):
        raise TempoError(f"{path} 形态异常：应为含 id 的对象数组")
    for i in items:
        if not isinstance(i["id"], str) or not ID_RE.fullmatch(i["id"]):
            raise TempoError(f"非法句 id：{i['id']!r}")
    return items


def _digest_of(audio_dir: Path, sid: str) -> str:
    sha = _safe_audio_path(audio_dir, f"{sid}.sha")
    try:
        return sha.read_text(encoding="utf-8").strip()
    except OSError as e:
        raise TempoError(f"缺 {sha.name}（该句未经 tts 落盘）：{e}") from e


def apply_tempo(
    project: Path,
    rate: float,
    store: Path,
    ffmpeg: list[str],
    *,
    stretch_fn: Callable[[Path, Path, float, list[str]], None] = stretch,
    duration_fn: Callable[[Path], float] = mp3_duration,
) -> dict:
    """逐句从 raw 重算加速并回写 manifest；返回统计。幂等：标记匹配且文件在则跳过。"""
    audio_dir = project / "video" / "public" / "audio"
    items = load_manifest(audio_dir)
    slug = project.name
    plan = []
    for it in items:  # 先全量校验 raw，任何一句缺失即整体拒绝（不留半成品）
        sid = it["id"]
        digest = _digest_of(audio_dir, sid)
        plan.append(
            (
                it,
                _safe_audio_path(audio_dir, f"{sid}.mp3"),
                digest,
                _raw_take(store, slug, sid, digest),
            )
        )

    done = skipped = 0
    raw_total = new_total = 0.0
    for it, mp3, digest, raw in plan:
        sid = it["id"]
        mark = _safe_audio_path(audio_dir, f"{sid}.tempo")
        want = marker_text(rate, digest)
        if (
            mp3.is_file()
            and mark.is_file()
            and mark.read_text(encoding="utf-8") == want
        ):
            skipped += 1
        else:
            fd, tmp_name = tempfile.mkstemp(
                dir=audio_dir, prefix=f".{sid}.", suffix=".tmp"
            )
            os.close(fd)
            tmp = Path(tmp_name)
            try:
                stretch_fn(raw, tmp, rate, ffmpeg)
                os.replace(tmp, mp3)
            finally:
                tmp.unlink(missing_ok=True)
            mark.write_text(want, encoding="utf-8")
            done += 1
        it["durationSec"] = round(duration_fn(mp3), 3)
        raw_total += duration_fn(raw)
        new_total += it["durationSec"]

    (audio_dir / "manifest.json").write_text(
        json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    return {
        "sentences": len(items),
        "stretched": done,
        "skipped": skipped,
        "raw_sec": raw_total,
        "new_sec": new_total,
    }


def check_tempo(
    project: Path,
    rate: float,
    store: Path,
    *,
    duration_fn: Callable[[Path], float] = mp3_duration,
) -> list[str]:
    """只读核验：标记齐全、manifest 时长=实测、实测≈raw/rate。返回问题清单（空=通过）。"""
    audio_dir = project / "video" / "public" / "audio"
    items = load_manifest(audio_dir)
    slug = project.name
    problems: list[str] = []
    for it in items:
        sid = it["id"]
        digest = _digest_of(audio_dir, sid)
        mp3 = _safe_audio_path(audio_dir, f"{sid}.mp3")
        mark = _safe_audio_path(audio_dir, f"{sid}.tempo")
        want = marker_text(rate, digest)
        got = mark.read_text(encoding="utf-8") if mark.is_file() else None
        if got != want:
            problems.append(
                f"{sid}: 标记 {got!r} ≠ {want!r}（未加速或速率已变，重跑本脚本）"
            )
            continue
        actual = duration_fn(mp3)
        if abs(it.get("durationSec", -1) - actual) > DUR_TOL:
            problems.append(
                f"{sid}: manifest {it.get('durationSec')} ≠ 实测 {actual:.3f}"
            )
        expect = duration_fn(_raw_take(store, slug, sid, digest)) / rate
        if abs(actual - expect) > RAW_TOL:
            problems.append(f"{sid}: 实测 {actual:.3f} 偏离 raw/{rate:g}={expect:.3f}")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--project", required=True, help="集目录（含 video/ 与 pipeline.toml）"
    )
    ap.add_argument(
        "--check", action="store_true", help="只读核验，不改任何文件；有问题 exit 1"
    )
    ap.add_argument(
        "--ffmpeg", help="覆盖 ffmpeg 可执行路径（缺省用集内 Remotion 自带）"
    )
    args = ap.parse_args(argv)
    try:
        project = Path(args.project).resolve()
        if not (project / "video" / "src" / "timing.json").is_file():
            raise TempoError(f"{project} 不是集目录（缺 video/src/timing.json）")
        rate = read_rate(project)
        store = store_root()
        if args.check:
            problems = check_tempo(project, rate, store)
            for p in problems:
                print(f"FAIL {p}", file=sys.stderr)
            print(
                f"{'FAIL' if problems else 'OK'}：narrationTempo={rate:g}，{len(problems)} 个问题"
            )
            return 1 if problems else 0
        stats = apply_tempo(project, rate, store, find_ffmpeg(project, args.ffmpeg))
    except TempoError as e:
        print(f"ERROR {e}", file=sys.stderr)
        return 1
    print(
        f"narrationTempo={rate:g}：{stats['sentences']} 句（加速 {stats['stretched']}、跳过 {stats['skipped']}），"
        f"语音 {stats['raw_sec']:.1f}s → {stats['new_sec']:.1f}s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
