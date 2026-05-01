"""PatternFactExtractor 单元测试"""

import pytest

from negentropy.engine.consolidation.fact_extractor import (
    PatternFactExtractor,
)


@pytest.fixture
def extractor():
    return PatternFactExtractor()


# ---------------------------------------------------------------------------
# 偏好提取
# ---------------------------------------------------------------------------


class TestPreferenceExtraction:
    def test_chinese_preference_like(self, extractor):
        turns = [{"author": "user", "text": "我最喜欢用 TypeScript 写代码"}]
        facts = extractor.extract(turns)
        assert len(facts) >= 1
        assert facts[0].fact_type == "preference"
        assert "TypeScript" in facts[0].value

    def test_chinese_preference_prefer(self, extractor):
        turns = [{"author": "user", "text": "我偏好简洁的代码风格"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "preference" for f in facts)

    def test_chinese_preference_hope(self, extractor):
        turns = [{"author": "user", "text": "我希望用英文写注释"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "preference" for f in facts)

    def test_english_preference_like(self, extractor):
        turns = [{"author": "user", "text": "I really like dark mode"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "preference" and "dark mode" in f.value.lower() for f in facts)

    def test_english_preference_prefer(self, extractor):
        turns = [{"author": "user", "text": "I prefer vertical layouts"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "preference" for f in facts)

    def test_english_preference_favorite(self, extractor):
        turns = [{"author": "user", "text": "My favorite language is Python"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "preference" for f in facts)


# ---------------------------------------------------------------------------
# 个人信息提取
# ---------------------------------------------------------------------------


class TestProfileExtraction:
    def test_chinese_profile_name(self, extractor):
        turns = [{"author": "user", "text": "我叫张三"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "profile" and "张三" in f.value for f in facts)

    def test_chinese_profile_is(self, extractor):
        turns = [{"author": "user", "text": "我是一名后端工程师"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "profile" for f in facts)

    def test_chinese_profile_possession(self, extractor):
        turns = [{"author": "user", "text": "我的邮箱是 test@example.com"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "profile" for f in facts)

    def test_english_profile_name(self, extractor):
        turns = [{"author": "user", "text": "My name is Alice"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "profile" for f in facts)

    def test_english_profile_job(self, extractor):
        turns = [{"author": "user", "text": "I am a senior developer"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "profile" for f in facts)

    def test_english_profile_work(self, extractor):
        turns = [{"author": "user", "text": "I work at Google"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "profile" for f in facts)


# ---------------------------------------------------------------------------
# 规则指令提取
# ---------------------------------------------------------------------------


class TestRuleExtraction:
    def test_chinese_rule_dont(self, extractor):
        turns = [{"author": "user", "text": "请不要使用 var 声明变量"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "rule" and "var" in f.value for f in facts)

    def test_chinese_rule_always(self, extractor):
        turns = [{"author": "user", "text": "请总是使用 const"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "rule" for f in facts)

    def test_chinese_rule_remember(self, extractor):
        turns = [{"author": "user", "text": "记住要写单元测试"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "rule" for f in facts)

    def test_english_rule_dont(self, extractor):
        turns = [{"author": "user", "text": "Don't use any type"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "rule" for f in facts)

    def test_english_rule_always(self, extractor):
        turns = [{"author": "user", "text": "Always use strict mode"}]
        facts = extractor.extract(turns)
        assert any(f.fact_type == "rule" for f in facts)


# ---------------------------------------------------------------------------
# 通用行为测试
# ---------------------------------------------------------------------------


class TestGeneralBehavior:
    def test_skips_model_turns(self, extractor):
        turns = [
            {"author": "model", "text": "I really like TypeScript"},
            {"author": "user", "text": "Hello"},
        ]
        facts = extractor.extract(turns)
        # "Hello" 不匹配任何模式
        assert len(facts) == 0

    def test_deduplicates_same_key(self, extractor):
        turns = [
            {"author": "user", "text": "我喜欢 TypeScript"},
            {"author": "user", "text": "我喜欢 TypeScript"},
        ]
        facts = extractor.extract(turns)
        # 同一 key 应去重
        preference_keys = [f.key for f in facts if f.fact_type == "preference"]
        assert len(preference_keys) == len(set(preference_keys))

    def test_empty_turns(self, extractor):
        assert extractor.extract([]) == []

    def test_no_user_messages(self, extractor):
        turns = [{"author": "model", "text": "Some response"}]
        assert extractor.extract(turns) == []

    def test_multiple_types_in_conversation(self, extractor):
        turns = [
            {"author": "user", "text": "我叫张三，我是后端工程师"},
            {"author": "model", "text": "你好张三"},
            {"author": "user", "text": "请记住要写测试"},
            {"author": "model", "text": "好的"},
            {"author": "user", "text": "我喜欢用 pytest"},
        ]
        facts = extractor.extract(turns)
        types = {f.fact_type for f in facts}
        assert "profile" in types or "preference" in types or "rule" in types

    def test_min_key_length_filters_noise(self, extractor):
        turns = [{"author": "user", "text": "我偏好 a"}]  # 单字符 key
        facts = extractor.extract(turns)
        for f in facts:
            assert len(f.key) >= 2

    def test_confidence_is_set(self, extractor):
        turns = [{"author": "user", "text": "我喜欢 Python"}]
        facts = extractor.extract(turns)
        for f in facts:
            assert 0.0 < f.confidence <= 1.0
