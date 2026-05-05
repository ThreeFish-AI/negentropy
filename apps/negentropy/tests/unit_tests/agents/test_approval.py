"""P3-2 · Approval Gate 单测：策略判定 + state delta 协议。"""

from __future__ import annotations


class _State(dict):
    """简化版 ADK state（dict 子类，支持 .get / .__setitem__ / .pop）。"""


class _Ctx:
    def __init__(self) -> None:
        self.state = _State()


# ----------------------------------------------------------------------------
# should_request_approval — 策略矩阵
# ----------------------------------------------------------------------------


def test_high_risk_tool_default_policy_requires_approval():
    from negentropy.agents.approval import should_request_approval

    assert should_request_approval("write_file") is True
    assert should_request_approval("update_knowledge_graph") is True
    assert should_request_approval("send_email") is True


def test_low_risk_tool_default_policy_skips():
    from negentropy.agents.approval import should_request_approval

    assert should_request_approval("search_knowledge_base") is False
    assert should_request_approval("search_papers") is False
    assert should_request_approval("read_file") is False


def test_policy_always_requires_for_any_tool():
    from negentropy.agents.approval import ApprovalPolicy, should_request_approval

    p = ApprovalPolicy(mode="always")
    assert should_request_approval("search_knowledge_base", p) is True
    assert should_request_approval("any_random_tool", p) is True


def test_policy_never_skips_unless_blocklisted():
    from negentropy.agents.approval import ApprovalPolicy, should_request_approval

    p = ApprovalPolicy(mode="never")
    assert should_request_approval("write_file", p) is False
    assert should_request_approval("update_knowledge_graph", p) is False

    # blocklist 优先级高于 mode=never
    p_with_blocklist = ApprovalPolicy(mode="never", blocklist=("send_email",))
    assert should_request_approval("send_email", p_with_blocklist) is True


def test_policy_per_tool_with_allowlist_skips_high_risk():
    from negentropy.agents.approval import ApprovalPolicy, should_request_approval

    p = ApprovalPolicy(mode="per_tool", allowlist=("write_file",))
    # write_file 仍是 HIGH_RISK，但 allowlist 覆盖
    assert should_request_approval("write_file", p) is False
    # 其他 high risk 仍要审批
    assert should_request_approval("send_email", p) is True


def test_policy_blocklist_overrides_allowlist():
    """blocklist 优先级最高（安全保守原则）。"""
    from negentropy.agents.approval import ApprovalPolicy, should_request_approval

    p = ApprovalPolicy(allowlist=("send_email",), blocklist=("send_email",))
    assert should_request_approval("send_email", p) is True


def test_empty_tool_name_returns_false():
    from negentropy.agents.approval import should_request_approval

    assert should_request_approval("") is False


# ----------------------------------------------------------------------------
# request_approval — state delta 写入契约
# ----------------------------------------------------------------------------


def test_request_approval_writes_pending_state():
    from negentropy.agents.approval import request_approval

    ctx = _Ctx()
    action_id = request_approval(
        ctx,
        tool_name="write_file",
        label="即将写入 /etc/hosts",
        detail="需要管理员审批",
        args_preview={"path": "/etc/hosts"},
        risk_tier="high",
    )
    assert action_id is not None
    assert action_id.startswith("approval:write_file:")

    pending = ctx.state["pending_approvals"]
    assert action_id in pending
    payload = pending[action_id]
    assert payload["tool_name"] == "write_file"
    assert payload["label"] == "即将写入 /etc/hosts"
    assert payload["risk_tier"] == "high"
    assert payload["args_preview"] == {"path": "/etc/hosts"}
    assert payload["requested_at"] > 0


def test_request_approval_fail_soft_when_no_state():
    from negentropy.agents.approval import request_approval

    class _NoState:
        pass

    assert request_approval(_NoState(), tool_name="x", label="y") is None
    assert request_approval(None, tool_name="x", label="y") is None


def test_request_approval_appends_multiple():
    from negentropy.agents.approval import request_approval

    ctx = _Ctx()
    a1 = request_approval(ctx, tool_name="write_file", label="op 1")
    a2 = request_approval(ctx, tool_name="send_email", label="op 2")
    assert a1 != a2
    assert a1 in ctx.state["pending_approvals"]
    assert a2 in ctx.state["pending_approvals"]


# ----------------------------------------------------------------------------
# consume_approval_response — 原子读取 + 清理
# ----------------------------------------------------------------------------


def test_consume_response_reads_and_clears():
    from negentropy.agents.approval import consume_approval_response, request_approval

    ctx = _Ctx()
    action_id = request_approval(ctx, tool_name="write_file", label="op")
    assert action_id is not None

    # 模拟前端写回响应
    ctx.state["approval_responses"] = {
        action_id: {"action_id": action_id, "decision": "approved", "reason": "looks good", "responded_at": 1.0}
    }

    response = consume_approval_response(ctx, action_id)
    assert response is not None
    assert response.decision == "approved"
    assert response.reason == "looks good"

    # 状态已被清理
    assert action_id not in ctx.state["approval_responses"]
    assert action_id not in ctx.state.get("pending_approvals", {})


def test_consume_response_returns_none_when_no_match():
    from negentropy.agents.approval import consume_approval_response

    ctx = _Ctx()
    assert consume_approval_response(ctx, "nonexistent") is None


def test_consume_response_returns_none_for_invalid_decision():
    from negentropy.agents.approval import consume_approval_response

    ctx = _Ctx()
    ctx.state["approval_responses"] = {"x": {"action_id": "x", "decision": "maybe", "reason": "?"}}
    assert consume_approval_response(ctx, "x") is None


def test_consume_response_handles_denied():
    from negentropy.agents.approval import consume_approval_response

    ctx = _Ctx()
    ctx.state["approval_responses"] = {"x": {"action_id": "x", "decision": "denied", "reason": "blocked by policy"}}
    response = consume_approval_response(ctx, "x")
    assert response is not None
    assert response.decision == "denied"
    assert response.reason == "blocked by policy"


# ----------------------------------------------------------------------------
# 数据类导出契约
# ----------------------------------------------------------------------------


def test_approval_request_payload_serializable():
    from negentropy.agents.approval import ApprovalRequest

    req = ApprovalRequest(action_id="a1", tool_name="t", label="x", risk_tier="medium")
    payload = req.to_state_payload()
    assert payload["action_id"] == "a1"
    assert payload["risk_tier"] == "medium"
    # 可被 JSON 序列化（ADK state delta 必备）
    import json as _json

    assert _json.loads(_json.dumps(payload))["action_id"] == "a1"


def test_approval_response_payload_serializable():
    from negentropy.agents.approval import ApprovalResponse

    res = ApprovalResponse(action_id="a1", decision="approved")
    payload = res.to_state_payload()
    assert payload["decision"] == "approved"
    import json as _json

    assert _json.loads(_json.dumps(payload))["decision"] == "approved"
