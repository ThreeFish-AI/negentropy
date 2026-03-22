"""Shared Fixture layer for knowledge unit tests.

Centralizes Fake objects (test doubles) that were previously duplicated
across multiple test modules.  Each Fake is a minimal, parameterized
stand-in for a production dependency, designed to be composed in
``pytest`` fixtures or used directly in test bodies.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
from uuid import UUID, uuid4

from negentropy.knowledge.dao import UpsertResult
from negentropy.knowledge.types import KnowledgeMatch, KnowledgeRecord

# ---------------------------------------------------------------------------
# 1. FakeMcpSession
# ---------------------------------------------------------------------------


class FakeMcpSession:
    """Parameterized fake async DB session consumed by ``DataExtractorProvider``.

    Replaces the ~15 inline ``FakeSession`` definitions scattered throughout
    ``test_extraction.py``.

    Parameters
    ----------
    server_id:
        UUID returned by ``get()`` as the MCP server id.
    server_name:
        Name of the simulated MCP server record.
    input_schema:
        The ``input_schema`` dict returned by ``scalar()``.
    description:
        Optional tool description surfaced via ``scalar()``.
    scalar_returns_none:
        When *True*, ``scalar()`` returns ``None`` (simulates tool record
        not found via DB query).
    """

    def __init__(
        self,
        *,
        server_id: UUID,
        server_name: str = "pdf-extractor",
        input_schema: dict | None = None,
        description: str | None = None,
        scalar_returns_none: bool = False,
    ) -> None:
        self.server_id = server_id
        self.server_name = server_name
        self.input_schema = input_schema if input_schema is not None else {"type": "object"}
        self.description = description
        self.scalar_returns_none = scalar_returns_none

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, model, key):  # type: ignore[no-untyped-def]
        _ = (model, key)
        return SimpleNamespace(
            id=self.server_id,
            name=self.server_name,
            is_enabled=True,
            transport_type="http",
            command=None,
            args=[],
            env={},
            url="https://example.com/mcp",
            headers={},
        )

    async def scalar(self, stmt):  # type: ignore[no-untyped-def]
        _ = stmt
        if self.scalar_returns_none:
            return None
        ns_kwargs: dict = {
            "id": uuid4(),
            "is_enabled": True,
            "input_schema": self.input_schema,
            "output_schema": {},
            "call_count": 0,
            "name": "fake-tool",
        }
        if self.description is not None:
            ns_kwargs["description"] = self.description
        return SimpleNamespace(**ns_kwargs)

    def add(self, obj):  # type: ignore[no-untyped-def]
        """No-op: McpToolExecutionService calls db.add(run/event)."""

    async def flush(self):
        """No-op: McpToolExecutionService calls db.flush()."""

    async def commit(self):
        """No-op: McpToolExecutionService calls db.commit()."""

    async def refresh(self, obj):  # type: ignore[no-untyped-def]
        """No-op: McpToolExecutionService calls db.refresh(run)."""


# ---------------------------------------------------------------------------
# 2. FakeStorageService
# ---------------------------------------------------------------------------


class FakeStorageService:
    """Superset fake covering both ``test_api_document_routes`` and
    ``test_pipeline_tracker`` usage patterns.
    """

    def __init__(
        self,
        doc: SimpleNamespace | None = None,
        markdown: str | None = None,
    ) -> None:
        self.doc = doc
        self.markdown = markdown
        self.saved_markdown: str | None = None
        self.saved_markdown_gcs_uri: str | None = None
        self.uploaded_markdown: str | None = None
        self.upload_and_store_calls: list[dict[str, object]] = []

    async def get_document(self, *, document_id, corpus_id=None, app_name=None):
        _ = (document_id, corpus_id, app_name)
        return self.doc

    async def upload_markdown_derivative(self, *, document_id, markdown_content: str):
        _ = document_id
        self.uploaded_markdown = markdown_content
        return "gs://derived/markdown.md"

    async def save_markdown_content(
        self,
        *,
        document_id,
        markdown_content: str,
        markdown_gcs_uri=None,
    ):
        _ = document_id
        self.saved_markdown = markdown_content
        self.saved_markdown_gcs_uri = markdown_gcs_uri
        return True

    async def get_document_markdown(self, document_id):
        _ = document_id
        return self.markdown

    async def get_document_content_by_uri(self, source_uri: str):
        _ = source_uri
        return b"hello world"

    async def upload_and_store(self, **kwargs):
        self.upload_and_store_calls.append(kwargs)
        if self.doc is None:
            self.doc = SimpleNamespace(
                id=uuid4(),
                gcs_uri="gs://negentropy/knowledge/test.pdf",
                markdown_extract_status="pending",
            )
        return self.doc, True


# ---------------------------------------------------------------------------
# 3. FakeKnowledgeService
# ---------------------------------------------------------------------------


class FakeKnowledgeService:
    """Full-featured fake for ``KnowledgeService`` used in API route tests."""

    def __init__(self) -> None:
        self.list_knowledge_calls: list[dict] = []
        self.pipeline_calls: list[dict] = []
        self.search_calls: list[dict] = []
        self.ensure_corpus_calls: list = []
        self.update_corpus_calls: list[dict] = []
        self.ingest_text_calls: list[dict] = []
        self.ingest_file_pipeline_calls: list[dict] = []

    async def list_knowledge(self, **kwargs):
        self.list_knowledge_calls.append(kwargs)
        item = KnowledgeRecord(
            id=uuid4(),
            corpus_id=kwargs["corpus_id"],
            app_name=kwargs["app_name"],
            content="chunk content",
            source_uri=kwargs.get("source_uri"),
            chunk_index=0,
            metadata={"k": "v"},
            created_at=None,
            updated_at=None,
            embedding=None,
        )
        return [item], 1, {}, []

    async def get_corpus_by_id(self, corpus_id):
        _ = corpus_id
        return SimpleNamespace(config={})

    async def create_pipeline(self, **kwargs):
        self.pipeline_calls.append(kwargs)
        return "run-test-001"

    async def ensure_corpus(self, spec):
        self.ensure_corpus_calls.append(spec)
        return SimpleNamespace(
            id=uuid4(),
            app_name=spec.app_name,
            name=spec.name,
            description=spec.description,
            config=spec.config,
        )

    async def update_corpus(self, corpus_id, spec):
        self.update_corpus_calls.append({"corpus_id": corpus_id, "spec": spec})
        return SimpleNamespace(
            id=corpus_id,
            app_name="negentropy",
            name=spec.get("name", "updated-corpus"),
            description=spec.get("description"),
            config=spec.get("config", {}),
        )

    async def execute_replace_source_pipeline(self, **kwargs):
        _ = kwargs

    async def execute_rebuild_source_pipeline(self, **kwargs):
        _ = kwargs

    async def search(self, **kwargs):
        self.search_calls.append(kwargs)
        return [
            KnowledgeMatch(
                id=uuid4(),
                content="search chunk content",
                source_uri="https://example.com/search",
                metadata={
                    "chunk_index": "47",
                    "returned_parent_chunk": True,
                    "parent_chunk_index": "6",
                    "matched_child_chunks": [
                        {
                            "id": "child-13",
                            "child_chunk_index": "13",
                            "content": "child chunk content",
                            "combined_score": 0.42,
                        }
                    ],
                },
                semantic_score=0.0,
                keyword_score=0.42,
                combined_score=0.42,
            )
        ]

    async def ingest_text(self, **kwargs):
        self.ingest_text_calls.append(kwargs)
        return [
            KnowledgeRecord(
                id=uuid4(),
                corpus_id=kwargs["corpus_id"],
                app_name=kwargs["app_name"],
                content="chunk content",
                source_uri=kwargs.get("source_uri"),
                chunk_index=0,
                metadata=kwargs.get("metadata", {}),
                created_at=None,
                updated_at=None,
                embedding=None,
            )
        ]

    async def execute_ingest_file_pipeline(self, **kwargs):
        self.ingest_file_pipeline_calls.append(kwargs)


# ---------------------------------------------------------------------------
# 4. FakePipelineRun & FakePipelineDao
# ---------------------------------------------------------------------------


@dataclass
class FakePipelineRun:
    app_name: str
    run_id: str
    status: str
    payload: dict


class FakePipelineDao:
    def __init__(self) -> None:
        self.records: dict[tuple[str, str], FakePipelineRun] = {}

    async def get_pipeline_run(self, app_name: str, run_id: str):
        return self.records.get((app_name, run_id))

    async def upsert_pipeline_run(
        self,
        *,
        app_name: str,
        run_id: str,
        status: str,
        payload: dict,
        idempotency_key,
        expected_version,
    ):
        _ = (idempotency_key, expected_version)
        record = FakePipelineRun(
            app_name=app_name,
            run_id=run_id,
            status=status,
            payload=payload,
        )
        self.records[(app_name, run_id)] = record
        return UpsertResult(
            status="updated",
            record={
                "run_id": run_id,
                "status": status,
                "payload": payload,
            },
        )


# ---------------------------------------------------------------------------
# 5. FakeScalarSession, FakeDbExecuteResult, FakeDefaultRouteSession
# ---------------------------------------------------------------------------


class FakeScalarSession:
    """Minimal async session whose ``scalar()`` always returns ``0``."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def scalar(self, stmt):
        _ = stmt
        return 0


class FakeDbExecuteResult:
    """Wraps an iterable of rows returned by ``FakeDefaultRouteSession.execute``."""

    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)


class FakeDefaultRouteSession:
    """Async session that pops pre-configured responses on each ``execute`` call."""

    def __init__(self, responses):
        self._responses = list(responses)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, stmt):
        _ = stmt
        return FakeDbExecuteResult(self._responses.pop(0))


# ---------------------------------------------------------------------------
# 6. FakeLogger
# ---------------------------------------------------------------------------


class FakeLogger:
    """Captures ``info`` and ``warning`` log events as ``(event, kwargs)`` tuples."""

    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    def info(self, event: str, **kwargs):
        self.events.append((event, kwargs))

    def warning(self, event: str, **kwargs):
        self.events.append((event, kwargs))


# ---------------------------------------------------------------------------
# 7. Helper async no-ops
# ---------------------------------------------------------------------------


async def noop_increment_tool_call_count(**_):
    """Drop-in replacement for ``_increment_tool_call_count``."""
    return None


async def noop_llm_plan(**_):
    """Drop-in replacement for ``_build_llm_invocation_plan``."""
    return None


# ---------------------------------------------------------------------------
# 8. FakeRepository
# ---------------------------------------------------------------------------


class FakeRepository:
    """Repository stub whose ``delete_knowledge_by_source`` always raises."""

    async def delete_knowledge_by_source(self, *, corpus_id, app_name, source_uri):
        _ = (corpus_id, app_name, source_uri)
        raise RuntimeError("delete failed")
