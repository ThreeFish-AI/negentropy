"""T3 — F4 PII 写入接线 + 检索守门员集成测试（真实 PostgreSQL）。

验证修复 ISSUE-099：写入路径改经 ``detect_pii_for_storage``（工厂引擎）落
``metadata.pii_flags`` + ``metadata.pii_spans``；检索路径经 ``PIIGatekeeper``
按 viewer_role 遮蔽。

覆盖：
1. 写入：含 email/phone 的记忆 → metadata 经工厂路径产出 flags + spans。
2. 守门员开启 + 低权限：content 被 anonymize（出现 <EMAIL>/<PHONE> 占位）。
3. 守门员开启 + 高权限（editor/admin）：content 原样透传。
4. 守门员关闭：原样透传（默认安全）。
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.config._base import reset_sections, set_yaml_section
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService
from negentropy.engine.governance.pii.factory import reset_pii_detector
from negentropy.models.internalization import Memory

_PII_CONTENT = "Contact me at john.doe@example.com or call 13800138000 anytime"


async def _embedding_fn(text: str) -> list[float]:
    return [0.15] * 1536


async def _seed_thread(thread_id: uuid.UUID, app_name: str, user_id: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        db.add(Thread(id=thread_id, app_name=app_name, user_id=user_id, state={}))
        await db.commit()


async def _cleanup(user_id: str, app_name: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Memory).where(Memory.user_id == user_id, Memory.app_name == app_name))
        await db.commit()


def _invalidate_memory_settings_cache() -> None:
    """settings.memory 是 @cached_property，需手动失效后才会重读新设的 YAML 段。"""
    from negentropy.config import settings as global_settings

    global_settings.__dict__.pop("memory", None)


@pytest.fixture(autouse=True)
def _reset_pii():
    """每个用例前后重置 PII 引擎单例 + YAML 段 + settings 缓存，避免跨用例污染。"""
    reset_pii_detector()
    reset_sections()
    _invalidate_memory_settings_cache()
    yield
    reset_pii_detector()
    reset_sections()
    _invalidate_memory_settings_cache()


def _set_pii_yaml(**pii_overrides):
    base = {"engine": "regex", "policy": "mark", "gatekeeper_enabled": False, "acl_role_threshold": "editor"}
    base.update(pii_overrides)
    set_yaml_section("memory", {"pii": base})
    _invalidate_memory_settings_cache()


@pytest.mark.asyncio
async def test_write_path_produces_pii_flags_and_spans():
    """写入含 PII 记忆 → metadata 经工厂路径产出 flags + spans。"""
    _set_pii_yaml(engine="regex")
    app_name = "t3_pii_write"
    user_id = f"pii_write_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    res = await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content=_PII_CONTENT,
        memory_type="semantic",
    )
    mid = uuid.UUID(res["id"])

    async with db_session.AsyncSessionLocal() as db:
        m = await db.get(Memory, mid)
        meta = m.metadata_ or {}

    assert meta.get("pii_flags"), "应落 pii_flags"
    assert meta["pii_flags"].get("email") == 1
    assert meta["pii_flags"].get("phone") == 1
    spans = meta.get("pii_spans")
    assert spans and len(spans) >= 2, "应落 pii_spans（供检索遮蔽）"
    types = {s["type"] for s in spans}
    assert {"email", "phone"} <= types
    # spans 字段完整性（PIIGatekeeper 依赖 start/end/text）
    for s in spans:
        assert {"type", "start", "end", "text"} <= set(s.keys())

    await _cleanup(user_id, app_name)


@pytest.mark.asyncio
async def test_gatekeeper_anonymizes_for_low_priv_role():
    """守门员开启 + viewer（低权限）→ content 被 anonymize。"""
    _set_pii_yaml(engine="regex", gatekeeper_enabled=True, acl_role_threshold="editor", policy="anonymize")
    app_name = "t3_pii_gk_low"
    user_id = f"pii_gk_low_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content=_PII_CONTENT,
        memory_type="semantic",
    )

    resp = await service.search_memory(
        app_name=app_name, user_id=user_id, query="contact email phone", viewer_role="viewer"
    )
    assert resp.memories, "应有检索结果"
    texts = [m.content.parts[0].text for m in resp.memories]
    joined = " ".join(texts)
    # 原始 PII 应被占位符替换
    assert "john.doe@example.com" not in joined, "email 原文不应泄露给低权限角色"
    assert "13800138000" not in joined, "phone 原文不应泄露给低权限角色"
    assert "<EMAIL>" in joined or "<PHONE>" in joined, "应出现 anonymize 占位符"
    # metadata 标记 pii_redacted
    assert any((getattr(m, "custom_metadata", None) or {}).get("pii_redacted") for m in resp.memories)

    await _cleanup(user_id, app_name)


@pytest.mark.asyncio
async def test_gatekeeper_passthrough_for_high_priv_role():
    """守门员开启 + admin（高权限）→ content 原样透传。"""
    _set_pii_yaml(engine="regex", gatekeeper_enabled=True, acl_role_threshold="editor", policy="anonymize")
    app_name = "t3_pii_gk_high"
    user_id = f"pii_gk_high_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content=_PII_CONTENT,
        memory_type="semantic",
    )

    resp = await service.search_memory(
        app_name=app_name, user_id=user_id, query="contact email phone", viewer_role="admin"
    )
    assert resp.memories
    joined = " ".join(m.content.parts[0].text for m in resp.memories)
    assert "john.doe@example.com" in joined, "高权限角色应看到原文"

    await _cleanup(user_id, app_name)


@pytest.mark.asyncio
async def test_gatekeeper_disabled_passthrough():
    """守门员关闭（默认）→ 即使低权限也原样透传。"""
    _set_pii_yaml(engine="regex", gatekeeper_enabled=False)
    app_name = "t3_pii_gk_off"
    user_id = f"pii_gk_off_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content=_PII_CONTENT,
        memory_type="semantic",
    )

    resp = await service.search_memory(
        app_name=app_name, user_id=user_id, query="contact email phone", viewer_role="viewer"
    )
    assert resp.memories
    joined = " ".join(m.content.parts[0].text for m in resp.memories)
    assert "john.doe@example.com" in joined, "守门员关闭时应原样透传"

    await _cleanup(user_id, app_name)


# ---------------------------------------------------------------------------
# Presidio 引擎专项（默认引擎）+ 缺模型降级安全网
# ---------------------------------------------------------------------------


def _presidio_available() -> bool:
    import importlib.util

    return all(importlib.util.find_spec(m) is not None for m in ("presidio_analyzer", "en_core_web_lg"))


@pytest.mark.skipif(not _presidio_available(), reason="presidio / en_core_web_lg 未安装")
@pytest.mark.asyncio
async def test_presidio_engine_detects_person_ner():
    """engine=presidio 提供 regex 无法识别的 PERSON NER（证明引擎翻转带来新能力）。"""
    from negentropy.engine.governance.pii import get_pii_detector

    _set_pii_yaml(engine="presidio")
    detector = get_pii_detector()
    assert detector.name == "presidio", "默认应解析为 presidio 引擎"

    spans = detector.detect("My name is John Smith and I work at OpenAI")
    types = {s.pii_type for s in spans}
    assert "person" in types, f"presidio 应识别 PERSON；实际类型 {types}"


def _zh_model_available() -> bool:
    import importlib.util

    return importlib.util.find_spec("zh_core_web_sm") is not None


@pytest.mark.skipif(
    not (_presidio_available() and _zh_model_available()),
    reason="presidio / zh_core_web_sm 未安装",
)
def test_presidio_detects_cn_mobile_via_zh_nlp_engine():
    """zh NLP 引擎正确装配后，CN_MOBILE 自定义识别器对中文手机号生效（ISSUE-101）。"""
    from negentropy.engine.governance.pii.presidio_detector import PresidioPIIDetector

    d = PresidioPIIDetector(languages=["en", "zh"], score_threshold=0.5)
    assert "zh" in d._languages, "zh 模型存在时应纳入可用语言"
    spans = d.detect("张三的手机号是 13912345678")
    types = {s.pii_type for s in spans}
    assert "phone" in types, f"应经 CN_MOBILE 识别中国手机号；实际 {types}"


@pytest.mark.asyncio
async def test_pii_factory_falls_back_to_regex_when_presidio_unavailable(monkeypatch):
    """allow_engine_fallback=true + presidio 初始化失败 → 降级 regex，不抛错（开箱安全网）。"""
    import negentropy.engine.governance.pii.factory as factory_mod

    _set_pii_yaml(engine="presidio", allow_engine_fallback=True)
    factory_mod.reset_pii_detector()

    # 模拟 presidio 初始化失败（如 spaCy 模型缺失）
    def _boom(*args, **kwargs):
        raise RuntimeError("simulated spaCy model missing")

    monkeypatch.setattr(
        "negentropy.engine.governance.pii.presidio_detector.PresidioPIIDetector.__init__",
        _boom,
    )
    detector = factory_mod.get_pii_detector()
    assert detector.name == "regex", "缺模型 + allow_engine_fallback=true 应降级 regex 而非抛错"
    factory_mod.reset_pii_detector()


@pytest.mark.asyncio
async def test_pii_factory_raises_when_fallback_disabled(monkeypatch):
    """allow_engine_fallback=false + presidio 失败 → 抛 PIIEngineUnavailableError（保密性优先）。"""
    import negentropy.engine.governance.pii.factory as factory_mod
    from negentropy.engine.governance.pii.factory import PIIEngineUnavailableError

    _set_pii_yaml(engine="presidio", allow_engine_fallback=False)
    factory_mod.reset_pii_detector()

    def _boom(*args, **kwargs):
        raise RuntimeError("simulated spaCy model missing")

    monkeypatch.setattr(
        "negentropy.engine.governance.pii.presidio_detector.PresidioPIIDetector.__init__",
        _boom,
    )
    with pytest.raises(PIIEngineUnavailableError):
        factory_mod.get_pii_detector()
    factory_mod.reset_pii_detector()
