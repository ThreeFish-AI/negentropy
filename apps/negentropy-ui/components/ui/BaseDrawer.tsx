"use client";

/**
 * 通用侧边抽屉基类（遮罩 + 滑入面板 + Escape/遮罩关闭 + 焦点管理）。
 *
 * 设计动机（Reuse-Driven / Orthogonal Decomposition）：
 * 收敛 StateDrawer、TaskDetailDrawer、ActivityDrawer、Scheduler 详情抽屉等
 * 多处重复的「固定定位 + 遮罩 + 右滑面板」实现。BaseDrawer 承担壳层 + 关闭交互 +
 * 焦点陷阱 + 入场滑动，业务专注面板内容。z-[45] 介于 Header(z-30) 与 Modal(z-50) 之间。
 */

import { ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { Button } from "@/components/ui/Button";

export interface BaseDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** 滑出方向。默认 right。 */
  side?: "right" | "left";
  /** 面板宽度类（如 "max-w-md" / "w-[480px]"）。默认 max-w-md。 */
  widthClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  /** 是否渲染标题栏内置关闭按钮。默认 true。 */
  showClose?: boolean;
}

export function BaseDrawer({
  open,
  onClose,
  children,
  title,
  subtitle,
  footer,
  side = "right",
  widthClassName = "max-w-md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showClose = true,
}: BaseDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[45] flex",
        side === "right" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex h-full w-full flex-col bg-card shadow-xl outline-none",
          side === "right"
            ? "border-l border-border animate-slide-in-right"
            : "border-r border-border animate-fade-in",
          widthClassName,
        )}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 space-y-1">
              {title ? (
                <h3 id={titleId} className="text-h4 font-semibold tracking-heading text-foreground">
                  {title}
                </h3>
              ) : null}
              {subtitle ? (
                <p className="text-sm leading-caption text-text-muted">{subtitle}</p>
              ) : null}
            </div>
            {showClose ? (
              <Button
                iconOnly
                size="sm"
                variant="ghost"
                onClick={onClose}
                aria-label="关闭"
                className="-mr-1 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="border-t border-border px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
