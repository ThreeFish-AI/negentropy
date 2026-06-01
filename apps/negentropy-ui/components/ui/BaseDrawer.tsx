"use client";

/**
 * 通用侧边抽屉基类（遮罩 + 弹性滑入面板 + Escape/遮罩关闭 + 焦点管理）。
 *
 * 设计动机（Reuse-Driven / Orthogonal Decomposition）：
 * 收敛 StateDrawer、TaskDetailDrawer、ActivityDrawer、Scheduler 详情抽屉等
 * 多处重复的「固定定位 + 遮罩 + 右滑面板」实现。BaseDrawer 承担壳层 + 关闭交互 +
 * 焦点陷阱 + 入场滑动，业务专注面板内容。z-[45] 介于 Header(z-30) 与 Modal(z-50) 之间。
 *
 * 升级：使用 framer-motion spring 物理动画替代 CSS 动画，实现更自然的滑入/滑出。
 */

import { ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
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
  /** 面板宽度类。默认 [width:clamp(480px,66.67%,1100px)]（最小 480px / 理想视口 2/3 / 最大 1100px）。 */
  widthClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  /** 是否渲染标题栏内置关闭按钮。默认 true。 */
  showClose?: boolean;
}

const SPRING_TRANSITION = { type: "spring" as const, damping: 30, stiffness: 300 };

export function BaseDrawer({
  open,
  onClose,
  children,
  title,
  subtitle,
  footer,
  side = "right",
  widthClassName = "[width:clamp(480px,66.67%,1100px)]",
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-[45] flex",
            side === "right" ? "justify-end" : "justify-start",
          )}
        >
          <motion.div
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={cn(
              "relative flex h-full flex-col bg-card shadow-xl outline-none",
              side === "right"
                ? "border-l border-border"
                : "border-r border-border",
              widthClassName,
            )}
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={SPRING_TRANSITION}
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
