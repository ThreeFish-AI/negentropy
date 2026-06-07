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

**stdout 纯净性（关键）**：Claude Code 按 **纯 JSON** 解析钩子 stdout；而 negentropy 引擎的
structlog/日志默认写 stdout（实测 `disposer_registered`/`task_model_resolved` 等噪声行）。若混入
stdout，Claude Code 解析失败 → 放弃钩子 → CC 落回 CLI 自动报错 "Answer questions?"（评审反馈丢失，
ISSUE-123 实测复发根因）。故进程启动即**保存原始 stdout fd，并把进程级 stdout(fd 1) 重定向到 stderr**，
所有引擎/日志噪声入 stderr，最终决策 JSON 仅经保存的原始 stdout 输出——无论日志去向皆纯净。
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

# === stdout 纯净化（必须在任何 negentropy 引擎 import 之前执行）===
# 关键：本文件须以**脚本路径**方式执行（``python <path> <ctx>``），**而非 ``python -m`` 包模块**——
# 后者会让 runpy 在执行本模块代码前先 import ``negentropy.engine.routine`` 包 ``__init__`` 链
# （触发 lifecycle/db.session 的 ``disposer_registered`` 日志写到尚未重定向的 stdout，污染钩子 JSON）。
# 脚本路径执行不预导入父包，故下方重定向能赶在任何引擎 import 之前生效。
# ① 保存原始 stdout fd，供 _emit 写最终 JSON。
_REAL_STDOUT_FD = os.dup(1)
# ② 进程级 fd1→fd2，覆盖直接写 fd 的噪声。
os.dup2(2, 1)
# ③ Python 级 sys.stdout→stderr，覆盖持有 stdout 对象引用的 writer。
sys.stdout = sys.stderr
# ④ 脚本路径执行：把 negentropy 包根（本文件上溯 4 级 = src/）加入 sys.path，使 ``from negentropy...`` 可导入。
_SRC_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir, os.pardir))
if _SRC_ROOT not in sys.path:
    sys.path.insert(0, _SRC_ROOT)
# ⑤ 决定性：把引擎统一日志配置为 **file sink**，structlog 永不写 stdout（双保险，且不依赖 ②③）。
try:
    from negentropy.logging.core import configure_logging

    configure_logging(
        level="WARNING", sinks="file", file_path=os.path.join(os.sep, "tmp", "negentropy-plan-review-hook.log")
    )
except Exception:
    pass


def _emit(reason: str) -> None:
    """经**原始 stdout fd** 输出纯 JSON 的 PreToolUse deny + reason（CLI 将 reason 同轮回灌 CC）。"""
    payload = json.dumps(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        },
        ensure_ascii=False,
    )
    os.write(_REAL_STDOUT_FD, (payload + "\n").encode("utf-8"))


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
    # 批准后**结束本轮**而非调用 ExitPlanMode（ISSUE-128）：相位推进（PLAN→IMPLEMENT）纯由引擎
    # `_advance_phase_or_terminate` 在下一次评估驱动，不依赖 CC 退出 Plan 模式；而 headless ExitPlanMode
    # 恒被 CLI 标 is_error，CC 会误判失败而循环重试、空耗 turns。故批准/失败兜底均指示 CC「直接结束本轮」。
    if not result.ok:
        return (
            "（NegentropyEngine 评审暂不可用）请**直接结束本轮**"
            "（不要调用 ExitPlanMode 或 AskUserQuestion）；引擎将自动推进到实施阶段。"
        )

    score = result.score if result.score is not None else "?"
    feedback = (result.feedback or "").strip()
    if result.verdict == "approve":
        return (
            f"✅ NegentropyEngine 已通过本方案审阅（评分 {score}/100）。"
            f"{('审阅意见：' + feedback) if feedback else ''}\n"
            "方案已批准。请**直接结束本轮回复**——无需调用 ExitPlanMode 或任何工具；"
            "引擎会自动推进到实施（IMPLEMENT）阶段并据本方案派发实施迭代。"
        )
    # refine（或兜底）
    return (
        f"🔄 NegentropyEngine 审阅：方案需完善（评分 {score}/100）。\n"
        f"具体修改建议：{feedback or '请补全验收标准覆盖、风险与回退、测试策略等薄弱项。'}\n"
        "请据此**修订方案后再次调用 AskUserQuestion 提交审阅**；切勿在未达标前退出 Plan 模式。"
    )


# ExitPlanMode 批准文案（ISSUE-126/128）：headless 下 ExitPlanMode 必被 CLI 标 is_error
# （permissionDecision=allow 经实验**不能**消除）。若指示 CC「继续实施」，CC 会因 is_error 误判失败
# 而循环重试 ExitPlanMode 空耗 turns（ISSUE-128 实测 3×）。而 PLAN→IMPLEMENT 推进纯由引擎下一次
# 评估驱动、不依赖 ExitPlanMode，故明确指示 CC **结束本轮**——引擎自动推进实施阶段。
_EXIT_APPROVED_REASON = (
    "✅ NegentropyEngine 已收到你的方案并批准。请**立即结束本轮回复**，"
    "**不要再调用 ExitPlanMode 或任何工具**——引擎会自动推进到实施（IMPLEMENT）阶段并据方案派发实施迭代。"
)


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        payload = {}
    tool_name = payload.get("tool_name") or ""
    # ExitPlanMode：返回「已批准、进入实施」的 deny+reason（消除 opaque "Exit plan mode?" 噪声）。
    if tool_name == "ExitPlanMode":
        _emit(_EXIT_APPROVED_REASON)
        return
    # 仅处理 AskUserQuestion；其它工具不干预（输出空）。
    if tool_name != "AskUserQuestion":
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
