"""音频版本库（tts.py 内容寻址持久库）的纯函数契约。

背景：集内 audio/ 是 gitignored 本地产物，换 worktree 即丢——版本库按
（集 slug, 句 id, digest）三元组持久化合成成果，使「改稿只重配变更句」
跨工作区成立。此处钉死四条不变量：回收等价缓存命中、digest 失配必 miss、
历史版本并存不覆盖、禁用时全程直通。
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import tts  # noqa: E402
from tts import (
    digest_indextts,
    store_deposit,
    store_entry,
    store_has,
    store_restore,
    store_root,
)


def _mk(root: Path, name: str, size: int = 64) -> Path:
    """占位音频：store 只搬运字节不解析，内容无语义。"""
    p = root / name
    p.write_bytes(bytes(range(size % 251)))
    return p


def test_roundtrip_deposit_then_restore(tmp_path):
    audio, store = tmp_path / "audio", tmp_path / "store"
    audio.mkdir()
    src = _mk(tmp_path, "p0-01.mp3")
    store_deposit(src, "p0-01", "d" * 40, store, "ep-video")
    assert store_has(store, "ep-video", "p0-01", "d" * 40)
    # 集内目录为空（换 worktree 后缓存丢失的形态）→ 回收命中并落位 mp3 + .sha
    assert store_restore("p0-01", "d" * 40, audio, store, "ep-video")
    assert (audio / "p0-01.mp3").read_bytes() == src.read_bytes()
    assert (audio / "p0-01.sha").read_text() == "d" * 40


def test_digest_mismatch_is_miss(tmp_path):
    audio, store = tmp_path / "audio", tmp_path / "store"
    audio.mkdir()
    src = _mk(tmp_path, "p0-02.mp3")
    store_deposit(src, "p0-02", "a" * 40, store, "ep-video")
    assert not store_has(store, "ep-video", "p0-02", "b" * 40)
    assert not store_restore("p0-02", "b" * 40, audio, store, "ep-video")
    assert not (audio / "p0-02.mp3").exists()


def test_history_versions_coexist(tmp_path):
    store = tmp_path / "store"
    v1, v2 = _mk(tmp_path, "v1.mp3", 10), _mk(tmp_path, "v2.mp3", 200)
    store_deposit(v1, "p1-07", "1" * 40, store, "ep")
    store_deposit(v2, "p1-07", "2" * 40, store, "ep")
    # 不同 digest 不同文件名 ⇒ 历史版本并存，改稿不丢旧版（可回退）
    assert store_entry(store, "ep", "p1-07", "1" * 40).is_file()
    assert store_entry(store, "ep", "p1-07", "2" * 40).is_file()


def test_same_digest_deposit_refreshes(tmp_path):
    store = tmp_path / "store"
    old, new = _mk(tmp_path, "old.mp3", 10), _mk(tmp_path, "new.mp3", 230)
    d = "e" * 40
    store_deposit(old, "p3-01", d, store, "ep")
    store_deposit(
        new, "p3-01", d, store, "ep"
    )  # 同 digest 重跑（--force）→ 刷新为新音频
    assert store_entry(store, "ep", "p3-01", d).read_bytes() == new.read_bytes()


def test_disabled_store_is_transparent(tmp_path):
    assert store_root(disabled=True) is None
    src = _mk(tmp_path, "x.mp3")
    store_deposit(src, "x", "c" * 40, None, "ep")  # no-op 不炸、不建目录
    assert not (tmp_path / "store").exists()
    assert not store_restore("x", "c" * 40, tmp_path, None, "ep")


def test_env_override(monkeypatch, tmp_path):
    monkeypatch.setenv("NE_TTS_STORE", str(tmp_path / "custom"))
    assert store_root(disabled=False) == tmp_path / "custom"


def test_empty_env_disables_store(monkeypatch):
    monkeypatch.setenv("NE_TTS_STORE", "")
    assert store_root(disabled=False) is None


def test_store_read_error_degrades_to_miss(monkeypatch, tmp_path):
    store = tmp_path / "store"
    src = _mk(tmp_path, "p2-01.mp3")
    digest = "f" * 40
    store_deposit(src, "p2-01", digest, store, "ep")
    original = Path.read_text

    def broken_read(path, *args, **kwargs):
        if path.suffix == ".sha" and store in path.parents:
            raise OSError("store unavailable")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", broken_read)
    assert not store_has(store, "ep", "p2-01", digest)


def test_store_restore_error_degrades_to_miss(monkeypatch, tmp_path):
    audio, store = tmp_path / "audio", tmp_path / "store"
    audio.mkdir()
    src = _mk(tmp_path, "p2-02.mp3")
    digest = "a" * 40
    store_deposit(src, "p2-02", digest, store, "ep")
    monkeypatch.setattr(
        tts.shutil,
        "copyfile",
        lambda _src, _dst: (_ for _ in ()).throw(OSError("read failed")),
    )
    assert not store_restore("p2-02", digest, audio, store, "ep")


def test_deposit_failure_does_not_replace_published_entry(monkeypatch, tmp_path):
    store = tmp_path / "store"
    old = _mk(tmp_path, "old-atomic.mp3", 20)
    new = _mk(tmp_path, "new-atomic.mp3", 200)
    digest = "b" * 40
    store_deposit(old, "p3-02", digest, store, "ep")
    dst = store_entry(store, "ep", "p3-02", digest)
    before = dst.read_bytes()

    def broken_copy(_src, target):
        Path(target).write_bytes(b"partial")
        raise OSError("disk full")

    monkeypatch.setattr(tts.shutil, "copyfile", broken_copy)
    store_deposit(new, "p3-02", digest, store, "ep")

    assert dst.read_bytes() == before
    assert dst.with_suffix(".sha").read_text() == digest


def test_deposit_publishes_with_same_directory_replace(monkeypatch, tmp_path):
    store = tmp_path / "store"
    src = _mk(tmp_path, "atomic.mp3", 80)
    real_replace = tts.os.replace
    replacements: list[tuple[Path, Path]] = []

    def record_replace(source, target):
        source, target = Path(source), Path(target)
        replacements.append((source, target))
        assert source.parent == target.parent
        real_replace(source, target)

    monkeypatch.setattr(tts.os, "replace", record_replace)
    store_deposit(src, "p3-03", "c" * 40, store, "ep")

    assert len(replacements) == 2


def test_local_cache_hit_backfills_empty_store(monkeypatch, tmp_path):
    audio, store = tmp_path / "audio", tmp_path / "store"
    audio.mkdir()
    item = {"id": "p4-01", "scene": "P4", "text": "本地缓存。"}
    digest = digest_indextts(
        "r" * 12,
        "neutral",
        None,
        1.0,
        1.0,
        "ZH",
        "indextts",
        item["text"],
    )
    _mk(audio, "p4-01.mp3")
    (audio / "p4-01.sha").write_text(digest, encoding="utf-8")
    monkeypatch.setattr(tts, "mp3_duration", lambda _path: 1.25)

    def unexpected_synthesis(*_args, **_kwargs):
        raise AssertionError("本地缓存命中时不应调用服务端")

    monkeypatch.setattr(tts, "http_synthesize", unexpected_synthesis)

    result = asyncio.run(
        tts.synth_indextts(
            asyncio.Semaphore(1),
            item,
            False,
            "",
            "r" * 12,
            "neutral",
            None,
            1.0,
            1.0,
            "ZH",
            "indextts",
            "http://unused",
            audio,
            store=store,
            slug="ep",
        )
    )

    assert result["durationSec"] == 1.25
    assert store_has(store, "ep", "p4-01", digest)
