"""PDF Fidelity Patrol 的 wiki 渲染环境编排（真实 wiki app 渲染栈快路径）。

在内层 fast loop 中，把 worktree CLI 产出的候选 Markdown 经「真实 wiki 渲染栈」
（``apps/negentropy-wiki`` 的 react-markdown + remark-gfm/math + rehype-katex/raw/
highlight/sanitize 全栈）渲染，再由 Playwright 截图，作为与源 PDF 逐页对照的真值——
取代旧 ``_fidelity_render`` 的 Python-Markdown 近似栈（与真实 wiki 系统性不同，致
公式/Mermaid/figure/figcaption/图片尺寸/代码高亮假阳性/假阴性）。

设计（Orthogonal Decomposition / 最小干预）：
- **内容源**：patrol 专属 ``content_root``（文件态，**不写生产 DB**），复用 wiki 既有
  ``[pubSlug]/[...entrySlug]`` 路由 + ``MarkdownRenderer.tsx``，不改 wiki 源码。
  scaffold 经 ``ensure_content_scaffold`` 写最小 index/publications/entries-index；
  候选/真值经 ``write_entry_content`` 原子写 ``entries/{entry_id}.json``。
- **渲染进程**：``next dev``（``WIKI_CONTENT_DIR=content_root`` + ``WIKI_CONTENT_NO_CACHE=1``，
  见 ``content-source.ts`` dev 缓存旁路），后端 handler 起（``start_wiki_dev_server``）、
  orchestrator FINALIZE 收（``stop_wiki_dev_server``），跨 CC 会话保活。
- **schema 复用**：``build_entry_content_response`` 合成 entries/{id}.json，与生产导出
  （``WikiExportService``）逐字段一致（DRY），wiki 端零特判。

资产 bake：``publish-candidate`` 经 ``_bake_patrol_assets`` 把候选引用的图片字节
复制到 ``apps/negentropy-wiki/public/assets/{doc}/``（.gitignore）并把引用重写为
``/assets/{doc}/{file}``（与生产 ``WikiExportService`` 的 ``bake_assets=True`` 形态一致），
wiki dev 经 next 静态机制服务 ``public/`` 即可渲染——图片显示尺寸/figure 类拟合在
inner loop 即可验。Real-Render Gate 仍走 ``WikiExportService.export_single_entry``
（DB publication + bake）作地面真值校准。

CLI（CC 会话经 ``uv run --project apps/negentropy python -m
negentropy.engine.routine.patrol_wiki_env <cmd>`` 调用）：
- ``publish-candidate``：读候选 MD 文件 → 合成 schema → 原子写 entries/{id}.json。
"""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from uuid import UUID

from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])

# ---------------------------------------------------------------------------
# patrol 专属 staging publication / entry 的固定标识（文件态 content root 用，
# 不入生产 DB；固定 slug 使 wiki URL 稳定，跨迭代复用）。
# ---------------------------------------------------------------------------

PATROL_PUB_SLUG = "pdf-fidelity-patrol-staging"
PATROL_PUB_ID = UUID("a1b2c3d4-e5f6-4a7b-8c9d-0a1b2c3d4e5f")
PATROL_ENTRY_ID = UUID("b2c3d4e5-f6a7-4b8c-9d0a-1b2c3d4e5f6a")
PATROL_ENTRY_SLUG = "candidate"

# 本机需避让的已占用端口（用户本机服务）。
_RESERVED_PORTS = {3092, 3192, 2992, 3292, 3093}

_READY_PROBE_TIMEOUT_S = 90.0
_READY_PROBE_INTERVAL_S = 1.5


def wiki_url(*, port: int) -> str:
    """patrol 候选页在 wiki dev server 上的稳定 URL（固定 pub/entry slug）。"""
    return f"http://127.0.0.1:{port}/{PATROL_PUB_SLUG}/{PATROL_ENTRY_SLUG}/"


# ---------------------------------------------------------------------------
# content root scaffold（文件态，幂等）
# ---------------------------------------------------------------------------


def _iso_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def ensure_content_scaffold(
    content_root: Path,
    *,
    doc_id: UUID,
    doc_title: str,
    doc_filename: str,
) -> None:
    """写最小 wiki 内容包 scaffold（index/publications/publication/nav/entries-index）。

    幂等：每次 Routine 启动可重写（覆盖固定 patrol pub/entry 的元信息为当前文档）。
    不写 ``entries/{id}.json``（内容由 ``write_entry_content`` 每轮覆盖）。
    """
    content_root.mkdir(parents=True, exist_ok=True)
    (content_root / "entries").mkdir(parents=True, exist_ok=True)
    pub_dir = content_root / "publications" / PATROL_PUB_SLUG
    pub_dir.mkdir(parents=True, exist_ok=True)

    generated_at = _iso_now()
    publication = {
        "id": str(PATROL_PUB_ID),
        "catalog_id": str(PATROL_PUB_ID),  # 文件态无 DB catalog；wiki 不校验
        "app_name": "default",
        "publish_mode": "LIVE",
        "name": "PDF Fidelity Patrol Staging",
        "slug": PATROL_PUB_SLUG,
        "description": "巡检真实渲染对照用 staging（文件态，不入生产）",
        "status": "published",
        "theme": "default",
        "version": 1,
        "published_at": generated_at,
        "created_at": generated_at,
        "updated_at": generated_at,
        "entries_count": 1,
    }
    entry_item = {
        "id": str(PATROL_ENTRY_ID),
        "document_id": str(doc_id),
        "entry_slug": PATROL_ENTRY_SLUG,
        "entry_title": doc_title or doc_filename or "patrol-candidate",
        "is_index_page": False,
        "status": "active",
    }
    nav_item = {
        "entry_id": str(PATROL_ENTRY_ID),
        "entry_slug": PATROL_ENTRY_SLUG,
        "entry_title": entry_item["entry_title"],
        "is_index_page": False,
        "document_id": str(doc_id),
        "entry_kind": "DOCUMENT",
    }

    _atomic_write_json(pub_dir / "publication.json", publication)
    _atomic_write_json(
        pub_dir / "nav-tree.json",
        {"publication_id": str(PATROL_PUB_ID), "nav_tree": {"items": [nav_item]}},
    )
    _atomic_write_json(
        pub_dir / "entries-index.json",
        {"items": [entry_item], "total": 1, "slug_to_id": {PATROL_ENTRY_SLUG: str(PATROL_ENTRY_ID)}},
    )
    _atomic_write_json(content_root / "publications.json", {"items": [publication], "total": 1})
    _atomic_write_json(
        content_root / "index.json",
        {
            "schema_version": 1,
            "generated_at": generated_at,
            "exporter_version": "patrol-wiki-env-0.1",
            "publications": [{"slug": PATROL_PUB_SLUG, "id": str(PATROL_PUB_ID), "version": 1}],
            "pubs": {
                PATROL_PUB_SLUG: {
                    "id": str(PATROL_PUB_ID),
                    "version": 1,
                    "entry_slug_to_id": {PATROL_ENTRY_SLUG: str(PATROL_ENTRY_ID)},
                    "entry_ids": [str(PATROL_ENTRY_ID)],
                }
            },
        },
    )
    logger.info(
        "patrol_wiki_scaffold_ready",
        content_root=str(content_root),
        doc_id=str(doc_id),
    )


def write_entry_content(
    content_root: Path,
    *,
    markdown: str,
    doc_id: UUID,
    entry_title: str,
    entry_filename: str,
) -> Path:
    """把候选/真值 Markdown 合成 wiki entry content schema，原子写 entries/{id}.json。

    复用 ``build_entry_content_response``（与生产导出逐字段一致），wiki 端零特判。
    """
    from negentropy.knowledge.lifecycle.wiki_service import build_entry_content_response

    content_data = {
        "document_id": str(doc_id),
        "markdown_content": markdown,
        "title": entry_title or entry_filename or "patrol-candidate",
        "filename": entry_filename or "",
        "metadata": {},
        "source_url": None,
    }
    resp = build_entry_content_response(PATROL_ENTRY_ID, content_data, entry_slug=PATROL_ENTRY_SLUG)
    payload = resp.model_dump(mode="json")
    entries_dir = content_root / "entries"
    entries_dir.mkdir(parents=True, exist_ok=True)
    target = entries_dir / f"{PATROL_ENTRY_ID}.json"
    _atomic_write_json(target, payload)
    return target


def _bake_patrol_assets(markdown: str, *, markdown_file: Path, doc_id: UUID) -> str:
    """把候选 MD 内的图片引用 bake 到 wiki dev 可服务的 ``public/assets/{doc}/``。

    patrol wiki dev（``next dev``）只经 next 静态机制服务 ``public/``——content_root
    下 ``entries/*.json`` 由 ``content-source.ts`` 读，但**图片不经其服务**（生产由
    ``sync-assets.mjs`` 同步 ``content/assets/`` → ``public/assets/``）。patrol staging
    无 prebuild 钩子，故此处直接把候选引用的图片字节复制到
    ``{repo}/apps/negentropy-wiki/public/assets/{doc}/{file}``（该路径已 .gitignore），
    并把 markdown 引用重写为 ``/assets/{doc}/{file}``（与生产 ``bake_assets=True``
    形态逐字一致，wiki 端零特判）。覆盖式清旧避免残留陈旧文件。

    支持两种引用形式（HTML ``<img src=...>`` 与 Markdown ``![..](..)`` 均覆盖）：
    - ``./images/{file}`` / ``images/{file}``（perceives CLI 产出）；
    - ``/api/documents/{doc}/assets/{file}``（ingestion 产出）。
    字节解析：相对 ``markdown_file`` 同级 ``images/``，再退父级 ``images/``。
    """

    doc = str(doc_id)
    assets_root = _repo_root() / "apps" / "negentropy-wiki" / "public" / "assets" / doc
    if assets_root.exists():
        shutil.rmtree(assets_root, ignore_errors=True)
    assets_root.mkdir(parents=True, exist_ok=True)

    src_dir = markdown_file.resolve().parent
    # 文件名允许字符（与生产 _ASSET_REF_PATTERN 的 filename 集对齐）
    name = r"[A-Za-z0-9._\-]+"
    # 形态 A：HTML src="./images/x" / "images/x" / "/api/documents/<uuid>/assets/x"
    src_pat = re.compile(
        r'src="(?:\./)?images/(?P<f0>' + name + r')"'
        r'|src="(?P<api>/api/documents/[0-9a-fA-F-]{36}/assets/)(?P<f1>' + name + r')"'
    )
    # 形态 B：Markdown ![alt](./images/x) / (images/x) / (/api/documents/<uuid>/assets/x)
    md_pat = re.compile(
        r"!\[[^\]]*\]\((?:\./)?images/(?P<f0>" + name + r")\)"
        r"|!\[[^\]]*\]\((?P<api>/api/documents/[0-9a-fA-F-]{36}/assets/)(?P<f1>" + name + r")\)"
    )

    def _resolve(filename: str) -> Path | None:
        for cand in (src_dir / "images" / filename, src_dir.parent / "images" / filename):
            if cand.is_file():
                return cand
        return None

    state = {"copied": 0, "missing": []}

    def _make_repl(prefix: str):
        def repl(m: re.Match) -> str:
            filename = m.group("f0") or m.group("f1")
            src_file = _resolve(filename)
            if src_file is None:
                state["missing"].append(filename)
                return m.group(0)
            shutil.copyfile(src_file, assets_root / filename)
            state["copied"] += 1
            return _rewrite_token(m, prefix, doc, filename)

        return repl

    new_md = src_pat.sub(_make_repl("src"), markdown)
    new_md = md_pat.sub(_make_repl("md"), new_md)
    logger.info(
        "patrol_assets_baked",
        doc_id=doc,
        copied=state["copied"],
        missing=state["missing"][:10],
        assets_root=str(assets_root),
    )
    return new_md


def _rewrite_token(m: re.Match, prefix: str, doc: str, filename: str) -> str:
    """据匹配形态（HTML src / Markdown img）重写 URL token 为 /assets/{doc}/{file}。"""
    raw = m.group(0)
    if prefix == "src":
        return re.sub(r'src="[^"]*"', f'src="/assets/{doc}/{filename}"', raw, count=1)
    return re.sub(r"\]\([^)]*\)", f"](/assets/{doc}/{filename})", raw, count=1)


# ---------------------------------------------------------------------------
# wiki dev server 生命周期（后端 handler 起 / orchestrator FINALIZE 收）
# ---------------------------------------------------------------------------


def pick_free_port() -> int:
    """选一个空闲端口（避让本机已占用服务端口）。"""
    for _ in range(20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = int(s.getsockname()[1])
        if port not in _RESERVED_PORTS:
            return port
    # 兜底（极不可能）：交由 OS 选。
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _repo_root() -> Path:
    """从本模块定位 repo 根（含 apps/ 与 apps/negentropy-wiki）。

    向上查找首个含 ``apps/negentropy-wiki`` 的祖先目录，比硬编码 parents[N] 更稳健
    （包路径重构不致错位）。
    """
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        if (parent / "apps" / "negentropy-wiki").is_dir():
            return parent
    # 兜底：向上 7 层（patrol_wiki_env.py → apps/negentropy/src/negentropy/engine/routine）
    return here.parents[6]


def start_wiki_dev_server(
    content_root: Path,
    *,
    port: int,
    repo_root: Path | None = None,
) -> int:
    """spawn ``next dev`` wiki server（``WIKI_CONTENT_DIR`` + ``WIKI_CONTENT_NO_CACHE``），返回 pid。

    **非阻塞**：仅 ``Popen`` 后立即返回 pid（不在 handler/scheduler tick 内同步等 ready，
    避免单 worker 后端事件循环冻结——见 ``start_new_session`` + 调用方约束）。
    CC 会话截图前调 ``wait_ready``（CLI ``wait-ready``）在 bash 内阻塞至可服务。

    - ``start_new_session=True``：独立进程组，便于 ``stop_wiki_dev_server`` 一并 kill 子进程
      （next dev 会派生 worker）。
    - 失败（pnpm/next 缺失）由 ``Popen`` 抛：handler 调用方应吞异常并降级（标本轮无 wiki 真值）。
    """
    repo = repo_root or _repo_root()
    env = os.environ.copy()
    env["WIKI_CONTENT_DIR"] = str(content_root)
    env["WIKI_CONTENT_NO_CACHE"] = "1"
    env["NODE_ENV"] = "development"
    proc = subprocess.Popen(
        [
            "pnpm",
            "--filter",
            "negentropy-wiki",
            "exec",
            "next",
            "dev",
            "--port",
            str(port),
            "--hostname",
            "127.0.0.1",
        ],
        cwd=str(repo),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    logger.info("patrol_wiki_dev_started", port=port, pid=proc.pid, content_root=str(content_root))
    return proc.pid


def wait_ready(*, port: int, timeout_s: float | None = None) -> bool:
    """轮询 wiki dev server 至可服务（阻塞，供 CC 截图前在 bash 内调用）。

    超时 WARN 但返回 False（CC 据此降级 legacy ``_fidelity_render`` 或重试）。
    """
    url = wiki_url(port=port)
    deadline = time.monotonic() + (timeout_s if timeout_s is not None else _READY_PROBE_TIMEOUT_S)
    last_err: str | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:  # noqa: S310 - 本机 dev 探测
                if 200 <= resp.status < 500:
                    logger.info("patrol_wiki_dev_ready", port=port)
                    return True
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last_err = str(exc)
        time.sleep(_READY_PROBE_INTERVAL_S)
    logger.warning("patrol_wiki_dev_ready_timeout", port=port, url=url, error=last_err)
    return False


def is_server_alive(pid: int) -> bool:
    """pid 对应进程是否仍存活（best-effort）。"""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # 存在但无权发信号——视为 alive
    return True


def stop_wiki_dev_server(pid: int) -> None:
    """kill wiki dev server 整个进程组（start_new_session 下 pgid == pid）。

    best-effort：进程已退出 / 无权 kill 均静默（FINALIZE/abort 清理不应抛）。
    """
    try:
        os.killpg(pid, 15)  # SIGTERM 整组
    except ProcessLookupError:
        return
    except PermissionError:
        logger.warning("patrol_wiki_dev_stop_no_perm", pid=pid)
        return
    except Exception as exc:  # noqa: BLE001 - 清理兜底
        logger.warning("patrol_wiki_dev_stop_failed", pid=pid, error=str(exc))
        return
    # 给 graceful shutdown 一点时间后兜底 SIGKILL 整组。
    for _ in range(10):
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return
        time.sleep(0.3)
    try:
        os.killpg(pid, 9)  # SIGKILL
    except ProcessLookupError:
        return
    except Exception:  # noqa: BLE001
        return


# ---------------------------------------------------------------------------
# IO 助手（原子写，避免 wiki dev server 读到半写 JSON）
# ---------------------------------------------------------------------------


def _atomic_write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# CLI（CC 会话调用：publish-candidate）
# ---------------------------------------------------------------------------


def _cli() -> int:
    import argparse

    parser = argparse.ArgumentParser(prog="patrol_wiki_env", description="巡检 wiki 渲染环境编排")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_pub = sub.add_parser("publish-candidate", help="候选/真值 MD → entries/{id}.json")
    p_pub.add_argument("--content-root", required=True)
    p_pub.add_argument("--markdown-file", required=True)
    p_pub.add_argument("--doc-id", required=True)
    p_pub.add_argument("--title", default="")
    p_pub.add_argument("--filename", default="")

    p_wait = sub.add_parser("wait-ready", help="阻塞至 wiki dev server 可服务（截图前调）")
    p_wait.add_argument("--port", type=int, required=True)
    p_wait.add_argument("--timeout", type=float, default=_READY_PROBE_TIMEOUT_S)

    args = parser.parse_args()

    if args.cmd == "publish-candidate":
        content_root = Path(args.content_root)
        markdown_file = Path(args.markdown_file)
        markdown = markdown_file.read_text(encoding="utf-8")
        markdown = _bake_patrol_assets(markdown, markdown_file=markdown_file, doc_id=UUID(args.doc_id))
        target = write_entry_content(
            content_root,
            markdown=markdown,
            doc_id=UUID(args.doc_id),
            entry_title=args.title,
            entry_filename=args.filename,
        )
        # CC 解析用：打印产物路径 JSON（单行）。
        print(json.dumps({"entry_content_path": str(target)}))
        return 0

    if args.cmd == "wait-ready":
        ok = wait_ready(port=args.port, timeout_s=args.timeout)
        print(json.dumps({"ready": bool(ok), "port": args.port, "url": wiki_url(port=args.port)}))
        return 0 if ok else 1

    parser.error(f"unknown cmd: {args.cmd}")
    return 2


if __name__ == "__main__":
    sys.exit(_cli())
