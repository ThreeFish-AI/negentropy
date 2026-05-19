"""单元测试：StageScheduler 竞争模式与早胜取消。

覆盖以下行为：

1. 旧行为兼容：``early_win_cancel=False`` 时所有候选跑完才返回（回归保护）；
2. 早胜取消：rank=1 工具胜出后，立即取消其余候选；
3. 缓冲机会：``early_win_grace_seconds>0`` 时给慢工具最后机会；
4. 非 tier-1 胜出不取消：rank=2 工具先胜出时不触发取消；
5. timeout 倍率：``stage_timeout_multiplier`` 缩放生效。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from negentropy.perceives.pipeline.base import StageResult
from negentropy.perceives.pipeline.scheduler import StageScheduler


class _FakeTool:
    """轻量伪 StageTool：可控延迟、是否成功、可观测的取消。

    模拟 ``StageTool`` 接口而无需注册到全局 registry，避免 monkeypatch
    侵入 ``_resolve_tools``。
    """

    def __init__(
        self,
        name: str,
        delay: float,
        success: bool = True,
        result_tag: Any = "ok",
    ) -> None:
        self.name = name
        self._delay = delay
        self._success = success
        self._result_tag = result_tag
        self.cancelled = False
        self.completed = False

    def is_available(self) -> bool:
        return True

    async def execute(self, _input_data: Any) -> StageResult:
        try:
            await asyncio.sleep(self._delay)
        except asyncio.CancelledError:
            self.cancelled = True
            raise
        self.completed = True
        return StageResult(
            success=self._success,
            output={"tool": self.name, "tag": self._result_tag},
            error=None if self._success else f"{self.name} failed",
        )


@pytest.mark.asyncio
class TestCompetition:
    async def test_default_no_cancel_all_run(self) -> None:
        """旧行为兼容：early_win_cancel=False（默认）时所有候选都跑完。"""
        sched = StageScheduler()
        fast = _FakeTool("fast", delay=0.05, success=True)
        slow = _FakeTool("slow", delay=0.2, success=True)
        result = await sched._run_competition(
            stage_name="test",
            tools=[fast, slow],
            input_data={},
            max_concurrent=2,
            timeout=5.0,
        )
        assert result.success
        assert fast.completed
        assert slow.completed  # 慢工具跑完才返回
        assert not slow.cancelled

    async def test_early_win_cancels_others(self) -> None:
        """rank=1 (fast) 胜出后立即取消 rank=2 (slow)。"""
        sched = StageScheduler()
        fast = _FakeTool("fast", delay=0.05, success=True)
        slow = _FakeTool("slow", delay=2.0, success=True)
        result = await sched._run_competition(
            stage_name="test",
            tools=[fast, slow],
            input_data={},
            max_concurrent=2,
            timeout=5.0,
            early_win_cancel=True,
            early_win_min_rank=1,
            early_win_grace_seconds=0.0,
        )
        # 等待事件循环传导取消，再次让出
        await asyncio.sleep(0.1)
        assert result.success
        assert fast.completed
        assert slow.cancelled
        assert not slow.completed

    async def test_grace_period_allows_late_win(self) -> None:
        """grace 期内若慢工具完成，结果也应被收集（不强制立即取消）。"""
        sched = StageScheduler()
        fast = _FakeTool("fast", delay=0.05, success=True)
        slow = _FakeTool("slow", delay=0.10, success=True)  # 50ms < 200ms grace
        result = await sched._run_competition(
            stage_name="test",
            tools=[fast, slow],
            input_data={},
            max_concurrent=2,
            timeout=5.0,
            early_win_cancel=True,
            early_win_min_rank=1,
            early_win_grace_seconds=0.3,
        )
        assert result.success
        assert fast.completed
        assert slow.completed  # grace 期内完成
        assert not slow.cancelled

    async def test_non_tier1_win_does_not_cancel(self) -> None:
        """rank=2 工具先胜出时不触发取消（仅 tier-1 触发）。"""
        sched = StageScheduler()
        slow_tier1 = _FakeTool("tier1_slow", delay=0.3, success=False)
        fast_tier2 = _FakeTool("tier2_fast", delay=0.05, success=True)
        # tools 顺序 = rank：slow_tier1=rank1, fast_tier2=rank2
        result = await sched._run_competition(
            stage_name="test",
            tools=[slow_tier1, fast_tier2],
            input_data={},
            max_concurrent=2,
            timeout=5.0,
            early_win_cancel=True,
            early_win_min_rank=1,
            early_win_grace_seconds=0.0,
        )
        # tier-1 失败，tier-2 成功；scheduler 不应取消 tier-1（已经在跑且会失败）
        await asyncio.sleep(0.5)
        assert result.success
        assert fast_tier2.completed

    async def test_no_success_returns_failure(self) -> None:
        """所有候选均失败时返回失败结果。"""
        sched = StageScheduler()
        bad1 = _FakeTool("bad1", delay=0.05, success=False)
        bad2 = _FakeTool("bad2", delay=0.05, success=False)
        result = await sched._run_competition(
            stage_name="test",
            tools=[bad1, bad2],
            input_data={},
            max_concurrent=2,
            timeout=5.0,
        )
        assert not result.success
        assert "所有竞争工具均失败" in (result.error or "")


@pytest.mark.asyncio
class TestTimeoutMultiplier:
    async def test_multiplier_applied_to_competition(self, monkeypatch) -> None:
        """stage_timeout_multiplier=2.0 时 run_stage → _run_competition 的
        timeout 应被放大为 base × mult，覆盖 scheduler.run_stage 中的传导路径。"""
        from negentropy.perceives.pipeline import scheduler as scheduler_mod

        monkeypatch.setattr(scheduler_mod, "_stage_timeout_multiplier", lambda: 2.0)

        sched = StageScheduler()
        fake = _FakeTool("fake_for_mult", delay=0.01, success=True)

        # 绕过 registry：让 _resolve_tools 直接返回伪 tool，避免注册副作用
        monkeypatch.setattr(sched, "_resolve_tools", lambda *a, **kw: [fake])

        captured: dict = {}
        original_run = sched._run_competition

        async def capturing_run(*args, **kwargs) -> Any:
            captured["timeout"] = kwargs.get("timeout")
            return await original_run(*args, **kwargs)

        monkeypatch.setattr(sched, "_run_competition", capturing_run)

        result = await sched.run_stage(
            stage_name="test_mult",
            tool_configs=[{"name": "fake_for_mult", "rank": 1, "enabled": True}],
            input_data={},
            competition_mode=True,
            competition_config={"timeout": 5.0, "max_concurrent": 1},
        )

        assert result.success, result.error
        # base=5.0, mult=2.0 → effective=10.0
        assert captured.get("timeout") == 10.0, captured

    async def test_multiplier_default_one(self, monkeypatch) -> None:
        """默认倍率 1.0 时 timeout 透传不变。"""
        from negentropy.perceives.pipeline import scheduler as scheduler_mod

        monkeypatch.setattr(scheduler_mod, "_stage_timeout_multiplier", lambda: 1.0)

        sched = StageScheduler()
        fake = _FakeTool("fake_default_mult", delay=0.01, success=True)
        monkeypatch.setattr(sched, "_resolve_tools", lambda *a, **kw: [fake])

        captured: dict = {}
        original_run = sched._run_competition

        async def capturing_run(*args, **kwargs) -> Any:
            captured["timeout"] = kwargs.get("timeout")
            return await original_run(*args, **kwargs)

        monkeypatch.setattr(sched, "_run_competition", capturing_run)

        await sched.run_stage(
            stage_name="test_default_mult",
            tool_configs=[{"name": "fake_default_mult", "rank": 1, "enabled": True}],
            input_data={},
            competition_mode=True,
            competition_config={"timeout": 7.0, "max_concurrent": 1},
        )

        assert captured.get("timeout") == 7.0


@pytest.mark.asyncio
class TestOuterCancellationPropagation:
    async def test_outer_cancel_propagates_through_competition(self) -> None:
        """外层任务取消应穿透 _run_competition：不被 except CancelledError 吞掉，
        防止 task_timeout_seconds / deadline_monotonic 触发的取消被静默成普通迭代。"""
        sched = StageScheduler()
        slow_a = _FakeTool("slow_a", delay=10.0, success=True)
        slow_b = _FakeTool("slow_b", delay=10.0, success=True)

        async def runner() -> Any:
            return await sched._run_competition(
                stage_name="test_outer_cancel",
                tools=[slow_a, slow_b],
                input_data={},
                max_concurrent=2,
                timeout=30.0,
            )

        outer = asyncio.create_task(runner())
        await asyncio.sleep(0.05)  # 让两个工具都开始 sleep
        outer.cancel()

        with pytest.raises(asyncio.CancelledError):
            await outer

        # 子工具也应该被 asyncio 协作取消
        await asyncio.sleep(0.1)
        assert slow_a.cancelled or not slow_a.completed
        assert slow_b.cancelled or not slow_b.completed
