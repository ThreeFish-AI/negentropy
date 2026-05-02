"""Query Intent Classifier 单元测试

覆盖 ``classify()`` 在 6 种典型 query 上的判定。
"""

from __future__ import annotations

from negentropy.engine.utils.query_intent import IntentResult, classify


class TestQueryIntentClassifier:
    def test_empty_query_falls_back_to_episodic(self) -> None:
        result = classify("")
        assert isinstance(result, IntentResult)
        assert result.primary == "episodic"
        assert result.confidence == 0.0

    def test_none_query_falls_back_to_episodic(self) -> None:
        result = classify(None)
        assert result.primary == "episodic"
        assert result.confidence == 0.0

    def test_how_to_triggers_procedural(self) -> None:
        for q in ["how to deploy", "步骤是什么", "how do I configure", "教程在哪"]:
            r = classify(q)
            assert r.primary == "procedural", q
            assert r.confidence >= 0.5

    def test_when_yesterday_triggers_episodic(self) -> None:
        r = classify("when did I last meet John")
        assert r.primary == "episodic"
        r2 = classify("昨天那次会议讨论了什么")
        assert r2.primary == "episodic"

    def test_what_is_triggers_semantic(self) -> None:
        r = classify("what is Raft consensus")
        assert r.primary == "semantic"
        r2 = classify("Postgres 索引的定义")
        assert r2.primary == "semantic"

    def test_prefer_triggers_preference(self) -> None:
        r = classify("does the user prefer dark mode")
        assert r.primary == "preference"
        r2 = classify("我喜欢什么咖啡")
        assert r2.primary == "preference"

    def test_unrelated_query_default_episodic(self) -> None:
        r = classify("random text without keywords")
        assert r.primary == "episodic"
        assert r.confidence < 0.5  # low confidence fallback

    def test_boost_types_are_distinct(self) -> None:
        r = classify("how to ship this feature")
        assert r.primary not in r.boost_types
        assert len(r.boost_types) >= 1
