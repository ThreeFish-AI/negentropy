"""Runner 单迭代两段式 Plan Review 闭环单测。

锁定：
- ``emit_raw_event`` 把 plan_review 原始事件归一化注入共享 holder（seq 连续、回调外溢）；
- ``RoutineRunner._inject_plan_review_events`` 读 sidecar → 注入 plan_review 事件，seq 续接既有事件之后；
- ``_cleanup_plan_review_files`` 幂等清理 sidecar/ctx。

这些是「单迭代内 plan 段评审 → NegentropyEngine 发言 → implement 段」闭环的关键缝合点，
不依赖真实 Claude Code / DB。
"""

from __future__ import annotations

import json
import os
import uuid

from negentropy.engine.claude_code.service import emit_raw_event
from negentropy.engine.routine import orchestrator as orch_mod
from negentropy.engine.routine.runner import RoutineRunner


async def test_emit_raw_event_normalizes_plan_review_with_continuous_seq():
    """emit_raw_event 把 system/plan_review 归一化为 plan_review 事件，seq 续接共享 holder。"""
    holder: list[dict] = [{"seq": 0, "event_type": "tool_use", "tool_name": "ExitPlanMode", "payload": {}}]
    streamed: list[dict] = []

    async def sink(evt):
        streamed.append(evt)

    raw = {
        "type": "system",
        "subtype": "plan_review",
        "review_result": {"verdict": "approve", "score": 91, "feedback": "结构清晰", "module_reviews": []},
    }
    await emit_raw_event(raw, holder, sink)

    assert holder[-1]["event_type"] == "plan_review"
    assert holder[-1]["seq"] == 1  # 续接 seq=0 之后
    assert holder[-1]["payload"]["verdict"] == "approve" and holder[-1]["payload"]["score"] == 91
    # deriveAgentRole("plan_review")→engine：该事件即渲染为 NegentropyEngine 发言
    assert streamed and streamed[-1]["event_type"] == "plan_review"


async def test_inject_plan_review_events_from_sidecar(tmp_path, monkeypatch):
    """从 sidecar(JSONL) 注入多条 plan_review 事件，seq 续接既有事件、payload 完整。"""
    monkeypatch.setattr(orch_mod.tempfile, "gettempdir", lambda: str(tmp_path))
    iid = uuid.uuid4()
    sidecar = orch_mod._review_sidecar_path(iid)
    os.makedirs(os.path.dirname(sidecar), exist_ok=True)
    with open(sidecar, "w", encoding="utf-8") as f:
        f.write(json.dumps({"verdict": "refine", "score": 40, "feedback": "补测试", "module_reviews": []}) + "\n")
        f.write(json.dumps({"verdict": "approve", "score": 90, "feedback": "ok", "module_reviews": []}) + "\n")

    # 预置一个 plan 段事件（seq=0），验证注入续接其后
    holder: list[dict] = [{"seq": 0, "event_type": "tool_use", "tool_name": "ExitPlanMode", "payload": {}}]
    streamed: list[dict] = []

    async def sink(evt):
        streamed.append(evt)

    await RoutineRunner._inject_plan_review_events(iid, holder, sink, max_events=None)

    pr = [e for e in holder if e["event_type"] == "plan_review"]
    assert len(pr) == 2
    assert pr[0]["seq"] == 1 and pr[1]["seq"] == 2  # 连续、无冲突
    assert pr[0]["payload"]["verdict"] == "refine" and pr[0]["payload"]["score"] == 40
    assert pr[1]["payload"]["verdict"] == "approve" and pr[1]["payload"]["score"] == 90
    # 实时回调外溢（前端据此显示 Engine 发言）
    assert len([e for e in streamed if e["event_type"] == "plan_review"]) == 2


async def test_inject_plan_review_events_missing_sidecar_is_noop(tmp_path, monkeypatch):
    """sidecar 不存在（CC 未提交方案/评审未触发）→ 不注入、不抛错。"""
    monkeypatch.setattr(orch_mod.tempfile, "gettempdir", lambda: str(tmp_path))
    holder: list[dict] = []
    await RoutineRunner._inject_plan_review_events(uuid.uuid4(), holder, None, max_events=None)
    assert holder == []


def test_cleanup_plan_review_files_idempotent(tmp_path, monkeypatch):
    """清理 sidecar + ctx 文件，幂等（文件不存在亦不抛错）。"""
    monkeypatch.setattr(orch_mod.tempfile, "gettempdir", lambda: str(tmp_path))
    iid = uuid.uuid4()
    sidecar = orch_mod._review_sidecar_path(iid)
    ctx_file = os.path.join(os.path.dirname(sidecar), f"{iid}.json")
    os.makedirs(os.path.dirname(sidecar), exist_ok=True)
    open(sidecar, "w").close()
    open(ctx_file, "w").close()

    RoutineRunner._cleanup_plan_review_files(iid)
    assert not os.path.exists(sidecar) and not os.path.exists(ctx_file)
    # 再次调用幂等（文件已删，不抛错）
    RoutineRunner._cleanup_plan_review_files(iid)
