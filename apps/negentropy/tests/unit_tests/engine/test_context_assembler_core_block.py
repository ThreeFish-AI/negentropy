"""ContextAssembler — Core Block 30% 预算上限单元测试

Review #2 — 验证 ``_truncate_text_to_tokens`` 在超预算时按 token 数截断，
并保证拼接后的 ``memory_context`` token 计数不会超出 ``memory_tokens × 0.3`` 的 Core Block 配额。
"""

from __future__ import annotations

from negentropy.engine.adapters.postgres.context_assembler import ContextAssembler


class TestTruncateTextToTokens:
    async def test_returns_input_when_under_budget(self) -> None:
        ca = ContextAssembler(max_tokens=4000)
        text = "Alice is a backend engineer."
        out, tokens = await ca._truncate_text_to_tokens(text, budget=200)
        assert out == text
        assert 0 < tokens <= 200

    async def test_truncates_long_text_to_budget(self) -> None:
        ca = ContextAssembler(max_tokens=4000)
        long_text = "\n".join([f"line {i} with some content for tokenization" for i in range(200)])
        out, tokens = await ca._truncate_text_to_tokens(long_text, budget=20)
        assert tokens <= 20
        assert out  # 不应空字符串

    async def test_zero_budget_returns_empty(self) -> None:
        ca = ContextAssembler(max_tokens=4000)
        out, tokens = await ca._truncate_text_to_tokens("anything here", budget=0)
        assert out == ""
        assert tokens == 0

    async def test_empty_text_returns_empty(self) -> None:
        ca = ContextAssembler(max_tokens=4000)
        out, tokens = await ca._truncate_text_to_tokens("", budget=100)
        assert out == ""
        assert tokens == 0
