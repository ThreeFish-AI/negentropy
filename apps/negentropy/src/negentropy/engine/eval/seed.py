"""评测套件的程序化建库与失败采收（综述 §4.5 用例采收回路的最小实现）。

- ``create_suite``：手建套件 + 批量用例；``holdout_ratio`` 未显式指定 ``is_frozen`` 的用例按
  稳定 hash 确定性地切出冻结 holdout 集（综述 §9.4 防 Goodhart：re-seed 可复现、proposer
  无法挑选哪些 case 冻结）。
- ``harvest_failed_tool_invocations``：从 ``tool_invocations`` 的失败记录起草 ``source='harvested'``
  用例供人审（不自动入库）——失败轨迹是综述 §3.5 证据发现的核心来源之一。

HTTP 层（POST /interface/eval/suites）待消费者（PR3）接入时再加；本模块提供可复用的程序入口，
集成测试与未来 API 共用。
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.eval_suite import (
    CASE_SOURCE_HARVESTED,
    CASE_SOURCE_MANUAL,
    EvalCase,
    EvalSuite,
)
from negentropy.models.tool_telemetry import ToolInvocation

_DEFAULT_HOLDOUT_RATIO = 0.2


def _hash_rank(target_ref: str, idx: int, case_input: dict[str, Any]) -> int:
    """case → 稳定整数（deterministic frozen 分配，避免随机 / proposer 挑选）。"""
    payload = f"{target_ref}|{idx}|{json.dumps(case_input or {}, sort_keys=True, default=str)}"
    return int(hashlib.sha256(payload.encode()).hexdigest()[:12], 16)


async def create_suite(
    session: AsyncSession,
    *,
    target_kind: str,
    target_ref: str,
    owner_id: str,
    cases: list[dict[str, Any]],
    scoring_config: dict[str, Any] | None = None,
    holdout_ratio: float = _DEFAULT_HOLDOUT_RATIO,
    visibility: str = "private",
    is_frozen: bool = False,
) -> EvalSuite:
    """建一套件 + 批量用例。

    ``cases`` 每项：``{input, expected?, is_frozen?, weight?, tags?, source?, provenance_ref?}``。
    未显式给 ``is_frozen`` 的用例，按 ``holdout_ratio`` 与稳定 hash 切出冻结集（取 hash 最小的
    floor(ratio×N) 条标 frozen），保证 re-seed 可复现且 proposer 无法挑选冻结集。
    """
    suite = EvalSuite(
        target_kind=target_kind,
        target_ref=target_ref,
        scoring_config=dict(scoring_config or {}),
        is_frozen=is_frozen,
        holdout_ratio=holdout_ratio,
        owner_id=owner_id,
        visibility=visibility,
    )
    session.add(suite)
    await session.flush()

    # 区分显式 frozen 与待分配
    explicit: list[tuple[int, dict[str, Any], bool]] = []  # (idx, case, is_frozen)
    to_assign: list[tuple[int, dict[str, Any]]] = []
    for idx, c in enumerate(cases):
        if "is_frozen" in c and c["is_frozen"] is not None:
            explicit.append((idx, c, bool(c["is_frozen"])))
        else:
            to_assign.append((idx, c))

    assign_frozen_ids: set[int] = set()
    if holdout_ratio > 0 and to_assign:
        ranked = sorted(to_assign, key=lambda t: _hash_rank(target_ref, t[0], t[1].get("input") or {}))
        n_frozen = int(holdout_ratio * len(cases))  # 按全量 case 数为基数
        n_frozen = min(n_frozen, len(to_assign))
        for idx, _c in ranked[:n_frozen]:
            assign_frozen_ids.add(idx)

    for idx, c in enumerate(cases):
        if "is_frozen" in c and c["is_frozen"] is not None:
            frozen = bool(c["is_frozen"])
        else:
            frozen = idx in assign_frozen_ids
        session.add(
            EvalCase(
                suite_id=suite.id,
                is_frozen=frozen,
                input=dict(c.get("input") or {}),
                expected=c.get("expected"),
                weight=float(c.get("weight") or 1.0),
                tags=c.get("tags"),
                source=str(c.get("source") or CASE_SOURCE_MANUAL),
                provenance_ref=c.get("provenance_ref"),
            )
        )
    await session.flush()
    return suite


async def harvest_failed_tool_invocations(
    session: AsyncSession,
    *,
    skill_ref: str,
    lookback_days: int = 7,
    max_cases: int = 20,
) -> list[dict[str, Any]]:
    """从 ``tool_invocations`` 的失败记录起草 eval 用例（综述 §3.5 负向证据 / §4.5 采收）。

    返回未持久化的 case 草稿列表（``source='harvested'`` + ``provenance_ref``），供人审后批量
    ``create_suite`` 入库。**不自动入库**——防自动化的失败拟合（综述 §10.4 自生成经验稳定性）。
    """
    since = datetime.now(UTC) - timedelta(days=lookback_days)
    rows = (
        (
            await session.execute(
                select(ToolInvocation)
                .where(
                    ToolInvocation.skill_ref == skill_ref,
                    ToolInvocation.status == "error",
                    ToolInvocation.created_at >= since,
                )
                .order_by(ToolInvocation.created_at.desc())
                .limit(max_cases)
            )
        )
        .scalars()
        .all()
    )

    drafts: list[dict[str, Any]] = []
    for r in rows:
        drafts.append(
            {
                "input": {
                    "task": f"针对该 skill 失败场景（error_class={r.error_class or 'unknown'}）应正确产出",
                    "variables": {},
                    "context": {"failed_input_digest": r.input_digest, "error_class": r.error_class},
                },
                "expected": {
                    "rubric": "skill prompt 应覆盖该失败场景的正确处置，避免重复 error_class",
                },
                "source": CASE_SOURCE_HARVESTED,
                "provenance_ref": f"tool_invocation:{r.id}",
                "tags": ["harvested", f"error:{r.error_class or 'unknown'}"],
            }
        )
    return drafts


__all__ = ["create_suite", "harvest_failed_tool_invocations"]
