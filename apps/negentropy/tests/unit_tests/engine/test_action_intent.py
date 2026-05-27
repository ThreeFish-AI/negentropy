"""ActionIntentClassifier 单元测试

覆盖 ``classify()`` 在 retrieve / ingest / ambiguous 三态下的判定边界。
"""

from __future__ import annotations

import pytest

from negentropy.engine.utils.action_intent import ActionIntent, classify


class TestActionIntentClassifierBoundary:
    def test_empty_query_falls_back_to_retrieve(self) -> None:
        result = classify("")
        assert isinstance(result, ActionIntent)
        assert result.label == "retrieve"
        assert result.confidence == 0.0
        assert result.matched_keywords == ()

    def test_none_query_falls_back_to_retrieve(self) -> None:
        result = classify(None)
        assert result.label == "retrieve"
        assert result.confidence == 0.0

    def test_whitespace_only_falls_back_to_retrieve(self) -> None:
        result = classify("   \n\t  ")
        assert result.label == "retrieve"
        assert result.confidence == 0.0

    def test_unrelated_greeting_returns_conservative_retrieve(self) -> None:
        """皆未命中关键词 → 保守缺省 retrieve（绝不主动 ingest）。"""
        result = classify("你好，介绍一下自己")
        assert result.label == "retrieve"
        assert result.confidence == 0.3  # 保守缺省 conf
        assert result.matched_keywords == ()


class TestActionIntentClassifierIngest:
    def test_zh_single_keyword_triggers_ingest(self) -> None:
        for query in ["沉淀到 @CorpusA", "把这段保存到知识库", "记一下这条要点"]:
            result = classify(query)
            assert result.label == "ingest", query
            assert result.confidence >= 0.7

    def test_en_single_keyword_triggers_ingest(self) -> None:
        for query in [
            "ingest this paragraph",
            "save to the corpus",
            "store in the knowledge base",
            "add to the corpus please",
        ]:
            result = classify(query)
            assert result.label == "ingest", query
            assert result.confidence >= 0.7

    def test_multi_keyword_boosts_confidence(self) -> None:
        """两个或以上 ingest 关键词命中 → confidence 升到 0.85。"""
        result = classify("沉淀入库这段内容")
        assert result.label == "ingest"
        assert result.confidence == 0.85
        assert len(result.matched_keywords) >= 2

    def test_matched_keywords_lowercased_and_sorted(self) -> None:
        result = classify("Save and INGEST this note")
        assert result.label == "ingest"
        assert all(kw == kw.lower() for kw in result.matched_keywords)
        # 排序断言：matched_keywords 应严格升序
        assert list(result.matched_keywords) == sorted(result.matched_keywords)

    def test_zh_memo_keywords_trigger_ingest(self) -> None:
        for query in ["备忘这条到知识库", "记下来这个 IEEE 引用", "建档这条决策"]:
            result = classify(query)
            assert result.label == "ingest", query


class TestActionIntentClassifierRetrieve:
    def test_zh_query_keywords_trigger_retrieve(self) -> None:
        for query in ["查询 RAG 的核心思想", "搜索 HippoRAG 相关论文", "检索一下知识图谱用法"]:
            result = classify(query)
            assert result.label == "retrieve", query
            assert result.confidence == 0.7

    def test_en_query_keywords_trigger_retrieve(self) -> None:
        for query in ["what is HybridPlanner", "find related papers", "tell me about RAG"]:
            result = classify(query)
            assert result.label == "retrieve", query
            assert result.confidence == 0.7


class TestActionIntentClassifierAmbiguous:
    def test_ingest_and_retrieve_keywords_coexist_returns_ambiguous(self) -> None:
        """同时命中两组关键词 → ambiguous（保守不强制路径）。"""
        for query in [
            "先查一下再决定要不要沉淀",
            "save and then search again",
            "查询 @CorpusA 关于 HippoRAG 内容并沉淀新论文要点",
        ]:
            result = classify(query)
            assert result.label == "ambiguous", query
            assert result.confidence == 0.4
            # 双源关键词都应进入 matched_keywords
            assert len(result.matched_keywords) >= 2


class TestActionIntentClassifierOrthogonal:
    """ActionIntent 与 QueryIntent 维度正交：how-to / what-is 等 query_intent
    关键词不应误触 ingest 分支。
    """

    def test_how_to_query_does_not_trigger_ingest(self) -> None:
        result = classify("How do I deploy this?")
        assert result.label == "retrieve"

    def test_what_is_query_does_not_trigger_ingest(self) -> None:
        result = classify("什么是 GraphRAG")
        assert result.label == "retrieve"

    def test_single_char_noise_returns_conservative_retrieve(self) -> None:
        """单字 / 噪声 query 不应被误判为 ingest。"""
        result = classify("已")
        assert result.label == "retrieve"
        assert result.confidence == 0.3


class TestActionIntentDataclass:
    def test_frozen_dataclass_immutable(self) -> None:
        result = classify("沉淀到 @CorpusA")
        # frozen dataclass 赋值会触发 FrozenInstanceError（继承自 AttributeError）
        with pytest.raises((AttributeError, TypeError)):
            result.label = "retrieve"  # type: ignore[misc]

    def test_matched_keywords_is_tuple(self) -> None:
        """matched_keywords 必须是 tuple（hashable / immutable），避免共享 list 引用导致跨调用污染。"""
        result = classify("沉淀这段")
        assert isinstance(result.matched_keywords, tuple)
