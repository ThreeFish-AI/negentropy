"""Knowledge API router aggregator.

All route definitions live in ``knowledge/routes/``; this module
re-exports the composed router for ``bootstrap.py`` to include.
"""

from fastapi import APIRouter

from .routes import (
    admin,
    catalog,
    chunks,
    corpus,
    documents,
    graph,
    graph_progress,
    ingest,
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
