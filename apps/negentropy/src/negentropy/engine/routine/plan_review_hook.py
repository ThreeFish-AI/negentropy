"""Claude Code PreToolUse 钩子 — 同轮投递 NegentropyEngine 的 Plan Review 反馈给 CC（ISSUE-123）。

定位（为何用 hook 而非 stdin auto-answer）：
    受控实验证实，claude headless(`-p`) 下 ``AskUserQuestion`` 被 CLI **即时自动报错解析**
    （``is_error "Answer questions?"``），根本不读 stdin tool_result——引擎原「检测 tool_use →
    写 stdin 应答」机制对其自始无效，Plan Review 反馈永远送不到 CC。改用 **PreToolUse hook**：
    CC 调 ``AskUserQuestion`` 提交方案时，CLI 先调用本钩子；钩子返回
    ``permissionDecision=deny`` + ``permissionDecisionReason=<评审反馈>``，CLI 即把该 reason 作为
    工具结果**同轮**回灌给 CC，CC 据此修订或退出——实现「CC 提交→Engine 评审→反馈→CC 完善/通过」
    的单轮内闭环（SDK 与 CLI `--settings` hooks 双双实验验证通过）。

协议：
    - stdin：PreToolUse hook 载荷 JSON（含 ``tool_name`` / ``tool_input``）。``tool_input.questions``
      里 CC 写入的 question 文本即其提交的完整方案（PLAN prompt 已如此约束）。
    - argv[1]：per-iteration 上下文文件路径（引擎写入）：``{goal, acceptance_criteria, reflections,
      model, timeout}``——避免经 env 传长文本。
    - stdout：``{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
      "permissionDecisionReason":"<反馈>"}}``。

鲁棒性：任何异常一律 fail-open（输出一个「评审不可用、请直接退出 Plan 模式继续」的 deny），
绝不让 CC 卡死在审阅环节。
"""

from __future__ import annotations

import asyncio
import json
import sys


def _emit(reason: str) -> None:
    """输出 PreToolUse deny + reason（CLI 将 reason 同轮回灌 CC 作为工具结果）。"""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            },
            ensure_ascii=False,
        )
    )


def _extract_plan_text(tool_input: dict) -> str:
    """从 AskUserQuestion 的 tool_input 提取 CC 提交的方案全文（拼接各 question 文本）。"""
    if not isinstance(tool_input, dict):
        return ""
    qs = tool_input.get("questions")
    parts: list[str] = []
    if isinstance(qs, list):
        for q in qs:
            if isinstance(q, dict):
                t = q.get("question") or q.get("header") or ""
                if isinstance(t, str) and t.strip():
                    parts.append(t.strip())
            elif isinstance(q, str):
                parts.append(q)
    if not parts:
        # 兜底：整个 input 当方案
        return json.dumps(tool_input, ensure_ascii=False)
    return "\n\n".join(parts)


async def _run(payload: dict, ctx: dict) -> str:
    from negentropy.engine.routine.plan_reviewer import PlanReviewer

    plan_text = _extract_plan_text(payload.get("tool_input") or {})
    reflections = ctx.get("reflections") or None
    reviewer = PlanReviewer(
        explicit_model=ctx.get("model"),
        timeout_seconds=int(ctx.get("timeout") or 60),
    )
    result = await reviewer.review(
        goal=ctx.get("goal") or "",
        acceptance_criteria=ctx.get("acceptance_criteria") or "",
        plan_text=plan_text,
        reflections=reflections if isinstance(reflections, list) else None,
    )
    if not result.ok:
        return (
            "（NegentropyEngine 评审暂不可用）请直接调用 ExitPlanMode 退出 Plan 模式继续，"
            "不要再次调用 AskUserQuestion。"
        )

    score = result.score if result.score is not None else "?"
    feedback = (result.feedback or "").strip()
    if result.verdict == "approve":
        return (
            f"✅ NegentropyEngine 已通过本方案审阅（评分 {score}/100）。"
            f"{('审阅意见：' + feedback) if feedback else ''}\n"
            "请**直接调用 ExitPlanMode 退出 Plan 模式**进入实施，**不要再次调用 AskUserQuestion**。"
        )
    # refine（或兜底）
    return (
        f"🔄 NegentropyEngine 审阅：方案需完善（评分 {score}/100）。\n"
        f"具体修改建议：{feedback or '请补全验收标准覆盖、风险与回退、测试策略等薄弱项。'}\n"
        "请据此**修订方案后再次调用 AskUserQuestion 提交审阅**；切勿在未达标前退出 Plan 模式。"
    )


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}
    # 仅处理 AskUserQuestion；其它工具放行（输出空 → 不干预）。
    if (payload.get("tool_name") or "") != "AskUserQuestion":
        return
    ctx: dict = {}
    if len(sys.argv) > 1:
        try:
            with open(sys.argv[1], encoding="utf-8") as f:
                ctx = json.load(f)
        except Exception:
            ctx = {}
    try:
        reason = asyncio.run(_run(payload, ctx))
    except Exception as exc:  # fail-open：绝不卡死 CC
        reason = (
            "（NegentropyEngine 评审执行异常："
            f"{str(exc)[:160]}）请直接调用 ExitPlanMode 退出 Plan 模式继续，不要再次调用 AskUserQuestion。"
        )
    _emit(reason)


if __name__ == "__main__":
    main()
