"""Tests for TokenCounter

蜕变测试关系<sup>[[43]](#ref43)</sup>:
- TR1: count_tokens(s) == count_tokens(s)  (幂等性)
- TR2: count_tokens_async(s) == count_tokens(s)  (异步一致性)
- TR3: count_tokens("") == 0  (空输入不变量)
- TR4: len(s1) < len(s2) → count_tokens(s1) <= count_tokens(s2)  (单调性)
"""

from __future__ import annotations

from negentropy.engine.utils.token_counter import TokenCounter


class TestTokenCounter:
    def test_count_tokens_english(self):
        count = TokenCounter.count_tokens("Hello, world!")
        assert count > 0
        assert count < 20

    def test_count_tokens_chinese(self):
        count = TokenCounter.count_tokens("我喜欢用Python编程")
        assert count > 0

    def test_count_tokens_empty_string(self):
        assert TokenCounter.count_tokens("") == 0

    def test_count_tokens_whitespace_only(self):
        count = TokenCounter.count_tokens("   \n\t  ")
        assert count >= 0

    def test_count_tokens_idempotent(self):
        """TR1: 幂等性 — 多次调用结果一致"""
        text = "The quick brown fox jumps over the lazy dog."
        first = TokenCounter.count_tokens(text)
        second = TokenCounter.count_tokens(text)
        assert first == second

    async def test_async_matches_sync(self):
        """TR2: 异步一致性 — async 与 sync 结果相同"""
        text = "This is a test of async token counting mechanism."
        sync_count = TokenCounter.count_tokens(text)
        async_count = await TokenCounter.count_tokens_async(text)
        assert sync_count == async_count

    def test_count_tokens_monotonicity(self):
        """TR4: 单调性 — 更长的文本 token 数不少于更短的"""
        short = "Hello"
        long = "Hello, this is a much longer sentence with more tokens."
        assert TokenCounter.count_tokens(short) <= TokenCounter.count_tokens(long)

    async def test_async_empty_string(self):
        assert await TokenCounter.count_tokens_async("") == 0
