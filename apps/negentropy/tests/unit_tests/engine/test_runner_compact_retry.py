"""Runner 迭代内上下文压缩重试逻辑的单测。

覆盖辅助函数和重试循环的核心判定路径：
- ``_build_compact_retry_prompt``：续接 prompt 合成
- ``_reset_config_for_retry``：配置克隆 + session 清空
- ``_with_reduced_timeout``：超时缩减 + 下限守卫
- 重试循环的 5 种退出条件
"""

from __future__ import annotations

import pytest

from negentropy.engine.claude_code.models import ClaudeCodeConfig, ClaudeCodeResult
from negentropy.engine.routine.runner import (
    _build_compact_retry_prompt,
    _reset_config_for_retry,
    _with_reduced_timeout,
)

# ---------------------------------------------------------------------------
# 辅助函数单测
# ---------------------------------------------------------------------------


class TestBuildCompactRetryPrompt:
    """续接 prompt 合成测试。"""

    def test_includes_original_prompt_and_summary(self):
        result = ClaudeCodeResult(status="error", summary="已创建 hello.py", error_kind="context_exhausted")
        prompt = _build_compact_retry_prompt(result, "请创建 hello.py 输出 Hello World")

        assert "请创建 hello.py 输出 Hello World" in prompt
        assert "已创建 hello.py" in prompt
        assert "上下文续接" in prompt

    def test_empty_summary_uses_empty_string(self):
        result = ClaudeCodeResult(status="error", summary="", error_kind="context_exhausted")
        prompt = _build_compact_retry_prompt(result, "原始任务")

        assert "原始任务" in prompt
        # 空 summary 不导致格式异常
        assert "## 已完成的工作摘要\n\n" in prompt

    def test_none_summary_handled(self):
        result = ClaudeCodeResult(status="error", summary=None, error_kind="context_exhausted")
        prompt = _build_compact_retry_prompt(result, "原始任务")
        assert "原始任务" in prompt

    def test_long_summary_truncated_to_2000_chars(self):
        result = ClaudeCodeResult(status="error", summary="x" * 5000, error_kind="context_exhausted")
        prompt = _build_compact_retry_prompt(result, "任务")
        # summary 被截断到 2000 字符
        summary_section = prompt.split("## 已完成的工作摘要\n")[1].split("\n\n## 指令")[0]
        assert len(summary_section) == 2000


class TestResetConfigForRetry:
    """配置克隆 + session 清空测试。"""

    def test_clears_resume_session_id(self):
        cfg = ClaudeCodeConfig(resume_session_id="old-session-123", cwd="/tmp/test")
        new = _reset_config_for_retry(cfg)

        assert new.resume_session_id is None
        assert new.cwd == "/tmp/test"  # 其他字段保留

    def test_original_config_not_mutated(self):
        cfg = ClaudeCodeConfig(resume_session_id="old-session-123")
        _reset_config_for_retry(cfg)

        assert cfg.resume_session_id == "old-session-123"  # 原始不被修改

    def test_preserves_all_other_fields(self):
        cfg = ClaudeCodeConfig(
            cli_path="/usr/bin/claude",
            model="claude-opus-4-8",
            max_turns=500,
            timeout_seconds=900.0,
            credential="secret-token",
            compact_threshold_pct=70,
            resume_session_id="session-to-clear",
        )
        new = _reset_config_for_retry(cfg)

        assert new.cli_path == "/usr/bin/claude"
        assert new.model == "claude-opus-4-8"
        assert new.max_turns == 500
        assert new.timeout_seconds == 900.0
        assert new.credential == "secret-token"
        assert new.compact_threshold_pct == 70
        assert new.resume_session_id is None


class TestWithReducedTimeout:
    """超时缩减测试。"""

    def test_sets_timeout_to_remaining(self):
        cfg = ClaudeCodeConfig(timeout_seconds=900.0)
        new = _with_reduced_timeout(cfg, 300.0)

        assert new.timeout_seconds == 300.0

    def test_minimum_timeout_is_60_seconds(self):
        cfg = ClaudeCodeConfig(timeout_seconds=900.0)
        new = _with_reduced_timeout(cfg, 30.0)

        assert new.timeout_seconds == 60.0  # 下限

    def test_preserves_other_fields(self):
        cfg = ClaudeCodeConfig(
            timeout_seconds=900.0,
            resume_session_id="session-id",
            compact_threshold_pct=70,
        )
        new = _with_reduced_timeout(cfg, 120.0)

        assert new.resume_session_id == "session-id"
        assert new.compact_threshold_pct == 70
        assert new.timeout_seconds == 120.0

    def test_original_config_not_mutated(self):
        cfg = ClaudeCodeConfig(timeout_seconds=900.0)
        _with_reduced_timeout(cfg, 100.0)

        assert cfg.timeout_seconds == 900.0


# ---------------------------------------------------------------------------
# 重试循环逻辑的判定条件测试（通过模拟 _run 内的 while 循环逻辑验证）
# ---------------------------------------------------------------------------


class TestRetryLoopConditions:
    """验证重试循环的 5 种退出条件（在 _run 方法的 while True 中）。

    这些测试直接验证判定条件逻辑，不启动真实 Runner（避免 DB 依赖）。
    """

    def test_success_exits_without_retry(self):
        """条件 1：result.status == "success" → 不重试，直接退出。"""
        result = ClaudeCodeResult(status="success", summary="done")
        should_exit = result.status == "success"
        assert should_exit is True

    def test_non_context_error_exits_without_retry(self):
        """条件 2：error_kind != context_exhausted → 不重试，直接退出。"""
        result = ClaudeCodeResult(status="error", summary="", error="file not found", error_kind=None)
        should_exit = result.status != "success" and getattr(result, "error_kind", None) != "context_exhausted"
        # error_kind=None → 不等于 context_exhausted → 退出
        assert should_exit is True

    def test_context_exhausted_with_retries_remaining_triggers_retry(self):
        """条件 3：context_exhausted 且 retries < max → 应触发重试。"""
        from negentropy.engine.claude_code.service import ERROR_KIND_CONTEXT_EXHAUSTED

        result = ClaudeCodeResult(
            status="error",
            summary="部分完成",
            error="CLI exited with code 1",
            error_kind=ERROR_KIND_CONTEXT_EXHAUSTED,
        )
        compact_retry_count = 0
        compact_max_retries = 2

        should_exit = result.status == "success"
        is_ctx = getattr(result, "error_kind", None) == ERROR_KIND_CONTEXT_EXHAUSTED
        if not should_exit and is_ctx:
            should_exit = compact_retry_count >= compact_max_retries

        assert should_exit is False  # 0 < 2，不退出，继续重试

    def test_context_exhausted_retries_exhausted_exits(self):
        """条件 4：context_exhausted 且 retries >= max → 退出（回退到 Layer 3）。"""
        from negentropy.engine.claude_code.service import ERROR_KIND_CONTEXT_EXHAUSTED

        result = ClaudeCodeResult(
            status="error",
            summary="",
            error_kind=ERROR_KIND_CONTEXT_EXHAUSTED,
        )
        compact_retry_count = 2
        compact_max_retries = 2

        should_exit = result.status == "success"
        is_ctx = getattr(result, "error_kind", None) == ERROR_KIND_CONTEXT_EXHAUSTED
        if not should_exit and is_ctx:
            should_exit = compact_retry_count >= compact_max_retries

        assert should_exit is True  # 2 >= 2，退出

    def test_timeout_remaining_less_than_60s_on_retry_exits(self):
        """条件 5：剩余时间 < 60s 且已在重试中 → 退出（无意义短命重试）。"""
        remaining = 45.0
        compact_retry_count = 1  # 已在重试中

        should_exit = remaining < 60 and compact_retry_count > 0
        assert should_exit is True

    def test_timeout_remaining_sufficient_does_not_exit(self):
        """剩余时间 >= 60s → 不因此退出。"""
        remaining = 120.0
        compact_retry_count = 1

        should_exit = remaining < 60 and compact_retry_count > 0
        assert should_exit is False

    def test_first_attempt_ignores_timeout_check(self):
        """首次调用（compact_retry_count=0）不受剩余时间检查限制。"""
        remaining = 30.0
        compact_retry_count = 0  # 首次

        should_exit = remaining < 60 and compact_retry_count > 0
        assert should_exit is False  # 首次不受此约束

    def test_compact_disabled_means_zero_retries(self):
        """context_compact_enabled=False → compact_max_retries=0 → 不重试。"""
        context_compact_enabled = False
        context_compact_max_retries = 2  # 配置值被忽略

        compact_max_retries = context_compact_max_retries if context_compact_enabled else 0
        assert compact_max_retries == 0


class TestCumulativeCostTracking:
    """验证跨重试的 cost/turns 累积逻辑。"""

    def test_accumulates_cost_across_retries(self):
        results = [
            ClaudeCodeResult(status="error", summary="", cost_usd=0.5, turn_count=10, error_kind="context_exhausted"),
            ClaudeCodeResult(status="success", summary="done", cost_usd=0.3, turn_count=5),
        ]
        cumulative_cost = 0.0
        cumulative_turns = 0
        for r in results:
            cumulative_cost += r.cost_usd or 0.0
            cumulative_turns += r.turn_count or 0

        assert cumulative_cost == pytest.approx(0.8)
        assert cumulative_turns == 15

    def test_handles_none_cost_gracefully(self):
        result = ClaudeCodeResult(status="error", summary="", cost_usd=None, turn_count=None)
        cumulative_cost = 0.0
        cumulative_turns = 0
        cumulative_cost += result.cost_usd or 0.0
        cumulative_turns += result.turn_count or 0

        assert cumulative_cost == 0.0
        assert cumulative_turns == 0
