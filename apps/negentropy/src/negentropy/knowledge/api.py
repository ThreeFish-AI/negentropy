"""Knowledge API router aggregator.

All route definitions live in ``knowledge/routes/``; this module
re-exports the composed router for ``bootstrap.py`` to include.
"""

from fastapi import APIRouter, Depends
from fastapi.dependencies.utils import get_parameterless_sub_dependant
from fastapi.routing import APIRoute

from negentropy.auth.deps import require_knowledge_write

from .routes import (
    admin,
    catalog,
    chunks,
    corpus,
    documents,
    graph,
    graph_progress,
    ingest,
    library,
    pipelines,
    provenance,
    search,
    sources,
    unified_search,
    wiki,
    wiki_graph,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

router.include_router(corpus.router)
router.include_router(ingest.router)
# library 先于 documents：/documents/import_* 静态段不被动态路由吞没
router.include_router(library.router)
router.include_router(documents.router)
router.include_router(chunks.router)
router.include_router(sources.router)
router.include_router(search.router)
router.include_router(graph.router)
router.include_router(graph_progress.router)
router.include_router(pipelines.router)
router.include_router(provenance.router)
router.include_router(catalog.router)
router.include_router(wiki.router)
router.include_router(wiki_graph.router)
router.include_router(unified_search.router)
router.include_router(admin.router)

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# 写方法豁免 knowledge:write 守卫的端点（新增须写明理由，由覆盖门测试锁定）。
WRITE_GUARD_EXEMPT: dict[tuple[str, str], str] = {
    ("POST", "/knowledge/base/{corpus_id}/search"): "只读检索（POST 承载查询体）",
    ("POST", "/knowledge/base/{corpus_id}/graph/search"): "只读检索",
    ("POST", "/knowledge/graph/neighbors"): "只读检索",
    ("POST", "/knowledge/graph/path"): "只读检索",
    ("POST", "/knowledge/base/{corpus_id}/graph/multi_hop_reason"): "只读推理检索",
    ("POST", "/knowledge/base/{corpus_id}/graph/global_search"): "只读检索",
    ("POST", "/knowledge/unified/search"): "只读检索",
    ("POST", "/knowledge/unified/feedback"): "检索反馈信号，普通用户可写",
    ("POST", "/knowledge/wiki/entries/{entry_id}/view"): "公开阅读计数",
    ("POST", "/knowledge/wiki/entries/{entry_id}/comments"): "端点自带 get_current_user，普通用户可评论",
    ("PATCH", "/knowledge/wiki/entries/{entry_id}/comments/{comment_id}"): "端点自带 get_current_user",
    ("DELETE", "/knowledge/wiki/entries/{entry_id}/comments/{comment_id}"): "端点自带 get_current_user",
    ("POST", "/knowledge/wiki/entries/{entry_id}/annotations"): "端点自带 get_current_user",
    ("PATCH", "/knowledge/wiki/entries/{entry_id}/annotations/{annotation_id}"): "端点自带 get_current_user",
    ("DELETE", "/knowledge/wiki/entries/{entry_id}/annotations/{annotation_id}"): "端点自带 get_current_user",
}


def _guard_write_routes(target: APIRouter) -> None:
    """为全部写端点注入 knowledge:write 守卫（默认拒绝：新增写端点自动受保护）。

    依赖须在 include 之后逐路由追加并重建 dependant——APIRouter 级 ``dependencies=``
    会连读端点一起拦截。
    """
    for route in target.routes:
        if not isinstance(route, APIRoute) or not (route.methods & _WRITE_METHODS):
            continue
        if all((method, route.path) in WRITE_GUARD_EXEMPT for method in route.methods & _WRITE_METHODS):
            continue
        guard = Depends(require_knowledge_write)
        route.dependencies.append(guard)
        route.dependant.dependencies.insert(0, get_parameterless_sub_dependant(depends=guard, path=route.path_format))


_guard_write_routes(router)
