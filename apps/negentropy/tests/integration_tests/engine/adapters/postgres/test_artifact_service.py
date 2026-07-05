"""PostgresArtifactService 集成测试（需 PostgreSQL 测试库）。

覆盖 ADK ``BaseArtifactService`` 的 7 个抽象方法、版本递增、session/user
作用域、Part 序列化忠实性（bytes / text）。

每测生成唯一 session_id，确保版本断言始终从干净 key 起算（抗 DB 跨运行残留）。
"""

import uuid

import pytest
from google.genai import types

from negentropy.engine.adapters.postgres.artifact_service import PostgresArtifactService


@pytest.fixture
def service():
    return PostgresArtifactService()


@pytest.fixture
def sid():
    """每测唯一 session_id，保证作用域干净。"""
    return f"s-{uuid.uuid4()}"


def _bytes_part(data: bytes, mime: str = "application/octet-stream") -> types.Part:
    return types.Part.from_bytes(data=data, mime_type=mime)


def _text_part(text: str) -> types.Part:
    return types.Part.from_text(text=text)


class TestSaveLoad:
    async def test_save_returns_monotonic_versions(self, service, sid):
        key = dict(app_name="app1", user_id="u1", filename="f.bin", session_id=sid)
        v0 = await service.save_artifact(artifact=_bytes_part(b"a"), **key)
        v1 = await service.save_artifact(artifact=_bytes_part(b"bb"), **key)
        v2 = await service.save_artifact(artifact=_bytes_part(b"ccc"), **key)
        assert (v0, v1, v2) == (0, 1, 2)

    async def test_load_latest_and_specific_version(self, service, sid):
        key = dict(app_name="app1", user_id="u1", filename="ver.bin", session_id=sid)
        await service.save_artifact(artifact=_bytes_part(b"v0"), **key)
        await service.save_artifact(artifact=_bytes_part(b"v1"), **key)

        latest = await service.load_artifact(**key)
        assert latest.inline_data.data == b"v1"

        v0 = await service.load_artifact(version=0, **key)
        assert v0.inline_data.data == b"v0"

    async def test_load_missing_returns_none(self, service, sid):
        result = await service.load_artifact(app_name="app1", user_id="u1", filename="nope.bin", session_id=sid)
        assert result is None

    async def test_text_part_roundtrip(self, service, sid):
        key = dict(app_name="app1", user_id="u1", filename="note.txt", session_id=sid)
        await service.save_artifact(artifact=_text_part("你好，世界"), **key)
        loaded = await service.load_artifact(**key)
        assert loaded.text == "你好，世界"

    async def test_custom_metadata_persisted(self, service, sid):
        await service.save_artifact(
            app_name="app1",
            user_id="u1",
            filename="meta.bin",
            session_id=sid,
            artifact=_bytes_part(b"x"),
            custom_metadata={"kind": "report", "n": 3},
        )
        versions = await service.list_artifact_versions(
            app_name="app1", user_id="u1", filename="meta.bin", session_id=sid
        )
        assert versions[0].custom_metadata == {"kind": "report", "n": 3}


class TestScope:
    async def test_user_scope_isolated_from_session_scope(self, service, sid):
        # user-scoped (session_id=None)
        await service.save_artifact(app_name="app1", user_id="u1", filename="shared.bin", artifact=_bytes_part(b"user"))
        # session-scoped
        await service.save_artifact(
            app_name="app1", user_id="u1", filename="shared.bin", artifact=_bytes_part(b"session"), session_id=sid
        )

        user_part = await service.load_artifact(app_name="app1", user_id="u1", filename="shared.bin")
        sess_part = await service.load_artifact(app_name="app1", user_id="u1", filename="shared.bin", session_id=sid)
        assert user_part.inline_data.data == b"user"
        assert sess_part.inline_data.data == b"session"

    async def test_user_scope_versions_independent(self, service, sid):
        # user-scoped 制品版本独立计数（session_id=None）
        await service.save_artifact(app_name="app1", user_id=f"uu-{sid}", filename="u.bin", artifact=_bytes_part(b"a"))
        v = await service.save_artifact(
            app_name="app1", user_id=f"uu-{sid}", filename="u.bin", artifact=_bytes_part(b"b")
        )
        assert v == 1
        versions = await service.list_versions(app_name="app1", user_id=f"uu-{sid}", filename="u.bin")
        assert versions == [0, 1]


class TestListDelete:
    async def test_list_artifact_keys(self, service, sid):
        for fn in ("a.bin", "b.bin", "c.bin"):
            await service.save_artifact(
                app_name="app2", user_id="u2", filename=fn, artifact=_bytes_part(b"x"), session_id=sid
            )
        keys = await service.list_artifact_keys(app_name="app2", user_id="u2", session_id=sid)
        assert set(keys) == {"a.bin", "b.bin", "c.bin"}

    async def test_list_versions(self, service, sid):
        key = dict(app_name="app3", user_id="u3", filename="lv.bin", session_id=sid)
        for i in range(3):
            await service.save_artifact(artifact=_bytes_part(str(i).encode()), **key)
        assert await service.list_versions(**key) == [0, 1, 2]

    async def test_get_artifact_version_metadata(self, service, sid):
        await service.save_artifact(
            app_name="app4",
            user_id="u4",
            filename="gv.bin",
            session_id=sid,
            artifact=_bytes_part(b"data", "image/png"),
            custom_metadata={"t": 1},
        )
        v = await service.get_artifact_version(app_name="app4", user_id="u4", filename="gv.bin", session_id=sid)
        assert v is not None
        assert v.version == 0
        assert v.mime_type == "image/png"
        assert v.custom_metadata == {"t": 1}
        assert v.canonical_uri.startswith(f"pgartifact://apps/app4/users/u4/sessions/{sid}/")

    async def test_get_artifact_version_missing(self, service, sid):
        v = await service.get_artifact_version(app_name="app4", user_id="u4", filename="missing", session_id=sid)
        assert v is None

    async def test_delete_removes_all_versions(self, service, sid):
        key = dict(app_name="app5", user_id="u5", filename="del.bin", session_id=sid)
        await service.save_artifact(artifact=_bytes_part(b"a"), **key)
        await service.save_artifact(artifact=_bytes_part(b"b"), **key)
        assert await service.list_versions(**key) == [0, 1]

        await service.delete_artifact(**key)
        assert await service.list_versions(**key) == []
        assert await service.load_artifact(**key) is None


def test_service_lazy_imports_model():
    # 实例化即触发 AdkArtifact 延迟导入；断言模型类已就绪
    svc = PostgresArtifactService()
    assert svc.AdkArtifact.__tablename__ == "adk_artifacts"
