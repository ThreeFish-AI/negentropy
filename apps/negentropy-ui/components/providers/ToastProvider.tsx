"use client";

import { Toaster } from "sonner";

/**
 * ToastProvider
 *
 * 全局 Toast 通知 Provider，基于 sonner 实现。
 * 支持:
 * - 多种类型 (success, error, info, warning)
 * - 暗色模式自动适配
 * - 可关闭按钮
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme="system"
      toastOptions={{ duration: 5000 }}
    />
  );
}
