"""digest 黄金值——「TTS 缓存零失效」的守门人。

钉死 digest_indextts 的「未使用即省略」后缀规则：beams=1 不带 |beams=N、
beams≥2 才带；emoref/emotext 同理。此前靠这条规则保住了已上线三集 596 句的
缓存摘要 100% 不变；未来任何人改摘要公式，这里先红。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from tts import digest_edge, digest_indextts  # noqa: E402


def test_digest_indextts_golden():
    vec = (0.95, 0, 0, 0, 0, 0, 0.02, 0.03)
    # beams=1（省略后缀）——与已上线 passionate 句同构
    d1 = digest_indextts(
        "3ed0d9d60d4b",
        "passionate",
        vec,
        0.7,
        0.97,
        "ZH",
        "indextts",
        "测试句。",
        1,
        None,
        None,
    )
    # beams=3（带 |beams=3）
    d3 = digest_indextts(
        "3ed0d9d60d4b",
        "passionate",
        vec,
        0.7,
        0.97,
        "ZH",
        "indextts",
        "测试句。",
        3,
        None,
        None,
    )
    # emoref / emotext 后缀
    dr = digest_indextts(
        "3ed0d9d60d4b",
        "emoref",
        None,
        1.0,
        1.0,
        "ZH",
        "indextts",
        "测试句。",
        1,
        "aabbccddeeff",
        None,
    )
    dt = digest_indextts(
        "3ed0d9d60d4b",
        "emotext",
        None,
        1.0,
        1.0,
        "ZH",
        "indextts",
        "测试句。",
        1,
        None,
        "轻快爽朗",
    )

    # 黄金值按实现真实序列化拍死：vec 用 repr(x) 逐项、None→"none"、alpha/df 用 !r。
    # 若此处失败且你有意修改摘要公式：须全量评估三集已上线缓存失效，并同步更新 VOICE-CLONING.md §六。
    import hashlib

    def manual(suffix: str) -> str:
        vec_str = ",".join(repr(x) for x in vec)
        raw = f"indextts|indextts|3ed0d9d60d4b|ZH|passionate|{vec_str}|{0.7!r}|{0.97!r}|测试句。{suffix}"
        return hashlib.sha1(raw.encode()).hexdigest()

    assert d1 == manual(""), "beams=1 不得带后缀"
    assert d3 == manual("|beams=3"), "beams=3 须带 |beams=3"
    assert d1 != d3, "束宽必须参与摘要（换束宽=换缓存）"
    assert dr and dr != d1
    assert dt and dt not in (d1, dr)
    # 确定性
    assert d1 == digest_indextts(
        "3ed0d9d60d4b",
        "passionate",
        vec,
        0.7,
        0.97,
        "ZH",
        "indextts",
        "测试句。",
        1,
        None,
        None,
    )

    # 逐字黄金（防 repr 语义漂移，如 0.7 → 0.70）
    assert d1 == "b6ccdeea2d913069c87bb679d67043a602bddfcb", d1
    assert d3 == "e0750477d554fb14bf9753c4363ab27869df6cac", d3


def test_digest_indextts_vec_none_serialization():
    import hashlib

    d = digest_indextts(
        "abc", "emoref", None, 1.0, 1.0, "ZH", "indextts", "x", 2, "ff", None
    )
    raw = "indextts|indextts|abc|ZH|emoref|none|1.0|1.0|x|beams=2|emoref=ff"
    assert d == hashlib.sha1(raw.encode()).hexdigest()


def test_digest_edge_golden():
    import hashlib

    assert digest_edge("v", "r", "t") == hashlib.sha1(b"v|r|t").hexdigest()
