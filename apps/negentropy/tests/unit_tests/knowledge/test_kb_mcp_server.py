"""knowledge/mcp_server 单测 — config entry / token / ASGI bearer 校验 / 工具体契约。

不启动真实 HTTP server，不连数据库：mock settings 与 citation_search 边界。
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import SecretStr

from negentropy.knowledge import mcp_server


@pytest.fixture(autouse=True)
def _reset_singletons():
    mcp_server.reset_kb_mcp_for_tests()
    yield
    mcp_server.reset_kb_mcp_for_tests()


def _mcp_settings(**kw) -> SimpleNamespace:
    base = dict(enabled=True, self_base_url="http://127.0.0.1:3292", auth_token=None, default_top_k=5)
    base.update(kw)
    return SimpleNamespace(**base)


def _patch_settings(mcp_ns: SimpleNamespace):
    return patch.object(
        mcp_server,
        "settings",
        SimpleNamespace(knowledge=SimpleNamespace(mcp=mcp_ns), app_name="negentropy"),
    )


class TestConfigEntry:
    def test_entry_shape_when_available(self):
        with _patch_settings(_mcp_settings()):
            entry = mcp_server.build_kb_mcp_config_entry()
        assert entry is not None
        assert entry["type"] == "http"
        assert entry["url"] == "http://127.0.0.1:3292/mcp/knowledge"
        assert entry["headers"]["Authorization"].startswith("Bearer ")

    def test_entry_none_when_disabled(self):
        with _patch_settings(_mcp_settings(enabled=False)):
            assert mcp_server.build_kb_mcp_config_entry() is None
            assert mcp_server.kb_mcp_available() is False

    def test_entry_none_without_base_url(self):
        with _patch_settings(_mcp_settings(self_base_url=None)):
            assert mcp_server.build_kb_mcp_config_entry() is None
            assert mcp_server.kb_mcp_available() is False

    def test_base_url_trailing_slash_stripped(self):
        with _patch_settings(_mcp_settings(self_base_url="http://127.0.0.1:3292/")):
            entry = mcp_server.build_kb_mcp_config_entry()
        assert entry["url"] == "http://127.0.0.1:3292/mcp/knowledge"


class TestToken:
    def test_random_token_is_process_singleton(self):
        with _patch_settings(_mcp_settings()):
            t1 = mcp_server.get_kb_mcp_token()
            t2 = mcp_server.get_kb_mcp_token()
        assert t1 == t2
        assert len(t1) >= 32

    def test_settings_token_overrides_random(self):
        with _patch_settings(_mcp_settings(auth_token=SecretStr("static-deploy-token"))):
            assert mcp_server.get_kb_mcp_token() == "static-deploy-token"


class TestAsgiBearerGuard:
    async def _call(self, app, headers: list[tuple[bytes, bytes]]) -> int | None:
        """以最小 ASGI 调用驱动 guard；返回响应状态码（透传到内层 app 时返回 None）。"""
        sent: list[dict] = []

        async def send(message):
            sent.append(message)

        scope = {"type": "http", "method": "POST", "path": "/", "headers": headers}
        await app(scope, AsyncMock(), send)
        for msg in sent:
            if msg.get("type") == "http.response.start":
                return msg["status"]
        return None

    @pytest.mark.asyncio
    async def test_rejects_missing_or_wrong_token(self):
        with _patch_settings(_mcp_settings()):
            inner = AsyncMock()
            with patch.object(mcp_server, "get_kb_mcp") as fake_get:
                fake_get.return_value = MagicMock(streamable_http_app=lambda: inner, session_manager=MagicMock())
                app, _ = mcp_server.create_kb_mcp_asgi_app()

            assert await self._call(app, []) == 401
            assert await self._call(app, [(b"authorization", b"Bearer wrong")]) == 401
            inner.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_passes_with_correct_token(self):
        with _patch_settings(_mcp_settings()):
            inner = AsyncMock()
            with patch.object(mcp_server, "get_kb_mcp") as fake_get:
                fake_get.return_value = MagicMock(streamable_http_app=lambda: inner, session_manager=MagicMock())
                app, _ = mcp_server.create_kb_mcp_asgi_app()
            token = mcp_server.get_kb_mcp_token()

            status = await self._call(app, [(b"authorization", f"Bearer {token}".encode())])

        assert status is None  # 透传至内层 app（未由 guard 拦截）
        inner.assert_awaited_once()


class TestKbSearchTool:
    @pytest.mark.asyncio
    async def test_returns_citation_fields(self):
        fake_corpus = MagicMock(id="c-1", name="agent-papers")
        fake_payload = {
            "status": "success",
            "query": "q",
            "count": 1,
            "results": [
                {
                    "id": "k-1",
                    "snippet": "原文片段",
                    "citation_id": 1,
                    "formatted_citation": "[1] Test",
                    "source_uri": "https://x",
                    "corpus_label": "agent-papers",
                }
            ],
            "search_mode": "hybrid",
        }
        with (
            _patch_settings(_mcp_settings()),
            patch(
                "negentropy.knowledge.retrieval.citation_search.resolve_corpus_scope",
                new=AsyncMock(return_value=[fake_corpus]),
            ),
            patch(
                "negentropy.knowledge.retrieval.citation_search.search_kb_with_citations",
                new=AsyncMock(return_value=fake_payload),
            ),
            patch("negentropy.knowledge._shared._get_service", return_value=MagicMock()),
        ):
            result = await mcp_server._kb_search_impl(query="q", top_k=5)

        assert result["count"] == 1
        first = result["results"][0]
        assert first["citation_id"] == 1
        assert first["formatted_citation"] == "[1] Test"
        assert "note" not in result

    @pytest.mark.asyncio
    async def test_zero_results_carry_note(self):
        fake_corpus = MagicMock(id="c-1", name="agent-papers")
        empty_payload = {"status": "success", "query": "q", "count": 0, "results": [], "search_mode": "hybrid"}
        with (
            _patch_settings(_mcp_settings()),
            patch(
                "negentropy.knowledge.retrieval.citation_search.resolve_corpus_scope",
                new=AsyncMock(return_value=[fake_corpus]),
            ),
            patch(
                "negentropy.knowledge.retrieval.citation_search.search_kb_with_citations",
                new=AsyncMock(return_value=empty_payload),
            ),
            patch("negentropy.knowledge._shared._get_service", return_value=MagicMock()),
        ):
            result = await mcp_server._kb_search_impl(query="q")

        assert result["count"] == 0
        assert "严禁虚构来源" in result["note"]

    @pytest.mark.asyncio
    async def test_no_corpora_short_circuits_with_note(self):
        with (
            _patch_settings(_mcp_settings()),
            patch(
                "negentropy.knowledge.retrieval.citation_search.resolve_corpus_scope",
                new=AsyncMock(return_value=[]),
            ),
        ):
            result = await mcp_server._kb_search_impl(query="q")

        assert result["status"] == "success"
        assert result["count"] == 0
        assert "note" in result

    @pytest.mark.asyncio
    async def test_empty_query_rejected(self):
        with _patch_settings(_mcp_settings()):
            result = await mcp_server._kb_search_impl(query="   ")
        assert result["status"] == "failed"


class TestMetaEntry:
    def test_meta_entry_lists_both_tools(self):
        entry = mcp_server.kb_mcp_meta_entry()
        assert entry["name"] == mcp_server.KB_MCP_SERVER_KEY
        tool_names = {t["name"] for t in entry["tools"]}
        assert tool_names == {"kb_search", "kg_search_global"}
