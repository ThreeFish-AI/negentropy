"""source_ledger 的取证判据：repo 类硬校验 vs site 类只看正文（全程无网络）。"""

from __future__ import annotations

import sys
from argparse import Namespace
from pathlib import Path

import tomllib

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import source_ledger as sl

SHA = "f9e8b280f715f9ba107d4517fd39bc5f8ddda618"


def fake_http(monkeypatch, payload: bytes):
    monkeypatch.setattr(sl, "http_get", lambda url: payload)


def fetch(project: Path, name: str, kind: str, url: str, pinned: str | None = None):
    return sl.cmd_fetch(
        project,
        Namespace(
            name=name,
            url=url,
            kind=kind,
            pinned_ref=pinned,
            via="test",
            accessed="2026-08-21",
        ),
    )


# ---------------------------------------------------------------- 归一与指纹


def test_normalize_strips_tags_and_scripts():
    raw = b"<html><script>var x=1</script><p>Hello&nbsp;&amp; bye</p></html>"
    assert "var x=1" not in sl.normalize_text(raw)
    assert "Hello" in sl.normalize_text(raw) and "&" in sl.normalize_text(raw)


def test_normalize_passes_through_plain_text():
    """非 HTML（.md/.py）只归一空白，不应被标签剥离逻辑破坏。"""
    assert sl.normalize_text(b"def f():\n    return 1\n") == "def f(): return 1"


def test_text_digest_ignores_markup_churn():
    """站点判据的核心性质：构建产物变了但正文没变 → text 指纹必须相同。"""
    a = b'<div class="a1b2c3"><p>\xe6\xad\xa3\xe6\x96\x87</p></div>'
    b = b'<div class="z9y8x7" data-v="7"><p>\xe6\xad\xa3\xe6\x96\x87</p></div>'
    assert sl.digests(a)[0] != sl.digests(b)[0]  # raw 变
    assert sl.digests(a)[1] == sl.digests(b)[1]  # text 未变


def test_toml_escape_roundtrip(tmp_path, monkeypatch):
    fake_http(monkeypatch, b"x")
    p = tmp_path / "proj"
    assert fetch(p, "q", "site", 'https://e.com/a"b\\c') == 0
    data = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    assert data["q"]["url"] == 'https://e.com/a"b\\c'


# ---------------------------------------------------------------- repo 判据


def test_repo_requires_pinned_ref_in_url(tmp_path, monkeypatch):
    fake_http(monkeypatch, b"code")
    p = tmp_path / "proj"
    rc = fetch(p, "bad", "repo", "https://raw/o/r/main/f.py", pinned=SHA)
    assert rc == 1
    assert not sl.ledger_path(p).exists()  # 失败不得落盘


def test_repo_raw_drift_fails(tmp_path, monkeypatch):
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"v1")
    assert fetch(p, "s01-code", "repo", f"https://raw/o/r/{SHA}/f.py", pinned=SHA) == 0
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    fake_http(monkeypatch, b"v2")  # 固定引用的内容却变了
    assert sl.cmd_verify(entries, Namespace(name=None)) == 1


def test_repo_unchanged_passes(tmp_path, monkeypatch):
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"v1")
    assert fetch(p, "s01-code", "repo", f"https://raw/o/r/{SHA}/f.py", pinned=SHA) == 0
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    assert sl.cmd_verify(entries, Namespace(name=None)) == 0


# ---------------------------------------------------------------- site 判据


def test_site_markup_drift_is_not_a_failure(tmp_path, monkeypatch, capsys):
    p = tmp_path / "proj"
    fake_http(monkeypatch, b'<p class="a">\xe6\xad\xa3\xe6\x96\x87</p>')
    assert fetch(p, "s01-site", "site", "https://x/zh/s01/") == 0
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    fake_http(monkeypatch, b'<p class="HASH9">\xe6\xad\xa3\xe6\x96\x87</p>')
    assert sl.cmd_verify(entries, Namespace(name=None)) == 0
    assert "正文未变" in capsys.readouterr().out


def test_site_text_drift_warns_but_does_not_fail(tmp_path, monkeypatch, capsys):
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"<p>102 LOC</p>")
    assert fetch(p, "s01-site", "site", "https://x/zh/s01/") == 0
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    fake_http(monkeypatch, b"<p>141 LOC</p>")
    assert sl.cmd_verify(entries, Namespace(name=None)) == 0  # WARN 不是 FAIL
    out = capsys.readouterr().out
    assert "正文已变更" in out and "WARN 1" in out


def test_verify_unknown_name_fails(tmp_path, monkeypatch):
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"x")
    fetch(p, "a", "site", "https://x/")
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    assert sl.cmd_verify(entries, Namespace(name="nope")) == 1


def test_fetch_records_line_and_byte_counts(tmp_path, monkeypatch):
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"a\nb\nc\n")
    fetch(p, "a", "repo", f"https://raw/o/r/{SHA}/f.py", pinned=SHA)
    e = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))["a"]
    assert e["bytes"] == 6 and e["lines"] == 3 and e["accessed"] == "2026-08-21"
