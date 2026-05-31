"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import type { RoutineDTO } from "@/features/routine";

/**
 * Routine 重启确认对话框。
 *
 * Restart 复位运行态并重跑，且会产生新成本——属「需确认」操作（不可静默触发）。
 * 用户可在此**选择是否携带既往反思记忆**（Reflexion 跨尝试学习）。既往迭代作为历史保留。
 * 视觉与 a11y 复用 {@link OverlayDismissLayer}（焦点陷阱 / Esc / 遮罩关闭 / aria-modal），
 * 与全站 ConfirmDialog 同源；Restart 为建设性恢复操作，用 primary（非红色）。
 */
export interface RestartRoutineDialogProps {
  routine: RoutineDTO;
  busy?: boolean;
  /** confirm 回带反思去留选择（true=保留）。 */
  onConfirm: (keepReflections: boolean) => void;
  onCancel: () => void;
}

export function RestartRoutineDialog({
  routine,
  busy = false,
  onConfirm,
  onCancel,
}: RestartRoutineDialogProps) {
  const titleId = useId();
  const reflectId = useId();
  const [keepReflections, setKeepReflections] = useState(true);

  const name = routine.display_name || routine.title || routine.key;
  const reason = routine.termination_reason;
  const deadlineHit = reason === "deadline";

  return (
    <OverlayDismissLayer
      open
      onClose={onCancel}
      busy={busy}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-md rounded-modal border border-border bg-card shadow-xl"
      contentProps={{ role: "dialog", "aria-modal": true, "aria-labelledby": titleId }}
    >
      <div className="px-5 py-4 sm:px-6" data-testid="restart-dialog">
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          Restart Routine
        </h2>
        <div className="mt-2 space-y-3 text-sm text-text-secondary">
          <p>
            Re-run{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{name}</code>{" "}
            from scratch. This resets the iteration count, cost, scores, and session, and starts a fresh
            attempt. Prior iterations are kept as history. A new run will incur cost.
          </p>

          {reason && (
            <p className="text-[13px] text-text-muted">
              Last run ended:{" "}
              <span className="font-medium text-text-secondary">{reason}</span>
            </p>
          )}

          {deadlineHit && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
              This run hit its deadline. If the deadline has already passed, edit the routine to update or
              clear it first — otherwise the restart will be blocked.
            </p>
          )}

          <label
            htmlFor={reflectId}
            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5"
          >
            <input
              id={reflectId}
              type="checkbox"
              checked={keepReflections}
              onChange={(e) => setKeepReflections(e.target.checked)}
              disabled={busy}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">
                Carry over prior reflections
              </span>
              <span className="block text-[12px] text-text-muted">
                The new attempt remembers lessons learned from past iterations. Uncheck for a clean slate.
              </span>
            </span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          leftIcon={<RotateCcw className="h-4 w-4" />}
          onClick={() => onConfirm(keepReflections)}
          loading={busy}
        >
          Restart
        </Button>
      </div>
    </OverlayDismissLayer>
  );
}
