"use client";

/**
 * ApprovalDialog · P3-2 RFC 0002 §4.4 中断/审批门 — 前端 modal
 *
 * 订阅 ``state.pending_approvals``（state delta 旁路），逐条弹出审批 modal。用户
 * Approve / Deny 后通过 ``onRespond(actionId, decision, reason)`` 把响应写回。
 *
 * 协议字段（与后端 ``negentropy.agents.approval.ApprovalRequest`` 对齐）：
 *   { action_id, tool_name, label, detail?, args_preview?, risk_tier? }
 *
 * 失败软退化：
 * - pending 为空时返回 null（零回归）；
 * - args_preview JSON.stringify 失败 fallback 为 "<unrenderable>"；
 * - onRespond 抛错时显示 retry button + error toast。
 *
 * 与 ConfirmationToolCard 的差异：
 * - ConfirmationToolCard：工具主动请用户确认（在对话气泡内嵌入卡片）；
 * - ApprovalDialog：策略级阻断（modal 浮于对话之上，必须先决策才能继续）。
 */

import { useEffect, useMemo, useState } from "react";

export type ApprovalRequestPayload = {
  action_id: string;
  tool_name: string;
  label: string;
  detail?: string | null;
  args_preview?: Record<string, unknown> | null;
  risk_tier?: "low" | "medium" | "high" | null;
  requested_at?: number;
};

export type ApprovalDecision = "approved" | "denied";

type Props = {
  /** ``state.pending_approvals`` 的内容（dict 直接以对象传入；本组件按 requested_at 升序展示首条） */
  pending: Record<string, ApprovalRequestPayload> | null | undefined;
  /** 用户做出决策时回调；调用方负责把响应写回 ``state.approval_responses``（通过 BFF 或对话） */
  onRespond: (actionId: string, decision: ApprovalDecision, reason?: string) => Promise<void> | void;
  /**
   * 逃生舱回调（可选）：ESC 键或「稍后」按钮触发，仅本地延后关闭弹窗，**不发送批准/拒绝**。
   * 硬门语义——审批是审慎闸门，ESC 绝不映射为决策；未决请求在服务端仍存在，
   * 刷新/切会话后由调用方决定是否复现。不传时 ESC/「稍后」不可用（弹窗仅能经决策关闭）。
   */
  onDismiss?: (actionId: string) => void;
  /**
   * 一键延后全部（可选）：当 ``pending`` 有多条时，避免用户被迫逐条点 N 次（ISSUE-157
   * 实测根因——多条孤儿堆叠时「点一个顶一个」体感「关不掉」）。触发后调用方一次性把
   * 所有待审 id 加入本地「已处理」集，弹窗彻底消失。仅在 pending 条数 > 1 时渲染按钮。
   */
  onDismissAll?: () => void;
};

function pickFirstRequest(
  pending: Record<string, ApprovalRequestPayload> | null | undefined,
): ApprovalRequestPayload | null {
  if (!pending) return null;
  const list = Object.values(pending).filter(
    (item): item is ApprovalRequestPayload => !!item && typeof item.action_id === "string",
  );
  if (list.length === 0) return null;
  list.sort((a, b) => (a.requested_at ?? 0) - (b.requested_at ?? 0));
  return list[0];
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "<unrenderable>";
  }
}

const RISK_TIER_LABEL: Record<NonNullable<ApprovalRequestPayload["risk_tier"]>, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

export function ApprovalDialog({ pending, onRespond, onDismiss, onDismissAll }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const current = useMemo(() => pickFirstRequest(pending), [pending]);
  // 多条堆叠时显示计数 + 「全部稍后」按钮（ISSUE-157：避免逐条点 N 次的「关不掉」错觉）。
  const pendingCount = useMemo(
    () =>
      pending
        ? Object.values(pending).filter(
            (v): v is ApprovalRequestPayload => !!v && typeof v.action_id === "string",
          ).length
        : 0,
    [pending],
  );
  const showMultiBadge = pendingCount > 1;

  // 逃生舱：ESC 键延后关闭当前审批（不发送决策）。提交中（busy）时不响应，
  // 避免与正在飞行的决策请求竞态。
  const currentActionId = current?.action_id ?? null;
  useEffect(() => {
    if (!currentActionId || !onDismiss) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || busy) return;
      e.preventDefault();
      onDismiss(currentActionId);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentActionId, onDismiss, busy]);

  if (!current) return null;

  const tier = current.risk_tier ?? "high";
  const argsText =
    current.args_preview && Object.keys(current.args_preview).length > 0
      ? safeJsonStringify(current.args_preview)
      : null;

  const handleDecision = async (decision: ApprovalDecision) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRespond(current.action_id, decision, reason.trim() || undefined);
      setReason("");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-dialog-title"
      data-testid="approval-dialog"
      data-action-id={current.action_id}
      data-risk-tier={tier}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <span
            className={
              tier === "high"
                ? "rounded-full bg-red-100 px-2 py-0.5 text-micro font-semibold uppercase tracking-overline text-red-700 dark:bg-red-950/70 dark:text-red-200"
                : tier === "medium"
                  ? "rounded-full bg-amber-100 px-2 py-0.5 text-micro font-semibold uppercase tracking-overline text-amber-700 dark:bg-amber-950/70 dark:text-amber-200"
                  : "rounded-full bg-muted px-2 py-0.5 text-micro font-semibold uppercase tracking-overline text-text-secondary"
            }
          >
            {RISK_TIER_LABEL[tier]}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{current.tool_name}</span>
          {showMultiBadge ? (
            <span
              data-testid="approval-pending-count"
              className="ml-auto rounded-full border border-border bg-muted/60 px-2 py-0.5 text-micro font-semibold text-text-secondary"
              title="本会话累积了多条待审批请求，可逐条处理或一键「全部稍后」"
            >
              共 {pendingCount} 条待审批
            </span>
          ) : null}
        </div>

        <h2 id="approval-dialog-title" className="mt-3 text-base font-semibold">
          {current.label || `即将执行 ${current.tool_name}`}
        </h2>

        {current.detail ? (
          <p className="mt-2 text-sm text-muted-foreground">{current.detail}</p>
        ) : null}

        {argsText ? (
          <pre
            data-testid="approval-args-preview"
            className="mt-3 max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs"
          >
            {argsText}
          </pre>
        ) : null}

        <label className="mt-3 block text-xs">
          <span className="text-muted-foreground">备注（可选）</span>
          <textarea
            data-testid="approval-reason"
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：仅本次允许 / 拒绝原因..."
            disabled={busy}
          />
        </label>

        {error ? (
          <div
            data-testid="approval-error"
            className="mt-3 rounded-md border border-red-200 bg-red-50/50 p-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
          >
            提交失败：{error}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          {onDismiss ? (
            <button
              type="button"
              data-testid="approval-dismiss"
              className="mr-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
              onClick={() => onDismiss(current.action_id)}
              disabled={busy}
              title="暂时关闭此审批（不批准也不拒绝），稍后可重新处理"
            >
              稍后
            </button>
          ) : null}
          {onDismissAll && showMultiBadge ? (
            <button
              type="button"
              data-testid="approval-dismiss-all"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-muted disabled:opacity-60"
              onClick={onDismissAll}
              disabled={busy}
              title="一键延后本会话所有待审批请求（不批准也不拒绝）"
            >
              全部稍后
            </button>
          ) : null}
          <button
            type="button"
            data-testid="approval-deny"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            onClick={() => handleDecision("denied")}
            disabled={busy}
          >
            拒绝
          </button>
          <button
            type="button"
            data-testid="approval-approve"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60"
            onClick={() => handleDecision("approved")}
            disabled={busy}
          >
            {busy ? "提交中..." : "批准"}
          </button>
        </div>
      </div>
    </div>
  );
}
