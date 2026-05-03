"""
PostgresMemoryService 巩固管线静态辅助方法单元测试

覆盖方法：
- _extract_speaker_turns
- _group_turns_into_segments
- _format_segment_content
- _parse_thread_id
- _calculate_initial_retention
- _tag_search_level

不连真实 DB。
"""

from __future__ import annotations

import uuid

from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService

# ---------------------------------------------------------------------------
# _extract_speaker_turns
# ---------------------------------------------------------------------------


class TestExtractSpeakerTurns:
    """测试 _extract_speaker_turns 静态方法。"""

    @staticmethod
    def _make_event(author: str, content, *, has_parts: bool = True):
        """构造一个模拟的 ADK Event 对象。

        Args:
            author: "user" | "model" | "assistant"
            content: 字符串或 dict；has_parts=True 时用 parts 风格
        """
        event = type("Event", (), {})()
        event.author = author

        if isinstance(content, str):
            if has_parts:
                part = type("Part", (), {"text": content})()
                event.content = type("Content", (), {"parts": [part]})()
            else:
                event.content = content
        elif isinstance(content, dict):
            event.content = content
        else:
            event.content = content
        return event

    def test_extracts_user_and_model_turns_correctly(self) -> None:
        """正常提取 user 和 model 的对话轮次。"""
        events = [
            self._make_event("user", "你好"),
            self._make_event("model", "你好！有什么可以帮助你的？"),
            self._make_event("user", "帮我部署服务"),
        ]
        turns = PostgresMemoryService._extract_speaker_turns(events)
        assert len(turns) == 3
        assert turns[0] == {"author": "user", "text": "你好"}
        assert turns[1] == {"author": "model", "text": "你好！有什么可以帮助你的？"}
        assert turns[2] == {"author": "user", "text": "帮我部署服务"}

    def test_skips_turns_without_content(self) -> None:
        """没有 content 属性或 content 为空的 Event 应被跳过。"""
        # 无 content 属性
        event_no_content = type("Event", (), {"author": "user"})()
        # content 为空 parts
        event_empty_parts = self._make_event("model", "")
        turns = PostgresMemoryService._extract_speaker_turns([event_no_content, event_empty_parts])
        assert turns == []

    def test_skips_non_user_model_authors(self) -> None:
        """author 不在 (user, model, assistant) 中的 Event 应被跳过。"""
        event_system = type("Event", (), {"author": "system", "content": "sys msg"})()
        event_tool = type("Event", (), {"author": "tool", "content": "tool msg"})()
        turns = PostgresMemoryService._extract_speaker_turns([event_system, event_tool])
        assert turns == []

    def test_handles_dict_style_content(self) -> None:
        """content 为 dict 风格（如 {"parts": [{"text": "..."}]}）时应正确提取。"""
        event = self._make_event(
            "user",
            {"parts": [{"text": "dict style content"}]},
            has_parts=False,
        )
        turns = PostgresMemoryService._extract_speaker_turns([event])
        assert len(turns) == 1
        assert turns[0]["text"] == "dict style content"

    def test_handles_string_content(self) -> None:
        """content 为纯字符串时应正确提取。"""
        event = type("Event", (), {"author": "model", "content": "plain string content"})()
        turns = PostgresMemoryService._extract_speaker_turns([event])
        assert len(turns) == 1
        assert turns[0]["text"] == "plain string content"

    def test_returns_empty_for_empty_events(self) -> None:
        """空 Event 列表应返回空列表。"""
        assert PostgresMemoryService._extract_speaker_turns([]) == []

    def test_strips_whitespace(self) -> None:
        """提取的文本应去除首尾空白。"""
        event = type("Event", (), {"author": "user", "content": "  hello  "})()
        turns = PostgresMemoryService._extract_speaker_turns([event])
        assert turns[0]["text"] == "hello"

    def test_skips_whitespace_only_text(self) -> None:
        """纯空白文本的 part 应被跳过。"""
        event = type("Event", (), {"author": "user", "content": "   "})()
        turns = PostgresMemoryService._extract_speaker_turns([event])
        assert turns == []

    def test_assistant_author_treated_as_model(self) -> None:
        """author 为 'assistant' 的 Event 应与 'model' 一样被提取。"""
        event = type("Event", (), {"author": "assistant", "content": "assistant reply"})()
        turns = PostgresMemoryService._extract_speaker_turns([event])
        assert len(turns) == 1
        assert turns[0]["author"] == "assistant"


# ---------------------------------------------------------------------------
# _group_turns_into_segments
# ---------------------------------------------------------------------------


class TestGroupTurnsIntoSegments:
    """测试 _group_turns_into_segments 静态方法。"""

    def test_groups_by_five_turns(self) -> None:
        """每段最多包含 5 个 turns（对齐 _MAX_TURN_PAIRS_PER_SEGMENT）。"""
        turns = [{"author": "user", "text": f"turn {i}"} for i in range(12)]
        segments = PostgresMemoryService._group_turns_into_segments(turns)
        assert len(segments) == 3
        assert len(segments[0]) == 5
        assert len(segments[1]) == 5
        assert len(segments[2]) == 2

    def test_single_turn_produces_single_segment(self) -> None:
        """单个 turn 应产生单个只含一个 turn 的段。"""
        turns = [{"author": "user", "text": "hello"}]
        segments = PostgresMemoryService._group_turns_into_segments(turns)
        assert len(segments) == 1
        assert len(segments[0]) == 1

    def test_exactly_five_turns_produces_one_segment(self) -> None:
        """恰好 5 个 turns 应产生一个段。"""
        turns = [{"author": "user", "text": f"turn {i}"} for i in range(5)]
        segments = PostgresMemoryService._group_turns_into_segments(turns)
        assert len(segments) == 1
        assert len(segments[0]) == 5

    def test_empty_turns_produces_empty_list(self) -> None:
        """空 turns 列表应返回空列表。"""
        assert PostgresMemoryService._group_turns_into_segments([]) == []


# ---------------------------------------------------------------------------
# _format_segment_content
# ---------------------------------------------------------------------------


class TestFormatSegmentContent:
    """测试 _format_segment_content 静态方法。"""

    def test_formats_user_turns_with_prefix(self) -> None:
        """user 轮次应以 [User] 前缀格式化。"""
        segment = [{"author": "user", "text": "你好"}]
        content = PostgresMemoryService._format_segment_content(segment)
        assert content == "[User] 你好"

    def test_formats_model_turns_with_assistant_prefix(self) -> None:
        """model 轮次应以 [Assistant] 前缀格式化。"""
        segment = [{"author": "model", "text": "好的"}]
        content = PostgresMemoryService._format_segment_content(segment)
        assert content == "[Assistant] 好的"

    def test_multiple_turns_produce_multiline(self) -> None:
        """多个轮次应产生多行文本。"""
        segment = [
            {"author": "user", "text": "问题"},
            {"author": "model", "text": "回答"},
            {"author": "user", "text": "追问"},
        ]
        content = PostgresMemoryService._format_segment_content(segment)
        lines = content.split("\n")
        assert len(lines) == 3
        assert lines[0] == "[User] 问题"
        assert lines[1] == "[Assistant] 回答"
        assert lines[2] == "[User] 追问"

    def test_assistant_author_formatted_as_assistant(self) -> None:
        """author 为 'assistant' 时也应格式化为 [Assistant]。"""
        segment = [{"author": "assistant", "text": "auto reply"}]
        content = PostgresMemoryService._format_segment_content(segment)
        assert content == "[Assistant] auto reply"


# ---------------------------------------------------------------------------
# _parse_thread_id
# ---------------------------------------------------------------------------


class TestParseThreadId:
    """测试 _parse_thread_id 静态方法。"""

    def test_valid_uuid_string_parses_correctly(self) -> None:
        """合法 UUID 字符串应正确解析。"""
        uid = "550e8400-e29b-41d4-a716-446655440000"
        result = PostgresMemoryService._parse_thread_id(uid)
        assert result == uuid.UUID(uid)

    def test_none_returns_none(self) -> None:
        """None 输入应返回 None。"""
        assert PostgresMemoryService._parse_thread_id(None) is None

    def test_empty_string_returns_none(self) -> None:
        """空字符串应返回 None。"""
        assert PostgresMemoryService._parse_thread_id("") is None

    def test_invalid_uuid_returns_none(self) -> None:
        """非法 UUID 字符串应返回 None。"""
        assert PostgresMemoryService._parse_thread_id("not-a-uuid") is None

    def test_uuid_without_dashes_parses(self) -> None:
        """无连字符的 UUID 也应正确解析。"""
        uid = "550e8400e29b41d4a716446655440000"
        result = PostgresMemoryService._parse_thread_id(uid)
        assert result == uuid.UUID(uid)


# ---------------------------------------------------------------------------
# _calculate_initial_retention
# ---------------------------------------------------------------------------


class TestCalculateInitialRetention:
    """测试 _calculate_initial_retention 静态方法。"""

    def test_empty_content_returns_default(self) -> None:
        """空内容应返回默认值 0.5。"""
        score = PostgresMemoryService._calculate_initial_retention("")
        assert score == 0.5

    def test_whitespace_only_content_returns_default(self) -> None:
        """纯空白内容也应返回默认值。"""
        score = PostgresMemoryService._calculate_initial_retention("   ")
        assert score == 0.5

    def test_longer_content_gets_higher_score(self) -> None:
        """更长的内容应获得更高的保留分数。"""
        short = PostgresMemoryService._calculate_initial_retention("short text")
        long = PostgresMemoryService._calculate_initial_retention(
            "this is a much longer content with many more words to test the length factor "
            "and it should produce a higher retention score than the short one"
        )
        assert long >= short

    def test_different_memory_types_affect_score(self) -> None:
        """不同记忆类型应产生不同的保留分数（类型乘子单调递减）。"""
        # 使用较短内容避免分数被 clamp 到 1.0 后无法区分
        content = "short text"
        scores = {
            mt: PostgresMemoryService._calculate_initial_retention(content, memory_type=mt)
            for mt in ("core", "semantic", "preference", "procedural", "fact", "episodic")
        }
        # 类型乘子单调递减: core(1.5) > semantic(1.4) > ... > episodic(1.0)
        assert scores["core"] >= scores["semantic"]
        assert scores["semantic"] >= scores["preference"]
        assert scores["preference"] >= scores["procedural"]
        assert scores["procedural"] >= scores["fact"]
        assert scores["fact"] >= scores["episodic"]
        # 首尾差距应明显
        assert scores["core"] > scores["episodic"]

    def test_has_facts_boosts_score(self) -> None:
        """has_facts=True 应提升保留分数。"""
        content = "content with potential facts"
        without_facts = PostgresMemoryService._calculate_initial_retention(content, has_facts=False)
        with_facts = PostgresMemoryService._calculate_initial_retention(content, has_facts=True)
        assert with_facts > without_facts
        assert abs(with_facts - without_facts - 0.1) < 0.01

    def test_score_clamped_to_one(self) -> None:
        """分数不应超过 1.0。"""
        # core 类型 + has_facts + 长内容 → 尝试推到上限以上
        content = " ".join(f"word{i}" for i in range(100))
        score = PostgresMemoryService._calculate_initial_retention(content, memory_type="core", has_facts=True)
        assert score <= 1.0

    def test_score_non_negative(self) -> None:
        """分数不应小于 0。"""
        score = PostgresMemoryService._calculate_initial_retention("x")
        assert score >= 0.0


# ---------------------------------------------------------------------------
# _tag_search_level
# ---------------------------------------------------------------------------


class TestTagSearchLevel:
    """测试 _tag_search_level 静态方法。"""

    def test_tags_all_results_with_level_and_score_type(self) -> None:
        """所有结果都应被标记 search_level 和 score_type。"""
        results = [
            {"id": "1", "relevance_score": 0.9},
            {"id": "2", "relevance_score": 0.7},
        ]
        tagged = PostgresMemoryService._tag_search_level(results, "hybrid", "combined")
        assert all(r["search_level"] == "hybrid" for r in tagged)
        assert all(r["score_type"] == "combined" for r in tagged)

    def test_preserves_raw_score(self) -> None:
        """raw_score 应保存原始 relevance_score。"""
        results = [{"id": "1", "relevance_score": 0.85}]
        tagged = PostgresMemoryService._tag_search_level(results, "vector", "cosine_distance")
        assert tagged[0]["raw_score"] == 0.85

    def test_handles_empty_results(self) -> None:
        """空结果列表应返回空列表。"""
        assert PostgresMemoryService._tag_search_level([], "keyword", "ts_rank") == []

    def test_tag_does_not_mutate_relevance_score(self) -> None:
        """标记操作不应修改原始 relevance_score。"""
        results = [{"id": "1", "relevance_score": 0.42}]
        tagged = PostgresMemoryService._tag_search_level(results, "ilike", "retention_proxy")
        assert tagged[0]["relevance_score"] == 0.42

    def test_raw_score_defaults_to_zero_when_missing(self) -> None:
        """没有 relevance_score 的结果，raw_score 应默认为 0.0。"""
        results = [{"id": "1"}]
        tagged = PostgresMemoryService._tag_search_level(results, "hybrid", "combined")
        assert tagged[0]["raw_score"] == 0.0
