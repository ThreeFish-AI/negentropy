"use client";

import { useId } from "react";
import { OctagonX } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import type { RoutineDTO } from "@/features/routine";

/**
 * Routine 终止确认对话框。
 *
 * 终止将取消 Routine 并中止正在执行的迭代——属「破坏性」操作，需确认门控。
 * 视觉与 a11y 复用 {@link OverlayDismissLayer}（焦点陷阱 / Esc / 遮罩关闭 / aria-modal），
 * 与 {@link RestartRoutineDialog} 同源；终止为破坏性操作，用 danger（红色）+ autoFocus 安全侧。
 */
export interface TerminateRoutineDialogProps {
  routine: RoutineDTO;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TerminateRoutineDialog({
  routine,
  busy = false,
  onConfirm,
  onCancel,
}: TerminateRoutineDialogProps) {
  const titleId = useId();
  const name = routine.display_name || routine.title || routine.key;

  return (
    <OverlayDismissLayer
      open
      onClose={onCancel}
      busy={busy}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-md rounded-modal border border-border bg-card shadow-xl"
      contentProps={{ role: "dialog", "aria-modal": true, "aria-labelledby": titleId }}
    >
      <div className="px-5 py-4 sm:px-6" data-testid="terminate-dialog">
        <h2 id={titleId} className="text-lg font-semibold text-red-600 dark:text-red-400">
          Terminate Routine
        </h2>
        <div className="mt-2 space-y-3 text-sm text-text-secondary">
          <p>
            Terminate{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{name}</code>?
            This will immediately cancel the routine and abort any in-flight iteration.
          </p>
          <p className="text-[13px] text-text-muted">
            This action cannot be undone. You can restart the routine later if needed.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} autoFocus>
          Keep Running
        </Button>
        <Button
          type="button"
          variant="danger"
          leftIcon={<OctagonX className="h-4 w-4" />}
          onClick={onConfirm}
          loading={busy}
        >
          Terminate
        </Button>
      </div>
    </OverlayDismissLayer>
  );
}
