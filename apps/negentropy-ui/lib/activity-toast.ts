/**
 * Activity-aware Toast Facade
 *
 * 对 sonner toast 的薄层封装：在显示 toast 的同时
 * 将通知内容侧写到 Activity Store (localStorage)
 *
 * 用法：调用方将 `import { toast } from "sonner"` 替换为
 * `import { toast } from "@/lib/activity-toast"` 即可，零逻辑变更。
 *
 * 设计模式：Facade + Observer (lite)
 * - 仅封装 success / error / info / warning 四个通知级别方法
 * - loading / promise / custom / message / dismiss 直接透传
 * - 仅记录 string 类型消息（React Node 不可序列化）
 */

import { toast as sonnerToast, type ExternalToast } from "sonner";
import { appendActivity, type ActivityLevel } from "./activity-store";

type ToastMessage = string | React.ReactNode;

function logAndForward(
  level: ActivityLevel,
  message: ToastMessage,
  data?: ExternalToast,
) {
  if (typeof message === "string") {
    appendActivity({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      message,
      description:
        typeof data?.description === "string" ? data.description : undefined,
    });
  }
}

/**
 * 封装后的 toast——API 与 sonner 完全一致，额外侧写活动日志
 */
export const toast = Object.assign(
  (message: ToastMessage, data?: ExternalToast) => {
    logAndForward("info", message, data);
    return sonnerToast(message, data);
  },
  {
    success: (message: ToastMessage, data?: ExternalToast) => {
      logAndForward("success", message, data);
      return sonnerToast.success(message, data);
    },
    error: (message: ToastMessage, data?: ExternalToast) => {
      logAndForward("error", message, data);
      return sonnerToast.error(message, data);
    },
    info: (message: ToastMessage, data?: ExternalToast) => {
      logAndForward("info", message, data);
      return sonnerToast.info(message, data);
    },
    warning: (message: ToastMessage, data?: ExternalToast) => {
      logAndForward("warning", message, data);
      return sonnerToast.warning(message, data);
    },
    // 透传：非通知级别方法不需要记录到活动日志
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    message: sonnerToast.message,
    dismiss: sonnerToast.dismiss,
  },
);
