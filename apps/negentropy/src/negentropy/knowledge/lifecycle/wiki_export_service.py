"""Wiki 静态内容导出服务。

把主站已发布（``status='published'``）的 Wiki 内容序列化为自包含的**静态内容包**，
交付给 ``apps/negentropy-wiki`` 作为纯静态站点的唯一内容来源（方案 A：CI 导出
并提交到 ``apps/negentropy-wiki/content/``）。

设计要点（Orthogonal Decomposition / DRY）：
  - **复用**既有读取逻辑：``WikiDao``（publications / entries / nav-tree /
    entry-content）与 ``wiki_graph_service.get_publication_graph``，不重写序列化。
  - **共享助手**：entry-content 响应构建复用 ``wiki_service.build_entry_content_response``，
    与 Wiki API 路由逐字段一致。
  - **发布边界**：本服务是主站职责（合法持有 DB 访问），产出静态文件；wiki 端构建
    期只读这些文件，运行期纯静态，**不直接或间接依赖主站数据库**。

内容包 schema 见 ``apps/negentropy-wiki/content.fixture/README.md``：
  content/index.json                            顶层索引
  content/publications.json                     listPublications()
  content/entries/[entryId].json                getEntryContent()（扁平，UUID 键）
  content/assets/[docId]/[file]                 烘焙的图片字节（仅 bake_assets=True）
  content/publications/[pubSlug]/
      publication.json / nav-tree.json /
      entries-index.json / graph.json
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.config import settings
from negentropy.knowledge.lifecycle.wiki_dao import WikiDao
from negentropy.logging import get_logger
from negentropy.models.perception import WikiPublication

from .wiki_graph_service import get_publication_graph
from .wiki_service import build_entry_content_response

logger = get_logger(__name__.rsplit(".", 1)[0])

SCHEMA_VERSION = 1

# markdown 内的衍生资产引用：/api/documents/{doc_id}/assets/{filename}
# （ingestion 期由 extraction.py 重写而成）；导出期重写为主站 wiki 资产端点 URL。
_ASSET_REF_PATTERN = re.compile(r"/api/documents/(?P<doc_id>[0-9a-fA-F-]{36})/assets/(?P<filename>[A-Za-z0-9._-]+)")


class WikiExportResult:
    """导出汇总（供 CLI / 管理 UI 展示）。"""

    def __init__(self) -> None:
        self.publications: list[str] = []
        self.entries: int = 0
        self.graphs: int = 0
        self.files: list[str] = []
        self.generated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "publications": self.publications,
            "publications_count": len(self.publications),
            "entries": self.entries,
            "graphs": self.graphs,
            "files_count": len(self.files),
            "generated_at": self.generated_at,
        }


class WikiExportService:
    """把已发布 Wiki 内容导出为静态内容包。"""

    def __init__(self) -> None:
        # publication 序列化缓存：主循环写 publication.json 时缓存，
        # 供 publications.json 复用，避免二次查询 entries_count。
        self._pub_cache: dict[str, dict[str, Any]] = {}
        # bake_assets 路径：延迟初始化的存储服务 + 已烘焙资产文件清单。
        self._storage_service: Any = None
        self._asset_files: list[str] = []

    async def export_all_published(
        self,
        db: AsyncSession,
        *,
        out_dir: Path,
    ) -> WikiExportResult:
        """导出全部已发布 publication 到 ``out_dir``（覆盖式重写）。"""
        result = WikiExportResult()
        result.generated_at = datetime.utcnow().isoformat() + "Z"

        pubs, _total = await WikiDao.list_publications(db, status="published", offset=0, limit=200)

        self._reset(out_dir)
        entries_dir = out_dir / "entries"
        entries_dir.mkdir(parents=True, exist_ok=True)
        pubs_root = out_dir / "publications"
        pubs_root.mkdir(parents=True, exist_ok=True)
        # bake_assets 路径：图片字节烘焙落点（next build 复制进 out/assets/）。
        assets_dir = out_dir / "assets"

        pubs_index: list[dict[str, Any]] = []
        index_pubs: dict[str, dict[str, Any]] = {}

        for pub in pubs:
            slug = pub.slug
            result.publications.append(slug)
            pub_dir = pubs_root / slug
            pub_dir.mkdir(parents=True, exist_ok=True)

            entries = await WikiDao.get_entries(db, pub.id)
            doc_entries = [e for e in entries if e.document_id is not None]
            entries_count = sum(1 for e in entries if getattr(e, "entry_kind", None) == "DOCUMENT") or len(doc_entries)

            # publication.json
            pub_payload = self._serialize_publication(pub, entries_count)
            self._write_json(pub_dir / "publication.json", pub_payload, result)

            # nav-tree.json（build_nav_tree 输出，已是嵌套结构）
            nav_tree = await WikiDao.get_nav_tree(db, pub.id)
            self._write_json(
                pub_dir / "nav-tree.json",
                {"publication_id": str(pub.id), "nav_tree": {"items": nav_tree}},
                result,
            )

            # entries-index.json + entries/{id}.json
            entry_items: list[dict[str, Any]] = []
            slug_to_id: dict[str, str] = {}
            for e in entries:
                entry_items.append(
                    {
                        "id": str(e.id),
                        "document_id": str(e.document_id) if e.document_id else None,
                        "entry_slug": e.entry_slug,
                        "entry_title": e.entry_title,
                        "is_index_page": bool(e.is_index_page),
                    }
                )
                slug_to_id[e.entry_slug] = str(e.id)

                if e.document_id is not None:
                    content_data = await WikiDao.get_entry_content(db, e.id)
                    if content_data is None:
                        logger.warning("wiki_export_entry_no_content", entry_id=str(e.id))
                        continue
                    resp = build_entry_content_response(e.id, content_data, entry_slug=e.entry_slug)
                    payload = resp.model_dump(mode="json")
                    payload["markdown_content"] = await self._rewrite_asset_links(
                        payload.get("markdown_content") or "", assets_dir=assets_dir
                    )
                    self._write_json(entries_dir / f"{e.id}.json", payload, result)
                    result.entries += 1

            self._write_json(
                pub_dir / "entries-index.json",
                {"items": entry_items, "total": len(entry_items), "slug_to_id": slug_to_id},
                result,
            )

            # graph.json（按 publication 切片；KG 未构建则跳过，wiki 侧降级 no_kg）
            graph = await get_publication_graph(db, pub_id=pub.id)
            if graph is not None:
                self._write_json(pub_dir / "graph.json", graph, result)
                result.graphs += 1

            pubs_index.append({"slug": slug, "id": str(pub.id), "version": pub.version})
            index_pubs[slug] = {
                "id": str(pub.id),
                "version": pub.version,
                "entry_slug_to_id": slug_to_id,
                "entry_ids": [str(e.id) for e in entries],
            }

        # publications.json + index.json（复用主循环缓存的 publication 序列化结果）
        pubs_payload = {
            "items": [self._pub_cache[str(pub.id)] for pub in pubs],
            "total": len(pubs),
        }
        self._write_json(out_dir / "publications.json", pubs_payload, result)
        self._write_json(
            out_dir / "index.json",
            {
                "schema_version": SCHEMA_VERSION,
                "generated_at": result.generated_at,
                "exporter_version": "wiki-export-0.1",
                "publications": pubs_index,
                "pubs": index_pubs,
            },
            result,
        )

        result.files.extend(self._asset_files)

        logger.info(
            "wiki_export_done",
            publications=len(pubs),
            entries=result.entries,
            graphs=result.graphs,
            assets=len(self._asset_files),
            files=len(result.files),
        )
        return result

    # ------------------------------------------------------------------
    # 序列化辅助
    # ------------------------------------------------------------------

    def _serialize_publication(self, pub: WikiPublication, entries_count: int) -> dict[str, Any]:
        """序列化 publication（字段与 wiki `WikiPublication` TS 接口对齐）。"""
        payload = {
            "id": str(pub.id),
            "catalog_id": str(pub.catalog_id),
            "app_name": pub.app_name,
            "publish_mode": pub.publish_mode,
            "name": pub.name,
            "slug": pub.slug,
            "description": pub.description,
            "status": pub.status,
            "theme": pub.theme,
            "version": pub.version,
            "published_at": _iso(pub.published_at),
            "created_at": _iso(pub.created_at),
            "updated_at": _iso(pub.updated_at),
            "entries_count": entries_count,
        }
        # 缓存，供 publications.json 复用，避免二次查询。
        self._pub_cache[str(pub.id)] = payload  # type: ignore[attr-defined]
        return payload

    async def _rewrite_asset_links(self, markdown: str, *, assets_dir: Path) -> str:
        """重写 markdown 内 ``/api/documents/{doc}/assets/{file}`` 图片引用。

        两条互斥路径（由 ``settings.knowledge.wiki_export.bake_assets`` 选择）：

        - **bake_assets=True（自包含）**：把资产**字节**下载写入
          ``assets_dir/{doc}/{file}`` 静态文件，markdown 改为相对路径
          ``/assets/{doc}/{file}``。产物零主站依赖，可发布到公网静态托管
          （GitHub Pages 等），主站不可达时图片仍正常。
        - **bake_assets=False（URL 重写）**：重写为
          ``{asset_base_url}/knowledge/wiki/documents/{doc}/assets/{file}``
          （``asset_base_url`` 空则同源相对路径）；运行期由主站端点供图。

        图片处理为"尽力而为"：单条资产下载/重写失败仅 WARN 并保留原引用，
        绝不阻断正文导出（文本可读优先于图片可用）。
        """
        if not markdown or "/api/documents/" not in markdown:
            return markdown

        matches = list(_ASSET_REF_PATTERN.finditer(markdown))
        if not matches:
            return markdown

        cfg = settings.knowledge.wiki_export
        replacements: list[tuple[str, str]] = []

        if cfg.bake_assets:
            storage_service = self._get_storage_service()
            for m in matches:
                doc_id = m.group("doc_id")
                filename = m.group("filename")
                try:
                    data = await storage_service.download_extraction_asset(document_id=UUID(doc_id), filename=filename)
                    if not data:
                        logger.warning("wiki_export_asset_missing", doc_id=doc_id, filename=filename)
                        continue
                    asset_path = assets_dir / doc_id / filename
                    asset_path.parent.mkdir(parents=True, exist_ok=True)
                    asset_path.write_bytes(data)
                    self._asset_files.append(str(asset_path))
                    replacements.append((m.group(0), f"/assets/{doc_id}/{filename}"))
                except Exception as exc:  # noqa: BLE001 - 容错：单图失败不阻断导出
                    logger.warning(
                        "wiki_export_asset_bake_failed",
                        doc_id=doc_id,
                        filename=filename,
                        error=str(exc),
                    )
        else:
            base = (cfg.asset_base_url or "").rstrip("/")
            for m in matches:
                doc_id = m.group("doc_id")
                filename = m.group("filename")
                replacements.append((m.group(0), f"{base}/knowledge/wiki/documents/{doc_id}/assets/{filename}"))

        for original, url in replacements:
            markdown = markdown.replace(original, url)
        return markdown

    def _get_storage_service(self) -> Any:
        """延迟初始化 DocumentStorageService（仅 bake_assets 路径需要）。"""
        if self._storage_service is None:
            from negentropy.storage.service import DocumentStorageService

            self._storage_service = DocumentStorageService()
        return self._storage_service

    # ------------------------------------------------------------------
    # 文件 IO
    # ------------------------------------------------------------------

    @staticmethod
    def _reset(out_dir: Path) -> None:
        """覆盖式重写：清空既有 publications/、entries/、assets/ 与顶层 json，避免遗留陈旧内容。"""
        out_dir.mkdir(parents=True, exist_ok=True)
        for sub in ("publications", "entries", "assets"):
            target = out_dir / sub
            if target.exists():
                for child in target.iterdir():
                    if child.is_dir():
                        import shutil

                        shutil.rmtree(child, ignore_errors=True)
                    else:
                        child.unlink(missing_ok=True)
        for top in ("index.json", "publications.json"):
            (out_dir / top).unlink(missing_ok=True)

    @staticmethod
    def _write_json(path: Path, payload: Any, result: WikiExportResult) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(payload, default=_json_default, ensure_ascii=False),
            encoding="utf-8",
        )
        result.files.append(str(path))


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _json_default(obj: Any) -> Any:
    """JSON 编码兜底：UUID / datetime / set。"""
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, set):
        return sorted(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
