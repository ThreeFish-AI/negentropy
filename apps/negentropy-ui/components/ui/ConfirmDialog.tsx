"use client";

import { useId, type ReactNode } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

/**
 * 项目通用 ConfirmDialog — 替代浏览器原生确认/告警/输入弹窗（违反 AGENTS.md 视觉规范）。
 *
 * 设计参考 ISSUE-045 Skills 模块同款实现。从 app/interface/skills/_components 升格到 components/ui，
 * 让 SessionList、Composer、Memory 等模块可复用。
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <OverlayDismissLayer
      open={open}
      onClose={onCancel}
      busy={busy}
      backdropClassName="bg-black/55"
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      contentProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": titleId,
      }}
    >
      <div className="px-5 py-4 sm:px-6" data-testid="confirm-dialog">
        <h2
          id={titleId}
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {title}
        </h2>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</div>
      </div>
      <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4 sm:px-6 dark:border-zinc-800">
        <button
          type="button"
          data-testid="confirm-dialog-cancel"
          onClick={onCancel}
          disabled={busy}
          autoFocus={destructive}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          data-testid="confirm-dialog-confirm"
          onClick={onConfirm}
          disabled={busy}
          autoFocus={!destructive}
          className={
            "rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 " +
            (destructive
              ? "bg-red-600 hover:bg-red-700"
              : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200")
          }
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </OverlayDismissLayer>
  );
}
