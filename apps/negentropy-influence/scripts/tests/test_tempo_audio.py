"""tempo_audio.py 单测：假 stretch/duration 注入覆盖逻辑，真 ffmpeg 用例无二进制时 skip。

uv run --no-project --with pytest --with mutagen pytest apps/negentropy-influence/scripts/tests -q
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import tempo_audio as ta

DIGEST = "a" * 64


def fake_duration(p: Path) -> float:
    """假时长：文件内容形如 'dur=3.0'。"""
    return float(p.read_text().split("=")[1])


def fake_stretch(src: Path, dst: Path, rate: float, ffmpeg: list[str]) -> None:
    dst.write_text(f"dur={fake_duration(src) / rate}")


def make_project(tmp_path: Path, rate: float | None = 1.25, with_raw: bool = True):
    project = tmp_path / "chapters-xx-demo"
    src = project / "video" / "src"
    audio = project / "video" / "public" / "audio"
    store = tmp_path / "store"
    src.mkdir(parents=True)
    audio.mkdir(parents=True)
    timing = {"fps": 30} | ({} if rate is None else {"narrationTempo": rate})
    (src / "timing.json").write_text(json.dumps(timing))
    items = [
        {"id": "p0-01", "scene": "P0", "durationSec": 5.0},
        {"id": "p0-02", "scene": "P0", "durationSec": 2.5},
    ]
    (audio / "manifest.json").write_text(json.dumps(items))
    for it, dur in zip(items, (5.0, 2.5)):
        sid = it["id"]
        (audio / f"{sid}.mp3").write_text(f"dur={dur}")
        (audio / f"{sid}.sha").write_text(DIGEST)
        if with_raw:
            raw = store / project.name / f"{sid}.{DIGEST[:12]}.mp3"
            raw.parent.mkdir(parents=True, exist_ok=True)
            raw.write_text(f"dur={dur}")
            raw.with_suffix(".sha").write_text(DIGEST)
    return project, audio, store


def run_apply(project: Path, store: Path, rate: float = 1.25) -> dict:
    return ta.apply_tempo(
        project,
        rate,
        store,
        ["ffmpeg"],
        stretch_fn=fake_stretch,
        duration_fn=fake_duration,
    )


# ── read_rate ──────────────────────────────────────────────────────────────


def test_read_rate_default_is_identity(tmp_path):
    project, _, _ = make_project(tmp_path, rate=None)
    assert ta.read_rate(project) == 1.0


@pytest.mark.parametrize("bad", [0.1, 3.0, True, "1.25"])
def test_read_rate_rejects_invalid(tmp_path, bad):
    project, _, _ = make_project(tmp_path, rate=bad)
    with pytest.raises(ta.TempoError):
        ta.read_rate(project)


# ── 输入校验 ───────────────────────────────────────────────────────────────


def test_manifest_rejects_unsafe_id(tmp_path):
    _, audio, _ = make_project(tmp_path)
    (audio / "manifest.json").write_text(
        json.dumps([{"id": "../evil", "durationSec": 1}])
    )
    with pytest.raises(ta.TempoError):
        ta.load_manifest(audio)


def test_safe_audio_path_blocks_traversal(tmp_path):
    _, audio, _ = make_project(tmp_path)
    with pytest.raises(ta.TempoError):
        ta._safe_audio_path(audio, "../x.mp3")


# ── apply_tempo ────────────────────────────────────────────────────────────


def test_apply_stretches_from_raw_and_rewrites_manifest(tmp_path):
    project, audio, store = make_project(tmp_path)
    stats = run_apply(project, store)
    assert (stats["stretched"], stats["skipped"]) == (2, 0)
    assert fake_duration(audio / "p0-01.mp3") == pytest.approx(4.0)
    assert (audio / "p0-01.tempo").read_text() == f"1.25:{DIGEST[:12]}"
    manifest = json.loads((audio / "manifest.json").read_text())
    assert [m["durationSec"] for m in manifest] == [4.0, 2.0]
    assert manifest[0]["scene"] == "P0"  # 其余字段保留
    assert (audio / "p0-01.sha").read_text() == DIGEST  # .sha 不动
    assert not list(audio.glob(".*.tmp"))  # 无临时文件残留


def test_apply_is_idempotent(tmp_path):
    project, audio, store = make_project(tmp_path)
    run_apply(project, store)
    again = run_apply(project, store)
    assert (again["stretched"], again["skipped"]) == (0, 2)
    assert fake_duration(audio / "p0-01.mp3") == pytest.approx(4.0)  # 未二次加速


def test_rate_change_recomputes_from_raw_not_from_current(tmp_path):
    project, audio, store = make_project(tmp_path)
    run_apply(project, store, 1.25)
    run_apply(project, store, 1.0)
    assert fake_duration(audio / "p0-01.mp3") == pytest.approx(5.0)
    run_apply(project, store, 2.0)
    assert fake_duration(audio / "p0-01.mp3") == pytest.approx(2.5)


def test_missing_raw_refuses_and_leaves_files_untouched(tmp_path):
    project, audio, store = make_project(tmp_path, with_raw=False)
    with pytest.raises(ta.TempoError, match="raw"):
        run_apply(project, store)
    assert fake_duration(audio / "p0-01.mp3") == 5.0
    assert not (audio / "p0-01.tempo").exists()


def test_raw_with_mismatched_sha_is_rejected(tmp_path):
    project, _, store = make_project(tmp_path)
    (store / project.name / f"p0-01.{DIGEST[:12]}.sha").write_text("b" * 64)
    with pytest.raises(ta.TempoError):
        run_apply(project, store)


# ── check_tempo ────────────────────────────────────────────────────────────


def test_check_fails_before_and_passes_after(tmp_path):
    project, _, store = make_project(tmp_path)
    assert len(ta.check_tempo(project, 1.25, store, duration_fn=fake_duration)) == 2
    run_apply(project, store)
    assert ta.check_tempo(project, 1.25, store, duration_fn=fake_duration) == []


def test_check_detects_stale_manifest_duration(tmp_path):
    project, audio, store = make_project(tmp_path)
    run_apply(project, store)
    manifest = json.loads((audio / "manifest.json").read_text())
    manifest[0]["durationSec"] = 5.0  # 模拟 tts 复跑后 manifest 回到 1.0×
    (audio / "manifest.json").write_text(json.dumps(manifest))
    problems = ta.check_tempo(project, 1.25, store, duration_fn=fake_duration)
    assert len(problems) == 1 and "manifest" in problems[0]


def test_check_detects_rate_change(tmp_path):
    project, _, store = make_project(tmp_path)
    run_apply(project, store, 1.25)
    assert len(ta.check_tempo(project, 1.5, store, duration_fn=fake_duration)) == 2


# ── 真 ffmpeg（Remotion 自带；缺失则 skip）──────────────────────────────────

REMOTION = next(
    iter(
        sorted(
            (Path(__file__).resolve().parents[2] / "episodes").glob(
                "*/*/video/node_modules/.bin/remotion"
            )
        )
    ),
    None,
)


@pytest.mark.skipif(
    REMOTION is None, reason="无 Remotion 二进制（先在任一集 video/ 下 pnpm install）"
)
def test_real_ffmpeg_stretch_speeds_up_without_pitch_shift(tmp_path):
    ffmpeg = [str(REMOTION), "ffmpeg"]
    src = tmp_path / "in.mp3"
    subprocess.run(
        [*ffmpeg, "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=4:sample_rate=22050",
         "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", str(src)],
        check=True,
    )  # fmt: skip
    dst = tmp_path / "out.mp3"
    ta.stretch(src, dst, 1.25, ffmpeg)
    assert ta.mp3_duration(dst) == pytest.approx(ta.mp3_duration(src) / 1.25, abs=0.15)
