"use client";

import { useId, type ReactNode } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { Button } from "@/components/ui/Button";

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
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-md rounded-modal border border-border bg-card shadow-xl"
      contentProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": titleId,
      }}
    >
      <div className="px-5 py-4 sm:px-6" data-testid="confirm-dialog">
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <div className="mt-2 text-sm text-text-secondary">{message}</div>
      </div>
      <div className="flex justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
        <Button
          type="button"
          data-testid="confirm-dialog-cancel"
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
          autoFocus={destructive}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          data-testid="confirm-dialog-confirm"
          variant={destructive ? "danger" : "neutral"}
          onClick={onConfirm}
          loading={busy}
          autoFocus={!destructive}
        >
          {confirmLabel}
        </Button>
      </div>
    </OverlayDismissLayer>
  );
}
