"""音频版本库（tts.py 内容寻址持久库）的纯函数契约。

背景：集内 audio/ 是 gitignored 本地产物，换 worktree 即丢——版本库按
（集 slug, 句 id, digest）三元组持久化合成成果，使「改稿只重配变更句」
跨工作区成立。此处钉死四条不变量：回收等价缓存命中、digest 失配必 miss、
历史版本并存不覆盖、禁用时全程直通。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from tts import (
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
