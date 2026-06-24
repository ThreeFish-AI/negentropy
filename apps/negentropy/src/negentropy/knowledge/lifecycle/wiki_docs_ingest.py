"""仓库 ``docs/`` → wiki 保留 Publication「Negentropy」合成器。

把仓库 ``docs/`` 公开子集（``README.md`` + ``include_dirs``）烘焙为一个
slug=``negentropy`` 的**保留 Publication** 内容包片段，注入 ``WikiExportService``
产出的同一静态内容包，使 wiki 端零改动地复用既有 schema 与页面路由。

设计要点（Orthogonal Decomposition / DRY）：
  - **纯函数 + 无自身文件 IO**：仅遍历 ``docs/`` 读文本、返回内存片段
    （``DocsPackFragment``），文件统一由 ``WikiExportService`` 落盘（与 DB 导出
    共用 ``_write_json`` 与 ``publications.json`` / ``index.json`` 聚合）。
  - **字段形状对齐**：``publication`` 仿 ``_serialize_publication``、entry 仿
    ``build_entry_content_response``，与内容包 schema 逐字段一致。
  - **确定性 UUIDv5**：同路径恒得同 id ⇒ 站内 URL 稳定、CI diff 干净。
  - **链接重写尽力而为**：相对 ``.md`` → 站内 slug；源码/仓库路径 → GitHub blob；
    图片 → GitHub raw；外链与纯锚点保留；单链失败仅 WARN，绝不抛错。

与 ``wiki_export_service`` 正交：后者序列化 DB 已发布内容；本模块从仓库文件系统
合成保留目录，二者在导出器中汇流为单一内容包。
"""

from __future__ import annotations

import json
import posixpath
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any

import yaml

from negentropy.config.knowledge import WikiDocsSyncSettings
from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])

# 固定命名空间（切勿变更：变更将导致所有 docs 条目 id/URL 漂移）。
_DOCS_NS = uuid.UUID("6e0e9c4a-2f3b-5d71-9a8c-7b1e4f0d2a55")

# 视为目录「索引页」的文件名（不分大小写，README 优先于 index）。
_INDEX_BASENAMES = ("readme", "index")

# markdown 行内链接 / 图片：``[text](url)`` / ``![alt](url "title")`` / ``[text](<url>)``。
# text 允许一层嵌套 ``[...]``（如代码路径中的 Next.js 动态段 ``[sessionId]``），
# 否则会在首个 ``]`` 处断裂、漏匹配此类链接。
_INLINE_LINK_RE = re.compile(
    r"(?P<bang>!?)\[(?P<text>(?:[^\[\]]|\[[^\[\]]*\])*)\]\(\s*"
    r"(?P<url><[^>]+>|[^)\s]+)"
    r"(?P<title>\s+\"[^\"]*\"|\s+'[^']*')?\s*\)"
)
# 引用式定义：``[id]: url``（行首）。
_REF_DEF_RE = re.compile(r"(?m)^(?P<indent>[ ]{0,3})\[(?P<id>[^\]]+)\]:\s*(?P<url><[^>]+>|\S+)")

# 首个 ATX H1（代码围栏之前）。
_H1_RE = re.compile(r"(?m)^#[ \t]+(?P<title>.+?)[ \t]*#*[ \t]*$")
_FENCE_RE = re.compile(r"(?m)^[ \t]*(```|~~~)")

# YAML frontmatter：文件首的 ``---\n...\n---`` 围栏（DOTALL 跨行匹配正文）。
_FM_RE = re.compile(r"\A---[ \t]*\n(?P<body>.*?)\n---[ \t]*(?:\n|$)", re.DOTALL)


@dataclass
class DocsPackFragment:
    """``docs/`` 合成内容包片段（由 WikiExportService 落盘 / 聚合）。"""

    publication: dict[str, Any]
    nav_tree: dict[str, Any]
    entries_index: dict[str, Any]
    entry_payloads: dict[str, dict[str, Any]] = field(default_factory=dict)
    index_pub: dict[str, Any] = field(default_factory=dict)
    pub_index_row: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# 定位仓库 docs/
# ---------------------------------------------------------------------------


def resolve_docs_root(cfg: WikiDocsSyncSettings) -> Path | None:
    """定位仓库 ``docs/``。

    ``cfg.docs_root`` 显式指定优先；否则从本文件向上「哨兵探测」——首个既含
    ``docs/README.md`` 又含 ``apps/`` 的祖先目录即仓库根，返回其 ``docs/``。
    CI checkout 与本地 ``sync-wiki-content.sh`` 行为一致，无需 git 子进程。
    找不到则 WARN 返回 ``None``（导出器据此跳过 docs 同步）。
    """
    if cfg.docs_root:
        root = Path(cfg.docs_root).expanduser().resolve()
        if (root / "README.md").is_file():
            return root
        logger.warning("wiki_docs_root_invalid", docs_root=str(root))
        return None

    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "docs" / "README.md").is_file() and (parent / "apps").is_dir():
            return parent / "docs"
    logger.warning("wiki_docs_root_not_found", searched_from=str(here))
    return None


# ---------------------------------------------------------------------------
# 确定性 ID / slug / 标题 / 自然序
# ---------------------------------------------------------------------------


def _pub_id(slug: str) -> str:
    return str(uuid.uuid5(_DOCS_NS, f"publication:{slug}"))


def _entry_id(rel_or_dir: str) -> str:
    return str(uuid.uuid5(_DOCS_NS, f"entry:{rel_or_dir}"))


def _container_id(rel_dir: str) -> str:
    return str(uuid.uuid5(_DOCS_NS, f"container:{rel_dir}"))


def _document_id(rel_path: str) -> str:
    return str(uuid.uuid5(_DOCS_NS, f"document:{rel_path}"))


def _slug_segment(name: str) -> str:
    """单路径段 slugify：小写、空白/下划线→``-``、剔非 ``[a-z0-9.-]``、收敛连字符。"""
    s = name.strip().lower()
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"[^a-z0-9.\-]+", "", s)
    s = re.sub(r"-{2,}", "-", s).strip("-.")
    return s or "untitled"


def doc_slug_for(rel_posix: str) -> str:
    """docs 相对路径 → 站内 entry slug（Materialized Path，用 ``/`` 连接）。

    - 顶层 ``README.md`` → ``readme``；
    - 目录 ``README.md`` / ``index.md`` → ``<dir slug>/readme``；
    - 其余 → ``<dir slug>/<文件名去 .md 的 slug>``。
    """
    p = PurePosixPath(rel_posix)
    stem = p.name[:-3] if p.name.lower().endswith(".md") else p.name
    parent_segs = [_slug_segment(s) for s in p.parent.parts if s not in (".", "")]
    if stem.lower() in _INDEX_BASENAMES:
        return "/".join([*parent_segs, "readme"]) if parent_segs else "readme"
    return "/".join([*parent_segs, _slug_segment(stem)])


def _dir_slug_for(rel_dir_posix: str) -> str:
    """docs 子目录相对路径 → 容器 slug。"""
    return "/".join(_slug_segment(s) for s in PurePosixPath(rel_dir_posix).parts if s not in (".", ""))


def _natural_key(name: str) -> list[Any]:
    """自然序键：数字串按整数比较（``020a`` < ``020b`` < ``030`` < ``100``）。"""
    parts = re.split(r"(\d+)", name.lower())
    return [int(tok) if tok.isdigit() else tok for tok in parts]


def _humanize(stem: str) -> str:
    """无 H1 时的标题兜底：剥前缀序号、分隔符转空格。"""
    s = re.sub(r"^\d+[a-z]*[-_]+", "", stem)
    s = re.sub(r"[-_]+", " ", s).strip()
    return s or stem


def _extract_title(markdown: str, fallback_stem: str) -> str:
    """取首个 ATX H1（代码围栏之前、剥行内反引号）；无则 humanize 文件名。

    调用方应传入**已剥离 frontmatter** 的 body，避免围栏内 ``# 注释`` 行被误判为标题。
    """
    fence = _FENCE_RE.search(markdown)
    scope = markdown[: fence.start()] if fence else markdown
    m = _H1_RE.search(scope)
    if m:
        title = m.group("title").strip().replace("`", "")
        if title:
            return title
    return _humanize(fallback_stem)


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """拆分 YAML frontmatter；返回 ``(meta, 去掉围栏的 body)``。

    无 frontmatter / 解析失败 / 非 dict → ``({}, 原文)``，绝不抛错（单篇坏 frontmatter
    不应中断整次导出）。meta 仅接受 dict（拒 scalar/list），保证下游 ``.get`` 安全。
    """
    m = _FM_RE.match(text)
    if not m:
        return {}, text
    try:
        meta = yaml.safe_load(m.group("body")) or {}
    except yaml.YAMLError as exc:
        logger.warning("wiki_docs_frontmatter_parse_error", error=str(exc))
        return {}, text
    if not isinstance(meta, dict):
        return {}, text
    return meta, text[m.end() :]


def _read_category_json(dir_path: Path) -> dict[str, Any]:
    """读目录内 ``_category_.json``（Docusaurus 风格目录元数据）。

    缺失 / 解析失败 / 非 dict → ``{}``（坏文件仅 WARN，回退到 humanize 目录名）。
    """
    fp = dir_path / "_category_.json"
    if not fp.is_file():
        return {}
    try:
        data = json.loads(fp.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("wiki_docs_category_json_error", path=str(fp), error=str(exc))
        return {}
    return data if isinstance(data, dict) else {}


def _coerce_position(value: Any) -> float | None:
    """把 frontmatter / ``_category_.json`` 的位次值归一为 float。

    仅 int/float 放行（**显式拒 bool/str/None**），保证 ``_sort_children`` 排序键
    类型一致、无 ``TypeError``。
    """
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


# ---------------------------------------------------------------------------
# 链接重写
# ---------------------------------------------------------------------------


def _is_external(url: str) -> bool:
    return bool(re.match(r"^(?:[a-z][a-z0-9+.\-]*:|//)", url, re.IGNORECASE))


def _github_blob(cfg: WikiDocsSyncSettings, repo_path: str, anchor: str) -> str:
    return f"https://github.com/{cfg.github_owner}/{cfg.github_repo}/blob/{cfg.github_ref}/{repo_path}{anchor}"


def _github_raw(cfg: WikiDocsSyncSettings, repo_path: str) -> str:
    return f"https://raw.githubusercontent.com/{cfg.github_owner}/{cfg.github_repo}/{cfg.github_ref}/{repo_path}"


def _rewrite_target(
    raw_url: str,
    *,
    is_image: bool,
    current_rel_path: str,
    included_slugs: set[str],
    cfg: WikiDocsSyncSettings,
) -> str:
    """单个链接目标重写（纯函数，失败返回原值）。"""
    url = raw_url.strip()
    if url.startswith("<") and url.endswith(">"):
        url = url[1:-1].strip()

    if not url or url.startswith("#") or _is_external(url):
        return raw_url

    path_part, sep, frag = url.partition("#")
    anchor = (sep + frag) if sep else ""
    if not path_part:
        return raw_url

    docs_prefix = cfg.github_docs_prefix.strip("/")
    docs_root_prefix = f"{docs_prefix}/" if docs_prefix else ""
    cur_repo_path = f"{docs_prefix}/{current_rel_path}" if docs_prefix else current_rel_path
    cur_dir = posixpath.dirname(cur_repo_path)
    target_repo = posixpath.normpath(posixpath.join(cur_dir, path_part))

    # 解析越出仓库根：docs 内多见「过度 ../」的源码/同级链接（作者按非仓库基准书写）。
    # 钳制前导 ../ 串恢复作者意图：剩余串先按 docs 相对解释（恢复站内 .md 跳转），
    # 否则按仓库根相对解释（源码/根级文档 → GitHub）。
    if target_repo.startswith(".."):
        clamped = re.sub(r"^(?:\.\./)+", "", target_repo)
        if not clamped or clamped.startswith(".."):
            logger.warning("wiki_docs_link_escape", doc=current_rel_path, url=url)
            return raw_url
        if not is_image and clamped.lower().endswith(".md") and doc_slug_for(clamped) in included_slugs:
            return f"/{cfg.reserved_slug}/{doc_slug_for(clamped)}{anchor}"
        if is_image:
            return _github_raw(cfg, clamped)
        return _github_blob(cfg, clamped, anchor)

    in_docs = target_repo.startswith(docs_root_prefix) if docs_root_prefix else True

    if is_image:
        # 图片走 GitHub raw（blob 不内联渲染）。
        return _github_raw(cfg, target_repo)

    if in_docs and target_repo.lower().endswith(".md"):
        rel_to_docs = target_repo[len(docs_root_prefix) :] if docs_root_prefix else target_repo
        slug = doc_slug_for(rel_to_docs)
        if slug in included_slugs:
            return f"/{cfg.reserved_slug}/{slug}{anchor}"
        # docs 内但未纳入子集（.agents/i18n/locale 等）→ GitHub blob 兜底。
        return _github_blob(cfg, target_repo, anchor)

    # docs 外仓库路径（源码、根级文档等）→ GitHub blob。
    return _github_blob(cfg, target_repo, anchor)


def rewrite_doc_links(
    markdown: str,
    *,
    current_rel_path: str,
    included_slugs: set[str],
    cfg: WikiDocsSyncSettings,
) -> str:
    """重写一篇文档内的相对链接 / 图片（行内 + 引用式定义）。"""
    if not markdown:
        return markdown

    def _inline(m: re.Match[str]) -> str:
        new_url = _rewrite_target(
            m.group("url"),
            is_image=bool(m.group("bang")),
            current_rel_path=current_rel_path,
            included_slugs=included_slugs,
            cfg=cfg,
        )
        title = m.group("title") or ""
        return f"{m.group('bang')}[{m.group('text')}]({new_url}{title})"

    def _refdef(m: re.Match[str]) -> str:
        new_url = _rewrite_target(
            m.group("url"),
            is_image=False,
            current_rel_path=current_rel_path,
            included_slugs=included_slugs,
            cfg=cfg,
        )
        return f"{m.group('indent')}[{m.group('id')}]: {new_url}"

    out = _INLINE_LINK_RE.sub(_inline, markdown)
    out = _REF_DEF_RE.sub(_refdef, out)
    return out


# ---------------------------------------------------------------------------
# 文件收集 + 树构建
# ---------------------------------------------------------------------------


def _is_excluded(rel_posix: str, cfg: WikiDocsSyncSettings) -> bool:
    parts = PurePosixPath(rel_posix).parts
    name = parts[-1]
    if name.lower().endswith(tuple(s.lower() for s in cfg.exclude_suffixes)):
        return True
    excluded_names = {d.lower() for d in cfg.exclude_dir_names}
    if any(part.lower() in excluded_names for part in parts[:-1]):
        return True
    return False


def _collect_files(docs_root: Path, cfg: WikiDocsSyncSettings) -> list[str]:
    """收集纳入的 ``.md`` 相对路径（posix），已应用排除规则。"""
    rels: list[str] = []
    if cfg.include_root_readme and (docs_root / "README.md").is_file():
        rels.append("README.md")

    for inc in cfg.include_dirs:
        base = docs_root / inc
        if not base.is_dir():
            logger.warning("wiki_docs_include_dir_missing", include_dir=inc)
            continue
        for fp in sorted(base.rglob("*.md")):
            rel = fp.relative_to(docs_root).as_posix()
            if _is_excluded(rel, cfg):
                continue
            rels.append(rel)
    return rels


class _Node:
    """构树用可变节点（容器或文档）。"""

    __slots__ = (
        "slug",
        "title",
        "is_doc",
        "rel_path",
        "sort_name",
        "is_index",
        "position",
        "description",
        "children",
    )

    def __init__(
        self,
        slug: str,
        title: str,
        *,
        is_doc: bool,
        rel_path: str | None,
        sort_name: str,
        position: float | None = None,
        description: str | None = None,
    ) -> None:
        self.slug = slug
        self.title = title
        self.is_doc = is_doc
        self.rel_path = rel_path
        self.sort_name = sort_name
        self.is_index = False
        self.position = position
        self.description = description
        self.children: dict[str, _Node] = {}


def build_docs_pack(cfg: WikiDocsSyncSettings) -> DocsPackFragment | None:
    """遍历 docs/ 子集 → 合成 ``negentropy`` 保留 Publication 片段；禁用/缺失返回 None。"""
    if not cfg.enabled:
        return None
    docs_root = resolve_docs_root(cfg)
    if docs_root is None:
        return None

    rels = _collect_files(docs_root, cfg)
    if not rels:
        logger.warning("wiki_docs_no_files", docs_root=str(docs_root))
        return None

    # 第一遍：预计算全部文档 slug，供链接重写判定「站内可达」。
    doc_slugs: dict[str, str] = {}  # rel_path -> slug
    seen_slugs: set[str] = set()
    for rel in rels:
        slug = doc_slug_for(rel)
        if slug in seen_slugs:
            # 确定性去重：附加 -doc 后缀（极少见，folder-README 让位文件名）。
            alt = f"{slug}-doc"
            i = 2
            while alt in seen_slugs:
                alt = f"{slug}-doc-{i}"
                i += 1
            logger.warning("wiki_docs_slug_collision", rel=rel, slug=slug, resolved=alt)
            slug = alt
        seen_slugs.add(slug)
        doc_slugs[rel] = slug
    included_slugs = set(doc_slugs.values())

    # 第二遍：构建容器/文档树。
    root_children: dict[str, _Node] = {}
    for rel in rels:
        slug = doc_slugs[rel]
        p = PurePosixPath(rel)
        raw = (docs_root / rel).read_text(encoding="utf-8", errors="replace")
        meta, body = _parse_frontmatter(raw)
        # 标题：frontmatter title（SSOT）→ H1 → humanize；位次/描述来自 frontmatter。
        title = meta.get("title") or _extract_title(body, p.stem)
        position = _coerce_position(meta.get("sidebar_position"))
        desc = meta.get("description")
        description = desc if isinstance(desc, str) and desc.strip() else None
        is_index = p.name.lower().rsplit(".", 1)[0] in _INDEX_BASENAMES

        if len(p.parts) == 1:
            # 顶层文件（docs/README.md）。
            node = _Node(
                slug,
                title,
                is_doc=True,
                rel_path=rel,
                sort_name=p.name,
                position=position,
                description=description,
            )
            node.is_index = is_index
            root_children[slug] = node
            continue

        # 逐级建容器。
        cursor = root_children
        dir_parts: list[str] = []
        for seg in p.parts[:-1]:
            dir_parts.append(seg)
            dir_rel = "/".join(dir_parts)
            cslug = _dir_slug_for(dir_rel)
            child = cursor.get(cslug)
            if child is None:
                # 目录元数据来自其 _category_.json（Docusaurus 风格）；缺失则 humanize。
                cat = _read_category_json(docs_root / dir_rel)
                cat_desc = cat.get("description")
                child = _Node(
                    cslug,
                    cat.get("label") or _humanize(seg),
                    is_doc=False,
                    rel_path=None,
                    sort_name=seg,
                    position=_coerce_position(cat.get("position")),
                    description=cat_desc if isinstance(cat_desc, str) and cat_desc.strip() else None,
                )
                cursor[cslug] = child
            cursor = child.children
        doc_node = _Node(
            slug,
            title,
            is_doc=True,
            rel_path=rel,
            sort_name=p.name,
            position=position,
            description=description,
        )
        doc_node.is_index = is_index
        cursor[slug] = doc_node

    pub_slug = cfg.reserved_slug
    pub_id = _pub_id(pub_slug)

    entry_payloads: dict[str, dict[str, Any]] = {}
    entries_items: list[dict[str, Any]] = []
    slug_to_id: dict[str, str] = {}
    entry_ids: list[str] = []
    docs_prefix = cfg.github_docs_prefix.strip("/")

    def _doc_source_url(rel_path: str) -> str:
        repo_path = f"{docs_prefix}/{rel_path}" if docs_prefix else rel_path
        return f"https://github.com/{cfg.github_owner}/{cfg.github_repo}/blob/{cfg.github_ref}/{repo_path}"

    def _effective_pos(n: _Node) -> float:
        # 显式位次优先（frontmatter sidebar_position / _category_.json position）；
        # 无位次者：索引页(README/index)→ -inf 浮动至最前（向后兼容），其余 → +inf 沉末尾。
        if n.position is not None:
            return n.position
        return float("-inf") if n.is_index else float("inf")

    def _sort_children(nodes: dict[str, _Node]) -> list[_Node]:
        # 主键：有效位次升序；次键：文件名自然序 tiebreak —— 全链路确定、永不随机。
        return sorted(nodes.values(), key=lambda n: (_effective_pos(n), _natural_key(n.sort_name)))

    def _has_doc_descendant(node: _Node) -> bool:
        if node.is_doc:
            return True
        return any(_has_doc_descendant(c) for c in node.children.values())

    def _emit(node: _Node) -> dict[str, Any] | None:
        """DFS 生成 nav item + 旁路填充 entries-index / entry_payloads。"""
        if not node.is_doc and not _has_doc_descendant(node):
            return None  # 剪枝空容器

        if node.is_doc:
            eid = _entry_id(node.rel_path or node.slug)
            did = _document_id(node.rel_path or node.slug)
            raw_md = (docs_root / node.rel_path).read_text(encoding="utf-8", errors="replace")
            # 链接重写只作用于去 frontmatter 的 body；frontmatter 不进入导出内容
            # （wiki 渲染器未装 remark-frontmatter，围栏会渲染为可见 <hr>/裸文本）。
            _, doc_body = _parse_frontmatter(raw_md)
            md = rewrite_doc_links(
                doc_body,
                current_rel_path=node.rel_path or "",
                included_slugs=included_slugs,
                cfg=cfg,
            )
            entry_payloads[eid] = {
                "entry_id": eid,
                "document_id": did,
                "entry_slug": node.slug,
                "entry_title": node.title,
                "markdown_content": md,
                "document_filename": PurePosixPath(node.rel_path).name,
                "author_name": None,
                "author_url": None,
                "source_url": _doc_source_url(node.rel_path),
                "published_at": None,
            }
            entries_items.append(
                {
                    "id": eid,
                    "document_id": did,
                    "entry_slug": node.slug,
                    "entry_title": node.title,
                    "is_index_page": node.is_index,
                }
            )
            slug_to_id[node.slug] = eid
            entry_ids.append(eid)
            return {
                "entry_id": eid,
                "entry_slug": node.slug,
                "entry_title": node.title,
                "entry_description": node.description,
                "is_index_page": node.is_index,
                "document_id": did,
                "catalog_node_id": None,
                "entry_kind": "DOCUMENT",
                "children": [],
            }

        # 容器
        cid = _container_id(node.slug)
        entries_items.append(
            {
                "id": cid,
                "document_id": None,
                "entry_slug": node.slug,
                "entry_title": node.title,
                "is_index_page": False,
            }
        )
        slug_to_id[node.slug] = cid
        entry_ids.append(cid)
        children_items: list[dict[str, Any]] = []
        for child in _sort_children(node.children):
            emitted = _emit(child)
            if emitted is not None:
                children_items.append(emitted)
        return {
            "entry_id": cid,
            "entry_slug": node.slug,
            "entry_title": node.title,
            "entry_description": node.description,
            "is_index_page": False,
            "document_id": None,
            "catalog_node_id": None,
            "entry_kind": "CONTAINER",
            "children": children_items,
        }

    nav_items: list[dict[str, Any]] = []
    for top in _sort_children(root_children):
        emitted = _emit(top)
        if emitted is not None:
            nav_items.append(emitted)

    doc_count = len(entry_payloads)
    publication = {
        "id": pub_id,
        "catalog_id": pub_id,  # 无 DB catalog：自指占位（字段非空契约）。
        "app_name": pub_slug,
        "publish_mode": "snapshot",
        "name": cfg.reserved_name,
        "slug": pub_slug,
        "description": cfg.reserved_description,
        "status": "published",
        "theme": "docs",
        "version": 1,
        "published_at": None,
        "created_at": None,
        "updated_at": None,
        "entries_count": doc_count,
    }

    return DocsPackFragment(
        publication=publication,
        nav_tree={"publication_id": pub_id, "nav_tree": {"items": nav_items}},
        entries_index={"items": entries_items, "total": len(entries_items), "slug_to_id": slug_to_id},
        entry_payloads=entry_payloads,
        index_pub={
            "id": pub_id,
            "version": 1,
            "entry_slug_to_id": slug_to_id,
            "entry_ids": entry_ids,
        },
        pub_index_row={"slug": pub_slug, "id": pub_id, "version": 1},
    )


__all__ = [
    "DocsPackFragment",
    "build_docs_pack",
    "doc_slug_for",
    "resolve_docs_root",
    "rewrite_doc_links",
]
