"use client";

import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
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
  if (!open) return null;
  return (
    <OverlayDismissLayer
      open={open}
      onClose={onCancel}
      busy={busy}
      backdropClassName="bg-black/55"
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      </div>
      <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4 sm:px-6 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          autoFocus
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
