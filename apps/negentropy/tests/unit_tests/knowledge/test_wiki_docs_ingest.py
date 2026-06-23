"""``wiki_docs_ingest`` 单测：docs/ → 保留 Publication 合成（纯函数，无 DB）。

覆盖：slug 派生 / 确定性 ID / 标题抽取 / 自然序 / nav-tree 形态（DOCUMENT 的
document_id 与 entry_id 非空）/ 链接重写（站内 / GitHub / 图片 / 过度 ../ 钳制）/
排除规则（.agents·i18n·*.zh.md·locale 目录）/ 空容器剪枝 / enabled=False。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from negentropy.config.knowledge import WikiDocsSyncSettings
from negentropy.knowledge.lifecycle.wiki_docs_ingest import (
    _container_id,
    _document_id,
    _entry_id,
    build_docs_pack,
    doc_slug_for,
    resolve_docs_root,
    rewrite_doc_links,
)


def _write(p: Path, text: str = "# 标题\n\n正文\n") -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


@pytest.fixture
def docs_tree(tmp_path: Path) -> Path:
    """构造最小但覆盖关键分支的假 docs/ 树。"""
    docs = tmp_path / "docs"
    _write(docs / "README.md", "# 根手册\n\n见 [Alpha](./concepts/010-alpha.md)。\n")
    _write(docs / "concepts" / "010-alpha.md", "# Alpha\n")
    _write(docs / "concepts" / "020a-beta.md", "# Beta\n")
    _write(docs / "concepts" / "100-late.md", "# Late\n")
    _write(docs / "concepts" / "user-guide" / "README.md", "# 用户指南\n")
    _write(docs / "concepts" / "user-guide" / "quickstart.md", "# 快速上手\n")
    _write(docs / "reference" / "cognizes" / "readme.md", "# Cognizes\n")
    _write(docs / "reference" / "cognizes" / "guide.md", "# Guide\n")
    _write(docs / "reference" / "cognizes" / "guide.zh.md", "# 指南（中文，应被排除）\n")
    _write(docs / "reference" / "cognizes" / "zh-CN" / "localized.md", "# 本地化（应被排除）\n")
    _write(docs / "concepts" / "empty-dir" / ".keep", "")  # 无 .md → 空容器应被剪枝
    # 不在 include_dirs / 被 exclude_dirs 覆盖的目录：
    _write(docs / ".agents" / "issue.md", "# 内部 Issue\n")
    _write(docs / "i18n" / "zh-CN" / "x.md", "# i18n\n")
    return docs


def _cfg(docs: Path, **kw) -> WikiDocsSyncSettings:
    return WikiDocsSyncSettings(docs_root=str(docs), **kw)


# ---------------------------------------------------------------------------
# slug / id / title
# ---------------------------------------------------------------------------


def test_doc_slug_for_rules():
    assert doc_slug_for("README.md") == "readme"
    assert doc_slug_for("concepts/user-guide/quickstart.md") == "concepts/user-guide/quickstart"
    assert doc_slug_for("reference/cognizes/README.md") == "reference/cognizes/readme"
    assert doc_slug_for("reference/cognizes/index.md") == "reference/cognizes/readme"
    # 空格 / 大小写逐段 slugify
    assert doc_slug_for("reference/cognizes/Context Engineering.md") == "reference/cognizes/context-engineering"


def test_ids_deterministic_and_distinct():
    # 同输入恒定（稳定 URL / 干净 diff）
    assert _entry_id("a/b.md") == _entry_id("a/b.md")
    assert _document_id("a/b.md") == _document_id("a/b.md")
    assert _container_id("a") == _container_id("a")
    # 三类前缀互不碰撞
    assert len({_entry_id("a/b.md"), _document_id("a/b.md"), _container_id("a/b.md")}) == 3


# ---------------------------------------------------------------------------
# resolve_docs_root
# ---------------------------------------------------------------------------


def test_resolve_docs_root_explicit_and_missing(tmp_path: Path, docs_tree: Path):
    assert resolve_docs_root(_cfg(docs_tree)) == docs_tree
    missing = WikiDocsSyncSettings(docs_root=str(tmp_path / "nope"))
    assert resolve_docs_root(missing) is None


# ---------------------------------------------------------------------------
# build_docs_pack：结构 / 排除 / 剪枝 / 排序
# ---------------------------------------------------------------------------


def test_build_disabled_returns_none(docs_tree: Path):
    assert build_docs_pack(_cfg(docs_tree, enabled=False)) is None


def test_build_pack_structure_and_exclusions(docs_tree: Path):
    frag = build_docs_pack(_cfg(docs_tree))
    assert frag is not None
    slugs = set(frag.entries_index["slug_to_id"])

    # 顶层顺序：README 首位，其后 include_dirs 自然序。
    top = [i["entry_slug"] for i in frag.nav_tree["nav_tree"]["items"]]
    assert top[0] == "readme"
    assert "concepts" in top and "reference" in top

    # 纳入文档
    assert "concepts/010-alpha" in slugs
    assert "concepts/user-guide/quickstart" in slugs
    assert "reference/cognizes/guide" in slugs

    # 排除：*.zh.md / locale 目录 / 未纳入的 .agents·i18n
    assert "reference/cognizes/guide.zh" not in slugs
    assert not any("zh-cn" in s for s in slugs)
    assert not any(s.startswith("agents") or s.startswith(".agents") for s in slugs)
    assert not any(s.startswith("i18n") for s in slugs)

    # 空容器剪枝：concepts/empty-dir 不应出现
    assert "concepts/empty-dir" not in slugs


def test_nav_document_carries_nonnull_ids(docs_tree: Path):
    """关键约束：DOCUMENT 节点 document_id 与 entry_id 必须非空。"""
    frag = build_docs_pack(_cfg(docs_tree))
    assert frag is not None

    def walk(items):
        for it in items:
            if it["entry_kind"] == "DOCUMENT":
                assert it["entry_id"], it
                assert it["document_id"] is not None, it
            else:
                assert it["document_id"] is None
            walk(it.get("children", []))

    walk(frag.nav_tree["nav_tree"]["items"])
    # entries-index 中每个 DOCUMENT 条目都有对应 entry payload 且 document_id 非空
    for e in frag.entries_index["items"]:
        if e["document_id"] is not None:
            assert e["id"] in frag.entry_payloads
            assert frag.entry_payloads[e["id"]]["document_id"] is not None


def test_natural_ordering_within_concepts(docs_tree: Path):
    frag = build_docs_pack(_cfg(docs_tree))
    assert frag is not None
    concepts = next(i for i in frag.nav_tree["nav_tree"]["items"] if i["entry_slug"] == "concepts")
    child_slugs = [c["entry_slug"] for c in concepts["children"] if c["entry_kind"] == "DOCUMENT"]
    # 010 < 020a < 100（自然序，非字典序）
    assert child_slugs == ["concepts/010-alpha", "concepts/020a-beta", "concepts/100-late"]


def test_folder_readme_is_index_and_first(docs_tree: Path):
    frag = build_docs_pack(_cfg(docs_tree))
    assert frag is not None
    concepts = next(i for i in frag.nav_tree["nav_tree"]["items"] if i["entry_slug"] == "concepts")
    ug = next(c for c in concepts["children"] if c["entry_slug"] == "concepts/user-guide")
    assert ug["entry_kind"] == "CONTAINER"
    assert ug["children"][0]["entry_slug"] == "concepts/user-guide/readme"
    assert ug["children"][0]["is_index_page"] is True


def test_title_extraction_and_publication_fields(docs_tree: Path):
    frag = build_docs_pack(_cfg(docs_tree))
    assert frag is not None
    readme_id = frag.entries_index["slug_to_id"]["readme"]
    assert frag.entry_payloads[readme_id]["entry_title"] == "根手册"
    assert frag.publication["slug"] == "negentropy"
    assert frag.publication["status"] == "published"
    assert frag.publication["entries_count"] == len(frag.entry_payloads)


# ---------------------------------------------------------------------------
# 链接重写（表驱动）
# ---------------------------------------------------------------------------


def test_rewrite_links_table():
    cfg = WikiDocsSyncSettings()  # 默认 github_owner/repo/ref
    included = {"concepts/framework", "concepts/user-guide/overview"}
    cur = "concepts/035-the-knowledge-base.md"

    cases = {
        # 外链 / 纯锚点：原样
        "[x](https://example.com)": "https://example.com",
        "[x](#section)": "#section",
        # 站内 .md（同级）→ /negentropy/<slug>，锚点保留
        "[f](./framework.md#11-x)": "/negentropy/concepts/framework#11-x",
        # 过度 ../ 的站内 .md → 钳制后仍命中站内
        "[f](../../../concepts/framework.md)": "/negentropy/concepts/framework",
        # 过度 ../ 的源码路径 → 钳制为仓库根 → GitHub blob
        "[src](../../../../apps/negentropy/src/x.py)": (
            "https://github.com/ThreeFish-AI/negentropy/blob/master/apps/negentropy/src/x.py"
        ),
        # docs 内但未纳入子集（.agents）→ GitHub blob
        "[i](../.agents/issue.md)": ("https://github.com/ThreeFish-AI/negentropy/blob/master/docs/.agents/issue.md"),
        # 图片 → GitHub raw
        "![img](../assets/a.png)": "https://raw.githubusercontent.com/ThreeFish-AI/negentropy/master/docs/assets/a.png",
    }
    for src, expected_url in cases.items():
        out = rewrite_doc_links(src, current_rel_path=cur, included_slugs=included, cfg=cfg)
        assert expected_url in out, f"{src!r} -> {out!r}"

    # 嵌套 [] 的链接文案（Next.js 动态段）仍被匹配重写
    nested = "[`app/[id]/route.ts`](../../../../apps/x/app/[id]/route.ts)"
    out = rewrite_doc_links(nested, current_rel_path=cur, included_slugs=included, cfg=cfg)
    assert "github.com/ThreeFish-AI/negentropy/blob/master/apps/x/app/[id]/route.ts" in out
