"""Approval Gate · RFC 0002 §4.4 中断/审批门 — 协议层（P3-2 MVP）。

设计目标：
    高风险工具调用（write_file / send_email / update_knowledge_graph 等）执行**前**让用户
    显式批准；与流式 Stop 按钮一起构成"中断 + 审批"双门户，参见 RFC 0002 §4.4 与
    docs/architecture/conversation-foundation.md §6 HITL & Guardrails。

本期范围（MVP）：
    - 提供高风险工具白名单（``HIGH_RISK_TOOLS``）+ ``should_request_approval`` 策略判定 helper；
    - 提供 ApprovalRequest / ApprovalResponse 数据类作为协议事实；
    - 工具开发者按需在工具入口调 ``should_request_approval``，命中即调
      ``request_approval(tool_context, request)`` 写入 ``state.pending_approvals``，
      然后等待 ``state.approval_responses[action_id]`` 出现（通过 polling 或 ADK
      LongRunningFunctionTool 模式）；
    - **本期不强制接入具体工具**（避免改造爆炸半径）；演示与完整工具接入留 Phase 4。

参考文献：
    [1] RFC 0002 §4.4 中断/审批门（docs/concepts/0002-ui-interaction-enhancements.md）
    [2] T. Rebedea et al., "NeMo Guardrails: A Toolkit for Controllable and Safe LLM
        Applications with Programmable Rails," in Proc. EMNLP System Demos, 2023.
    [3] Y. Bai et al., "Constitutional AI: Harmlessness from AI Feedback," arXiv:2212.08073, 2022.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from negentropy.logging import get_logger

logger = get_logger("negentropy.agents.approval")


# ----------------------------------------------------------------------------
# 高风险工具白名单（按"破坏性 / 不可逆 / 副作用范围"排序）
# ----------------------------------------------------------------------------
#
# 设计原则：
# 1. 仅纳入「会改变外部状态」或「会写入持久存储」的工具；
# 2. 纯查询 / 检索 / 内部读 → 不需要审批；
# 3. 新增 vendor 工具时，请同步更新本列表 + chat-essentials.md「审批策略」表。

HIGH_RISK_TOOLS: tuple[str, ...] = (
    # 副作用：写入 KG / 知识库
    "update_knowledge_graph",
    "ingest_paper",  # 会下载 PDF + 写入知识库
    # 副作用：执行代码 / 文件系统
    "execute_code",
    "write_file",
    "shell_command",
    # 副作用：对外通信
    "send_email",
    "send_notification",
    "publish_content",
    # 副作用：数据库写入（应用层）
    "save_to_memory",
)


# ----------------------------------------------------------------------------
# 审批策略
# ----------------------------------------------------------------------------

ApprovalPolicyMode = Literal["always", "per_tool", "never"]
"""
- ``always``    : 任何工具调用都弹审批（最严格）；
- ``per_tool``  : 仅 HIGH_RISK_TOOLS 弹审批（默认）；
- ``never``     : 关闭审批门（CI / 受信任环境用）。
"""

DEFAULT_POLICY: ApprovalPolicyMode = "per_tool"


@dataclass(frozen=True)
class ApprovalPolicy:
    """会话级审批策略（来自前端 forwardedProps 或 session.state）。"""

    mode: ApprovalPolicyMode = DEFAULT_POLICY
    # 用户级 allowlist：即使在 per_tool 模式下，列表中的工具也免审批
    allowlist: tuple[str, ...] = ()
    # 用户级 blocklist：即使在 never 模式下，列表中的工具仍强制审批
    blocklist: tuple[str, ...] = ()


def should_request_approval(tool_name: str, policy: ApprovalPolicy | None = None) -> bool:
    """决定该工具调用是否需要审批。

    判定优先级（从高到低）：
        1. policy.blocklist 命中 → 必须审批；
        2. policy.allowlist 命中 → 跳过审批；
        3. policy.mode == "always" → 必须审批；
        4. policy.mode == "never" → 跳过审批；
        5. policy.mode == "per_tool" 且 tool_name in HIGH_RISK_TOOLS → 必须审批；
        6. 否则跳过审批。
    """
    if not tool_name:
        return False
    p = policy or ApprovalPolicy()
    if tool_name in p.blocklist:
        return True
    if tool_name in p.allowlist:
        return False
    if p.mode == "always":
        return True
    if p.mode == "never":
        return False
    return tool_name in HIGH_RISK_TOOLS


# ----------------------------------------------------------------------------
# 协议数据类（state delta 旁路）
# ----------------------------------------------------------------------------


@dataclass(frozen=True)
class ApprovalRequest:
    """工具向用户请求审批的事件载荷。

    被工具内部写入 ``state.pending_approvals[action_id]``，前端订阅 state delta 后
    弹出 ``ApprovalDialog``。
    """

    action_id: str
    tool_name: str
    label: str
    detail: str | None = None
    args_preview: dict[str, Any] | None = None
    requested_at: float = field(default_factory=lambda: time.time())
    risk_tier: Literal["low", "medium", "high"] = "high"

    def to_state_payload(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ApprovalResponse:
    """前端用户的审批响应。

    通过 BFF / 后续工具 polling 写入 ``state.approval_responses[action_id]``。
    """

    action_id: str
    decision: Literal["approved", "denied"]
    reason: str | None = None
    responded_at: float = field(default_factory=lambda: time.time())

    def to_state_payload(self) -> dict[str, Any]:
        return asdict(self)


# ----------------------------------------------------------------------------
# 工具侧 helper（state delta 写入；不依赖具体 ToolContext 实现）
# ----------------------------------------------------------------------------


def _new_action_id(tool_name: str) -> str:
    return f"approval:{tool_name}:{uuid.uuid4().hex[:8]}"


def request_approval(
    tool_context: Any,
    *,
    tool_name: str,
    label: str,
    detail: str | None = None,
    args_preview: dict[str, Any] | None = None,
    risk_tier: Literal["low", "medium", "high"] = "high",
) -> str | None:
    """把审批请求写入 ``state.pending_approvals[action_id]``。

    返回 ``action_id`` 用于工具后续轮询 ``state.approval_responses``。失败时 fail-soft
    返回 None（让工具开发者按需选择"放行"或"拒绝"作为兜底）。
    """
    if tool_context is None or not hasattr(tool_context, "state"):
        logger.debug("approval_request_skipped_no_state", tool_name=tool_name)
        return None
    try:
        action_id = _new_action_id(tool_name)
        req = ApprovalRequest(
            action_id=action_id,
            tool_name=tool_name,
            label=label,
            detail=detail,
            args_preview=args_preview,
            risk_tier=risk_tier,
        )
        state = tool_context.state
        existing = state.get("pending_approvals")
        existing_dict = existing if isinstance(existing, dict) else {}
        # 单次赋值（不就地 mutate state 持有的 dict）：避免与并发 request_approval
        # 共享同一份 bucket 引用、亦避免「先读取-再 setitem」之间被其他写入路径覆盖。
        state["pending_approvals"] = {**existing_dict, action_id: req.to_state_payload()}
        logger.info(
            "approval_request_emitted",
            tool_name=tool_name,
            action_id=action_id,
            risk_tier=risk_tier,
        )
        return action_id
    except Exception as exc:
        logger.warning("approval_request_failed", tool_name=tool_name, error=str(exc))
        return None


def consume_approval_response(tool_context: Any, action_id: str) -> ApprovalResponse | None:
    """从 ``state.approval_responses`` 读取并清理对应 action_id 的响应。

    使用语义：工具 polling 直到出现响应；命中后调用本函数原子地读取 + 清理。
    """
    if tool_context is None or not hasattr(tool_context, "state"):
        return None
    try:
        state = tool_context.state
        responses = state.get("approval_responses")
        if not isinstance(responses, dict) or action_id not in responses:
            return None
        payload = responses.get(action_id)
        # 单次赋值（生成新 dict 而非就地 pop）：与 request_approval 同样的并发安全契约。
        state["approval_responses"] = {k: v for k, v in responses.items() if k != action_id}
        # 同步清理 pending（如果还在）
        pending = state.get("pending_approvals")
        if isinstance(pending, dict) and action_id in pending:
            state["pending_approvals"] = {k: v for k, v in pending.items() if k != action_id}
        if not isinstance(payload, dict):
            return None
        decision = payload.get("decision")
        if decision not in ("approved", "denied"):
            return None
        return ApprovalResponse(
            action_id=action_id,
            decision=decision,
            reason=payload.get("reason"),
            responded_at=float(payload.get("responded_at") or time.time()),
        )
    except Exception as exc:
        logger.warning("approval_response_read_failed", action_id=action_id, error=str(exc))
        return None


__all__ = [
    "HIGH_RISK_TOOLS",
    "DEFAULT_POLICY",
    "ApprovalPolicy",
    "ApprovalPolicyMode",
    "ApprovalRequest",
    "ApprovalResponse",
    "should_request_approval",
    "request_approval",
    "consume_approval_response",
]
