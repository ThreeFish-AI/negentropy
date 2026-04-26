"use client";

/**
 * 通用模态对话框基类（背景遮罩 + 居中卡片 + Escape 关闭 + click-outside 关闭）。
 *
 * 设计动机（Reuse-Driven / Orthogonal Decomposition）：
 * 收敛 Wiki Publication 创建对话框、Catalog 节点选择对话框等多处重复实现的
 * 模态壳。BaseModal 仅承担"壳层 + 关闭交互"，业务对话框关注于自身字段、
 * 提交按钮等差异化部分；规避空 prop 默认值导致 useEffect 重跑等同型陷阱。
 */

import { ReactNode, useEffect } from "react";

export interface BaseModalProps {
  /** 是否打开。`false` 时 BaseModal 完全 unmount，避免后台 effect 残留。 */
  open: boolean;
  /** 对话框标题（顶部 H3）。 */
  title: string;
  /** 关闭回调（Escape 键 / 遮罩点击 / 取消按钮共享）。 */
  onClose: () => void;
  /**
   * 主体内容。BaseModal 不约束布局——业务自行决定表单 / 树 / 列表渲染。
   */
  children: ReactNode;
  /** 顶部副标题（次要说明 / 警示文案）。 */
  subtitle?: ReactNode;
  /** 底部按钮区。BaseModal 提供占位结构，业务自行渲染按钮。 */
  footer?: ReactNode;
  /**
   * 卡片宽度档位。`md` ≈ max-w-md（创建对话框等表单），`lg` ≈ max-w-lg
   * （节点选择树等更宽视图）。默认 `md`。
   */
  size?: "sm" | "md" | "lg";
  /**
   * 是否允许点击遮罩关闭。默认 `true`；正在执行不可中断的提交流时可关闭。
   */
  closeOnBackdrop?: boolean;
  /**
   * 是否允许 Escape 关闭。默认 `true`；锁定流程可关闭。
   */
  closeOnEscape?: boolean;
}

const SIZE_CLASS: Record<NonNullable<BaseModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function BaseModal({
  open,
  title,
  onClose,
  children,
  subtitle,
  footer,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
}: BaseModalProps) {
  // Escape 关闭：仅在 open=true 时挂载监听器，自动清理。
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const sizeClass = SIZE_CLASS[size];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`bg-card rounded-xl shadow-xl border border-border p-6 w-full ${sizeClass} max-h-[80vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          {subtitle ? (
            <div className="mt-1 text-[11px] text-muted">{subtitle}</div>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 mt-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
