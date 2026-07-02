"""evolution handler 共享辅助（target-kind 无关的纯函数 / 小 IO）。

从原 ``orchestrator.py`` 抽出，供 ``TargetHandler`` 各实现 + orchestrator 复用，避免循环导入
（orchestrator 导入 handlers，handlers 仅导入本模块）。orchestrator 经 ``from ._shared import ...``
再导出，使既有 ``orchestrator._bump_patch`` / ``_parse_dt`` 等引用逐字节可用（单测不破坏）。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from negentropy.config import settings
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.evolution")

try:
    from negentropy.engine.routine.bus import get_bus as _get_routine_bus
except Exception:  # noqa: BLE001  # 防御性：bus 不可用时降级为 no-op
    _get_routine_bus = None


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _td(**kwargs: int) -> timedelta:
    """timedelta 直传（兼容 ``seconds=`` / ``days=`` 等任意 timedelta 关键字）。"""
    return timedelta(**kwargs)


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _bump_patch(version: str, suffix: str = "") -> str:
    """SemVer patch 位 +1（0.1.0 → 0.1.1）；解析失败回退 '0.1.x'。仅作候选标识，不强制全局唯一。"""
    try:
        parts = version.split(".")
        parts[-1] = str(int(parts[-1]) + 1)
        new = ".".join(parts)
        return f"{new}-{suffix}" if suffix else new
    except (ValueError, IndexError):
        return f"0.1.{uuid4().int % 1000}"


def _enter_canary(proposal, now: datetime) -> None:
    """shadow 通过 → 进入 canary：设状态 + canary_config（比例/窗口/起始时间）。"""
    proposal.status = "canary"
    proposal.canary_config = {
        "bucket_ratio": settings.evolution.canary_bucket_ratio_pct,
        "window_seconds": settings.evolution.canary_window_seconds,
        "started_at": now.isoformat(),
        "min_samples": settings.evolution.min_samples,
    }
    proposal.decided_at = now


def _summarize_metrics(m: dict[str, Any] | None) -> dict[str, Any] | None:
    if not m:
        return None
    keys = ("zero_hit_rate", "helpful_ratio", "referenced_rate", "diversity_ratio", "sample_n")
    return {k: m[k] for k in keys if k in m}


def _emit_evolution_event(
    proposal,
    *,
    action: str,
    reason: str | None,
    metrics: dict[str, Any] | None = None,
) -> None:
    """发布 evolution 状态翻转事件到 RoutineBus（SSE 复用，blueprint §11）。

    fire-and-forget（``publish_nowait``，同步非阻塞）；bus 不可用 / 无订阅者 → 零副作用。
    吞所有异常（审计事件绝不影响 promote/rollback 主流程）。
    """
    if _get_routine_bus is None:
        return
    try:
        _get_routine_bus().publish_nowait(
            {
                "type": "evolution_proposal",
                "proposal_id": str(proposal.id),
                "target_kind": proposal.target_kind,
                "target_ref": proposal.target_ref,
                "action": action,
                "reason": reason,
                "proposed_version": proposal.proposed_version,
                "base_version": proposal.base_version,
                "metrics": _summarize_metrics(metrics),
                "ts": _utcnow().isoformat(),
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("evolution_event_emit_failed", action=action, error=str(exc))
