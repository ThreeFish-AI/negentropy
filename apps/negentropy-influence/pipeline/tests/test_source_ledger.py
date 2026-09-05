"""source_ledger 的取证判据：repo 类硬校验 vs site 类只看正文（全程无网络）。

sync/audit 用例同样无网络：抓取一律经 fake_http 打桩（与 fetch 用例同一姿势）。"""

from __future__ import annotations

import json
import sys
from argparse import Namespace
from pathlib import Path

import tomllib

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import source_ledger as sl

SHA = "f9e8b280f715f9ba107d4517fd39bc5f8ddda618"
SHA2 = "67a9126c6435a8654ba7a6f68c0fd2130f00a462"

#: 真实 ep1 台账与系列地图（repo 树内，只读）
INFLUENCE = Path(__file__).resolve().parents[2]
EP1_PROJECT = INFLUENCE / "episodes" / "claude-code-explained-video"
REAL_MAP = INFLUENCE / "source-map" / "claude-code-explained.toml"

#: 最小系列地图夹具：2 pin × 3 章（ep1 1 章 + ep2 2 章），sitePaths 含多路径章。
FIXTURE_MAP = """
seriesId = "fixture-series"
repo = "https://github.com/o/r"
rawBase = "https://raw.githubusercontent.com/o/r"
license = "MIT"
siteBase = "https://site.example/zh"

[[pin]]
ref = "{SHA}"
date = "2026-08-18"
label = "main"
readmeFile = "README.zh.md"
codeFile = "code.py"
episodes = [1]

[[pin]]
ref = "{SHA2}"
date = "2026-07-28"
label = "site-sync revision"
readmeFile = "README.md"
codeFile = "code.py"
episodes = [2]

[[chapter]]
id = "s01_agent_loop"
slug = "s01"
episode = 1
sitePaths = ["s01"]

[[chapter]]
id = "s05_todo_write"
slug = "s05"
episode = 2
sitePaths = ["s05", "s05b"]

[[chapter]]
id = "s06_subagent"
slug = "s06"
episode = 2
sitePaths = ["s06"]
""".format(SHA=SHA, SHA2=SHA2)


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


def write_map(tmp_path: Path, text: str = FIXTURE_MAP) -> Path:
    m = tmp_path / "map.toml"
    m.write_text(text, encoding="utf-8")
    return m


def sync_args(map_path: Path, episode: int, **kw) -> Namespace:
    return Namespace(
        map=str(map_path), episode=episode, **{"dry_run": False, "refetch": False, **kw}
    )


def audit_args(map_path: Path, episode: int) -> Namespace:
    return Namespace(map=str(map_path), episode=episode)


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


# ------------------------------------------------------------ sync（多章批量取证）


def test_sync_dry_run_lists_planned_names_only(tmp_path, monkeypatch, capsys):
    """dry-run 只打印计划、零写盘、零抓取——http_get 一旦被调即炸。"""
    m = write_map(tmp_path)
    monkeypatch.setattr(
        sl,
        "http_get",
        lambda url: (_ for _ in ()).throw(AssertionError("dry-run 抓了网络")),
    )
    p = tmp_path / "proj"
    assert sl.cmd_sync(p, sync_args(m, 2, dry_run=True)) == 0
    out = capsys.readouterr().out
    for name in (
        "s05-readme",
        "s05-code",
        "s05-site-s05",
        "s05-site-s05b",
        "s06-readme",
    ):
        assert name in out
    assert not sl.ledger_path(p).exists()


def test_sync_creates_entries_with_derived_urls(tmp_path, monkeypatch):
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"payload")
    assert sl.cmd_sync(p, sync_args(m, 2)) == 0
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    assert set(entries) == {
        "s05-readme",
        "s05-code",
        "s05-site-s05",
        "s05-site-s05b",
        "s06-readme",
        "s06-code",
        "s06-site",
    }
    assert (
        entries["s05-readme"]["url"]
        == f"https://raw.githubusercontent.com/o/r/{SHA2}/s05_todo_write/README.md"
    )
    assert entries["s05-readme"]["pinned_ref"] == SHA2
    assert entries["s05-site-s05b"]["url"] == "https://site.example/zh/s05b/"
    assert entries["s05-site-s05b"]["kind"] == "site"


def test_sync_is_idempotent_without_refetch(tmp_path, monkeypatch):
    """第二次 sync（URL 一致、无 --refetch）零写入——台账字节不动。"""
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"v1")
    assert sl.cmd_sync(p, sync_args(m, 2)) == 0
    before = sl.ledger_path(p).read_bytes()
    calls = []

    def counting_get(url):
        calls.append(url)
        return b"v2"

    monkeypatch.setattr(sl, "http_get", counting_get)
    assert sl.cmd_sync(p, sync_args(m, 2)) == 0
    assert sl.ledger_path(p).read_bytes() == before
    assert not calls  # 幂等路径不该碰网络


def test_sync_episode_isolation(tmp_path, monkeypatch):
    """sync --episode 1 永不产生 ep2 章的条目（跨集混入的第一道闸）。"""
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"x")
    assert sl.cmd_sync(p, sync_args(m, 1)) == 0
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    assert set(entries) == {"s01-readme", "s01-code", "s01-site"}
    assert entries["s01-readme"]["url"].endswith("s01_agent_loop/README.zh.md")


# ------------------------------------------------------------ audit（离线执法）


def test_audit_network_free_by_construction(tmp_path, monkeypatch):
    """audit 的离线性是硬判据：http_get 被调即当失败。在**好台账**上必须干净通过。"""
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"x")
    assert sl.cmd_sync(p, sync_args(m, 2)) == 0
    monkeypatch.setattr(
        sl,
        "http_get",
        lambda url: (_ for _ in ()).throw(AssertionError("audit 碰了网络")),
    )
    assert sl.cmd_audit(p, audit_args(m, 2)) == 0


def test_audit_fails_on_missing_entry(tmp_path, monkeypatch, capsys):
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"x")
    sl.cmd_sync(p, sync_args(m, 2))
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    del entries["s06-site"]
    sl.ledger_path(p).write_text(sl.render_ledger(entries), encoding="utf-8")
    assert sl.cmd_audit(p, audit_args(m, 2)) == 1
    assert "s06-site" in capsys.readouterr().out


def test_audit_fails_on_foreign_episode_entry(tmp_path, monkeypatch, capsys):
    """跨集混入：ep2 台账里出现 ep1 章的条目必须 FAIL。"""
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"x")
    sl.cmd_sync(p, sync_args(m, 2))
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    entries["s01-readme"] = {
        "url": f"https://raw/o/r/{SHA}/s01/README.zh.md",
        "kind": "repo",
        "pinned_ref": SHA,
        "accessed": "2026-08-21",
        "raw_sha256": "0" * 16,
        "text_sha256": "0" * 16,
        "bytes": 1,
        "lines": 1,
        "via": "",
    }
    sl.ledger_path(p).write_text(sl.render_ledger(entries), encoding="utf-8")
    assert sl.cmd_audit(p, audit_args(m, 2)) == 1
    assert "s01-readme" in capsys.readouterr().out


def test_audit_fails_on_wrong_pinned_ref(tmp_path, monkeypatch, capsys):
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"x")
    sl.cmd_sync(p, sync_args(m, 2))
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    entries["s05-readme"]["pinned_ref"] = SHA  # 该集的钉应是 SHA2
    sl.ledger_path(p).write_text(sl.render_ledger(entries), encoding="utf-8")
    assert sl.cmd_audit(p, audit_args(m, 2)) == 1
    assert "[c] s05-readme" in capsys.readouterr().out


def test_audit_accepts_unrelated_entry_names(tmp_path, monkeypatch):
    """不属任何章前缀的条目（如系列级信源）不算跨集混入——判据是前缀锚定而非全集白名单。"""
    m = write_map(tmp_path)
    p = tmp_path / "proj"
    fake_http(monkeypatch, b"x")
    sl.cmd_sync(p, sync_args(m, 2))
    entries = tomllib.loads(sl.ledger_path(p).read_text(encoding="utf-8"))
    entries["course-home"] = {
        "url": "https://site.example/zh/",
        "kind": "site",
        "pinned_ref": "",
        "accessed": "2026-08-21",
        "raw_sha256": "0" * 16,
        "text_sha256": "0" * 16,
        "bytes": 1,
        "lines": 1,
        "via": "",
    }
    sl.ledger_path(p).write_text(sl.render_ledger(entries), encoding="utf-8")
    monkeypatch.setattr(
        sl,
        "http_get",
        lambda url: (_ for _ in ()).throw(AssertionError("audit 碰了网络")),
    )
    assert sl.cmd_audit(p, audit_args(m, 2)) == 0


# ------------------------------------- ep1 已交付台账的命名字节兼容（真实树，只读）


def test_real_map_and_ep1_ledger_are_mutually_auditable():
    """真实系列地图 × ep1 真实台账：audit 零报警 = 命名方案字节兼容的端到端证据。"""
    assert sl.cmd_audit(EP1_PROJECT, audit_args(REAL_MAP, 1)) == 0


def test_real_map_derives_ep1_urls_byte_identical():
    """派生 URL 与已交付 12 条逐字节一致（audit 只查名与钉，URL 兼容须另证）。"""
    smap = sl.load_source_map(REAL_MAP)
    want = sl.derived_entries(smap, 1)
    ledger = tomllib.loads(
        (EP1_PROJECT / "research" / "sources.toml").read_text(encoding="utf-8")
    )
    assert len(ledger) == 12 and len(want) == 12
    for name, spec in want.items():
        assert ledger[name]["url"] == spec["url"], name


def test_real_map_pins_cover_registered_episodes():
    """series.json 里**已登记**的每一集都必须被钉覆盖（地图可超前登记战役后续集）。"""
    series = json.loads((INFLUENCE / "series.json").read_text(encoding="utf-8"))
    entry = next(s for s in series["seriesList"] if s["id"] == "claude-code-explained")
    eps = {e["episode"] for e in entry["episodes"]}
    smap = sl.load_source_map(REAL_MAP)
    pinned = {ep for p in smap["pin"] for ep in p["episodes"]}
    assert eps <= pinned, f"清单集号 {sorted(eps - pinned)} 无钉覆盖"
