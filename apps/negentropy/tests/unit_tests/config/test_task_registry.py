"""单元测试：task_registry 注册表完整性。"""

from negentropy.config.task_registry import (
    ALL_TASKS,
    get_task,
    is_valid_task_key,
    list_corpus_tasks,
    list_global_tasks,
    to_dict,
)


def test_all_task_keys_unique():
    keys = [slot.task_key for slot in ALL_TASKS]
    assert len(keys) == len(set(keys)), "task_key 必须唯一"


def test_all_tasks_have_valid_scope_and_type():
    for slot in ALL_TASKS:
        assert slot.scope in {"global", "corpus"}
        assert slot.model_type in {"llm", "embedding"}
        assert slot.task_key, f"task_key 不可为空：{slot}"
        assert slot.label, f"label 不可为空：{slot}"
        assert slot.category, f"category 不可为空：{slot}"


def test_corpus_scoped_tasks_present():
    keys = {slot.task_key for slot in list_corpus_tasks()}
    assert "knowledge.kg.extraction.entity" in keys
    assert "knowledge.kg.extraction.relation" in keys
    assert "knowledge.ingestion.extract" in keys


def test_global_scoped_tasks_present():
    keys = {slot.task_key for slot in list_global_tasks()}
    # Memory Consolidation 四项 + Session 标题
    assert "consolidation.fact_extract" in keys
    assert "consolidation.summarize" in keys
    assert "consolidation.reflection" in keys
    assert "consolidation.entity_normalization" in keys
    assert "session.title" in keys


def test_get_task_returns_slot_or_none():
    assert get_task("session.title") is not None
    assert get_task("nonexistent.task_key") is None


def test_is_valid_task_key():
    assert is_valid_task_key("session.title") is True
    assert is_valid_task_key("nonexistent") is False


def test_to_dict_shape():
    slot = get_task("session.title")
    assert slot is not None
    d = to_dict(slot)
    assert set(d.keys()) >= {"task_key", "model_type", "scope", "label", "category", "description"}
    assert d["task_key"] == "session.title"
